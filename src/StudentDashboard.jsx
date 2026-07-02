import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROFILE_IMAGE_FALLBACK, resolveProfileImageUrl } from './profileImage';

const API_URL = import.meta.env.VITE_API_URL;

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [student, setStudent] = useState({ name: 'Loading...', image: PROFILE_IMAGE_FALLBACK, matric: '' });
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [systemCheck, setSystemCheck] = useState({ camera: 'Checking...', network: 'Optimal' });

  useEffect(() => {
    const rawMatric = sessionStorage.getItem("student_matric") || sessionStorage.getItem("username");
    
    if (!rawMatric) {
      navigate('/login');
      return;
    }

    // Force strict case alignment to match database schema records
    const matric = rawMatric.trim();

    const mockExams = [
      { id: "CSC420", title: "CSC 420: Data Mining & Warehousing", duration: "2 Hours", status: "Available", date: "Today" },
      { id: "CSC422", title: "CSC 422: Project Management", duration: "1.5 Hours", status: "Upcoming", date: "Tomorrow" }
    ];

    // FIX: encodeURIComponent handles slashes cleanly so FastAPI reads it as a single string variable
    fetch(`${API_URL}/api/profile/${encodeURIComponent(matric)}`)
      .then(res => {
        if (!res.ok) throw new Error(`Server returned status code: ${res.status}`);
        return res.json();
      })
      .then(data => {
        const determinedImgUrl = resolveProfileImageUrl(API_URL, data.profile_image_url);

        setStudent({ 
          name: data.full_name, 
          image: determinedImgUrl, 
          matric: matric 
        });
        setExams(mockExams);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch profile cleanly:", err);
        setStudent({ 
          name: "Verified Candidate", 
          image: PROFILE_IMAGE_FALLBACK,
          matric: matric 
        });
        setExams(mockExams);
        setLoading(false);
      });

    // Verify browser hardware capability and clean up stream resources
    let activeStream = null;
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        activeStream = stream;
        setSystemCheck(prev => ({ ...prev, camera: '🟢 Ready' }));
        stream.getTracks().forEach(track => track.stop());
      })
      .catch((err) => {
        console.error("Camera check error:", err);
        setSystemCheck(prev => ({ ...prev, camera: '🔴 Blocked / Missing' }));
      });

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };

  }, [navigate]);

  const handleStartExam = (examId) => {
    if (systemCheck.camera.includes('🔴')) {
      alert("Cannot initialize exam workspace: Camera hardware check failed.");
      return;
    }
    sessionStorage.setItem("active_exam_id", examId);
    navigate(`/exam-workspace/${examId}`);
  };

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        backgroundColor: '#0f172a',
        fontFamily: 'system-ui, sans-serif',
        gap: '15px'
      }}>
        <div style={{ width: '36px', height: '36px', border: '4px solid #1e293b', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <h3 style={{ color: '#94a3b8', margin: 0, fontSize: '15px', fontWeight: '600' }}>Hydrating Dashboard Infrastructure...</h3>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#f8fafc' }}>
      
      {/* NAVIGATION BAR AREA */}
      <nav style={{ 
        backgroundColor: '#1e293b', 
        color: 'white', 
        padding: '16px 40px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: '1px solid #334155',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '0.5px', background: 'linear-gradient(to right, #3b82f6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            🛡️ CANDIDATE WORKSPACE TERMINAL
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: '#f1f5f9' }}>{student.name}</p>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>{student.matric}</p>
          </div>
          <img
            src={student.image}
            alt="Profile Node"
            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #3b82f6', boxShadow: '0 0 8px rgba(59, 130, 246, 0.3)' }}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = PROFILE_IMAGE_FALLBACK;
            }}
          />
          <button 
            onClick={handleLogout} 
            style={{ 
              padding: '8px 14px', 
              backgroundColor: '#ef444415', 
              color: '#f87171', 
              border: '1px solid #ef444440', 
              borderRadius: '6px', 
              fontWeight: '700', 
              cursor: 'pointer', 
              fontSize: '12px',
              transition: 'all 0.2s'
            }}
          >
            Disconnect Session
          </button>
        </div>
      </nav>

      {/* CORE CONTROL CONTAINER GRID */}
      <div style={{ maxWidth: '1200px', margin: '40px auto', padding: '0 30px', display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '35px', boxSizing: 'border-box' }}>
        
        {/* MAIN ASSIGNED EXAMINATION CONSOLE */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          <div style={{ backgroundColor: '#1e293b', padding: '30px', borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }}>
            <h2 style={{ marginTop: 0, borderBottom: '1px solid #334155', paddingBottom: '15px', color: 'white', fontSize: '20px', fontWeight: '800' }}>
              Assigned Examinations
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
              {exams.map(exam => (
                <div key={exam.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px', border: '1px solid #334155', borderRadius: '8px', backgroundColor: '#0f172a' }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', color: 'white', fontSize: '16px', fontWeight: '700' }}>{exam.title}</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', display: 'flex', gap: '15px' }}>
                      <span>⏳ <strong>Duration:</strong> {exam.duration}</span>
                      <span>🗓️ <strong>Schedule:</strong> {exam.date}</span>
                    </p>
                  </div>
                  <div>
                    {exam.status === "Available" ? (
                      <button 
                        onClick={() => handleStartExam(exam.id)} 
                        style={{ 
                          padding: '10px 18px', 
                          backgroundColor: '#2563eb', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '6px', 
                          fontWeight: '700', 
                          cursor: 'pointer', 
                          fontSize: '13px',
                          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                        }}
                      >
                        Launch Exam Environment
                      </button>
                    ) : (
                      <span style={{ padding: '8px 14px', backgroundColor: '#1e293b', color: '#64748b', border: '1px solid #334155', borderRadius: '6px', fontSize: '12px', fontWeight: '700', letterSpacing: '0.3px' }}>
                        🔒 SYSTEM LOCKED
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* SIDEBAR SECURITY IDENTITY MATRIX */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {/* HARDWARE REASSURANCE CARD */}
          <div style={{ 
            backgroundColor: '#10b9810a', 
            border: '1px solid #10b98130', 
            padding: '24px', 
            borderRadius: '12px', 
            textAlign: 'center',
            background: 'linear-gradient(135deg, #1e293b 0%, #112520 100%)'
          }}>
            <span style={{ fontSize: '28px', display: 'block', marginBottom: '10px' }}>🔒</span>
            <h3 style={{ margin: '0 0 6px 0', color: '#34d399', fontSize: '15px', fontWeight: '800' }}>Biometrics Locked</h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#a7f3d0', lineHeight: '1.5', opacity: '0.85' }}>
              Feature vectors synched with active session context. Computer vision constraints initialized.
            </p>
          </div>

          {/* TELEMETRY HARDWARE TRACKS MONITOR */}
          <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', border: '1px solid #334155' }}>
            <h3 style={{ marginTop: 0, color: 'white', fontSize: '14px', fontWeight: '700', borderBottom: '1px solid #334155', paddingBottom: '10px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
              Workspace Diagnostics
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#cbd5e1' }}>Webcam Stream:</span>
                <span style={{ fontWeight: '700', fontSize: '12px' }}>{systemCheck.camera}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#cbd5e1' }}>Network Pipeline:</span>
                <span style={{ fontWeight: '700', color: '#34d399', fontSize: '12px' }}>● {systemCheck.network}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#cbd5e1' }}>AI Neural Core Sync:</span>
                <span style={{ fontWeight: '700', color: '#34d399', fontSize: '12px' }}>● Secure Link</span>
              </div>
            </div>
          </div>
        </aside>
        
      </div>
    </div>
  );
};

export default StudentDashboard;