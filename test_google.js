const fs = require('fs');
const path = require('path');

async function testAllActiveKeys() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Only match lines that START with the variable (not comments)
  const geminiKey = envContent.match(/^GEMINI_API_KEY=(.*)/m)?.[1]?.trim();
  const searchKey = envContent.match(/^GOOGLE_SEARCH_API_KEY=(.*)/m)?.[1]?.trim();
  const cx = envContent.match(/^GOOGLE_SEARCH_CX=(.*)/m)?.[1]?.trim();
  
  console.log('--- Final Diagnostic ---');
  console.log('Testing Active Search Key:', searchKey ? searchKey.substring(0, 10) + '...' : 'MISSING');
  console.log('Testing CX ID:', cx);

  if (!searchKey || !cx) {
      console.log('❌ Error: Missing active keys. Check if you have "#" in front of them.');
      return;
  }

  const url = `https://www.googleapis.com/customsearch/v1?key=${searchKey}&cx=${cx}&q=jobs`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.error) {
      console.log(`❌ FAILED: ${data.error.message}`);
      if (data.error.message.includes('access to Custom Search')) {
          console.log('\n💡 LAST STEP: Enable the STANDARD "Custom Search API" in your gen-lang-client project.');
      }
    } else {
      console.log(`\n✅ CONGRATULATIONS! GOOGLE SEARCH IS WORKING!`);
      console.log(`Found ${data.items ? data.items.length : 0} results.`);
      console.log(`\n🚀 YOUR APP IS NOW 100% OPERATIONAL.`);
    }
  } catch (err) {
    console.log(`💥 ERROR: ${err.message}`);
  }
}

testAllActiveKeys();
