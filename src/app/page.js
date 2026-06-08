'use client';
import { useEffect, useState, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';


const STATUS_COLORS = {
  wishlist: 'tag-purple',
  applied: 'tag-primary',
  interview: 'tag-cyan',
  offer: 'tag-green',
  rejected: 'tag-rose',
};

const QUICK_ACTIONS = [
  { href: '/job-search', icon: '🔍', label: 'Global Job Search', desc: 'Find jobs across all portals', color: 'var(--accent-primary)' },
  { href: '/training', icon: '🎓', label: 'Training Portal', desc: 'Identify & fix skill gaps', color: 'var(--accent-cyan)' },
  { href: '/resume-builder', icon: '✨', label: 'Build Tailored Resume', desc: 'Tailored from job description', color: 'var(--accent-emerald)' },
  { href: '/job-fetcher', icon: '🔗', label: 'Fetch Job Details', desc: 'Paste any job URL', color: 'var(--accent-amber)' },
];

/* ── Landing Page Data ── */
const BENTO_FEATURES = [
  { id: 'search', icon: '🔍', title: 'AI Job Discovery', desc: 'Search across LinkedIn, Indeed, Naukri & more simultaneously. AI aggregates and ranks the best matches for your profile.', size: 'lg', accent: '#6366f1' },
  { id: 'resume', icon: '📄', title: 'Smart Resume Builder', desc: 'Generate ATS-optimized resumes tailored to each job description. AI highlights your most relevant experience automatically.', size: 'lg', accent: '#06b6d4' },
  { id: 'tracker', icon: '📊', title: 'Application Tracker', desc: 'Kanban-style pipeline from wishlist to offer. Never lose track of where you stand.', size: 'sm', accent: '#8b5cf6' },
  { id: 'interview', icon: '🎯', title: 'Interview Preparation', desc: 'AI-guided prep with role-specific practice questions and study roadmaps.', size: 'sm', accent: '#10b981' },
  { id: 'cover', icon: '✉️', title: 'Cover Letter AI', desc: 'Auto-generate personalized cover letters matched to the tone of each role.', size: 'sm', accent: '#f59e0b' },
  { id: 'skills', icon: '🧠', title: 'Skills Gap Analysis', desc: 'Identify missing skills and get personalized learning paths to close the gap before your interview.', size: 'lg', accent: '#ec4899' },
];

const WORKFLOW_STEPS = [
  { num: '01', title: 'Discover', desc: 'Search jobs or paste any listing URL to import instantly.', icon: '🔍' },
  { num: '02', title: 'Analyze', desc: 'AI extracts role requirements, skills, and key hiring signals.', icon: '🧠' },
  { num: '03', title: 'Tailor', desc: 'Generate a resume and cover letter matched to the role.', icon: '✨' },
  { num: '04', title: 'Track', desc: 'Add to your pipeline and monitor every application status.', icon: '📊' },
  { num: '05', title: 'Prepare', desc: 'Study with AI-guided training for your upcoming interview.', icon: '🎯' },
  { num: '06', title: 'Succeed', desc: 'Land the job with data-driven confidence and preparation.', icon: '🚀' },
];

const PERSONAS = [
  { title: 'Students & Freshers', desc: 'Build your first professional resume, discover entry-level roles, and prepare for interviews with guided AI assistance.', highlights: ['First resume guidance', 'Entry-level job discovery', 'Interview prep coaching'], icon: '🎓', accent: '#6366f1' },
  { title: 'Working Professionals', desc: 'Manage high-volume applications, create role-specific resume variants, and track your entire job switch pipeline.', highlights: ['Multiple resume variants', 'Pipeline management', 'Skills gap identification'], icon: '💼', accent: '#06b6d4' },
  { title: 'Career Switchers', desc: 'Translate your existing skills to new domains, identify transferable experience, and build bridge resumes.', highlights: ['Skill translation AI', 'Domain switching support', 'Transferable skill mapping'], icon: '🚀', accent: '#8b5cf6' },
];

const FAQ_ITEMS = [
  { q: 'What makes this different from other job platforms?', a: 'Unlike job boards, we don\'t just list jobs — we provide an end-to-end AI workflow. From discovering roles to generating tailored resumes, tracking applications, and preparing for interviews, everything happens in one intelligent workspace.' },
  { q: 'Can I use this for both local and global jobs?', a: 'Absolutely. Search directly in the app across multiple portals and also import any job listing URL from LinkedIn, Indeed, Naukri, or any other platform.' },
  { q: 'Do I need to create a resume from scratch every time?', a: 'No. Your resume vault stores all versions. When you find a new role, AI generates a tailored variant from your master profile in seconds.' },
  { q: 'How does the AI resume matching work?', a: 'Our AI analyzes the job description, extracts key requirements and signals, then scores your resume against them. It suggests specific improvements to increase your ATS pass rate.' },
  { q: 'Is this useful only for technical roles?', a: 'Not at all. The platform is role-agnostic — marketing, finance, design, operations, and more. If a job has a description, our AI can work with it.' },
  { q: 'How does interview preparation work?', a: 'Based on the role, AI generates study roadmaps, practice questions, and mock scenarios. It identifies skill gaps and creates targeted learning paths.' },
];

const HERO_STATS = [
  { value: 10000, suffix: '+', label: 'Jobs Analyzed' },
  { value: 5000, suffix: '+', label: 'Resumes Built' },
  { value: 98, suffix: '%', label: 'ATS Match Rate' },
  { value: 24, suffix: '/7', label: 'AI Available' },
];

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [stats, setStats] = useState({ resumes: 0, jobs: 0, applied: 0, interviews: 0 });
  const [recentJobs, setRecentJobs] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState(null);
  const [animVals, setAnimVals] = useState(HERO_STATS.map(() => 0));
  const statsStarted = useRef(false);

  // AI Brain Testing State
  const [brainQuestion, setBrainQuestion] = useState('');
  const [brainLoading, setBrainLoading] = useState(false);
  const [brainResults, setBrainResults] = useState(null);
  const [brainConsensus, setBrainConsensus] = useState('');

  // SMTP Onboarding Banner State
  const [smtpBanner, setSmtpBanner] = useState({ visible: false, dismissible: true });

  // Authenticated Dashboard Chat State
  const [chatSessions, setChatSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [dashboardQuestion, setDashboardQuestion] = useState('');
  const [dashboardChatLoading, setDashboardChatLoading] = useState(false);

  async function handleTestBrain(e) {
    e.preventDefault();
    if (!brainQuestion.trim()) return;
    setBrainLoading(true);
    setBrainResults(null);
    setBrainConsensus('');
    try {
      const res = await fetch('/api/ai/consensus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: brainQuestion }),
      });
      const data = await res.json();
      if (res.ok) {
        setBrainResults(data.turn.results);
        setBrainConsensus(data.turn.consensus);
        if (isAuthenticated) {
          fetch('/api/ai/consensus')
            .then(res => res.json())
            .then(d => { if (d.success) setChatSessions(d.chats || []); });
        }
      } else {
        setBrainConsensus('Error: ' + data.error);
      }
    } catch (err) {
      setBrainConsensus('Failed to fetch AI consensus.');
    } finally {
      setBrainLoading(false);
    }
  }

  // Load chat sessions for authenticated user
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/ai/consensus')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setChatSessions(data.chats || []);
          if (data.chats?.length > 0) {
            setActiveSessionId(data.chats[0].id);
          }
        }
      });
    fetch('/api/auth/smtp')
      .then(r => r.json())
      .then(data => {
        if (data.success && !data.smtpConfigured) {
          setSmtpBanner({ visible: true, dismissible: true });
        }
      });
  }, [isAuthenticated]);

  async function handleDashboardChatSubmit(e) {
    e.preventDefault();
    if (!dashboardQuestion.trim()) return;
    setDashboardChatLoading(true);
    const questionText = dashboardQuestion;
    setDashboardQuestion('');

    const tempTurnId = Date.now().toString();
    const tempTurn = {
      id: tempTurnId,
      question: questionText,
      results: [],
      consensus: 'Aggregating consensus from AI models...',
      createdAt: new Date().toISOString(),
      isTemporary: true
    };

    let targetSessionId = activeSessionId;
    let updatedSessions = [...chatSessions];
    let activeSession = updatedSessions.find(s => s.id === targetSessionId);

    if (!activeSession) {
      activeSession = {
        id: 'temp-session',
        title: questionText.length > 30 ? questionText.substring(0, 27) + '...' : questionText,
        messages: [tempTurn],
        createdAt: new Date().toISOString()
      };
      updatedSessions.unshift(activeSession);
      setChatSessions(updatedSessions);
      setActiveSessionId('temp-session');
    } else {
      activeSession.messages.push(tempTurn);
      setChatSessions(updatedSessions);
    }

    try {
      const res = await fetch('/api/ai/consensus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          sessionId: targetSessionId && targetSessionId !== 'temp-session' ? targetSessionId : null
        })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        const listRes = await fetch('/api/ai/consensus');
        const listData = await listRes.json();
        if (listData.success) {
          setChatSessions(listData.chats);
          setActiveSessionId(data.sessionId);
        }
      } else {
        alert('Failed to get response: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error connecting to Consensus Engine.');
    } finally {
      setDashboardChatLoading(false);
    }
  }

  function handleNewSession() {
    setActiveSessionId(null);
    setDashboardQuestion('');
  }

  async function handleDeleteSession(sessionId, e) {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat history?')) return;
    try {
      const res = await fetch(`/api/ai/consensus?sessionId=${sessionId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const updated = chatSessions.filter(s => s.id !== sessionId);
        setChatSessions(updated);
        if (activeSessionId === sessionId) {
          setActiveSessionId(updated.length > 0 ? updated[0].id : null);
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }

  useEffect(() => { ensureSessionId(); checkAuthentication(); }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([
      fetch('/api/resumes').then(r => r.json()),
      fetch('/api/jobs').then(r => r.json()),
    ]).then(([rData, jData]) => {
      const jobs = jData.jobs || [];
      setStats({
        resumes: (rData.resumes || []).length,
        jobs: jobs.length,
        applied: jobs.filter(j => j.status === 'applied').length,
        interviews: jobs.filter(j => j.status === 'interview').length,
      });
      setRecentJobs(jobs.slice(0, 5));
    }).finally(() => setDashboardLoading(false));
  }, [isAuthenticated]);

  /* Scroll reveal + stats counter */
  useEffect(() => {
    if (isAuthenticated || loadingAuth) return;
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('lp-revealed'); });
    }, { threshold: 0.12 });
    document.querySelectorAll('.lp-reveal').forEach(el => revealObs.observe(el));

    const statsEl = document.getElementById('lp-stats-bar');
    let statsObs;
    if (statsEl) {
      statsObs = new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !statsStarted.current) {
          statsStarted.current = true;
          animateCounters();
        }
      }, { threshold: 0.3 });
      statsObs.observe(statsEl);
    }
    return () => { revealObs.disconnect(); statsObs?.disconnect(); };
  }, [isAuthenticated, loadingAuth]);

  function animateCounters() {
    const duration = 2000;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setAnimVals(HERO_STATS.map(s => Math.round(s.value * ease)));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function ensureSessionId() {
    if (typeof window === 'undefined') return;
    if (getCookie('session_id')) return;
    const id = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `fbt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    document.cookie = `session_id=${id}; path=/; max-age=${60 * 60 * 24 * 30};`;
  }

  async function checkAuthentication() {
    try { const res = await fetch('/api/auth/me'); setIsAuthenticated(res.ok); }
    catch { setIsAuthenticated(false); }
    finally { setLoadingAuth(false); }
  }

  function getCookie(name) {
    const cookieString = typeof document === 'undefined' ? '' : document.cookie;
    return cookieString.split('; ').find(row => row.startsWith(`${name}=`))?.split('=')[1] || '';
  }

  if (loadingAuth) {
    return (
      <div className="landing-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner spinner-xl" />
        <p style={{ marginTop: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading your career dashboard...</p>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════
     LANDING PAGE — Complete Redesign
     ═══════════════════════════════════════════════════ */
  if (!isAuthenticated) {
    return (
      <main className="lp">
        {/* Animated background */}
        <div className="lp-bg">
          <div className="lp-orb lp-orb-1" />
          <div className="lp-orb lp-orb-2" />
          <div className="lp-orb lp-orb-3" />
          <div className="lp-orb lp-orb-4" />
          <div className="lp-grid-dots" />
        </div>

        {/* Navigation */}
        <nav className="lp-nav">
          <div className="lp-nav-inner">
            <div className="lp-logo">
              <span className="lp-logo-icon">⚡</span>
              <span>FBT Job Hunt <span className="lp-logo-ai">AI</span></span>
            </div>
            <div className="lp-nav-links">
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="lp-nav-actions">
              <Link href="/login" className="lp-btn-ghost">Sign In</Link>
              <Link href="/register" className="lp-btn-primary">Get Started Free</Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="lp-hero">
          <div className="lp-hero-content">
            <div className="lp-badge lp-reveal">
              <span className="lp-badge-dot" />
              AI-Powered Career Platform
            </div>
            <h1 className="lp-hero-title lp-reveal">
              Your Career,<br />
              <span className="lp-gradient-text">Supercharged by AI</span>
            </h1>
            <p className="lp-hero-sub lp-reveal">
              From job discovery to interview prep — AI handles the heavy lifting so you can focus on landing your dream role. One intelligent workspace for your entire job search.
            </p>
            <div className="lp-hero-actions lp-reveal">
              <Link href="/register" className="lp-btn-primary lp-btn-xl lp-btn-glow">
                <span>✨</span> Start Free — No Credit Card
              </Link>
              <a href="#how-it-works" className="lp-btn-ghost lp-btn-xl">
                See How It Works <span>→</span>
              </a>
            </div>
            <div className="lp-hero-pills lp-reveal">
              {['🔍 Smart Job Search', '📄 AI Resume Builder', '🎯 Interview Prep', '📊 Application Tracker'].map(p => (
                <span key={p} className="lp-pill">{p}</span>
              ))}
            </div>
          </div>
          <div className="lp-hero-visual-sandbox lp-reveal" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="lp-sandbox-header">
              <div className="lp-sandbox-actions">
                <span className="lp-sdot red"></span>
                <span className="lp-sdot yellow"></span>
                <span className="lp-sdot green"></span>
              </div>
              <div className="lp-sandbox-tab">
                <span>⚡ Try JobHunt AI Assistant</span>
              </div>
            </div>
            <div className="lp-sandbox-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', padding: '20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 0 }}>
                Ask any question and get a fast, direct AI answer.
              </p>
              
              <form onSubmit={handleTestBrain} style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  value={brainQuestion}
                  onChange={(e) => setBrainQuestion(e.target.value)}
                  placeholder="Ask any question..."
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}
                />
                <button type="submit" disabled={brainLoading || !brainQuestion.trim()} style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0 16px', borderRadius: '8px', cursor: brainLoading ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                  {brainLoading ? 'Thinking...' : 'Ask AI'}
                </button>
              </form>

              {brainLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', padding: '12px 0', fontSize: '13px' }}>
                  <div className="spinner" /> <span>Thinking...</span>
                </div>
              )}

              {brainConsensus && !brainLoading && (
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                  <h4 style={{ fontSize: '13px', color: 'var(--accent-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>✨</span> AI Answer
                  </h4>
                  <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
                    {brainConsensus}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Stats Bar ── */}
        <section className="lp-stats-bar lp-reveal" id="lp-stats-bar">
          {HERO_STATS.map((s, i) => (
            <div className="lp-stat" key={s.label}>
              <span className="lp-stat-val">{animVals[i].toLocaleString()}{s.suffix}</span>
              <span className="lp-stat-lbl">{s.label}</span>
            </div>
          ))}
        </section>

        {/* ── Features Bento Grid ── */}
        <section className="lp-section" id="features">
          <div className="lp-section-head lp-reveal">
            <span className="lp-section-tag">Features</span>
            <h2 className="lp-section-title">Everything You Need to <span className="lp-gradient-text">Win the Job</span></h2>
            <p className="lp-section-sub">Six powerful AI modules working together so no opportunity slips through.</p>
          </div>
          <div className="lp-bento">
            {BENTO_FEATURES.map((f, i) => (
              <article className={`lp-bento-card lp-bento-${f.size} lp-reveal`} key={f.id} style={{ '--card-accent': f.accent, animationDelay: `${i * 80}ms` }}>
                <div className="lp-bento-top">
                  <span className="lp-bento-icon">{f.icon}</span>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
                
                {/* Pure CSS/HTML interactive mockups instead of generic illustrations */}
                {f.id === 'search' && (
                  <div className="lp-bento-visual lp-bento-visual-search">
                    <div className="lp-search-input">
                      <span>🔍</span>
                      <span className="lp-search-placeholder">AI Tech Lead Remote</span>
                    </div>
                    <div className="lp-search-sources">
                      <span className="lp-source-badge">LinkedIn</span>
                      <span className="lp-source-badge">Indeed</span>
                      <span className="lp-source-badge">Naukri</span>
                    </div>
                    <div className="lp-search-match-preview">
                      <div className="lp-match-desc">
                        <strong>Principal Developer</strong>
                        <span>Stripe · Remote</span>
                      </div>
                      <span className="lp-match-perc">98% Fit</span>
                    </div>
                  </div>
                )}

                {f.id === 'resume' && (
                  <div className="lp-bento-visual lp-bento-visual-resume">
                    <div className="lp-resume-split">
                      <div className="lp-resume-pane source">
                        <strong>Master Resume</strong>
                        <p>5 years React engineering...</p>
                      </div>
                      <div className="lp-resume-arrow">⚡</div>
                      <div className="lp-resume-pane target">
                        <strong>Tailored Version</strong>
                        <p className="lp-highlight-green">Optimized for Stripe Core API requirements...</p>
                      </div>
                    </div>
                  </div>
                )}

                {f.id === 'skills' && (
                  <div className="lp-bento-visual lp-bento-visual-skills">
                    <div className="lp-skills-comparison">
                      <div className="lp-skill-row done">
                        <span>TypeScript / Next.js</span>
                        <span className="lp-badge-check">Matched ✓</span>
                      </div>
                      <div className="lp-skill-row gap">
                        <span>Golang Concurrency</span>
                        <span className="lp-badge-gap">AI Identified Gap ⚠️</span>
                      </div>
                      <div className="lp-skills-cta-bar">
                        <span>⚡ Generate 10-Min Study Guide</span>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="lp-section" id="how-it-works">
          <div className="lp-section-head lp-reveal">
            <span className="lp-section-tag">Process</span>
            <h2 className="lp-section-title">From Search to <span className="lp-gradient-text">Success</span></h2>
            <p className="lp-section-sub">A repeatable, AI-powered system that replaces chaos with confidence.</p>
          </div>
          <div className="lp-timeline">
            {WORKFLOW_STEPS.map((s, i) => (
              <div className={`lp-timeline-step lp-reveal`} key={s.num} style={{ animationDelay: `${i * 100}ms` }}>
                <div className="lp-timeline-num">{s.num}</div>
                <div className="lp-timeline-connector" />
                <div className="lp-timeline-body">
                  <span className="lp-timeline-icon">{s.icon}</span>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Who It's For ── */}
        <section className="lp-section">
          <div className="lp-section-head lp-reveal">
            <span className="lp-section-tag">For Everyone</span>
            <h2 className="lp-section-title">Built for Every <span className="lp-gradient-text">Career Stage</span></h2>
            <p className="lp-section-sub">Whether you're starting out, switching roles, or scaling your search — we've got you covered.</p>
          </div>
          <div className="lp-persona-grid">
            {PERSONAS.map((p, i) => (
              <article className="lp-persona-card lp-reveal" key={p.title} style={{ '--persona-accent': p.accent, animationDelay: `${i * 100}ms` }}>
                <div className="lp-persona-icon">{p.icon}</div>
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
                <ul className="lp-persona-list">
                  {p.highlights.map(h => <li key={h}><span className="lp-check">✓</span>{h}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="lp-section" id="faq">
          <div className="lp-section-head lp-reveal">
            <span className="lp-section-tag">FAQ</span>
            <h2 className="lp-section-title">Got <span className="lp-gradient-text">Questions?</span></h2>
            <p className="lp-section-sub">Quick answers to help you get started.</p>
          </div>
          <div className="lp-faq-list">
            {FAQ_ITEMS.map((item, i) => (
              <div className={`lp-faq-item lp-reveal ${openFaq === i ? 'lp-faq-open' : ''}`} key={i}>
                <button className="lp-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{item.q}</span>
                  <span className="lp-faq-arrow">{openFaq === i ? '−' : '+'}</span>
                </button>
                <div className="lp-faq-a"><p>{item.a}</p></div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="lp-cta lp-reveal">
          <div className="lp-cta-orb lp-cta-orb-1" />
          <div className="lp-cta-orb lp-cta-orb-2" />
          <div className="lp-cta-inner">
            <div className="lp-cta-badge">
              <span className="lp-cta-badge-icon">🚀</span>
              <span className="lp-cta-badge-pulse"></span>
            </div>
            <h2>Ready to <span className="lp-gradient-text">Supercharge</span> Your Job Search?</h2>
            <p>Join thousands of professionals using AI to land their dream roles faster.</p>
            <div className="lp-cta-actions">
              <Link href="/register" className="lp-btn-primary lp-btn-xl lp-btn-glow">Create Free Account</Link>
              <Link href="/login" className="lp-btn-ghost lp-btn-xl">Sign In →</Link>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="lp-footer">
          <div className="lp-footer-inner">
            <div className="lp-footer-brand">
              <span className="lp-logo-icon">⚡</span> FBT Job Hunt AI
            </div>
            <p>Built with ❤️ by Future Bound Tech · AI-powered career intelligence</p>
          </div>
        </footer>
      </main>
    );
  }

  /* ═══════════════════════════════════════════════════
     AUTHENTICATED DASHBOARD — Preserved
     ═══════════════════════════════════════════════════ */
  const statCards = [
    { label: 'Total Resumes', value: stats.resumes, icon: '📄', color: 'rgba(99,102,241,0.15)' },
    { label: 'Jobs Tracked', value: stats.jobs, icon: '💼', color: 'rgba(6,182,212,0.15)' },
    { label: 'Applied', value: stats.applied, icon: '📨', color: 'rgba(16,185,129,0.15)' },
    { label: 'Interviews', value: stats.interviews, icon: '🎯', color: 'rgba(245,158,11,0.15)' },
  ];

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content" style={{ position: 'relative', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div className="hero-glow" />
        
        {/* Left Column - Main Content */}
        <div style={{ flex: '2 1 500px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* Premium Animated Header */}
          <div className="glass-card" style={{ padding: '32px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-50%', left: '-20%', width: '140%', height: '200%', background: 'radial-gradient(circle at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 60%)', pointerEvents: 'none' }} />
            <div className="flex-between" style={{ position: 'relative', zIndex: 1, gap: '20px', flexWrap: 'wrap' }}>
              <div>
                <h1 className="page-title text-gradient-shine" style={{ fontSize: '32px', marginBottom: '8px' }}>
                  Good {getGreeting()} 👋
                </h1>
                <p className="page-subtitle" style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
                  Your comprehensive career command center is ready.
                </p>
              </div>
              <div className="flex-row" style={{ gap: '12px' }}>

                {/* SMTP Onboarding Banner */}
                {smtpBanner.visible && (
                  <div style={{
                    padding: '14px 18px', background: 'linear-gradient(135deg, #6366f110, #8b5cf620)',
                    borderRadius: 12, border: '1px solid #6366f130', marginBottom: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    width: '100%',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                      <span style={{ fontSize: 20 }}>📧</span>
                      <div>
                        <strong style={{ fontSize: 13 }}>Set up your email to start applying</strong>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                          Configure your Gmail with an App Password to send applications automatically.
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <Link href="/smtp-setup" className="btn btn-primary btn-sm">Setup Email</Link>
                      {smtpBanner.dismissible && (
                        <button onClick={() => setSmtpBanner({ visible: false, dismissible: false })}
                          className="btn btn-ghost btn-sm" style={{ fontSize: 16, padding: '4px 10px' }}>✕</button>
                      )}
                    </div>
                  </div>
                )}
                <Link href="/resume-builder" className="btn btn-primary hover-float" style={{ boxShadow: 'var(--shadow-glow)' }}>
                  ✨ New Resume
                </Link>
                <Link href="/job-fetcher" className="btn btn-secondary hover-float" style={{ background: 'var(--bg-glass)', borderColor: 'rgba(255,255,255,0.1)' }}>
                  🔗 Fetch Job
                </Link>
              </div>
            </div>
          </div>

          <div className="stats-grid" style={{ gap: '20px' }}>
            {statCards.map(s => (
              <div key={s.label} className="glass-card hover-float" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div className="stat-icon" style={{ background: s.color, width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: 26 }}>{s.icon}</span>
                </div>
                <div>
                  <div className="stat-value" style={{ fontSize: '28px', fontWeight: 800, background: 'var(--text-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {dashboardLoading ? '—' : s.value}
                  </div>
                  <div className="stat-label" style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ gap: '24px' }}>
            {/* Quick Actions Bento */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="pulse-ring" style={{ width: '8px', height: '8px', background: 'var(--accent-primary)', display: 'inline-block', borderRadius: '50%' }}></span>
                Quick Actions
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {QUICK_ACTIONS.map(a => (
                  <Link key={a.href} href={a.href} style={{ textDecoration: 'none' }}>
                    <div className="glass-card hover-float" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 14,
                        background: `linear-gradient(135deg, ${a.color}20 0%, transparent 100%)`,
                        border: `1px solid ${a.color}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, flexShrink: 0,
                      }}>{a.icon}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 2 }}>{a.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.desc}</div>
                      </div>
                      <span style={{ marginLeft: 'auto', color: a.color, fontSize: 18, opacity: 0.7 }}>→</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Applications */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <div className="flex-between" style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🕐</span> Recent Applications
                </h2>
                <Link href="/job-tracker" className="btn btn-ghost btn-sm" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>View All →</Link>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {dashboardLoading ? (
                  <div className="empty-state" style={{ margin: 'auto', padding: '40px 0' }}>
                    <span className="pulse-ring" style={{ width: 32, height: 32, border: '3px solid var(--accent-primary)', borderRadius: '50%', borderTopColor: 'transparent', animation: 'spinner 0.8s linear infinite', marginBottom: 16, display: 'inline-block' }}></span>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading your jobs...</div>
                  </div>
                ) : recentJobs.length === 0 ? (
                  <div className="empty-state" style={{ margin: 'auto', padding: '40px 0' }}>
                    <div className="empty-icon" style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                    <div className="empty-title" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>No jobs tracked yet</div>
                    <div className="empty-desc" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Start by fetching a job URL or adding one manually</div>
                    <Link href="/job-fetcher" className="btn btn-primary hover-float">Fetch a Job</Link>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {recentJobs.map(job => (
                      <div key={job.id} className="glass-card hover-float" style={{ padding: '16px 20px' }}>
                        <div className="flex-between" style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>{job.title || job.role || job.jobTitle || (job.company ? job.company + ' Role' : 'Untitled Role')}</div>
                          <span className={`tag ${STATUS_COLORS[job.status] || 'tag-primary'}`} style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>{job.status}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span>💼 {job.company || 'Unknown Company'}</span>
                          <span style={{ width: '4px', height: '4px', background: 'var(--text-muted)', borderRadius: '50%' }}></span>
                          <span>📍 {job.location || 'Remote'}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                          Applied on {new Date(job.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(6,182,212,0.05) 100%)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                  🚀 Next-Gen Career Optimization Engine
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Generate ATS-optimized resumes tailored to any job description, match existing resumes, and extract structured data from any job posting URL — all with our advanced career intelligence engine.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {['ATS-Optimized', 'Resume Vault', 'URL Scraper', 'Job Tracker'].map(f => (
                  <span key={f} className="tag tag-primary" style={{ padding: '6px 14px', fontSize: 12, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>{f}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Auto Apply Status */}
        <div className="auto-apply-widget-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <AutoApplyWidget />
        </div>
      </main>
    </div>
  );
}

function AutoApplyWidget() {
  const [state, setState] = useState({ active: false, run: null });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/auto-apply/status');
        const data = await res.json();
        setState(data);
      } catch {}
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const run = state.run;
  const isRunning = state.active && run?.status === 'running';
  const isPaused = state.active && run?.status === 'paused';
  const stats = run?.stats || {};
  const logs = run?.logs || [];

  return (
    <div className="glass-card auto-apply-widget hover-float" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px' }}>
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
          <span className={isRunning ? 'pulse-ring' : ''} style={{ width: 10, height: 10, borderRadius: '50%', background: isRunning ? '#10b981' : isPaused ? '#f59e0b' : '#64748b', display: 'inline-block' }}></span>
          Auto Apply {isRunning ? 'Running' : isPaused ? 'Paused' : 'Idle'}
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          {isRunning ? `Applying to ${run.targetRole} jobs` : 'Auto-application process.'}
        </p>

        {run && (
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { l: 'Search', v: stats.searched, c: '#3b82f6' },
              { l: 'Scored', v: stats.scored, c: '#8b5cf6' },
              { l: 'Applied', v: stats.applied, c: '#10b981' },
              { l: 'Fail', v: stats.failed, c: '#ef4444' },
            ].map(s => (
              <div key={s.l} style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: '10px', background: `linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)`, border: `1px solid ${s.c}30` }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.c }}>{s.v || 0}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '200px' }}>
        {logs.length === 0 ? (
          <div className="empty-state" style={{ margin: 'auto', padding: '32px 0' }}>
            <div className="empty-icon" style={{ fontSize: '36px', marginBottom: '12px' }}>💤</div>
            <div className="empty-title" style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Auto Apply is idle</div>
            <div className="empty-desc" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Configure and start in the Auto Apply page.</div>
            <Link href="/auto-apply" className="btn btn-primary btn-sm hover-float" style={{ boxShadow: 'var(--shadow-glow)' }}>Configure</Link>
          </div>
        ) : (
          logs.slice(0, 20).map((log, i) => (
            <div key={i} style={{
              fontSize: '12px', padding: '12px 14px', background: 'rgba(0,0,0,0.2)',
              borderRadius: '10px',
              borderLeft: `3px solid ${log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#10b981' : '#3b82f6'}`,
            }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', fontSize: '13px' }}>{log.title}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>{log.message}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
                {new Date(log.time).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
      
      {(isRunning || isPaused) && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          <Link href="/auto-apply" className="btn btn-primary btn-sm btn-full" style={{ fontSize: '12px' }}>
            {isRunning ? '🟢 View Auto Apply' : '⏸️ Auto Apply Paused'}
          </Link>
        </div>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
