import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Register from './Register';
import Login from './Login';
import ProctorDashboard from './ProctorDashboard';
import StudentDashboard from './StudentDashboard';
import ExamWorkspace from './ExamWorkspace';

// This handles updating the favicon and title text dynamically across all pages
function TabIdentityManager() {
  const location = useLocation();

  useEffect(() => {
    // 1. DYNAMIC FAVICON FIX: Target or create the shortcut icon link element
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    
    // Using a vibrant, production-ready shield icon URL
    link.href = "https://img.icons8.com/fluency/48/shield-with-crown.png";

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
    } else if (path === '/proctor') {
      document.title = "Supervisor Overwatch Console";
    } else {
      document.title = "AI Biometric Proctoring System";
    }
  }, [location]);

  return null; 
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
      </nav>

      <Routes>
        <Route path="/" element={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 73px)', backgroundColor: '#0f172a', fontFamily: 'system-ui, sans-serif', color: '#94a3b8' }}>
            <h2 style={{ textAlign: 'center', fontWeight: '600', fontSize: '20px', margin: 0 }}>Select an operation module above to begin process verification.</h2>
          </div>
        } />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/proctor" element={<ProctorDashboard />} />
        <Route path="/exam-workspace/:examId" element={<ExamWorkspace />} />
        <Route path="/dashboard" element={<StudentDashboard />} />
        <Route path="/StudentDashboard" element={<StudentDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;