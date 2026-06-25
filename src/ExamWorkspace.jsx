import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';

const API_URL = import.meta.env.VITE_API_URL;

const ExamWorkspace = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  
  // --- Refs ---
  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const isRecordingRef = useRef(false);
  const screenVideoRef = useRef(null);
  const latestScreenBlobRef = useRef(null); 
  const screenRecorderRef = useRef(null); 

  // --- Diagnostic State ---
  const [debugLog, setDebugLog] = useState("Diagnostic engine initialized...");

  // --- Core Exam States ---
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [screenShared, setScreenShared] = useState(false);

  // --- Telemetry Violation States ---
  const [violations, setViolations] = useState({ 
    tabSwitches: 0, 
    phoneDetections: 0, 
    materialDetections: 0, 
    absenceDetections: 0, 
    anomalies: [] 
  });
  const [statusMessage, setStatusMessage] = useState("🛡️ Secure Proctor Monitoring Active");

  // HARDENED COURSE MATCHING & EXTENDED QUESTION BANK
  const mockQuestions = [
    {
      id: 1,
      text: "Which of the following data mining architectural design approaches extracts significant itemset relationships by constructing a prefix tree structure without utilizing candidate generation passes?",
      options: ["Apriori Algorithm", "FP-Growth Algorithm", "Eclat Algorithm", "K-Means Clustering"]
    },
    {
      id: 2,
      text: "In machine learning classification optimization protocols, what primary failure mode occurs when a model fits training data perfectly but fails to generalize to validation pipelines?",
      options: ["Underfitting", "Data Leakage", "Overfitting", "Gradient Explosion"]
    },
    {
      id: 3,
      text: "Which of the following distance metrics is mathematically optimized for computing similarity profiles over high-dimensional sparse transactional data frameworks in clustering pipelines?",
      options: ["Euclidean Distance", "Manhattan Distance", "Jaccard Distance Coefficient", "Minkowski Distance"]
    },
    {
      id: 4,
      text: "During data pre-processing stages, which strategy explicitly mitigates data dimensionality explosion while maximizing the preservation of directional variance?",
      options: ["Min-Max Scaling", "Principal Component Analysis (PCA)", "Decimal Scaling", "Z-Score Normalization"]
    },
    {
      id: 5,
      text: "In hierarchical data clustering frameworks, which linkage protocol calculates similarity vectors based on the absolute maximum distance between any single data point in Cluster A and Cluster B?",
      options: ["Centroid Linkage", "Average Linkage", "Single Linkage (Minimum)", "Complete Linkage (Maximum)"]
    }
  ];

  const enableScreenTracking = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } 
      });
      
      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true; 
      
      video.style.position = "fixed";
      video.style.top = "0";
      video.style.left = "0";
      video.style.width = "100vw";
      video.style.height = "100vh";
      video.style.zIndex = "9999"; 
      video.style.opacity = "0.01"; 
      video.style.pointerEvents = "none"; 
      
      document.body.appendChild(video);
      await video.play().catch(e => console.error("Stream play blocked:", e));
      
      screenVideoRef.current = video;
      setScreenShared(true);

      stream.getVideoTracks()[0].onended = () => {
        alert("🚨 CRITICAL: Screen tracking disabled! Your exam session is compromised.");
        setScreenShared(false);
        if (document.body.contains(video)) {
          document.body.removeChild(video);
        }
      };
    } catch (err) {
      console.error("Screen share rejected:", err);
      alert("⚠️ You must grant 'Entire Screen' sharing permissions to commence this examination.");
    }
  };

  useEffect(() => {
    let dashcamInterval;
    if (screenShared && screenVideoRef.current) {
      dashcamInterval = setInterval(() => {
        const videoElement = screenVideoRef.current;
        
        if (!document.hidden && videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
          const canvas = document.createElement("canvas");
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;
          
          const ctx = canvas.getContext("2d");
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob((blob) => {
            if (blob) {
              latestScreenBlobRef.current = blob;
              if (new Date().getSeconds() % 5 === 0) {
                setDebugLog(`Buffer Active: Storing frame at ${blob.size} bytes`);
              }
            }
          }, 'image/jpeg', 0.6); 
        } else {
          setDebugLog(`Buffer Paused: videoReady=${videoElement.readyState}, width=${videoElement.videoWidth}`);
        }
      }, 1000);
    }
    return () => clearInterval(dashcamInterval);
  }, [screenShared]);

  useEffect(() => {
    const matric = sessionStorage.getItem("student_matric") || sessionStorage.getItem("username");
    if (!matric) {
      navigate('/login');
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        let diagnosticMsg = `Tab Exited at ${new Date().toLocaleTimeString()}. `;

        setViolations(prev => ({ 
          ...prev, 
          tabSwitches: prev.tabSwitches + 1,
          anomalies: [...prev.anomalies, `Tab switched out at ${new Date().toLocaleTimeString()}`]
        }));

        const payload = new FormData();
        payload.append("username", matric);

        if (latestScreenBlobRef.current) {
          payload.append("file", new File([latestScreenBlobRef.current], "desktop_evidence.jpg", { type: "image/jpeg" }));
          diagnosticMsg += `Snapshot locked. `;
        }

        fetch(`${API_URL}/api/log_tab_switch`, { method: 'POST', body: payload })
          .catch(err => console.error("Network Error on snapshot:", err));

        const stream = screenVideoRef.current?.srcObject;
        if (stream) {
          try {
            const options = MediaRecorder.isTypeSupported('video/webm') ? { mimeType: 'video/webm' } : {};
            const recorder = new MediaRecorder(stream, options);
            screenRecorderRef.current = recorder;
            let chunks = [];

            recorder.ondataavailable = (e) => {
              if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = async () => {
              const blob = new Blob(chunks, { type: options.mimeType || 'video/mp4' });
              const videoPayload = new FormData();
              videoPayload.append("username", matric);
              videoPayload.append("violation_type", "Prolonged Tab Excursion");
              videoPayload.append("file", new File([blob], `excursion_${Date.now()}.webm`, { type: blob.type }));

              fetch(`${API_URL}/api/upload_incident_video`, { method: 'POST', body: videoPayload })
                .then(() => setDebugLog("✅ Excursion video evidence transmitted successfully."))
                .catch(err => setDebugLog(`❌ Failed to upload excursion video: ${err.message}`));
            };

            recorder.start();
            diagnosticMsg += `Background surveillance recording initialized...`;
          } catch (err) {
            diagnosticMsg += `Failed to start excursion recorder.`;
          }
        }

        setDebugLog(diagnosticMsg);
        alert("🚨 WARNING: Tab-switching is strictly prohibited. Desktop evidence is actively recording.");
      
      } else {
        if (screenRecorderRef.current && screenRecorderRef.current.state === "recording") {
          screenRecorderRef.current.stop();
          setDebugLog(`Tab Focus Restored at ${new Date().toLocaleTimeString()}. Packaging excursion video...`);
        }
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const intervalId = setInterval(() => {
      analyzeWorkspaceEnvironment(matric);
    }, 2500);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [navigate, examId]);

  const captureIncidentClip = (violationType, matric) => {
    if (isRecordingRef.current) return; 
    
    const stream = webcamRef.current?.stream || webcamRef.current?.video?.srcObject;
    if (!stream) return;

    try {
      const options = MediaRecorder.isTypeSupported('video/webm') ? { mimeType: 'video/webm' } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      let chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        isRecordingRef.current = false;
        const blob = new Blob(chunks, { type: options.mimeType || 'video/mp4' });
        const payload = new FormData();
        payload.append("username", matric);
        payload.append("violation_type", violationType);
        payload.append("file", new File([blob], `incident_${Date.now()}.webm`, { type: blob.type }));

        try {
          await fetch(`${API_URL}/api/upload_incident_video`, { method: 'POST', body: payload });
        } catch (err) {
          console.error("Video submission error:", err);
        }
      };

      mediaRecorder.start();
      isRecordingRef.current = true;

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, 5000);

    } catch (err) {
      console.error("Recorder error:", err);
      isRecordingRef.current = false;
    }
  };

  const analyzeWorkspaceEnvironment = async (matricNumber) => {
    if (!webcamRef.current) return;
    
    const base64Frame = webcamRef.current.getScreenshot();
    if (!base64Frame) return;

    try {
      const blob = await (await fetch(base64Frame)).blob();
      const payload = new FormData();
      payload.append("username", matricNumber);
      payload.append("exam_id", examId);
      payload.append("file", new File([blob], "telemetry_frame.jpg", { type: "image/jpeg" }));

      const response = await fetch(`${API_URL}/api/proctor_telemetry`, { method: 'POST', body: payload });
      const data = await response.json();
      
      if (response.ok && data.violations && data.violations.length > 0) {
        const hasPhone = data.violations.some(v => v.toLowerCase().includes("phone"));
        const hasMaterial = data.violations.some(v => v.toLowerCase().includes("material") || v.toLowerCase().includes("book"));
        const hasAbsence = data.violations.some(v => v.toLowerCase().includes("absence") || v.toLowerCase().includes("no candidate"));

        if (hasPhone || hasMaterial) {
          captureIncidentClip(data.violations[0], matricNumber);
        }

        setViolations(prev => ({
          ...prev,
          phoneDetections: hasPhone ? (prev.phoneDetections || 0) + 1 : (prev.phoneDetections || 0),
          materialDetections: hasMaterial ? (prev.materialDetections || 0) + 1 : (prev.materialDetections || 0),
          absenceDetections: hasAbsence ? (prev.absenceDetections || 0) + 1 : (prev.absenceDetections || 0),
          anomalies: [...(prev.anomalies || []), ...data.violations]
        }));
        
        setStatusMessage(`⚠️ CRITICAL: ${data.violations[0]}!`);
      } else if (response.ok) {
        setStatusMessage("🛡️ Secure Proctor Monitoring Active");
      }
    } catch (err) {
      console.error("Telemetry link error:", err);
    }
  };

  const handleOptionSelect = (questionId, option) => {
    setSelectedAnswers({ ...selectedAnswers, [questionId]: option });
  };

  const handleFinishExam = () => {
    setExamSubmitted(true);
    setStatusMessage("✅ Examination Pipeline Sealed.");
  };

  if (examSubmitted) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#0f172a', fontFamily: 'system-ui, sans-serif', padding: '20px', boxSizing: 'border-box' }}>
        <div style={{ padding: '50px 40px', maxWidth: '600px', width: '100%', textAlign: 'center', backgroundColor: '#1e293b', borderRadius: '16px', border: '1px solid #334155', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
          <span style={{ fontSize: '60px', display: 'block', marginBottom: '15px' }}>📤</span>
          <h2 style={{ color: 'white', margin: '0 0 10px 0', fontSize: '24px', fontWeight: '800' }}>Examination Scripts Submitted</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '30px', lineHeight: '1.5' }}>Your responses have been securely packaged and compiled inside the repository database infrastructure.</p>
          
          <div style={{ backgroundColor: '#0f172a', padding: '22px', borderRadius: '10px', border: '1px solid #334155', textAlign: 'left' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#38bdf8', borderBottom: '1px solid #334155', paddingBottom: '8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Workspace Security Audit Summary:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', color: '#cbd5e1' }}>
              <p style={{ margin: 0 }}>🛑 Navigation Exits Count: <strong style={{color: violations.tabSwitches > 0 ? '#f87171' : '#34d399'}}>{violations.tabSwitches} incidents</strong></p>
              <p style={{ margin: 0 }}>📱 Persistent Phone Flags: <strong style={{color: violations.phoneDetections > 0 ? '#f87171' : '#34d399'}}>{violations.phoneDetections} frames</strong></p>
              <p style={{ margin: 0 }}>📚 Material/Book Flags: <strong style={{color: violations.materialDetections > 0 ? '#f87171' : '#34d399'}}>{violations.materialDetections} frames</strong></p>
              <p style={{ margin: 0 }}>👤 Candidate Absence Flags: <strong style={{color: violations.absenceDetections > 0 ? '#f87171' : '#34d399'}}>{violations.absenceDetections} frames</strong></p>
            </div>
          </div>
          
          <button onClick={() => navigate('/dashboard')} style={{ marginTop: '35px', width: '100%', padding: '14px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '15px', transition: 'all 0.2s' }}>
            Return to Hub
          </button>
        </div>
      </div>
    );
  }

  if (!screenShared) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0f172a', fontFamily: 'system-ui, sans-serif', color: 'white', textAlign: 'center', padding: '20px', boxSizing: 'border-box' }}>
        <h2 style={{ fontSize: '30px', fontWeight: '800', marginBottom: '12px', letterSpacing: '-0.5px' }}>Workspace Security Initialization</h2>
        <p style={{ color: '#94a3b8', maxWidth: '520px', lineHeight: '1.6', fontSize: '14px', marginBottom: '35px' }}>
          To maintain academic integrity, this environment requires active desktop tracking. Please click below and share your <strong>Entire Screen</strong>. You will not be permitted to view the questions until the secure pipe is established.
        </p>
        <button 
          onClick={enableScreenTracking}
          style={{ padding: '16px 32px', backgroundColor: '#2563eb', color: 'white', fontSize: '15px', fontWeight: '700', border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.3)', transition: 'background-color 0.2s' }}
        >
          Initialize Secure Screen Tracking
        </button>
      </div>
    );
  }

  const currentQuestion = mockQuestions[currentQuestionIndex];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'grid', gridTemplateColumns: '3fr 1fr', color: '#f1f5f9' }}>
      
      {/* LEFT PANEL: EXAM CONTAINER LAYOUT */}
      <main style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '30px', boxSizing: 'border-box' }}>
        <div style={{ backgroundColor: '#1e293b', padding: '35px', borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '18px', marginBottom: '25px' }}>
            <span style={{ fontWeight: '800', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '14px' }}>
              📝 SYSTEM LAB WORKSPACE: {examId === "CSC420" ? "CSC 420 (Data Mining & Warehousing)" : examId}
            </span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', backgroundColor: '#0f172a', padding: '4px 10px', borderRadius: '12px', border: '1px solid #334155' }}>
              Question {currentQuestionIndex + 1} of {mockQuestions.length}
            </span>
          </div>

          <h3 style={{ color: 'white', lineHeight: '1.5', marginBottom: '30px', fontSize: '18px', fontWeight: '600' }}>{currentQuestion.text}</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedAnswers[currentQuestion.id] === option;
              return (
                <label key={idx} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '14px', 
                  padding: '18px 20px', 
                  border: isSelected ? '2px solid #38bdf8' : '1px solid #334155', 
                  borderRadius: '8px', 
                  backgroundColor: isSelected ? '#38bdf80a' : '#0f172a',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxSizing: 'border-box'
                }}>
                  <input 
                    type="radio" 
                    name={`question-${currentQuestion.id}`} 
                    checked={isSelected}
                    onChange={() => handleOptionSelect(currentQuestion.id, option)}
                    style={{ transform: 'scale(1.25)', accentColor: '#38bdf8' }}
                  />
                  <span style={{ fontSize: '15px', color: isSelected ? 'white' : '#cbd5e1', fontWeight: isSelected ? '700' : '500' }}>{option}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
          <button 
            disabled={currentQuestionIndex === 0}
            onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
            style={{ padding: '12px 24px', backgroundColor: '#1e293b', color: currentQuestionIndex === 0 ? '#64748b' : '#cbd5e1', border: '1px solid #334155', borderRadius: '6px', fontWeight: '700', cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer', fontSize: '14px' }}
          >
            Previous Node
          </button>
          
          {currentQuestionIndex < mockQuestions.length - 1 ? (
            <button 
              onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
              style={{ padding: '12px 28px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}
            >
              Next Question
            </button>
          ) : (
            <button 
              onClick={handleFinishExam}
              style={{ padding: '12px 28px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}
            >
              Submit Response Scripts
            </button>
          )}
        </div>
      </main>

      {/* RIGHT PANEL: LIVE TELEMETRY OVERWATCH SHIELD */}
      <aside style={{ backgroundColor: '#1e293b', color: 'white', padding: '35px 25px', display: 'flex', flexDirection: 'column', gap: '30px', borderLeft: '1px solid #334155', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center' }}>
          <h4 style={{ margin: '0 0 15px 0', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', color: '#94a3b8', textTransform: 'uppercase' }}>LIVE INTEGRITY STREAM</h4>
          <div style={{ width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden', border: '2px solid #3b82f6', backgroundColor: '#000', boxShadow: '0 0 15px rgba(59,130,246,0.15)' }}>
            <Webcam 
              audio={false} 
              ref={webcamRef} 
              screenshotFormat="image/jpeg" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          </div>
        </div>

        <div style={{ backgroundColor: '#0f172a', padding: '14px', borderRadius: '8px', border: '1px solid #334155' }}>
          <p style={{ margin: 0, fontSize: '13px', color: statusMessage.includes('🛡️') ? '#34d399' : '#f87171', fontWeight: '700', textAlign: 'center' }}>{statusMessage}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ margin: '0', borderBottom: '1px solid #334155', paddingBottom: '8px', color: '#94a3b8', fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px' }}>SESSION METRICS</h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: '#cbd5e1' }}>Tab Exits Redlines:</span>
            <span style={{ fontWeight: '800', color: violations.tabSwitches > 0 ? '#f87171' : '#34d399' }}>{violations.tabSwitches}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: '#cbd5e1' }}>Phone Violations:</span>
            <span style={{ fontWeight: '800', color: violations.phoneDetections > 0 ? '#f87171' : '#34d399' }}>{violations.phoneDetections || 0} frames</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: '#cbd5e1' }}>Material Violations:</span>
            <span style={{ fontWeight: '800', color: violations.materialDetections > 0 ? '#f87171' : '#34d399' }}>{violations.materialDetections || 0} frames</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
            <span style={{ color: '#cbd5e1' }}>Absence Violations:</span>
            <span style={{ fontWeight: '800', color: violations.absenceDetections > 0 ? '#f87171' : '#34d399' }}>{violations.absenceDetections || 0} frames</span>
          </div>
        </div>

        {/* DIAGNOSTIC PANEL */}
        <div style={{ backgroundColor: '#020617', padding: '16px', borderRadius: '8px', border: '1px dashed #38bdf8', marginTop: 'auto', boxSizing: 'border-box' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '11px', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>System Diagnostics</h4>
          <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: '1.4' }}>
            {debugLog}
          </p>
        </div>

      </aside>

    </div>
  );
};

export default ExamWorkspace;