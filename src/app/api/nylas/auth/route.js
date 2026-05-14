import { NextResponse } from 'next/server';
import { getNylasClient } from '@/lib/nylas';

export async function GET(request) {
  try {
    const nylas = getNylasClient();
    
    const clientId = process.env.NYLAS_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: 'NYLAS_CLIENT_ID is missing in .env.local' }, { status: 500 });
    }

    const authUrl = nylas.auth.urlForOAuth2({
      clientId: clientId,
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/nylas/callback`,
    });

    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error('Nylas auth error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
