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

    const existingUser = await getUserByEmail(email);
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

    await saveUser(user);

    let emailSent = false;
    try {
      await sendVerificationEmail(email, verificationCode);
      emailSent = true;
    } catch (emailErr) {
      console.error('[auth/register] Email send failed:', emailErr.message);
    }

    if (!emailSent) {
      user.verified = true;
      user.verificationCode = null;
      await saveUser(user);
    }

    return NextResponse.json({ 
      success: true, 
      message: emailSent ? 'Check your email for verification code.' : 'Account created and ready to use.',
      autoVerified: !emailSent,
    });
  } catch (err) {
    console.error('[auth/register] Error:', err);
    if (err.message && (err.message.includes('MONGODB_URI') || err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED') || err.message.includes('authentication'))) {
      return NextResponse.json({ 
        error: 'Database connection failed. Please ensure MONGODB_URI is configured correctly in your deployment environment.' 
      }, { status: 500 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
