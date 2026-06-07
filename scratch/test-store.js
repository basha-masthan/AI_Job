// scratch/test-store.js
const Module = require('module');
const path = require('path');

// Hook Node's module resolver to support Next.js path aliases (@/*)
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain) {
  if (request.startsWith('@/')) {
    const srcPath = path.resolve(__dirname, '..', 'src');
    const target = request.replace('@/', srcPath + '/');
    return originalResolve.call(this, target, parent, isMain);
  }
  return originalResolve.call(this, request, parent, isMain);
};

// Set environment variables manually for the test
process.env.MONGODB_URI = 'mongodb://localhost:27017/jobhuntpro';

const { getAllJobs, saveJob, deleteJob, checkAlreadyApplied } = require('../src/lib/store');

async function test() {
  console.log('--- STARTING STORE TEST ---');
  const userId = 'test_user_123';
  
  // 1. Clean up any existing test jobs
  console.log('Cleaning up existing test jobs...');
  const initialJobs = await getAllJobs(userId);
  for (const job of initialJobs) {
    if (job.company.startsWith('TestCompany')) {
      await deleteJob(job.id, userId);
    }
  }
  
  // 2. Save a job
  console.log('Saving a test job...');
  const testJob = {
    title: 'Test Software Engineer',
    company: 'TestCompany A',
    status: 'pending',
    url: 'https://example.com/test-job-a',
    description: 'A test job description.',
    datePosted: new Date().toISOString()
  };
  
  const saved = await saveJob(testJob, userId);
  console.log('Saved Job:', saved);
  
  if (!saved.id) {
    throw new Error('Saved job has no ID!');
  }
  
  // 3. Retrieve all jobs
  console.log('Retrieving jobs...');
  const allJobs = await getAllJobs(userId);
  console.log(`Found ${allJobs.length} jobs for user ${userId}.`);
  const found = allJobs.find(j => j.id === saved.id);
  if (!found) {
    throw new Error('Saved job was not found in retrieved list!');
  }
  console.log('Successfully found saved job in retrieved list.');

  // 4. Test "already applied" check (should be false since status is pending)
  console.log('Checking checkAlreadyApplied (should be false)...');
  const applied1 = await checkAlreadyApplied('TestCompany A', 'Test Software Engineer', userId);
  console.log('Applied 1:', applied1);
  if (applied1 !== false) {
    throw new Error('Job should not be marked as applied!');
  }

  // 5. Update job status to 'applied' and test checkAlreadyApplied (should be true)
  console.log('Updating job status to applied...');
  saved.status = 'applied';
  await saveJob(saved, userId);
  
  console.log('Checking checkAlreadyApplied (should be true)...');
  const applied2 = await checkAlreadyApplied('TestCompany A', 'Test Software Engineer', userId);
  console.log('Applied 2:', applied2);
  if (applied2 !== true) {
    throw new Error('Job should be marked as applied!');
  }

  // Test case-insensitivity
  console.log('Checking case-insensitivity of checkAlreadyApplied (should be true)...');
  const appliedCase = await checkAlreadyApplied('  testcompany a  ', 'test software engineer', userId);
  console.log('Applied Case-Insensitive:', appliedCase);
  if (appliedCase !== true) {
    throw new Error('Case-insensitive check failed!');
  }

  // 6. Delete test job
  console.log('Deleting test job...');
  await deleteJob(saved.id, userId);
  
  const finalJobs = await getAllJobs(userId);
  const stillExists = finalJobs.some(j => j.id === saved.id);
  console.log('Job still exists?', stillExists);
  if (stillExists) {
    throw new Error('Job was not deleted!');
  }
  
  console.log('--- STORE TEST COMPLETED SUCCESSFUL ---');
  process.exit(0);
}

test().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
