export async function scrapeJobFromUrl(url) {
  try {
    // Attempt 1: Jina Reader (Excellent for LinkedIn/Indeed/Protected sites)
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
        headers: { 'Accept': 'text/plain' },
        signal: AbortSignal.timeout(10000),
      });
      if (jinaRes.ok) {
        const text = await jinaRes.text();
        if (text && text.length > 300 && !text.includes('Sign in') && !text.includes('Security Check')) {
          console.log('Jina Reader success for:', url);
          return { success: true, text: text.substring(0, 10000), title: 'Extracted via Jina', url };
        }
      }
    } catch (e) {
      console.warn('Jina Reader failed, falling back to basic scraper:', e.message);
    }

    // Attempt 2: Basic Fetch + Cheerio
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    // Dynamic import of cheerio (server-side only)
    const { load } = await import('cheerio');
    const $ = load(html);

    // Remove noise
    $('script, style, nav, footer, header, .cookie-banner, .ad, [class*="ad-"], [id*="cookie"]').remove();

    // Extract meaningful text
    const title = $('title').text().trim() ||
      $('h1').first().text().trim() ||
      $('[class*="job-title"]').first().text().trim();

    // Try to get main content
    const contentSelectors = [
      '[class*="job-description"]',
      '[class*="description"]',
      '[class*="job-details"]',
      '[class*="posting"]',
      'main',
      'article',
      '.content',
      '#content',
    ];

    let mainContent = '';
    for (const selector of contentSelectors) {
      const el = $(selector).first();
      if (el.length && el.text().length > 200) {
        mainContent = el.text();
        break;
      }
    }

    if (!mainContent) mainContent = $('body').text();

    // Clean up whitespace
    const cleanText = mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .substring(0, 8000);

    return { success: true, text: cleanText, title, url };
  } catch (err) {
    return { success: false, error: err.message, url };
  }
}
