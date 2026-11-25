const TELEGRAM_API = 'https://api.telegram.org';
const UNDERMINE_API = 'https://api.undermine.exchange';
const UNDERMINE_REGION = 'eu';

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

  if (!token) {
    throw new Error(
      'Missing TELEGRAM_BOT_TOKEN environment variable'
    );
  }

  return token;
}

function getUndermineKey() {
  const key = process.env.UNDERMINE_API_KEY;

  if (!key) {
    throw new Error(
      'Missing UNDERMINE_API_KEY environment variable'
    );
  }

  return key;
}

function telegramUrl(method) {
  return `${TELEGRAM_API}/bot${getBotToken()}/${method}`;
}

export async function callTelegram(method, payload) {
  const response = await fetch(telegramUrl(method), {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(
      `Telegram ${method} failed: ${JSON.stringify(data)}`
    );
  }

  return data;
}

export function mainKeyboard() {
  return {
    inline_keyboard: [
      [{
        text: ITEMS.refulgent_copper_ore.label,
        callback_data: 'item:refulgent_copper_ore'
      }],
      [{
        text: ITEMS.umbral_tin_ore.label,
        callback_data: 'item:umbral_tin_ore'
      }],
      [{
        text: ITEMS.brilliant_silver_ore.label,
        callback_data: 'item:brilliant_silver_ore'
      }],
      [{
        text: ITEMS.azeroot.label,
        callback_data: 'item:azeroot'
      }],
      [{
        text: ITEMS.argentleaf.label,
        callback_data: 'item:argentleaf'
      }],
      [{
        text: ITEMS.nocturnal_lotus.label,
        callback_data: 'item:nocturnal_lotus'
      }]
    ]
  };
}

export function rankKeyboard(itemKey) {
  const item = ITEMS[itemKey];

  const rankButtons = Object.entries(item.ranks).map(
    ([rankKey, rank]) => ({
      text: rank.label,
      callback_data: `price:${itemKey}:${rankKey}`
    })
  );

  return {
    inline_keyboard: [
      rankButtons,
      [{
        text: '⬅ Back',
        callback_data: 'back:main'
      }]
    ]
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

export async function fetchLowestPrice(itemId) {
  const url = `${UNDERMINE_API}/v1/region/${UNDERMINE_REGION}/commodities/${itemId}/now.json`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `ApiKey ${getUndermineKey()}`,
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'User-Agent': 'personal-telegram-bot/1.0'
    }
  });

  if (!response.ok) {
    const body = await response.text();

    console.error('Undermine Exchange error:', {
      status: response.status,
      url,
      body: body.slice(0, 2000)
    });

    throw new Error(
      `Undermine Exchange request failed with ${response.status} for ${url}`
    );
  }

  const responseJson = await response.json();

  const data = responseJson.result || responseJson;

  const auctions = (data.auctions || [])
    .slice()
    .sort((a, b) => a.price - b.price);

  const priceLevels = [];

  for (const auction of auctions) {
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
    price: data.price,
    quantity: data.quantity
  };

  const rawSnapshot =
    data.lastSeen ||
    data.lastUpdated ||
    data.snapshot;

  const parsedSnapshot = rawSnapshot
    ? new Date(rawSnapshot).getTime()
    : NaN;

  const hasSnapshot = Number.isFinite(parsedSnapshot);

  const snapshotUnixSeconds = hasSnapshot
    ? Math.floor(parsedSnapshot / 1000)
    : null;

  return {
    itemId,

    lowestPriceCopper: lowest.price,

    lowestPriceText: formatGoldFromCopper(lowest.price),

    lowestQuantity: lowest.quantity,

    priceLevels: priceLevels.map(level => ({
      priceText: formatGoldFromCopper(level.price),
      quantity: level.quantity
    })),

    totalQuantity: data.quantity,

    auctionCount: auctions.length,

    snapshot: snapshotUnixSeconds,

    snapshotText: snapshotUnixSeconds
      ? formatSnapshot(snapshotUnixSeconds)
      : 'No current listings',

    sourceUrl: url
  };
}

async function getBlizzardAccessToken() {
  const clientId = process.env.BLIZZARD_CLIENT_ID;
  const clientSecret = process.env.BLIZZARD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Missing BLIZZARD_CLIENT_ID or BLIZZARD_CLIENT_SECRET environment variable'
    );
  }

  const basic = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString('base64');

  const response = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const body = await response.text();

    console.error('Blizzard OAuth error:', {
      status: response.status,
      body: body.slice(0, 1000)
    });

    throw new Error(
      `Blizzard OAuth request failed with ${response.status}`
    );
  }

  const data = await response.json();

  return data.access_token;
}

export async function fetchTokenPrice() {
  const accessToken = await getBlizzardAccessToken();

  const url =
    'https://eu.api.blizzard.com/data/wow/token/index?namespace=dynamic-eu&locale=en_US';

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const body = await response.text();

    console.error('Blizzard token error:', {
      status: response.status,
      url,
      body: body.slice(0, 1000)
    });

    throw new Error(
      `Blizzard token request failed with ${response.status}`
    );
  }

  const data = await response.json();

  const updatedSeconds = Math.floor(
    Number(data.last_updated_timestamp) / 1000
  );

  return {
    priceCopper: data.price,
    priceText: formatGoldFromCopper(data.price),
    updatedText: Number.isFinite(updatedSeconds)
      ? formatSnapshot(updatedSeconds)
      : 'unknown'
  };
}

export function priceMessage(
  itemLabel,
  rankLabel,
  priceData
) {
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
