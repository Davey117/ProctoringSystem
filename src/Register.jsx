import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';

const API_URL = import.meta.env.VITE_API_URL;

// Helper to prevent UI thread freezing
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const Register = () => {
  // --- Form State ---
  const [formData, setFormData] = useState({
    matricNumber: '',
    fullName: '',
    password: ''
  });

  // --- Liveness & Camera State ---
  const webcamRef = useRef(null);
  const [step, setStep] = useState(1); // 1: Form, 2: Liveness, 3: Processing
  const [challenge, setChallenge] = useState("");
  const [error, setError] = useState("");
  
  // Stores the verified, baseline snapshot for database storage
  const [frontFrame, setFrontFrame] = useState(null);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const startLivenessCheck = (e) => {
    e.preventDefault();
    if (!formData.matricNumber || !formData.fullName || !formData.password) {
      setError("All fields are strictly required for enrollment.");
      return;
    }
    setError("");
    setStep(2);
    setChallenge("Initializing secure camera pipe...");
  };

  const handleCameraReady = () => {
    runChallenges();
  };

  const runChallenges = async () => {
    // FIXED: Stripped away slow yaw and pitch checks (turn head/nod)
    const challengeMap = [
      { label: "Look directly at the camera...", action: "front" },
      { label: "Blink your eyes to verify liveness...", action: "blink" }
    ];

    for (const item of challengeMap) {
      setChallenge(item.label);
      
      let verified = false;
      let attempts = 0;

      // Gatekeeper: Stays here until backend confirms verification
      while (!verified) {
        if (!webcamRef.current) {
          await sleep(500);
          continue;
        }

        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) {
          await sleep(500); 
          continue;
        }

        try {
          const blob = await (await fetch(imageSrc)).blob();
          const payload = new FormData();
          payload.append("action", item.action);
          payload.append("file", new File([blob], "check.jpg"));

          const res = await fetch(`${API_URL}/api/verify_action`, { 
              method: 'POST', 
              body: payload 
          });
          
          const data = await res.json();
          
          if (data.verified) {
            // Capture this specific verified frame to store as the official profile picture
            if (item.action === "front") {
              setFrontFrame(imageSrc);
            }
            verified = true; // Gate opens for next challenge
          } else {
            attempts++;
            if (attempts > 5) setChallenge(`${item.label} (Still adjusting...)`);
            await sleep(800); // Prevents thread blocking
          }
        } catch (e) {
          console.error("Network hiccup:", e);
          await sleep(2000); // Backoff on error
        }
      }
    }

    setChallenge("🔒 Biometrics verified. Compiling identity profile...");
    await sleep(1000);
    captureAndEnroll();
  };

  const captureAndEnroll = useCallback(async () => {
    setStep(3);
    
    // Fallback to live screenshot if frontFrame was somehow skipped
    const finalImage = frontFrame || webcamRef.current.getScreenshot();
    
    if (!finalImage) {
      setError("Hardware Error: Could not capture frame snapshot.");
      setStep(1);
      return;
    }

    try {
      const fetchRes = await fetch(finalImage);
      const blob = await fetchRes.blob();
      const file = new File([blob], "biometric_sample.jpg", { type: "image/jpeg" });

      const payload = new FormData();
      payload.append("username", formData.matricNumber);
      payload.append("full_name", formData.fullName);  
      payload.append("password", formData.password);
      payload.append("file", file); // Transmits the clean, front-facing image
 
      const response = await fetch(`${API_URL}/enroll/`, {
        method: 'POST',
        body: payload
      });
      
      const result = await response.json();
      
      if (response.ok && result.status === "success") {
        sessionStorage.setItem("student_image", finalImage);
        sessionStorage.setItem("student_name", formData.fullName);
        setChallenge("🛡️ Secure registration complete! Signature locked.");
        setTimeout(() => window.location.href = "/dashboard", 2500); 
      } else {
        setError(`Enrollment Failed: ${result.detail || "Biometric extraction error."}`);
        setStep(1);
      }
    } catch (err) {
      setError("Network Error: Could not connect to the secure backend server.");
      setStep(1);
    }
  }, [formData, frontFrame]);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh', 
      backgroundColor: '#0f172a', 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div style={{ 
        width: '100%',
        maxWidth: '460px', 
        backgroundColor: '#1e293b', 
        borderRadius: '16px', 
        border: '1px solid #334155',
        padding: '40px 35px', 
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.4), 0 10px 10px -5px rgba(0,0,0,0.3)',
        boxSizing: 'border-box'
      }}>
        
        {/* HEADER AREA */}
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <h2 style={{ 
            margin: '0 0 10px 0', 
            fontSize: '26px', 
            fontWeight: '800', 
            letterSpacing: '-0.5px',
            color: 'white' 
          }}>
            BIOMETRIC ENROLLMENT
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', lineHeight: '1.5' }}>
            Initialize your secure student profile node via multi-step liveness telemetry.
          </p>
        </div>
        
        {/* ALERTS / ERRORS */}
        {error && (
          <div style={{ 
            padding: '14px 16px', 
            backgroundColor: '#ef444415', 
            color: '#f87171', 
            border: '1px solid #ef444440', 
            borderRadius: '8px', 
            marginBottom: '25px', 
            fontSize: '14px',
            fontWeight: '600',
            lineHeight: '1.4'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* STEP 1: INITIAL DATA COLLECTION SECURE INPUT FORM */}
        {step === 1 && (
          <form onSubmit={startLivenessCheck} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', letterSpacing: '0.3px' }}>
                Matriculation Number
              </label>
              <input 
                type="text" 
                name="matricNumber" 
                value={formData.matricNumber} 
                onChange={handleInputChange} 
                placeholder="e.g. 22/47CS/2186" 
                style={{ 
                  width: '100%', 
                  padding: '12px 16px', 
                  backgroundColor: '#0f172a', 
                  border: '1px solid #334155', 
                  borderRadius: '8px', 
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s'
                }} 
                required 
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', letterSpacing: '0.3px' }}>
                Full Legal Name
              </label>
              <input 
                type="text" 
                name="fullName" 
                value={formData.fullName} 
                onChange={handleInputChange} 
                placeholder="Surname First" 
                style={{ 
                  width: '100%', 
                  padding: '12px 16px', 
                  backgroundColor: '#0f172a', 
                  border: '1px solid #334155', 
                  borderRadius: '8px', 
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }} 
                required 
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', letterSpacing: '0.3px' }}>
                Portal Security Password
              </label>
              <input 
                type="password" 
                name="password" 
                value={formData.password} 
                onChange={handleInputChange} 
                placeholder="Establish account key" 
                style={{ 
                  width: '100%', 
                  padding: '12px 16px', 
                  backgroundColor: '#0f172a', 
                  border: '1px solid #334155', 
                  borderRadius: '8px', 
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }} 
                required 
              />
            </div>
            
            <button 
              type="submit" 
              style={{ 
                marginTop: '10px', 
                padding: '14px', 
                backgroundColor: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                fontWeight: '700', 
                cursor: 'pointer', 
                fontSize: '15px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                transition: 'background-color 0.2s'
              }}
            >
              Initialize Biometric Capture
            </button>
          </form>
        )}

        {/* STEPS 2 & 3: COMPUTER VISION TELEMETRY ENGAGEMENT */}
        {(step === 2 || step === 3) && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              position: 'relative', 
              width: '100%', 
              maxWidth: '360px', 
              margin: '0 auto', 
              overflow: 'hidden', 
              borderRadius: '50%', 
              border: step === 3 ? '4px solid #10b981' : '4px solid #3b82f6',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.15)',
              backgroundColor: '#000',
              aspectRatio: '1 / 1',
              transition: 'border-color 0.3s ease'
            }}>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ width: 400, height: 400, facingMode: "user" }}
                onUserMedia={handleCameraReady}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(to bottom, transparent 50%, rgba(59, 130, 246, 0.08) 50%)',
                backgroundSize: '100% 8px',
                pointerEvents: 'none'
              }} />
            </div>
            
            <div style={{ 
              marginTop: '30px', 
              padding: '16px 20px', 
              backgroundColor: step === 3 ? '#10b98115' : '#2563eb12', 
              borderRadius: '10px',
              border: step === 3 ? '1px solid #10b98130' : '1px solid #2563eb25'
            }}>
              <h3 style={{ 
                margin: 0, 
                color: step === 3 ? '#34d399' : '#60a5fa', 
                fontSize: '16px',
                fontWeight: '700',
                lineHeight: '1.4'
              }}>
                {step === 3 ? "Processing Matrix via AI Core..." : challenge}
              </h3>
              {step === 2 && (
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: '6px 0 0 0' }}>
                  Keep your face steady within the scanner viewport.
                </p>
              )}
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
};

export default Register;