import { load } from 'cheerio';
import { getApiKey } from '@/lib/config';

export async function scrapeJobFromUrl(url) {
  try {
    // Attempt 0: LinkedIn Guest API (Super Reliable for LinkedIn)
    if (url.includes('linkedin.com/jobs/')) {
      try {
        let jobId = '';
        // Try multiple ways to extract the Job ID (usually 9-10 digits)
        const match = url.match(/-(\d{9,10})(?:\?|\/|$)/);
        if (match) {
          jobId = match[1];
        } else if (url.includes('currentJobId=')) {
          const urlObj = new URL(url);
          jobId = urlObj.searchParams.get('currentJobId');
        } else {
          const match2 = url.match(/\/view\/(\d{9,10})/);
          if (match2) jobId = match2[1];
        }

        if (jobId) {
          const guestUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
          console.log(`[Scraper] Using LinkedIn Guest API: ${guestUrl}`);
          
          const res = await fetch(guestUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
          });

          if (res.ok) {
            const html = await res.text();
            const $ = load(html);
            
            // Clean up
            $('script, style, .sr-only').remove();
            
            const title = $('.top-card-layout__title').text().trim() || $('.topcard__title').text().trim();
            const company = $('.topcard__org-name-link').text().trim() || $('.top-card-layout__organization-guest-details').text().trim();
            
            // Extract the actual description markup
            const descriptionHtml = $('.description__text').html() || $('.show-more-less-html__markup').html();
            const descriptionText = $(descriptionHtml || 'body').text().trim();

            if (descriptionText.length > 100) {
              return { 
                success: true, 
                text: descriptionText.substring(0, 10000), 
                title: title || 'LinkedIn Job', 
                company: company || '',
                url 
              };
            }
          }
        }
      } catch (e) {
        console.warn('LinkedIn Guest API failed:', e.message);
      }
    }

    // Attempt 1: Jina Reader API (Fast, Markdown-friendly)
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
        headers: {
          'X-With-Generated-Alt': 'true',
          'Accept': 'text/plain',
        },
        signal: AbortSignal.timeout(12000),
      });
      if (jinaRes.ok) {
        const text = await jinaRes.text();
        const isBlocked = text.includes('Security Check') || 
                          text.includes('security verification') || 
                          text.includes('Please verify you are a human') ||
                          text.includes('cf-browser-verification');
        
        const isNotFound = text.includes('Page not found') || text.includes('404 Not Found');

        if (text && text.length > 200 && !isBlocked && !isNotFound) {
          console.log('Jina Reader success for:', url);
          return { success: true, text: text.substring(0, 10000), title: 'Extracted via Jina', url };
        }
      }
    } catch (e) {
      console.warn('Jina Reader failed, trying Tavily Extract:', e.message);
    }

    // Attempt 2: Tavily Extract (Premium Fallback with Key Rotation)
    const TAVILY_KEYS = getTavilyKeys();
    for (const key of TAVILY_KEYS) {
      if (!key) continue;
      try {
        const tavilyRes = await fetch('https://api.tavily.com/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: key,
            urls: [url]
          }),
          signal: AbortSignal.timeout(15000)
        });
        if (tavilyRes.ok) {
          const data = await tavilyRes.json();
          const result = data.results?.[0];
          if (result && result.raw_content && result.raw_content.length > 150) {
            console.log('Tavily Extract success with key:', key.substring(0, 8) + '...');
            return { 
              success: true, 
              text: result.raw_content.substring(0, 10000), 
              title: result.title || 'Extracted via Tavily', 
              url 
            };
          }
        }
      } catch (e) {
        console.warn('Tavily Extract failed for key:', key.substring(0, 8) + '...', e.message);
      }
    }

    // Attempt 3: Basic Fetch + Cheerio
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    // Use Cheerio (imported at top)
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

    const isBlocked = cleanText.includes('Security Check') || 
                      cleanText.includes('security verification') || 
                      cleanText.includes('Please verify you are a human') ||
                      title.includes('Just a moment');

    if (isBlocked || cleanText.length < 100) {
      throw new Error("This website has strong bot protection. Please use the 'Manual Paste' option instead.");
    }

    return { success: true, text: cleanText, title, url };
  } catch (err) {
    return { success: false, error: err.message, url };
  }
}
