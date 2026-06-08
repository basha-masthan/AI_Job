import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuid } from 'uuid';

import { getStoragePath } from '@/lib/config';
import dbConnect from '@/lib/mongodb';
import Job from '@/models/Job';

export const RESUMES_INDEX = getStoragePath('resumes.json');
export const JOBS_INDEX = getStoragePath('jobs.json');
export const PATHS_INDEX = getStoragePath('training_paths.json');

let _fsWritable = null;

function isFsWritable() {
  if (_fsWritable !== null) return _fsWritable;
  try {
    const tmp = path.join(os.tmpdir(), `fbt_write_test_${Date.now()}`);
    fs.writeFileSync(tmp, 'test');
    fs.unlinkSync(tmp);
    _fsWritable = true;
  } catch { _fsWritable = false; }
  return _fsWritable;
}

export function ensureDirs() {
  if (!isFsWritable()) return;
  try {
    if (!fs.existsSync(RESUMES_INDEX)) fs.writeFileSync(RESUMES_INDEX, JSON.stringify([]));
    if (!fs.existsSync(JOBS_INDEX)) fs.writeFileSync(JOBS_INDEX, JSON.stringify([]));
    if (!fs.existsSync(PATHS_INDEX)) fs.writeFileSync(PATHS_INDEX, JSON.stringify([]));
  } catch {}
}

function readIndex(filePath) {
  if (!isFsWritable()) return [];
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
  if (!isFsWritable()) return;
  try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); } catch {}
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

export async function getAllJobs(userId) {
  try {
    await dbConnect();
    const dbJobs = await Job.find(userId ? { userId } : {}).lean();
    return dbJobs.map(j => ({
      ...j,
      id: j.id || j._id?.toString(),
    }));
  } catch (err) {
    console.warn('[Store] MongoDB getAllJobs failed, falling back to JSON:', err.message);
    const all = readIndex(JOBS_INDEX);
    if (!userId) return all;
    return all.filter(j => j.userId === userId);
  }
}

export async function saveJob(job, userId) {
  if (!userId) throw new Error('userId is required to save data');
  
  const jobWithUser = { ...job, userId, updatedAt: new Date().toISOString() };
  if (!jobWithUser.createdAt) jobWithUser.createdAt = new Date().toISOString();
  if (!jobWithUser.id) jobWithUser.id = uuid();

  try {
    await dbConnect();
    const updated = await Job.findOneAndUpdate(
      { id: jobWithUser.id, userId },
      jobWithUser,
      { upsert: true, new: true, lean: true }
    );
    
    // Simulating background sync to JSON for backup redundancy
    try {
      const jobs = readIndex(JOBS_INDEX);
      const index = jobs.findIndex(j => j.id === jobWithUser.id);
      if (index !== -1) jobs[index] = jobWithUser;
      else jobs.push(jobWithUser);
      writeIndex(JOBS_INDEX, jobs);
    } catch {}
    
    return {
      ...updated,
      id: updated.id || updated._id?.toString()
    };
  } catch (err) {
    console.warn('[Store] MongoDB saveJob failed, falling back to JSON:', err.message);
    const jobs = readIndex(JOBS_INDEX);
    const index = jobs.findIndex(j => j.id === jobWithUser.id);
    if (index !== -1) {
      jobs[index] = jobWithUser;
    } else {
      jobs.push(jobWithUser);
    }
    writeIndex(JOBS_INDEX, jobs);
    return jobWithUser;
  }
}

export async function deleteJob(id, userId) {
  try {
    await dbConnect();
    await Job.deleteOne({ id, userId });
  } catch (err) {
    console.warn('[Store] MongoDB deleteJob failed:', err.message);
  }
  try {
    const jobs = readIndex(JOBS_INDEX);
    const filtered = jobs.filter(j => !(j.id === id && j.userId === userId));
    writeIndex(JOBS_INDEX, filtered);
  } catch {}
}

export async function checkAlreadyApplied(company, title, userId) {
  if (!company || !title || !userId) return false;
  try {
    await dbConnect();
    const cleanCompany = company.trim().toLowerCase();
    const cleanTitle = title.trim().toLowerCase();

    // Escape regex characters
    const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const existing = await Job.findOne({
      userId,
      status: 'applied',
      company: { $regex: new RegExp(`^${escapeRegExp(cleanCompany)}$`, 'i') },
      title: { $regex: new RegExp(`^${escapeRegExp(cleanTitle)}$`, 'i') }
    }).lean();

    return !!existing;
  } catch (err) {
    console.warn('[Store] MongoDB checkAlreadyApplied failed, checking JSON:', err.message);
    const jobs = readIndex(JOBS_INDEX);
    return jobs.some(j => 
      j.userId === userId &&
      j.status === 'applied' &&
      j.company?.toLowerCase() === company.toLowerCase() &&
      (j.title?.toLowerCase() === title.toLowerCase() || j.role?.toLowerCase() === title.toLowerCase())
    );
  }
}

export async function checkAlreadyAppliedByEmail(email, userId) {
  if (!email || !userId) return false;
  try {
    await dbConnect();
    const existing = await Job.findOne({
      userId,
      status: 'applied',
      appliedEmail: { $regex: new RegExp(`^${email.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).lean();
    return !!existing;
  } catch (err) {
    console.warn('[Store] checkAlreadyAppliedByEmail MongoDB failed:', err.message);
    const jobs = readIndex(JOBS_INDEX);
    return jobs.some(j => j.userId === userId && j.status === 'applied' && j.appliedEmail?.toLowerCase() === email.toLowerCase());
  }
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

export function updateResume(id, updates, userId) {
  const resumes = readIndex(RESUMES_INDEX);
  const index = resumes.findIndex(r => r.id === id && (!userId || r.userId === userId));
  if (index !== -1) {
    resumes[index] = { ...resumes[index], ...updates, updatedAt: new Date().toISOString() };
    writeIndex(RESUMES_INDEX, resumes);
    return resumes[index];
  }
  return null;
}

export function getAllPaths(userId) {
  const all = readIndex(PATHS_INDEX);
  if (!userId) return all;
  return all.filter(p => p.userId === userId);
}

export function getPathById(id, userId) {
  const all = readIndex(PATHS_INDEX);
  return all.find(p => p.id === id && (!userId || p.userId === userId));
}

export function savePath(pathObj, userId) {
  if (!userId) throw new Error('userId is required to save data');
  const paths = readIndex(PATHS_INDEX);
  
  if (!pathObj.id) pathObj.id = uuid();
  const index = paths.findIndex(p => p.id === pathObj.id);
  
  const pathWithUser = { ...pathObj, userId, updatedAt: new Date().toISOString() };
  if (!pathWithUser.createdAt) pathWithUser.createdAt = new Date().toISOString();

  if (index !== -1) {
    paths[index] = pathWithUser;
  } else {
    paths.push(pathWithUser);
  }
  writeIndex(PATHS_INDEX, paths);
  return pathWithUser;
}

export function deletePath(id, userId) {
  const paths = readIndex(PATHS_INDEX);
  const filtered = paths.filter(p => !(p.id === id && p.userId === userId));
  writeIndex(PATHS_INDEX, filtered);
}