import { createMcpServer, tool, startStdioServer } from '../shared/mcp-utils.js';
import { RewardEngine } from '../shared/reward-engine.js';

const MCP_NAME = 'job-search-mcp';

const engine = new RewardEngine(MCP_NAME, { warmupThreshold: 20, learningRate: 0.1 });
engine.load();

async function searchJobs(args) {
  const { query, location = 'India', sources = [] } = args;
  const results = [];
  const apiKeys = getJobApiKeys();

  if (sources.includes('adzuna') || sources.length === 0) {
    try {
      const jobs = await searchAdzuna(query, location, apiKeys.adzuna);
      for (const job of jobs) {
        job._reward = null;
        job.source = 'adzuna';
      }
      results.push(...jobs);
    } catch (e) {
      console.error('Adzuna search failed:', e.message);
    }
  }

  if (sources.includes('rapidapi') || sources.length === 0) {
    try {
      const jobs = await searchRapidAPI(query, location, apiKeys.rapidapi);
      for (const job of jobs) {
        job._reward = null;
        job.source = 'rapidapi';
      }
      results.push(...jobs);
    } catch (e) {
      console.error('RapidAPI search failed:', e.message);
    }
  }

  if (sources.includes('google') || sources.length === 0) {
    try {
      const jobs = await searchGoogleJobs(query, location, apiKeys.google);
      for (const job of jobs) {
        job._reward = null;
        job.source = 'google';
      }
      results.push(...jobs);
    } catch (e) {
      console.error('Google search failed:', e.message);
    }
  }

  if (sources.includes('remotive') || sources.length === 0) {
    try {
      const jobs = await searchRemotive(query);
      for (const job of jobs) {
        job._reward = null;
        job.source = 'remotive';
      }
      results.push(...jobs);
    } catch (e) {
      console.error('Remotive search failed:', e.message);
    }
  }

  const deduped = deduplicateJobs(results);

  return {
    total: deduped.length,
    sources: results.reduce((acc, j) => { acc[j.source] = (acc[j.source] || 0) + 1; return acc; }, {}),
    jobs: deduped
  };
}

function getJobApiKeys() {
  return {
    adzuna: {
      appId: process.env.ADZUNA_APP_ID || '3faaa6de',
      appKey: process.env.ADZUNA_APP_KEY || '9159d8fd906f5474bbd58a0ce03cd9a3'
    },
    rapidapi: {
      key: process.env.RAPIDAPI_KEY_1 || process.env.RAPIDAPI_KEY || '',
      hosts: [
        process.env.RAPIDAPI_HOST_1 || 'linkedin-job-search-api.p.rapidapi.com',
        process.env.RAPIDAPI_HOST_2 || 'indeed12.p.rapidapi.com'
      ]
    },
    google: {
      apiKey: process.env.GOOGLE_SEARCH_API_KEY || '',
      cx: process.env.GOOGLE_SEARCH_CX || ''
    }
  };
}

async function searchAdzuna(query, location, keys) {
  const url = `https://api.adzuna.com/v1/api/jobs/in/search?app_id=${keys.appId}&app_key=${keys.appKey}&what=${encodeURIComponent(query)}&where=${encodeURIComponent(location)}&results_per_page=20&distance=25`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Adzuna ${res.status}`);
  const data = await res.json();
  return (data.results || []).map(job => ({
    id: `adzuna_${job.id}`,
    title: job.title,
    company: job.company_name || 'Unknown',
    location: job.location?.display_name || location,
    description: `${job.title} at ${job.company_name || 'Unknown'}. ${job.description || ''}`.substring(0, 3000),
    salary: job.salary_min ? `$${job.salary_min / 1000}k - $${job.salary_max / 1000}k` : 'Competitive',
    url: job.redirect_url || `https://www.adzuna.com/details/${job.id}`,
    source: 'adzuna',
    postedDate: job.date || null,
    tags: extractTags(job)
  }));
}

async function searchRapidAPI(query, location, keys) {
  if (!keys.key) return [];
  const results = [];

  for (const host of keys.hosts.slice(0, 2)) {
    try {
      const url = `https://${host}/search?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&page=1`;
      const res = await fetch(url, {
        headers: { 'x-rapidapi-key': keys.key, 'x-rapidapi-host': host },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) continue;
      const data = await res.json();
      const jobs = extractRapidAPIJobs(data, host);
      results.push(...jobs);
    } catch (e) {
      console.warn(`RapidAPI ${host} failed:`, e.message);
    }
  }

  return results;
}

function extractRapidAPIJobs(data, host) {
  try {
    const arr = Array.isArray(data) ? data : data.jobs || data.results || data.data || [];
    return arr.slice(0, 20).map((job, i) => ({
      id: `${host.replace(/\./g, '_')}_${i}_${Date.now()}`,
      title: job.title || job.job_title || 'Unknown Role',
      company: job.company || job.employer || job.company_name || 'Unknown',
      location: job.location || job.job_location || 'Remote',
      description: job.description || job.snippet || job.jd || job.job_description || '',
      salary: job.salary || job.salary_range || 'Competitive',
      url: job.url || job.link || job.job_url || '#',
      source: host.split('.')[0]
    }));
  } catch {
    return [];
  }
}

async function searchGoogleJobs(query, location, keys) {
  if (!keys.apiKey || !keys.cx) return [];
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query + ' jobs ' + location)}&key=${keys.apiKey}&cx=${keys.cx}&num=20`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Google ${res.status}`);
  const data = await res.json();
  return (data.items || []).map((item, i) => ({
    id: `google_${i}_${Date.now()}`,
    title: item.title?.replace(/\s*[-|]?\s*Jobs\s*[-|]?\s*.*/gi, '').trim() || 'Unknown Role',
    company: extractCompanyFromTitle(item.title || ''),
    location: location,
    description: item.snippet || '',
    salary: 'Competitive',
    url: item.link || '#',
    source: 'google'
  }));
}

async function searchRemotive(query) {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=20`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Remotive ${res.status}`);
  const data = await res.json();
  return (data.jobs || []).map(job => ({
    id: `remotive_${job.id}`,
    title: job.title,
    company: job.company_name || 'Unknown',
    location: job.candidate_required_location || 'Remote',
    description: `${job.title} - ${job.description || ''}`.substring(0, 3000),
    salary: job.salary || 'Competitive',
    url: job.url || '#',
    source: 'remotive',
    postedDate: job.publication_date || null,
    tags: job.tags ? job.tags.split(',').map(t => t.trim()) : []
  }));
}

function extractCompanyFromTitle(title) {
  const patterns = [
    /^(.+?)\s*[-|]\s*.+\s*job/i,
    /^(.+?)\s+hiring/i,
    /at\s+(.+?)(?:\s*[-|]|$)/i
  ];
  for (const p of patterns) {
    const m = title.match(p);
    if (m && m[1]) return m[1].trim();
  }
  return title.substring(0, 50).trim();
}

function extractTags(job) {
  const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  const tags = [];
  if (text.includes('remote') || text.includes('work from home')) tags.push('remote');
  if (text.includes('senior') || text.includes('sr.')) tags.push('senior');
  if (text.includes('junior') || text.includes('entry')) tags.push('junior');
  if (text.includes('intern')) tags.push('internship');
  if (text.includes('contract') || text.includes('freelance')) tags.push('contract');
  return tags;
}

function deduplicateJobs(jobs) {
  const seen = new Map();
  for (const job of jobs) {
    const key = `${job.title.toLowerCase().trim()}_${job.company.toLowerCase().trim()}`;
    if (!seen.has(key)) {
      seen.set(key, job);
    } else {
      const existing = seen.get(key);
      if (!existing.description && job.description) {
        seen.set(key, { ...existing, description: job.description });
      }
    }
  }
  return Array.from(seen.values());
}

async function checkRelevance(args) {
  const { job, profile, threshold = 70 } = args;

  const resumeText = buildProfileText(profile);
  const jobText = `${job.title} at ${job.company}. ${job.description || ''}`.substring(0, 3000);

  const score = await scoreWithAI(resumeText, jobText);
  const relevance = score >= threshold;

  return {
    jobId: job.id,
    title: job.title,
    company: job.company,
    score: parseFloat(score.toFixed(1)),
    relevant: relevance,
    reason: score >= 80 ? 'Strong match' : score >= 70 ? 'Good match' : score >= 50 ? 'Partial match' : 'Low relevance'
  };
}

async function scoreWithAI(resumeText, jobText) {
  const system = `You are an expert ATS matcher. Rate how well a CANDIDATE matches a JOB from 0-100. Return ONLY a number (0-100).`;
  const prompt = `CANDIDATE:\n${resumeText.substring(0, 2000)}\n\nJOB:\n${jobText.substring(0, 2000)}\n\nScore (0-100):`;

  try {
    const text = await callGroq([{ role: 'system', content: system }, { role: 'user', content: prompt }], 256);
    const match = text.match(/\d+/);
    if (match) {
      const score = parseInt(match[0]);
      if (score >= 0 && score <= 100) return score;
    }
  } catch {}

  const keywordScore = calculateKeywordScore(resumeText, jobText);
  return keywordScore;
}

function calculateKeywordScore(resumeText, jobText) {
  const resumeLower = resumeText.toLowerCase();
  const jobLower = jobText.toLowerCase();

  const jobWords = new Set(jobLower.match(/\b[a-z+#]{3,}\b/g) || []);
  const resumeWords = new Set(resumeLower.match(/\b[a-z+#]{3,}\b/g) || []);

  let matches = 0;
  let total = 0;

  const importantCategories = [
    ['javascript', 'react', 'angular', 'vue', 'typescript', 'html', 'css', 'node'],
    ['python', 'django', 'flask', 'pandas', 'numpy', 'scikit'],
    ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'devops', 'ci/cd'],
    ['sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch'],
    ['machine learning', 'deep learning', 'nlp', 'computer vision', 'tensorflow', 'pytorch']
  ];

  for (const category of importantCategories) {
    const hasJobCat = category.some(w => jobLower.includes(w));
    const hasResumeCat = category.some(w => resumeLower.includes(w));
    if (hasJobCat) {
      total += 10;
      if (hasResumeCat) matches += 10;
    }
  }

  const techTerms = ['api', 'rest', 'graphql', 'git', 'agile', 'scrum', 'microservices', 'testing', 'ci'];
  for (const term of techTerms) {
    if (jobLower.includes(term)) {
      total += 5;
      if (resumeLower.includes(term)) matches += 5;
    }
  }

  return total > 0 ? Math.round((matches / total) * 100) : 50;
}

async function callGroq(messages, maxTokens = 1024) {
  const keys = getGroqKeys();
  for (const apiKey of keys) {
    if (!apiKey) continue;
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: maxTokens, temperature: 0.3 }),
        signal: AbortSignal.timeout(30000)
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices[0].message.content;
      }
    } catch {}
  }
  throw new Error('All Groq keys failed');
}

function getGroqKeys() {
  const keys = [];
  for (let i = 1; i <= 3; i++) {
    const k = process.env[`GROQ_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  const single = process.env.GROQ_API_KEY;
  if (single && !keys.includes(single)) keys.push(single);
  return keys.length > 0 ? keys : [''];
}

function buildProfileText(profile) {
  if (!profile) return '';
  const parts = [];
  if (profile.skills) {
    const skills = profile.skills.technical || profile.skills.tools || [];
    parts.push(`Skills: ${Array.isArray(skills) ? skills.join(', ') : JSON.stringify(skills)}`);
  }
  if (profile.experience) {
    for (const exp of profile.experience) {
      parts.push(`${exp.role} at ${exp.company} (${exp.duration})`);
      if (exp.bullets) parts.push(exp.bullets.join('. '));
    }
  }
  if (profile.summary) parts.push(profile.summary);
  return parts.join('\n');
}

async function rankResults(args) {
  const { jobs, profile, topN = 20 } = args;
  const ranked = [];

  for (const job of jobs) {
    const score = await scoreWithAI(buildProfileText(profile), `${job.title} at ${job.company}. ${job.description || ''}`);
    ranked.push({ ...job, matchScore: parseFloat(score.toFixed(1)) });
  }

  ranked.sort((a, b) => b.matchScore - a.matchScore);

  return {
    total: ranked.length,
    topJobs: ranked.slice(0, topN),
    scoreDistribution: {
      excellent: ranked.filter(j => j.matchScore >= 85).length,
      good: ranked.filter(j => j.matchScore >= 70 && j.matchScore < 85).length,
      moderate: ranked.filter(j => j.matchScore >= 50 && j.matchScore < 70).length,
      low: ranked.filter(j => j.matchScore < 50).length
    }
  };
}

const server = createMcpServer(MCP_NAME, { warmupThreshold: 20, learningRate: 0.1 });

server.registerTool(tool('search_jobs', 'Search job listings across multiple sources (Adzuna, RapidAPI, Google Jobs, Remotive). Returns deduplicated results.', {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Job role search query (e.g., "Full-Stack Developer")' },
    location: { type: 'string', description: 'Location (default: "India")' },
    sources: { type: 'array', items: { type: 'string', enum: ['adzuna', 'rapidapi', 'google', 'remotive'] }, description: 'Specific sources to search (empty = all)' }
  },
  required: ['query']
}, searchJobs));

server.registerTool(tool('check_relevance', 'Check if a job matches a candidate profile. Returns match score 0-100 and relevance decision.', {
  type: 'object',
  properties: {
    job: { type: 'object', description: 'Job object with id, title, company, description' },
    profile: { type: 'object', description: 'Candidate profile with skills, experience, summary' },
    threshold: { type: 'number', description: 'Minimum score for relevance (default: 70)' }
  },
  required: ['job', 'profile']
}, checkRelevance));

server.registerTool(tool('rank_results', 'Rank a list of jobs by match score against a candidate profile.', {
  type: 'object',
  properties: {
    jobs: { type: 'array', description: 'Array of job objects' },
    profile: { type: 'object', description: 'Candidate profile' },
    topN: { type: 'number', description: 'Return top N jobs (default: 20)' }
  },
  required: ['jobs', 'profile']
}, rankResults));

startStdioServer(server);
