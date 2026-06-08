import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const QWEN_API_KEY = process.env.BITGET_QWEN_API_KEY;
const QWEN_URL = process.env.BITGET_QWEN_URL || 'https://hackathon.bitgetops.com/v1';
const QWEN_MODEL = process.env.BITGET_QWEN_MODEL || 'qwen3.6-plus';

const hasQwenKey = !!QWEN_API_KEY;

if (!hasQwenKey) {
  console.log("⚠️ No QWEN API key detected. Reflex will fail on cognitive tasks as mock fallback is disabled.");
} else {
  console.log(`🧠 Qwen API client initialized pointing to model: ${QWEN_MODEL} at: ${QWEN_URL}`);
}

// Helper to make chat completions
async function getCompletion(systemPrompt, userPrompt) {
  if (!QWEN_API_KEY) {
    throw new Error("Qwen API key is not configured in the .env file.");
  }

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
    timeout: 60000 // 60s timeout to prevent client-side errors under load
  });

  const content = response.data.choices[0].message.content;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const cleanContent = jsonMatch ? jsonMatch[0] : content;
  return JSON.parse(cleanContent);
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
