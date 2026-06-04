import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { pauseEngine, getAutopilotState } from '@/lib/autopilot-engine';

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await pauseEngine();
    const state = getAutopilotState();

    return NextResponse.json({ success: true, state });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
