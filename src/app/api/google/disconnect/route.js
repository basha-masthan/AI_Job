import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserByEmail, saveUser } from '@/lib/users';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = getUserByEmail(session.email);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  delete user.googleRefreshToken;
  delete user.googleAccessToken;
  delete user.googleExpiryDate;
  delete user.lastGoogleSyncTime;
  saveUser(user);

  return NextResponse.json({ success: true });
}
