import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getUserByEmail, saveUser } from '@/lib/users';
import { sendVerificationEmail } from '@/lib/mail';

export async function POST(request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const existingUser = getUserByEmail(email);
    if (existingUser && existingUser.verified) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const user = {
      name,
      email,
      password: hashedPassword,
      verified: false,
      verificationCode,
      createdAt: new Date().toISOString(),
    };

    saveUser(user);
    await sendVerificationEmail(email, verificationCode);

    return NextResponse.json({ success: true, message: 'Verification email sent' });
  } catch (err) {
    console.error('Registration error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
