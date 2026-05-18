import { NextResponse } from 'next/server';
import { callOpenRouter, callGroq, callGemini, callCerebras, callHuggingFace } from '@/lib/ai';
import { getApiKey } from '@/lib/config';

export async function POST(req) {
  try {
    const { question } = await req.json();
    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const systemPrompt = "You are an expert AI answering a multiple choice question or a general query. Provide your best answer. If it's a multiple choice question, clearly state the correct option. Keep your answer concise (under 50 words).";
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ];

    const tasks = [
      { name: 'OpenRouter (GPT/Claude)', key: 'OPENROUTER_API_KEY', fn: () => callOpenRouter(messages, 150) },
      { name: 'Groq (Llama 3)', key: 'GROQ_API_KEY_1', fn: () => callGroq(messages, 150) },
      { name: 'Gemini 2.0', key: 'GEMINI_API_KEY', fn: () => callGemini(systemPrompt, question, 150) },
      { name: 'Cerebras (Llama 3.1)', key: 'CEREBRAS_API_KEY', fn: () => callCerebras(messages, 150) },
      { name: 'HuggingFace (DeepSeek)', key: 'HF_TOKEN', fn: () => callHuggingFace(messages, 150) },
    ];

    const results = [];
    const promises = tasks.map(async (task) => {
      try {
        const start = Date.now();
        const answer = await task.fn();
        const duration = Date.now() - start;
        results.push({ name: task.name, status: 'success', answer: answer.trim(), duration });
      } catch (e) {
        if (e.message.toLowerCase().includes('missing') || e.message.toLowerCase().includes('not configured')) {
          return; // Silently skip unconfigured models
        }
        results.push({ name: task.name, status: 'error', answer: `Failed: ${e.message}` });
      }
    });

    await Promise.allSettled(promises);

    // After gathering answers, compute a consensus string using the active AI provider.
    let consensus = "Could not determine consensus. Try again.";
    const successfulAnswers = results.filter(r => r.status === 'success').map(r => `[${r.name}]: ${r.answer}`).join('\n');
    
    if (successfulAnswers.length > 0) {
      const consensusPrompt = `
You are an AI consensus aggregator.
A user asked: "${question}"

Here are the answers from various top AI models:
${successfulAnswers}

Analyze these answers. Which option/answer is the most commonly chosen? Summarize the final consensus in 1-2 sentences. Format: "Consensus: <your summary>".
`;
      try {
        consensus = await callGroq([
          { role: 'system', content: 'You are an aggregator that finds the consensus among multiple AI models.' },
          { role: 'user', content: consensusPrompt }
        ], 150);
      } catch (e) {
        // Fallback to OpenRouter if Groq fails
        try {
          consensus = await callOpenRouter([
            { role: 'system', content: 'You are an aggregator that finds the consensus among multiple AI models.' },
            { role: 'user', content: consensusPrompt }
          ], 150);
        } catch (e2) {
          consensus = "Consensus could not be calculated (API limits reached).";
        }
      }
    }

    return NextResponse.json({ results, consensus: consensus.trim() });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
