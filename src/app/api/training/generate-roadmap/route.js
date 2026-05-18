import { NextResponse } from 'next/server';
import { safeJSONParse, callGroq } from '@/lib/ai';

export async function POST(request) {
  try {
    const { role, level, jobDescription } = await request.json();

    if (!role || !level) {
      return NextResponse.json({ error: 'Missing role or level' }, { status: 400 });
    }

    let systemPrompt = `You are a world-class technical curriculum designer.
Design a highly structured, comprehensive learning roadmap for a user who wants to master the role of '${role}' at a '${level}' level.`;

    if (jobDescription) {
      systemPrompt += `\n\nCRITICAL REQUIREMENT: This learning path MUST be explicitly tailored to prepare the candidate for the specific requirements, technologies, skills, and duties described in this Job Description (JD):\n"""\n${jobDescription}\n"""`;
    }

    systemPrompt += `\n\nThe roadmap should be broken down into logical chapters (modules) that the user can click into to learn detailed concepts.`;

    const userPrompt = `TARGET ROLE: ${role}
LEVEL: ${level}
${jobDescription ? 'CUSTOM JD TAILORED: Yes' : ''}

Return a structured JSON object exactly like this:
{
  "title": "Roadmap title",
  "description": "Short description of what the user will achieve",
  "chapters": [
    {
      "id": "chap-1",
      "title": "Chapter 1: Introduction to...",
      "modules": [
        {
          "id": "chap-1-mod-1",
          "title": "Module Title",
          "description": "Brief description of what this module covers"
        }
      ]
    }
  ]
}
Make sure the JSON is valid and do not include any other text.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    let text;
    try {
      text = await callGroq(messages, 2048);
    } catch (groqErr) {
      console.warn('Groq failed for roadmap generation, falling back...', groqErr);
      const { invokeAI } = await import('@/lib/ai');
      text = await invokeAI(systemPrompt, userPrompt, 2048);
    }

    const data = safeJSONParse(text);
    if (!data || !data.chapters) {
      throw new Error('AI returned invalid JSON.');
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Roadmap error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
