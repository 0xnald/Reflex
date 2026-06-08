import fs from 'fs';
import path from 'path';
import bitgetService from './bitgetService.js';
import * as qwenService from './qwenService.js';

const SUPPORTED_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'BCHUSDT'];
const MAX_CONCURRENT_POSITIONS = 3;

const rulesPath = path.resolve('server/rules.json');
const activeTradesPath = path.resolve('server/activeTrades.json');

function loadActiveTrades() {
  try {
    if (fs.existsSync(activeTradesPath)) {
      const data = fs.readFileSync(activeTradesPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading active trades:", error.message);
  }
  return [];
}

function saveActiveTrades(trades) {
  try {
    fs.writeFileSync(activeTradesPath, JSON.stringify(trades, null, 2), 'utf8');
  } catch (error) {
    console.error("Error saving active trades:", error.message);
  }
}

let isLoopRunning = false;
let isTickRunning = false;
let loopInterval = null;
let ioInstance = null;
let currentNews = "Market trading stable. No high-impact events.";
let tradingSizeConfig = "10%";

// Local state to track active trades and detect closures/losses
let activeTradesState = loadActiveTrades(); 
let previousBalance = 0.0;

function loadRules() {
  try {
    const data = fs.readFileSync(rulesPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Error loading rules:", error.message);
    return [];
  }
}

function saveRules(rules) {
  try {
    fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2), 'utf8');
  } catch (error) {
    console.error("Error saving rules:", error.message);
  }
}

// Log message to console and broadcast to UI
function broadcastLog(type, message, details = null) {
  const logEntry = {
    timestamp: new Date().toLocaleTimeString(),
    type, // 'info', 'success', 'warning', 'danger', 'thinking'
    message,
    details
  };
  console.log(`[${type.toUpperCase()}] ${message}`);
  if (ioInstance) {
    ioInstance.emit('agent_log', logEntry);
  }
}

// Main cognitive trade cycle tick
async function tick() {
  if (isTickRunning) {
    broadcastLog('thinking', 'Tick skipped: previous scan still active.');
    return;
  }
  isTickRunning = true;
  try {
    broadcastLog('thinking', 'Scanning market conditions and active positions...');

    // 1. Fetch live tickers for all supported symbols in parallel
    const tickers = {};
    try {
      const tickerPromises = SUPPORTED_SYMBOLS.map(async (sym) => {
        try {
          const tickerList = await bitgetService.getTicker(sym);
          if (tickerList && tickerList[0]) {
            tickers[sym] = tickerList[0];
          }
        } catch (e) {
          console.error(`Error fetching ticker for ${sym}:`, e.message);
        }
      });
      await Promise.all(tickerPromises);
    } catch (e) {
      broadcastLog('danger', `Bitget API Ticker Error: ${e.message}`);
    }

    let currentBalance = previousBalance;
    let futuresBalance = null;
    try {
      const balances = await bitgetService.getBalances();
      futuresBalance = balances ? balances.find(b => b.marginCoin === 'USDT') : null;
      if (futuresBalance) {
        currentBalance = parseFloat(futuresBalance.equity);
      } else {
        throw new Error("USDT margin balance not found on Bitget account.");
      }
    } catch (e) {
      broadcastLog('danger', `Bitget API Balance Error: ${e.message}`);
      throw e; // Fail tick execution immediately, no trading with mock values!
    }

    let positionsList = [];
    try {
      positionsList = await bitgetService.getPositions();
    } catch (e) {
      broadcastLog('danger', `Bitget API Positions Error: ${e.message}`);
    }

    // Broadcast updated account details to UI
    if (ioInstance) {
      ioInstance.emit('account_update', {
        balance: isNaN(currentBalance) ? previousBalance : currentBalance,
        available: (futuresBalance && !isNaN(parseFloat(futuresBalance.available))) 
          ? parseFloat(futuresBalance.available) 
          : (isNaN(currentBalance) ? previousBalance : currentBalance),
        positions: positionsList || [],
        price: tickers['BTCUSDT'] ? parseFloat(tickers['BTCUSDT'].lastPr) : 0.0,
        isMock: bitgetService.isMockMode()
      });
    }

    // 2. Stop-loss / Take-profit execution monitor
    for (let i = activeTradesState.length - 1; i >= 0; i--) {
      const trade = activeTradesState[i];
      if (trade.closed) continue; // Skip already closed

      const symbolTicker = tickers[trade.symbol];
      if (!symbolTicker) continue; // Skip if ticker is missing

      const currentPrice = parseFloat(symbolTicker.lastPr);
      const isLong = trade.side === 'open_long';

      const hitSL = isLong ? (currentPrice <= trade.stopLossPrice) : (currentPrice >= trade.stopLossPrice);
      const hitTP = isLong ? (currentPrice >= trade.takeProfitPrice) : (currentPrice <= trade.takeProfitPrice);

      if (hitSL || hitTP) {
        const holdSide = isLong ? 'long' : 'short';
        broadcastLog('warning', `${trade.symbol} Stop Loss / Take Profit Hit at ${currentPrice.toFixed(2)}! Triggering position close...`);
        
        try {
          await bitgetService.closePositions({
            symbol: trade.symbol,
            holdSide: holdSide
          });

          trade.closed = true;
          trade.exitPrice = currentPrice;
          saveActiveTrades(activeTradesState);
        } catch (err) {
          broadcastLog('danger', `Failed to execute SL/TP close for ${trade.symbol}: ${err.message}`);
        }
      }
    }

    // 3. Detect closed positions and perform audits if they closed at a loss
    await detectAndAuditClosedPositions(positionsList, currentBalance, tickers);

    // 4. Decision Loop for new positions
    const rules = loadRules();
    const openPositionsCount = positionsList.length;
    const maxTradesToOpen = MAX_CONCURRENT_POSITIONS - openPositionsCount;

    const activeSymbols = positionsList.map(p => p.symbol);
    const availableSymbols = SUPPORTED_SYMBOLS.filter(sym => !activeSymbols.includes(sym));

    if (maxTradesToOpen > 0 && availableSymbols.length > 0) {
      const availableTickers = availableSymbols.map(sym => tickers[sym]).filter(Boolean);
      
      if (availableTickers.length > 0) {
        broadcastLog('info', `Positions: ${openPositionsCount}/${MAX_CONCURRENT_POSITIONS} active. Available: ${availableSymbols.join(', ')}. Scanning market opportunity...`);
        
        const decisionResult = await qwenService.analyzeMarket(
          availableTickers,
          positionsList,
          rules,
          currentNews,
          maxTradesToOpen
        );

        if (decisionResult && Array.isArray(decisionResult.trades)) {
          const recommendedTrades = decisionResult.trades
            .filter(t => t && (t.decision === 'BUY' || t.decision === 'SELL') && availableSymbols.includes(t.symbol))
            .slice(0, maxTradesToOpen);

          for (const trade of recommendedTrades) {
            const symbol = trade.symbol;
            const side = trade.decision === 'BUY' ? 'open_long' : 'open_short';
            const symbolTicker = tickers[symbol];
            if (!symbolTicker) continue;
            
            const entryPrice = parseFloat(symbolTicker.lastPr);

            let finalSize = 0.01;
            if (tradingSizeConfig === '10%') {
              // Allocate 10% of current capital as margin (at 5x leverage, 50% notional exposure)
              const margin = currentBalance * 0.10;
              const leverage = 5.0;
              finalSize = parseFloat(((margin * leverage) / entryPrice).toFixed(4));
              broadcastLog('info', `Configured for 10% Capital Margin Allocation. Balance: $${currentBalance.toFixed(2)}, Target Margin: $${margin.toFixed(2)}, Notional Exposure: $${(margin * leverage).toFixed(2)}`);
            } else {
              const btcTicker = tickers['BTCUSDT'];
              const btcPrice = btcTicker ? parseFloat(btcTicker.lastPr) : 65000.0;
              const rawSize = tradingSizeConfig === 'auto' ? (parseFloat(trade.size) || 0.001) : parseFloat(tradingSizeConfig);
              const btcSize = isNaN(rawSize) ? 0.01 : rawSize;

              if (symbol === 'BTCUSDT') {
                finalSize = btcSize;
              } else {
                const scaleFactor = btcPrice / entryPrice;
                finalSize = parseFloat((btcSize * scaleFactor).toFixed(4));
                broadcastLog('info', `Scaling trade size for ${symbol} relative to BTC: factor ${scaleFactor.toFixed(2)}x, BTC Size: ${btcSize} -> ${symbol} Size: ${finalSize}`);
              }
            }

            // Safety check to ensure finalSize is valid and positive
            if (isNaN(finalSize) || finalSize <= 0) {
              finalSize = 0.01;
            }

            broadcastLog('warning', `Executing Bitget Order for ${symbol}: ${side.toUpperCase()} for ${finalSize} ${symbol.replace('USDT', '')}...`);
            
            try {
              const orderResult = await bitgetService.placeOrder({
                symbol,
                marginMode: 'isolated',
                side,
                size: finalSize.toString(),
                orderType: 'market',
                marginCoin: 'USDT'
              });

              const slPct = parseFloat(trade.stopLossPct) || 1.5;
              const tpPct = parseFloat(trade.takeProfitPct) || 3.0;
              const stopLossPrice = side === 'open_long' 
                ? entryPrice * (1 - (slPct / 100))
                : entryPrice * (1 + (slPct / 100));
              const takeProfitPrice = side === 'open_long'
                ? entryPrice * (1 + (tpPct / 100))
                : entryPrice * (1 - (tpPct / 100));

              // Add to local state to track stop-loss and audit conditions
              const newTradeRecord = {
                symbol,
                side,
                size: finalSize,
                entryPrice,
                stopLossPrice,
                takeProfitPrice,
                orderId: orderResult.orderId,
                timestamp: Date.now(),
                marketConditionsAtEntry: {
                  price: entryPrice,
                  news: currentNews,
                  rules: [...rules]
                }
              };
              activeTradesState.push(newTradeRecord);
              saveActiveTrades(activeTradesState);
              broadcastLog('success', `${symbol} Trade successfully placed! Entry: ${entryPrice}. SL: ${stopLossPrice.toFixed(2)}, TP: ${takeProfitPrice.toFixed(2)}`);
            } catch (err) {
              broadcastLog('danger', `Failed to execute trade on ${symbol}: ${err.message}`);
            }
          }
        }
      }
    }

    // Update state variables for next tick
    previousBalance = currentBalance;

  } catch (error) {
    broadcastLog('danger', `Error in trade tick: ${error.message}`);
  } finally {
    isTickRunning = false;
  }
}

// Checks if positions we previously tracked have closed, and audits any losses
async function detectAndAuditClosedPositions(currentPositions, currentBalance, tickers) {
  // Check if any tracked trade in activeTradesState is no longer in currentPositions or marked closed
  for (let i = activeTradesState.length - 1; i >= 0; i--) {
    const trackedTrade = activeTradesState[i];
    const isStillActive = currentPositions.some(p => p.symbol === trackedTrade.symbol && p.holdSide === (trackedTrade.side === 'open_long' ? 'long' : 'short'));

    if (!isStillActive || trackedTrade.closed) {
      // Position closed! Calculate realized PnL
      const symbolTicker = tickers[trackedTrade.symbol];
      const finalPrice = trackedTrade.exitPrice || (symbolTicker ? parseFloat(symbolTicker.lastPr) : trackedTrade.entryPrice);
      const direction = trackedTrade.side === 'open_long' ? 1 : -1;
      const pnl = direction * (finalPrice - trackedTrade.entryPrice) * trackedTrade.size;
      
      broadcastLog('info', `Detected closed trade on ${trackedTrade.symbol}. Realized PnL: ${pnl.toFixed(4)} USDT.`);

      if (pnl < 0) {
        // Closed in loss -> Trigger Auditor Agent!
        broadcastLog('danger', `${trackedTrade.symbol} trade closed in loss! Initializing 'Sentinel Auditor' to perform post-mortem...`);
        
        if (ioInstance) {
          ioInstance.emit('audit_state', { active: true, symbol: trackedTrade.symbol });
        }

        const failedTradeDetails = {
          symbol: trackedTrade.symbol,
          side: trackedTrade.side,
          entryPrice: trackedTrade.entryPrice,
          closePrice: finalPrice,
          loss: Math.abs(pnl).toFixed(4)
        };

        const auditResult = await qwenService.auditTrade(
          failedTradeDetails,
          trackedTrade.marketConditionsAtEntry,
          loadRules()
        );

        // Add the new rule to the ruleset
        const rules = loadRules();
        rules.push(auditResult.newRule);
        saveRules(rules);

        broadcastLog('success', `Auditor written new constraint rule: "${auditResult.newRule}"`);
        
        if (ioInstance) {
          ioInstance.emit('audit_result', {
            report: auditResult.report,
            newRule: auditResult.newRule,
            rules: rules
          });
          ioInstance.emit('audit_state', { active: false });
        }
      }

      // Remove from tracking state
      activeTradesState.splice(i, 1);
      saveActiveTrades(activeTradesState);
    }
  }
}

export async function manualClosePosition(symbol, holdSide) {
  const sideTarget = holdSide === 'long' ? 'open_long' : 'open_short';
  const tradeIndex = activeTradesState.findIndex(t => t.symbol === symbol && t.side === sideTarget && !t.closed);
  
  let closeSize = "0.01";
  if (tradeIndex > -1) {
    closeSize = activeTradesState[tradeIndex].size.toString();
  } else {
    try {
      const exchangePositions = await bitgetService.getPositions();
      const pos = exchangePositions.find(p => p.symbol === symbol && p.holdSide === holdSide);
      if (pos) {
        closeSize = pos.total;
      } else {
        return false;
      }
    } catch (e) {
      console.error("Failed to read exchange positions for manual close:", e.message);
      return false;
    }
  }

  broadcastLog('warning', `Manual close triggered for ${symbol} ${holdSide.toUpperCase()}...`);
  
  await bitgetService.closePositions({
    symbol,
    holdSide: holdSide
  });

  if (tradeIndex > -1) {
    activeTradesState[tradeIndex].closed = true;
    try {
      const tickers = await bitgetService.getTicker(symbol);
      if (tickers && tickers[0]) {
        activeTradesState[tradeIndex].exitPrice = parseFloat(tickers[0].lastPr);
      }
    } catch (e) {
      console.error("Failed to fetch final close ticker:", e.message);
    }
    saveActiveTrades(activeTradesState);
  }
  
  return true;
}

export function startLoop(io, intervalMs = 15000) {
  if (isLoopRunning) return;
  ioInstance = io;
  isLoopRunning = true;
  tick(); // Run immediately
  loopInterval = setInterval(tick, intervalMs);
  broadcastLog('info', 'Reflex Trading Agent successfully started.');
}

export function stopLoop() {
  if (!isLoopRunning) return;
  clearInterval(loopInterval);
  isLoopRunning = false;
  broadcastLog('info', 'Reflex Trading Agent paused.');
}

export function injectNews(news) {
  currentNews = news;
  if (bitgetService.setMockNews) {
    bitgetService.setMockNews(news);
  }
  broadcastLog('info', `External news event injected: "${news}"`);
}

export function setTradingSize(size) {
  tradingSizeConfig = size;
  const sizeStr = typeof size === 'string' ? size : String(size);
  broadcastLog('info', `Trading size configuration updated to: ${sizeStr.toUpperCase()}`);
}

export function getStatus() {
  return {
    isRunning: isLoopRunning,
    currentNews,
    rules: loadRules(),
    config: {
      bitgetApiUrl: process.env.BITGET_API_URL || 'https://api.bitget.com',
      liveMode: process.env.BITGET_LIVE_MODE === 'true',
      qwenUrl: process.env.BITGET_QWEN_URL || 'https://hackathon.bitgetops.com/v1',
      qwenModel: process.env.BITGET_QWEN_MODEL || 'qwen3.6-plus',
      isMock: bitgetService.isMockMode(),
      tradingSize: tradingSizeConfig
    }
  };
}
export function addRule(rule) {
  const rules = loadRules();
  rules.push(rule);
  saveRules(rules);
  if (ioInstance) {
    ioInstance.emit('rules_update', rules);
  }
  broadcastLog('info', `Manual rule appended: "${rule}"`);
}

export function deleteRule(index) {
  const rules = loadRules();
  if (index >= 0 && index < rules.length) {
    const deleted = rules.splice(index, 1);
    saveRules(rules);
    if (ioInstance) {
      ioInstance.emit('rules_update', rules);
    }
    broadcastLog('info', `Rule deleted: "${deleted[0]}"`);
  }
}
