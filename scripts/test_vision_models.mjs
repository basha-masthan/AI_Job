import fs from 'fs';
import path from 'path';

// Load .env.local manually
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
} catch (e) {
  console.log('Could not load .env.local manually');
}

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY_1 || process.env.OPENROUTER_API_KEY_2;

const MODELS = [
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'moonshotai/kimi-k2.6:free',
  'nvidia/nemotron-nano-12b-v2-vl:free',
  'google/gemini-1.5-flash' // Control model
];

const DUMMY_IMAGE_URL = 'https://placehold.co/600x400.png';

async function testModel(modelId) {
  console.log(`\n======================================`);
  console.log(`🧪 Testing Model: ${modelId}`);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_KEY}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe what is in this image and return {"extracted": "..."}' },
              { type: 'image_url', image_url: { url: DUMMY_IMAGE_URL } }
            ]
          }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.log(`❌ FAILED (Status ${res.status}):`);
      console.log(err);
      return false;
    }

    const data = await res.json();
    console.log(`✅ SUCCESS! Response:`);
    console.log(data.choices[0]?.message?.content);
    return true;
  } catch (err) {
    console.log(`❌ ERROR: ${err.message}`);
    return false;
  }
}

async function runTests() {
  if (!OPENROUTER_KEY) {
    console.log('No OpenRouter API key found in env.');
    return;
  }
  
  for (const model of MODELS) {
    await testModel(model);
  }
  console.log('\n✅ Testing Complete!');
}

runTests();
