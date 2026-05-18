'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import { downloadAsDocx } from '@/lib/exportUtils';

export default function ResumeBuilder() {

  const [vaultResumes, setVaultResumes] = useState([]);
  const [vaultLoading, setVaultLoading] = useState(true);
  const [smartMerge, setSmartMerge] = useState(true);
  const [selectedBaseId, setSelectedBaseId] = useState('');
  const [baseProfile, setBaseProfile] = useState(null);

  const [jd, setJd] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState('input');
  const [extracting, setExtracting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  async function reExtractProfile() {
    if (!selectedBaseId) return;
    setExtracting(true); setError('');
    try {
      const res = await fetch(`/api/resumes/${selectedBaseId}/extract`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBaseProfile(data.profile);
      setVaultResumes(prev => prev.map(r => r.id === selectedBaseId ? { ...r, extractedProfile: data.profile, data: data.profile, profileExtracted: true } : r));
    } catch (err) {
      setError('Re-extraction failed: ' + err.message);
    } finally {
      setExtracting(false);
    }
  }

  // Load vault resumes on mount + check for JD prefill from job fetcher
  useEffect(() => {
    const prefillJD = localStorage.getItem('jh_prefill_jd');
    const prefillTitle = localStorage.getItem('jh_prefill_title');
    if (prefillJD) { setJd(prefillJD); localStorage.removeItem('jh_prefill_jd'); }
    if (prefillTitle) { setJobTitle(prefillTitle); localStorage.removeItem('jh_prefill_title'); }

    fetch('/api/resumes')
      .then(r => r.json())
      .then(data => {
        const resumes = data.resumes || [];
        setVaultResumes(resumes);
        
        // Default to Smart Merge if there are favorites, otherwise pick the best single one
        const favorites = resumes.filter(r => r.isFavorite);
        if (favorites.length > 0) {
          setSmartMerge(true);
        } else {
          const best = resumes.find(r => r.extractedProfile || r.data) || resumes[0];
          if (best) {
            setSelectedBaseId(best.id);
            setBaseProfile(best.extractedProfile || best.data || null);
            setSmartMerge(false);
          }
        }
      })
      .finally(() => setVaultLoading(false));
  }, []);

  // When user picks a different base resume
  function handleBaseChange(id) {
    if (id === 'smart-merge') {
      setSmartMerge(true);
      setSelectedBaseId('');
      setBaseProfile(null);
      return;
    }
    setSmartMerge(false);
    setSelectedBaseId(id);
    const resume = vaultResumes.find(r => r.id === id);
    setBaseProfile(resume?.extractedProfile || resume?.data || null);
  }

  async function handleGenerate() {
    if (!jd.trim()) { setError('Please paste a job description.'); return; }
    
    let profileToUse = baseProfile;
    if (smartMerge) {
      const favorites = vaultResumes.filter(r => r.isFavorite && (r.data || r.extractedProfile));
      const sourceResumes = favorites.length > 0 ? favorites : vaultResumes.filter(r => r.data || r.extractedProfile);
      
      if (sourceResumes.length === 0) {
        setError('No profiles found in your vault. Please upload a resume first.');
        return;
      }
      
      // Combine all profiles into an array for the AI to "Smart Merge"
      profileToUse = sourceResumes.map(r => r.data || r.extractedProfile);
    }

    if (!profileToUse) { setError('Please select a base profile.'); return; }
    
    setError(''); setLoading(true);

    try {
      const res = await fetch('/api/ai/generate-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jobDescription: jd, 
          jobTitle, 
          userProfile: profileToUse,
          isSmartMerge: smartMerge 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setResult(data.resume);
      setStep('preview');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Resume - ${result.data?.name}</title>
      <style>
        body{font-family:Georgia,serif;padding:40px;max-width:800px;margin:0 auto;color:#111}
        h1{font-size:26px;margin-bottom:4px}
        .contact{font-size:12px;color:#555;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:12px}
        .section{margin-top:20px}
        .section-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6366f1;border-bottom:2px solid #6366f1;padding-bottom:4px;margin-bottom:10px}
        .exp-role{font-weight:700;font-size:13px}
        .exp-company{color:#555;font-size:12px}
        ul{padding-left:18px;margin-top:6px}
        li{font-size:12px;margin-bottom:3px}
        @media print{body{padding:20px}}
      </style></head>
      <body>${buildResumeHTML(result.data)}</body></html>`);
    win.document.close();
    win.print();
  }

  async function handleDownloadPDF() {
    const html2pdf = (await import('html2pdf.js')).default;
    const element = document.getElementById('resume-preview-container');
    const opt = {
      margin:       10,
      filename:     `${result.data?.name || 'Resume'}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  }

  async function handleDownloadDocx() {
    await downloadAsDocx(result.data, `${result.data?.name || 'Resume'}.docx`);
  }


  // ── Gate: no resumes in vault ─────────────────────────────
  if (!vaultLoading && vaultResumes.length === 0) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: 520, textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 72, marginBottom: 20 }}>📄</div>
            <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 26, fontWeight: 800, marginBottom: 12 }}>
              Upload Your Resume First
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 28 }}>
              To create a tailored resume, the AI needs your existing profile as a base.
              Upload at least <strong style={{ color: 'var(--text-primary)' }}>one of your current resumes</strong> to the vault — 
              AI will read it and tailor a new version specifically for your target job.
            </p>
            <div className="card" style={{ textAlign: 'left', marginBottom: 24, padding: '16px 20px', borderColor: 'rgba(99,102,241,0.3)' }}>
              {[
                { icon: '1️⃣', text: 'Go to Resume Vault and upload your current resume (PDF/DOC)' },
                { icon: '2️⃣', text: 'AI automatically extracts your profile — skills, experience, education' },
                { icon: '3️⃣', text: 'Come back here, paste any JD, and get a tailored resume in seconds' },
              ].map(s => (
                <div key={s.icon} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{s.icon}</span>
                  {s.text}
                </div>
              ))}
            </div>
            <Link href="/resume-vault" className="btn btn-primary btn-lg">
              📤 Upload My Resume →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // ── Preview mode ──────────────────────────────────────────
  if (step === 'preview' && result) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="main-content">
          <div className="page-header">
            <div className="flex-between">
              <div>
                <h1 className="page-title">✨ Resume Generated</h1>
                <p className="page-subtitle">Tailored from <strong style={{ color: 'var(--accent-primary)' }}>
                  {vaultResumes.find(r => r.id === selectedBaseId)?.data?.name ||
                   vaultResumes.find(r => r.id === selectedBaseId)?.fileName || 'your profile'}
                </strong></p>
              </div>
              <div className="flex-row" style={{ gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => { setStep('input'); setResult(null); }}>← Build Another</button>
                <button className="btn btn-secondary" onClick={handleDownloadDocx}>📄 DOCX</button>
                <button className="btn btn-primary" onClick={handleDownloadPDF}>📥 Download PDF</button>
              </div>
            </div>
          </div>
          <div className="alert alert-success" style={{ marginBottom: 20 }}>
            ✅ Saved to vault · ID: <strong>{result.id}</strong>
          </div>
          <div id="resume-preview-container" style={{ background: '#fff', color: '#111', padding: '40px', borderRadius: '8px', fontFamily: 'Georgia, serif' }}>
            <div className="resume-viewer" dangerouslySetInnerHTML={{ __html: buildResumeHTML(result.data) }} />
          </div>
        </main>
      </div>
    );
  }

  // ── Input mode ────────────────────────────────────────────
  const selectedResume = vaultResumes.find(r => r.id === selectedBaseId);
  const profileReady = !!(selectedResume?.extractedProfile || selectedResume?.data);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">✨ Resume Builder</h1>
          <p className="page-subtitle">Paste a JD → AI tailors a resume from your uploaded profile</p>
        </div>

        {vaultLoading ? (
          <div className="empty-state"><div className="spinner spinner-lg" /></div>
        ) : step === 'input' ? (
          <div className="grid-2" style={{ gap: 24, alignItems: 'start' }}>
            {/* LEFT: JD Input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card">
                <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📝 Job Details</h3>
                <div className="flex-col">
                  <div className="form-group">
                    <label className="form-label">Job Title (optional)</label>
                    <input
                      className="form-input"
                      placeholder="e.g. Senior React Developer"
                      value={jobTitle}
                      onChange={e => setJobTitle(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Job Description *</label>
                    <textarea
                      className="form-textarea"
                      style={{ minHeight: 260 }}
                      placeholder="Paste the complete job description here — requirements, responsibilities, qualifications..."
                      value={jd}
                      onChange={e => setJd(e.target.value)}
                    />
                    {jd && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{jd.split(/\s+/).filter(Boolean).length} words</span>}
                  </div>
                </div>
              </div>

              {error && <div className="alert alert-error">⚠️ {error}</div>}

              <button
                className="btn btn-primary btn-lg btn-full"
                onClick={handleGenerate}
                disabled={loading || !jd.trim() || !profileReady}
              >
                {loading
                  ? <><span className="spinner" /> Tailoring with AI...</>
                  : !profileReady
                    ? '⏳ Extracting profile, please wait...'
                    : '✨ Generate Tailored Resume'}
              </button>

              {loading && (
                <div className="card" style={{ textAlign: 'center', padding: '24px', borderColor: 'rgba(99,102,241,0.3)' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>AI is tailoring your resume...</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Reading your profile · Matching to JD keywords · Writing ATS-optimized content
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Profile Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Base resume picker */}
              <div className="card" style={{ borderColor: (profileReady || smartMerge) ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)' }}>
                <div className="flex-between" style={{ marginBottom: 12 }}>
                  <h3 style={{ fontWeight: 700, fontSize: 15 }}>👤 Base Profile</h3>
                  <span className={`tag ${(profileReady || smartMerge) ? 'tag-green' : 'tag-amber'}`}>
                    {(profileReady || smartMerge) ? (smartMerge ? '✨ Smart Merge Active' : '✓ Profile Ready') : '⏳ Extracting...'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                  {smartMerge 
                    ? 'AI is currently in "Smart Merge" mode. It will analyze ALL your starred resumes to find the best matching skills and experience for this JD.'
                    : 'AI will tailor the new resume keeping your real name, experience, skills and education from the selected resume.'}
                </p>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Source Profile</label>
                  <select
                    className="form-select"
                    value={smartMerge ? 'smart-merge' : selectedBaseId}
                    onChange={e => handleBaseChange(e.target.value)}
                  >
                    <option value="smart-merge">✨ Smart Merge (All Starred Resumes)</option>
                    {vaultResumes.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.isFavorite ? '⭐ ' : ''}{r.data?.name || r.fileName || 'Resume'} — {r.jobTitle || r.source}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Profile preview */}
                {(selectedResume || smartMerge) && (
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', padding: 14, fontSize: 12 }}>
                    {smartMerge ? (
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ fontSize: 24 }}>🧠</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>Cross-Resume Intelligence</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                            Merging {vaultResumes.filter(r => r.isFavorite).length || vaultResumes.length} source profiles
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: 'var(--gradient-hero)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, flexShrink: 0,
                        }}>
                          {selectedResume.source === 'manual-upload' ? '📄' : '🤖'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>
                            {baseProfile?.name || selectedResume.data?.name || selectedResume.fileName}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                            {selectedResume.source === 'manual-upload' ? 'Uploaded Resume' : 'AI-Generated'}
                          </div>
                        </div>
                      </div>
                    )}

                    {baseProfile ? (
                      <>
                        {baseProfile.contact?.email && (
                          <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
                            📧 {baseProfile.contact.email}
                            {baseProfile.contact?.location && ` · 📍 ${baseProfile.contact.location}`}
                          </div>
                        )}
                        {baseProfile.skills?.technical?.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>Skills detected:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {baseProfile.skills.technical.slice(0, 8).map(s => (
                                <span key={s} className="tag tag-primary" style={{ fontSize: 10 }}>{s}</span>
                              ))}
                              {baseProfile.skills.technical.length > 8 && (
                                <span className="tag tag-primary" style={{ fontSize: 10 }}>+{baseProfile.skills.technical.length - 8} more</span>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--accent-amber)', marginTop: 8 }}>
                        <span className="spinner" style={{ borderColor: 'rgba(245,158,11,0.3)', borderTopColor: 'var(--accent-amber)', width: 14, height: 14 }} />
                        <span>Extracting profile from your resume... Refresh in a few seconds.</span>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Link href="/resume-vault" className="btn btn-ghost btn-sm">
                    📤 Upload Another
                  </Link>
                  {selectedResume?.source === 'manual-upload' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={reExtractProfile}
                      disabled={extracting}
                    >
                      {extracting
                        ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Extracting...</>
                        : '🔄 Re-extract Profile'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* PREVIEW STEP */
          <div className="flex-col" style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setStep('input')}>← Back to Edit JD</button>
              <div style={{ flex: 1 }} />
              <button 
                className={`btn ${isEditing ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? '✅ Done Editing' : '✏️ Live Edit'}
              </button>
              <button className="btn btn-primary" onClick={handlePrint}>🖨️ Print PDF</button>
              <button className="btn btn-primary" onClick={() => downloadAsDocx(result)}>📄 Download DOCX</button>
            </div>

            {isEditing && (
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                💡 <strong>Edit Mode Active:</strong> You can click on any text below to change it!
              </div>
            )}

            <div 
              className="resume-preview-container" 
              style={{ 
                background: 'white', color: '#000', padding: '0.5in', margin: '0 auto',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)', width: '8.5in', minHeight: '11in',
                border: isEditing ? '2px dashed var(--accent-primary)' : 'none',
                fontFamily: '"Open Sans", sans-serif',
                lineHeight: 1.4,
                boxSizing: 'border-box'
              }}
            >
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <h1 
                  contentEditable={isEditing} 
                  suppressContentEditableWarning
                  style={{ fontFamily: '"Merriweather", serif', fontSize: 28, fontWeight: 900, marginBottom: 4, outline: 'none', textTransform: 'uppercase', letterSpacing: '1px', color: '#000' }}
                >
                  {result.data?.name}
                </h1>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: 11, color: '#333', flexWrap: 'wrap' }}>
                  <span contentEditable={isEditing} suppressContentEditableWarning>{result.data?.contact?.email}</span>
                  <span>|</span>
                  <span contentEditable={isEditing} suppressContentEditableWarning>{result.data?.contact?.phone}</span>
                  <span>|</span>
                  <span contentEditable={isEditing} suppressContentEditableWarning>{result.data?.contact?.location}</span>
                  <span>|</span>
                  <span contentEditable={isEditing} suppressContentEditableWarning>{result.data?.contact?.linkedin?.replace('https://', '')}</span>
                </div>
              </div>

              {/* Summary */}
              {result.data?.summary && (
              <div className="section" style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: '"Merriweather", serif', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: '#000', borderBottom: '1px solid #000', paddingBottom: 2, marginBottom: 10 }}>
                  Professional Summary
                </div>
                <p 
                  contentEditable={isEditing}
                  suppressContentEditableWarning
                  style={{ fontSize: 12, outline: 'none', textAlign: 'justify', color: '#222', margin: 0 }}
                >
                  {result.data?.summary}
                </p>
              </div>
              )}

              {/* Skills */}
              <div className="section" style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: '"Merriweather", serif', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: '#000', borderBottom: '1px solid #000', paddingBottom: 2, marginBottom: 10 }}>
                  Skills & Competencies
                </div>
                <div style={{ fontSize: 12, color: '#222' }}>
                  <div style={{ marginBottom: 4 }}>
                    <strong>Technical Skills:</strong> <span contentEditable={isEditing} suppressContentEditableWarning>{result.data?.skills?.technical?.join(', ')}</span>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <strong>Tools & Technologies:</strong> <span contentEditable={isEditing} suppressContentEditableWarning>{result.data?.skills?.tools?.join(', ')}</span>
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <strong>Core Competencies:</strong> <span contentEditable={isEditing} suppressContentEditableWarning>{result.data?.skills?.soft?.join(', ')}</span>
                  </div>
                </div>
              </div>

              {/* Experience */}
              <div className="section" style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: '"Merriweather", serif', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: '#000', borderBottom: '1px solid #000', paddingBottom: 2, marginBottom: 10 }}>
                  Professional Experience
                </div>
                {result.data?.experience?.map((exp, idx) => (
                  <div key={idx} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span contentEditable={isEditing} suppressContentEditableWarning style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{exp.role}</span>
                      <span contentEditable={isEditing} suppressContentEditableWarning style={{ fontSize: 13, color: '#111', fontWeight: 700 }}>{exp.duration}</span>
                    </div>
                    <div contentEditable={isEditing} suppressContentEditableWarning style={{ fontSize: 13, color: '#333', fontStyle: 'italic', marginBottom: 4 }}>
                      {exp.company} {exp.location && `, ${exp.location}`}
                    </div>
                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                      {exp.bullets?.map((bullet, bIdx) => (
                        <li 
                          key={bIdx} 
                          contentEditable={isEditing}
                          suppressContentEditableWarning
                          style={{ fontSize: 12, marginBottom: 3, outline: 'none', color: '#222' }}
                        >
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Projects */}
              {result.data?.projects?.length > 0 && (
              <div className="section" style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: '"Merriweather", serif', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: '#000', borderBottom: '1px solid #000', paddingBottom: 2, marginBottom: 10 }}>
                  Key Projects
                </div>
                {result.data?.projects?.map((p, idx) => (
                  <div key={idx} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span contentEditable={isEditing} suppressContentEditableWarning style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{p.name}</span>
                      <span contentEditable={isEditing} suppressContentEditableWarning style={{ fontSize: 11, color: '#111' }}>{p.link?.replace('https://', '')}</span>
                    </div>
                    <div contentEditable={isEditing} suppressContentEditableWarning style={{ fontSize: 12, color: '#222', marginTop: 2 }}>
                      {p.description}
                    </div>
                    {p.tech && (
                      <div contentEditable={isEditing} suppressContentEditableWarning style={{ fontStyle: 'italic', fontSize: 11, color: '#444', marginTop: 2 }}>
                        Technologies: {p.tech.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              )}

              {/* Education */}
              <div className="section">
                <div style={{ fontFamily: '"Merriweather", serif', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: '#000', borderBottom: '1px solid #000', paddingBottom: 2, marginBottom: 10 }}>
                  Education
                </div>
                {result.data?.education?.map((edu, idx) => (
                  <div key={idx} style={{ marginBottom: 6, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span contentEditable={isEditing} suppressContentEditableWarning style={{ fontWeight: 700, color: '#111' }}>{edu.institution}</span>
                      <span contentEditable={isEditing} suppressContentEditableWarning style={{ color: '#111', fontWeight: 700 }}>{edu.year}</span>
                    </div>
                    <div contentEditable={isEditing} suppressContentEditableWarning style={{ color: '#222', fontStyle: 'italic' }}>
                      {edu.degree} {edu.cgpa && `| CGPA: ${edu.cgpa}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function buildResumeHTML(d) {
  if (!d) return '';
  const c = d.contact || {};
  const contact = [
    c.email ? `<span>${c.email}</span>` : '',
    c.phone ? `<span>${c.phone}</span>` : '',
    c.location ? `<span>${c.location}</span>` : '',
    c.linkedin ? `<span>${c.linkedin.replace('https://', '')}</span>` : '',
    c.github ? `<span>${c.github.replace('https://', '')}</span>` : ''
  ].filter(Boolean).join(' | ');

  const skills = d.skills ? Object.entries(d.skills).map(([k, v]) => `
    <div style="margin-bottom: 4px;">
      <strong style="text-transform: capitalize;">${k === 'technical' ? 'Technical Skills' : k === 'soft' ? 'Core Competencies' : 'Tools & Technologies'}:</strong> 
      ${Array.isArray(v) ? v.join(', ') : v}
    </div>
  `).join('') : '';

  const exp = (d.experience || []).map(e => `
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; color: #111;">
        <span>${e.role || ''}</span>
        <span>${e.duration || ''}</span>
      </div>
      <div style="font-style: italic; font-size: 13px; color: #333; margin-bottom: 4px;">
        ${e.company || ''}${e.location ? `, ${e.location}` : ''}
      </div>
      <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #222;">
        ${e.bullets ? e.bullets.map(b => `<li style="margin-bottom: 3px;">${b}</li>`).join('') : ''}
      </ul>
    </div>`).join('');

  const proj = (d.projects || []).map(p => `
    <div style="margin-bottom: 10px;">
      <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; color: #111;">
        <span>${p.name || ''}</span>
        ${p.link ? `<span style="font-weight: normal; font-size: 11px;">${p.link.replace('https://', '')}</span>` : ''}
      </div>
      <div style="font-size: 12px; color: #222; margin-top: 2px;">
        ${p.description || ''}
      </div>
      ${p.tech ? `<div style="font-style: italic; font-size: 11px; color: #444; margin-top: 2px;">Technologies: ${p.tech.join(', ')}</div>` : ''}
    </div>`).join('');

  return `
    <html>
    <head>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700;900&family=Open+Sans:wght@400;600;700&display=swap');
        
        body { 
          font-family: 'Open Sans', sans-serif; 
          color: #000; 
          line-height: 1.4; 
          padding: 0; 
          margin: 0;
          background: #fff;
        }
        
        .resume-page {
          max-width: 8.5in; /* Standard US Letter width */
          margin: 0 auto;
          background: #fff;
          box-sizing: border-box;
        }
        
        .header { 
          text-align: center; 
          margin-bottom: 16px; 
        }
        
        .name { 
          font-family: 'Merriweather', serif;
          color: #000; 
          font-size: 28px; 
          font-weight: 900; 
          text-transform: uppercase; 
          letter-spacing: 1px; 
          margin: 0 0 4px 0; 
        }
        
        .contact { 
          font-size: 11px; 
          color: #333; 
        }
        
        .section { 
          margin-bottom: 16px; 
        }
        
        .section-title { 
          font-family: 'Merriweather', serif;
          font-size: 14px; 
          font-weight: 700; 
          color: #000; 
          text-transform: uppercase; 
          border-bottom: 1px solid #000; 
          padding-bottom: 2px; 
          margin-bottom: 10px; 
        }
      </style>
    </head>
    <body>
      <div class="resume-page">
        <div class="header">
          <h1 class="name">${d.name || 'RESUME'}</h1>
          <div class="contact">${contact}</div>
        </div>

        ${d.summary ? `
        <div class="section">
          <div class="section-title">Professional Summary</div>
          <div style="font-size: 12px; text-align: justify; color: #222;">${d.summary}</div>
        </div>` : ''}

        ${skills ? `
        <div class="section">
          <div class="section-title">Skills & Competencies</div>
          <div style="font-size: 12px; color: #222;">${skills}</div>
        </div>` : ''}

        ${exp ? `
        <div class="section">
          <div class="section-title">Professional Experience</div>
          ${exp}
        </div>` : ''}

        ${proj ? `
        <div class="section">
          <div class="section-title">Key Projects</div>
          ${proj}
        </div>` : ''}

        ${d.education && d.education.length > 0 ? `
        <div class="section">
          <div class="section-title">Education</div>
          ${d.education.map(e => `
            <div style="margin-bottom: 6px; font-size: 13px;">
              <div style="display: flex; justify-content: space-between; font-weight: 700; color: #111;">
                <span>${e.institution}</span>
                <span>${e.year}</span>
              </div>
              <div style="color: #222; font-style: italic;">
                ${e.degree} ${e.cgpa ? ' | CGPA: ' + e.cgpa : ''}
              </div>
            </div>
          `).join('')}
          ${d.certifications && d.certifications.length > 0 ? `
            <div style="margin-top: 6px; font-size: 12px; color: #222;">
              <strong>Certifications:</strong> ${d.certifications.join(', ')}
            </div>
          ` : ''}
        </div>` : ''}
      </div>
    </body>
    </html>
  `;
}
