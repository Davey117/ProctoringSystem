import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL;

const LecturerDashboard = () => {
  const navigate = useNavigate();
  const storedToken = sessionStorage.getItem('lecturer_token') || '';

  const [isAuthenticated, setIsAuthenticated] = useState(!!storedToken);
  const [token, setToken] = useState(storedToken);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [message, setMessage] = useState('');

  const [examForm, setExamForm] = useState({
    examCode: '',
    title: '',
    description: ''
  });

  const [questionForm, setQuestionForm] = useState({
    examCode: '',
    title: '',
    questionText: '',
    optionsText: 'Option A\nOption B\nOption C\nOption D',
    correctAnswer: '',
    marks: 1,
    sortOrder: 1
  });

  const [busy, setBusy] = useState(false);

  const headersText = useMemo(() => {
    if (!isAuthenticated) return 'Lecturer Access';
    return 'Lecturer Control Center';
  }, [isAuthenticated]);

  const handleLoginChange = (field, value) => {
    setLoginForm(prev => ({ ...prev, [field]: value }));
  };

  const handleExamChange = (field, value) => {
    setExamForm(prev => ({ ...prev, [field]: value }));
  };

  const handleQuestionChange = (field, value) => {
    setQuestionForm(prev => ({ ...prev, [field]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    setLoginError('');
    setMessage('');

    try {
      const payload = new FormData();
      payload.append('email', loginForm.email);
      payload.append('password', loginForm.password);

      const response = await fetch(`${API_URL}/api/lecturer/login`, {
        method: 'POST',
        body: payload
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Lecturer login failed.');
      }

      sessionStorage.setItem('lecturer_token', data.token);
      setToken(data.token);
      setIsAuthenticated(true);
      setMessage(`Welcome ${data.lecturer?.full_name || 'Lecturer'}.`);
    } catch (error) {
      setLoginError(error.message || 'Lecturer login failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateOrUpdateExam = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const payload = new FormData();
      payload.append('token', token);
      payload.append('exam_code', examForm.examCode);
      payload.append('title', examForm.title);
      payload.append('description', examForm.description);

      const response = await fetch(`${API_URL}/api/lecturer/exams`, {
        method: 'POST',
        body: payload
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to save exam.');
      }

      setMessage(`Exam ${data.exam?.exam_code || examForm.examCode} saved.`);
    } catch (error) {
      setMessage(error.message || 'Failed to save exam.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const options = questionForm.optionsText
        .split('\n')
        .map(option => option.trim())
        .filter(Boolean);

      const payload = new FormData();
      payload.append('token', token);
      payload.append('title', questionForm.title);
      payload.append('question_text', questionForm.questionText);
      payload.append('options', JSON.stringify(options));
      payload.append('correct_answer', questionForm.correctAnswer);
      payload.append('marks', String(questionForm.marks));
      payload.append('exam_code', questionForm.examCode);
      payload.append('sort_order', String(questionForm.sortOrder));
      payload.append('points', String(questionForm.marks));

      const response = await fetch(`${API_URL}/api/lecturer/questions`, {
        method: 'POST',
        body: payload
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to save question.');
      }

      setMessage(`Question saved${data.mapping ? ' and attached to exam.' : '.'}`);
      setQuestionForm(prev => ({
        ...prev,
        title: '',
        questionText: '',
        correctAnswer: ''
      }));
    } catch (error) {
      setMessage(error.message || 'Failed to save question.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('lecturer_token');
    setToken('');
    setIsAuthenticated(false);
    setLoginForm({ email: '', password: '' });
    setMessage('');
    setLoginError('');
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}>
        <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: '460px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '40px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
          <h2 style={{ margin: '0 0 10px 0', textAlign: 'center', fontSize: '24px', fontWeight: '800' }}>{headersText}</h2>
          <p style={{ margin: '0 0 25px 0', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Sign in to create exams and questions.</p>

          {loginError && (
            <div style={{ marginBottom: '18px', padding: '12px 14px', backgroundColor: '#ef444415', border: '1px solid #ef444440', borderRadius: '8px', color: '#f87171', fontSize: '13px' }}>
              {loginError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px', fontWeight: '600' }}>Email</label>
              <input
                value={loginForm.email}
                onChange={(e) => handleLoginChange('email', e.target.value)}
                type="email"
                required
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px', fontWeight: '600' }}>Password</label>
              <input
                value={loginForm.password}
                onChange={(e) => handleLoginChange('password', e.target.value)}
                type="password"
                required
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white', boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              style={{ marginTop: '10px', padding: '13px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontWeight: '700', cursor: 'pointer' }}
            >
              {busy ? 'Signing In...' : 'Lecturer Login'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: 'white', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '28px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800' }}>Lecturer Control Center</h1>
          <p style={{ margin: '6px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>Create exams and push questions into the live exam workspace.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/')} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#cbd5e1', fontWeight: '700', cursor: 'pointer' }}>
            Home
          </button>
          <button onClick={handleLogout} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #ef444440', backgroundColor: '#ef444415', color: '#f87171', fontWeight: '700', cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>

      {message && (
        <div style={{ marginBottom: '20px', padding: '14px 16px', borderRadius: '10px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#cbd5e1' }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <form onSubmit={handleCreateOrUpdateExam} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ marginTop: 0, fontSize: '18px', fontWeight: '800' }}>Create / Update Exam</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px', fontWeight: '600' }}>Exam Code</label>
              <input value={examForm.examCode} onChange={(e) => handleExamChange('examCode', e.target.value)} required style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px', fontWeight: '600' }}>Title</label>
              <input value={examForm.title} onChange={(e) => handleExamChange('title', e.target.value)} required style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px', fontWeight: '600' }}>Description</label>
              <textarea value={examForm.description} onChange={(e) => handleExamChange('description', e.target.value)} rows={4} style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <button type="submit" disabled={busy} style={{ marginTop: '6px', padding: '13px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
              Save Exam
            </button>
          </div>
        </form>

        <form onSubmit={handleCreateQuestion} style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ marginTop: 0, fontSize: '18px', fontWeight: '800' }}>Create Question</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px', fontWeight: '600' }}>Attach to Exam Code</label>
              <input value={questionForm.examCode} onChange={(e) => handleQuestionChange('examCode', e.target.value)} placeholder="Leave blank to save only in bank" style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px', fontWeight: '600' }}>Question Title</label>
              <input value={questionForm.title} onChange={(e) => handleQuestionChange('title', e.target.value)} required style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px', fontWeight: '600' }}>Question Text</label>
              <textarea value={questionForm.questionText} onChange={(e) => handleQuestionChange('questionText', e.target.value)} rows={5} required style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px', fontWeight: '600' }}>Options (one per line)</label>
              <textarea value={questionForm.optionsText} onChange={(e) => handleQuestionChange('optionsText', e.target.value)} rows={5} style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px', fontWeight: '600' }}>Correct Answer</label>
                <input value={questionForm.correctAnswer} onChange={(e) => handleQuestionChange('correctAnswer', e.target.value)} style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px', fontWeight: '600' }}>Marks</label>
                <input type="number" min="1" value={questionForm.marks} onChange={(e) => handleQuestionChange('marks', Number(e.target.value))} style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1', fontSize: '13px', fontWeight: '600' }}>Sort Order</label>
              <input type="number" min="1" value={questionForm.sortOrder} onChange={(e) => handleQuestionChange('sortOrder', Number(e.target.value))} style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: 'white', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={busy} style={{ marginTop: '6px', padding: '13px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
              Save Question
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LecturerDashboard;
