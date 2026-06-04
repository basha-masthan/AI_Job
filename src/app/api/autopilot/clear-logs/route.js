import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

const autopilotFile = path.join(process.cwd(), 'data', 'autopilot.json');

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const state = { active: false, logs: [] };
    fs.writeFileSync(autopilotFile, JSON.stringify(state));

    return NextResponse.json({ success: true, state });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
