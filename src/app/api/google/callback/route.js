import { NextResponse } from 'next/server';
import { getGoogleOAuthClient } from '@/lib/google';
import { getSession } from '@/lib/auth';
import { getUserByEmail, saveUser } from '@/lib/users';
import { getAppUrl } from '@/lib/config';

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.redirect(new URL('/login', getAppUrl()));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.redirect(new URL('/?error=NoCode', getAppUrl()));
    }

    const oauth2Client = getGoogleOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    const user = await getUserByEmail(session.email);
    if (!user) {
       return NextResponse.redirect(new URL('/?error=UserNotFound', getAppUrl()));
    }

    // Save tokens in DB
    user.googleAccessToken = tokens.access_token;
    if (tokens.refresh_token) {
        user.googleRefreshToken = tokens.refresh_token;
    }
    user.googleExpiryDate = tokens.expiry_date;
    
    await saveUser(user);

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/?success=GoogleConnected', getAppUrl()));
  } catch (err) {
    console.error('Google Callback Error:', err);
    return NextResponse.redirect(new URL('/?error=AuthFailed', getAppUrl()));
  }
}
