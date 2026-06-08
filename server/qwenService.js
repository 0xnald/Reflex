import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const QWEN_API_KEY = process.env.BITGET_QWEN_API_KEY;
const QWEN_URL = process.env.BITGET_QWEN_URL || 'https://hackathon.bitgetops.com/v1';
const QWEN_MODEL = process.env.BITGET_QWEN_MODEL || 'qwen3.6-plus';

const hasQwenKey = !!QWEN_API_KEY;
let isMockQwen = !hasQwenKey;

if (isMockQwen) {
  console.log("⚠️ No QWEN API key detected. Reflex is running in MOCK mode for LLM cognitive tasks.");
} else {
  console.log(`🧠 Qwen API client initialized pointing to model: ${QWEN_MODEL} at: ${QWEN_URL}`);
}

// Helper to make chat completions
async function getCompletion(systemPrompt, userPrompt) {
  if (isMockQwen) {
    return handleMockCompletion(systemPrompt, userPrompt);
  }

  try {
    const response = await axios.post(`${QWEN_URL}/chat/completions`, {
      model: QWEN_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2
    }, {
      headers: {
        'Authorization': `Bearer ${QWEN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30s timeout
    });

    const content = response.data.choices[0].message.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const cleanContent = jsonMatch ? jsonMatch[0] : content;
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error("🔴 Qwen API call failed:", error.message);
    if (error.response) {
      console.error("Qwen API Error Response:", error.response.data);
    }
    // Fallback to mock completion on error to maintain loop runtime
    console.log("⚠️ Qwen API failed. Falling back to simulated cognitive response.");
    return handleMockCompletion(systemPrompt, userPrompt);
  }
}

// Market analysis cognitive task
export async function analyzeMarket(tickerData, activePositions, activeRules, recentNews) {
  const systemPrompt = `You are the core cognitive engine of 'Reflex', an autonomous self-correcting AI trading agent on Bitget.
Your task is to analyze the market conditions and make trading decisions.
You MUST respond in JSON format with the following schema:
{
  "decision": "BUY" | "SELL" | "HOLD" | "CLOSE",
  "reasoning": "A concise explanation of why this decision was made",
  "size": 0.001, // quantity to trade (e.g. BTC count)
  "stopLossPct": 1.5, // percentage for stop loss (e.g. 1.5 for 1.5% below entry)
  "takeProfitPct": 3.0 // percentage for take profit
}

Guidelines:
- Incorporate active rules list. If an active rule forbids an entry under these conditions, you MUST choose HOLD or CLOSE.
- Keep size small (e.g., 0.001 - 0.005 for BTC/ETH to manage risk).
- Assess recent news sentiment and macro data alongside price levels.`;

  const userPrompt = `
=== CURRENT MARKET DATA ===
Asset: ${tickerData.symbol}
Last Price: ${tickerData.lastPr}
24h Change: ${tickerData.change24h}

=== ACTIVE RULES (SELF-CORRECTED CONSTRAINTS) ===
${activeRules.length > 0 ? activeRules.map((r, i) => `${i + 1}. ${r}`).join('\n') : 'No rules recorded yet.'}

=== RECENT NEWS / SENTIMENT ===
${recentNews || 'No major news events currently.'}

=== CURRENT POSITIONS ===
${JSON.stringify(activePositions, null, 2)}

Provide your trading decision. Remember, you must return JSON matching the specified format.`;

  return getCompletion(systemPrompt, userPrompt);
}

// Auditor post-mortem cognitive task
export async function auditTrade(failedTrade, marketConditions, currentRules) {
  const systemPrompt = `You are the 'Sentinel Auditor' of 'Reflex', an autonomous self-correcting AI trading agent on Bitget.
Your task is to analyze a failed trade that resulted in a loss, identify why the trading hypothesis failed, write a detailed post-mortem report, and formulate a new concrete trading constraint to prevent repeating this mistake.

You MUST respond in JSON format with the following schema:
{
  "report": "A detailed post-mortem report in Markdown detailing the market conditions, the original trade thesis, why it failed, and the lesson learned.",
  "newRule": "A single, clear, actionable constraint rule starting with 'IF' and ending with 'THEN' (e.g., 'IF news sentiment is highly negative and price is below 200 EMA, THEN disable all long entries')."
}

Ensure the rule is specific and directly addresses the cause of the loss.`;

  const userPrompt = `
=== FAILED TRADE DETAILS ===
Symbol: ${failedTrade.symbol}
Side: ${failedTrade.side}
Entry Price: ${failedTrade.entryPrice}
Close Price: ${failedTrade.closePrice}
Loss Amount: ${failedTrade.loss} USDT
Reason for Exit: Stop-loss triggered or manual emergency close.

=== MARKET CONDITIONS DURING EXECUTION ===
${JSON.stringify(marketConditions, null, 2)}

=== ACTIVE RULES PRIOR TO FAILURE ===
${currentRules.length > 0 ? currentRules.map((r, i) => `${i + 1}. ${r}`).join('\n') : 'No active rules yet.'}

Provide your post-mortem analysis and the new rule in JSON format.`;

  return getCompletion(systemPrompt, userPrompt);
}

// --- Mock LLM Completion Engine ---
function handleMockCompletion(systemPrompt, userPrompt) {
  // If userPrompt contains FAILED TRADE DETAILS, it's an audit request
  if (userPrompt.includes('FAILED TRADE DETAILS')) {
    // Audit mock
    const newRules = [
      "IF market volatility (ATR) is extreme and price dumps below support, THEN disable all long technical breakout entries.",
      "IF news contains 'rate hike' and sentiment score is negative, THEN restrict trading to short positions or stay flat.",
      "IF RSI is extremely overbought (> 80) on the 15m chart, THEN disable long orders and hold."
    ];
    const chosenRule = newRules[Math.floor(Math.random() * newRules.length)];
    
    return {
      report: `### Trade Post-Mortem Report

The long entry hypothesis failed because the market experienced sudden downward volatility that breached our stop-loss level.
The technical indicators (RSI neutral, EMA crossover) suggested a breakout, but macro news/volume overrode the technical structure.

**Key Lessons Learned:**
- Technical indicators are secondary to high-volume sentiment dumps.
- Volatility spikes require wider stop-losses or staying out of the market.`,
      newRule: chosenRule
    };
  } else {
    // Market analysis mock
    const rand = Math.random();
    let decision = 'HOLD';
    let reasoning = 'Market shows no clear trend; waiting for clear technical configuration or sentiment catalysts.';
    let size = 0.002;

    if (rand < 0.15) {
      decision = 'BUY';
      reasoning = 'Technical structure bullish: price holding above 20 EMA with positive volume and neutral RSI indicators.';
    } else if (rand > 0.85) {
      decision = 'SELL';
      reasoning = 'Technical structure bearish: price breaks below local consolidation support with rising selling volume.';
    }

    // Check if there is an active position to decide to CLOSE
    if (userPrompt.includes('"symbol"') && !userPrompt.includes('"symbol": []')) {
      if (Math.random() < 0.25) {
        decision = 'CLOSE';
        reasoning = 'Closing position to protect capital due to technical indicator divergence.';
      }
    }

    return {
      decision,
      reasoning,
      size,
      stopLossPct: 1.5,
      takeProfitPct: 3.0
    };
  }
}
