import { NextResponse } from 'next/server';
import { notifyN8N } from '@/lib/n8n';

export async function POST(request) {
  try {
    const { event, data } = await request.json();
    await notifyN8N(event, data);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
