import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

const ProctorDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem("proctor_token"));
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ activeStudents: 0, totalViolations: 0, criticalThreats: 0 });
  const [liveFeeds, setLiveFeeds] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [recordLookup, setRecordLookup] = useState("");
  const [recordLookupLoading, setRecordLookupLoading] = useState(false);
  const [recordLookupError, setRecordLookupError] = useState("");
  const [recordLookupResult, setRecordLookupResult] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  const clearDashboardState = () => {
    setStats({ activeStudents: 0, totalViolations: 0, criticalThreats: 0 });
    setLiveFeeds([]);
    setAuditLogs([]);
    setRecordLookup("");
    setRecordLookupLoading(false);
    setRecordLookupError("");
    setRecordLookupResult(null);
    setWsConnected(false);
  };

  // --- NEW: DYNAMIC TAB TITLE & FAVICON IDENTITY INJECTION ---
  useEffect(() => {
    // Update the browser tab title text instantly
    document.title = "Supervisor Overwatch Console | AI Proctoring";

    // Dynamically update the favicon icon to a secure shield symbol
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
      link.type = 'image/svg+xml';
      link.href = "/proctor-favicon.svg?v=1";

    // Restore standard defaults when the component unmounts
    return () => {
      document.title = "AI Proctoring System";
    };
  }, []);

  // --- Handshake Connection Loop ---
  useEffect(() => {
    if (!isAuthenticated) return;

    const baseWsUrl = API_URL.replace(/^http/, "ws");
    const storedToken = sessionStorage.getItem("proctor_token");
    
    // Securely pass the authorization token via query string parameters
    const wsSocketPath = `${baseWsUrl}/ws/proctor?token=${storedToken}`;
    
    console.log(`📡 Connecting overwatch pipeline to channel: ${wsSocketPath}`);
    const socket = new WebSocket(wsSocketPath);

    socket.onopen = () => {
      console.log("✅ Secure Duplex Telemetry Link Established.");
      setWsConnected(true);
      setLoading(false);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        if (payload.type === "TELEMETRY_UPDATE") {
          const feeds = payload.active_feeds || [];
          setLiveFeeds(feeds);
          
          if (payload.new_log) {
            setAuditLogs(prev => [payload.new_log, ...prev]);
          }

          const accumulatedViolations = feeds.reduce(
            (acc, curr) => acc
              + (curr.tabs || 0)
              + (curr.phones || 0)
              + (curr.materials || 0)
              + (curr.multiple_faces || 0)
              + (curr.identity_swap_alerts || 0),
            0
          );
          const totalCriticals = feeds.filter(f => f.status === "CRITICAL").length;

          setStats({
            activeStudents: feeds.length,
            totalViolations: accumulatedViolations,
            criticalThreats: totalCriticals
          });
        }
        else if (payload.type === "TELEMETRY_RESET") {
          clearDashboardState();
        }
        else if (payload.type === "INCIDENT_VIDEO_LOG") {
          setAuditLogs(prev => [payload.log, ...prev]);
        }
      } catch (err) {
        console.error("Failed to parse telemetry socket matrix:", err);
      }
    };

    socket.onerror = (error) => {
      console.error("🚨 WebSocket Telemetry Pipeline Interrupted:", error);
    };

    socket.onclose = () => {
      setWsConnected(false);
    };

    return () => socket.close();
  }, [isAuthenticated]);

  // --- Login Submission Logic ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    
    const payload = new FormData();
    payload.append("username", loginUsername);
    payload.append("password", loginPassword);

    try {
      const res = await fetch(`${API_URL}/api/proctor/login`, { method: 'POST', body: payload });
      const data = await res.json();
      
      if (res.ok && data.token) {
        sessionStorage.setItem("proctor_token", data.token);
        setLoading(true);
        setIsAuthenticated(true);
      } else {
        setLoginError(data.detail || "Authentication validation failure.");
      }
    } catch {
      setLoginError("Failed to establish handshake verification with server.");
    }
  };

  const handleLogout = async () => {
    const token = sessionStorage.getItem("proctor_token");

    if (token) {
      const payload = new FormData();
      payload.append("token", token);

      try {
        await fetch(`${API_URL}/api/proctor/logout`, {
          method: 'POST',
          body: payload
        });
      } catch {
        // Even if remote logout fails, client state must be cleared immediately.
        console.error("Proctor logout reset call failed.");
      }
    }

    sessionStorage.removeItem("proctor_token");
    clearDashboardState();
    setLoading(true);
    setIsAuthenticated(false);
  };

  const handleRecordLookup = async (e) => {
    e.preventDefault();
    const matric = recordLookup.trim();
    if (!matric) {
      setRecordLookupError("Enter a matric number to search.");
      return;
    }

    setRecordLookupLoading(true);
    setRecordLookupError("");
    setRecordLookupResult(null);

    try {
      const searchParams = new URLSearchParams({ matric_number: matric });
      const res = await fetch(`${API_URL}/api/proctor/search?${searchParams.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setRecordLookupError(data.detail || "Lookup failed.");
      } else {
        setRecordLookupResult(data);
      }
    } catch {
      setRecordLookupError("Could not reach the record lookup service.");
    } finally {
      setRecordLookupLoading(false);
    }
  };

  const getStatusColor = (status) => {
    if (status === "SECURE") return "#10b981"; 
    if (status === "WARNING") return "#f59e0b"; 
    return "#ef4444"; 
  };

  const filteredFeeds = liveFeeds;

  // --- ADMINISTRATIVE LOGIN GATING GATE ---
  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', fontFamily: 'system-ui' }}>
        <form onSubmit={handleLoginSubmit} style={{ backgroundColor: '#1e293b', padding: '40px', borderRadius: '12px', width: '100%', maxWidth: '400px', border: '1px solid #334155', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)' }}>
          <h2 style={{ color: 'white', margin: '0 0 10px 0', fontSize: '24px', fontWeight: '800', textAlign: 'center' }}>SUPERVISOR ACCESS</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', marginBottom: '25px' }}>Provide authorization clearance keys to mount overwatch terminal.</p>
          
          {loginError && <div style={{ backgroundColor: '#ef444422', color: '#ef4444', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '20px', border: '1px solid #ef4444', fontWeight: '600' }}>{loginError}</div>}
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Command ID Username</label>
            <input type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Security Access Key</label>
            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required style={{ width: '100%', padding: '12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <button type="submit" style={{ width: '100%', padding: '14px', backgroundColor: '#2563eb', color: 'white', fontSize: '15px', fontWeight: '700', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.1s' }}>
            Authorize Console
          </button>
        </form>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', color: '#94a3b8', fontFamily: 'system-ui', gap: '15px' }}>
        <div style={{ display: 'inline-block', width: '40px', height: '40px', border: '4px solid #1e293b', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <h3 style={{ margin: 0, fontWeight: '600' }}>Decrypting Telemetry Stream Matrix...</h3>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui', padding: '30px' }}>
      
      {/* HEADER BAR */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '1px solid #1e293b', paddingBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px', background: 'linear-gradient(to right, #3b82f6, #10b981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              SUPERVISOR OVERWATCH COMMAND
            </h1>
            <span style={{ fontSize: '12px', fontWeight: 'bold', padding: '4px 10px', borderRadius: '12px', backgroundColor: wsConnected ? '#10b98122' : '#ef444422', color: wsConnected ? '#10b981' : '#ef4444', border: `1px solid ${wsConnected ? '#10b981' : '#ef4444'}` }}>
              {wsConnected ? "● LIVE SYNC" : "OFFLINE DISCONNECT"}
            </span>
          </div>
          <p style={{ margin: '5px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>Real-time computer vision monitoring & multi-agent telemetry pipeline.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <form onSubmit={handleRecordLookup} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="text"
              placeholder="Search matric for incident records"
              value={recordLookup}
              onChange={(e) => setRecordLookup(e.target.value)}
              style={{ padding: '12px 16px', width: '320px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none' }}
            />
            <button
              type="submit"
              disabled={recordLookupLoading}
              style={{ padding: '12px 14px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px', opacity: recordLookupLoading ? 0.7 : 1 }}
            >
              {recordLookupLoading ? 'Searching...' : 'Search'}
            </button>
          </form>
          <button
            onClick={handleLogout}
            style={{
              padding: '12px 16px',
              backgroundColor: '#ef444415',
              color: '#f87171',
              border: '1px solid #ef444440',
              borderRadius: '8px',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {(recordLookupError || recordLookupResult) && (
        <section style={{ backgroundColor: '#111827', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '30px' }}>
          {recordLookupError && (
            <div style={{ marginBottom: recordLookupResult ? '16px' : 0, color: '#fca5a5', backgroundColor: '#ef444415', border: '1px solid #ef444440', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', fontWeight: '600' }}>
              {recordLookupError}
            </div>
          )}

          {recordLookupResult && (
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px', alignItems: 'start' }}>
              <div style={{ border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#0f172a' }}>
                <img
                  src={recordLookupResult.student.profile_image_url
                    ? (recordLookupResult.student.profile_image_url.startsWith('http')
                        ? recordLookupResult.student.profile_image_url
                        : `${API_URL}${recordLookupResult.student.profile_image_url}`)
                    : 'https://via.placeholder.com/220x240?text=No+Photo'}
                  alt="Student profile"
                  style={{ width: '100%', height: '240px', objectFit: 'cover', display: 'block' }}
                />
              </div>

              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#f8fafc' }}>{recordLookupResult.student.full_name}</h3>
                <p style={{ margin: '0 0 14px 0', color: '#94a3b8', fontSize: '14px' }}>Matric: <strong style={{ color: '#3b82f6' }}>{recordLookupResult.student.matric_number}</strong></p>
                <p style={{ margin: '0 0 18px 0', color: '#cbd5e1', fontSize: '14px' }}>
                  High-alert incident videos: <strong style={{ color: recordLookupResult.incident_count > 0 ? '#f59e0b' : '#10b981' }}>{recordLookupResult.incident_count}</strong>
                </p>

                {recordLookupResult.incident_count === 0 ? (
                  <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #1f2937', color: '#94a3b8', fontSize: '14px' }}>
                    No video-backed high-alert records were found for this student.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {recordLookupResult.incident_videos.map((incident) => (
                      <div key={incident.id} style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #1f2937' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                          <strong style={{ color: '#f8fafc', fontSize: '14px' }}>{incident.violation_type}</strong>
                          <span style={{ color: '#64748b', fontSize: '12px' }}>{incident.created_at}</span>
                        </div>
                        <p style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '12px' }}>Exam: {incident.exam_code || 'N/A'}</p>
                        <video src={`${API_URL}${incident.evidence_url || incident.video_url}`} controls style={{ width: '100%', borderRadius: '8px', border: '1px solid #334155' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* METRICS STATS CARDS GRID */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '25px', marginBottom: '40px' }}>
        <div style={{ backgroundColor: '#1e293b', padding: '25px', borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Active Exam Sessions</p>
          <h2 style={{ margin: '10px 0 0 0', fontSize: '36px', fontWeight: '800', color: '#3b82f6' }}>{stats.activeStudents} <span style={{ fontSize: '16px', color: '#10b981' }}>● Live</span></h2>
        </div>
        <div style={{ backgroundColor: '#1e293b', padding: '25px', borderRadius: '12px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>Accumulated System Anomalies</p>
          <h2 style={{ margin: '10px 0 0 0', fontSize: '36px', fontWeight: '800', color: '#f59e0b' }}>{stats.totalViolations} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 'normal' }}>frames flagged</span></h2>
        </div>
        <div style={{ backgroundColor: '#1e293b', padding: '25px', borderRadius: '12px', border: '1px solid #ef4444', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', background: 'linear-gradient(135deg, #1e293b 0%, #2d1a22 100%)' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#ef4444', fontWeight: '700', textTransform: 'uppercase' }}>High Threat Responders</p>
          <h2 style={{ margin: '10px 0 0 0', fontSize: '36px', fontWeight: '800', color: '#ef4444' }}>{stats.criticalThreats} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 'normal' }}>require manual audit</span></h2>
        </div>
      </section>

      {/* CORE WORKSPACE SUB-DIVISION */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }}>
        
        {/* LIVE CANDIDATE RADAR MONITOR PANEL */}
        <main style={{ backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '25px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>Active Candidate Matrix Status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {filteredFeeds.map((student) => (
              <div key={student.matric} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: '#0f172a', borderRadius: '8px', borderLeft: `5px solid ${getStatusColor(student.status)}` }}>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  <div style={{ width: '80px', height: '60px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#000', border: '1px solid #334155' }}>
                    <img 
                      src={student.live_frame_url ? `${API_URL}${student.live_frame_url}` : "https://via.placeholder.com/80x60?text=No+Stream"} 
                      alt="Live Feed" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '16px', fontWeight: '700' }}>{student.name}</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>🆔 {student.matric} | 📝 Course: <strong style={{color: '#3b82f6'}}>{student.exam}</strong></p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '25px', textAlign: 'center', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '4px' }}>Tab Exits</span>
                    <p style={{ margin: 0, fontWeight: '800', color: student.tabs > 0 ? '#ef4444' : '#f8fafc', fontSize: '15px' }}>{student.tabs || 0}</p>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '4px' }}>Phone Logs</span>
                    <p style={{ margin: 0, fontWeight: '800', color: student.phones > 0 ? '#ef4444' : '#f8fafc', fontSize: '15px' }}>{student.phones || 0}</p>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '4px' }}>Materials</span>
                    <p style={{ margin: 0, fontWeight: '800', color: student.materials > 0 ? '#ef4444' : '#f8fafc', fontSize: '15px' }}>{student.materials || 0}</p>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '4px' }}>Examiner Switch</span>
                    <p style={{ margin: 0, fontWeight: '800', color: student.identity_swap_alerts > 0 ? '#ef4444' : '#f8fafc', fontSize: '15px' }}>{student.identity_swap_alerts || 0}</p>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', backgroundColor: `${getStatusColor(student.status)}22`, color: getStatusColor(student.status), border: `1px solid ${getStatusColor(student.status)}` }}>
                    {student.status || "SECURE"}
                  </span>
                  <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#64748b' }}>Sync: Live</p>
                </div>
              </div>
            ))}
            {filteredFeeds.length === 0 && <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No tracked sessions align with query filters.</p>}
          </div>
        </main>

        {/* SYSTEM AUDIT LEDGER */}
        <aside style={{ backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '25px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>System Audit Logs</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto', maxHeight: '520px', paddingRight: '5px' }}>
            {auditLogs.map((log, index) => (
              <div key={log.id || index} style={{ backgroundColor: '#0f172a', padding: '15px', borderRadius: '8px', border: '1px solid #334155', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px dashed #1e293b', paddingBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold', color: log.type?.includes('Clean') ? '#10b981' : (log.type?.includes('Evidence') ? '#3b82f6' : '#ef4444') }}>
                    {log.type?.includes('Clean') ? '🍏' : (log.type?.includes('Evidence') ? '🎥' : '⚠️')} {log.type}
                  </span>
                  <span style={{ color: '#64748b' }}>{log.time}</span>
                </div>
                <p style={{ margin: '0 0 5px 0', color: '#cbd5e1' }}>Matric: <strong>{log.matric}</strong> ({log.exam})</p>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px', lineHeight: '1.4' }}>{log.detail}</p>
                
                {log.video_url && (
                  <div style={{ marginTop: '12px' }}>
                    <video src={`${API_URL}${log.video_url}`} controls autoPlay style={{ width: '100%', borderRadius: '6px', border: '1px solid #3b82f6' }} />
                  </div>
                )}

                {log.image_url && (
                  <div style={{ marginTop: '12px' }}>
                    <img src={`${API_URL}${log.image_url}`} alt="Tab Switch Evidence" style={{ width: '100%', borderRadius: '6px', border: '1px solid #f59e0b' }} />
                  </div>
                )}
              </div>
            ))}
            {auditLogs.length === 0 && <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>Awaiting pipeline anomaly data packages...</p>}
          </div>
        </aside>

      </div>
    </div>
  );
};

export default ProctorDashboard;