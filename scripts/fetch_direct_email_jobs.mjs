import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env manually
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^([^#\s][^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  });
}

// Setup Mongoose Model
const JobSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  title: { type: String, required: true },
  company: { type: String, required: true },
  role: { type: String },
  location: { type: String },
  salary: { type: String },
  url: { type: String },
  description: { type: String },
  status: { type: String, default: 'pending' },
  source: { type: String, default: 'manual' },
  dateApplied: { type: String },
}, { strict: false });

const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

const SERPER_API_KEY = process.env.SERPER_API_KEY || 'dda58ce4c8a6238a447510f8536ad4581f200731';

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function searchGoogleForJobs(role, location, userId) {
  const queries = [
    'Software Developer we are hiring send your resume to',
    'hiring Software Developer Remote send resume',
    'Software Developer Remote please send your resume to',
    'Software Developer Remote forward your resume to',
    'looking for a Software Developer send resume',
    'Software Developer urgently hiring send your resume',
    'Software Developer Remote email your resume to'
  ];

  let totalJobs = 0;
  const seenUrls = new Set();
  
  for (const query of queries) {
    if (totalJobs >= 25) break;
    console.log(`\nRunning query: ${query}`);
    
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': SERPER_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: query, num: 20 })
      });
      
      if (!res.ok) {
        console.error('Serper error:', await res.text());
        continue;
      }
      
      const data = await res.json();
      const results = data.organic || [];
      console.log(`Got ${results.length} results.`);
      
      for (const item of results) {
        if (totalJobs >= 25) break;
        
        const url = item.link || '#';
        if (seenUrls.has(url)) continue;
        seenUrls.has(url);
        
        const text = `${item.title} ${item.snippet}`;
        
        // Check if there's an email
        const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        
        // We prefer jobs that have an email or clearly say "hiring" and "resume"
        const isHiring = /hiring|resume|apply/i.test(text);
        
        if (isHiring || emailMatch) {
          const email = emailMatch ? emailMatch[0] : 'Check link';
          
          let company = 'Unknown Company';
          const companyMatch = item.title.match(/\bat\s+([^|\-\n]+)/i);
          if (companyMatch) {
            company = companyMatch[1].trim();
          } else if (emailMatch) {
            company = email.split('@')[1].split('.')[0].toUpperCase();
          }
          
          const jobId = `direct_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const jobDoc = {
            id: jobId,
            userId: userId,
            title: item.title ? item.title.split('-')[0].trim() : role,
            company: company,
            location: location || 'Remote',
            salary: 'Competitive',
            url: url,
            description: item.snippet + (emailMatch ? `\n\nApply via email: ${email}` : ''),
            status: 'pending',
            source: 'autopilot',
            dateApplied: new Date().toISOString()
          };
          
          // Save to DB
          try {
            await Job.updateOne({ url: url }, { $setOnInsert: jobDoc }, { upsert: true });
            console.log(`[SAVED] ${jobDoc.title} @ ${jobDoc.company} (Email: ${email})`);
            totalJobs++;
            seenUrls.add(url);
          } catch (e) {
             console.error('DB Error:', e.message);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching query:', e.message);
    }
    await delay(1000);
  }
  
  console.log(`\nFinished! Found and saved ${totalJobs} jobs.`);
}

async function run() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is required in .env.local');
    process.exit(1);
  }
  
  await mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 5000,
  });
  console.log('Connected to MongoDB');
  
  const userId = 'kingkite789@gmail.com'; // Extracted from autopilot-runs
  await searchGoogleForJobs('Software Developer', 'Remote', userId);
  
  await mongoose.disconnect();
}

run();
