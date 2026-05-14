import { NextResponse } from 'next/server';
import { extractJobDetails } from '@/lib/ai';

export async function POST(request) {
  try {
    const { text } = await request.json();
    if (!text) return NextResponse.json({ error: 'Text is required' }, { status: 400 });

    const job = await extractJobDetails(text, 'Manual Paste');
    return NextResponse.json({ success: true, job });
  } catch (err) {
    console.error('Manual extract error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
