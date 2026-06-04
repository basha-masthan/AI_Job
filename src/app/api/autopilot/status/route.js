import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAutopilotState, getActiveRun, getRuns } from '@/lib/autopilot-engine';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const state = getAutopilotState();
    const activeRun = getActiveRun();
    const allRuns = getRuns(session.email);

    return NextResponse.json({
      success: true,
      state,
      activeRun,
      recentRuns: allRuns.slice(0, 5),
      totalRuns: allRuns.length,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
