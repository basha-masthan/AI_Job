import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getApiKey } from '@/lib/config';

async function testOpenRouter() {
  const key = getApiKey('OPENROUTER_API_KEY');
  if (!key) return { status: 'missing', message: 'No API key configured' };
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getApiKey('OPENROUTER_MODEL') || 'openrouter/free',
        messages: [{ role: 'user', content: 'reply with only the word: ok' }],
        max_tokens: 10,
      }),
    });
    if (res.ok) return { status: 'ok', message: 'Working' };
    const err = await res.text();
    if (res.status === 402) return { status: 'low_credits', message: 'Out of credits (402)' };
    if (res.status === 429) return { status: 'rate_limited', message: 'Rate limited (429)' };
    return { status: 'error', message: `HTTP ${res.status}: ${err.substring(0, 100)}` };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

async function testCerebras() {
  const key = getApiKey('CEREBRAS_API_KEY');
  if (!key) return { status: 'missing', message: 'No API key configured' };
  try {
    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getApiKey('CEREBRAS_MODEL') || 'llama3.1-8b',
        messages: [{ role: 'user', content: 'reply with only the word: ok' }],
        max_tokens: 10,
      }),
    });
    if (res.ok) return { status: 'ok', message: 'Working' };
    const err = await res.text();
    return { status: 'error', message: `HTTP ${res.status}: ${err.substring(0, 100)}` };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

async function testGroq() {
  const key = getApiKey('GROQ_API_KEY');
  if (!key) return { status: 'missing', message: 'No API key configured' };
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getApiKey('GROQ_MODEL') || 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'reply with only the word: ok' }],
        max_tokens: 10,
      }),
    });
    if (res.ok) return { status: 'ok', message: 'Working' };
    const err = await res.text();
    return { status: 'error', message: `HTTP ${res.status}: ${err.substring(0, 100)}` };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

async function testGemini() {
  const key = getApiKey('GEMINI_API_KEY');
  if (!key) return { status: 'missing', message: 'No API key configured' };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'reply ok' }] }], generationConfig: { maxOutputTokens: 10 } }),
    });
    if (res.ok) return { status: 'ok', message: 'Working' };
    const err = await res.text();
    return { status: 'error', message: `HTTP ${res.status}: ${err.substring(0, 100)}` };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

async function testHuggingFace() {
  const key = getApiKey('HF_TOKEN');
  if (!key) return { status: 'missing', message: 'No token configured' };
  try {
    const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getApiKey('HF_MODEL') || 'deepseek-ai/DeepSeek-V4-Pro:cheapest',
        messages: [{ role: 'user', content: 'reply ok' }],
        max_tokens: 10,
      }),
    });
    if (res.ok) return { status: 'ok', message: 'Working' };
    const err = await res.text();
    return { status: 'error', message: `HTTP ${res.status}: ${err.substring(0, 100)}` };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session || session.email !== 'admin@fbt.com') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { provider } = await request.json();

    const testers = {
      cerebras: testCerebras,
      openrouter: testOpenRouter,
      groq: testGroq,
      gemini: testGemini,
      huggingface: testHuggingFace,
    };

    if (provider === 'all') {
      const results = {};
      for (const [name, tester] of Object.entries(testers)) {
        results[name] = await tester();
      }
      return NextResponse.json({ success: true, results });
    }

    const tester = testers[provider];
    if (!tester) return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });

    const result = await tester();
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
