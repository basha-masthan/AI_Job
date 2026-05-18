import { NextResponse } from 'next/server';
import { safeJSONParse, callGroq } from '@/lib/ai';
import { getApiKey } from '@/lib/config';

export async function POST(request) {
  try {
    const { resumeText, targetRole } = await request.json();

    if (!resumeText || !targetRole) {
      return NextResponse.json({ error: 'Missing resume text or target role' }, { status: 400 });
    }

    const systemPrompt = `You are a professional career coach and technical upskilling expert. 
Analyze the candidate's resume against their target role and identify exact skill gaps.
Provide a structured learning roadmap to bridge those gaps.`;

    const userPrompt = `TARGET ROLE: ${targetRole}
    
CANDIDATE RESUME:
${resumeText.substring(0, 6000)}

Return a structured JSON object with:
{
  "summary": "2-sentence overview of the fit and main gaps",
  "skillGaps": [
    { "skill": "Skill Name", "priority": "High|Medium|Low", "reason": "Why it's needed for the target role" }
  ],
  "roadmap": [
    {
      "phase": "Phase 1: Fundamentals",
      "topics": [
        { "name": "Topic Name", "resources": "Search query for YouTube/Google" }
      ]
    }
  ],
  "projects": [
    { "name": "Project Idea", "description": "How this project demonstrates the missing skills" }
  ]
}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    let text;
    try {
      text = await callGroq(messages, 2048);
    } catch (groqErr) {
      console.warn(`Groq failed for training (${groqErr.message}), falling back to other providers`);
      const { invokeAI } = await import('@/lib/ai');
      text = await invokeAI(systemPrompt, userPrompt, 2048);
    }

    const analysis = safeJSONParse(text);
    if (!analysis) {
        throw new Error('AI returned invalid JSON. Please try again.');
    }
    
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Skill analysis error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
