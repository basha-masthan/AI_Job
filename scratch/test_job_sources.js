const fs = require('fs');
const path = require('path');

// Manual .env.local parser
const env = {};
try {
  const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.substring(0, idx).trim();
    let val = trimmed.substring(idx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[key] = val;
  });
} catch (err) {
  console.error('Failed to read .env.local:', err.message);
}

const queryParam = encodeURIComponent('Full stack developer');
const locParam = encodeURIComponent('Hyderabad');
const targetLoc = 'Hyderabad';

async function testAdzuna() {
  console.log('\n--- Testing Adzuna ---');
  try {
    const url = `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${env.ADZUNA_APP_ID}&app_key=${env.ADZUNA_APP_KEY}&results_per_page=5&what=${queryParam}&where=${locParam}&content-type=application/json`;
    console.log('URL:', url);
    const res = await fetch(url);
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Results Count:', data.results ? data.results.length : 'none');
    if (data.results && data.results.length > 0) {
      console.log('First result title:', data.results[0].title);
      console.log('First result company:', data.results[0].company);
    } else {
      console.log('Response body:', JSON.stringify(data).substring(0, 500));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

async function testJSearch() {
  console.log('\n--- Testing JSearch ---');
  try {
    const rapidKey = env.RAPIDAPI_KEY_1 || env.RAPIDAPI_KEY || '';
    const url = `https://jsearch.p.rapidapi.com/search?query=${queryParam}+jobs+in+${locParam}&num_pages=1&page=1&date_posted=month&num_results=5`;
    console.log('URL:', url);
    const res = await fetch(url, { headers: { 'X-RapidAPI-Key': rapidKey, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' } });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Results Count:', data.data ? data.data.length : 'none');
    if (data.data && data.data.length > 0) {
      console.log('First result title:', data.data[0].job_title);
      console.log('First result employer:', data.data[0].employer_name);
    } else {
      console.log('Response body:', JSON.stringify(data).substring(0, 500));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

async function testLinkedIn() {
  console.log('\n--- Testing LinkedIn RapidAPI ---');
  try {
    const rapidKey = env.RAPIDAPI_KEY_1 || env.RAPIDAPI_KEY || '';
    const url = `https://linkedin-job-search-api.p.rapidapi.com/active-jb-1h?offset=0&title_filter=${queryParam}&location_filter=${locParam}&description_type=text`;
    console.log('URL:', url);
    const res = await fetch(url, { headers: { 'X-RapidAPI-Key': rapidKey, 'X-RapidAPI-Host': 'linkedin-job-search-api.p.rapidapi.com' } });
    console.log('Status:', res.status);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.data || data.results || []);
    console.log('Results Count:', list.length);
    if (list.length > 0) {
      console.log('First result:', list[0]);
    } else {
      console.log('Response body:', JSON.stringify(data).substring(0, 500));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

async function testIndeed() {
  console.log('\n--- Testing Indeed RapidAPI ---');
  try {
    const rapidKey = env.RAPIDAPI_KEY_1 || env.RAPIDAPI_KEY || '';
    const url = `https://indeed12.p.rapidapi.com/jobs/search?query=${queryParam}&location=${locParam}&page=1`;
    console.log('URL:', url);
    const res = await fetch(url, { headers: { 'X-RapidAPI-Key': rapidKey, 'X-RapidAPI-Host': 'indeed12.p.rapidapi.com' } });
    console.log('Status:', res.status);
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.data || data.results || data.jobs || []);
    console.log('Results Count:', list.length);
    if (list.length > 0) {
      console.log('First result:', list[0]);
    } else {
      console.log('Response body:', JSON.stringify(data).substring(0, 500));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

async function testSerper() {
  console.log('\n--- Testing Serper (Google Search) ---');
  try {
    const serperKey = env.SERPER_API_KEY || 'dda58ce4c8a6238a447510f8536ad4581f200731';
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: `Full stack developer jobs Hyderabad`, num: 10 }),
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Organic results count:', data.organic ? data.organic.length : 'none');
    if (data.organic && data.organic.length > 0) {
      console.log('First result title:', data.organic[0].title);
      console.log('First result link:', data.organic[0].link);
    } else {
      console.log('Response body:', JSON.stringify(data).substring(0, 500));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

async function runAll() {
  await testAdzuna();
  await testJSearch();
  await testLinkedIn();
  await testIndeed();
  await testSerper();
}

runAll();
