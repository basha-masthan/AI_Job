'use client';
import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ReactMarkdown from 'react-markdown';

const LEVELS = [
  { id: 'beginner', label: 'Beginner', color: 'var(--accent-emerald)', desc: 'New to the field' },
  { id: 'mid', label: 'Intermediate', color: 'var(--accent-amber)', desc: 'Some experience' },
  { id: 'pro', label: 'Pro', color: 'var(--accent-rose)', desc: 'Advanced skills' },
];

function parseQuiz(markdown) {
  const quiz = [];
  const answers = [];

  const quizMatch = markdown.match(/^#{1,3}\s*Quiz\s*$/m);
  const answersMatch = markdown.match(/^#{1,3}\s*Answers?\s*$/m);
  if (!quizMatch || !answersMatch) return null;

  const quizStart = quizMatch.index + quizMatch[0].length;
  const answersStart = answersMatch.index;
  const quizSection = markdown.slice(quizStart, answersStart).trim();
  const answersSection = markdown.slice(answersStart + answersMatch[0].length).trim();

  // 1. Extract answers
  const aLines = answersSection.split('\n').filter(l => l.trim());
  for (const line of aLines) {
    const match = line.match(/(?:^|[^a-zA-Z])([a-dA-D])(?![a-zA-Z])/i) || line.match(/^[-\d\s.)]*([a-dA-D])/i);
    if (match) {
      answers.push(match[1].toLowerCase());
    }
  }

  // 2. Extract questions and options
  const lines = quizSection.split('\n');
  let currentQuestion = null;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const isQuestionStart = /^(?:[qQ]\d+\.?|\d+(?:\.\d+)*)[\s.)]/.test(line);
    const isOptionLine = /^[-*+]*\s*[a-dA-D][\s.)]/i.test(line);

    if (isQuestionStart && !isOptionLine) {
      if (currentQuestion) {
        quiz.push(currentQuestion);
      }
      const textWithoutNum = line.replace(/^(?:[qQ]\d+\.?|\d+(?:\.\d+)*)[\s.)]\s*/, '').trim();
      currentQuestion = {
        text: textWithoutNum,
        options: []
      };
    } else if (isOptionLine && currentQuestion) {
      const match = line.match(/^[-*+]*\s*([a-dA-D])[\s.)]\s*(.*)/i);
      if (match) {
        currentQuestion.options.push({
          letter: match[1].toLowerCase(),
          text: match[2].trim()
        });
      }
    } else if (currentQuestion) {
      const inlineMatches = [...line.matchAll(/([a-dA-D])[\s.)]\s*(.*?)(?=\s*[a-dA-D][\s.)]\s*|$)/gi)];
      if (inlineMatches.length >= 2 || (inlineMatches.length === 1 && currentQuestion.options.length > 0)) {
        inlineMatches.forEach(m => {
          currentQuestion.options.push({
            letter: m[1].toLowerCase(),
            text: m[2].trim()
          });
        });
      } else {
        currentQuestion.text += ' ' + line;
      }
    }
  }

  if (currentQuestion) {
    quiz.push(currentQuestion);
  }

  // Fallback: search full text for inline options if none were parsed
  quiz.forEach(q => {
    if (q.options.length === 0) {
      const inlineMatches = [...q.text.matchAll(/([a-dA-D])[\s.)]\s*(.*?)(?=\s*[a-dA-D][\s.)]\s*|$)/gi)];
      if (inlineMatches.length >= 2) {
        q.options = inlineMatches.map(m => ({
          letter: m[1].toLowerCase(),
          text: m[2].trim()
        }));
        const firstOptionIndex = q.text.search(/\s+[a-dA-D][\s.)]\s+/i);
        if (firstOptionIndex !== -1) {
          q.text = q.text.slice(0, firstOptionIndex).trim();
        } else {
          const parts = q.text.split(/\s+[a-dA-D][\s.)]/i);
          if (parts.length > 0) q.text = parts[0].trim();
        }
      }
    }
  });

  const finalQuestions = quiz
    .filter(q => q.options.length > 0)
    .map((q, i) => {
      let cleanText = q.text
        .replace(/\(Correct Answer.*?\)/gi, '')
        .replace(/Correct answer.*$/gmi, '')
        .trim();
      
      return {
        id: i + 1,
        text: cleanText,
        correct: answers[i] || 'a',
        options: q.options
      };
    });

  if (finalQuestions.length === 0) return null;

  return {
    questions: finalQuestions,
    raw: { quizSection, answersSection }
  };
}
function stripQuizFromContent(markdown) {
  if (!markdown) return '';

  const quizHeaders = [
    /^#{1,5}\s*.*quiz.*/mi,
    /^#{1,5}\s*.*answers?.*/mi,
    /^\*\*.*quiz.*\*\*/mi,
    /^\*\*.*answers?.*\*\*/mi,
    /^__.*quiz.*__/mi,
    /^__.*answers?.*__/mi,
    /^quiz\s*:?\s*$/mi,
    /^answers?\s*:?\s*$/mi
  ];

  let earliestIndex = markdown.length;

  for (const regex of quizHeaders) {
    const match = markdown.match(regex);
    if (match && match.index < earliestIndex) {
      earliestIndex = match.index;
    }
  }

  if (earliestIndex < markdown.length) {
    return markdown.slice(0, earliestIndex).trim();
  }

  return markdown;
}

function QuizModal({ quiz, onClose, onSkip }) {
  const [selections, setSelections] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState(null);

  function handleSubmit() {
    const answered = quiz.questions.filter(q => selections[q.id]);
    if (answered.length === 0) return;
    let correct = 0;
    const details = quiz.questions.map(q => {
      const isCorrect = selections[q.id] === q.correct;
      if (isCorrect) correct++;
      return { ...q, selected: selections[q.id], isCorrect };
    });
    setResults({ score: Math.round((correct / quiz.questions.length) * 100), correct, total: quiz.questions.length, details });
    setSubmitted(true);
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !submitted) onClose(); }}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ 
        maxHeight: '90vh', 
        background: 'rgba(17, 24, 39, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--border-hover)',
        boxShadow: '0 0 50px rgba(99,102,241,0.25)',
        padding: '36px',
        borderRadius: '24px'
      }}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '24px' }}>
          <h3 className="modal-title" style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>📝</span> Quiz: Test Your Understanding
          </h3>
          {!submitted && (
            <button className="modal-close" onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>✕</button>
          )}
        </div>

        {!submitted ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', maxHeight: 'calc(90vh - 160px)', paddingRight: '6px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
              Answer the questions below to test what you've learned. This is optional — you can skip and continue.
            </p>
            {quiz.questions.map((q, i) => (
              <div key={q.id} style={{
                padding: '24px', borderRadius: '16px', background: 'rgba(13, 19, 33, 0.5)',
                border: '1px solid var(--border)',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
              }}>
                <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', lineHeight: 1.5, color: '#fff', fontFamily: 'Inter, sans-serif' }}>
                  <span style={{ color: 'var(--accent-primary)', marginRight: '8px' }}>{i + 1}.</span>
                  {q.text}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {q.options.map(opt => {
                    const isSelected = selections[q.id] === opt.letter;
                    return (
                      <label key={opt.letter} style={{
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px',
                        borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s',
                        background: isSelected ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                        boxShadow: isSelected ? '0 0 15px rgba(99,102,241,0.15)' : 'none',
                      }}
                      onMouseEnter={e => { if(!isSelected) e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                      onMouseLeave={e => { if(!isSelected) e.currentTarget.style.borderColor = 'var(--border)'; }}
                      >
                        <input type="radio" name={`q-${q.id}`} value={opt.letter}
                          checked={isSelected}
                          onChange={() => setSelections(prev => ({ ...prev, [q.id]: opt.letter }))}
                          style={{ 
                            accentColor: 'var(--accent-primary)',
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer'
                          }}
                        />
                        <span style={{ fontSize: '14px', color: isSelected ? '#fff' : 'var(--text-secondary)', fontWeight: isSelected ? 600 : 400 }}>
                          <strong style={{ marginRight: '6px', color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)' }}>{opt.letter.toUpperCase()}</strong> {opt.text}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: '12px', paddingBottom: '12px' }}>
              <button className="btn btn-ghost" onClick={onSkip} style={{ padding: '12px 24px', borderRadius: '12px' }}>Skip Quiz</button>
              <button className="btn btn-primary" onClick={handleSubmit}
                disabled={Object.keys(selections).length === 0}
                style={{ padding: '12px 28px', borderRadius: '12px', boxShadow: 'var(--shadow-glow)' }}
              >
                Submit Answers 🚀
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', maxHeight: 'calc(90vh - 160px)', paddingRight: '6px' }}>
            <div style={{
              textAlign: 'center', padding: '32px', borderRadius: '20px',
              background: results.score >= 70 ? 'rgba(16,185,129,0.08)' : results.score >= 40 ? 'rgba(245,158,11,0.08)' : 'rgba(244,63,94,0.08)',
              border: `1px solid ${results.score >= 70 ? 'var(--accent-emerald)' : results.score >= 40 ? 'var(--accent-amber)' : 'var(--accent-rose)'}`,
              boxShadow: results.score >= 70 ? '0 0 25px rgba(16,185,129,0.15)' : 'none'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>{results.score >= 70 ? '🏆' : results.score >= 40 ? '⚡' : '📚'}</div>
              <div style={{ fontSize: '36px', fontWeight: 800, color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>{results.score}%</div>
              <div style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500 }}>
                {results.correct} of {results.total} correct answers
              </div>
            </div>
            
            <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>Review Performance Details</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {results.details.map((q, i) => (
                <div key={q.id} style={{
                  padding: '20px', borderRadius: '14px',
                  background: q.isCorrect ? 'rgba(16,185,129,0.04)' : 'rgba(244,63,94,0.04)',
                  border: `1px solid ${q.isCorrect ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <span style={{ fontSize: '18px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>{q.isCorrect ? '✅' : '❌'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', marginBottom: '10px', lineHeight: 1.5 }}>
                        {q.text}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px' }}>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          Your selection: <strong style={{ color: q.isCorrect ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}>{(q.selected || '').toUpperCase()}</strong>
                        </div>
                        {!q.isCorrect && (
                          <div style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
                            Correct: {q.correct.toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="btn btn-primary" onClick={onClose} style={{ alignSelf: 'center', marginTop: '12px', padding: '12px 32px', borderRadius: '12px' }}>
              Continue Learning 🚀
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TrainingPortalContent() {
  const searchParams = useSearchParams();
  const pathId = searchParams.get('pathId');

  const [roleInput, setRoleInput] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('beginner');
  
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const [roadmap, setRoadmap] = useState(null);
  const [error, setError] = useState('');
  
  const [activeModule, setActiveModule] = useState(null);
  const [moduleContent, setModuleContent] = useState({});
  const [loadingModule, setLoadingModule] = useState(false);

  const [showQuiz, setShowQuiz] = useState(false);

  const [prefillJd, setPrefillJd] = useState('');
  const [prefillTitle, setPrefillTitle] = useState('');
  const [prefillCompany, setPrefillCompany] = useState('');

  useEffect(() => {
    const jd = localStorage.getItem('jh_prefill_jd');
    const title = localStorage.getItem('jh_prefill_title');
    const company = localStorage.getItem('jh_prefill_company');
    if (jd) {
      setPrefillJd(jd);
      setPrefillTitle(title || '');
      setPrefillCompany(company || '');
      setRoleInput(title || '');
    }
  }, []);

  const handleClearPrefill = () => {
    localStorage.removeItem('jh_prefill_jd');
    localStorage.removeItem('jh_prefill_title');
    localStorage.removeItem('jh_prefill_company');
    setPrefillJd('');
    setPrefillTitle('');
    setPrefillCompany('');
    setRoleInput('');
  };


  useEffect(() => {
    if (pathId) {
      setLoadingRoadmap(true);
      fetch(`/api/training/paths/${pathId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setRoadmap(data.path);
            setRoleInput(data.path.role);
            setSelectedLevel(data.path.level);
            setModuleContent(data.path.moduleContent || {});
            
            if (data.path.chapters?.[0]?.modules?.[0]) {
              setActiveModule(data.path.chapters[0].modules[0].id);
            }
          }
        })
        .catch(err => console.error('Failed to load path', err))
        .finally(() => setLoadingRoadmap(false));
    }
  }, [pathId]);

  async function handleGenerateRoadmap() {
    if (!roleInput.trim()) {
      setError('Please enter a target job role.');
      return;
    }
    setError('');
    setLoadingRoadmap(true);
    setRoadmap(null);
    setModuleContent({});
    setActiveModule(null);

    try {
      const res = await fetch('/api/training/generate-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: roleInput,
          level: selectedLevel,
          jobDescription: prefillJd || undefined
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate roadmap');

      
      const newPath = {
        role: roleInput,
        level: selectedLevel,
        title: data.title,
        description: data.description,
        chapters: data.chapters,
        moduleContent: {}
      };
      
      const saveRes = await fetch('/api/training/paths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPath),
      });
      const saveData = await saveRes.json();
      
      if (saveData.success) {
        setRoadmap(saveData.path);
        if (saveData.path.chapters?.[0]?.modules?.[0]) {
          handleLoadModule(saveData.path.chapters[0].modules[0], saveData.path);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingRoadmap(false);
    }
  }

  async function handleLoadModule(mod, currentRoadmap = roadmap) {
    setActiveModule(mod.id);
    if (moduleContent[mod.id]) return;

    setLoadingModule(true);
    try {
      const res = await fetch('/api/training/generate-chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          role: roleInput, 
          level: selectedLevel,
          moduleTitle: mod.title,
          moduleDescription: mod.description
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate module content');
      
      const updatedContent = { ...moduleContent, [mod.id]: data.content };
      setModuleContent(updatedContent);

      if (currentRoadmap && currentRoadmap.id) {
        await fetch(`/api/training/paths/${currentRoadmap.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleContent: updatedContent }),
        });
      }

    } catch (err) {
      console.error(err);
      setModuleContent(prev => ({
        ...prev,
        [mod.id]: 'Failed to load content. Please try again.'
      }));
    } finally {
      setLoadingModule(false);
    }
  }

  const activeContent = activeModule ? moduleContent[activeModule] : null;

  const quizData = useMemo(() => {
    if (!activeContent) return null;
    return parseQuiz(activeContent);
  }, [activeContent]);

  const cleanContent = useMemo(() => {
    if (!activeContent) return '';
    return stripQuizFromContent(activeContent);
  }, [activeContent]);

  return (
    <main className="main-content" style={{ position: 'relative' }}>
      <div className="hero-glow" />

      <div className="page-header">
        <h1 className="page-title">🎓 Training Portal</h1>
        <p className="page-subtitle">Master your target role with comprehensive end-to-end learning modules and quizzes</p>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 24 }}>{error}</div>}

      {!roadmap && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 800, margin: '0 auto' }}>
          {prefillJd && (
            <div className="card-glass" style={{
              padding: '20px 24px',
              borderRadius: 18,
              border: '1px solid rgba(99,102,241,0.2)',
              background: 'rgba(99,102,241,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>✨</span>
                  <strong style={{ fontSize: 15, fontFamily: 'Space Grotesk' }}>Tailored Job Prep Active</strong>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.2)', color: 'var(--accent-primary)', border: '1px solid rgba(99,102,241,0.4)' }}>JD Custom</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Training course will be customized for <strong>{prefillTitle}</strong> at <strong>{prefillCompany || 'this company'}</strong>.
                </div>
              </div>
              <button
                onClick={handleClearPrefill}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: 18, padding: 4
                }}
                title="Clear job description prefill"
              >
                ✕
              </button>
            </div>
          )}

          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>

              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎯</div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>1. Type Your Target Role</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>What job do you want to train for?</p>
              </div>
            </div>
            <input 
              type="text" 
              value={roleInput} 
              onChange={(e) => setRoleInput(e.target.value)}
              placeholder="e.g. Senior React Developer, Data Scientist..."
              className="form-input"
              style={{ fontSize: 16, padding: '14px 18px', background: 'rgba(0,0,0,0.2)' }}
            />
          </div>

          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📈</div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>2. Select Your Level</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>How much do you already know?</p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {LEVELS.map(lv => (
                <button key={lv.id} onClick={() => setSelectedLevel(lv.id)}
                  style={{
                    padding: 18, borderRadius: 14, cursor: 'pointer', textAlign: 'center',
                    background: selectedLevel === lv.id ? `${lv.color}20` : 'var(--bg-card)',
                    border: selectedLevel === lv.id ? `2px solid ${lv.color}` : '1px solid var(--border)',
                    transition: 'all 0.2s', color: 'var(--text-primary)',
                  }}
                  onMouseEnter={e => { if (selectedLevel !== lv.id) e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
                  onMouseLeave={e => { if (selectedLevel !== lv.id) e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{lv.id === 'beginner' ? '🌱' : lv.id === 'mid' ? '🔥' : '🏆'}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{lv.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{lv.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={handleGenerateRoadmap} 
            disabled={loadingRoadmap || !roleInput.trim()} 
            className="btn btn-primary btn-lg btn-full"
            style={{ padding: '16px', fontSize: 18, borderRadius: 14, boxShadow: 'var(--shadow-glow)' }}
          >
            {loadingRoadmap ? (
              <><div className="spinner" style={{ marginRight: 10 }} /> Crafting your customized learning path...</>
            ) : (
              '🚀 Generate Comprehensive Learning Path'
            )}
          </button>
        </div>
      )}

      {roadmap && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: 'calc(100vh - 140px)' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}>{roadmap.title}</h2>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{roadmap.description}</p>
            </div>
            <button 
              onClick={() => {
                window.history.pushState({}, '', '/training');
                setRoadmap(null);
                setRoleInput('');
                setActiveModule(null);
              }} 
              className="btn btn-secondary"
            >
              🔄 Change Role/Level
            </button>
          </div>

          <div style={{ display: 'flex', gap: 24, flex: 1, overflow: 'hidden' }}>
            
            <div className="card" style={{ width: 340, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {roadmap.chapters?.map((chap, cIdx) => (
                <div key={chap.id || cIdx}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, paddingLeft: 8 }}>
                    {chap.title}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {chap.modules?.map((mod, mIdx) => {
                      const isActive = activeModule === mod.id;
                      const isLoaded = !!moduleContent[mod.id];
                      return (
                        <div 
                          key={mod.id} 
                          onClick={() => handleLoadModule(mod)}
                          style={{
                            padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                            background: isActive ? 'rgba(99,102,241,0.15)' : 'var(--bg-secondary)',
                            border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border)',
                            transition: 'all 0.2s',
                            position: 'relative',
                            overflow: 'hidden',
                            marginLeft: 8
                          }}
                        >
                          {isActive && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: 'var(--accent-primary)' }} />}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>Module {mIdx + 1}</span>
                            {isLoaded && <span style={{ fontSize: 11, color: 'var(--accent-emerald)', fontWeight: 600 }}>✓ Cached</span>}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', marginBottom: 4 }}>{mod.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {mod.description}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="card" style={{ flex: 1, padding: '40px 48px', overflowY: 'auto', background: 'var(--bg-glass)', position: 'relative' }}>
              {loadingModule ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
                  <div className="spinner spinner-lg" />
                  <div style={{ color: 'var(--text-secondary)' }}>Preparing comprehensive learning module...</div>
                </div>
              ) : activeModule && cleanContent ? (

                <>
                  <div className="markdown-body" style={{ color: 'var(--text-primary)', lineHeight: 1.7, maxWidth: 900, margin: '0 auto' }}>
                    <ReactMarkdown>{cleanContent}</ReactMarkdown>
                  </div>
                  {quizData && (
                    <div style={{
                      marginTop: 32, padding: 24, borderRadius: 14, textAlign: 'center',
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(6,182,212,0.05))',
                      border: '1px solid rgba(99,102,241,0.2)',
                    }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                        Quiz Available
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                        Test your understanding of this module with {quizData.questions.length} questions.
                      </div>
                      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button className="btn btn-primary" onClick={() => setShowQuiz(true)}>
                          Take Quiz
                        </button>
                        <button className="btn btn-ghost" onClick={() => setShowQuiz(true)}>
                          Skip (Mark as Read)
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                  Select a module from the sidebar to start learning.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {showQuiz && quizData && (
        <QuizModal
          quiz={quizData}
          onClose={() => setShowQuiz(false)}
          onSkip={() => setShowQuiz(false)}
        />
      )}
    </main>
  );
}

export default function TrainingPortal() {
  return (
    <div className="app-shell">
      <Sidebar />
      <Suspense fallback={<div className="spinner" />}>
        <TrainingPortalContent />
      </Suspense>
    </div>
  );
}
