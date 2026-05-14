import Nylas from 'nylas';

const nylasConfig = {
  apiKey: process.env.NYLAS_API_KEY,
  apiUri: process.env.NYLAS_API_URI || 'https://api.us.nylas.com',
};

let nylasClient;

export function getNylasClient() {
  if (!nylasClient) {
    if (!nylasConfig.apiKey) {
      throw new Error('NYLAS_API_KEY is not configured in .env.local');
    }
    nylasClient = new Nylas(nylasConfig);
  }
  return nylasClient;
}

/**
 * Helper to parse email content and detect job updates via AI
 */
export async function processEmailForJobUpdates(message, userJobs) {
  const { extractJobUpdateFromEmail } = await import('./ai');
  
  // Extract clean text from email body (snippet or full)
  const body = message.body || message.snippet;
  const subject = message.subject;
  
  const update = await extractJobUpdateFromEmail(subject, body, userJobs);
  return update;
}
