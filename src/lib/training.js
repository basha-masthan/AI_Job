import fs from 'fs';
import path from 'path';

import { getStoragePath } from '@/lib/config';
import { safeEnsureFile, safeWriteFileSync, safeReadFileSync } from '@/lib/fs-safe';

const TRAINING_FILE = getStoragePath('training.json');
const PROGRESS_FILE = getStoragePath('training-progress.json');

export function ensureTrainingData() {
  safeEnsureFile(PROGRESS_FILE, JSON.stringify([]));
}

export function getTrainingData() {
  ensureTrainingData();
  try {
    return JSON.parse(fs.readFileSync(TRAINING_FILE, 'utf-8'));
  } catch {
    return { roles: [] };
  }
}

export function getRole(roleId) {
  const data = getTrainingData();
  return data.roles.find(r => r.id === roleId) || null;
}

export function getRoleLevel(roleId, level) {
  const role = getRole(roleId);
  if (!role) return null;
  return role.levels[level] || null;
}

export function getAllProgress() {
  ensureTrainingData();
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export function getUserProgress(userId) {
  const all = getAllProgress();
  return all.filter(p => p.userId === userId);
}

export function saveProgress(userId, roleId, level, sectionId, moduleId) {
  const all = getAllProgress();
  let entry = all.find(p => p.userId === userId && p.roleId === roleId && p.level === level);
  if (!entry) {
    entry = { userId, roleId, level, completedModules: {}, updatedAt: new Date().toISOString() };
    all.push(entry);
  }
  if (!entry.completedModules[sectionId]) entry.completedModules[sectionId] = [];
  if (!entry.completedModules[sectionId].includes(moduleId)) {
    entry.completedModules[sectionId].push(moduleId);
  }
  entry.updatedAt = new Date().toISOString();
  safeWriteFileSync(PROGRESS_FILE, JSON.stringify(all, null, 2));
  return entry;
}

export function removeProgress(userId, roleId, level, sectionId, moduleId) {
  const all = getAllProgress();
  const entry = all.find(p => p.userId === userId && p.roleId === roleId && p.level === level);
  if (entry && entry.completedModules[sectionId]) {
    entry.completedModules[sectionId] = entry.completedModules[sectionId].filter(m => m !== moduleId);
    entry.updatedAt = new Date().toISOString();
    safeWriteFileSync(PROGRESS_FILE, JSON.stringify(all, null, 2));
  }
  return entry || null;
}

const INTERVIEWS_HISTORY_FILE = getStoragePath('interviews-history.json');
const MCQS_HISTORY_FILE = getStoragePath('mcqs-history.json');

export function saveInterviewHistory(userId, interview) {
  ensureTrainingData();
  let all = [];
  if (fs.existsSync(INTERVIEWS_HISTORY_FILE)) {
    try {
      all = JSON.parse(fs.readFileSync(INTERVIEWS_HISTORY_FILE, 'utf-8'));
    } catch {
      all = [];
    }
  }
  const entry = {
    id: `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    ...interview,
    createdAt: new Date().toISOString()
  };
  all.unshift(entry);
  safeWriteFileSync(INTERVIEWS_HISTORY_FILE, JSON.stringify(all, null, 2));
  return entry;
}

export function getInterviewHistory(userId) {
  ensureTrainingData();
  if (!fs.existsSync(INTERVIEWS_HISTORY_FILE)) return [];
  try {
    const all = JSON.parse(fs.readFileSync(INTERVIEWS_HISTORY_FILE, 'utf-8'));
    return all.filter(p => p.userId === userId);
  } catch {
    return [];
  }
}

export function saveMcqHistory(userId, mcq) {
  ensureTrainingData();
  let all = [];
  if (fs.existsSync(MCQS_HISTORY_FILE)) {
    try {
      all = JSON.parse(fs.readFileSync(MCQS_HISTORY_FILE, 'utf-8'));
    } catch {
      all = [];
    }
  }
  const entry = {
    id: `mcq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    ...mcq,
    createdAt: new Date().toISOString()
  };
  all.unshift(entry);
  safeWriteFileSync(MCQS_HISTORY_FILE, JSON.stringify(all, null, 2));
  return entry;
}

export function getMcqHistory(userId) {
  ensureTrainingData();
  if (!fs.existsSync(MCQS_HISTORY_FILE)) return [];
  try {
    const all = JSON.parse(fs.readFileSync(MCQS_HISTORY_FILE, 'utf-8'));
    return all.filter(p => p.userId === userId);
  } catch {
    return [];
  }
}
