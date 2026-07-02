import { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { useNavigate } from 'react-router-dom';
import { PROFILE_IMAGE_FALLBACK, resolveProfileImageUrl } from './profileImage';

const API_URL = import.meta.env.VITE_API_URL;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const Login = () => {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  
  const [formData, setFormData] = useState({ matricNumber: '', password: '' });
  const [studentInfo, setStudentInfo] = useState(null); 
  const [step, setStep] = useState('FORM'); // 'FORM' -> 'LIVENESS' -> 'PROCESSING' -> 'SUCCESS'
  const [challengeLabel, setChallengeLabel] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // STEP 1: Verify Alphanumeric Credentials Only
  const handleCredentialSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    
    const payload = new FormData();
    payload.append("username", formData.matricNumber);
    payload.append("password", formData.password);

    try {
      const response = await fetch(`${API_URL}/api/verify-credentials`, { method: 'POST', body: payload });
      const result = await response.json();

      if (response.ok) {
        setStudentInfo({
          ...result,
          profile_image_resolved: resolveProfileImageUrl(API_URL, result.profile_url)
        }); 
        setStep('LIVENESS'); 
        // Trigger the challenge sequence immediately after camera mounts
        setTimeout(() => runLoginLivenessChallenges(), 1000);
      } else {
        setError(result.detail || "Invalid credentials.");
      }
    } catch (err) {
      console.error("Credential submission crash:", err);
      setError(`System Error: ${err.message || "Could not connect to backend server."}`);
    }
  };

  // STEP 2: Interactive Liveness Loops (Streamlined down to blink only)
  const runLoginLivenessChallenges = async () => {
    // FIXED: Stripped away slow yaw and pitch checks (turn head/nod)
    const loginChallenges = [
      { label: "Look directly at the camera...", action: "front" },
      { label: "Blink your eyes to verify liveness...", action: "blink" }
    ];

    for (const item of loginChallenges) {
      setChallengeLabel(item.label);
      let verified = false;
      let attempts = 0;

      while (!verified) {
        if (!webcamRef.current) {
          await sleep(400);
          continue;
        }

        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) {
          await sleep(400); 
          continue;
        }

        try {
          const blob = await (await fetch(imageSrc)).blob();
          const payload = new FormData();
          payload.append("action", item.action);
          payload.append("file", new File([blob], "login_check.jpg"));

          const res = await fetch(`${API_URL}/api/verify_action`, { method: 'POST', body: payload });
          const data = await res.json();
          
          if (data.verified) {
            verified = true; // Break loop, move to next challenge
          } else {
            attempts++;
            if ((data.reason || '').toLowerCase().includes('low light')) {
              setChallengeLabel(`${item.label} (Low light detected - move to a brighter area)`);
            } else if (attempts > 6) {
              setChallengeLabel(`${item.label} (Retry with better lighting...)`);
            }
            await sleep(600); // Polling baseline frequency
          }
            } catch (error) {
              console.error("Liveness network hiccup:", error);
          await sleep(1500);
        }
      }
    }

    // If we survive the loop, the entity is verified live. Proceed to biometric matching.
    executeFinalBiometricMatch();
  };

  // STEP 3: Face Verification Comparison (FaceNet Embedding Check)
  const executeFinalBiometricMatch = async () => {
    setStep('PROCESSING');
    setError("");
    
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        setError("Hardware Error: Lost connection to webcam stream.");
        setStep('LIVENESS');
        return;
      }

      const blob = await (await fetch(imageSrc)).blob();
      const payload = new FormData();
      payload.append("username", formData.matricNumber);
      payload.append("password", formData.password);
      payload.append("file", new File([blob], "auth.jpg"));

      const response = await fetch(`${API_URL}/login/`, { method: 'POST', body: payload });
      const result = await response.json();

      if (response.ok && result.status === "success") {
        sessionStorage.setItem("proctor_session", result.session_id);
        sessionStorage.setItem("student_matric", formData.matricNumber); 
        
        setSuccessMsg("🛡️ Identity & Liveness Verified! Access Granted.");
        setStep('SUCCESS');
        
        setTimeout(() => {
          navigate('/dashboard'); 
        }, 2500);
      } else {
        if ((result.detail || '').toLowerCase().includes('low light')) {
          setError("Low light detected. Move to a brighter area and retry the login.");
        } else {
          setError(result.detail || "Biometric matching failed against database profile Matrix.");
        }
        setStep('LIVENESS');
        // Restart challenges if verification fails
        setTimeout(() => runLoginLivenessChallenges(), 1500);
      }
    } catch (error) {
      console.error("Biometric execution exception:", error);
      setError(`Biometric Pipeline Error: ${error.message}`);
      setStep('LIVENESS');
    }
  };

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
        maxWidth: '440px', 
        backgroundColor: '#1e293b', 
        borderRadius: '16px', 
        border: '1px solid #334155',
        padding: '40px 35px', 
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.4), 0 10px 10px -5px rgba(0,0,0,0.3)',
        boxSizing: 'border-box'
      }}>
        
        {/* HEADER BAR AREA */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2 style={{ 
            margin: '0 0 10px 0', 
            fontSize: '24px', 
            fontWeight: '800', 
            letterSpacing: '-0.5px',
            color: 'white' 
          }}>
            SECURE STUDENT LOGIN
          </h2>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', lineHeight: '1.5' }}>
            Authenticate credentials and execute biometric liveness check.
          </p>
        </div>

        {/* ALERTS & ERROR BLOCKS */}
        {error && (
          <div style={{ 
            padding: '12px 16px', 
            backgroundColor: '#ef444415', 
            color: '#f87171', 
            border: '1px solid #ef444440', 
            borderRadius: '8px', 
            marginBottom: '20px', 
            fontSize: '14px',
            fontWeight: '600',
            lineHeight: '1.4'
          }}>
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div style={{ 
            padding: '14px 16px', 
            backgroundColor: '#10b98115', 
            color: '#34d399', 
            border: '1px solid #10b98140', 
            borderRadius: '8px', 
            marginBottom: '20px', 
            fontSize: '14px',
            fontWeight: '700',
            textAlign: 'center'
          }}>
            {successMsg}
          </div>
        )}

        {/* STEP 1: LOGIN ALPHANUMERIC FORM CARD */}
        {step === 'FORM' && (
          <form onSubmit={handleCredentialSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', letterSpacing: '0.3px' }}>
                Matriculation Number
              </label>
              <input 
                type="text" 
                name="matricNumber" 
                placeholder="e.g. 22/47CS/2186" 
                onChange={handleInputChange} 
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
                Portal Access Password
              </label>
              <input 
                type="password" 
                name="password" 
                placeholder="••••••••" 
                onChange={handleInputChange} 
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
                marginTop: '8px', 
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
              Verify Credentials
            </button>
          </form>
        )}

        {/* STEP 2: ACTIVE LIVENESS CAPTURE RADAR */}
        {step === 'LIVENESS' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '25px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Verified Candidate Profile
              </span>
              <h3 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: '700' }}>
                {studentInfo?.full_name}
              </h3>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #3b82f6', marginTop: '5px', boxShadow: '0 0 12px rgba(59, 130, 246, 0.2)' }}>
                <img 
                  src={studentInfo?.profile_image_resolved || PROFILE_IMAGE_FALLBACK}
                  alt="Reference Master" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = PROFILE_IMAGE_FALLBACK;
                  }}
                />
              </div>
            </div>
            
            <div style={{ 
              position: 'relative',
              borderRadius: '50%', 
              overflow: 'hidden', 
              border: '4px solid #3b82f6', 
              width: '100%', 
              maxWidth: '300px', 
              aspectRatio: '1 / 1', 
              backgroundColor: '#000',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.15)'
            }}>
              <Webcam ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {/* Scan Telemetry Line */}
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(to bottom, transparent 50%, rgba(59, 130, 246, 0.08) 50%)',
                backgroundSize: '100% 8px',
                pointerEvents: 'none'
              }} />
            </div>
            
            <div style={{ 
              padding: '14px 20px', 
              backgroundColor: '#2563eb12', 
              borderRadius: '10px', 
              border: '1px solid #2563eb25',
              width: '100%', 
              boxSizing: 'border-box' 
            }}>
              <strong style={{ color: '#60a5fa', fontSize: '15px', fontWeight: '700' }}>{challengeLabel}</strong>
            </div>
          </div>
        )}
        
        {/* STEP 3: BIOMETRIC VECTOR EXTRACTION LOADING STATE */}
        {step === 'PROCESSING' && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ 
              display: 'inline-block', 
              width: '36px', 
              height: '36px', 
              border: '4px solid #334155', 
              borderTop: '4px solid #2563eb', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite', 
              marginBottom: '20px' 
            }}></div>
            <h3 style={{ color: 'white', margin: 0, fontSize: '18px', fontWeight: '700' }}>Processing Vector Matrix Match...</h3>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '8px', lineHeight: '1.4' }}>
              Extracting FaceNet landmarks to confirm token matrix compliance.
            </p>
          </div>
        )}

        {/* STEP 4: SUCCESS TRANSFER REDIRECT WINDOW */}
        {step === 'SUCCESS' && (
          <div style={{ textAlign: 'center', padding: '25px 0' }}>
            <div style={{ fontSize: '45px', marginBottom: '15px' }}>🛡️</div>
            <h3 style={{ color: '#34d399', margin: 0, fontSize: '18px', fontWeight: '800' }}>Mounting Examination Environment...</h3>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '6px' }}>Synchronizing workspace tracking arrays...</p>
          </div>
        )}

      </div>
      
      {/* Dynamic Keyframe Injection for the Loading Spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Login;