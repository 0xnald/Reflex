import bitgetService from './bitgetService.js';
import * as qwenService from './qwenService.js';

async function testEndpoints() {
  console.log("=== RUNNING API DIAGNOSTICS ===");
  console.log("Bitget Base URL:", process.env.BITGET_API_URL || 'https://api.bitget.com');
  console.log("Qwen Base URL:", process.env.BITGET_QWEN_URL || 'https://hackathon.bitgetops.com/v1');
  console.log("Mock Mode Active:", bitgetService.isMockMode());

  // 1. Test Ticker
  try {
    console.log("\n1. Testing Bitget Ticker...");
    const ticker = await bitgetService.getTicker('BTCUSDT');
    console.log("✅ Ticker Success:", ticker ? ticker[0]?.lastPr : 'No data');
  } catch (error) {
    console.log("❌ Ticker Failed:", error.message);
    if (error.response) console.log("   Status:", error.response.status, "URL:", error.config?.url);
  }

  // 2. Test Balance
  try {
    console.log("\n2. Testing Bitget Balance...");
    const balance = await bitgetService.getBalances();
    console.log("✅ Balance Success:", JSON.stringify(balance));
  } catch (error) {
    console.log("❌ Balance Failed:", error.message);
    if (error.response) console.log("   Status:", error.response.status, "URL:", error.config?.url);
  }

  // 3. Test Positions
  try {
    console.log("\n3. Testing Bitget Positions...");
    const positions = await bitgetService.getPositions();
    console.log("✅ Positions Success:", JSON.stringify(positions));
  } catch (error) {
    console.log("❌ Positions Failed:", error.message);
    if (error.response) console.log("   Status:", error.response.status, "URL:", error.config?.url);
  }

  // 4. Test Qwen API
  try {
    console.log("\n4. Testing Qwen API...");
    const qwen = await qwenService.analyzeMarket(
      { symbol: 'BTCUSDT', lastPr: '68000', change24h: '0.01' },
      [],
      [],
      "Test news"
    );
    console.log("✅ Qwen Success:", JSON.stringify(qwen));
  } catch (error) {
    console.log("❌ Qwen Failed:", error.message);
    if (error.response) console.log("   Status:", error.response.status, "URL:", error.config?.url);
  }
}

testEndpoints();
