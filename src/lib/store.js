import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';

const DATA_DIR = path.join(process.cwd(), 'data');
export const RESUMES_INDEX = path.join(DATA_DIR, 'resumes.json');
export const JOBS_INDEX = path.join(DATA_DIR, 'jobs.json');

export function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(RESUMES_INDEX)) fs.writeFileSync(RESUMES_INDEX, JSON.stringify([]));
  if (!fs.existsSync(JOBS_INDEX)) fs.writeFileSync(JOBS_INDEX, JSON.stringify([]));
}

function readIndex(filePath) {
  ensureDirs();
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    let data = JSON.parse(content);
    
    // Auto-fix missing IDs
    let fixed = false;
    data = data.map(item => {
      if (!item.id) {
        item.id = uuid();
        fixed = true;
      }
      return item;
    });
    if (fixed) writeIndex(filePath, data);
    
    return data;
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
    return [];
  }
}

export function writeIndex(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ─────────────────────────────────────────────────────────────
// User-Specific Getters/Setters
// ─────────────────────────────────────────────────────────────

export function getAllResumes(userId) {
  const all = readIndex(RESUMES_INDEX);
  if (!userId) return all;
  return all.filter(r => r.userId === userId);
}

export function getResumeById(id, userId) {
  const all = readIndex(RESUMES_INDEX);
  return all.find(r => r.id === id && (!userId || r.userId === userId));
}

export function saveResume(resume, userId) {
  if (!userId) throw new Error('userId is required to save data');
  const resumes = readIndex(RESUMES_INDEX);
  
  if (!resume.id) resume.id = uuid();
  const index = resumes.findIndex(r => r.id === resume.id);
  
  const resumeWithUser = { ...resume, userId, updatedAt: new Date().toISOString() };
  if (!resumeWithUser.createdAt) resumeWithUser.createdAt = new Date().toISOString();

  if (index !== -1) {
    resumes[index] = resumeWithUser;
  } else {
    resumes.push(resumeWithUser);
  }
  writeIndex(RESUMES_INDEX, resumes);
  return resumeWithUser;
}

export function getAllJobs(userId) {
  const all = readIndex(JOBS_INDEX);
  if (!userId) return all;
  return all.filter(j => j.userId === userId);
}

export function saveJob(job, userId) {
  if (!userId) throw new Error('userId is required to save data');
  const jobs = readIndex(JOBS_INDEX);
  
  if (!job.id) job.id = uuid();
  const index = jobs.findIndex(j => j.id === job.id);
  
  const jobWithUser = { ...job, userId, updatedAt: new Date().toISOString() };
  if (!jobWithUser.createdAt) jobWithUser.createdAt = new Date().toISOString();

  if (index !== -1) {
    jobs[index] = jobWithUser;
  } else {
    jobs.push(jobWithUser);
  }
  writeIndex(JOBS_INDEX, jobs);
  return jobWithUser;
}

export function deleteJob(id, userId) {
  const jobs = readIndex(JOBS_INDEX);
  const filtered = jobs.filter(j => !(j.id === id && j.userId === userId));
  writeIndex(JOBS_INDEX, filtered);
}

export function deleteResume(id, userId) {
  const resumes = readIndex(RESUMES_INDEX);
  const filtered = resumes.filter(r => !(r.id === id && r.userId === userId));
  writeIndex(RESUMES_INDEX, filtered);
}

export function toggleFavoriteResume(id, userId) {
  const resumes = readIndex(RESUMES_INDEX);
  const index = resumes.findIndex(r => r.id === id && r.userId === userId);
  if (index !== -1) {
    resumes[index].isFavorite = !resumes[index].isFavorite;
    writeIndex(RESUMES_INDEX, resumes);
    return resumes[index];
  }
  return null;
}
