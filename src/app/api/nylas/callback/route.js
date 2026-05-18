import { NextResponse } from 'next/server';
import { getNylasClient } from '@/lib/nylas';
import { getSession } from '@/lib/auth';
import { getUserByEmail, saveUser } from '@/lib/users';
import { getApiKey } from '@/lib/config';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login?error=Please login first`);
    }

    const nylas = getNylasClient();
    
    const response = await nylas.auth.exchangeCodeForToken({
      clientId: getApiKey('NYLAS_CLIENT_ID'),
      clientSecret: getApiKey('NYLAS_CLIENT_SECRET'),
      code: code,
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/nylas/callback`,
    });

    const { grantId, email } = response;

    const user = getUserByEmail(session.email);
    if (user) {
      user.nylasGrantId = grantId;
      user.nylasEmail = email;
      saveUser(user);
      console.log(`Successfully connected ${email} to user ${session.email} with Grant ID: ${grantId}`);
    }

    // Redirect back to dashboard with success message
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/job-tracker?email_connected=true`);
  } catch (err) {
    console.error('Nylas callback error:', err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/job-tracker?email_connected=false`);
  }
}
