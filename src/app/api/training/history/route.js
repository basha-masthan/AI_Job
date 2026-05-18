import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getInterviewHistory, getMcqHistory } from '@/lib/training';

export async function GET(req) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.email;
    const url = new URL(req.url);
    const type = url.searchParams.get('type'); // 'mock-interview' or 'technical-mock'

    if (type === 'mock-interview') {
      const history = getInterviewHistory(userId);
      return NextResponse.json(history);
    }

    if (type === 'technical-mock') {
      const history = getMcqHistory(userId);
      return NextResponse.json(history);
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('History GET API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
