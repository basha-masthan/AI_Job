import { createMcpServer, tool, startStdioServer } from '../shared/mcp-utils.js';

const MCP_NAME = 'jd-resume-matcher-mcp';

async function callGroq(messages, maxTokens = 2048) {
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

async function scoreMatch(args) {
  const { jobDescription, resume, userProfile } = args;

  const profile = userProfile || resume?.data || resume?.extractedProfile;
  if (!profile) return { error: 'No profile provided', _reward: -5 };

  const profileText = buildProfileText(profile);
  const jdText = typeof jobDescription === 'string' ? jobDescription : `${jobDescription.title}\n${jobDescription.description || ''}`;

  const system = `You are an expert ATS (Applicant Tracking System) specialist and HR recruiter. Compare a CANDIDATE PROFILE against a JOB DESCRIPTION. Return ONLY valid JSON.`;
  const user = `CANDIDATE PROFILE:\n${profileText}\n\nJOB DESCRIPTION:\n${jdText.substring(0, 4000)}\n\nReturn JSON with exact structure:\n{\n  "score": 0-100,\n  "reason": "one sentence explanation",\n  "strengths": ["keyword match 1", "keyword match 2"],\n  "gaps": ["missing skill 1", "missing requirement 2"],\n  "recommendation": "apply|review_reqs|skip"\n}`;

  let text;
  try {
    text = await callGroq([{ role: 'system', content: system }, { role: 'user', content: user }], 2048);
  } catch (e) {
    return { error: e.message, score: 50, recommendation: 'review_reqs', _reward: 0 };
  }

  const result = safeJSONParse(text, { score: 50, reason: 'Parse failed', strengths: [], gaps: [], recommendation: 'review_reqs' });
  const score = Math.min(100, Math.max(0, result.score || 50));

  let reward = 0;
  if (score >= 80) reward = 8;
  else if (score >= 70) reward = 5;
  else if (score >= 50) reward = 2;
  else reward = -3;

  return {
    score,
    reason: result.reason || '',
    strengths: result.strengths || [],
    gaps: result.gaps || [],
    recommendation: result.recommendation || 'review_reqs',
    needsResumeCreation: score < 80,
    _reward: reward
  };
}

async function generateResume(args) {
  const { jobDescription, userProfile, isSmartMerge = false } = args;

  if (!jobDescription) return { error: 'Job description required', _reward: -5 };

  const profile = userProfile?.data || userProfile?.extractedProfile || userProfile || null;
  const system = `You are an expert ATS specialist and executive resume writer. Create a resume that passes ATS filters.

CRITICAL:
1. ATS OPTIMIZATION: Use standard section headings. Include high-impact keywords from the JD.
2. SINGLE PAGE STRICT: Summary max 3 sentences, experience max 3 bullets per role (top 2-3 roles), skills max 15.
3. SKILL BRIDGING: Add JD-relevant skills to projects/bullets if they're adjacent to existing stack. Never claim years of specialization you don't have.
4. JSON ONLY: Return valid JSON matching the structure.`;

  const user = `Create a tailored ATS-optimized resume:\n\nJOB DESCRIPTION:\n${typeof jobDescription === 'string' ? jobDescription : `${jobDescription.title}\n${jobDescription.description || ''}`}\n\n${profile ? `CANDIDATE PROFILE:\n${JSON.stringify(profile, null, 2)}` : 'Create a professional resume matching the JD.'}\n\nReturn:\n{\n  "name": "Full Name",\n  "jobTitle": "Target Title",\n  "contact": {"email": "email@example.com", "phone": "+91-XXXXXXXXXX", "location": "City, State", "linkedin": "linkedin.com/in/profile", "github": "github.com/username"},\n  "summary": "3-sentence summary with JD keywords",\n  "skills": {"technical": ["React", "Node.js"], "soft": ["Communication"], "tools": ["Git"]},\n  "experience": [{"company": "Company", "role": "Title", "duration": "Duration", "location": "City", "bullets": ["High impact achievement", "Quantified result"]}],\n  "education": [{"institution": "University", "degree": "Degree", "year": "Year", "cgpa": "X.X/10"}],\n  "projects": [{"name": "Project", "description": "Solves JD problem", "tech": ["Tech"], "link": "github.com"}],\n  "certifications": [],\n  "achievements": []\n}`;

  let text;
  try {
    text = await callGroq([{ role: 'system', content: system }, { role: 'user', content: user }], 4096);
  } catch (e) {
    return { error: e.message, _reward: -5 };
  }

  const resume = safeJSONParse(text);
  if (!resume) return { error: 'AI returned invalid JSON', _reward: -3 };

  return {
    resume,
    created: true,
    atsOptimized: true,
    _reward: 7
  };
}

async function identifyGaps(args) {
  const { jobDescription, resume } = args;

  const profile = resume?.data || resume?.extractedProfile || resume || {};
  const jdText = typeof jobDescription === 'string' ? jobDescription : `${jobDescription.title}\n${jobDescription.description || ''}`;

  const system = `You are an ATS expert. Analyze gaps between a resume and job description. Return ONLY valid JSON.`;
  const user = `RESUME:\n${JSON.stringify(profile, null, 2)}\n\nJOB DESCRIPTION:\n${jdText.substring(0, 4000)}\n\nReturn JSON:\n{\n  "criticalGaps": ["must-have skill not mentioned", "years of experience gap"],\n  "softGaps": ["nice-to-have not in resume"],\n  "resumeStrengths": ["strong match points"],\n  "suggestions": ["add this keyword to summary", "add project showing this skill"],\n  "quickWins": ["easy fixes to boost ATS score"]\n}`;

  let text;
  try {
    text = await callGroq([{ role: 'system', content: system }, { role: 'user', content: user }], 2048);
  } catch (e) {
    return { error: e.message, _reward: -2 };
  }

  const gaps = safeJSONParse(text, { criticalGaps: [], softGaps: [], resumeStrengths: [], suggestions: [], quickWins: [] });

  return {
    ...gaps,
    _reward: gaps.criticalGaps?.length > 0 ? 3 : 5
  };
}

async function optimizeResume(args) {
  const { resume, targetScore = 80, jobDescription } = args;

  const profile = resume?.data || resume?.extractedProfile || resume;
  if (!profile) return { error: 'No resume provided', _reward: -5 };

  let jdContext = '';
  if (jobDescription) {
    jdContext = `JOB DESCRIPTION (optimize for this):\n${typeof jobDescription === 'string' ? jobDescription : `${jobDescription.title}\n${jobDescription.description || ''}`}`;
  }

  const system = `You are an ATS resume optimizer. Refine the existing resume to score higher on ATS. Only modify sections that need improvement. Keep genuine accomplishments. Return ONLY valid JSON.`;
  const user = `CURRENT RESUME:\n${JSON.stringify(profile, null, 2)}\n\n${jdContext}\n\nTarget ATS score: ${targetScore}+.\n\nReturn the FULL optimized resume JSON (same structure as input). Only change what needs improvement.`;

  let text;
  try {
    text = await callGroq([{ role: 'system', content: system }, { role: 'user', content: user }], 4096);
  } catch (e) {
    return { error: e.message, _reward: -3 };
  }

  const optimized = safeJSONParse(text);
  if (!optimized) return { error: 'AI returned invalid JSON', _reward: -2 };

  return {
    resume: optimized,
    optimized: true,
    targetScore,
    _reward: 6
  };
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
  if (profile.education) {
    for (const edu of profile.education) {
      parts.push(`${edu.degree} at ${edu.institution} (${edu.year})`);
    }
  }
  return parts.join('\n');
}

function safeJSONParse(text, fallback = null) {
  if (!text) return fallback;
  try { return JSON.parse(text.trim()); } catch {}
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(text.substring(firstBrace, lastBrace + 1)); } catch {}
  }
  return fallback;
}

const server = createMcpServer(MCP_NAME, { warmupThreshold: 20, learningRate: 0.1 });

server.registerTool(tool('score_match', 'Score how well a resume matches a job description (0-100). Returns score, strengths, gaps, and recommendation.', {
  type: 'object',
  properties: {
    jobDescription: { type: 'string', description: 'Job description text or object with title/description' },
    resume: { type: 'object', description: 'Resume object with data/extractedProfile' },
    userProfile: { type: 'object', description: 'User profile object (alternative to resume)' }
  },
  required: ['jobDescription']
}, scoreMatch));

server.registerTool(tool('generate_resume', 'Generate an ATS-optimized resume tailored to a job description. Creates from profile if provided.', {
  type: 'object',
  properties: {
    jobDescription: { type: 'string', description: 'Job description text or object' },
    userProfile: { type: 'object', description: 'User profile data' },
    isSmartMerge: { type: 'boolean', description: 'Merge multiple resumes intelligently' }
  },
  required: ['jobDescription']
}, generateResume));

server.registerTool(tool('identify_gaps', 'Identify gaps between a resume and job description.', {
  type: 'object',
  properties: {
    jobDescription: { type: 'string', description: 'Job description' },
    resume: { type: 'object', description: 'Resume object' }
  },
  required: ['jobDescription', 'resume']
}, identifyGaps));

server.registerTool(tool('optimize_resume', 'Optimize an existing resume to score higher on ATS for a target score.', {
  type: 'object',
  properties: {
    resume: { type: 'object', description: 'Resume to optimize' },
    targetScore: { type: 'number', description: 'Target ATS score (default: 80)' },
    jobDescription: { type: 'string', description: 'Target job description' }
  },
  required: ['resume']
}, optimizeResume));

startStdioServer(server);
