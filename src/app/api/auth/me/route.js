import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findOne({ email: session.email.toLowerCase() }).lean();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { password, ...safeProfile } = user;
    return NextResponse.json({ success: true, profile: safeProfile });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    await dbConnect();

    const updateFields = {};
    if (body.phone !== undefined) updateFields['profile.phone'] = body.phone;
    if (body.address !== undefined) updateFields['profile.address'] = body.address;
    if (body.education !== undefined) updateFields['profile.education'] = body.education;
    if (body.experience !== undefined) updateFields['profile.experience'] = body.experience;
    if (body.jobStatus !== undefined) updateFields['profile.jobStatus'] = body.jobStatus;
    if (body.smtpHost !== undefined) updateFields['smtp.host'] = body.smtpHost;
    if (body.smtpPort !== undefined) updateFields['smtp.port'] = parseInt(body.smtpPort) || 587;
    if (body.smtpUser !== undefined) updateFields['smtp.user'] = body.smtpUser;
    if (body.smtpPass !== undefined) updateFields['smtp.pass'] = body.smtpPass;
    if (body.smtpConfigured !== undefined) updateFields['smtp.configured'] = body.smtpConfigured;
    if (body.onboardingComplete !== undefined) updateFields['onboardingComplete'] = body.onboardingComplete;

    updateFields['updatedAt'] = new Date();

    const user = await User.findOneAndUpdate(
      { email: session.email.toLowerCase() },
      { $set: updateFields },
      { new: true }
    ).lean();

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { password, ...safeProfile } = user;
    return NextResponse.json({ success: true, profile: safeProfile });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
