import { NextResponse } from 'next/server';
import { scrapeJobFromUrl } from '@/lib/scraper';
import { extractJobDetails } from '@/lib/ai';

export async function POST(request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    try { new URL(url); } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Scrape the page
    const scraped = await scrapeJobFromUrl(url);
    if (!scraped.success) {
      return NextResponse.json({ error: `Failed to fetch URL: ${scraped.error}` }, { status: 422 });
    }

    // Use AI to extract structured job details
    const jobDetails = await extractJobDetails(scraped.text, url);

    return NextResponse.json({ success: true, job: jobDetails, rawTitle: scraped.title });
  } catch (err) {
    console.error('Fetch job error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
