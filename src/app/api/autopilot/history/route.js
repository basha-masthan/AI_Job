import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRuns } from '@/lib/autopilot-engine';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const runs = getRuns(session.email);

    const summary = runs.map(r => ({
      id: r.id,
      targetRole: r.targetRole,
      targetLocation: r.targetLocation,
      status: r.status,
      startedAt: r.startedAt,
      stats: r.stats,
      totalJobs: r.jobs.length,
      appliedJobs: r.jobs.filter(j => j.status === 'applied').length,
      failedJobs: r.jobs.filter(j => j.status === 'failed').length,
    }));

    return NextResponse.json({ success: true, runs: summary });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
