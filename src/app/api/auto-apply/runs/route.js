import { NextResponse } from 'next/server';
import { getRuns } from '@/lib/auto-apply/engine';
import { getSession } from '@/lib/auth';

export async function GET(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ runs: getRuns() });
}
