/**
 * Utility to notify N8N about job hunting events
 * This triggers the N8N workflows (Gmail monitoring, LinkedIn tracking, etc.)
 */
export async function notifyN8N(eventType, data) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.endsWith('/')) {
    console.warn('N8N_WEBHOOK_URL not configured. Skipping notification.');
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        ...data
      }),
    });
  } catch (err) {
    console.error('Failed to notify N8N:', err);
  }
}
