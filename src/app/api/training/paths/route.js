import { NextResponse } from 'next/server';
import { getAllPaths, savePath } from '@/lib/store';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const paths = getAllPaths(session.email);
    return NextResponse.json({ success: true, paths });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await request.json();
    const pathObj = savePath(body, session.email);
    return NextResponse.json({ success: true, path: pathObj });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
