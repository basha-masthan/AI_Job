'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import ScoreRing from '@/components/ScoreRing';



export default function MockInterviewPage() {
  const [role, setRole] = useState('');
  const [difficulty, setDifficulty] = useState('mid');
  const [mode, setMode] = useState('text'); // 'text' or 'voice'
  const [jobDescription, setJobDescription] = useState(''); // optional job description
  
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(0);
  
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);

  const [prefillJd, setPrefillJd] = useState('');
  const [prefillTitle, setPrefillTitle] = useState('');
  const [prefillCompany, setPrefillCompany] = useState('');

  // Dashboard state
  const [history, setHistory] = useState([]);

  // Voice Mode States
  const [sessionState, setSessionState] = useState('idle'); // idle, listening, processing, speaking
  const [voiceMessages, setVoiceMessages] = useState([]);
  const [transcript, setTranscript] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthesisRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const handleUserUtteranceRef = useRef(null);
  const sessionStateRef = useRef(sessionState);
  const silenceTimeoutRef = useRef(null);
  const finalTranscriptRef = useRef('');

  // Keep callback up to date without triggering dependency re-runs
  useEffect(() => {
    handleUserUtteranceRef.current = handleUserUtterance;
  });

  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/training/history?type=mock-interview');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error('History fetch error:', e);
    }
  };

  useEffect(() => {
    const jd = localStorage.getItem('jh_prefill_jd');
    const title = localStorage.getItem('jh_prefill_title');
    const company = localStorage.getItem('jh_prefill_company');
    if (jd) {
      setPrefillJd(jd);
      setPrefillTitle(title || '');
      setPrefillCompany(company || '');
      setRole(title || '');
    }

    // Fetch initial history
    fetchHistory();

    // Initialize Voice APIs once on mount
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthesisRef.current = window.speechSynthesis;
    }
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event) => {
          let finalTranscript = '';
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            else interimTranscript += event.results[i][0].transcript;
          }
          setTranscript(interimTranscript || finalTranscript);
          
          if (finalTranscript) {
            finalTranscriptRef.current = finalTranscript;
            // Clear existing timeout
            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
            
            // Set 2 second silence timeout before confirming the answer
            silenceTimeoutRef.current = setTimeout(() => {
              if (finalTranscriptRef.current && handleUserUtteranceRef.current) {
                handleUserUtteranceRef.current(finalTranscriptRef.current);
              }
            }, 2000); // 2 seconds of silence to confirm answer
          }
        };

        recognitionRef.current.onerror = (event) => {
          console.warn('Speech recognition error:', event.error);
          if (event.error === 'no-speech') {
            if (sessionStateRef.current === 'listening') {
              try {
                recognitionRef.current.start();
              } catch (e) {}
            }
          } else {
            setError(`Speech recognition info: ${event.error}. Feel free to continue or finish.`);
          }
        };

        recognitionRef.current.onend = () => {
          if (sessionStateRef.current === 'listening') {
            try {
              recognitionRef.current.start();
            } catch (e) {}
          }
        };
      }
    }

    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (recognitionRef.current) recognitionRef.current.stop();
      if (synthesisRef.current) synthesisRef.current.cancel();
    };
  }, []);

  // Refresh history whenever a session ends
  useEffect(() => {
    if (!evaluation) {
      fetchHistory();
    }
  }, [evaluation]);

  const handleClearPrefill = () => {
    localStorage.removeItem('jh_prefill_jd');
    localStorage.removeItem('jh_prefill_title');
    localStorage.removeItem('jh_prefill_company');
    setPrefillJd('');
    setPrefillTitle('');
    setPrefillCompany('');
  };

  async function handleStart() {
    setLoading(true);
    setError('');
    setQuestions([]);
    setAnswers({});
    setCurrentQ(0);
    setEvaluation(null);
    setVoiceMessages([]);
    recordedChunksRef.current = [];

    if (mode === 'text') {
      try {
        const res = await fetch('/api/training/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'mock-interview', role, difficulty, jobDescription: jobDescription || prefillJd || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to generate questions');
        setQuestions(data.questions);
        setStarted(true);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    } else {
      // Start Voice Interview
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        
        // Start Recording
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        mediaRecorder.start(1000); // chunk every 1s
        mediaRecorderRef.current = mediaRecorder;

        setStarted(true);
        setSessionState('speaking'); // Start in speaking state as AI speaks first
        setLoading(false);

        // Kick off the interview!
        handleAIResponse(`Hello! I will be your interviewer for the ${role} position today. Are you ready to begin?`);
      } catch (err) {
        setError("Could not access camera or microphone. " + err.message);
        setLoading(false);
      }
    }
  }

  const stopMedia = () => {
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (recognitionRef.current) recognitionRef.current.stop();
    if (synthesisRef.current) synthesisRef.current.cancel();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setSessionState('idle');
  };

  const startListening = () => {
    if (recognitionRef.current) {
      try {
        setSessionState('listening');
        setTranscript('');
        finalTranscriptRef.current = '';
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        recognitionRef.current.start();
      } catch (e) { }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  const handleUserUtterance = async (text) => {
    stopListening();
    setSessionState('processing');
    const newMessages = [...voiceMessages, { role: 'user', content: text }];
    setVoiceMessages(newMessages);
    setTranscript('');

    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, role, difficulty })
      });
      const data = await res.json();
      if (res.ok) {
        setVoiceMessages([...newMessages, { role: 'assistant', content: data.reply }]);
        handleAIResponse(data.reply);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err.message);
      setSessionState('listening');
      setTimeout(() => {
        startListening();
      }, 1000);
    }
  };

  const handleAIResponse = (text) => {
    // ALWAYS stop listening when the AI starts speaking, to avoid echo/feedback loop!
    stopListening();

    if (!synthesisRef.current) {
      startListening();
      return;
    }
    setSessionState('speaking');
    synthesisRef.current.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Prevent Chrome SpeechSynthesis garbage collection bug
    window.activeUtterances = window.activeUtterances || [];
    window.activeUtterances.push(utterance);

    const voices = synthesisRef.current.getVoices();
    const goodVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Google') || v.name.includes('Samantha')));
    if (goodVoice) utterance.voice = goodVoice;

    utterance.onend = () => {
      window.activeUtterances = window.activeUtterances.filter(u => u !== utterance);
      startListening();
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e);
      window.activeUtterances = window.activeUtterances.filter(u => u !== utterance);
      startListening();
    };

    synthesisRef.current.speak(utterance);
  };

  async function handleSubmitText() {
    setEvaluating(true);
    setError('');
    try {
      const res = await fetch('/api/training/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'mock-interview', questions, answers, role, difficulty, jobDescription: jobDescription || prefillJd || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Evaluation failed');
      setEvaluation(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setEvaluating(false);
    }
  }

  async function handleSubmitVoice() {
    setEvaluating(true);
    setError('');
    stopMedia(); // stop recording
    
    // Wait a brief moment for the last chunks to flush
    setTimeout(async () => {
      try {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const formData = new FormData();
        formData.append('video', blob, 'interview.webm');
        formData.append('messages', JSON.stringify(voiceMessages));
        formData.append('role', role);
        formData.append('difficulty', difficulty);
        formData.append('jobDescription', jobDescription || prefillJd || '');

        const res = await fetch('/api/training/evaluate-voice', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Evaluation failed');
        setEvaluation(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setEvaluating(false);
      }
    }, 500);
  }

  function handleReset() {
    stopMedia();
    setStarted(false);
    setQuestions([]);
    setAnswers({});
    setCurrentQ(0);
    setEvaluation(null);
    setError('');
    setVoiceMessages([]);
    setJobDescription('');
  }

  // ── Setup Screen ──
  if (!started) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="main-content" style={{ position: 'relative' }}>
          <div className="hero-glow" />
          <div className="page-header">
            <h1 className="page-title">🎤 Mock Interview</h1>
            <p className="page-subtitle">Practice with customized interview questions tailored to your target role</p>
          </div>

          <div className="card" style={{ padding: 36, maxWidth: 640, margin: '0 auto' }}>
            {prefillJd && (
              <div className="card-glass" style={{ padding: '16px 20px', borderRadius: 14, border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.05)', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ fontSize: 14 }}>Tailored Job Prep Active</strong>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Customized for {prefillTitle}.</div>
                </div>
                <button onClick={handleClearPrefill} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎯</div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>Configure Your Interview</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Select role, difficulty, and interview mode</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div>
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Target Role</label>
                <input 
                  type="text"
                  value={role} 
                  onChange={e => setRole(e.target.value)} 
                  className="form-select"
                  placeholder="e.g., Senior React Developer, Full Stack Engineer, etc."
                  style={{ padding: 12, borderRadius: 8 }}
                />
              </div>

              <div>
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Job Description <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 400 }}>(Optional)</span></label>
                <textarea 
                  value={jobDescription} 
                  onChange={e => setJobDescription(e.target.value)} 
                  className="form-select"
                  placeholder="Paste the job description to get more tailored interview questions..."
                  style={{ minHeight: 120, fontFamily: 'inherit', padding: 12, borderRadius: 8 }}
                />
              </div>

              <div>
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Difficulty</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { value: 'easy', label: '🟢 Easy' },
                    { value: 'mid', label: '🟡 Mid' },
                    { value: 'hard', label: '🔴 Hard' },
                  ].map(d => (
                    <button key={d.value} onClick={() => setDifficulty(d.value)} className="btn btn-ghost" style={{ flex: 1, background: difficulty === d.value ? 'rgba(99,102,241,0.1)' : 'transparent', border: difficulty === d.value ? '1px solid var(--accent-primary)' : '1px solid var(--border)' }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Interview Mode</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setMode('text')} className="btn btn-ghost" style={{ flex: 1, background: mode === 'text' ? 'rgba(99,102,241,0.1)' : 'transparent', border: mode === 'text' ? '1px solid var(--accent-primary)' : '1px solid var(--border)' }}>
                    ✍️ Text-based
                  </button>
                  <button onClick={() => setMode('voice')} className="btn btn-ghost" style={{ flex: 1, background: mode === 'voice' ? 'rgba(99,102,241,0.1)' : 'transparent', border: mode === 'voice' ? '1px solid var(--accent-primary)' : '1px solid var(--border)' }}>
                    🎙️ Voice AI (Nemotron)
                  </button>
                </div>
              </div>

              <button onClick={handleStart} disabled={loading} className="btn btn-primary btn-lg btn-full" style={{ marginTop: 8 }}>
                {loading ? 'Initializing...' : '🚀 Start Interview'}
              </button>

              {error && <div className="alert alert-error">{error}</div>}
            </div>
          </div>

          {/* 📊 Recent Interviews Dashboard */}
          <div style={{ maxWidth: 640, margin: '40px auto 0' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center', gap: 10 }}>
              📊 Recent Performance Dashboard
            </h2>
            {history.length === 0 ? (
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
                No past mock interviews found. Complete your first session to see history!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {history.map((item) => (
                  <div key={item.id} className="card-glass" style={{
                    padding: '20px 24px', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: item.type === 'voice' ? 'rgba(168,85,247,0.1)' : 'rgba(59,130,246,0.1)',
                        border: item.type === 'voice' ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(59,130,246,0.3)',
                        fontSize: 20
                      }}>
                        {item.type === 'voice' ? '🎙️' : '✍️'}
                      </div>
                      <div>
                        <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{item.role}</h4>
                        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                          <span>Level: <strong style={{ color: 'var(--accent-primary)' }}>{item.difficulty.toUpperCase()}</strong></span>
                          <span>•</span>
                          <span>{item.type === 'voice' ? 'Voice AI' : 'Text'}</span>
                          <span>•</span>
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: item.overallScore >= 70 ? 'var(--accent-emerald)' : item.overallScore >= 50 ? 'var(--accent-amber)' : 'var(--accent-rose)' }}>
                          {item.overallScore}%
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Score</span>
                      </div>
                      
                      <button onClick={() => setEvaluation(item)} className="btn btn-ghost btn-sm" style={{
                        border: '1px solid var(--border)', padding: '6px 14px', borderRadius: 8, fontSize: 12
                      }}>
                        🔍 Analysis
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ── Results Screen / Historical Analysis Screen ──
  if (evaluation) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="main-content" style={{ position: 'relative' }}>
          <div className="hero-glow" />
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="page-title">🎤 Interview Evaluation Report</h1>
              <p className="page-subtitle">{evaluation.role || role} · {evaluation.difficulty?.toUpperCase() || difficulty.toUpperCase()} Mode</p>
            </div>
            <button onClick={handleReset} className="btn btn-ghost" style={{ border: '1px solid var(--border)' }}>
              ← Return to Dashboard
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800, margin: '0 auto' }}>
            
            {/* Playback of past Voice Recording */}
            {evaluation.videoUrl && (
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  📹 Session Video Recording
                </h3>
                <video src={evaluation.videoUrl} controls style={{ width: '100%', borderRadius: 12, background: '#000' }} />
              </div>
            )}

            {/* Score Ring Summary */}
            <div className="card" style={{ padding: 36, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
              <ScoreRing score={evaluation.overallScore || 0} size={160} strokeWidth={12} label="Overall Score" />
              <div style={{ display: 'flex', gap: 40, justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-primary)' }}>{evaluation.communication || 0}/10</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Communication</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-cyan)' }}>{evaluation.technicalAccuracy || 0}/10</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Technical Accuracy</div>
                </div>
              </div>
            </div>

            {/* Strengths & Improvements */}
            {evaluation.strengths?.length > 0 && (
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: 14 }}>✅ Key Strengths</h3>
                <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {evaluation.strengths.map((s, i) => <li key={i} style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s}</li>)}
                </ul>
              </div>
            )}
            {evaluation.improvements?.length > 0 && (
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-amber)', marginBottom: 14 }}>📈 Areas to Improve</h3>
                <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {evaluation.improvements.map((s, i) => <li key={i} style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s}</li>)}
                </ul>
              </div>
            )}
            
            {/* Questions Asked & Answers Log */}
            {evaluation.answers?.length > 0 && (
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>📝 Detailed Questions & Answers Breakdown</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {evaluation.answers.map((item, i) => {
                    // Check if it's text-based vs voice structure
                    const isVoiceHistory = item.role !== undefined;
                    if (isVoiceHistory) {
                      return (
                        <div key={i} style={{
                          display: 'flex', flexDirection: 'column',
                          alignItems: item.role === 'user' ? 'flex-end' : 'flex-start',
                          width: '100%'
                        }}>
                          <span style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{item.role === 'user' ? 'YOU' : 'INTERVIEWER'}</span>
                          <div style={{
                            background: item.role === 'user' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                            border: item.role === 'user' ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(255,255,255,0.08)',
                            padding: '12px 16px', borderRadius: 12, fontSize: 13, maxWidth: '85%'
                          }}>
                            {item.content}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div key={i} style={{
                          padding: 18, borderRadius: 14,
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid var(--border)',
                          borderLeft: `4px solid ${item.score >= 7 ? 'var(--accent-emerald)' : 'var(--accent-amber)'}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>Question {i + 1}</strong>
                            <span style={{ fontSize: 13, fontWeight: 700, color: item.score >= 7 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>{item.score || 0}/10</span>
                          </div>
                          <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 10 }}>{item.question}</p>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, fontSize: 13, border: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Your Answer:</span>
                            "{item.answer || 'No Answer Submitted'}"
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            <span style={{ fontSize: 11, color: 'var(--accent-primary)', display: 'block', fontWeight: 700, marginBottom: 4 }}>Coach Feedback:</span>
                            {item.comment}
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            )}

            <button onClick={handleReset} className="btn btn-primary btn-lg btn-full">
              🔄 Try Another Interview Session
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Voice Interview Screen ──
  if (mode === 'voice') {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="main-content" style={{ position: 'relative' }}>
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="page-title">🎙️ Live Voice Interview</h1>
              <p className="page-subtitle">{role} · {difficulty.toUpperCase()}</p>
            </div>
            <button onClick={handleSubmitVoice} disabled={evaluating} className="btn btn-primary" style={{ background: evaluating ? 'rgba(16,185,129,0.5)' : 'var(--gradient-green)' }}>
              {evaluating ? 'Evaluating...' : '✅ Finish & Get Score'}
            </button>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 30 }}>
            {/* Left: Video */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ 
                background: '#000', borderRadius: 20, overflow: 'hidden', aspectRatio: '16/9',
                border: sessionState === 'listening' ? '2px solid #10b981' : sessionState === 'speaking' ? '2px solid #a855f7' : '2px solid rgba(255,255,255,0.1)',
                boxShadow: sessionState === 'listening' ? '0 0 30px rgba(16,185,129,0.2)' : sessionState === 'speaking' ? '0 0 30px rgba(168,85,247,0.2)' : 'none',
                transition: 'all 0.3s', position: 'relative'
              }}>
                <video ref={el => { if (el && streamRef.current && el.srcObject !== streamRef.current) el.srcObject = streamRef.current; }} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                
                <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', padding: '6px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: sessionState === 'listening' ? '#10b981' : sessionState === 'speaking' ? '#a855f7' : '#f59e0b' }} />
                  {sessionState === 'listening' && 'Listening...'}
                  {sessionState === 'processing' && 'Thinking...'}
                  {sessionState === 'speaking' && 'AI Speaking...'}
                  {sessionState === 'idle' && 'Paused'}
                </div>
              </div>

              {transcript && (
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, fontStyle: 'italic', color: '#cbd5e1' }}>
                  "{transcript}"
                </div>
              )}
            </div>

            {/* Right: Transcript */}
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', height: 500 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 12 }}>Transcript</h3>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 8 }}>
                {voiceMessages.map((msg, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <span style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>{msg.role === 'user' ? 'You' : 'AI'}</span>
                    <div style={{ background: msg.role === 'user' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)', border: msg.role === 'user' ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.1)', padding: '10px 14px', borderRadius: 12, fontSize: 14, maxWidth: '90%' }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Text Interview Screen ──
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ position: 'relative' }}>
        <div className="hero-glow" />
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">🎤 Text Mock Interview</h1>
            <p className="page-subtitle">{role} · {difficulty}</p>
          </div>
          <div className="tag tag-primary">Question {currentQ + 1} of {questions.length}</div>
        </div>

        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {error && <div className="alert alert-error">{error}</div>}
          {questions.map((q, i) => (
            <div key={q.id} style={{ display: i === currentQ ? 'flex' : 'none', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 28 }}>
                <h3 style={{ fontSize: 18, marginBottom: 20 }}>{q.question}</h3>
                <textarea
                  value={answers[i] || ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                  placeholder="Type your answer here..."
                  rows={6}
                  className="form-textarea"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button disabled={currentQ === 0} onClick={() => setCurrentQ(i - 1)} className="btn btn-ghost">← Previous</button>
                {i < questions.length - 1 ? (
                  <button onClick={() => setCurrentQ(i + 1)} className="btn btn-primary">Next →</button>
                ) : (
                  <button onClick={handleSubmitText} disabled={evaluating} className="btn btn-primary">
                    {evaluating ? 'Evaluating...' : '✅ Submit & Get Score'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
