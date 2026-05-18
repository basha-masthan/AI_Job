import { NextResponse } from 'next/server';
import { getPathById, savePath, deletePath } from '@/lib/store';
import { getSession } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const pathObj = getPathById(params.id, session.email);
    if (!pathObj) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, path: pathObj });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await request.json();
    const existing = getPathById(params.id, session.email);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
    const updated = { ...existing, ...body };
    const saved = savePath(updated, session.email);
    return NextResponse.json({ success: true, path: saved });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    deletePath(params.id, session.email);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
