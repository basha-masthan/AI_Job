import { NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/google';
import { getSession } from '@/lib/auth';
import { getUserByEmail, saveUser } from '@/lib/users';

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.redirect(new URL('/job-tracker?error=NoCode', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
    }

    const oauth2Client = getGoogleOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    const user = getUserByEmail(session.email);
    if (!user) {
       return NextResponse.redirect(new URL('/job-tracker?error=UserNotFound', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
    }

    // Save tokens in DB
    user.googleAccessToken = tokens.access_token;
    if (tokens.refresh_token) {
        user.googleRefreshToken = tokens.refresh_token;
    }
    user.googleExpiryDate = tokens.expiry_date;
    
    saveUser(user);

    // Redirect to job tracker
    return NextResponse.redirect(new URL('/job-tracker?success=GoogleConnected', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  } catch (err) {
    console.error('Google Callback Error:', err);
    return NextResponse.redirect(new URL('/job-tracker?error=AuthFailed', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  }
}
