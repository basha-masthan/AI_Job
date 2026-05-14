import { NextResponse } from 'next/server';
import { getUserByEmail, saveUser } from '@/lib/users';
import { createToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const { email, code } = await request.json();

    const user = getUserByEmail(email);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (user.verificationCode !== code) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    user.verified = true;
    user.verificationCode = null;
    saveUser(user);

    // Auto-login after verification
    const token = await createToken({ id: user.email, email: user.email, name: user.name });
    cookies().set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
