import { getResumeById } from '@/lib/store';
import { getSession } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const session = await getSession();
    if (!session) return new Response('Unauthorized', { status: 401 });

    const { id } = params;
    const resume = getResumeById(id, session.email);
    if (!resume) return new Response('Resume not found', { status: 404 });

    if (!resume.cloudinaryUrl) {
      return new Response('No file associated with this resume', { status: 404 });
    }

    const url = new URL(request.url);
    const inline = url.searchParams.get('inline') === '1';

    const cloudinaryRes = await fetch(resume.cloudinaryUrl);
    if (!cloudinaryRes.ok) {
      return new Response(`Failed to fetch from Cloudinary: ${cloudinaryRes.status}`, { status: 502 });
    }

    const buffer = Buffer.from(await cloudinaryRes.arrayBuffer());

    const baseName = (resume.fileName || `Resume_${resume.data?.name || 'Tailored'}`)
      .replace(/\.[Pp][Dd][Ff]$/, '')
      .replace(/[^\w\s.-]/g, '_')
      .replace(/\s+/g, '_');

    const filename = `${baseName}.pdf`;
    const disposition = inline
      ? `inline; filename="${filename}"`
      : `attachment; filename="${filename}"`;

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(buffer.length),
        'Content-Disposition': disposition,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (err) {
    console.error('Download proxy error:', err);
    return new Response(err.message, { status: 500 });
  }
}
