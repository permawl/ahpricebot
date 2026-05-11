import { callTelegram, getBotToken } from './shared.js';

export default async () => {
  try {
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL;
    if (!siteUrl) {
      return new Response('Netlify site URL not available yet. Deploy first, then open this page again.', { status: 200 });
    }

    const webhookUrl = `${siteUrl.replace(/\/$/, '')}/.netlify/functions/bot`;
    const result = await callTelegram('setWebhook', { url: webhookUrl });

    return new Response(
      `Webhook configured successfully.\n\nBot token ends with: ${getBotToken().slice(-6)}\nWebhook: ${webhookUrl}\nTelegram response: ${JSON.stringify(result.result)}`,
      { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
  } catch (error) {
    return new Response(`Setup failed: ${error.message}`, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }
};
