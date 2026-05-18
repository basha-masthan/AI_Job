import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByEmail } from '@/lib/users';
import { getGoogleOAuthClient } from '@/lib/google';
import { google } from 'googleapis';

// Helper to get subject from headers
function getHeader(headers, name) {
  const header = headers?.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
}

export async function GET(request) {
  try {
    const session = await getSession();
    if (!session || session.email !== 'admin@fbt.com') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('email');
    if (!userEmail) return NextResponse.json({ error: 'Email parameter required' }, { status: 400 });

    const user = getUserByEmail(userEmail);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (!user.googleRefreshToken) {
      return NextResponse.json({ error: 'User has not connected their Google account' }, { status: 400 });
    }

    const oauth2Client = getGoogleOAuthClient();
    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
      expiry_date: user.googleExpiryDate
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch latest 15 emails
    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 15
    });

    const messages = res.data.messages || [];
    if (messages.length === 0) {
      return NextResponse.json({ success: true, emails: [] });
    }

    const emailDetails = [];
    for (const msgRef of messages) {
      try {
        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id: msgRef.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date']
        });

        const headers = msgRes.data.payload?.headers || [];
        emailDetails.push({
          id: msgRef.id,
          subject: getHeader(headers, 'subject') || 'No Subject',
          from: getHeader(headers, 'from') || 'Unknown Sender',
          date: getHeader(headers, 'date') || '',
          snippet: msgRes.data.snippet
        });
      } catch (e) {
        console.error('Error fetching individual message metadata', e);
      }
    }

    return NextResponse.json({ success: true, emails: emailDetails });
  } catch (err) {
    console.error('Admin fetching emails error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
