import { NextResponse } from 'next/server';
import { callGroq } from '@/lib/ai';

export async function POST(request) {
  try {
    const { role, level, moduleTitle, moduleDescription } = await request.json();

    if (!role || !level || !moduleTitle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const systemPrompt = `You are an expert technical instructor and senior engineer. 
Write a comprehensive, engaging, and detailed lesson on a specific module for a user studying to become a '${role}' at the '${level}' level.
Your output must be pure Markdown format. Do NOT wrap it in JSON.
Include explanations, code examples (if applicable), best practices.
IMPORTANT: At the end of the module, you MUST include a Quiz with 5 to 10 questions to test the user's understanding of this specific module. Include the answers below the quiz.
Make it read like a premium technical blog post or textbook chapter.`;

    const userPrompt = `TARGET ROLE: ${role}
LEVEL: ${level}
MODULE TITLE: ${moduleTitle}
MODULE DESCRIPTION: ${moduleDescription}

Please generate the detailed markdown content for this module now. Do not include markdown code block backticks around the entire output.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    let text;
    try {
      text = await callGroq(messages, 4000);
    } catch (groqErr) {
      console.warn('Groq failed for chapter generation, falling back...', groqErr);
      const { invokeAI } = await import('@/lib/ai');
      text = await invokeAI(systemPrompt, userPrompt, 4000);
    }
    
    // Remove markdown code block if the AI accidentally wrapped the whole response in it
    if (text.startsWith('\`\`\`markdown')) {
      text = text.replace(/^\`\`\`markdown\n/, '').replace(/\n\`\`\`$/, '');
    } else if (text.startsWith('\`\`\`')) {
      text = text.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
    }

    return NextResponse.json({ content: text });
  } catch (error) {
    console.error('Chapter generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
