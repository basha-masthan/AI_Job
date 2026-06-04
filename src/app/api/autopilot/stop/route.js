import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { stopEngine, getAutopilotState } from '@/lib/autopilot-engine';

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await stopEngine();
    const state = getAutopilotState();

    return NextResponse.json({ success: true, state });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
