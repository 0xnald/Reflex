import fs from 'fs';
import path from 'path';
import bitgetService from './bitgetService.js';
import * as qwenService from './qwenService.js';

const rulesPath = path.resolve('server/rules.json');

let isLoopRunning = false;
let loopInterval = null;
let ioInstance = null;
let currentNews = "Market trading stable. No high-impact events.";
let tradingSizeConfig = "auto";

// Local state to track active trades and detect closures/losses
let activeTradesState = []; 
let previousBalance = 50000.0;

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
  try {
    broadcastLog('thinking', 'Scanning market conditions and active positions...');

    // 1. Fetch data from Bitget
    const symbol = 'BTCUSDT';
    const tickerList = await bitgetService.getTicker(symbol);
    const ticker = tickerList && tickerList[0];
    if (!ticker) {
      throw new Error("Unable to fetch market price.");
    }

    const balances = await bitgetService.getBalances();
    const futuresBalance = balances.find(b => b.marginCoin === 'USDT');
    const currentBalance = futuresBalance ? parseFloat(futuresBalance.equity) : previousBalance;

    const positionsList = await bitgetService.getPositions();
    
    // Broadcast updated account details to UI
    if (ioInstance) {
      ioInstance.emit('account_update', {
        balance: currentBalance,
        available: futuresBalance ? parseFloat(futuresBalance.available) : currentBalance,
        positions: positionsList,
        price: parseFloat(ticker.lastPr),
        isMock: bitgetService.isMockMode()
      });
    }

    // 2. Detect closed positions and perform audits if they closed at a loss
    await detectAndAuditClosedPositions(positionsList, currentBalance, ticker);

    // 3. Load active rules
    const rules = loadRules();

    // 4. Decision Loop
    if (positionsList.length === 0) {
      broadcastLog('info', 'No active positions. Consulting Qwen Cognitive Engine...');
      const decisionResult = await qwenService.analyzeMarket(
        ticker,
        positionsList,
        rules,
        currentNews
      );

      broadcastLog('thinking', `Qwen decision: ${decisionResult.decision}. Reason: ${decisionResult.reasoning}`);

      if (decisionResult.decision === 'BUY' || decisionResult.decision === 'SELL') {
        const side = decisionResult.decision === 'BUY' ? 'open_long' : 'open_short';
        
        const rawSize = tradingSizeConfig === 'auto' ? decisionResult.size : parseFloat(tradingSizeConfig);
        const finalSize = isNaN(rawSize) ? 0.01 : rawSize;
        
        broadcastLog('warning', `Executing Bitget Order: ${side.toUpperCase()} for ${finalSize} BTC...`);
        
        const orderResult = await bitgetService.placeOrder({
          symbol,
          marginMode: 'isolated',
          side,
          size: finalSize.toString(),
          orderType: 'market',
          marginCoin: 'USDT'
        });

        const entryPrice = parseFloat(ticker.lastPr);
        const stopLossPrice = side === 'open_long' 
          ? entryPrice * (1 - (decisionResult.stopLossPct / 100))
          : entryPrice * (1 + (decisionResult.stopLossPct / 100));

        // Add to local state to track stop-loss and audit conditions
        const newTradeRecord = {
          symbol,
          side,
          size: finalSize,
          entryPrice,
          stopLossPrice,
          takeProfitPrice: side === 'open_long'
            ? entryPrice * (1 + (decisionResult.takeProfitPct / 100))
            : entryPrice * (1 - (decisionResult.takeProfitPct / 100)),
          orderId: orderResult.orderId,
          timestamp: Date.now(),
          marketConditionsAtEntry: {
            price: entryPrice,
            news: currentNews,
            rules: [...rules]
          }
        };
        activeTradesState.push(newTradeRecord);
        broadcastLog('success', `Trade successfully placed! Target entry: ${entryPrice}. Stop Loss: ${stopLossPrice.toFixed(2)}`);
      }
    } else {
      // Manage active positions (simulate stop-loss triggers in mock mode or check status)
      broadcastLog('info', `Managing ${positionsList.length} open position(s).`);
      
      // Stop-loss simulation logic for mock mode
      if (bitgetService.isMockMode()) {
        for (let i = activeTradesState.length - 1; i >= 0; i--) {
          const trade = activeTradesState[i];
          const currentPrice = parseFloat(ticker.lastPr);
          const isLong = trade.side === 'open_long';

          const hitSL = isLong ? (currentPrice <= trade.stopLossPrice) : (currentPrice >= trade.stopLossPrice);
          const hitTP = isLong ? (currentPrice >= trade.takeProfitPrice) : (currentPrice <= trade.takeProfitPrice);

          if (hitSL || hitTP) {
            const closeSide = isLong ? 'close_long' : 'close_short';
            broadcastLog('warning', `Stop Loss / Take Profit Hit at ${currentPrice.toFixed(2)}! Triggering position close...`);
            
            await bitgetService.placeOrder({
              symbol: trade.symbol,
              marginMode: 'isolated',
              side: closeSide,
              size: trade.size.toString(),
              orderType: 'market',
              marginCoin: 'USDT'
            });
          }
        }
      }
    }

    // Update state variables for next tick
    previousBalance = currentBalance;

  } catch (error) {
    broadcastLog('danger', `Error in trade tick: ${error.message}`);
  }
}

// Checks if positions we previously tracked have closed, and audits any losses
async function detectAndAuditClosedPositions(currentPositions, currentBalance, ticker) {
  // Check if any tracked trade in activeTradesState is no longer in currentPositions
  for (let i = activeTradesState.length - 1; i >= 0; i--) {
    const trackedTrade = activeTradesState[i];
    const isStillActive = currentPositions.some(p => p.symbol === trackedTrade.symbol && p.holdSide === (trackedTrade.side === 'open_long' ? 'long' : 'short'));

    if (!isStillActive) {
      // Position closed! Calculate realized PnL
      const finalPrice = parseFloat(ticker.lastPr);
      const direction = trackedTrade.side === 'open_long' ? 1 : -1;
      const pnl = direction * (finalPrice - trackedTrade.entryPrice) * trackedTrade.size;
      
      broadcastLog('info', `Detected closed trade on ${trackedTrade.symbol}. Realized PnL: ${pnl.toFixed(4)} USDT.`);

      if (pnl < 0) {
        // Closed in loss -> Trigger Auditor Agent!
        broadcastLog('danger', `Trade closed in loss! Initializing 'Sentinel Auditor' to perform post-mortem...`);
        
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
    }
  }
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
  broadcastLog('info', `External news event injected: "${news}"`);
}

export function setTradingSize(size) {
  tradingSizeConfig = size;
  broadcastLog('info', `Trading size configuration updated to: ${size.toUpperCase()}`);
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
