import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { startEngine, getAutopilotState, getActiveRun } from '@/lib/autopilot-engine';

export async function POST(req) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobTitle, location, resumeId, dailyCap } = await req.json();

    if (!jobTitle || !resumeId) {
      return NextResponse.json({ success: false, error: 'Target role and resume are required.' });
    }

    const existing = getActiveRun();
    if (existing) {
      return NextResponse.json({ success: false, error: 'Autopilot is already running or paused. Stop it first.' });
    }

    await startEngine({
      targetRole: jobTitle,
      targetLocation: location || '',
      resumeId,
      userId: session.email,
      dailyCap: Math.min(100, Math.max(1, parseInt(dailyCap) || 50)),
    });

    const state = getAutopilotState();
    return NextResponse.json({ success: true, state });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
