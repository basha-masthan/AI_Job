import { NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/google';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
    }

    const oauth2Client = getGoogleOAuthClient();

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // Force consent screen to always get a refresh token
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'profile',
        'email'
      ]
    });

    return NextResponse.redirect(url);
  } catch (err) {
    console.error('Google Auth Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
