import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const MODEL_ID = process.env.AWS_BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

export async function invokeClaudeWithText(prompt) {
  const payload = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const decoded = JSON.parse(new TextDecoder().decode(response.body));
  return decoded.content[0].text;
}

export async function generateResumeFromJD(jobDescription, userProfile = null) {
  const profileContext = userProfile
    ? `\n\nUser's existing profile/resume data:\n${JSON.stringify(userProfile, null, 2)}`
    : '';

  const prompt = `You are an expert resume writer and career coach. Create a highly tailored, ATS-optimized resume for the following job description.

Job Description:
${jobDescription}
${profileContext}

Generate a comprehensive, professional resume in JSON format with this exact structure:
{
  "name": "Professional Name",
  "contact": {
    "email": "email@example.com",
    "phone": "+91-XXXXXXXXXX",
    "location": "City, State",
    "linkedin": "linkedin.com/in/profile",
    "github": "github.com/username",
    "portfolio": "portfolio-url.com"
  },
  "summary": "2-3 sentence professional summary tailored to this role",
  "skills": {
    "technical": ["skill1", "skill2"],
    "soft": ["skill1", "skill2"],
    "tools": ["tool1", "tool2"]
  },
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "duration": "Jan 2022 - Present",
      "location": "City, State",
      "bullets": ["Achievement 1 with metrics", "Achievement 2"]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "B.Tech Computer Science",
      "year": "2020-2024",
      "cgpa": "8.5/10"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description",
      "tech": ["React", "Node.js"],
      "link": "github.com/project"
    }
  ],
  "certifications": ["AWS Certified", "Google Cloud"],
  "achievements": ["Winner of X hackathon", "Published paper on Y"]
}

Make the resume compelling, use action verbs, quantify achievements, and ensure it matches the job requirements. Return ONLY the JSON object, no markdown.`;

  const text = await invokeClaudeWithText(prompt);
  try {
    return JSON.parse(text.trim());
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error('Failed to parse resume JSON from AI response');
  }
}

export async function matchResumeToJD(jobDescription, resumes) {
  const prompt = `You are an expert ATS (Applicant Tracking System) and recruiter with 15 years of experience.

Analyze the following job description and rank the provided resumes by match score.

Job Description:
${jobDescription}

Available Resumes:
${resumes.map((r, i) => `Resume ${i + 1} (ID: ${r.id}):
Name: ${r.data.name}
Summary: ${r.data.summary}
Skills: ${JSON.stringify(r.data.skills)}
Experience: ${r.data.experience?.map(e => e.role + ' at ' + e.company).join(', ')}
`).join('\n---\n')}

Return a JSON array with analysis for each resume:
[
  {
    "id": "resume_id",
    "score": 85,
    "strengths": ["strength1", "strength2"],
    "gaps": ["gap1", "gap2"],
    "recommendation": "Use this resume with minor tweaks to highlight X"
  }
]

Sort by score descending. Return ONLY the JSON array.`;

  const text = await invokeClaudeWithText(prompt);
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(text.trim());
  } catch {
    throw new Error('Failed to parse match results from AI response');
  }
}

export async function extractJobDetails(rawText, url) {
  const prompt = `Extract structured job details from the following text scraped from a job posting page.

URL: ${url}
Raw Content:
${rawText.substring(0, 6000)}

Return a JSON object with this structure:
{
  "title": "Job Title",
  "company": "Company Name",
  "location": "City, State / Remote",
  "type": "Full-time / Part-time / Contract / Internship",
  "experience": "2-5 years",
  "salary": "$X - $Y / Not specified",
  "description": "Full job description",
  "requirements": ["requirement1", "requirement2"],
  "responsibilities": ["responsibility1", "responsibility2"],
  "skills": ["skill1", "skill2"],
  "benefits": ["benefit1", "benefit2"],
  "applyLink": "${url}",
  "postedDate": "Date if visible / Unknown",
  "deadline": "Deadline if visible / Not specified"
}

Return ONLY the JSON object.`;

  const text = await invokeClaudeWithText(prompt);
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(text.trim());
  } catch {
    throw new Error('Failed to parse job details from AI response');
  }
}
