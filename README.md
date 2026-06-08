# ⚡ Reflex: Autonomous Self-Correcting AI Trading Agent

Reflex is an autonomous cognitive trading agent built to interface with the **Bitget API** and powered by the **Qwen LLM engine**. 

Reflex does not just execute trades—it learns from its mistakes. The platform features an event-driven **Sentinel Auditor** that triggers automatically when any active position closes in a loss. The auditor performs a cognitive post-mortem analysis of the market conditions during entry, writes a detailed report, and generates a new concrete constraint rule (e.g., *“IF news sentiment is highly negative, THEN disable long Technical Breakout entries”*) which is appended to the **Rules Engine** in real-time. This prevents the agent from repeating the same trading mistakes.

---

## 🚀 Key Features

*   **Qwen Cognitive Engine**: Consults the Qwen LLM on every trading cycle to analyze technical structures, volume, and macro news catalysts before opening positions.
*   **Sentinel Auditor (Self-Correction)**: Automatically audits failed trades in real-time, executing a post-mortem and writing new risk rules to protect capital.
*   **Dynamic Rules Engine**: Active constraints are evaluated in real-time by the trading agent before any position is initiated.
*   **USDT Portfolio Telemetry**: Shows real-time balance, available margin, leverage settings, and dynamic percentage profit trackers.
*   **Interactive Simulation Dashboard**:
    *   *Real-time charts* showing market prices and entry points.
    *   *Execution Console* showing real-time logs of the agent's logic.
    *   *Sentiment Injector* to test how the agent reacts to major macro/news events.
    *   *System Configurations Modal* to set trading size allocations (AUTO, 0.01 BTC, 0.05 BTC, 0.10 BTC).

---

## 🛠️ Tech Stack

*   **Frontend**: React (Vite), Socket.io-client, Vanilla CSS (Terminal theme)
*   **Backend**: Node.js, Express, Socket.io, Axios
*   **Execution APIs**: Bitget API (USDT-Futures), Qwen Chat Completions API

---

## ⚙️ Setup & Configuration

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 2. Environment Configuration
Create a `.env` file in the root directory of the project:

```env
# Port configuration
PORT=3001

# --- QWEN COGNITIVE API ---
# Provide your Qwen API key. If omitted, the agent runs in Mock/Simulation mode for cognitive tasks.
BITGET_QWEN_API_KEY=your_qwen_api_key_here
BITGET_QWEN_URL=https://hackathon.bitgetops.com/v1
BITGET_QWEN_MODEL=qwen3.6-plus

# --- BITGET API credentials ---
# Provide your API credentials. If omitted, Reflex runs in a Mock Paper-Trading Sandbox.
BITGET_API_KEY=your_bitget_api_key_here
BITGET_SECRET_KEY=your_bitget_secret_key_here
BITGET_PASSPHRASE=your_bitget_passphrase_here
BITGET_API_URL=https://api.bitget.com
BITGET_LIVE_MODE=false # Set to true to execute live mainnet orders (Caution!)
AUTO_START_AGENT=true # Set to true to start the trading tick loop on server boot
```

*Note: If no API credentials are provided, the system automatically falls back to an offline **Mock/Paper Sandbox** (initializing with **$10,000.00** mock USD and simulated tickers) so you can test all features without risking capital.*

---

## 🏃 How to Run the Application

### 1. Install Dependencies
Run the following command in the project root:
```bash
npm install
```

### 2. Start the Backend Server
Run the Express/Socket.io backend:
```bash
npm run server
```
This boots the backend on [http://localhost:3001](http://localhost:3001).

### 3. Start the Frontend Dashboard
In a separate terminal window, run the Vite development server:
```bash
npm run dev
```
Open the local browser link displayed in your terminal (typically [http://localhost:5173](http://localhost:5173)) to view the Reflex dashboard.

---

## 💡 How to Use the Reflex Agent

1.  **Configure Trading Size**: 
    Click the **Settings** tab in the sidebar, choose your trading size allocation (e.g., `0.01 BTC`, `0.05 BTC`, or `AUTO` to let the AI decide size based on conviction), and click **Confirm Configuration**.
2.  **Deploy the Agent**: 
    Click the **DEPLOY** button in the top right to start the execution cycle. The console will begin outputting scans and decisions.
3.  **Inject Sentiment Catalysts**: 
    Use the **Sentiment Injector** panel to feed external news (e.g., *"Federal Reserve announces unexpected interest rate hike"*). Watch the next agent tick digest this catalyst, consult the rules engine, and adjust its direction or halt entry.
4.  **Audit Closed Position Loss**: 
    When an active trade hits a simulated stop-loss, the Sentinel Auditor will take over, pop up the audit overlay, analyze the loss, update the rules panel, and output a detailed markdown report which you can **Inspect** at any time under the **Audit Center**.
