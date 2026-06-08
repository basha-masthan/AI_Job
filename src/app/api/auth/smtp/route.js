import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { smtpUser, smtpPass, smtpHost, smtpPort } = await request.json();

    if (!smtpUser || !smtpPass) {
      return NextResponse.json({ error: 'Email and app password are required.' });
    }

    const host = smtpHost || 'smtp.gmail.com';
    const port = parseInt(smtpPort) || 587;

    await dbConnect();
    await User.findOneAndUpdate(
      { email: session.email.toLowerCase() },
      {
        $set: {
          'smtp.user': smtpUser,
          'smtp.pass': smtpPass,
          'smtp.host': host,
          'smtp.port': port,
          'smtp.configured': true,
          onboardingComplete: true,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[auth/smtp] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const user = await User.findOne({ email: session.email.toLowerCase() }).lean();

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({
      success: true,
      smtpConfigured: user.smtp?.configured || false,
      onboardingComplete: user.onboardingComplete || false,
      smtp: user.smtp
        ? { host: user.smtp.host, port: user.smtp.port, user: user.smtp.user, configured: user.smtp.configured }
        : null,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
