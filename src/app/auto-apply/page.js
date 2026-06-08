'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const SOURCE_COLORS = {
  serper: '#3b82f6', adzuna: '#10b981', jsearch: '#8b5cf6',
};

const EXP_OPTIONS = ['fresher', '0-1', '0-2', '2-5', '5+'];

const STATUS_COLORS = {
  pending: '#666', matched: '#3b82f6', prepared: '#f59e0b',
  applied: '#10b981', failed: '#ef4444', skipped: '#888',
};

function Spinner({ size = 14 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `2px solid rgba(255,255,255,0.3)`,
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spinner 0.6s linear infinite',
    }} />
  );
}

export default function AutoApplyPage() {
  const [targetRole, setTargetRole] = useState('');
  const [targetLocation, setTargetLocation] = useState('India');
  const [experienceLevels, setExperienceLevels] = useState([]);
  const [activeTab, setActiveTab] = useState('picture');
  const [resumes, setResumes] = useState([]);
  const [selectedResume, setSelectedResume] = useState('');
  const [dailyCap, setDailyCap] = useState(50);
  const [stepMode, setStepMode] = useState(true);
  const [engineState, setEngineState] = useState({ active: false, run: null });
  const [polling, setPolling] = useState(false);

  const [pictureFiles, setPictureFiles] = useState([]);
  const [picturePreviews, setPicturePreviews] = useState([]);
  const [pictureState, setPictureState] = useState({ active: false, steps: [], logs: [], result: null });
  const [picturePolling, setPicturePolling] = useState(false);
  const [useAiResume, setUseAiResume] = useState(false);

  const [emailSyncState, setEmailSyncState] = useState({ syncing: false, hasGoogle: false, message: '', lastSync: null, updates: [] });
  const [emailPolling, setEmailPolling] = useState(false);

  useEffect(() => {
    fetch('/api/resumes').then(r => r.json()).then(data => {
      const list = Array.isArray(data) ? data : data?.resumes || data?.data || [];
      setResumes(list);
      if (list.length > 0) setSelectedResume(list[0].id);
    }).catch(() => {});

    fetch('/api/jobs').then(r => r.json()).then(data => {
      setEmailSyncState(prev => ({ ...prev, hasGoogle: data.hasGoogle || false }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let timer;
    if (polling) {
      timer = setInterval(async () => {
        try {
          const res = await fetch('/api/auto-apply/status');
          const data = await res.json();
          setEngineState(data);
          if (!data.active) setPolling(false);
        } catch {}
      }, 3000);
    }
    return () => clearInterval(timer);
  }, [polling]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auto-apply/status');
      const data = await res.json();
      setEngineState(data);
      if (data.active) setPolling(true);
    } catch {}
  }, []);

  useEffect(() => {
    let timer;
    if (picturePolling) {
      timer = setInterval(async () => {
        try {
          const res = await fetch('/api/auto-apply/picture-status');
          const data = await res.json();
          setPictureState(data);
          if (!data.active) setPicturePolling(false);
        } catch {}
      }, 2000);
    }
    return () => clearInterval(timer);
  }, [picturePolling]);

  // Auto-poll emails every hour
  useEffect(() => {
    if (!emailSyncState.hasGoogle) return;
    handleEmailSync();
    const timer = setInterval(handleEmailSync, 3600000);
    return () => clearInterval(timer);
  }, [emailSyncState.hasGoogle]);

  const handleEmailSync = async () => {
    if (!emailSyncState.hasGoogle || emailSyncState.syncing) return;
    setEmailSyncState(prev => ({ ...prev, syncing: true, message: '' }));
    try {
      const res = await fetch('/api/auto-apply/email-sync', { method: 'POST' });
      const data = await res.json();
      if (res.status === 401 && data.reauth) {
        setEmailSyncState(prev => ({ ...prev, syncing: false, hasGoogle: false, message: 'Google token expired. Reconnect in Job Tracker.' }));
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setEmailSyncState(prev => ({
        ...prev, syncing: false, message: data.message, lastSync: new Date().toISOString(),
        updates: [...(data.updates || []), ...prev.updates].slice(0, 50),
      }));
    } catch (err) {
      setEmailSyncState(prev => ({ ...prev, syncing: false, message: err.message }));
    }
  };

  const toggleExp = (level) => {
    setExperienceLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const handlePictureFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const oversized = files.some(f => f.size > 10 * 1024 * 1024);
    if (oversized) { alert('Each image must be under 10MB'); return; }
    setPictureFiles(files);
    const readers = files.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then(setPicturePreviews);
  };

  const removePicture = (idx) => {
    setPictureFiles(prev => prev.filter((_, i) => i !== idx));
    setPicturePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePictureSubmit = async () => {
    if (pictureFiles.length === 0 || picturePreviews.length === 0) return;

    const images = picturePreviews.map(preview => {
      const [meta, base64] = preview.split(',');
      const mm = meta.match(/data:([^;]+);/);
      return { base64, mimeType: mm ? mm[1] : 'image/png' };
    });

    await fetch('/api/auto-apply/picture', { method: 'DELETE' });

    setPictureState({ active: true, steps: [], logs: [], result: null });
    setPicturePolling(true);

    try {
      const res = await fetch('/api/auto-apply/picture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, resumeId: selectedResume, useAiResume }),
      });
      const data = await res.json();
      if (data.error) {
        setPictureState({ active: false, steps: [], logs: [], result: { error: data.error } });
        setPicturePolling(false);
      } else {
        const timer = setInterval(async () => {
          try {
            const s = await fetch('/api/auto-apply/picture-status');
            const sd = await s.json();
            if (!sd.active) { clearInterval(timer); setPicturePolling(false); }
            setPictureState(sd);
          } catch {}
        }, 2000);
      }
    } catch (err) {
      setPictureState({ active: false, steps: [], logs: [], result: { error: err.message } });
      setPicturePolling(false);
    }
  };

  const handlePictureReset = async () => {
    await fetch('/api/auto-apply/picture', { method: 'DELETE' });
    setPictureState({ active: false, steps: [], logs: [], result: null });
    setPictureFiles([]);
    setPicturePreviews([]);
    setPicturePolling(false);
  };

  const handleStart = async () => {
    if (!targetRole || !selectedResume) return;
    try {
      const res = await fetch('/api/auto-apply/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetRole, targetLocation, experienceLevels,
          resumeId: selectedResume, dailyCap, stepMode,
        }),
      });
      const data = await res.json();
      if (data.run) {
        setEngineState({ active: true, run: data.run });
        setPolling(true);
        setActiveTab('pipeline');
      }
    } catch (err) {
      console.error('Start failed:', err);
    }
  };

  const handleStop = async () => {
    await fetch('/api/auto-apply/stop', { method: 'POST' });
    setEngineState({ active: false, run: null });
    setPolling(false);
  };

  const engineRunning = engineState.active && engineState.run?.status === 'running';
  const enginePaused = engineState.active && engineState.run?.status === 'paused';
  const run = engineState.run;

  const renderPictureTab = () => {
    const { steps, logs, result, active } = pictureState;

    const hasPreviews = picturePreviews.length > 0;

    const renderSteps = () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map(step => {
          const color = step.status === 'success' ? '#10b981' :
                        step.status === 'error' ? '#ef4444' :
                        step.status === 'active' ? '#3b82f6' :
                        step.status === 'skipped' ? '#888' : '#444';
          const icon = step.status === 'success' ? '✓' :
                       step.status === 'error' ? '✕' :
                       step.status === 'active' ? '●' :
                       step.status === 'skipped' ? '–' : '○';
          return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 6, background: '#13131a', border: `1px solid ${step.status === 'active' ? color : '#2a2a3a'}` }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: `${color}20`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{icon}</span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0' }}>{step.label}</span>
                {step.message && <span style={{ fontSize: 11, color: '#888' }}>{step.message}</span>}
              </div>
              {step.status === 'active' && <Spinner size={14} />}
            </div>
          );
        })}
      </div>
    );

    const uploadArea = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '50px 20px', borderRadius: 10, border: '2px dashed #2a2a3a', background: '#13131a', cursor: 'pointer' }}>
          <div style={{ fontSize: 48 }}>📸</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#e0e0e0' }}>{hasPreviews ? 'Add More Screenshots' : 'Upload Job Screenshots'}</div>
          <div style={{ fontSize: 12, color: '#888', textAlign: 'center', maxWidth: 400 }}>
            AI will extract the job title, company, and visible HR email from each screenshot, then send your application.
          </div>
          <div style={{ fontSize: 11, color: '#555' }}>PNG, JPG · multiple allowed · 10MB max each</div>
          <input type="file" multiple accept="image/*" onChange={handlePictureFiles} style={{ display: 'none' }} />
        </label>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#888' }}>Resume to Use</label>
            <select value={selectedResume} onChange={e => setSelectedResume(e.target.value)}
              style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #2a2a3a', background: '#0a0a0f', color: '#e0e0e0', fontSize: 13, outline: 'none' }}>
              {resumes.length === 0 && <option value="">No resumes</option>}
              {resumes.map(r => (
                <option key={r.id} value={r.id}>{r.fileName || r.name || r.data?.name || `Resume ${r.id?.slice(0, 6)}`}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', flex: '1 1 180px' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 38, gap: 6, fontSize: 12, color: '#aaa', cursor: 'pointer', padding: '0 12px', borderRadius: 6, border: `1px solid ${useAiResume ? '#3b82f6' : '#2a2a3a'}`, background: useAiResume ? 'rgba(59,130,246,0.1)' : 'transparent', boxSizing: 'border-box' }}>
              <input type="checkbox" checked={useAiResume} onChange={e => setUseAiResume(e.target.checked)} style={{ accentColor: '#3b82f6' }} />
              ✨ AI-Tailored Resume
            </label>
          </div>
        </div>
      </div>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {!hasPreviews && steps.length === 0 && uploadArea}

        {hasPreviews && !active && steps.length === 0 && (
          <>
            {uploadArea}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {picturePreviews.map((preview, idx) => (
                <div key={idx} style={{ position: 'relative', width: 120, height: 90, borderRadius: 6, overflow: 'hidden', border: '1px solid #2a2a3a', flexShrink: 0 }}>
                  <img src={preview} alt={`Job ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => removePicture(idx)} style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  <span style={{ position: 'absolute', bottom: 2, left: 2, fontSize: 9, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>#{idx + 1}</span>
                </div>
              ))}
            </div>
            <button onClick={handlePictureSubmit} disabled={!selectedResume || picturePolling}
              style={{ height: 44, padding: '0 28px', borderRadius: 8, border: 'none', background: (!selectedResume || picturePolling) ? '#1e3a5f' : '#10b981', color: '#fff', fontSize: 14, fontWeight: 600, cursor: (!selectedResume || picturePolling) ? 'not-allowed' : 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
              {picturePolling ? <Spinner /> : null}
              {picturePolling ? 'Processing...' : `🚀 Apply ${pictureFiles.length} Image${pictureFiles.length > 1 ? 's' : ''}`}
            </button>
          </>
        )}

        {steps.length > 0 && (
          <>
            {hasPreviews && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {picturePreviews.map((preview, idx) => (
                  <div key={idx} style={{ width: 80, height: 60, borderRadius: 4, overflow: 'hidden', border: '1px solid #2a2a3a' }}>
                    <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}
            {renderSteps()}

            {result && (
              <div style={{ padding: '16px 20px', borderRadius: 10, background: '#13131a', border: '1px solid #2a2a3a', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>
                  {result.applied ? '✅ APPLIED' : result.skipped ? '⏭️ SKIPPED' : result.error ? '❌ ERROR' : 'RESULT'}
                </div>
                {result.job && (
                  <>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0' }}>{result.job.title}</div>
                    <div style={{ fontSize: 13, color: '#aaa' }}>💼 {result.job.company || 'Unknown'} · 📍 {result.job.location || 'Remote'}</div>
                  </>
                )}
                {result.email && <div style={{ fontSize: 12, color: '#3b82f6' }}>✉️ {result.email}</div>}
                {result.applied && <div style={{ marginTop: 4, padding: 8, borderRadius: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontSize: 13 }}>✅ Application sent to {result.email}</div>}
                {result.skipped && <div style={{ marginTop: 4, padding: 8, borderRadius: 6, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', fontSize: 13 }}>⏭️ {result.reason}</div>}
                {result.error && <div style={{ marginTop: 4, padding: 8, borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13 }}>❌ {result.error}</div>}
              </div>
            )}

            {result?.results && result.results.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontSize: 13 }}>✅ {result.applied} applied</div>
                <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13 }}>❌ {result.failed} failed</div>
                <div style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid #2a2a3a', fontSize: 13, color: '#aaa' }}>{result.total} total</div>
              </div>
            )}

            {logs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4 }}>Activity Log</div>
                {logs.slice(0, 20).map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 0', color: log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#10b981' : log.type === 'warning' ? '#f59e0b' : '#aaa' }}>
                    <span style={{ color: '#555', flexShrink: 0, width: 60 }}>{new Date(log.time).toLocaleTimeString()}</span>
                    <span style={{ fontWeight: 600, flexShrink: 0 }}>{log.title}</span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            )}

            {!active && (result?.applied || result?.skipped || result?.error || result?.results) && (
              <button onClick={handlePictureReset} style={{ height: 40, padding: '0 20px', borderRadius: 8, border: '1px solid #2a2a3a', background: 'transparent', color: '#3b82f6', fontSize: 13, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
                📸 Apply More Images
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  const renderPipelineTab = () => {
    const jobList = run?.jobs || [];

    const pendingJobs = jobList.filter(j => j.status === 'pending' || j.status === 'matched');
    const doneJobs = jobList.filter(j => j.status === 'applied' || j.status === 'failed' || j.status === 'skipped');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {!engineState.active ? (
          <div style={{ padding: '24px', borderRadius: 10, background: '#13131a', border: '1px solid #2a2a3a', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0' }}>Auto Apply Configuration</div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#888' }}>Target Role</label>
                <input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g. Software Developer"
                  style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #2a2a3a', background: '#0a0a0f', color: '#e0e0e0', fontSize: 13, outline: 'none' }} />
              </div>
              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#888' }}>Location</label>
                <input value={targetLocation} onChange={e => setTargetLocation(e.target.value)}
                  style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #2a2a3a', background: '#0a0a0f', color: '#e0e0e0', fontSize: 13, outline: 'none' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#888' }}>Resume</label>
                <select value={selectedResume} onChange={e => setSelectedResume(e.target.value)}
                  style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #2a2a3a', background: '#0a0a0f', color: '#e0e0e0', fontSize: 13, outline: 'none' }}>
                  {resumes.length === 0 && <option value="">No resumes found</option>}
                  {resumes.map(r => (
                    <option key={r.id} value={r.id}>{r.fileName || r.name || r.data?.name || `Resume ${r.id?.slice(0, 6)}`}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: '1 1 120px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#888' }}>Daily Cap</label>
                <input type="number" value={dailyCap} onChange={e => setDailyCap(Number(e.target.value))} min={1} max={200}
                  style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 6, border: '1px solid #2a2a3a', background: '#0a0a0f', color: '#e0e0e0', fontSize: 13, outline: 'none' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#aaa', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={stepMode} onChange={e => setStepMode(e.target.checked)} />
                Sequential (one-by-one)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#aaa', flexWrap: 'wrap' }}>
                <span>Experience:</span>
                {EXP_OPTIONS.map(l => (
                  <span key={l} onClick={() => toggleExp(l)} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer', border: `1px solid ${experienceLevels.includes(l) ? '#3b82f6' : '#2a2a3a'}`, background: experienceLevels.includes(l) ? 'rgba(59,130,246,0.12)' : 'transparent', color: experienceLevels.includes(l) ? '#3b82f6' : '#888' }}>{l}</span>
                ))}
              </label>
            </div>

            <button onClick={handleStart} disabled={!targetRole || !selectedResume}
              style={{ height: 40, padding: '0 24px', borderRadius: 8, border: 'none', background: (!targetRole || !selectedResume) ? '#1e3a5f' : '#10b981', color: '#fff', fontSize: 14, fontWeight: 600, cursor: (!targetRole || !selectedResume) ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}>
              🚀 Start Auto Apply
            </button>
          </div>
        ) : (
          <>
            <div style={{ padding: '16px 20px', borderRadius: 10, background: '#13131a', border: '1px solid #2a2a3a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: enginePaused ? '#f59e0b' : '#10b981', display: 'inline-block' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0' }}>{enginePaused ? '⏸️ Paused' : '▶️ Running'}</span>
                <span style={{ fontSize: 12, color: '#888' }}>{run.targetRole} · {run.targetLocation}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {engineRunning && (
                  <button onClick={async () => { await fetch('/api/auto-apply/pause', { method: 'POST' }); fetchStatus(); }} style={{ height: 34, padding: '0 16px', borderRadius: 6, border: '1px solid #f59e0b', background: 'transparent', color: '#f59e0b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    ⏸️ Pause
                  </button>
                )}
                {enginePaused && (
                  <button onClick={async () => { await fetch('/api/auto-apply/resume', { method: 'POST' }); fetchStatus(); }} style={{ height: 34, padding: '0 16px', borderRadius: 6, border: '1px solid #10b981', background: 'transparent', color: '#10b981', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    ▶️ Resume
                  </button>
                )}
                <button onClick={handleStop} style={{ height: 34, padding: '0 16px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  ⏹️ Stop
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[{ label: 'Searched', value: run.stats?.searched || 0, color: '#3b82f6' },
                { label: 'Scored', value: run.stats?.scored || 0, color: '#8b5cf6' },
                { label: 'Prepared', value: run.stats?.prepared || 0, color: '#f59e0b' },
                { label: 'Applied', value: run.stats?.applied || 0, color: '#10b981' },
                { label: 'Failed', value: run.stats?.failed || 0, color: '#ef4444' },
                { label: 'Skipped', value: run.stats?.skipped || 0, color: '#888' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, minWidth: 80, padding: '12px', borderRadius: 8, background: '#13131a', border: '1px solid #2a2a3a', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {jobList.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 4 }}>Jobs ({jobList.length})</div>
                {jobList.map((job, i) => (
                  <div key={job.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', borderRadius: 6, background: '#13131a', border: '1px solid #2a2a3a', fontSize: 13, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 200px', minWidth: 0 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[job.status] || '#666', flexShrink: 0 }} />
                      <span style={{ color: '#e0e0e0', fontWeight: job.status === 'pending' ? 400 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.title}</span>
                      <span style={{ color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{job.company}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                      {job.score > 0 && <span style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 600 }}>{job.score}%</span>}
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${STATUS_COLORS[job.status] || '#666'}20`, color: STATUS_COLORS[job.status] || '#666' }}>{job.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {run?.logs && run.logs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 2 }}>Logs</div>
                {run.logs.slice(0, 30).map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', color: log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#10b981' : log.type === 'warning' ? '#f59e0b' : '#aaa' }}>
                    <span style={{ color: '#555', flexShrink: 0, width: 60 }}>{new Date(log.time).toLocaleTimeString()}</span>
                    <span style={{ fontWeight: 600, flexShrink: 0 }}>{log.title}</span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            )}

            {pendingJobs.length === 0 && doneJobs.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', borderRadius: 8, border: '1px dashed #2a2a3a' }}>
                <div style={{ fontSize: 14, color: '#888' }}>Searching for jobs...</div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const [historyState, setHistoryState] = useState({ jobs: [], loading: false });
  const [historyFilters, setHistoryFilters] = useState({ role: '', company: '', email: '', status: 'all', dateFrom: '', dateTo: '' });

  useEffect(() => {
    if (activeTab === 'history') {
      setHistoryState(prev => ({ ...prev, loading: true }));
      fetch('/api/jobs').then(r => r.json()).then(data => {
        setHistoryState({ jobs: data.jobs || [], loading: false });
      }).catch(() => setHistoryState(prev => ({ ...prev, loading: false })));
    }
  }, [activeTab]);

  const renderHistoryTab = () => {
    const { jobs, loading } = historyState;
    const { role, company, email, status, dateFrom, dateTo } = historyFilters;

    const filtered = jobs.filter(j => {
      if (role && !(`${j.title || ''} ${j.role || ''}`).toLowerCase().includes(role.toLowerCase())) return false;
      if (company && !(`${j.company || ''}`).toLowerCase().includes(company.toLowerCase())) return false;
      if (email && !(`${j.appliedEmail || ''}`).toLowerCase().includes(email.toLowerCase())) return false;
      if (status === 'opened') { if (!j.emailOpened) return false; }
      else if (status === 'waiting') { if (j.emailOpened) return false; }
      if (dateFrom && new Date(j.dateApplied || j.createdAt) < new Date(dateFrom)) return false;
      if (dateTo && new Date(j.dateApplied || j.createdAt) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const openedCount = jobs.filter(j => j.emailOpened).length;
    const waitingCount = jobs.filter(j => !j.emailOpened).length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[{ label: 'Total Applied', value: jobs.length, color: '#3b82f6' },
            { label: 'Email Opened', value: openedCount, color: '#10b981' },
            { label: 'Waiting', value: waitingCount, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, minWidth: 100, padding: '14px 16px', borderRadius: 8, background: '#13131a', border: '1px solid #2a2a3a', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '12px 16px', borderRadius: 8, background: '#13131a', border: '1px solid #2a2a3a' }}>
          <input value={role} onChange={e => setHistoryFilters(p => ({ ...p, role: e.target.value }))} placeholder="Role..." style={{ flex: '1 1 130px', height: 34, padding: '0 10px', borderRadius: 6, border: '1px solid #2a2a3a', background: '#0a0a0f', color: '#e0e0e0', fontSize: 12, outline: 'none' }} />
          <input value={company} onChange={e => setHistoryFilters(p => ({ ...p, company: e.target.value }))} placeholder="Company..." style={{ flex: '1 1 120px', height: 34, padding: '0 10px', borderRadius: 6, border: '1px solid #2a2a3a', background: '#0a0a0f', color: '#e0e0e0', fontSize: 12, outline: 'none' }} />
          <input value={email} onChange={e => setHistoryFilters(p => ({ ...p, email: e.target.value }))} placeholder="HR email..." style={{ flex: '1 1 150px', height: 34, padding: '0 10px', borderRadius: 6, border: '1px solid #2a2a3a', background: '#0a0a0f', color: '#e0e0e0', fontSize: 12, outline: 'none' }} />
          <select value={status} onChange={e => setHistoryFilters(p => ({ ...p, status: e.target.value }))} style={{ flex: '1 1 100px', height: 34, padding: '0 10px', borderRadius: 6, border: '1px solid #2a2a3a', background: '#0a0a0f', color: '#e0e0e0', fontSize: 12, outline: 'none' }}>
            <option value="all">All</option>
            <option value="opened">✅ Opened</option>
            <option value="waiting">⏳ Waiting</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => setHistoryFilters(p => ({ ...p, dateFrom: e.target.value }))} style={{ flex: '1 1 120px', height: 34, padding: '0 10px', borderRadius: 6, border: '1px solid #2a2a3a', background: '#0a0a0f', color: '#e0e0e0', fontSize: 12, outline: 'none' }} />
          <span style={{ color: '#555', fontSize: 12 }}>to</span>
          <input type="date" value={dateTo} onChange={e => setHistoryFilters(p => ({ ...p, dateTo: e.target.value }))} style={{ flex: '1 1 120px', height: 34, padding: '0 10px', borderRadius: 6, border: '1px solid #2a2a3a', background: '#0a0a0f', color: '#e0e0e0', fontSize: 12, outline: 'none' }} />
        </div>

        {loading && <div style={{ padding: '40px 0', textAlign: 'center' }}><Spinner size={20} /><div style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Loading...</div></div>}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center', borderRadius: 8, border: '1px dashed #2a2a3a' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: 14, color: '#888' }}>No applications found</div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(job => {
              const isOpened = job.emailOpened;
              const openCount = job.emailOpenCount || 0;
              return (
                <div key={job.id} style={{ padding: '14px 18px', borderRadius: 8, background: '#13131a', border: `1px solid ${isOpened ? 'rgba(16,185,129,0.3)' : '#2a2a3a'}`, borderLeft: `3px solid ${isOpened ? '#10b981' : '#666'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0' }}>{job.title || job.role}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isOpened ? (
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 600 }}>👁️ Opened {openCount > 1 ? `(${openCount}x)` : ''}</span>
                      ) : (
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 600 }}>⏳ Waiting</span>
                      )}
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>{job.source || 'manual'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#888', marginTop: 6, flexWrap: 'wrap' }}>
                    <span>💼 {job.company}</span>
                    {job.appliedEmail && <span>✉️ {job.appliedEmail}</span>}
                    <span>📅 {new Date(job.dateApplied || job.createdAt).toLocaleDateString()}</span>
                    <span>📍 {job.location || 'Remote'}</span>
                  </div>
                  {isOpened && job.emailOpenedAt && (
                    <div style={{ fontSize: 11, color: '#10b981', marginTop: 6 }}>🕐 Last opened: {new Date(job.emailOpenedAt).toLocaleString()}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderEmailsTab = () => {
    const { hasGoogle, syncing, message, lastSync, updates } = emailSyncState;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderRadius: 8, background: '#13131a', border: '1px solid #2a2a3a', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ flex: '1 1 200px' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>📧 Personal Email Sync</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {hasGoogle
                ? (lastSync ? `Last sync: ${new Date(lastSync).toLocaleString()} · Auto-syncs every hour` : 'Ready to sync')
                : 'Connect Google in Job Tracker to enable email sync'}
            </div>
          </div>
          {hasGoogle ? (
            <button className="btn btn-secondary" onClick={handleEmailSync} disabled={syncing} style={{ height: 36, padding: '0 16px', fontSize: 13 }}>
              {syncing ? <><span className="spinner" /> Syncing...</> : '🔄 Sync Now'}
            </button>
          ) : (
            <a href="/api/google/auth" className="btn btn-primary" style={{ height: 36, padding: '0 16px', fontSize: 13, background: '#ea4335', borderColor: '#ea4335', color: '#fff', borderRadius: 6, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              ✉️ Connect Google
            </a>
          )}
        </div>

        {message && (
          <div style={{ padding: '10px 16px', borderRadius: 6, background: message.includes('expired') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${message.includes('expired') ? '#ef4444' : '#10b981'}`, fontSize: 13, color: message.includes('expired') ? '#ef4444' : '#10b981' }}>
            {message.includes('expired') ? '⚠️ ' : '✅ '}{message}
          </div>
        )}

        <div style={{ fontSize: 14, fontWeight: 600, color: '#ccc' }}>Recent Email Updates</div>

        {updates.length === 0 && !syncing && (
          <div style={{ padding: '40px 20px', textAlign: 'center', borderRadius: 8, border: '1px dashed #2a2a3a' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📬</div>
            <div style={{ fontSize: 14, color: '#888' }}>No job updates found yet. Sync to check your inbox.</div>
          </div>
        )}

        {updates.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {updates.map((u, i) => (
              <div key={i} style={{ padding: '12px 16px', borderRadius: 8, background: '#13131a', border: '1px solid rgba(16,185,129,0.2)', borderLeft: '3px solid #10b981' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0' }}>{u.title || u.role} @ {u.company}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span>📧 From: {u.from || 'unknown'}</span>
                  <span>📝 Subject: {u.subject || ''}</span>
                  <span>🎯 Status: {u.newStatus}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e0e0e0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Auto Apply</h1>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 8, border: '1px solid #2a2a3a',
            background: 'rgba(255,255,255,0.03)', color: '#e0e0e0', fontSize: 13,
            fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
          className="btn-ghost"
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = '#3b82f6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = '#2a2a3a'; }}
          >
            🏠 Home Dashboard
          </Link>
        </div>

        <div className="tabs-container" style={{ display: 'flex', gap: 0, borderBottom: '2px solid #2a2a3a', marginBottom: 24, overflowX: 'auto', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
          {[
            { key: 'picture', label: '📸 Picture Apply' },
            { key: 'pipeline', label: `🚀 Auto apply${run?.jobs ? ` (${run.jobs.length})` : ''}` },
            { key: 'emails', label: '📧 Personal Emails' },
            { key: 'history', label: '📋 History' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding: '10px 20px', fontSize: 14, fontWeight: 600, border: 'none', borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent', background: 'transparent', color: activeTab === tab.key ? '#e0e0e0' : '#666', cursor: 'pointer', marginBottom: -2, flexShrink: 0 }}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'picture' && renderPictureTab()}
        {activeTab === 'pipeline' && renderPipelineTab()}
        {activeTab === 'emails' && renderEmailsTab()}
        {activeTab === 'history' && renderHistoryTab()}
      </div>

      <style>{`
        @keyframes spinner { to { transform: rotate(360deg); } }
        input:focus, select:focus { border-color: #3b82f6 !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a0f; }
        ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 3px; }
        .tabs-container::-webkit-scrollbar { display: none; }
        .tabs-container { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>
    </div>
  );
}
