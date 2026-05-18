import { NextResponse } from 'next/server';
import { getApiKey } from '@/lib/config';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  if (!q) return NextResponse.json({ error: 'Missing query' }, { status: 400 });

  const apiKey = getApiKey('GOOGLE_SEARCH_API_KEY');
  if (!apiKey) return NextResponse.json({ videos: [] });

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&key=${apiKey}&maxResults=1&type=video`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return NextResponse.json({ videos: [] });

    const data = await res.json();
    const videos = (data.items || []).map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.default?.url,
    }));

    return NextResponse.json({ videos });
  } catch (e) {
    return NextResponse.json({ videos: [] });
  }
}
