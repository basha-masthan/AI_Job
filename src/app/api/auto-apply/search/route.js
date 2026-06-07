import { NextResponse } from 'next/server';
import { searchJobs } from '@/lib/auto-apply/search';
import { getSession } from '@/lib/auth';

export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { targetRole, targetLocation, experienceLevels, skills } = body;

    if (!targetRole) {
      return NextResponse.json({ error: 'targetRole is required' }, { status: 400 });
    }

    const result = await searchJobs({
      targetRole,
      targetLocation: targetLocation || 'India',
      experienceLevels: experienceLevels || [],
      skills: skills || [],
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[Auto-Apply Search] Error:', err.message);
    return NextResponse.json({ error: err.message, jobs: [], queries: [], stats: {} }, { status: 500 });
  }
}
