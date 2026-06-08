import { NextResponse } from 'next/server';
import { startPictureApply, getPictureProgress, resetPictureProgress } from '@/lib/auto-apply/image-apply';
import { getSession } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(req) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { images, resumeId, useAiResume } = body;

    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'At least one image is required' }, { status: 400 });
    }

    const userId = session.email || session.user?.id || 'default';

    let smtp = null;
    try {
      await dbConnect();
      const user = await User.findOne({ email: session.email.toLowerCase() }).lean();
      if (user?.smtp?.configured) {
        smtp = { user: user.smtp.user, pass: user.smtp.pass, host: user.smtp.host, port: user.smtp.port };
      }
    } catch {}

    const result = await startPictureApply({
      images: images.map(img => ({
        base64: img.base64 || img.imageBase64,
        mimeType: img.mimeType || 'image/png',
      })),
      userId,
      resumeId,
      useAiResume: !!useAiResume,
      smtp,
    });

    return NextResponse.json(result || {});
  } catch (err) {
    console.error('[Picture Apply API]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(await getPictureProgress());
}

export async function DELETE() {
  return NextResponse.json(await resetPictureProgress());
}
