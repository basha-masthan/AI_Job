'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_KEY_DEFS = [
  { key: 'GROQ_API_KEY_1', label: 'Groq API Key 1 (Primary)', placeholder: 'gsk_...', type: 'password' },
  { key: 'GROQ_API_KEY_2', label: 'Groq API Key 2 (Rotation)', placeholder: 'gsk_...', type: 'password' },
  { key: 'GROQ_API_KEY_3', label: 'Groq API Key 3 (Rotation)', placeholder: 'gsk_...', type: 'password' },
  { key: 'GROQ_MODEL', label: 'Groq Model', placeholder: 'llama-3.3-70b-versatile', type: 'select', options: [
      { value: 'llama-3.3-70b-versatile', label: 'LLaMA 3.3 70B (Recommended - High IQ)' },
      { value: 'llama-3.1-8b-instant', label: 'LLaMA 3.1 8B (Massive Token Rate Limits)' },
      { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (Large 32K Context)' },
      { value: 'gemma2-9b-it', label: 'Gemma 2 9B (Fast & Balanced)' }
    ]
  },
  { key: 'OPENROUTER_API_KEY_1', label: 'OpenRouter API Key 1 (Primary)', placeholder: 'sk-or-...', type: 'password' },
  { key: 'OPENROUTER_API_KEY_2', label: 'OpenRouter API Key 2 (Rotation)', placeholder: 'sk-or-...', type: 'password' },
  { key: 'OPENROUTER_MODEL', label: 'OpenRouter Model', placeholder: 'openai/gpt-oss-120b:free', type: 'select', options: [
      { value: 'openai/gpt-oss-120b:free', label: 'GPT OSS 120B (Free)' },
      { value: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash (Top Tier)' },
      { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'LLaMA 3.3 70B (Free & Smart)' },
      { value: 'deepseek/deepseek-chat', label: 'DeepSeek V3 Chat' }
    ]
  },
  { key: 'CEREBRAS_API_KEY', label: 'Cerebras API Key', placeholder: 'csk-...', type: 'password' },
  { key: 'CEREBRAS_MODEL', label: 'Cerebras Model', placeholder: 'llama3.1-8b', type: 'select', options: [
      { value: 'llama3.1-8b', label: 'LLaMA 3.1 8B (Sub-second processing)' },
      { value: 'llama3.1-70b', label: 'LLaMA 3.1 70B (Deep Reasoning)' }
    ]
  },
  { key: 'GEMINI_API_KEY', label: 'Gemini API Key', placeholder: 'AIza...', type: 'password' },
  { key: 'HF_TOKEN', label: 'HuggingFace Token', placeholder: 'hf_...', type: 'password' },
  { key: 'TAVILY_API_KEY_1', label: 'Tavily API Key 1 (Primary)', placeholder: 'tvly-...', type: 'password' },
  { key: 'TAVILY_API_KEY_2', label: 'Tavily API Key 2 (Rotation)', placeholder: 'tvly-...', type: 'password' },
  { key: 'RAPIDAPI_KEY', label: 'RapidAPI Key', placeholder: '...', type: 'password' },
  { key: 'NYLAS_CLIENT_ID', label: 'Nylas Client ID', placeholder: '...', type: 'text' },
  { key: 'NYLAS_CLIENT_SECRET', label: 'Nylas Client Secret', placeholder: 'nyk_v0_...', type: 'password' },
  { key: 'GOOGLE_SEARCH_API_KEY', label: 'Google Search API Key', placeholder: 'AIza...', type: 'password' },
  { key: 'GOOGLE_SEARCH_CX', label: 'Google Search CX', placeholder: '...', type: 'text' },
];

const TASKS_FLOW = {
  resume_parser: {
    title: '📄 Resume Parser',
    description: 'Extracts comprehensive fields (skills, projects, experience, contact info) from raw resume files or pasted text.',
    steps: [
      {
        name: 'Step 1: Active Primary Dispatcher',
        type: 'dispatcher',
        desc: 'Uses the global Preferred AI Provider selected in settings.'
      },
      {
        name: 'Step 2: Fallback Route Sequence',
        type: 'fallback_chain',
        desc: 'If preferred fails, automatically loops remaining configured keys in order: HuggingFace -> Cerebras -> Groq -> OpenRouter -> Gemini.'
      },
      {
        name: 'Step 3: Direct Keyword Validation',
        type: 'final_fallback',
        desc: 'If all APIs fail or rate limit, throws exception advising manual paste/retry.'
      }
    ]
  },
  resume_tailoring: {
    title: '✨ Smart Resume Tailoring',
    description: 'Creates targeted, single-page, ATS-friendly PDF resumes optimized for specific Job Descriptions.',
    steps: [
      {
        name: 'Step 1: Active Primary Dispatcher',
        type: 'dispatcher',
        desc: 'Uses preferred provider (OpenRouter or HuggingFace) to handle long context prompts.'
      },
      {
        name: 'Step 2: ATS Fit Index Failover',
        type: 'fallback_chain',
        desc: 'Cascades down order: OpenRouter -> HuggingFace -> Groq -> Gemini -> Cerebras.'
      }
    ]
  },
  jd_matching: {
    title: '🎯 ATS Job Matcher',
    description: 'Compares user profile achievements with JD requirements to calculate match rates and missing skill recommendations.',
    steps: [
      {
        name: 'Step 1: Ultra-Fast Inference (Groq Rotation)',
        type: 'keys',
        provider: 'Groq',
        key_list: ['GROQ_API_KEY_1', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3'],
        desc: 'Primary path checks Groq keys sequentially on 429 rate limit errors.'
      },
      {
        name: 'Step 2: Global InvokeAI Dispatcher',
        type: 'dispatcher',
        desc: 'If all Groq keys fail, failover to preferred provider (e.g. OpenRouter or HuggingFace).'
      }
    ]
  },
  bulk_matching: {
    title: '🔍 Bulk Search Scorer',
    description: 'Score multiple JDs for a candidate profile in search results lists.',
    steps: [
      {
        name: 'Step 1: Ultra-Fast Inference (Groq Rotation)',
        type: 'keys',
        provider: 'Groq',
        key_list: ['GROQ_API_KEY_1', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3'],
        desc: 'Primary path checks Groq keys sequentially on 429 rate limit errors.'
      },
      {
        name: 'Step 2: Global InvokeAI Dispatcher',
        type: 'dispatcher',
        desc: 'If all Groq keys fail, failover to preferred provider (e.g. OpenRouter or HuggingFace).'
      }
    ]
  },
  email_ingestion: {
    title: '📧 Email Sync Parser',
    description: 'Reads Gmail application updates to auto-parse status changes (Applied -> Interview -> Offer -> Rejected).',
    steps: [
      {
        name: 'Step 1: Fast Cerebras Processing',
        type: 'single_key',
        provider: 'Cerebras',
        key: 'CEREBRAS_API_KEY',
        desc: 'Parses subject and snippets using ultrafast Cerebras Llama 3.1.'
      },
      {
        name: 'Step 2: Global InvokeAI Dispatcher',
        type: 'dispatcher',
        desc: 'If Cerebras fails, uses InvokeAI (OpenRouter/HuggingFace).'
      },
      {
        name: 'Step 3: In-House Keyword Fallback Matcher',
        type: 'final_fallback',
        desc: 'If all APIs fail, trigger local regex keyword system (failsafe: 100% offline success).'
      }
    ]
  },
  job_scraper: {
    title: '🕸️ Link Scraper & Detail Extractor',
    description: 'Extracts full details from target job description pages while checking for bot protection logins.',
    steps: [
      {
        name: 'Step 1: Fast Groq Rotation Engine',
        type: 'keys',
        provider: 'Groq',
        key_list: ['GROQ_API_KEY_1', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3'],
        desc: 'Tries Groq key rotation sequentially to fetch raw job JSON block.'
      },
      {
        name: 'Step 2: Global InvokeAI Dispatcher',
        type: 'dispatcher',
        desc: 'If Groq fails, falls back to the configured InvokeAI preferred provider.'
      }
    ]
  },
  application_toolkit: {
    title: '🧰 Toolkit Generator',
    description: 'Creates Cover Letters and interview answer templates tailored for a specific Job Description.',
    steps: [
      {
        name: 'Step 1: Groq Key Rotation',
        type: 'keys',
        provider: 'Groq',
        key_list: ['GROQ_API_KEY_1', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3'],
        desc: 'Generates responses using LLaMA 3.3 for high quality.'
      },
      {
        name: 'Step 2: Global InvokeAI Dispatcher',
        type: 'dispatcher',
        desc: 'If Groq fails, uses fallback preferred provider chain.'
      }
    ]
  }
};

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [selectedUserEmails, setSelectedUserEmails] = useState(null);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [apiKeys, setApiKeys] = useState({});
  const [savingKeys, setSavingKeys] = useState(false);
  const [keysMessage, setKeysMessage] = useState('');
  const [testResults, setTestResults] = useState(null);
  const [testingKeys, setTestingKeys] = useState(false);
  const [selectedTask, setSelectedTask] = useState('resume_parser');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then(d => {
        if (!d.success) throw new Error(d.error);
        setData(d);
        if (d.settings?.apiKeys) setApiKeys(d.settings.apiKeys);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  const handleSaveKeys = async () => {
    setSavingKeys(true);
    setKeysMessage('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKeys })
      });
      const result = await res.json();
      if (result.success) {
        setKeysMessage('API keys saved successfully!');
        setData({ ...data, settings: result.settings });
      } else {
        setKeysMessage('Error: ' + result.error);
      }
    } catch {
      setKeysMessage('Network error saving keys');
    } finally {
      setSavingKeys(false);
    }
  };

  const testAllKeys = async () => {
    setTestingKeys(true);
    setTestResults(null);
    try {
      const res = await fetch('/api/admin/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'all' })
      });
      const data = await res.json();
      if (data.success) setTestResults(data.results);
      else setTestResults({ error: data.error });
    } catch {
      setTestResults({ error: 'Network error testing keys' });
    } finally {
      setTestingKeys(false);
    }
  };

  const handleAIProviderChange = async (provider) => {
    if (provider === data.settings.activeAIProvider) return;
    
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeAIProvider: provider })
      });
      const result = await res.json();
      if (result.success) {
        setData({ ...data, settings: result.settings });
      } else {
        alert('Failed to update settings: ' + result.error);
      }
    } catch (err) {
      alert('Network error updating settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchUserEmails = async (email) => {
    setLoadingEmails(true);
    setSelectedUserEmails({ email, messages: [], error: '' });
    try {
      const res = await fetch(`/api/admin/user-emails?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSelectedUserEmails({ email, messages: data.emails || [], error: '' });
    } catch (err) {
      setSelectedUserEmails({ email, messages: [], error: err.message });
    } finally {
      setLoadingEmails(false);
    }
  };

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', color: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Minimal Admin Header */}
      <header style={{ padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #60a5fa, #c084fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>👑</div>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.5px' }}>JobHunt Admin</span>
        </div>
        <Link href="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Exit Admin Mode</Link>
      </header>

      <main style={{ padding: '40px', flex: 1, background: 'radial-gradient(circle at top right, rgba(30, 58, 138, 0.2), transparent 400px)', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        
        <div className="page-header" style={{ marginBottom: 40, paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex-between">
            <div>
              <h1 style={{ fontSize: 36, fontWeight: 800, background: 'linear-gradient(to right, #60a5fa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-1px' }}>
                Command Center
              </h1>
              <p style={{ color: '#94a3b8', fontSize: 15, marginTop: 8 }}>Global Platform Metrics & User Management</p>
            </div>
            <button className="btn" onClick={fetchData} style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: 12, backdropFilter: 'blur(10px)' }}>
              {loading ? '🔄 Syncing...' : '🔄 Refresh Data'}
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
            <span className="spinner" style={{ width: 40, height: 40, borderTopColor: '#60a5fa' }} />
          </div>
        ) : error ? (
          <div style={{ padding: 20, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 12, color: '#fca5a5' }}>
            ⚠️ Error loading admin data: {error}
          </div>
        ) : data && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            
            {/* AI Control Panel */}
            <div style={{ padding: 24, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>🧠</span> AI Engine Configuration
                  </h2>
                  <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 6, maxWidth: 600 }}>
                    Select the primary AI provider for resume parsing, building, and data extraction across the entire platform.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 12, background: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 16 }}>
                  <button 
                    onClick={() => handleAIProviderChange('huggingface')}
                    disabled={savingSettings}
                    style={{ 
                      padding: '10px 24px', 
                      borderRadius: 12, 
                      fontWeight: 600,
                      background: data.settings.activeAIProvider === 'huggingface' ? '#f59e0b' : 'transparent',
                      color: data.settings.activeAIProvider === 'huggingface' ? '#fff' : '#94a3b8',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                    HuggingFace (Recommended)
                  </button>
                  <button 
                    onClick={() => handleAIProviderChange('cerebras')}
                    disabled={savingSettings}
                    style={{ 
                      padding: '10px 24px', 
                      borderRadius: 12, 
                      fontWeight: 600,
                      background: data.settings.activeAIProvider === 'cerebras' ? '#06b6d4' : 'transparent',
                      color: data.settings.activeAIProvider === 'cerebras' ? '#fff' : '#94a3b8',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                    Cerebras
                  </button>
                  <button 
                    onClick={() => handleAIProviderChange('groq')}
                    disabled={savingSettings}
                    style={{ 
                      padding: '10px 24px', 
                      borderRadius: 12, 
                      fontWeight: 600,
                      background: data.settings.activeAIProvider === 'groq' ? '#f97316' : 'transparent',
                      color: data.settings.activeAIProvider === 'groq' ? '#fff' : '#94a3b8',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                    Groq
                  </button>
                  <button 
                    onClick={() => handleAIProviderChange('openrouter')}
                    disabled={savingSettings}
                    style={{ 
                      padding: '10px 24px', 
                      borderRadius: 12, 
                      fontWeight: 600,
                      background: data.settings.activeAIProvider === 'openrouter' ? '#3b82f6' : 'transparent',
                      color: data.settings.activeAIProvider === 'openrouter' ? '#fff' : '#94a3b8',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                    OpenRouter
                  </button>
                  <button 
                    onClick={() => handleAIProviderChange('gemini')}
                    disabled={savingSettings}
                    style={{ 
                      padding: '10px 24px', 
                      borderRadius: 12, 
                      fontWeight: 600,
                      background: data.settings.activeAIProvider === 'gemini' ? '#10b981' : 'transparent',
                      color: data.settings.activeAIProvider === 'gemini' ? '#fff' : '#94a3b8',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                    Google Gemini
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 24, display: 'flex', gap: 24 }}>
                 <div style={{ flex: 1, padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 12 }}>
                    <div style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Active Model Status</div>
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }}></span>
                      <span style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>
                        {data.settings.activeAIProvider === 'cerebras' ? 'Llama 3.1 8B (via Cerebras)' : data.settings.activeAIProvider === 'huggingface' ? 'DeepSeek V4 Pro (via HuggingFace)' : data.settings.activeAIProvider === 'groq' ? 'LLaMA 3.3 70B (via Groq)' : data.settings.activeAIProvider === 'openrouter' ? 'OpenAI GPT (via OpenRouter)' : 'Gemini 2.0 Flash (via Google)'}
                      </span>
                    </div>
                 </div>
              </div>
            </div>

            {/* AI Engine Flow & Failover Visualizer */}
            <div style={{ padding: 24, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 24 }}>🔄</span> AI Pipeline Flow & Failover Visualizer
              </h2>
              <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24, maxWidth: 800 }}>
                This interactive map traces how the JobHunt AI Engine manages primary processing and rotative failovers when APIs encounter rate-limits or outages.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, background: 'rgba(0,0,0,0.15)', padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.03)' }}>
                {/* Left Task Selection list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderRight: '1px solid rgba(255,255,255,0.06)', paddingRight: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>Select AI Workflow</div>
                  {[
                    { id: 'resume_parser', label: '📄 Resume Parser', provider: data.settings?.activeAIProvider || 'huggingface' },
                    { id: 'jd_matching', label: '🎯 ATS Job Matcher', provider: 'groq' },
                    { id: 'bulk_matching', label: '🔍 Bulk Search Scorer', provider: 'groq' },
                    { id: 'resume_tailoring', label: '✨ Smart Resume Builder', provider: data.settings?.activeAIProvider || 'huggingface' },
                    { id: 'email_ingestion', label: '📧 Email Sync Parser', provider: 'cerebras' },
                    { id: 'job_scraper', label: '🕸️ Scraper Detail Parser', provider: 'groq' },
                    { id: 'application_toolkit', label: '🧰 Toolkit Generator', provider: 'groq' },
                  ].map(item => {
                    const isActive = selectedTask === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedTask(item.id)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          padding: '12px 16px',
                          borderRadius: 10,
                          border: isActive ? '1px solid rgba(96,165,250,0.3)' : '1px solid transparent',
                          background: isActive ? 'rgba(59,130,246,0.1)' : 'transparent',
                          color: isActive ? '#60a5fa' : '#94a3b8',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          width: '100%',
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</span>
                        <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                          Starts: <span style={{ textTransform: 'uppercase', color: isActive ? '#93c5fd' : '#94a3b8' }}>{item.provider}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Right Interactive Pipeline Diagram */}
                <div style={{ padding: '4px 12px' }}>
                  {(() => {
                    const task = TASKS_FLOW[selectedTask];
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 16 }}>
                          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {task.title}
                          </h3>
                          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
                            {task.description}
                          </p>
                        </div>

                        {/* Pipeline Node Diagram */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative' }}>
                          {task.steps.map((step, index) => {
                            const isLast = index === task.steps.length - 1;
                            return (
                              <div key={index} style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
                                {/* Flow line graphics */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(96,165,250,0.1)', border: '2px solid #3b82f6', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyItems: 'center', fontSize: 12, fontWeight: 'bold', justifyContent: 'center' }}>
                                    {index + 1}
                                  </div>
                                  {!isLast && (
                                    <div style={{ flex: 1, width: 2, background: 'linear-gradient(to bottom, #3b82f6, rgba(59,130,246,0.1))', minHeight: 40, margin: '6px 0' }} />
                                  )}
                                </div>

                                {/* Step Card */}
                                <div style={{ flex: 1, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  <div>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{step.name}</span>
                                    <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{step.desc}</p>
                                  </div>

                                  {/* Render dispatcher details */}
                                  {step.type === 'dispatcher' && (
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                                      {['huggingface', 'cerebras', 'groq', 'openrouter', 'gemini'].map(pName => {
                                        const isPreferred = data.settings?.activeAIProvider === pName;
                                        const primaryKeyMap = {
                                          huggingface: 'HF_TOKEN',
                                          cerebras: 'CEREBRAS_API_KEY',
                                          groq: 'GROQ_API_KEY_1',
                                          openrouter: 'OPENROUTER_API_KEY_1',
                                          gemini: 'GEMINI_API_KEY'
                                        };
                                        const hasKey = data.activeKeys?.[primaryKeyMap[pName]] || false;
                                        return (
                                          <div
                                            key={pName}
                                            style={{
                                              padding: '6px 12px',
                                              borderRadius: 8,
                                              fontSize: 11,
                                              fontWeight: 600,
                                              background: isPreferred ? 'rgba(59,130,246,0.15)' : 'rgba(0,0,0,0.3)',
                                              border: isPreferred ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.06)',
                                              color: isPreferred ? '#60a5fa' : '#64748b',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 6,
                                            }}
                                          >
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isPreferred ? '#60a5fa' : hasKey ? '#10b981' : '#ef4444' }} />
                                            <span style={{ textTransform: 'capitalize' }}>{pName}</span>
                                            {isPreferred && <span style={{ fontSize: 9, background: '#3b82f6', color: '#fff', padding: '1px 4px', borderRadius: 4 }}>ACTIVE</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Render multi-key rotation track */}
                                  {step.type === 'keys' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                                        {step.key_list.map((keySlot, keyIdx) => {
                                          const hasKey = data.activeKeys?.[keySlot];
                                          return (
                                            <div key={keySlot} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                              <div
                                                style={{
                                                  padding: '8px 14px',
                                                  borderRadius: 10,
                                                  background: hasKey ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.05)',
                                                  border: hasKey ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.15)',
                                                  color: hasKey ? '#34d399' : '#f87171',
                                                  fontSize: 12,
                                                  fontWeight: 600,
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: 8,
                                                }}
                                              >
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: hasKey ? '#10b981' : '#ef4444', boxShadow: hasKey ? '0 0 8px #10b981' : 'none' }} />
                                                <span>Slot {keyIdx + 1}: {keySlot.replace('_API_KEY', '')}</span>
                                                <span style={{ fontSize: 10, color: hasKey ? '#a7f3d0' : '#fca5a5' }}>
                                                  {hasKey ? '✓ Active' : '✗ Empty'}
                                                </span>
                                              </div>
                                              {keyIdx < step.key_list.length - 1 && (
                                                <span style={{ color: '#475569', fontWeight: 'bold' }}>➔</span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.05)', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.15)', display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content' }}>
                                        <span>⚠️</span> If a slot yields rate limits (429) or errors, engine cascades immediately to the next configured slot.
                                      </div>
                                    </div>
                                  )}

                                  {/* Render single-key state */}
                                  {step.type === 'single_key' && (
                                    <div style={{ marginTop: 4 }}>
                                      {(() => {
                                        const hasKey = data.activeKeys?.[step.key];
                                        return (
                                          <div
                                            style={{
                                              padding: '8px 14px',
                                              borderRadius: 10,
                                              background: hasKey ? 'rgba(6,182,212,0.08)' : 'rgba(239,68,68,0.05)',
                                              border: hasKey ? '1px solid rgba(6,182,212,0.2)' : '1px solid rgba(239,68,68,0.15)',
                                              color: hasKey ? '#22d3ee' : '#f87171',
                                              fontSize: 12,
                                              fontWeight: 600,
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 8,
                                            }}
                                          >
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: hasKey ? '#06b6d4' : '#ef4444', boxShadow: hasKey ? '0 0 8px #06b6d4' : 'none' }} />
                                            <span>{step.key}</span>
                                            <span style={{ fontSize: 10, color: hasKey ? '#cffafe' : '#fca5a5' }}>
                                              {hasKey ? '✓ Active' : '✗ Empty'}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  )}

                                  {/* Render final fallback details */}
                                  {step.type === 'final_fallback' && (
                                    <div style={{ fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,0.05)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', gap: 8, width: 'fit-content' }}>
                                      <span>⚙️</span> Failsafe Active: In-house logic automatically recovers context using offline rule parsers or keyword translation models.
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* API Keys Management */}
            <div style={{ padding: 24, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>🔑</span> API Keys Configuration
                  </h2>
                  <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 6, maxWidth: 600 }}>
                    Keys saved here override .env.local values. Leave blank to use the env var value.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {keysMessage && (
                    <span style={{ fontSize: 13, color: keysMessage.includes('Error') ? '#fca5a5' : '#10b981' }}>
                      {keysMessage}
                    </span>
                  )}
                  <button onClick={handleSaveKeys} disabled={savingKeys} style={{
                    padding: '10px 24px', borderRadius: 12, fontWeight: 600,
                    background: savingKeys ? 'rgba(59,130,246,0.3)' : '#3b82f6',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}>
                    {savingKeys ? 'Saving...' : 'Save Keys'}
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
                {API_KEY_DEFS.map(def => (
                  <div key={def.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>{def.label}</label>
                    {def.type === 'select' ? (
                      <select
                        value={apiKeys[def.key] || ''}
                        onChange={e => setApiKeys({ ...apiKeys, [def.key]: e.target.value })}
                        style={{
                          padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                          background: '#0c1322', color: '#f8fafc', fontSize: 14, outline: 'none',
                          width: '100%', boxSizing: 'border-box', cursor: 'pointer',
                        }}
                      >
                        <option value="">Use Default ({def.placeholder})</option>
                        {def.options.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={def.type}
                        placeholder={def.placeholder}
                        value={apiKeys[def.key] || ''}
                        onChange={e => setApiKeys({ ...apiKeys, [def.key]: e.target.value })}
                        style={{
                          padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                          background: 'rgba(0,0,0,0.3)', color: '#f8fafc', fontSize: 14, outline: 'none',
                          width: '100%', boxSizing: 'border-box',
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* API Key Status Check */}
            <div style={{ padding: 24, background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>🩺</span> API Key Health Check
                  </h2>
                  <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 6, maxWidth: 600 }}>
                    Test each provider to verify the API key is working. The system auto-fallsback to the next working provider.
                  </p>
                </div>
                <button onClick={testAllKeys} disabled={testingKeys} style={{
                  padding: '10px 24px', borderRadius: 12, fontWeight: 600,
                  background: testingKeys ? 'rgba(16,185,129,0.3)' : '#10b981',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  transition: 'all 0.2s'
                }}>
                  {testingKeys ? '🔄 Testing...' : '▶ Run All Tests'}
                </button>
              </div>
              {testResults && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                  {testResults.error ? (
                    <div style={{ color: '#fca5a5' }}>{testResults.error}</div>
                  ) : (
                    Object.entries(testResults).map(([provider, result]) => {
                      const icon = result.status === 'ok' ? '✅' : result.status === 'missing' ? '⚪' : result.status === 'low_credits' ? '⚠️' : '❌';
                      const color = result.status === 'ok' ? '#10b981' : result.status === 'missing' ? '#64748b' : result.status === 'low_credits' ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={provider} style={{ padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: `1px solid ${color}33` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span>{icon}</span>
                            <span style={{ fontWeight: 600, textTransform: 'capitalize', color: '#e2e8f0' }}>{provider}</span>
                          </div>
                          <div style={{ fontSize: 13, color }}>{result.message}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
              <div style={{ padding: 24, background: 'rgba(255,255,255,0.02)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: '#60a5fa' }} />
                <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Total Platform Users</div>
                <div style={{ fontSize: 42, fontWeight: 800, margin: '12px 0', color: '#fff' }}>{data.stats.totalUsers}</div>
                <div style={{ fontSize: 13, color: '#10b981', fontWeight: 500 }}>✓ {data.stats.verifiedUsers} Verified Accounts</div>
              </div>
              
              <div style={{ padding: 24, background: 'rgba(255,255,255,0.02)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: '#f59e0b' }} />
                <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Email Integrations</div>
                <div style={{ fontSize: 42, fontWeight: 800, margin: '12px 0', color: '#fff' }}>{data.stats.nylasConnected}</div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Users syncing job emails</div>
              </div>

              <div style={{ padding: 24, background: 'rgba(255,255,255,0.02)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: '#c084fc' }} />
                <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Resumes Generated</div>
                <div style={{ fontSize: 42, fontWeight: 800, margin: '12px 0', color: '#fff' }}>{data.stats.totalResumes}</div>
                <div style={{ fontSize: 13, color: '#c084fc', fontWeight: 500 }}>✨ {data.stats.aiGeneratedResumes} by AI Engine</div>
              </div>

              <div style={{ padding: 24, background: 'rgba(255,255,255,0.02)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: '#10b981' }} />
                <div style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Active Jobs Tracked</div>
                <div style={{ fontSize: 42, fontWeight: 800, margin: '12px 0', color: '#fff' }}>{data.stats.totalJobs}</div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>
                  🎯 {data.stats.jobsInterview} Interviews • 🏆 {data.stats.jobsOffer} Offers
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div style={{ padding: 24, background: 'rgba(255,255,255,0.02)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>User Registry & Activity</h2>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', fontSize: 12 }}>
                      <th style={{ padding: '16px 20px', fontWeight: 600 }}>User Profile</th>
                      <th style={{ padding: '16px 20px', fontWeight: 600 }}>Activity</th>
                      <th style={{ padding: '16px 20px', fontWeight: 600 }}>Email Integration</th>
                      <th style={{ padding: '16px 20px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '16px 20px', fontWeight: 600 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((u, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s', _hover: { background: 'rgba(255,255,255,0.02)' } }}>
                        <td style={{ padding: '20px' }}>
                          <div style={{ fontWeight: 600, color: '#fff', fontSize: 16 }}>{u.name}</div>
                          <div style={{ color: '#94a3b8', marginTop: 4 }}>{u.email}</div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Joined {new Date(u.createdAt).toLocaleDateString()}</div>
                        </td>
                        <td style={{ padding: '20px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(192, 132, 252, 0.1)', color: '#c084fc', padding: '6px 12px', borderRadius: 20, fontWeight: 600, fontSize: 12 }}>
                            📄 {u.resumeCount || 0} Resumes Created
                          </div>
                        </td>
                        <td style={{ padding: '20px' }}>
                          {(u.nylasEmail || u.googleEmail) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: '#10b981', fontSize: 10 }}>●</span>
                                <span style={{ color: '#e2e8f0', fontWeight: 500 }}>Connected</span>
                              </div>
                              <div style={{ fontSize: 13, color: '#94a3b8', padding: '4px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, display: 'inline-block' }}>
                                📧 {u.nylasEmail || u.googleEmail || u.email}
                              </div>
                            </div>
                          ) : (
                            <div style={{ color: '#64748b', fontStyle: 'italic' }}>Not Connected</div>
                          )}
                        </td>
                        <td style={{ padding: '20px' }}>
                          <span style={{ 
                            padding: '6px 12px', 
                            borderRadius: 20, 
                            fontSize: 12, 
                            fontWeight: 600,
                            background: u.verified ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            color: u.verified ? '#10b981' : '#f59e0b'
                          }}>
                            {u.verified ? '✓ Verified' : 'Pending'}
                          </span>
                        </td>
                        <td style={{ padding: '20px' }}>
                          <button 
                            onClick={() => fetchUserEmails(u.email)}
                            disabled={!u.googleEmail && !u.nylasEmail && !u.nylasGrantId && !u.googleRefreshToken}
                            style={{
                              padding: '8px 16px',
                              background: (!u.googleEmail && !u.nylasEmail && !u.nylasGrantId && !u.googleRefreshToken) ? 'rgba(255,255,255,0.05)' : 'rgba(59, 130, 246, 0.2)',
                              color: (!u.googleEmail && !u.nylasEmail && !u.nylasGrantId && !u.googleRefreshToken) ? '#64748b' : '#60a5fa',
                              border: 'none',
                              borderRadius: 8,
                              fontWeight: 600,
                              cursor: (!u.googleEmail && !u.nylasEmail && !u.nylasGrantId && !u.googleRefreshToken) ? 'not-allowed' : 'pointer',
                              fontSize: 12
                            }}>
                            📥 View Inbox
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* Email Viewer Modal */}
      {selectedUserEmails && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)', padding: 20 }}>
          <div style={{ background: '#1e293b', width: '100%', maxWidth: 800, maxHeight: '85vh', borderRadius: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, color: '#fff' }}>User Inbox</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#94a3b8' }}>Viewing recent emails for {selectedUserEmails.email}</p>
              </div>
              <button onClick={() => setSelectedUserEmails(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ padding: 32, overflowY: 'auto', flex: 1 }}>
              {loadingEmails ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>Fetching emails from integration...</div>
              ) : selectedUserEmails.error ? (
                <div style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', padding: 20, borderRadius: 12 }}>
                  {selectedUserEmails.error}
                </div>
              ) : selectedUserEmails.messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>No emails found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {selectedUserEmails.messages.map((msg, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: 20, borderRadius: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 16 }}>{msg.subject}</div>
                        <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', marginLeft: 16 }}>{new Date(msg.date).toLocaleDateString()}</div>
                      </div>
                      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>From: <span style={{ color: '#c084fc' }}>{msg.from}</span></div>
                      <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                        {msg.snippet}...
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
