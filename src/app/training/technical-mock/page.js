'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import ScoreRing from '@/components/ScoreRing';

const TECH_STACKS = [
  'React', 'Node.js', 'Python', 'JavaScript (Core)',
  'TypeScript', 'PostgreSQL', 'MongoDB', 'Docker / Kubernetes',
  'AWS / Cloud', 'System Design', 'Data Structures & Algorithms',
  'Machine Learning', 'DevOps / CI/CD',
];

export default function TechnicalMockPage() {
  const [techStack, setTechStack] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('mid');
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState({});
  const [currentQ, setCurrentQ] = useState(0);
  const [timer, setTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [codeSubmissions, setCodeSubmissions] = useState({});
  const timerRef = useRef(null);

  const [prefillJd, setPrefillJd] = useState('');
  const [prefillTitle, setPrefillTitle] = useState('');
  const [prefillCompany, setPrefillCompany] = useState('');

  // Dashboard state
  const [history, setHistory] = useState([]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/training/history?type=technical-mock');
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
      setTechStack(title || '');
    }
    
    fetchHistory();
  }, []);

  // Refresh history dashboard whenever a session ends
  useEffect(() => {
    if (!result) {
      fetchHistory();
    }
  }, [result]);

  const handleClearPrefill = () => {
    localStorage.removeItem('jh_prefill_jd');
    localStorage.removeItem('jh_prefill_title');
    localStorage.removeItem('jh_prefill_company');
    setPrefillJd('');
    setPrefillTitle('');
    setPrefillCompany('');
  };

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!started || result || !questions.length) return;
    if (timer <= 0) {
      handleNext();
      return;
    }
    timerRef.current = setInterval(() => {
      setTimer(t => t - 1);
    }, 1000);
    return clearTimer;
  }, [started, timer, result, questions.length, currentQ]);

  function handleNext() {
    clearTimer();
    if (currentQ < questions.length - 1) {
      setCurrentQ(c => c + 1);
      setTimer(30);
    }
  }

  async function handleStart() {
    setLoading(true);
    setError('');
    setQuestions([]);
    setSelected({});
    setCodeSubmissions({});
    setCurrentQ(0);
    setResult(null);
    setTimer(30);
    try {
      const res = await fetch('/api/training/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'technical-mock',
          techStack,
          difficulty,
          jobDescription: description || prefillJd || undefined
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to generate questions');
      if (!data.questions?.length) throw new Error('No questions returned');
      setQuestions(data.questions);
      setStarted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    clearTimer();
    setEvaluating(true);
    try {
      const answers = questions.map((q, i) => selected[i] !== undefined ? selected[i] : -1);
      const res = await fetch('/api/training/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: 'technical-mock', 
          questions, 
          answers, 
          techStack, 
          difficulty,
          codeSubmissions 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Evaluation failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setEvaluating(false);
    }
  }

  function handleReset() {
    clearTimer();
    setStarted(false);
    setQuestions([]);
    setSelected({});
    setCodeSubmissions({});
    setCurrentQ(0);
    setResult(null);
    setError('');
    setTimer(30);
    setTechStack('');
    setDescription('');
  }

  function selectOption(questionIndex, optionIndex) {
    if (selected[questionIndex] !== undefined) return;
    clearTimer();
    setSelected(prev => ({ ...prev, [questionIndex]: optionIndex }));
  }

  // ── Setup Screen ──
  if (!started) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="main-content" style={{ position: 'relative' }}>
          <div className="hero-glow" />
          <div className="page-header">
            <h1 className="page-title">🧪 Technical MCQ Test</h1>
            <p className="page-subtitle">Test your technical knowledge with timed multiple-choice questions</p>
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
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>⚡</div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>Configure Test</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Choose your tech stack and difficulty</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div>
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Tech Stack / Language</label>
                <input 
                  type="text"
                  value={techStack} 
                  onChange={e => setTechStack(e.target.value)} 
                  className="form-select"
                  placeholder="e.g., React, Node.js, Python, Data Structures & Algorithms, etc."
                  style={{ padding: 12, borderRadius: 8 }}
                />
              </div>

              <div>
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Description <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 400 }}>(Optional)</span></label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  className="form-select"
                  placeholder="Describe your skill level, focus areas, or any specific topics..."
                  style={{ minHeight: 100, fontFamily: 'inherit', padding: 12, borderRadius: 8 }}
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
                    <button key={d.value} onClick={() => setDifficulty(d.value)} className="btn btn-ghost" style={{ flex: 1, background: difficulty === d.value ? 'rgba(245,158,11,0.1)' : 'transparent', border: difficulty === d.value ? '1px solid var(--accent-amber)' : '1px solid var(--border)' }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleStart} disabled={loading} className="btn btn-lg btn-full" style={{ marginTop: 8, background: loading ? 'rgba(245,158,11,0.5)' : 'var(--gradient-amber)', color: '#fff', border: 'none', fontWeight: 700 }}>
                {loading ? 'Generating Questions...' : '🚀 Start Test'}
              </button>

              {error && <div className="alert alert-error">{error}</div>}
            </div>
          </div>

          {/* 📊 Recent MCQ Tests Dashboard */}
          <div style={{ maxWidth: 640, margin: '40px auto 0' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center', gap: 10 }}>
              📊 Recent MCQ Performance
            </h2>
            {history.length === 0 ? (
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)' }}>
                No past MCQ tests found. Complete your first test above!
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
                        background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', fontSize: 20
                      }}>
                        ⚡
                      </div>
                      <div>
                        <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{item.techStack} MCQ</h4>
                        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                          <span>Level: <strong style={{ color: 'var(--accent-amber)' }}>{item.difficulty.toUpperCase()}</strong></span>
                          <span>•</span>
                          <span>{item.correctCount}/{item.totalQuestions} Correct</span>
                          <span>•</span>
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: item.score >= 70 ? 'var(--accent-emerald)' : item.score >= 50 ? 'var(--accent-amber)' : 'var(--accent-rose)' }}>
                          {item.score}%
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Score</span>
                      </div>
                      
                      <button onClick={() => setResult(item)} className="btn btn-ghost btn-sm" style={{
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
  if (result) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="main-content" style={{ position: 'relative' }}>
          <div className="hero-glow" />
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="page-title">🧪 Test Performance Evaluation</h1>
              <p className="page-subtitle">{result.techStack || techStack} · {result.difficulty?.toUpperCase() || difficulty.toUpperCase()}</p>
            </div>
            <button onClick={handleReset} className="btn btn-ghost" style={{ border: '1px solid var(--border)' }}>
              ← Return to Dashboard
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800, margin: '0 auto' }}>
            {/* Score Card */}
            <div className="card" style={{ padding: 36, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
              <ScoreRing score={result.score || 0} size={160} strokeWidth={12} label="Final Score" />
              <div style={{ fontSize: 16, color: 'var(--text-secondary)' }}>
                Correct answers: <strong style={{ color: 'var(--accent-emerald)' }}>{result.correctCount}</strong> out of <strong style={{ color: 'var(--text-primary)' }}>{result.totalQuestions}</strong>
              </div>
            </div>

            {/* Question Review */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18, fontFamily: 'Space Grotesk, sans-serif' }}>📝 Detailed Question Review</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {result.results?.map((r, i) => (
                  <div key={i} style={{
                    padding: 18, borderRadius: 14,
                    background: r.isCorrect ? 'rgba(16,185,129,0.04)' : 'rgba(244,63,94,0.04)',
                    border: `1px solid ${r.isCorrect ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', flex: 1, paddingRight: 12 }}>
                        Q{i + 1}: {r.question || questions[i]?.question}
                      </span>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{r.isCorrect ? '✅' : '❌'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Your answer: <strong style={{ color: r.isCorrect ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>
                        {r.selected !== -1 ? (r.options?.[r.selected] || questions[i]?.options?.[r.selected] || 'Not answered') : 'Not answered'}
                      </strong>
                    </div>
                    {!r.isCorrect && (
                      <div style={{ fontSize: 13, color: 'var(--accent-emerald)' }}>
                        Correct answer: <strong>{r.options?.[r.correct] || questions[i]?.options?.[r.correct]}</strong>
                      </div>
                    )}
                    <div style={{
                      fontSize: 12, color: 'var(--text-secondary)', marginTop: 10,
                      padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                      border: '1px solid var(--border)', lineHeight: 1.5,
                    }}>
                      {r.explanation}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleReset} className="btn btn-lg btn-full" style={{ background: 'var(--gradient-amber)', color: '#fff', border: 'none', fontWeight: 700 }}>
              🔄 Take Another Test
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Test In Progress ──
  const answeredCount = Object.keys(selected).length;
  const q = questions[currentQ];

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ position: 'relative' }}>
        <div className="hero-glow" />
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">🧪 {techStack} MCQ</h1>
            <p className="page-subtitle">10 questions · 30 seconds each</p>
          </div>
          <div className="tag tag-amber" style={{ padding: '6px 16px', fontSize: 13 }}>
            {answeredCount}/{questions.length} answered
          </div>
        </div>

        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Progress + Timer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${((currentQ + 1) / questions.length) * 100}%`,
                height: '100%',
                background: 'var(--gradient-amber)',
                borderRadius: 3,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{
              padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: 14,
              background: timer <= 10 ? 'rgba(244,63,94,0.15)' : 'rgba(245,158,11,0.15)',
              color: timer <= 10 ? 'var(--accent-rose)' : 'var(--accent-amber)',
              border: `1px solid ${timer <= 10 ? 'rgba(244,63,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
              animation: timer <= 10 ? 'pulse 1s ease infinite' : 'none',
            }}>
              ⏱ {timer}s
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {/* Question dots */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {questions.map((_, i) => (
              <div key={i} style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                background: selected[i] !== undefined
                  ? 'rgba(245,158,11,0.2)' 
                  : i === currentQ
                    ? 'rgba(99,102,241,0.2)'
                    : 'var(--bg-secondary)',
                color: selected[i] !== undefined
                  ? 'var(--accent-amber)'
                  : i === currentQ
                    ? 'var(--accent-primary)'
                    : 'var(--text-muted)',
                border: `2px solid ${selected[i] !== undefined
                  ? 'rgba(245,158,11,0.4)' 
                  : i === currentQ
                    ? 'rgba(99,102,241,0.4)'
                    : 'var(--border)'}`,
                cursor: 'pointer', transition: 'all 0.2s',
              }} onClick={() => { clearTimer(); setCurrentQ(i); setTimer(30); }}>
                {i + 1}
              </div>
            ))}
          </div>

          {/* Question Card */}
          {q && (
            <div className="card" style={{ padding: 28 }}>
              <div style={{ marginBottom: 20 }}>
                <span className="tag tag-amber" style={{ padding: '4px 12px' }}>
                  Question {currentQ + 1} of {questions.length}
                </span>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 24 }}>{q.question}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {q.options.map((opt, oi) => {
                  const isSelected = selected[currentQ] === oi;
                  const isDisabled = selected[currentQ] !== undefined;
                  return (
                    <button key={oi} onClick={() => selectOption(currentQ, oi)} disabled={isDisabled} style={{
                      textAlign: 'left', padding: '14px 18px', borderRadius: 12, fontSize: 14, fontWeight: 500,
                      cursor: isDisabled ? 'default' : 'pointer',
                      border: isSelected ? '2px solid var(--accent-amber)' : '2px solid var(--border)',
                      background: isSelected ? 'rgba(245,158,11,0.1)' : 'var(--bg-secondary)',
                      color: 'var(--text-primary)', transition: 'all 0.2s', width: '100%',
                      display: 'flex', alignItems: 'center', gap: 14,
                    }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                        background: isSelected ? 'rgba(245,158,11,0.2)' : 'var(--bg-card)',
                        color: isSelected ? 'var(--accent-amber)' : 'var(--text-secondary)',
                        border: `1px solid ${isSelected ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
                      }}>
                        {String.fromCharCode(65 + oi)}
                      </span>
                      {opt}
                    </button>
                  );
                })}
               </div>

               <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
                 <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                   💻 Code Solution <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>(Optional)</span>
                 </h4>
                 <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                   <button
                     onClick={() => setCodeSubmissions(prev => ({ ...prev, [currentQ]: { ...prev[currentQ], platform: 'leetcode' } }))}
                     style={{
                       padding: '6px 12px',
                       borderRadius: 6,
                       fontSize: 12,
                       fontWeight: 600,
                       border: codeSubmissions[currentQ]?.platform === 'leetcode' ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                       background: codeSubmissions[currentQ]?.platform === 'leetcode' ? 'rgba(99,102,241,0.1)' : 'transparent',
                       color: 'var(--text-primary)',
                       cursor: 'pointer',
                     }}
                   >
                     LeetCode
                   </button>
                   <button
                     onClick={() => setCodeSubmissions(prev => ({ ...prev, [currentQ]: { ...prev[currentQ], platform: 'hackerrank' } }))}
                     style={{
                       padding: '6px 12px',
                       borderRadius: 6,
                       fontSize: 12,
                       fontWeight: 600,
                       border: codeSubmissions[currentQ]?.platform === 'hackerrank' ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                       background: codeSubmissions[currentQ]?.platform === 'hackerrank' ? 'rgba(99,102,241,0.1)' : 'transparent',
                       color: 'var(--text-primary)',
                       cursor: 'pointer',
                     }}
                   >
                     HackerRank
                   </button>
                   <button
                     onClick={() => setCodeSubmissions(prev => ({ ...prev, [currentQ]: { ...prev[currentQ], platform: 'custom' } }))}
                     style={{
                       padding: '6px 12px',
                       borderRadius: 6,
                       fontSize: 12,
                       fontWeight: 600,
                       border: codeSubmissions[currentQ]?.platform === 'custom' ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                       background: codeSubmissions[currentQ]?.platform === 'custom' ? 'rgba(99,102,241,0.1)' : 'transparent',
                       color: 'var(--text-primary)',
                       cursor: 'pointer',
                     }}
                   >
                     Custom
                   </button>
                 </div>
                 {codeSubmissions[currentQ]?.platform && (
                   <textarea
                     value={codeSubmissions[currentQ]?.code || ''}
                     onChange={(e) => setCodeSubmissions(prev => ({
                       ...prev,
                       [currentQ]: { ...prev[currentQ], code: e.target.value }
                     }))}
                     placeholder="Paste your code solution here..."
                     style={{
                       width: '100%',
                       minHeight: 150,
                       padding: 12,
                       borderRadius: 8,
                       fontFamily: 'Courier New, monospace',
                       fontSize: 12,
                       border: '1px solid var(--border)',
                       background: 'var(--bg-secondary)',
                       color: 'var(--text-primary)',
                       resize: 'vertical',
                     }}
                   />
                 )}
               </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button disabled={currentQ === 0} onClick={() => { clearTimer(); setCurrentQ(c => c - 1); setTimer(30); }}
              className="btn btn-ghost"
              style={{ opacity: currentQ === 0 ? 0.4 : 1, cursor: currentQ === 0 ? 'not-allowed' : 'pointer' }}>
              ← Previous
            </button>
            {answeredCount < questions.length ? (
              <button onClick={handleNext} className="btn" style={{
                background: 'var(--gradient-amber)', color: '#fff', border: 'none', fontWeight: 600,
              }}>
                {currentQ < questions.length - 1 ? 'Skip →' : 'Skip'}
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={evaluating} className="btn" style={{
                background: evaluating ? 'rgba(16,185,129,0.5)' : 'var(--gradient-green)',
                color: '#fff', border: 'none', fontWeight: 600,
              }}>
                {evaluating ? '⏳ Scoring...' : '✅ Submit Test'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
