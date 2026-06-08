import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByEmail } from '@/lib/users';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserByEmail(session.email);
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
    const { saveUser } = await import('@/lib/users');
    const user = await getUserByEmail(session.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updatedUser = {
      ...user,
      phone: body.phone !== undefined ? body.phone : user.phone,
      address: body.address !== undefined ? body.address : user.address,
      education: body.education !== undefined ? body.education : user.education,
      experience: body.experience !== undefined ? body.experience : user.experience,
      jobStatus: body.jobStatus !== undefined ? body.jobStatus : user.jobStatus,
    };

    await saveUser(updatedUser);

    const { password, ...safeProfile } = updatedUser;
    return NextResponse.json({ success: true, profile: safeProfile });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
