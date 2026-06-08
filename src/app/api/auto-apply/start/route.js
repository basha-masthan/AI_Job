import { NextResponse } from 'next/server';
import { startEngine } from '@/lib/auto-apply/engine';
import { getSession } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { targetRole, targetLocation, experienceLevels, resumeId, dailyCap, stepMode } = body;

    if (!targetRole) return NextResponse.json({ error: 'targetRole required' }, { status: 400 });
    if (!resumeId) return NextResponse.json({ error: 'resumeId required' }, { status: 400 });

    let smtp = null;
    try {
      await dbConnect();
      const user = await User.findOne({ email: session.email.toLowerCase() }).lean();
      if (user?.smtp?.configured) {
        smtp = { user: user.smtp.user, pass: user.smtp.pass, host: user.smtp.host, port: user.smtp.port };
      }
    } catch {}

    const run = await startEngine({
      targetRole,
      targetLocation,
      experienceLevels: experienceLevels || [],
      resumeId,
      dailyCap: dailyCap || 50,
      stepMode: stepMode !== false,
      userId: session.email || session.user?.id || session.userId || 'default',
      smtp,
    });

    return NextResponse.json({ run });
  } catch (err) {
    console.error('[Auto-Apply Start]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
