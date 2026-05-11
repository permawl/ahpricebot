import {
  ITEMS,
  callTelegram,
  fetchLowestPrice,
  mainKeyboard,
  priceMessage,
  rankKeyboard
} from './shared.js';

async function sendMainMenu(chatId, text = 'Choose an item:') {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: mainKeyboard()
  });
}

async function editToRanks(chatId, messageId, itemKey) {
  const item = ITEMS[itemKey];
  return callTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: `Choose a rank for ${item.label}:`,
    reply_markup: rankKeyboard(itemKey)
  });
}

async function editToMain(chatId, messageId) {
  return callTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: 'Choose an item:',
    reply_markup: mainKeyboard()
  });
}

async function answerCallback(callbackQueryId, text = '') {
  return callTelegram('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {})
  });
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const update = await req.json();

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = (update.message.text || '').trim();
      if (text === '/start' || text === '/menu') {
        await sendMainMenu(chatId);
      } else {
        await sendMainMenu(chatId, 'Use the buttons below:');
      }
      return new Response('ok');
    }

    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message.chat.id;
      const messageId = cq.message.message_id;
      const data = cq.data || '';

      if (data === 'back:main') {
        await answerCallback(cq.id);
        await editToMain(chatId, messageId);
        return new Response('ok');
      }

      if (data.startsWith('item:')) {
        const itemKey = data.split(':')[1];
        if (!ITEMS[itemKey]) {
          await answerCallback(cq.id, 'Unknown item');
          return new Response('ok');
        }
        await answerCallback(cq.id);
        if (itemKey === 'nocturnal_lotus') {
          const rank = ITEMS[itemKey].ranks['1'];
          const priceData = await fetchLowestPrice(rank.id);
          await callTelegram('editMessageText', {
            chat_id: chatId,
            message_id: messageId,
            text: priceMessage(ITEMS[itemKey].label, rank.label, priceData),
            reply_markup: {
              inline_keyboard: [[{ text: '⬅ Back', callback_data: 'back:main' }]]
            }
          });
        } else {
          await editToRanks(chatId, messageId, itemKey);
        }
        return new Response('ok');
      }

      if (data.startsWith('price:')) {
        const [, itemKey, rankKey] = data.split(':');
        const item = ITEMS[itemKey];
        const rank = item?.ranks?.[rankKey];
        if (!item || !rank) {
          await answerCallback(cq.id, 'Unknown rank');
          return new Response('ok');
        }

        await answerCallback(cq.id, 'Fetching price...');
        const priceData = await fetchLowestPrice(rank.id);
        await callTelegram('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: priceMessage(item.label, rank.label, priceData),
          reply_markup: {
            inline_keyboard: [
              [{ text: '⬅ Back', callback_data: `item:${itemKey}` }],
              [{ text: '🏠 Main Menu', callback_data: 'back:main' }]
            ]
          }
        });
        return new Response('ok');
      }

      await answerCallback(cq.id, 'Unsupported action');
      return new Response('ok');
    }

    return new Response('ok');
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
};
