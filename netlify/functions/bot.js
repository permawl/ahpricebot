import {
  ITEMS,
  callTelegram,
  fetchLowestPrice
} from './shared.js';

async function buildFullReport() {
  const lines = ['📊 AH report', ''];

  for (const item of Object.values(ITEMS)) {
    for (const rank of Object.values(item.ranks)) {
      const priceData = await fetchLowestPrice(rank.id);
      lines.push(
        `${item.label}${rank.label === 'Price' ? '' : ` — ${rank.label}`}: ${priceData.lowestPriceText} | Qty: ${priceData.lowestQuantity} | Updated: ${priceData.snapshotText}`
      );
    }
  }

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
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
};
