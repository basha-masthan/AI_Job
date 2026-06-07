import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the schema locally since we are in a standalone script
const JobSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  title: String,
  company: String,
  role: String,
  location: String,
  salary: String,
  url: String,
  description: String,
  status: { type: String, default: 'pending' },
  source: { type: String, default: 'manual' },
  appliedEmail: String,
  emailContext: { subject: String, bodyText: String, bodyHtml: String, sentAt: Date },
  resumeContext: { resumeId: String, resumeUrl: String },
  trackingId: String,
  emailOpened: { type: Boolean, default: false },
  emailOpenCount: { type: Number, default: 0 },
  emailOpenedAt: Date,
  linkClicks: { type: Number, default: 0 },
  timeline: [{ event: String, description: String, timestamp: Date, metadata: mongoose.Schema.Types.Mixed }],
  dateApplied: String,
}, { timestamps: true, strict: false });

const Job = mongoose.models.Job || mongoose.model('Job', JobSchema);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/jobhuntpro';

async function migrate() {
  try {
    console.log('[Migration] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('[Migration] Connected to MongoDB.');

    const jobsFile = path.join(__dirname, '..', 'data', 'jobs.json');
    if (!fs.existsSync(jobsFile)) {
      console.log('[Migration] data/jobs.json not found, nothing to migrate.');
      process.exit(0);
    }

    const data = JSON.parse(fs.readFileSync(jobsFile, 'utf-8'));
    console.log(`[Migration] Found ${data.length} jobs in JSON file.`);

    let count = 0;
    for (const job of data) {
      // Map old fields to new schema structure if necessary
      const updateData = { ...job };
      
      // Move old resumeUrl to new resumeContext
      if (job.resumeUrl && !updateData.resumeContext) {
        updateData.resumeContext = { resumeUrl: job.resumeUrl };
        delete updateData.resumeUrl;
      }

      await Job.findOneAndUpdate(
        { id: job.id, userId: job.userId },
        { $set: updateData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      count++;
    }

    console.log(`[Migration] Successfully migrated ${count} jobs to MongoDB!`);
    process.exit(0);
  } catch (err) {
    console.error('[Migration] Error during migration:', err);
    process.exit(1);
  }
}

migrate();
