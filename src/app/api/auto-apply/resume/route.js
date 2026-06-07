import { NextResponse } from 'next/server';
import { resumeEngine } from '@/lib/auto-apply/engine';
import { getSession } from '@/lib/auth';

export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  resumeEngine();
  return NextResponse.json({ success: true });
}
