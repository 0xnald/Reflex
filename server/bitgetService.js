import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.BITGET_API_KEY;
const SECRET_KEY = process.env.BITGET_SECRET_KEY;
const PASSPHRASE = process.env.BITGET_PASSPHRASE;
const API_URL = process.env.BITGET_API_URL || 'https://api.bitget.com';

const hasKeys = API_KEY && SECRET_KEY && PASSPHRASE;
if (!hasKeys) {
  throw new Error("CRITICAL: Bitget API keys (BITGET_API_KEY, BITGET_SECRET_KEY, BITGET_PASSPHRASE) are missing from the environment (.env). Mock mode is disabled.");
}
let isMockMode = false;
console.log(`🔌 Bitget API client initialized pointing to: ${API_URL}`);

// Helper to generate the signature
function generateSignature(timestamp, method, path, queryString = '', body = '') {
  let message = timestamp + method.toUpperCase() + path;
  if (queryString) {
    message += '?' + queryString;
  }
  if (body) {
    message += (typeof body === 'string' ? body : JSON.stringify(body));
  }
  return crypto.createHmac('sha256', SECRET_KEY)
    .update(message)
    .digest('base64');
}

// Request wrapper for authenticated calls
async function request(method, path, params = {}, data = null) {
  if (isMockMode) {
    return handleMockRequest(method, path, params, data);
  }

  if (method.toUpperCase() === 'POST' && path === '/api/v2/mix/order/place-order' && data) {
    const legacySide = data.side ? data.side.toLowerCase() : '';
    if (legacySide === 'open_long') {
      data.side = 'buy';
      data.tradeSide = 'open';
    } else if (legacySide === 'open_short') {
      data.side = 'sell';
      data.tradeSide = 'open';
    } else if (legacySide === 'close_long') {
      data.side = 'sell';
      data.tradeSide = 'close';
    } else if (legacySide === 'close_short') {
      data.side = 'buy';
      data.tradeSide = 'close';
    }
  }

  const timestamp = Date.now().toString();
  const queryString = method.toUpperCase() === 'GET' && Object.keys(params).length > 0 
    ? new URLSearchParams(params).toString() 
    : '';

  const bodyStr = data ? JSON.stringify(data) : '';
  const signature = generateSignature(timestamp, method, path, queryString, bodyStr);

  const headers = {
    'ACCESS-KEY': API_KEY,
    'ACCESS-SIGN': signature,
    'ACCESS-TIMESTAMP': timestamp,
    'ACCESS-PASSPHRASE': PASSPHRASE,
    'locale': 'en-US',
    'Content-Type': 'application/json'
  };

  if (process.env.BITGET_LIVE_MODE !== 'true') {
    headers['PAPTRADING'] = '1';
  }

  const config = {
    method,
    url: `${API_URL}${path}`,
    headers,
  };

  if (method.toUpperCase() === 'GET') {
    config.params = params;
  } else {
    config.data = data;
  }

  try {
    const response = await axios(config);
    if (response.data && response.data.code === '00000') {
      let data = response.data.data;
      if (path === '/api/v2/mix/account/accounts' && Array.isArray(data)) {
        data = data.map(acc => ({
          ...acc,
          equity: acc.equity || acc.accountEquity
        }));
      }
      if (path === '/api/v2/mix/position/all-position' && Array.isArray(data)) {
        data = data.map(pos => ({
          ...pos,
          openPrice: pos.openPrice || pos.openPriceAvg
        }));
      }
      return data;
    } else {
      throw new Error(`Bitget Error: ${response.data.msg || JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error(`🔴 Bitget API Request Fail: [${method}] ${path}`, error.message);
    if (error.response && error.response.data) {
      console.error("   Response Data:", JSON.stringify(error.response.data));
    }
    throw error;
  }
}

// --- Mock Data Store for Mock Mode ---
let mockBalance = 10000.0; // Starting mock balance of 10,000 USDT
let mockPositions = []; // Active positions [{ symbol, marginMode, side, size, entryPrice, openPrice, pnl, marginCoin }]
let mockTickers = {
  'BTCUSDT': 68500.0,
  'ETHUSDT': 3500.0,
  'SOLUSDT': 145.0
};
let mockNews = "";

function setMockNews(news) {
  mockNews = news ? news.toLowerCase() : "";
}

// Simulate random price updates for mock mode
setInterval(() => {
  let bias = 0.5; // neutral default (random walk)
  let scale = 0.002; // default 0.2% max change

  if (mockNews) {
    const bearishWords = ["dump", "crash", "drop", "bearish", "hike", "negative", "loss", "down", "bad", "sell"];
    const bullishWords = ["pump", "moon", "bullish", "rally", "positive", "gain", "up", "good", "buy"];

    const isBearish = bearishWords.some(w => mockNews.includes(w));
    const isBullish = bullishWords.some(w => mockNews.includes(w));

    if (isBearish) {
      bias = 0.75; // 75% chance of going down
      scale = 0.015; // 1.5% max change (fast volatility dump)
    } else if (isBullish) {
      bias = 0.25; // 25% chance of going down (75% chance of going up)
      scale = 0.015; // 1.5% max change (fast volatility pump)
    }
  }

  for (let sym in mockTickers) {
    const pct = (Math.random() - bias) * scale;
    mockTickers[sym] = parseFloat((mockTickers[sym] * (1 + pct)).toFixed(2));
    
    // Update PnL of open positions
    mockPositions.forEach(pos => {
      if (pos.symbol === sym) {
        const currentPrice = mockTickers[sym];
        const dir = pos.side === 'open_long' || pos.side === 'long' ? 1 : -1;
        const priceDiff = currentPrice - pos.entryPrice;
        pos.pnl = parseFloat((dir * priceDiff * pos.size).toFixed(4));
      }
    });
  }
}, 2000);

function handleMockRequest(method, path, params, data) {
  const methodUpper = method.toUpperCase();

  // 1. Get Ticker
  if (methodUpper === 'GET' && path === '/api/v2/mix/market/ticker') {
    const symbol = params.symbol || 'BTCUSDT';
    const price = mockTickers[symbol] || 68000.0;
    return [{
      symbol,
      lastPr: price.toString(),
      bidPr: (price - 0.5).toString(),
      askPr: (price + 0.5).toString(),
      change24h: '0.015',
      high24h: (price * 1.02).toString(),
      low24h: (price * 0.98).toString()
    }];
  }

  // 2. Get Balances
  if (methodUpper === 'GET' && path === '/api/v2/mix/account/accounts') {
    const totalEquity = (mockBalance + mockPositions.reduce((acc, p) => acc + p.pnl, 0)).toFixed(4);
    return [
      {
        marginCoin: 'USDT',
        available: mockBalance.toFixed(4),
        equity: totalEquity,
        accountEquity: totalEquity,
        locked: '0.0000'
      }
    ];
  }

  // 3. Get Positions
  if (methodUpper === 'GET' && path === '/api/v2/mix/position/all-position') {
    return mockPositions.map(pos => ({
      symbol: pos.symbol,
      marginMode: pos.marginMode,
      holdSide: pos.side === 'open_long' ? 'long' : 'short',
      total: pos.size.toString(),
      available: pos.size.toString(),
      openPrice: pos.entryPrice.toString(),
      marketPrice: (mockTickers[pos.symbol] || pos.entryPrice).toString(),
      unrealizedPL: pos.pnl.toString(),
      marginCoin: pos.marginCoin
    }));
  }

  // 4. Place Order
  if (methodUpper === 'POST' && path === '/api/v2/mix/order/place-order') {
    const { symbol, marginMode, side, size, orderType } = data;
    const currentPrice = mockTickers[symbol] || 68000.0;
    const orderSize = parseFloat(size);

    if (side === 'open_long' || side === 'open_short') {
      // Open position
      const newPos = {
        symbol,
        marginMode,
        side,
        size: orderSize,
        entryPrice: currentPrice,
        pnl: 0.0,
        marginCoin: 'USDT'
      };
      mockPositions.push(newPos);
      return {
        orderId: `mock_order_${Math.random().toString(36).substr(2, 9)}`,
        clientOid: data.clientOid || ''
      };
    } else if (side === 'close_long' || side === 'close_short') {
      // Close position
      const targetSide = side === 'close_long' ? 'open_long' : 'open_short';
      const posIndex = mockPositions.findIndex(p => p.symbol === symbol && p.side === targetSide);
      if (posIndex > -1) {
        const closedPos = mockPositions[posIndex];
        const pnl = closedPos.pnl;
        mockBalance += pnl; // Add pnl to balance
        mockPositions.splice(posIndex, 1);
        return {
          orderId: `mock_order_${Math.random().toString(36).substr(2, 9)}`,
          pnl: pnl.toString()
        };
      } else {
        throw new Error("Bitget Mock Error: No position to close.");
      }
    }
  }

  throw new Error(`Bitget Mock Error: Endpoint not mocked: ${path}`);
}

export default {
  isMockMode: () => isMockMode,
  setMockNews,
  getTicker: (symbol) => request('GET', '/api/v2/mix/market/ticker', { productType: 'USDT-FUTURES', symbol }),
  getBalances: () => request('GET', '/api/v2/mix/account/accounts', { productType: 'USDT-FUTURES' }),
  getPositions: () => request('GET', '/api/v2/mix/position/all-position', { productType: 'USDT-FUTURES' }),
  placeOrder: (data) => request('POST', '/api/v2/mix/order/place-order', {}, { productType: 'USDT-FUTURES', ...data })
};
