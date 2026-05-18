import { NextResponse } from 'next/server';
import { callGroq } from '@/lib/ai';
import { getOpenRouterKeys } from '@/lib/config';

export async function POST(req) {
  try {
    const { messages, role, difficulty } = await req.json();

    const systemPrompt = `You are an expert technical interviewer conducting a mock interview for the role of "${role || 'Software Engineer'}" at a "${difficulty || 'mid'}" level.
Rules:
1. Skip all introductions. Do NOT ask for the user's name, greetings, or basic personal questions.
2. Dive straight into asking highly relevant technical or situational interview questions for this specific role and difficulty level.
3. Speak clearly and concisely. Ask ONE question at a time.
4. Wait for the user to answer. React briefly to their answer, then ask the next question.
5. Keep your responses short (under 2-3 sentences max) so the voice engine can speak it naturally and quickly.
6. Sound professional, encouraging, and human. Do not use asterisks, emojis, or markdown (like *smiles* or bold asterisks), as they will be spoken out loud awkwardly by the voice synthesizer.`;

    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // Try Groq first for blazing-fast responses (sub-second latency!)
    try {
      const reply = await callGroq(formattedMessages, 150);
      if (reply) {
        return NextResponse.json({ reply });
      }
    } catch (groqErr) {
      console.warn('Groq failed in interview API, trying OpenRouter fallback...', groqErr.message);
    }

    // Fallback to OpenRouter (using Llama 3 8B Instruct Free)
    const keys = getOpenRouterKeys();
    const apiKey = keys[0];
    if (!apiKey) {
      return NextResponse.json({ error: 'No API Key configured.' }, { status: 400 });
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3-8b-instruct:free',
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter Error: ${err}`);
    }

    const data = await res.json();
    return NextResponse.json({ reply: data.choices[0].message.content });

  } catch (error) {
    console.error('Interview API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
