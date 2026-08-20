const TELEGRAM_API = 'https://api.telegram.org';
const UE_BASE = 'https://undermine.exchange';
const EU_COMMODITY_CONNECTED_ID = 32513;

export const ITEMS = {
  refulgent_copper_ore: {
    label: 'Refulgent Copper Ore',
    ranks: {
      '1': { id: 237359, label: 'Rank I' },
      '2': { id: 237361, label: 'Rank II' }
    }
  },
  umbral_tin_ore: {
    label: 'Umbral Tin Ore',
    ranks: {
      '1': { id: 237362, label: 'Rank I' },
      '2': { id: 237363, label: 'Rank II' }
    }
  },
  brilliant_silver_ore: {
    label: 'Brilliant Silver Ore',
    ranks: {
      '1': { id: 237364, label: 'Rank I' },
      '2': { id: 237365, label: 'Rank II' }
    }
  },
  azeroot: {
    label: 'Azeroot',
    ranks: {
      '1': { id: 236774, label: 'Rank I' },
      '2': { id: 236775, label: 'Rank II' }
    }
  },
  argentleaf: {
    label: 'Argentleaf',
    ranks: {
      '1': { id: 236776, label: 'Rank I' },
      '2': { id: 236777, label: 'Rank II' }
    }
  },
  nocturnal_lotus: {
    label: 'Nocturnal Lotus',
    ranks: {
      '1': { id: 236780, label: 'Price' }
    }
  }
};

export function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN environment variable');
  return token;
}

export function telegramUrl(method) {
  return `${TELEGRAM_API}/bot${getBotToken()}/${method}`;
}

export async function callTelegram(method, payload) {
  const response = await fetch(telegramUrl(method), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`Telegram ${method} failed: ${JSON.stringify(data)}`);
  }
  return data;
}

export function mainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: ITEMS.refulgent_copper_ore.label, callback_data: 'item:refulgent_copper_ore' }],
      [{ text: ITEMS.umbral_tin_ore.label, callback_data: 'item:umbral_tin_ore' }],
      [{ text: ITEMS.brilliant_silver_ore.label, callback_data: 'item:brilliant_silver_ore' }],
      [{ text: ITEMS.azeroot.label, callback_data: 'item:azeroot' }],
      [{ text: ITEMS.argentleaf.label, callback_data: 'item:argentleaf' }],
      [{ text: ITEMS.nocturnal_lotus.label, callback_data: 'item:nocturnal_lotus' }]
    ]
  };
}

export function rankKeyboard(itemKey) {
  const item = ITEMS[itemKey];
  const rankButtons = Object.entries(item.ranks).map(([rankKey, rank]) => ({
    text: rank.label,
    callback_data: `price:${itemKey}:${rankKey}`
  }));
  return {
    inline_keyboard: [rankButtons, [{ text: '⬅ Back', callback_data: 'back:main' }]]
  };
}

function formatGoldFromCopper(copper) {
  const gold = Math.floor(copper / 10000);
  const silver = Math.floor((copper % 10000) / 100);
  const copperOnly = copper % 100;

  if (copperOnly === 0) {
    return `${gold}g ${silver}s`;
  }

  return `${gold}g ${silver}s ${copperOnly}c`;
}

function formatSnapshot(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  }).format(date);
}

function parseItemState(buffer) {
  const view = new DataView(buffer);
  let offset = 0;
  const u8 = () => view.getUint8(offset++);
  const u16 = () => { const v = view.getUint16(offset, true); offset += 2; return v; };
  const u32 = () => { const v = view.getUint32(offset, true); offset += 4; return v; };

  const version = u8();
  if (![3,4,5].includes(version)) {
    throw new Error(`Unsupported item state version: ${version}`);
  }
  const snapshot = u32();
  const price = u32();
  const quantity = u32();
  const auctionCount = u16();
  const auctions = [];
  for (let i = 0; i < auctionCount; i++) {
    auctions.push({ price: u32(), quantity: u32() });
  }
  auctions.sort((a, b) => a.price - b.price);
  return { version, snapshot, price, quantity, auctionCount, auctions };
}

export async function fetchLowestPrice(itemId) {
  const low = itemId & 255;
  const url = `${UE_BASE}/data/${EU_COMMODITY_CONNECTED_ID}/${low}/${itemId}.bin`;
  const response = await fetch(url, {
    headers: { 'user-agent': 'personal-telegram-bot/1.0' }
  });
  if (!response.ok) {
    throw new Error(`Undermine Exchange request failed with ${response.status} for ${url}`);
  }
  const buffer = await response.arrayBuffer();
const parsed = parseItemState(buffer);

const priceLevels = [];
for (const auction of parsed.auctions) {
  const lastLevel = priceLevels[priceLevels.length - 1];

  if (lastLevel && lastLevel.price === auction.price) {
    lastLevel.quantity += auction.quantity;
  } else {
    priceLevels.push({
      price: auction.price,
      quantity: auction.quantity
    });
  }

  if (priceLevels.length === 3) {
    break;
  }
}

const lowest = priceLevels[0] || {
  price: parsed.price,
  quantity: parsed.quantity
};

return {
  itemId,
  lowestPriceCopper: lowest.price,
  lowestPriceText: formatGoldFromCopper(lowest.price * 100),
  lowestQuantity: lowest.quantity,
  priceLevels: priceLevels.map(level => ({
    priceText: formatGoldFromCopper(level.price * 100),
    quantity: level.quantity
  })),
  totalQuantity: parsed.quantity,
  auctionCount: parsed.auctionCount,
  snapshot: parsed.snapshot,
  snapshotText: formatSnapshot(parsed.snapshot),
  sourceUrl: url
};
}

export function priceMessage(itemLabel, rankLabel, priceData) {
  return [
    `📦 ${itemLabel}${rankLabel === 'Price' ? '' : ` — ${rankLabel}`}`,
    `Lowest price: ${priceData.lowestPriceText}`,
    `Quantity at lowest price: ${priceData.lowestQuantity}`,
    `Total quantity listed: ${priceData.totalQuantity}`,
    `Auction groups: ${priceData.auctionCount}`,
    `Updated: ${priceData.snapshotText}`,
    `Source: EU commodity data on Undermine Exchange`
  ].join('\n');
}
