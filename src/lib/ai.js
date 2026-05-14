/**
 * AI Client - Groq (primary) with OpenRouter fallback
 * Groq uses LPU chips — delivers ~10x faster inference than GPU-based APIs
 * Model: llama-3.3-70b-versatile (best balance of quality + speed on Groq)
 */

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';

async function callGroq(messages, maxTokens = 4096) {
  const res = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

async function callOpenRouter(messages, maxTokens = 4096) {
  const res = await fetch(OPENROUTER_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'JobHunt AI Pro',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

/**
 * Primary AI call — tries Groq first, falls back to OpenRouter if configured
 */
export async function invokeAI(systemPrompt, userPrompt, maxTokens = 4096) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  // Try Groq first (fastest)
  if (process.env.GROQ_API_KEY) {
    try {
      return await callGroq(messages, maxTokens);
    } catch (err) {
      console.warn('Groq failed, trying fallback:', err.message);
    }
  }

  // Fallback to OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    return await callOpenRouter(messages, maxTokens);
  }

  throw new Error('No AI API key configured. Add GROQ_API_KEY to .env.local');
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
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
  }
  try { return JSON.parse(text.trim()); } catch {
    throw new Error('Could not parse profile from resume text.');
  }
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

  const text = await invokeAI(system, user, 2048);
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Failed to parse match results:', e);
      return [];
    }
  }
  return [];
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
2. FRESHER/INTERN LOGIC: If the candidate has 0 or very little professional experience, do NOT leave the experience section empty. Instead, transform their academic projects or skills into a "Professional Internship" or "Technical Residency" of 3-6 months that directly relates to the target JD.
3. IMPACT: Use quantified bullets (e.g., "Improved performance by 30%").
4. JSON ONLY: Return valid JSON matching the structure provided.`;

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
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
  }
  try { return JSON.parse(text.trim()); } catch {
    throw new Error('AI returned invalid JSON for resume. Try again.');
  }
}

export async function extractJobUpdateFromEmail(subject, body, existingJobs = []) {
  const system = `You are a career assistant AI. Your job is to read an email and determine if it's a job application update.
If it is related to a job application (e.g., successful submission, interview invite, rejection, or next steps), extract the details.
If it's just a newsletter, spam, or unrelated email, set "isJobRelated" to false.

CRITICAL RULES:
1. Return ONLY valid JSON.
2. Standardize status to one of: "Applied", "Interview", "Offer", "Rejected".
3. Use the existing jobs context if it helps clarify the company or role.`;

  const user = `Existing Jobs context: ${JSON.stringify(existingJobs.map(j => ({ company: j.company, role: j.role })))}

Email Subject: ${subject}
Email Body Snippet: ${body.substring(0, 2000)}

INSTRUCTIONS:
1. Is this email a job application confirmation, interview invite, shortlisting notice, or rejection?
2. HIGH PRIORITY PLATFORMS: If the email subject or body mentions "Indeed", "LinkedIn", "Naukri", "Wellfound", "Cutshort", "Careers", or "HR", it is HIGHLY LIKELY to be job-related.
3. KEYWORDS: If it contains "shortlisted", "application update", "successfully submitted", "thank you for applying", "next steps", or "interview", mark it as job-related (isJobRelated: true).
4. EXTRACT DETAILS: Find the company and role. If you can't find the role, default to "Applicant". If it's a platform notification (e.g. "Jobs you don't want to miss"), extract the platform as the company (e.g., "Wellfound", "Indeed") if a specific company isn't clear.
5. Standardize status: "Applied", "Interview", "Offer", "Rejected".

Return JSON:
{
  "isJobRelated": boolean,
  "company": "Company Name",
  "role": "Role Name",
  "status": "Applied|Interview|Offer|Rejected"
}`;

  const text = await invokeAI(system, user, 1024);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { return null; }
  }
  try { return JSON.parse(text.trim()); } catch { return null; }
}

export async function extractJobDetails(rawText, url) {
  const system = `You are a job data extraction specialist.
Extract structured information from job posting text.
Return valid JSON only — no markdown, no explanation.`;

  const user = `Extract all job details from this scraped job posting text.

URL: ${url}
CONTENT:
${rawText.substring(0, 6000)}

Return ONLY this JSON structure:
{
  "title": "Exact job title",
  "company": "Company name",
  "location": "City, Country / Remote / Hybrid",
  "type": "Full-time / Part-time / Contract / Internship",
  "experience": "X-Y years or Fresher",
  "salary": "Range or Not specified",
  "description": "Full job description paragraph",
  "requirements": ["requirement 1", "requirement 2"],
  "responsibilities": ["responsibility 1", "responsibility 2"],
  "skills": ["skill1", "skill2", "skill3"],
  "benefits": ["benefit1", "benefit2"],
  "applyLink": "${url}",
  "postedDate": "Date or Unknown",
  "deadline": "Deadline or Not specified"
}`;

  const text = await invokeAI(system, user, 2048);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
  }
  try { return JSON.parse(text.trim()); } catch {
    throw new Error('AI returned invalid JSON for job details. Try again.');
  }
}

/**
 * Generate a complete application kit (Cover Letter + Question Answers)
 */
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

  const text = await invokeAI(system, user, 3000);
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
  }
  return null;
}

