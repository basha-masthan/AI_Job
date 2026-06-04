import { NextResponse } from 'next/server';
import { callOpenRouter, callGroq, callCerebras } from '@/lib/ai';
import { getApiKey } from '@/lib/config';
import { getSession } from '@/lib/auth';
import { getUserChats, getChatById, saveChatSession, deleteChatSession } from '@/lib/brain-chats';
import { v4 as uuid } from 'uuid';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: true, chats: [] });
    }
    const chats = getUserChats(session.email);
    return NextResponse.json({ success: true, chats });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getSession();
    const userId = session ? session.email : null;

    const { question, sessionId } = await req.json();
    if (!question) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    const systemPrompt = 'You are a helpful AI assistant. Give a direct, concise, and accurate answer in 1-2 sentences max. No preambles, no explanation of what you are doing — just the answer.';

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ];

    // Fast sequential fallback: Cerebras (fastest) → Groq → OpenRouter
    let answer = 'Could not get a response. Please try again.';
    const providers = [
      { name: 'Cerebras', key: 'CEREBRAS_API_KEY', fn: () => callCerebras(messages, 200) },
      { name: 'Groq', key: 'GROQ_API_KEY_1', fn: () => callGroq(messages, 200) },
      { name: 'OpenRouter', key: 'OPENROUTER_API_KEY_1', fn: () => callOpenRouter(messages, 200) },
    ];

    for (const provider of providers) {
      if (!getApiKey(provider.key)) continue;
      try {
        const result = await provider.fn();
        if (result && result.trim()) {
          answer = result.trim();
          break;
        }
      } catch (e) {
        console.warn(`${provider.name} failed: ${e.message}`);
      }
    }

    const newTurn = {
      id: uuid(),
      question,
      results: [],
      consensus: answer,
      createdAt: new Date().toISOString(),
    };

    let activeSessionId = sessionId;

    // Save history only if logged in
    if (userId) {
      let chatSession;
      if (sessionId) {
        chatSession = getChatById(sessionId, userId);
      }

      if (!chatSession) {
        chatSession = {
          id: uuid(),
          userId,
          title: question.length > 40 ? question.substring(0, 37) + '...' : question,
          messages: [],
          createdAt: new Date().toISOString(),
        };
      }

      chatSession.messages.push(newTurn);
      saveChatSession(chatSession);
      activeSessionId = chatSession.id;
    }

    return NextResponse.json({
      success: true,
      sessionId: activeSessionId,
      turn: newTurn,
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    deleteChatSession(sessionId, session.email);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
