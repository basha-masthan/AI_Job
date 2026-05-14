import { NextResponse } from 'next/server';
import { toggleFavoriteResume } from '@/lib/store';
import { getSession } from '@/lib/auth';

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const updated = toggleFavoriteResume(params.id, session.email);
    if (!updated) return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    
    return NextResponse.json({ success: true, isFavorite: updated.isFavorite });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
