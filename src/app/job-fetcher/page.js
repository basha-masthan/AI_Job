'use client';
import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useRouter } from 'next/navigation';

export default function JobFetcher() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matches, setMatches] = useState([]);
  const [prepping, setPrepping] = useState(false);
  const [toolkit, setToolkit] = useState(null);
  const [mode, setMode] = useState('url'); // 'url' | 'manual'
  const [manualText, setManualText] = useState('');
  const router = useRouter();

  async function handleFetch() {
    if (!url.trim()) { setError('Please enter a job URL.'); return; }
    setError(''); setLoading(true); setResult(null); setSaved(false);
    try {
      const res = await fetch('/api/fetch-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch job');
      setResult(data.job);
      // Trigger matching
      handleMatchResumes(data.job.description);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleManualExtract() {
    if (!manualText.trim()) { setError('Please paste the job description text.'); return; }
    setError(''); setLoading(true); setResult(null); setSaved(false);
    try {
      const res = await fetch('/api/ai/extract-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: manualText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract job');
      setResult(data.job);
      handleMatchResumes(data.job.description);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMatchResumes(jdText) {
    if (!jdText) return;
    setMatching(true);
    try {
      const res = await fetch('/api/resumes/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: jdText }),
      });
      const data = await res.json();
      if (res.ok) setMatches(data.matches || []);
    } catch (err) {
      console.warn('Matching failed:', err);
    } finally {
      setMatching(false);
    }
  }

  async function handlePrepApplication(resumeId) {
    if (!result?.description || !resumeId) return;
    setPrepping(true);
    setToolkit(null);
    try {
      const res = await fetch('/api/ai/prep-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: result.description, resumeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToolkit(data.toolkit);
    } catch (err) {
      setError('Failed to prep application: ' + err.message);
    } finally {
      setPrepping(false);
    }
  }

  async function handleSaveToTracker() {
    setSaving(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: result.title,
          company: result.company,
          location: result.location,
          type: result.type,
          salary: result.salary,
          url: result.applyLink || url,
          description: result.description,
          status: 'wishlist',
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleBuildResume() {
    // Navigate to resume builder with JD pre-filled via localStorage
    if (result) {
      localStorage.setItem('jh_prefill_jd', result.description || '');
      localStorage.setItem('jh_prefill_title', result.title || '');
      router.push('/resume-builder');
    }
  }

  const POPULAR_SITES = [
    { name: 'LinkedIn', icon: '🔵', url: 'https://www.linkedin.com/jobs/' },
    { name: 'Naukri', icon: '🟠', url: 'https://www.naukri.com/' },
    { name: 'Indeed', icon: '🔷', url: 'https://in.indeed.com/' },
    { name: 'Internshala', icon: '🟣', url: 'https://internshala.com/' },
  ];

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">🔗 Job Fetcher</h1>
          <p className="page-subtitle">Paste any job URL — Claude extracts all details instantly</p>
        </div>

        {/* Toggle Mode */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button 
            className={`btn btn-sm ${mode === 'url' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMode('url')}
          >
            🔗 URL Fetcher
          </button>
          <button 
            className={`btn btn-sm ${mode === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMode('manual')}
          >
            📝 Manual Paste
          </button>
        </div>

        {/* Inputs */}
        <div className="card" style={{ marginBottom: 24 }}>
          {mode === 'url' ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Job Posting URL</label>
                <input
                  className="form-input"
                  style={{ fontSize: 15 }}
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleFetch()}
                  placeholder="https://www.linkedin.com/jobs/view/..."
                />
              </div>
              <div style={{ paddingTop: 22 }}>
                <button className="btn btn-primary btn-lg" onClick={handleFetch} disabled={loading || !url.trim()}>
                  {loading ? <><span className="spinner" /> Fetching...</> : '🔍 Fetch Details'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-col">
              <label className="form-label">Paste Job Description Text</label>
              <textarea
                className="form-textarea"
                style={{ minHeight: 200 }}
                placeholder="Paste the requirements, responsibilities, and about the role here..."
                value={manualText}
                onChange={e => setManualText(e.target.value)}
              />
              <button 
                className="btn btn-primary btn-lg" 
                style={{ marginTop: 12 }}
                onClick={handleManualExtract}
                disabled={loading || !manualText.trim()}
              >
                {loading ? <><span className="spinner" /> Analyzing Text...</> : '🧠 Extract with AI'}
              </button>
            </div>
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Works with:</span>
            {POPULAR_SITES.map(s => (
              <span key={s.name} className="tag tag-primary" style={{ fontSize: 11 }}>{s.icon} {s.name}</span>
            ))}
            <span className="tag tag-cyan" style={{ fontSize: 11 }}>+ any job board</span>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>⚠️ {error}</div>}

        {loading && (
          <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, fontFamily: 'Space Grotesk' }}>Analyzing Job Posting...</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Scraping the page → Claude is extracting and structuring all details
            </div>
            <div style={{ marginTop: 20 }}>
              <div className="spinner spinner-lg" style={{ borderColor: 'rgba(99,102,241,0.3)', borderTopColor: 'var(--accent-primary)' }} />
            </div>
          </div>
        )}

        {result && (
          <div>
            <div className="flex-between" style={{ marginBottom: 16 }}>
              <div className="alert alert-success">✅ Job details extracted successfully!</div>
              <div className="flex-row">
                <button className="btn btn-secondary" onClick={handleBuildResume}>✨ Build Resume for This JD</button>
                <button className="btn btn-primary" onClick={handleSaveToTracker} disabled={saving || saved}>
                  {saved ? '✅ Saved to Tracker' : saving ? <><span className="spinner" /> Saving...</> : '📋 Save to Job Tracker'}
                </button>
              </div>
            </div>

            <div className="grid-2" style={{ gap: 20, alignItems: 'start' }}>
              {/* Job Overview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="card">
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 14,
                      background: 'var(--gradient-hero)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 28, flexShrink: 0,
                    }}>💼</div>
                    <div>
                      <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{result.title}</h2>
                      <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-secondary)' }}>{result.company}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { icon: '📍', label: 'Location', value: result.location },
                      { icon: '⏰', label: 'Type', value: result.type },
                      { icon: '📅', label: 'Experience', value: result.experience },
                      { icon: '💰', label: 'Salary', value: result.salary },
                      { icon: '📆', label: 'Posted', value: result.postedDate },
                      { icon: '⏳', label: 'Deadline', value: result.deadline },
                    ].filter(f => f.value && f.value !== 'Not specified' && f.value !== 'Unknown').map(f => (
                      <div key={f.label} style={{ padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{f.icon} {f.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{f.value}</div>
                      </div>
                    ))}
                  </div>

                  {result.applyLink && (
                    <a href={result.applyLink} target="_blank" rel="noreferrer" className="btn btn-primary btn-full" style={{ marginTop: 16 }}>
                      🚀 Apply Now →
                    </a>
                  )}
                </div>

                {/* Skills */}
                {result.skills?.length > 0 && (
                  <div className="card">
                    <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🛠️ Required Skills</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {result.skills.map(s => (
                        <span key={s} className="tag tag-primary">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Benefits */}
                {result.benefits?.length > 0 && (
                  <div className="card">
                    <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🎁 Benefits</h3>
                    {result.benefits.map((b, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', gap: 8 }}>
                        <span style={{ color: 'var(--accent-emerald)' }}>✓</span> {b}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Requirements & Responsibilities */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {result.responsibilities?.length > 0 && (
                  <div className="card">
                    <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📌 Responsibilities</h3>
                    {result.responsibilities.map((r, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', gap: 10 }}>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 700, flexShrink: 0 }}>→</span> {r}
                      </div>
                    ))}
                  </div>
                )}

                {result.requirements?.length > 0 && (
                  <div className="card">
                    <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>✅ Requirements</h3>
                    {result.requirements.map((r, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', gap: 10 }}>
                        <span style={{ color: 'var(--accent-emerald)', flexShrink: 0 }}>✓</span> {r}
                      </div>
                    ))}
                  </div>
                )}

                {result.description && (
                  <div className="card">
                    <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📄 Full Description</h3>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                      {result.description}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Application Toolkit */}
            {toolkit ? (
              <div className="card" style={{ marginTop: 24, background: 'var(--bg-secondary)', border: '1px solid var(--accent-emerald)50' }}>
                <div className="flex-between" style={{ marginBottom: 20 }}>
                  <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 700 }}>🎁 AI Application Toolkit</h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => setToolkit(null)}>Close</button>
                </div>

                <div className="grid-2" style={{ gap: 24 }}>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--accent-primary)' }}>📄 Tailored Cover Letter</h4>
                    <div className="card" style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto', background: '#fff' }}>
                      {toolkit.coverLetter}
                    </div>
                    <button 
                      className="btn btn-secondary btn-sm btn-full" 
                      style={{ marginTop: 12 }}
                      onClick={() => { navigator.clipboard.writeText(toolkit.coverLetter); alert('Copied to clipboard!'); }}
                    >
                      📋 Copy Cover Letter
                    </button>
                  </div>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--accent-emerald)' }}>💬 Smart Answers for Application</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {toolkit.questions.map((q, i) => (
                        <div key={i} className="card" style={{ padding: 12, background: '#fff' }}>
                          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: 'var(--text-primary)' }}>{q.q}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{q.a}</div>
                          <button 
                            className="btn btn-ghost btn-xs" 
                            style={{ marginTop: 8, padding: '2px 8px' }}
                            onClick={() => { navigator.clipboard.writeText(q.a); }}
                          >
                            Copy Answer
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : prepping ? (
              <div className="card" style={{ marginTop: 24, textAlign: 'center', padding: '40px' }}>
                <div className="spinner spinner-lg" style={{ marginBottom: 16 }} />
                <div style={{ fontWeight: 700 }}>AI is building your Application Toolkit...</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Writing cover letter and answering screener questions</div>
              </div>
            ) : null}

            {/* AI Resume Matching Section */}
            <div className="card" style={{ marginTop: 24, background: 'rgba(99,102,241,0.03)', border: '1px dashed rgba(99,102,241,0.4)' }}>
              <div className="flex-between" style={{ marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>🤖 AI Profile Matching</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Comparing this JD with your Resume Vault to find the best fit</p>
                </div>
                {matching && <div className="spinner" />}
              </div>

              {matches.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {matches.slice(0, 3).map(m => (
                    <div key={m.id} className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '12px 16px' }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 10,
                        background: m.score >= 90 ? 'var(--accent-emerald)15' : 'var(--accent-primary)15',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, fontWeight: 800, color: m.score >= 90 ? 'var(--accent-emerald)' : 'var(--accent-primary)'
                      }}>
                        {m.score}%
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{m.fileName}</span>
                          <span className="tag tag-ghost" style={{ fontSize: 10 }}>{m.jobTitle}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          "{m.reason}"
                        </div>
                      </div>
                      {m.score >= 95 ? (
                        <button className="btn btn-primary btn-sm" onClick={() => handlePrepApplication(m.id)}>🚀 Prep Application</button>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => handlePrepApplication(m.id)}>📋 Prep Anyway</button>
                          <button className="btn btn-ghost btn-sm" onClick={handleBuildResume}>✨ Tailor</button>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {matches[0]?.score < 95 && (
                    <div className="alert alert-amber" style={{ marginTop: 8, fontSize: 13 }}>
                      💡 No resume matches above 95%. I recommend <strong>tailoring a new version</strong> to maximize your interview chances.
                    </div>
                  )}
                </div>
              ) : !matching && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>No profiles in vault yet</div>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => router.push('/resume-vault')}>📤 Upload Your Base Resume</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* How it works */}
        {!result && !loading && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>⚡ How It Works</h3>
            <div className="grid-3" style={{ gap: 16 }}>
              {[
                { icon: '🔗', title: 'Paste URL', desc: 'Copy any job posting URL from LinkedIn, Naukri, Indeed, or any company career page' },
                { icon: '🤖', title: 'AI Extracts', desc: "Claude reads the page and intelligently extracts title, company, requirements, and all details" },
                { icon: '📋', title: 'Save & Track', desc: 'Save to job tracker or instantly generate a tailored resume for this specific role' },
              ].map(step => (
                <div key={step.title} className="card" style={{ textAlign: 'center', padding: '28px 20px' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>{step.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, fontFamily: 'Space Grotesk' }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{step.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
