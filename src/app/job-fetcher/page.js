'use client';
import { useState, useEffect, useCallback } from 'react';
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
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [jobPreview, setJobPreview] = useState(null);
  const [securityWarning, setSecurityWarning] = useState('');
  const [manualText, setManualText] = useState('');
  const [enriching, setEnriching] = useState(false);
  const router = useRouter();



  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('jh_fetch_history') || '[]');
      setHistory(saved);
    } catch (e) {}
    // Restore job preview from global search
    try {
      const preview = JSON.parse(localStorage.getItem('jh_prefill_job_preview'));
      if (preview) setJobPreview(preview);
    } catch (e) {}
  }, []);

  function saveToHistory(job) {
    if (!job.applyLink) return;
    setHistory(prev => {
      const filtered = prev.filter(h => h.url !== job.applyLink);
      const updated = [{ url: job.applyLink, title: job.title, company: job.company, date: new Date().toLocaleDateString() }, ...filtered].slice(0, 5);
      localStorage.setItem('jh_fetch_history', JSON.stringify(updated));
      return updated;
    });
  }

  const handleFetch = useCallback(async (providedUrl) => {
    const targetUrl = (typeof providedUrl === 'string' ? providedUrl : '') || url;
    if (!targetUrl.trim()) { setError('Please enter a job URL.'); return; }
    setError(''); setLoading(true); setResult(null); setSaved(false); setSecurityWarning('');
    try {
      const res = await fetch('/api/fetch-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch job');
      setResult(data.job);
      setSecurityWarning(data.warning || '');
      saveToHistory(data.job);
      handleMatchResumes(data.job.description);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  // Handle pre-filled URL from Job Search
  useEffect(() => {
    const prefill = localStorage.getItem('jh_prefill_url');
    if (prefill) {
      setUrl(prefill);
      localStorage.removeItem('jh_prefill_url');
      handleFetch(prefill);
    }
  }, [handleFetch]);

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

  function handleNavigateToTraining(dest) {
    if (result) {
      localStorage.setItem('jh_prefill_jd', result.description || '');
      localStorage.setItem('jh_prefill_title', result.title || '');
      localStorage.setItem('jh_prefill_company', result.company || '');
      router.push(dest);
    }
  }

  async function handleEnrichDetails() {
    if (!result?.description) return;
    setEnriching(true);
    setError('');
    try {
      const res = await fetch('/api/ai/extract-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: result.description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enrichment failed');
      if (data.job) {
        setResult(prev => ({
          ...prev,
          skills: data.job.skills?.length ? data.job.skills : prev.skills,
          responsibilities: data.job.responsibilities?.length ? data.job.responsibilities : prev.responsibilities,
          requirements: data.job.requirements?.length ? data.job.requirements : prev.requirements,
          benefits: data.job.benefits?.length ? data.job.benefits : prev.benefits,
          experience: data.job.experience || prev.experience,
          salary: data.job.salary || prev.salary,
          location: data.job.location || prev.location,
          type: data.job.type || prev.type,
        }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setEnriching(false);
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
          <div className="flex-between">
            <div>
              <h1 className="page-title">🔗 Job Fetcher</h1>
              <p className="page-subtitle">Paste any job URL — AI extracts all details instantly</p>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => router.push('/job-search')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              ← Back to Search Results
            </button>
          </div>
          {jobPreview && (
            <div style={{
              marginTop: 12,
              padding: '12px 16px',
              background: 'rgba(99,102,241,0.08)',
              borderRadius: 12,
              border: '1px solid rgba(99,102,241,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 13,
            }}>
              <span style={{ fontSize: 20 }}>📌</span>
              <div>
                <span style={{ fontWeight: 700 }}>{jobPreview.title}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>at {jobPreview.company}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>· {jobPreview.location}</span>
              </div>
              {jobPreview.salary && (
                <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--accent-emerald)' }}>{jobPreview.salary}</span>
              )}
            </div>
          )}
        </div>

        {/* Toggle Mode & History Dropdown */}
        <div className="flex-between" style={{ marginBottom: 16, position: 'relative' }}>
          <div style={{ display: 'flex', gap: 8 }}>
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

          <div style={{ position: 'relative' }}>
            <button 
              className={`btn btn-sm ${showHistory ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowHistory(!showHistory)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              🕒 Recent Searches
              <span style={{ fontSize: 10 }}>{showHistory ? '▲' : '▼'}</span>
            </button>

            {showHistory && history.length > 0 && (
              <div 
                className="card-glass" 
                style={{ 
                  position: 'absolute', 
                  top: 'calc(100% + 8px)', 
                  right: 0, 
                  zIndex: 100, 
                  width: 320, 
                  maxHeight: 400, 
                  overflowY: 'auto',
                  padding: 12,
                  boxShadow: 'var(--shadow-glow)',
                  border: '1px solid var(--border-hover)'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {history.map((h, i) => (
                    <div 
                      key={i} 
                      onClick={() => { 
                        setUrl(h.url); 
                        handleFetch(h.url); 
                        setShowHistory(false);
                      }}
                      style={{ 
                        padding: '10px 12px', 
                        background: 'rgba(255,255,255,0.03)', 
                        borderRadius: 10, 
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        border: '1px solid transparent'
                      }}
                      onMouseEnter={e => e.currentTarget.style.border = '1px solid var(--accent-primary)'}
                      onMouseLeave={e => e.currentTarget.style.border = '1px solid transparent'}
                    >
                      <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {h.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {h.company} · {h.date}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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

            {securityWarning && (
              <div className="alert alert-amber" style={{ marginBottom: 20, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                ⚠️ {securityWarning}
              </div>
            )}

            {(!result.skills?.length || !result.responsibilities?.length || !result.requirements?.length) && (
              <div className="card-glass" style={{
                padding: '16px 20px',
                borderRadius: 16,
                border: '1px solid rgba(245,158,11,0.2)',
                background: 'rgba(245,158,11,0.03)',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16
              }}>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-amber)', margin: 0 }}>💡 Basic Scraping Fallback Active</h4>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    We only extracted a raw description. Click "Enrich Details" to have AI analyze and extract a complete structure of required skills, benefits, and responsibilities!
                  </p>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleEnrichDetails}
                  disabled={enriching}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                >
                  {enriching ? <><span className="spinner" /> Analyzing...</> : '🧠 Enrich Details with AI'}
                </button>
              </div>
            )}

            {/* Custom Training & Assessment Buttons */}
            <div className="card-glass" style={{
              padding: '24px',
              borderRadius: 20,
              border: '1px solid rgba(99,102,241,0.2)',
              background: 'rgba(99,102,241,0.04)',
              marginBottom: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                  🎓 Tailored Training & Career Preparation
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Prepare specifically for the role of <strong>{result.title}</strong> at <strong>{result.company || 'this company'}</strong>. Click below to generate study roadmaps, mock interviews, and MCQs tailored perfectly to this exact job description (JD).
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => handleNavigateToTraining('/training')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12 }}
                >
                  🎓 Prepare Training Course
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleNavigateToTraining('/training/mock-interview')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12 }}
                >
                  🎤 Mock Interview prep
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleNavigateToTraining('/training/technical-mock')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12 }}
                >
                  🧪 Technical MCQ test
                </button>
              </div>
            </div>

            <div style={{ columnCount: 2, columnWidth: '350px', columnGap: '20px' }}>
              
              {/* Job Overview */}
              <div className="card" style={{ breakInside: 'avoid-column', marginBottom: 20, WebkitColumnBreakInside: 'avoid' }}>
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
              {Array.isArray(result.skills) && result.skills.length > 0 && (
                <div className="card" style={{ breakInside: 'avoid-column', marginBottom: 20, WebkitColumnBreakInside: 'avoid' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🛠️ Required Skills</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {result.skills.map(s => (
                      <span key={s} className="tag tag-primary">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Benefits */}
              {Array.isArray(result.benefits) && result.benefits.length > 0 && (
                <div className="card" style={{ breakInside: 'avoid-column', marginBottom: 20, WebkitColumnBreakInside: 'avoid' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🎁 Benefits</h3>
                  {result.benefits.map((b, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--accent-emerald)' }}>✓</span> {b}
                    </div>
                  ))}
                </div>
              )}

              {/* Responsibilities */}
              {Array.isArray(result.responsibilities) && result.responsibilities.length > 0 && (
                <div className="card" style={{ breakInside: 'avoid-column', marginBottom: 20, WebkitColumnBreakInside: 'avoid' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📌 Responsibilities</h3>
                  {result.responsibilities.map((r, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', gap: 10 }}>
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 700, flexShrink: 0 }}>→</span> {r}
                    </div>
                  ))}
                </div>
              )}

              {/* Requirements */}
              {Array.isArray(result.requirements) && result.requirements.length > 0 && (
                <div className="card" style={{ breakInside: 'avoid-column', marginBottom: 20, WebkitColumnBreakInside: 'avoid' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>✅ Requirements</h3>
                  {result.requirements.map((r, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', gap: 10 }}>
                      <span style={{ color: 'var(--accent-emerald)', flexShrink: 0 }}>✓</span> {r}
                    </div>
                  ))}
                </div>
              )}

              {/* Full Description */}
              {result.description && (
                <div className="card" style={{ breakInside: 'avoid-column', marginBottom: 20, WebkitColumnBreakInside: 'avoid' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📄 Full Description</h3>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                    {result.description}
                  </div>
                </div>
              )}

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
