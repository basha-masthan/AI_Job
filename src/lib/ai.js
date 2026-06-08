/**
 * AI Client - Strictly OpenRouter
 */

import { getApiKey, getSetting, getGroqKeys, getOpenRouterKeys, getMistralKeys, getCohereKeys, getOpenAIKeys } from '@/lib/config';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';
const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const HF_BASE = 'https://router.huggingface.co/v1';
const CEREBRAS_BASE = 'https://api.cerebras.ai/v1/chat/completions';
const OPENAI_BASE = 'https://api.openai.com/v1/chat/completions';

function getActiveAIProvider() {
  return getSetting('activeAIProvider', 'openrouter');
}

export async function callOpenRouter(messages, maxTokens = 4096, retries = 2, customModel = null) {
  const keys = getOpenRouterKeys();
  let lastErr = null;
  
  for (const apiKey of keys) {
    if (!apiKey) continue;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(OPENROUTER_BASE, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'JobHunt AI Pro',
        },
        body: JSON.stringify({
          model: customModel || getApiKey('OPENROUTER_MODEL') || 'openai/gpt-oss-120b:free',
          messages,
          max_tokens: maxTokens,
          temperature: 0.3,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (!data.choices?.[0]?.message?.content) {
          throw new Error(`OpenRouter invalid response: ${JSON.stringify(data).substring(0, 500)}`);
        }
        return data.choices[0].message.content;
      }

      const err = await res.text();
      if (res.status === 429 && attempt < retries) {
        const delay = (attempt + 1) * 2000;
        console.warn(`OpenRouter rate limited, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      lastErr = new Error(`OpenRouter error ${res.status}: ${err}`);
      break; // Break retry loop to try next key
    }
  }
  throw lastErr || new Error('All OpenRouter keys failed.');
}

export async function callGroq(messages, maxTokens = 4096) {
  const keys = getGroqKeys();
  let lastErr = null;
  
  for (const apiKey of keys) {
    if (!apiKey) continue;
    const res = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getApiKey('GROQ_MODEL') || 'llama-3.3-70b-versatile',
        messages,
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      lastErr = new Error(`Groq error ${res.status}: ${err}`);
      if (res.status === 429) {
        console.warn(`Groq rate limited on key ${apiKey.substring(0,8)}..., trying next key...`);
        continue; // Try next key
      }
      continue; // Also try next key on other errors
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }
  throw lastErr || new Error('All Groq keys failed.');
}

export async function callHuggingFace(messages, maxTokens = 4096) {
  const apiKey = getApiKey('HF_TOKEN');
  if (!apiKey) throw new Error('HF_TOKEN is missing in .env.local');

  const res = await fetch(`${HF_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getApiKey('HF_MODEL') || 'deepseek-ai/DeepSeek-V4-Pro:cheapest',
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HuggingFace error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

export async function callGemini(systemPrompt, userPrompt, maxTokens = 4096) {
  const apiKey = getApiKey('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing in .env.local');

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: { text: systemPrompt } },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const data = await res.json();
  if (data.candidates && data.candidates.length > 0) {
    return data.candidates[0].content.parts[0].text;
  }
  throw new Error('Gemini returned empty response');
}

export async function callCerebras(messages, maxTokens = 4096) {
  const apiKey = getApiKey('CEREBRAS_API_KEY');
  const model = getApiKey('CEREBRAS_MODEL') || 'llama3.1-8b';
  if (!apiKey) throw new Error('CEREBRAS_API_KEY is missing');

  const res = await fetch(CEREBRAS_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.3 }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cerebras error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

export async function callMistral(messages, maxTokens = 4096) {
  const keys = getMistralKeys();
  let lastErr = null;
  
  for (const apiKey of keys) {
    if (!apiKey) continue;
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getApiKey('MISTRAL_MODEL') || 'mistral-large-latest',
        messages,
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      lastErr = new Error(`Mistral error ${res.status}: ${err}`);
      if (res.status === 429) continue;
      continue;
    }

    const data = await res.json();
    return data.choices[0].message.content;
  }
  throw lastErr || new Error('All Mistral keys failed.');
}

export async function callCohere(messages, maxTokens = 4096) {
  const keys = getCohereKeys();
  let lastErr = null;

  // Convert generic messages (role: 'system'/'user'/'assistant') to Cohere chat format
  const cohereMessages = messages.map(m => {
    if (m.role === 'system') return { role: 'SYSTEM', message: m.content };
    if (m.role === 'user') return { role: 'USER', message: m.content };
    if (m.role === 'assistant') return { role: 'CHATBOT', message: m.content };
    return { role: 'USER', message: m.content };
  });
  
  for (const apiKey of keys) {
    if (!apiKey) continue;
    const res = await fetch('https://api.cohere.ai/v1/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getApiKey('COHERE_MODEL') || 'command-r-plus',
        chat_history: cohereMessages.slice(0, -1),
        message: cohereMessages[cohereMessages.length - 1].message,
        temperature: 0.3,
        max_tokens: maxTokens
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      lastErr = new Error(`Cohere error ${res.status}: ${err}`);
      if (res.status === 429) continue;
      continue;
    }

    const data = await res.json();
    return data.text;
  }
  throw lastErr || new Error('All Cohere keys failed.');
}

export async function callOpenAI(messages, maxTokens = 4096, customModel = null) {
  const keys = getOpenAIKeys();
  const model = customModel || getApiKey('OPENAI_MODEL') || 'gpt-4o';
  let lastErr = null;

  for (const apiKey of keys) {
    if (!apiKey) continue;
    const res = await fetch(OPENAI_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.3 }),
    });
    if (!res.ok) {
      const err = await res.text();
      lastErr = new Error(`OpenAI error ${res.status}: ${err}`);
      if (res.status === 429) continue;
      continue;
    }
    const data = await res.json();
    return data.choices[0].message.content;
  }
  // Fallback to gpt-4o-mini if primary model fails with quota errors
  if (model !== 'gpt-4o-mini') {
    try {
      const fallbackKeys = getOpenAIKeys();
      for (const apiKey of fallbackKeys) {
        if (!apiKey) continue;
        const res = await fetch(OPENAI_BASE, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages, max_tokens: maxTokens, temperature: 0.3 }),
        });
        if (!res.ok) continue;
        const data = await res.json();
        return data.choices[0].message.content;
      }
    } catch {}
  }
  throw lastErr || new Error('All OpenAI keys failed.');
}

export async function invokeAI(systemPrompt, userPrompt, maxTokens = 4096) {
  const provider = getActiveAIProvider();

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const providers = [
    { name: 'openai', fn: () => callOpenAI(messages, maxTokens), key: 'OPENAI_API_KEY' },
    { name: 'cerebras', fn: () => callCerebras(messages, maxTokens), key: 'CEREBRAS_API_KEY' },
    { name: 'groq', fn: () => callGroq(messages, maxTokens), key: 'GROQ_API_KEY' },
    { name: 'mistral', fn: () => callMistral(messages, maxTokens), key: 'MISTRAL_API_KEY' },
    { name: 'cohere', fn: () => callCohere(messages, maxTokens), key: 'COHERE_API_KEY' },
    { name: 'openrouter', fn: () => callOpenRouter(messages, maxTokens), key: 'OPENROUTER_API_KEY' },
    { name: 'huggingface', fn: () => callHuggingFace(messages, maxTokens), key: 'HF_TOKEN' },
    { name: 'gemini', fn: () => callGemini(systemPrompt, userPrompt, maxTokens), key: 'GEMINI_API_KEY' },
  ];

  const preferredIndex = providers.findIndex(p => p.name === provider);

  const orderedProviders = [
    ...providers.slice(preferredIndex),
    ...providers.slice(0, preferredIndex),
  ];

  let lastError = null;
  for (const p of orderedProviders) {
    if (!getApiKey(p.key)) continue;
    try {
      return await p.fn();
    } catch (err) {
      lastError = err;
      console.warn(`${p.name} failed (${err.message}), trying next provider...`);
    }
  }

  throw lastError || new Error('No AI provider available. Configure an API key in settings.');
}

export function safeJSONParse(text, fallback = null) {
  if (!text) return fallback;
  
  try {
    // 1. Try direct parse first
    return JSON.parse(text.trim());
  } catch (e) {
    // 2. Try to extract the JSON block using a non-greedy-start, greedy-end approach
    // We want to find the first { or [ and the last } or ]
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    let start = -1;
    let end = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = text.lastIndexOf('}');
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = text.lastIndexOf(']');
    }

    if (start !== -1 && end !== -1 && end > start) {
      let cleaned = text.substring(start, end + 1);
      
      // 3. Remove common AI formatting artifacts
      // Remove trailing commas before closing braces/brackets
      cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

      try {
        return JSON.parse(cleaned);
      } catch (innerError) {
        console.error('safeJSONParse failed even after cleaning. Text snippet:', cleaned.substring(0, 200));
        return fallback;
      }
    }
    
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────
// Task-specific functions
// ─────────────────────────────────────────────────────────────

export async function extractProfileFromResumeText(rawText) {
  const system = `You are an expert resume parser. Extract structured profile data from resume text.
Return valid JSON only — no markdown, no explanation, no code fences.`;

  const user = `Extract all profile information from this resume text and return a structured JSON profile.

RESUME TEXT:
${rawText.substring(0, 5000)}

Return ONLY this JSON structure (fill all fields you can find, leave empty string or empty array if not found):
{
  "name": "Full Name",
  "contact": {
    "email": "email@example.com",
    "phone": "+91-XXXXXXXXXX",
    "location": "City, State",
    "linkedin": "linkedin.com/in/profile",
    "github": "github.com/username",
    "portfolio": ""
  },
  "summary": "Professional summary or objective statement",
  "skills": {
    "technical": ["skill1", "skill2"],
    "soft": ["skill1"],
    "tools": ["tool1"]
  },
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "duration": "Jan 2022 – Present",
      "location": "City",
      "bullets": ["Achievement or responsibility"]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "B.Tech Computer Science",
      "year": "2020–2024",
      "cgpa": "8.5/10"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "What it does",
      "tech": ["React", "Node.js"],
      "link": ""
    }
  ],
  "certifications": [],
  "achievements": []
}`;

  const text = await invokeAI(system, user, 2048);
  const profile = safeJSONParse(text);
  if (!profile) throw new Error('Could not parse profile from resume text.');
  return profile;
}

/**
 * Match a job description against multiple resume profiles
 */
export async function matchResumesWithJD(jobDescription, resumes) {
  const system = `You are an expert HR Recruiter and ATS specialist. Rate the match between a Job Description and multiple Candidate Profiles.
Return a JSON array of objects, one for each profile:
[
  { 
    "id": "original_id", 
    "score": 85, 
    "reason": "1-sentence explanation of why it matches",
    "strengths": ["string"],
    "gaps": ["string"],
    "recommendation": "string"
  }
]
Score is 0-100. Be strict. Only give 95+ if it's a perfect fit.`;

  const user = `JOB DESCRIPTION:
${jobDescription}

CANDIDATE PROFILES:
${resumes.map((r, i) => `
[Candidate ${i + 1}] ID: ${r.id}
Data: ${JSON.stringify(r.data || r.extractedProfile)}
`).join('\n---\n')}`;

  let text;
  try {
    text = await callGroq([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ], 2048);
  } catch {
    text = await invokeAI(system, user, 2048);
  }

  return safeJSONParse(text, []);
}

/**
 * Match a single resume against multiple job descriptions (Bulk Search Scoring)
 */
export async function matchJobsWithResume(resumeProfile, jobListText) {
  const system = `You are an expert AI Job Matcher. 
Compare the provided CANDIDATE PROFILE against a list of JOB DESCRIPTIONS.
Rate how well the candidate fits each job.
Return a JSON array of objects:
[
  { 
    "score": 85, 
    "reason": "1-sentence explanation"
  }
]
Score is 0-100. Be very brief.`;

  const user = `CANDIDATE PROFILE:
${JSON.stringify(resumeProfile)}

JOB LIST:
${jobListText}

Return a JSON array with one score object per job in the list, in the SAME order.`;

  let text;
  try {
    text = await callGroq([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ], 2048);
  } catch {
    text = await invokeAI(system, user, 2048);
  }

  return safeJSONParse(text, []);
}

export async function generateResumeFromJD(jobDescription, userProfile = null, isSmartMerge = false) {
  const system = `You are an expert ATS (Applicant Tracking System) specialist and executive resume writer.
Your goal is to create a resume that passes high-standard ATS filters and impresses human recruiters.

${isSmartMerge ? `
SMART MERGE MODE ACTIVE:
You have been provided with multiple source profiles (resumes) for the same candidate. 
Your task is to synthesize a 'Master Tailored Profile'. 
1. Pick the best technical skills from across all profiles that match the JD.
2. Select the most relevant experience roles and bullet points from any of the source profiles.
3. Ensure the contact information is consistent (use the name and contact from the first profile if they differ).
4. Create a cohesive, powerful career narrative that bridges any gaps using the total sum of their technical history.` : ''}

CRITICAL RULES:
1. ATS OPTIMIZATION: Use standard section headings. Include high-impact keywords from the JD.
2. CONCISENESS (SINGLE PAGE STRICT): The final output MUST be concise to fit on one printed page.
   - Summary: Max 2-3 short sentences.
   - Experience: Max 3 bullet points per role (only top 2-3 most relevant roles). Keep bullets to 1-2 lines.
   - Projects: Max 2 most relevant projects.
   - Skills: Only list the top 12-15 most relevant skills.
3. FRESHER/INTERN LOGIC: If candidate has little experience, transform their academic projects into a "Professional Internship" or "Technical Residency" related to the JD.
4. IMPACT: Use quantified bullets (e.g., "Improved performance by 30%").
5. SKILL BRIDGING: If the JD lists skills the candidate doesn't explicitly have, ADD those skills to the resume by incorporating them into existing project descriptions, adding new projects, or modifying bullet points — but only for skills that are reasonably adjacent to the candidate's existing tech stack. Never claim experience with a skill that requires years of specialization (e.g., don't add "5 years of Rust" if they've never used it). Do add reasonable adjacent skills like "GraphQL" alongside existing "REST API" experience, or "Docker" alongside existing cloud experience.
6. JSON ONLY: Return valid JSON matching the structure provided.`;

  const profileContext = userProfile
    ? `\n\nCandidate's existing profile/background (Source Data):\n${JSON.stringify(userProfile, null, 2)}`
    : '\n\nCreate a realistic, professional profile for a highly qualified candidate matching this JD.';

  const user = `Create a tailored, ATS-optimized resume for this job description:

${jobDescription}
${profileContext}

Return ONLY a valid JSON object with this exact structure:
{
  "name": "Full Name",
  "jobTitle": "Target Job Title from JD",
  "contact": {
    "email": "email@example.com",
    "phone": "+91-XXXXXXXXXX",
    "location": "City, State",
    "linkedin": "linkedin.com/in/profile",
    "github": "github.com/username"
  },
  "summary": "3-sentence professional summary packed with JD-specific keywords and value proposition.",
  "skills": {
    "technical": ["skill1", "skill2", "skill3"],
    "soft": ["Communication", "Problem Solving"],
    "tools": ["Git", "Docker"]
  },
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "duration": "Duration (e.g. 3-6 months for interns)",
      "location": "City",
      "bullets": [
        "High impact achievement with keywords",
        "Quantified result related to JD requirements"
      ]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Degree Name",
      "year": "Year",
      "cgpa": "X.X/10"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "How it solves a problem mentioned in JD",
      "tech": ["React", "Node.js"],
      "link": "github.com/user/project"
    }
  ],
  "certifications": [],
  "achievements": []
}`;

  const text = await invokeAI(system, user, 4096);
  const resume = safeJSONParse(text);
  if (!resume) throw new Error('AI returned invalid JSON for resume. Try again.');
  return resume;
}

export async function extractJobUpdateFromEmail(subject, body, existingJobs = []) {
  const system = `You are a career assistant AI. Your job is to read an email and determine if it's a job application update, an auto-reply, or a support ticket.
If it is related to a job application (e.g., successful submission, interview invite, rejection, next steps, or an automated support/Zendesk reply indicating a ticket was created for the application), extract the details.
If it's just a newsletter, spam, or unrelated email, set "isJobRelated" to false.

CRITICAL RULES:
1. Return ONLY valid JSON.
2. Standardize status to one of: "Applied", "Interview", "Offer", "Rejected", "Auto-Reply".
3. Use the existing jobs context if it helps clarify the company or role.`;

  const user = `Existing Jobs context: ${JSON.stringify(existingJobs.map(j => ({ company: j.company, role: j.role })))}

Email Subject: ${subject}
Email Body Snippet: ${body.substring(0, 2000)}

INSTRUCTIONS:
1. Is this email a job application confirmation, interview invite, shortlisting notice, rejection, or an automated support ticket reply?
2. HIGH PRIORITY PLATFORMS: If the email subject or body mentions "Indeed", "LinkedIn", "Naukri", "Wellfound", "Cutshort", "Careers", or "HR", it is HIGHLY LIKELY to be job-related.
3. KEYWORDS: If it contains "shortlisted", "application update", "successfully submitted", "thank you for applying", "next steps", "interview", or "ticket has been created", mark it as job-related (isJobRelated: true).
4. EXTRACT DETAILS: Find the company and role. If you can't find the role, default to "Applicant". If it's a platform notification (e.g. "Jobs you don't want to miss"), extract the platform as the company.
5. Standardize status: "Applied", "Interview", "Offer", "Rejected", "Auto-Reply". Use "Auto-Reply" for automated Zendesk/support ticket creations or "out of office" responses.

Return JSON:
{
  "isJobRelated": boolean,
  "company": "Company Name",
  "role": "Full Job Title (e.g. Senior Frontend Developer)",
  "status": "Applied|Interview|Offer|Rejected|Auto-Reply",
  "location": "City, Country or Remote/Hybrid",
  "salary": "Package or Salary details if mentioned, else empty",
  "type": "Full-time|Part-time|Internship|Contract",
  "jobUrl": "Link to the application or job post if found in the text",
  "notes": "A brief summary of the email content or next steps mentioned"
}`;

  try {
    const text = await invokeAI(system, user, 1024);
    const result = safeJSONParse(text);
    if (result) return result;
  } catch (e) {
    console.warn(`AI email analysis failed (${e.message}), using keyword fallback`);
  }

  return keywordFallback(subject, body);
}

function keywordFallback(subject, body) {
  const text = `${subject} ${body}`.toLowerCase();

  const platformKeywords = ['indeed', 'linkedin', 'naukri', 'wellfound', 'cutshort', 'careers', 'glassdoor', 'monster'];
  const jobActionKeywords = ['shortlisted', 'application update', 'successfully submitted', 'thank you for applying',
    'next steps', 'interview', 'application received', 'job update', 'application status'
  ];
  const interviewKeywords = ['interview', 'schedule', 'meet the team', 'phone screen', 'video call'];
  const offerKeywords = ['offer letter', 'offer', 'congratulations', 'you\'re hired', 'joining'];
  const rejectKeywords = ['rejected', 'unfortunately', 'not moving forward', 'other candidates', 'regret to inform'];

  const isFromPlatform = platformKeywords.some(k => text.includes(k));
  const hasAction = jobActionKeywords.some(k => text.includes(k));
  const isInterview = interviewKeywords.some(k => text.includes(k));
  const isOffer = offerKeywords.some(k => text.includes(k));
  const isRejected = rejectKeywords.some(k => text.includes(k));

  if (!isFromPlatform && !hasAction && !isInterview && !isOffer && !isRejected) {
    return { isJobRelated: false };
  }

  let status = 'Applied';
  if (isInterview) status = 'Interview';
  if (isOffer) status = 'Offer';
  if (isRejected) status = 'Rejected';

  let company = '';
  const knownPlatforms = { indeed: 'Indeed', linkedin: 'LinkedIn', naukri: 'Naukri', wellfound: 'Wellfound', cutshort: 'Cutshort', glassdoor: 'Glassdoor', monster: 'Monster' };
  for (const [key, name] of Object.entries(knownPlatforms)) {
    if (subject.toLowerCase().includes(key) || body.toLowerCase().includes(key)) {
      company = name;
      break;
    }
  }

  const fromMatch = body.match(/from:\s*([^\n]+)/i);
  if (!company && fromMatch) {
    company = fromMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  return {
    isJobRelated: true,
    company: company || 'Unknown Company',
    role: isInterview ? 'Applicant (Interview)' : 'Applicant',
    status,
    location: '',
    salary: '',
    type: 'Full-time',
    jobUrl: '',
    notes: `Keyword detected: ${status}`
  };
}

/**
 * Generate targeted search query variations for maximum job coverage
 */
export async function generateSearchQueries({ targetRole, skills = [], experience = '' }) {
  const system = `You are a job search query optimization expert. Generate 5-6 highly targeted search query variations for maximum job coverage.
Each query should be a standalone search string that covers different angles of the target role.
Return ONLY a JSON array of strings. No explanation, no markdown.`;

  const user = `Generate 5-6 search query variations for:
- Target Role: ${targetRole}
- Key Skills: ${skills.slice(0, 10).join(', ')}
- Experience Level: ${experience || 'Any'}

Rules:
1. Include the primary role as-is
2. Include variations with alternative titles (e.g., "MERN Developer" → "Full Stack Developer", "JavaScript Developer")
3. Include skill-focused queries (e.g., "React Node.js Developer")
4. Include shorter/broader queries for maximum coverage
5. Do NOT add seniority prefixes unless the target experience is senior (5+)
6. Each query should be 1-5 words

Return: ["query1", "query2", "query3", "query4", "query5", "query6"]`;

  try {
    const text = await invokeAI(system, user, 1024);
    const queries = safeJSONParse(text, []);
    if (Array.isArray(queries) && queries.length >= 2) {
      return queries.slice(0, 6);
    }
  } catch {}

  return [targetRole];
}

// <｜end▁of▁thinking｜>

// <｜｜DSML｜｜invoke name="todowrite">
export async function generateApplicationToolkit(jobDescription, userProfile) {
  const system = `You are a career coach and job application expert. 
Generate a tailored application kit for the candidate.
Return valid JSON only — no markdown, no explanation.`;

  const user = `Based on this Job Description and Candidate Profile, generate:
1. A tailored, professional Cover Letter (300 words).
2. Short answers (2-3 sentences) for common application questions: 
   - "Why are you a good fit for this role?"
   - "Describe a relevant project or achievement."
   - "What are your salary expectations?" (estimate based on role/location)

JOB DESCRIPTION:
${jobDescription}

CANDIDATE PROFILE:
${JSON.stringify(userProfile)}

Return JSON:
{
  "coverLetter": "...",
  "questions": [
    { "q": "Why are you a good fit?", "a": "..." },
    { "q": "Describe a relevant project...", "a": "..." },
    { "q": "Salary expectations?", "a": "..." }
  ]
}`;

  let text;
  try {
    text = await callGroq([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ], 3000);
  } catch {
    text = await invokeAI(system, user, 3000);
  }

  return safeJSONParse(text);
}

/**
 * Generate a personalized application email for a specific job
 */
export async function generateApplicationEmail(jobTitle, companyName, jobDescription, candidateProfile, coverLetter = '') {
  const system = `You are a professional career coach and email writer. Write a compelling, highly personalized job application email.
The email should be professional, showcase candidate's value proposition, and be tailored to the specific role, company goals, and aims.
Include: a professional greeting, who you are (incorporating their location), why you are genuinely interested in their company's goals/mission, what makes you a great fit (connecting your skills to the role details), and a clear call to action.
Do NOT use placeholders like [Your Name]. Write as if you are the candidate. Do NOT write the final closing sign-off or candidate name at the end.
Return valid JSON only: {"subject": "...", "body": "..."}`;

  const user = `Write a job application email for:

ROLE: ${jobTitle}
COMPANY: ${companyName}
JOB DESCRIPTION: ${(jobDescription || '').substring(0, 2000)}

CANDIDATE NAME: ${candidateProfile?.name || 'Applicant'}
CANDIDATE LOCATION: ${candidateProfile?.contact?.location || 'Hyderabad, India'}
CANDIDATE SKILLS: ${JSON.stringify(candidateProfile?.skills || [])}
CANDIDATE SUMMARY: ${(candidateProfile?.summary || '').substring(0, 500)}

${coverLetter ? `COVER LETTER REFERENCE:\n${coverLetter.substring(0, 1000)}` : ''}

Return JSON:
{
  "subject": "Compelling email subject line mentioning the role and company",
  "body": "Full email body with greeting, introduction, why interested, relevant skills, and call to action (do not write the final closing/sign-off word like 'Sincerely' or candidate name at the end)"
}`;

  try {
    const text = await callGroq([
      { role: 'system', content: system },
      { role: 'user', content: user },
    ], 2048);
    const result = safeJSONParse(text);
    if (result?.subject && result?.body) return result;
  } catch {}

  return {
    subject: `Application for ${jobTitle} position at ${companyName}`,
    body: `Dear Hiring Team at ${companyName},

I am writing to express my strong interest in the ${jobTitle} position. With my background in ${(candidateProfile?.skills?.technical || []).slice(0, 3).join(', ') || 'relevant technologies'}, I am confident I can contribute effectively to your team.

Please find my tailored resume attached for your review. I would welcome the opportunity to discuss how my skills and experience align with ${companyName}'s needs.

Thank you for your consideration.

Best regards,
${candidateProfile?.name || 'Applicant'}`
  };
}

/**
 * Perform a single unified LLM analysis of the candidate's profile against the job description.
 * Rates experience level match and ATS score in one API call.
 */
export async function analyzeJobMatch(job, resumeProfile) {
  const candidate = {
    skills: [
      ...(resumeProfile.skills?.technical || []),
      ...(resumeProfile.skills?.tools || []),
      ...(resumeProfile.skills?.soft || [])
    ],
    experience: (resumeProfile.experience || []).map(exp => ({
      role: exp.role,
      company: exp.company,
      duration: exp.duration,
      bullets: (exp.bullets || []).slice(0, 2)
    })),
    projects: (resumeProfile.projects || []).map(proj => ({
      name: proj.name,
      description: proj.description,
      tech: proj.tech
    }))
  };

  const system = `You are an expert ATS (Applicant Tracking System) and executive recruiter.
Analyze the candidate's profile against the job description.
Return ONLY raw JSON matching this exact schema:
{
  "experienceMatch": boolean,
  "experienceScore": number,
  "atsScore": number,
  "missingSkills": string[],
  "strengths": string[],
  "resumeRequired": boolean,
  "recommendation": "APPLY" | "SKIP"
}`;

  const user = `CANDIDATE PROFILE:
${JSON.stringify({ candidate }, null, 2)}

JOB DESCRIPTION:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Remote'}
Description: ${job.description}

Tasks:
1. Determine if candidate's experience is acceptable (do NOT automatically reject if candidate has 1.5 years and job requires 3 years, but skills strongly match). Set experienceMatch = true if acceptable.
2. Calculate ATS score (0-100) / apply probability.
3. List strengths and missing skills.
4. Recommend APPLY if experienceMatch is true and atsScore >= 50, otherwise SKIP.

Return JSON only.`;

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];

  let text = '';
  let lastError = null;

  // Failover Chain: Groq -> OpenRouter (DeepSeek V3) -> OpenAI (gpt-4o-mini)
  
  // 1. Try Groq (llama-3.3-70b-versatile)
  if (getApiKey('GROQ_API_KEY_1') || getApiKey('GROQ_API_KEY')) {
    try {
      text = await callGroq(messages, 1024);
      if (text) {
        const parsed = safeJSONParse(text);
        if (parsed && typeof parsed.atsScore === 'number') return parsed;
      }
    } catch (err) {
      lastError = err;
      console.warn(`Groq job analysis failed: ${err.message}, trying fallback...`);
    }
  }

  // 2. Try OpenRouter (deepseek/deepseek-chat)
  if (getApiKey('OPENROUTER_API_KEY_1') || getApiKey('OPENROUTER_API_KEY')) {
    try {
      text = await callOpenRouter(messages, 1024, 2, 'deepseek/deepseek-chat');
      if (text) {
        const parsed = safeJSONParse(text);
        if (parsed && typeof parsed.atsScore === 'number') return parsed;
      }
    } catch (err) {
      lastError = err;
      console.warn(`OpenRouter job analysis failed: ${err.message}, trying fallback...`);
    }
  }

  // 3. Try OpenAI (gpt-4o-mini)
  if (getApiKey('OPENAI_API_KEY_1') || getApiKey('OPENAI_API_KEY')) {
    try {
      text = await callOpenAI(messages, 1024, 'gpt-4o-mini');
      if (text) {
        const parsed = safeJSONParse(text);
        if (parsed && typeof parsed.atsScore === 'number') return parsed;
      }
    } catch (err) {
      lastError = err;
      console.warn(`OpenAI job analysis failed: ${err.message}`);
    }
  }

  // Final fallback if all failed or returned malformed JSON
  return {
    experienceMatch: true,
    experienceScore: 70,
    atsScore: 65,
    missingSkills: [],
    strengths: candidate.skills.slice(0, 5),
    resumeRequired: true,
    recommendation: 'APPLY',
    error: lastError ? lastError.message : 'All LLM models failed'
  };
}

// ── Job Verification ────────────────────────────────────────────
export async function verifyJobContent(scrapedText, url) {
  const system = `You are a job detection expert. Analyze the text content and determine if it represents a SINGLE individual job posting.

Return JSON only:
{
  "valid": boolean,
  "title": "extracted job title or null",
  "company": "extracted company name or null",
  "description": "full job description text (omit navigation, headers, footers, ads)",
  "experience": "extracted experience requirement or null",
  "skills": ["skill1", "skill2"],
  "location": "extracted location or null",
  "email": "any hiring/HR email found or null"
}

Reject (valid=false) if content is: a search results page showing multiple jobs, a category/listing page, a company careers overview page, a "jobs matching" or "showing X of Y" page, or if text is too short (<300 chars) to be a real job posting.

Accept (valid=true) if: it has one clear job title, company name, job description paragraphs, and application-related content.`;

  const user = `URL: ${url}\n\nPAGE CONTENT:\n${(scrapedText || '').substring(0, 8000)}`;

  try {
    const text = await Promise.race([
      invokeAI(system, user, 1024),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000)),
    ]);
    const result = safeJSONParse(text, { valid: false });
    if (result.valid && result.description && result.description.length < 200) {
      result.valid = false;
    }
    return result;
  } catch (err) {
    console.warn('[verifyJobContent] failed:', err.message);
    return { valid: false, error: err.message };
  }
}

export async function extractJobDetails(rawText, urlOrSource) {
  const system = `You are a job detail extractor. Given the following text from a job posting, extract the details.

Return a JSON object with these fields (use null for anything not found, and extract key points into arrays):
{
  "title": "job title",
  "company": "company name",
  "location": "location if found",
  "type": "employment type if found",
  "experience": "experience if found",
  "salary": "salary if found",
  "description": "full job description found",
  "applyLink": "${urlOrSource}",
  "skills": ["extracted technical skills", "required tools", "programming languages"],
  "responsibilities": ["extracted key duties and responsibilities"],
  "requirements": ["extracted qualifications, education, and requirements"],
  "benefits": ["extracted perks, benefits, and compensation details"]
}

Only include data that actually exists in the text.`;

  try {
    const result = await invokeAI(system, `Source: ${urlOrSource}\n\nJob Posting Text:\n${rawText.substring(0, 8000)}`, 3000);
    return safeJSONParse(result, null) || { title: 'Unknown Role', company: 'Unknown Company', description: rawText.substring(0, 500) };
  } catch (e) {
    console.error('Failed to extract job details:', e);
    return { title: 'Unknown Role', company: 'Unknown Company', description: rawText.substring(0, 500) };
  }
}
