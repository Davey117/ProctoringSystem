import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Register from './Register';
import Login from './Login';
import ProctorDashboard from './ProctorDashboard';
import StudentDashboard from './StudentDashboard';
import ExamWorkspace from './ExamWorkspace';
import LecturerDashboard from './LecturerDashboard';

// This handles updating the favicon and title text dynamically across all pages
function TabIdentityManager() {
  const location = useLocation();

  useEffect(() => {
    // 1. DYNAMIC FAVICON FIX: Target or create the shortcut icon link element
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      document.getElementsByTagName('head')[0].appendChild(link);
    }

    link.href = "/proctor-favicon.svg?v=1";

    // 2. DYNAMIC TITLE SETTING: Match page title text to current path
    const path = location.pathname;
    if (path === '/login') {
      document.title = "Student Login | Secure Portal";
    } else if (path === '/register') {
      document.title = "Biometric Enrollment Terminal";
    } else if (path.startsWith('/exam-workspace')) {
      document.title = "🔒 SECURE EXAM WORKSPACE ACTIVE";
    } else if (path === '/dashboard' || path === '/StudentDashboard') {
      document.title = "Candidate Dashboard Terminal";
    } else if (path === '/lecturer') {
      document.title = "Lecturer Control Center";
    } else if (path === '/proctor') {
      document.title = "Supervisor Overwatch Console";
    } else {
      document.title = "AI Biometric Proctoring System";
    }
  }, [location]);

  return null; 
}

// PREMIUM HOME OVERVIEW HUB COMPONENT
function HomeHubView() {
  return (
    <div style={{ 
      minHeight: 'calc(100vh - 73px)', 
      backgroundColor: '#0f172a', 
      fontFamily: 'system-ui, -apple-system, sans-serif', 
      color: '#cbd5e1',
      padding: '60px 20px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* CENTRALIZED HERO ANCHOR BLOCK */}
      <div style={{ textAlign: 'center', maxWidth: '800px', marginBottom: '50px' }}>
        <div style={{ fontSize: '50px', marginBottom: '15px' }}>🛡️</div>
        <h1 style={{ 
          margin: '0 0 15px 0', 
          fontSize: '36px', 
          fontWeight: '800', 
          letterSpacing: '-1px',
          color: 'white'
        }}>
          Intelligent Multi-Agent Biometric Proctoring Framework
        </h1>
        <p style={{ margin: 0, fontSize: '16px', color: '#94a3b8', lineHeight: '1.6' }}>
          An automated academic integrity verification system executing edge computer vision pipelines, real-time eye-blink tracking, and multi-device object detection algorithms.
        </p>
      </div>

      {/* CORE OPERATIONAL SYSTEM TILES */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '25px', 
        width: '100%', 
        maxWidth: '960px',
        marginBottom: '50px'
      }}>
        {/* CARD 1: IDENTITY MATRIX */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '25px', transition: 'all 0.2s' }}>
          <div style={{ fontSize: '24px', marginBottom: '12px' }}>👤</div>
          <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '16px', fontWeight: '700' }}>Biometric Verification</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
            Extracts deep 128-dimensional FaceNet embeddings to authenticate identities and evaluates rapid optical tracking patterns via live eye-blink telemetry constraints.
          </p>
        </div>

        {/* CARD 2: YOLO OVERWATCH */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '25px' }}>
          <div style={{ fontSize: '24px', marginBottom: '12px' }}>👁️</div>
          <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '16px', fontWeight: '700' }}>Object Detection Core</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
            Deploys real-time ultralytics inference engines to actively inspect workspace regions for secondary computational devices, smartphones, or unauthorized candidate presence threats.
          </p>
        </div>

        {/* CARD 3: WORKSPACE SURVEILLANCE */}
        <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '25px' }}>
          <div style={{ fontSize: '24px', marginBottom: '12px' }}>🖥️</div>
          <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '16px', fontWeight: '700' }}>Excursion Tracking</h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
            Locks the active browser view area. Intercepts tab-switches instantly to capture immediate desktop buffer snapshots and records background telemetry logs for candidate review logs.
          </p>
        </div>
      </div>

      {/* QUICK ACTIONS ROUTING SHORTCUTS */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        <Link to="/login" style={{ 
          padding: '12px 28px', 
          backgroundColor: '#2563eb', 
          color: 'white', 
          textDecoration: 'none', 
          borderRadius: '8px', 
          fontWeight: '700', 
          fontSize: '14px',
          boxShadow: '0 4px 12px rgba(37,99,235,0.2)'
        }}>
          Access Student Portal
        </Link>
        <Link to="/register" style={{ 
          padding: '12px 28px', 
          backgroundColor: '#1e293b', 
          color: '#cbd5e1', 
          textDecoration: 'none', 
          borderRadius: '8px', 
          fontWeight: '700', 
          fontSize: '14px',
          border: '1px solid #334155'
        }}>
          Candidate Enrollment
        </Link>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      {/* Run the identity manager inside the routing context */}
      <TabIdentityManager />

      <nav style={{ 
        padding: '16px 40px', 
        backgroundColor: '#1e293b', 
        color: 'white', 
        display: 'flex', 
        alignItems: 'center',
        gap: '25px', 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        borderBottom: '1px solid #334155',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)'
      }}>
        <strong style={{ 
          marginRight: 'auto', 
          fontSize: '16px', 
          letterSpacing: '0.3px',
          background: 'linear-gradient(to right, #3b82f6, #10b981)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          🛡️ BIOMETRIC PROCTORING SYSTEM
        </strong>
        <Link to="/register" style={{ color: '#60a5fa', textDecoration: 'none', fontSize: '14px', fontWeight: '700' }}>Enrollment</Link>
        <Link to="/login" style={{ color: '#34d399', textDecoration: 'none', fontSize: '14px', fontWeight: '700' }}>Student Login</Link>
        <Link to="/lecturer" style={{ color: '#fbbf24', textDecoration: 'none', fontSize: '14px', fontWeight: '700' }}>Lecturer</Link>
        <Link to="/proctor" style={{ color: '#f87171', textDecoration: 'none', fontSize: '14px', fontWeight: '700' }}>Proctor</Link>
      </nav>

      <Routes>
        {/* ENHANCED DEFAULT HOMEPAGE ROUTE ENTRY PATH */}
        <Route path="/" element={<HomeHubView />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/proctor" element={<ProctorDashboard />} />
        <Route path="/lecturer" element={<LecturerDashboard />} />
        <Route path="/exam-workspace/:examId" element={<ExamWorkspace />} />
        <Route path="/dashboard" element={<StudentDashboard />} />
        <Route path="/StudentDashboard" element={<StudentDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;