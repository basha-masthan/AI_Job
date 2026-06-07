import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(l => { const m = l.match(/^([^=#][^=]*)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim(); });

const { extractJobFromText, searchWithTavily, searchWithJina } = await import('../src/lib/recruiter-finder.js');

// Test 1: LLM extraction on a known hiring text
console.log('\n=== TEST 1: LLM Extraction ===');
const sampleText = `We are Hiring! TechSolutions Pvt Ltd is looking for Full Stack Developers for our Hyderabad office.
Role: Full Stack Developer
Experience: 2-4 years with React and Node.js  
Location: Hitech City, Hyderabad
Salary: 8-15 LPA
Interested candidates please send your resume to hr@techsolutions.in
Contact: Priya HR | 9876543210`;

const result = await extractJobFromText(sampleText, 'https://example.com/job', 'Full Stack Developer');
console.log('Extraction result:', JSON.stringify(result, null, 2));

// Test 2: Tavily search
console.log('\n=== TEST 2: Tavily Search ===');
const tavilyResults = await searchWithTavily('Full Stack Developer hiring Hyderabad email resume apply', 3);
console.log(`Tavily returned ${tavilyResults.length} results`);
tavilyResults.forEach((r, i) => console.log(`  [${i+1}] ${r.url} (${r.text.length} chars)`));

// Test 3: Jina search
console.log('\n=== TEST 3: Jina Search ===');
const jinaResults = await searchWithJina('Full Stack Developer hiring Hyderabad email apply', 3);
console.log(`Jina returned ${jinaResults.length} results`);
jinaResults.forEach((r, i) => console.log(`  [${i+1}] ${r.url} (${r.text.length} chars)`));
