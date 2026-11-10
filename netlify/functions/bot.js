import {
  ITEMS,
  callTelegram,
  fetchLowestPrice
} from './shared.js';

async function buildFullReport() {
  const lines = ['📊 AH report', ''];
  let lastUpdated = '';

  for (const item of Object.values(ITEMS)) {
    const rankEntries = Object.values(item.ranks);

    for (const rank of rankEntries) {
      const priceData = await fetchLowestPrice(rank.id);
      lastUpdated = priceData.snapshotText;
const prices = priceData.priceLevels
  .map(level => `${level.priceText} (${level.quantity})`)
  .join(' | ');

lines.push(
  `${item.label}${rank.label === 'Price' ? '' : ` — ${rank.label}`}:\n${prices}\n`
);
    }

    lines.push('===');
  }

  if (lines[lines.length - 1] === '===') {
    lines.pop();
  }

  lines.push('');
  lines.push(`Updated: ${lastUpdated}`);

  return lines.join('\n');
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const update = await req.json();

    if (update.message) {
      const chatId = update.message.chat.id;
      const report = await buildFullReport();

      await callTelegram('sendMessage', {
        chat_id: chatId,
        text: report
      });

      return new Response('ok');
    }

    return new Response('ok');
} catch (error) {
  console.error("BOT ERROR:", error);

  return new Response(
    `Error: ${error.message}`,
    { status: 500 }
  );
}
};
