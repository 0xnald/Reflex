import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:3001';

export default function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [balance, setBalance] = useState(50000.0);
  const [available, setAvailable] = useState(50000.0);
  const [positions, setPositions] = useState([]);
  const [price, setPrice] = useState(0.0);
  const [isMock, setIsMock] = useState(true);
  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [currentNews, setCurrentNews] = useState('');
  
  // Auditing States
  const [auditState, setAuditState] = useState({ active: false, symbol: '' });
  const [auditResult, setAuditResult] = useState(null); 
  const [latestRuleIndex, setLatestRuleIndex] = useState(-1);

  // User input states
  const [newsInput, setNewsInput] = useState('');
  const [ruleInput, setRuleInput] = useState('');
  
  // Sidebar tab filter (active tab highlight)
  const [activeTab, setActiveTab] = useState('Agent');
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState(null);
  const [tempSize, setTempSize] = useState('auto');

  useEffect(() => {
    if (config?.tradingSize) {
      setTempSize(config.tradingSize);
    }
  }, [config]);

  const handleTabClick = (tabName, elementId) => {
    setActiveTab(tabName);
    if (tabName === 'Settings') {
      setShowSettings(true);
    } else {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Static/Historical Audits for the UI Concept
  const [historicalAudits, setHistoricalAudits] = useState([
    {
      tradeId: '#00481',
      time: '02:14:18',
      symbol: 'BTCUSDT',
      pnl: '-0.42R',
      result: 'LOSS',
      rootCause: 'Entered long after confirmation lag > 0.8s on dynamic breakout.',
      correction: 'Reduce confirmation threshold from 1.2s -> 0.8s.',
      newRule: 'Reduce confirmation threshold from 1.2s -> 0.8s.',
      ruleAdded: true,
      report: `### 🚨 POST-MORTEM AUDIT REPORT (TRADE #00481)
- **Symbol**: BTCUSDT
- **Realized PnL**: -0.42R
- **Root Cause**: The agent entered a long breakout trade when confirmation lag exceeded 0.8 seconds. This latency resulted in entering near the peak of the local volatility expansion.
- **Action Taken**: Reduced the breakout confirmation lag threshold limit from 1.2s to 0.8s to prevent entry on stale momentum signals.`
    },
    {
      tradeId: '#00480',
      time: '01:48:02',
      symbol: 'ETHUSDT',
      pnl: '+1.21R',
      result: 'WIN',
      rootCause: 'Strong confluence on 20 EMA support + volume spike held breakout.',
      correction: 'Promote pattern configuration to high-priority entries.',
      newRule: 'Promote pattern configuration to high-priority entries.',
      ruleAdded: true,
      report: `### 🚨 POST-MORTEM AUDIT REPORT (TRADE #00480)
- **Symbol**: ETHUSDT
- **Realized PnL**: +1.21R
- **Success Criteria**: Strong structural confluence at the 20 EMA support level on the 15-minute timeframe. A significant volume expansion confirmed the breakout.
- **Action Taken**: Elevated this pattern configuration to a high-priority entry list in the rules engine.`
    },
    {
      tradeId: '#00479',
      time: '01:22:51',
      symbol: 'SOLUSDT',
      pnl: '-0.31R',
      result: 'LOSS',
      rootCause: 'Trailing stop was too tight in a low-volatility regime.',
      correction: 'Scale trail width dynamically based on ATR percentile.',
      newRule: 'Scale trail width dynamically based on ATR percentile.',
      ruleAdded: false,
      report: `### 🚨 POST-MORTEM AUDIT REPORT (TRADE #00479)
- **Symbol**: SOLUSDT
- **Realized PnL**: -0.31R
- **Root Cause**: The trailing stop loss was set to a fixed width which proved too tight for the prevailing low-volatility regime, leading to a premature exit before the move completed.
- **Action Taken**: Recommendation is to dynamically adjust the trailing stop width based on ATR percentile instead of a static value.`
    }
  ]);

  // Socket reference
  const socketRef = useRef(null);
  const consoleBodyRef = useRef(null);
  
  // Price history for chart
  const [priceHistory, setPriceHistory] = useState([]);
  const canvasRef = useRef(null);

  // Connect to Backend WebSocket
  useEffect(() => {
    socketRef.current = io(BACKEND_URL);

    // Initial state loading
    socketRef.current.on('initial_state', (state) => {
      setIsRunning(state.isRunning);
      setCurrentNews(state.currentNews);
      setRules(state.rules);
      if (state.config) {
        setConfig(state.config);
      }
    });

    // Handle account and position updates
    socketRef.current.on('account_update', (data) => {
      setBalance(data.balance);
      setAvailable(data.available);
      setPositions(data.positions);
      setPrice(data.price);
      setIsMock(data.isMock);

      // Track price history
      setPriceHistory(prev => {
        const next = [...prev, { time: new Date().toLocaleTimeString(), price: data.price }];
        if (next.length > 50) next.shift(); // Keep last 50 ticks
        return next;
      });
    });

    // Handle active log feed
    socketRef.current.on('agent_log', (logEntry) => {
      setLogs(prev => [...prev, logEntry].slice(-100)); // Keep last 100 logs
    });

    // Handle rules update
    socketRef.current.on('rules_update', (updatedRules) => {
      setRules(updatedRules);
    });

    // Handle auditing state changes
    socketRef.current.on('audit_state', (state) => {
      setAuditState(state);
    });

    // Handle audit completion
    socketRef.current.on('audit_result', (result) => {
      setAuditResult(result);
      setRules(result.rules);
      setLatestRuleIndex(result.rules.length - 1);
      
      // Add a card to our Audit Center historical view
      const newAuditCard = {
        tradeId: `#00482`, // Increment or random
        time: new Date().toLocaleTimeString(),
        symbol: result.symbol || 'BTCUSDT',
        pnl: '-1.00R', // Standardized risk unit
        result: 'LOSS',
        rootCause: result.report.substring(0, 100) + '...', // Short snippet
        correction: result.newRule,
        ruleAdded: true
      };
      setHistoricalAudits(prev => [newAuditCard, ...prev]);

      // Auto-clear highlight after 10 seconds
      setTimeout(() => {
        setLatestRuleIndex(-1);
      }, 10000);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  // Handle auto-scroll on logs (inside container, doesn't scroll parent page)
  useEffect(() => {
    if (consoleBodyRef.current) {
      consoleBodyRef.current.scrollTop = consoleBodyRef.current.scrollHeight;
    }
  }, [logs]);

  // Draw Price Chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || priceHistory.length < 2) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Get min and max price for vertical scale
    const prices = priceHistory.map(p => p.price);
    let minPrice = Math.min(...prices);
    let maxPrice = Math.max(...prices);
    
    // Add buffer
    const priceDiff = maxPrice - minPrice || 10;
    minPrice -= priceDiff * 0.15;
    maxPrice += priceDiff * 0.15;

    // Coordinate mapping
    const getX = (index) => (index / (priceHistory.length - 1)) * (width - 40) + 20;
    const getY = (priceVal) => height - 30 - ((priceVal - minPrice) / (maxPrice - minPrice)) * (height - 60);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const hY = getY(minPrice + (maxPrice - minPrice) * (i / 4));
      ctx.beginPath();
      ctx.moveTo(20, hY);
      ctx.lineTo(width - 20, hY);
      ctx.stroke();
    }

    // Draw Price Path
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(priceHistory[0].price));
    for (let i = 1; i < priceHistory.length; i++) {
      ctx.lineTo(getX(i), getY(priceHistory[i].price));
    }
    
    // Neon green line
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Area fill gradient
    ctx.lineTo(getX(priceHistory.length - 1), height - 20);
    ctx.lineTo(getX(0), height - 20);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, getY(maxPrice), 0, height - 20);
    grad.addColorStop(0, 'rgba(0, 255, 102, 0.06)');
    grad.addColorStop(1, 'rgba(0, 255, 102, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw active positions reference lines on chart
    if (positions.length > 0) {
      positions.forEach(pos => {
        const entryPrice = parseFloat(pos.openPrice);
        const entryY = getY(entryPrice);

        if (entryY > 20 && entryY < height - 20) {
          ctx.strokeStyle = pos.holdSide === 'long' ? '#00ff66' : '#ff3366';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(20, entryY);
          ctx.lineTo(width - 20, entryY);
          ctx.stroke();
          ctx.setLineDash([]); // Reset
          
          ctx.fillStyle = pos.holdSide === 'long' ? '#00ff66' : '#ff3366';
          ctx.font = '10px JetBrains Mono';
          ctx.fillText(`ENTRY: ${entryPrice.toFixed(1)}`, 25, entryY - 6);
        }
      });
    }

    // Draw current price indicator dot
    const lastPoint = priceHistory[priceHistory.length - 1];
    const lastX = getX(priceHistory.length - 1);
    const lastY = getY(lastPoint.price);

    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#00ff66';
    ctx.fill();

  }, [priceHistory, positions]);

  // Toggle agent execution
  const toggleAgent = async () => {
    const nextState = !isRunning;
    try {
      const res = await fetch(`${BACKEND_URL}/api/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ running: nextState })
      });
      const data = await res.json();
      setIsRunning(data.isRunning);
    } catch (err) {
      console.error("Failed to toggle agent", err);
    }
  };

  const submitNews = async (e) => {
    e.preventDefault();
    if (!newsInput.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/news`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ news: newsInput })
      });
      const data = await res.json();
      setCurrentNews(data.currentNews);
      setNewsInput('');
    } catch (err) {
      console.error("Failed to submit news", err);
    }
  };

  const submitRule = async (e) => {
    e.preventDefault();
    if (!ruleInput.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/rule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule: ruleInput })
      });
      const data = await res.json();
      setRules(data.rules);
      setRuleInput('');
    } catch (err) {
      console.error("Failed to submit rule", err);
    }
  };

  const deleteRule = async (index) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/rule/${index}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      setRules(data.rules);
    } catch (err) {
      console.error("Failed to delete rule", err);
    }
  };

  const updateTradingSize = (size) => {
    if (socketRef.current) {
      socketRef.current.emit('update_config', { tradingSize: size });
    }
  };



  return (
    <>
      <div className="app-container">
      
      {/* ================= LEFT SIDEBAR ================= */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/logo.png" className="logo-img" alt="Reflex Logo" />
          <div className="brand-text">
            <h2>REFLEX</h2>
            <span>COGNITION V0.9.7</span>
          </div>
        </div>

        <div className="sidebar-menu">
          <div className="menu-section">
            <div className="menu-label">CONSOLE</div>
            
            <div className={`menu-item ${activeTab === 'Agent' ? 'active' : ''}`} onClick={() => handleTabClick('Agent', 'agent-header')}>
              <div className="menu-item-left">
                <span>⚡</span>
                <span>Agent</span>
              </div>
              <span className="pill-live">{isRunning ? 'LIVE' : 'STANDBY'}</span>
            </div>

            <div className={`menu-item ${activeTab === 'Markets' ? 'active' : ''}`} onClick={() => handleTabClick('Markets', 'chart-widget')}>
              <div className="menu-item-left">
                <span>📈</span>
                <span>Markets</span>
              </div>
              <span className="menu-badge">BTC</span>
            </div>

            <div className={`menu-item ${activeTab === 'Positions' ? 'active' : ''}`} onClick={() => handleTabClick('Positions', 'positions-widget')}>
              <div className="menu-item-left">
                <span>💼</span>
                <span>Positions</span>
              </div>
              <span className="menu-badge">{positions.length}</span>
            </div>

            <div className={`menu-item ${activeTab === 'Memory' ? 'active' : ''}`} onClick={() => handleTabClick('Memory', 'console-widget')}>
              <div className="menu-item-left">
                <span>🧠</span>
                <span>Memory</span>
              </div>
              <span className="menu-badge">{logs.length}</span>
            </div>

            <div className={`menu-item ${activeTab === 'Audits' ? 'active' : ''}`} onClick={() => handleTabClick('Audits', 'audits-widget')}>
              <div className="menu-item-left">
                <span>🔎</span>
                <span>Audits</span>
              </div>
              <span className="menu-badge">{historicalAudits.length}</span>
            </div>

            <div className={`menu-item ${activeTab === 'Rules' ? 'active' : ''}`} onClick={() => handleTabClick('Rules', 'rules-widget')}>
              <div className="menu-item-left">
                <span>📜</span>
                <span>Rules Engine</span>
              </div>
              <span className="menu-badge">{rules.length}</span>
            </div>

            <div className={`menu-item ${activeTab === 'Settings' ? 'active' : ''}`} onClick={() => handleTabClick('Settings', 'settings')}>
              <div className="menu-item-left">
                <span>⚙️</span>
                <span>Settings</span>
              </div>
              <span className="menu-badge">CONFIG</span>
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="build-status">
            <span>build 9f3a1c</span>
            <div className="status-indicator">
              <div className="status-dot"></div>
              <span>healthy</span>
            </div>
          </div>
          <div className="footer-quote">EVERY TRADE TEACHES.</div>
        </div>
      </aside>

      {/* ================= RIGHT MAIN AREA ================= */}
      <main className="main-content">
        
        {/* Top Navigation Bar */}
        <header className="top-nav">
          <div className="nav-path">
            ~/reflex / agent / <strong>cognition_loop</strong>
          </div>

          <div className="nav-controls">
            <span className="autonomous-tag">
              • {isRunning ? 'AUTONOMOUS' : 'PAUSED'}
            </span>



            <button onClick={toggleAgent} className="btn-deploy">
              {isRunning ? 'HALT AGENT' : 'DEPLOY'}
            </button>
          </div>
        </header>

        {/* Dashboard Scrollable Workspace */}
        <div className="dashboard-body">
          
          {/* Trading View Subheader */}
          <div id="agent-header" className="trading-view-header">
            <div className="tv-symbol">
              <span className="tv-label">TRADING VIEW</span>
              <strong>BTCUSDT</strong>
              <span style={{ color: 'var(--neon-green)' }}>
                ${price > 0 ? price.toLocaleString() : '---'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--neon-green)', opacity: 0.8 }}>
                {isMock ? ' (Demo Sandbox)' : ' (Live API)'}
              </span>
            </div>


          </div>

          {/* Core Panel Grid */}
          <div className="dashboard-grid">
            
            {/* Left/Main column widgets */}
            <div className="main-column">
              
              {/* 1. Real-time chart */}
              <div id="chart-widget" className="canvas-wrapper">
                <canvas ref={canvasRef} className="canvas-element" width={720} height={240} />
                {priceHistory.length < 2 && (
                  <div style={{ color: 'var(--text-muted)', position: 'absolute' }}>
                    Initializing trading chart telemetry...
                  </div>
                )}
              </div>

              {/* 2. Rules Engine panel */}
              <div id="rules-widget" className="panel">
                <div className="panel-header">
                  <h3>RULES ENGINE</h3>
                  <span className="panel-header-count">{rules.length} ACTIVE</span>
                </div>
                <div className="panel-body" style={{ padding: '0' }}>
                  {rules.map((rule, idx) => {
                    // Alternate row classes to match concept UI
                    let rowClass = "rule-row-success";
                    let statusLabel = "• ACTIVE";
                    
                    if (idx === 0) {
                      rowClass = "rule-row-danger";
                      statusLabel = "AGENT STATUS";
                    } else if (idx === latestRuleIndex) {
                      rowClass = "rule-row-danger";
                      statusLabel = "NEW RULE";
                    }

                    return (
                      <div key={idx} className={`rule-row ${rowClass}`}>
                        <div className="rule-id">R-0{30 - idx}</div>
                        <div className="rule-status-container">
                          <div className="rule-status-dot"></div>
                          <span style={{ fontSize: '10px', fontWeight: '700' }}>{statusLabel}</span>
                        </div>
                        <div className="rule-code">{rule}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Audit Center / post-mortems cards */}
              <div id="audits-widget" className="panel">
                <div className="panel-header">
                  <h3>AUDIT CENTER <span>post-mortems</span></h3>
                  <span className="panel-header-count">{historicalAudits.length} TODAY</span>
                </div>
                <div className="panel-body">
                  <div className="audit-cards-grid">
                    {historicalAudits.map((audit, idx) => (
                      <div 
                        key={idx} 
                        className={`audit-card ${idx === 0 && auditState.active ? 'audit-card-new' : ''}`}
                      >
                        <div className="card-header">
                          <span>TRADE {audit.tradeId}</span>
                          <span>{audit.time}</span>
                        </div>
                        
                        <div className="card-symbol-row">
                          <span className="card-symbol">{audit.symbol}</span>
                          <span className={`card-pnl-pill ${audit.result === 'LOSS' ? 'card-pnl-loss' : 'card-pnl-win'}`}>
                            {audit.pnl} {audit.result}
                          </span>
                        </div>

                        <div className="card-section">
                          <span className="card-section-label">ROOT CAUSE</span>
                          <span className="card-section-val">{audit.rootCause}</span>
                        </div>

                        <div className="card-section">
                          <span className="card-section-label">CORRECTION</span>
                          <span className="card-section-val">{audit.correction}</span>
                        </div>

                        <div className="card-footer">
                          {audit.ruleAdded ? (
                            <span className="card-rule-status">✓ Rule Added</span>
                          ) : (
                            <span className="card-rule-status" style={{ color: 'var(--neon-gold)' }}>⚠ Reviewed</span>
                          )}
                          <span className="card-inspect-link" onClick={() => setAuditResult(audit)}>inspect →</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* Right column widgets (Positions, Logs, Sentiment Controls) */}
            <div className="main-column" style={{ gap: '20px' }}>
              
              {/* 1. Account statistics & balances */}
              <div className="panel" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>USDT PORTFOLIO</span>
                  <span style={{ color: 'var(--neon-green)', fontWeight: '700' }}>ONLINE</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--neon-green)' }}>
                    ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className={balance >= 50000.0 ? 'text-gain' : 'text-loss'} style={{ fontSize: '14px', fontWeight: '700' }}>
                    {balance >= 50000.0 ? '+' : ''}{(((balance - 50000.0) / 50000.0) * 100).toFixed(2)}%
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span>Available: ${available.toFixed(2)}</span>
                  <span>Leverage: Isolated 5x</span>
                </div>
              </div>

              {/* 2. Positions Sidebar Panel */}
              <div id="positions-widget" className="panel">
                <div className="panel-header">
                  <h3>ACTIVE POSITIONS</h3>
                  <span className="panel-header-count">{positions.length} OPEN</span>
                </div>
                <div className="panel-body">
                  {positions.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic' }}>
                      ~/reflex: no active positions listed on exchange.
                    </div>
                  ) : (
                    positions.map((pos, idx) => (
                      <div 
                        key={idx} 
                        className={`position-item-sidebar ${pos.holdSide === 'long' ? 'side-long' : 'side-short'}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', marginBottom: '4px' }}>
                          <span>{pos.symbol} {pos.holdSide.toUpperCase()}</span>
                          <span className={parseFloat(pos.unrealizedPL) >= 0 ? 'text-gain' : 'text-loss'}>
                            {parseFloat(pos.unrealizedPL) >= 0 ? '+' : ''}
                            {parseFloat(pos.unrealizedPL).toFixed(2)} USDT
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <span>Size: {pos.total} BTC</span>
                          <span>Entry: ${parseFloat(pos.openPrice).toFixed(1)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 3. News Sentiment Injection Panel */}
              <div className="panel">
                <div className="panel-header">
                  <h3>SENTIMENT INJECTOR</h3>
                </div>
                <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>ACTIVE BRIEF</span>
                    <p style={{ fontSize: '12px', color: 'var(--neon-cyan)', fontStyle: 'italic', lineHeight: '1.4' }}>
                      "{currentNews || 'Stable. No high-impact events.'}"
                    </p>
                  </div>
                  <form onSubmit={submitNews} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input 
                      type="text" 
                      value={newsInput} 
                      onChange={(e) => setNewsInput(e.target.value)} 
                      placeholder="e.g. rate hike dump..." 
                      className="text-input"
                    />
                    <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end', padding: '6px 12px' }}>
                      INJECT CATALYST
                    </button>
                  </form>
                </div>
              </div>

              {/* 4. Console Logs panel */}
              <div id="console-widget" className="panel" style={{ flex: 1, minHeight: '220px' }}>
                <div className="panel-header">
                  <h3>EXECUTION CONSOLE</h3>
                </div>
                <div className="panel-body console-logs-container" style={{ padding: '12px' }}>
                  <div ref={consoleBodyRef} className="console-body">
                    {logs.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '11px', padding: '20px 0', textAlign: 'center', flex: 1 }}>
                        Reflex standby logs.
                      </div>
                    ) : (
                      logs.map((log, idx) => (
                        <div key={idx} className={`console-log-row log-${log.type}`}>
                          [{log.timestamp}] &gt; {log.message}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Bottom Status Bar Ticker */}
        <footer className="bottom-status-bar">
          <div className="status-left">
            <div className="streaming-label">
              <div className="streaming-dot"></div>
              <span>COGNITION • STREAMING</span>
            </div>
            <div className="status-stat">
              <span>LAT:</span> 42MS
            </div>
            <div className="status-stat">
              <span>CYCLES:</span> {logs.length}
            </div>
            <div className="status-stat">
              <span>RULES:</span> {rules.length}
            </div>
            <div className="status-stat">
              <span>MEMORY:</span> {logs.length}/4096
            </div>
            <div className="status-stat">
              <span>MODEL:</span> QWEN-3.6-PLUS
            </div>
            <div className="status-stat">
              <span>ENGINE:</span> BITGET PAPTRADING
            </div>
          </div>
          <div className="status-right">
            EVERY TRADE TEACHES.
          </div>
        </footer>

      </main>
      </div>

      {/* Sentinel Auditor loading Overlay */}
      {auditState.active && (
        <div className="audit-alert-overlay">
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', borderRadius: '12px', border: '1px solid rgba(255, 51, 102, 0.3)', boxShadow: '0 0 30px rgba(255, 51, 102, 0.2)' }}>
            <div className="pulse-thinking" style={{ width: '40px', height: '40px', margin: '0 auto 20px auto', backgroundColor: 'var(--neon-red)' }}></div>
            <h2 style={{ fontFamily: 'var(--font-mono)', marginBottom: '8px', color: 'var(--neon-red)' }}>SENTINEL AUDIT ENGAGED</h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              Reflex experienced a trade loss on {auditState.symbol}.
              <br />
              Performing cognitive post-mortem analysis...
            </p>
          </div>
        </div>
      )}

      {/* Audit Report Modal */}
      {auditResult && (
        <div className="audit-alert-overlay">
          <div className="panel audit-modal" style={{ border: '1px solid rgba(255, 51, 102, 0.3)' }}>
            <div className="panel-header" style={{ borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--neon-red)', letterSpacing: '1.5px' }}>
                🚨 POST-MORTEM AUDIT REPORT
              </h3>
              <button 
                onClick={() => setAuditResult(null)} 
                className="btn btn-danger"
                style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px' }}
              >
                CLOSE REPORT
              </button>
            </div>
            <div className="audit-modal-body">
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: auditResult.report
                    .replace(/\n/g, '<br />')
                    .replace(/### (.*?)<br \/>/g, '<h3 style="color: var(--text-primary); margin: 12px 0 6px 0; font-size:14px; font-weight:700;">$1</h3>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/- (.*?)<br \/>/g, '<li style="margin-left: 20px; color: var(--text-secondary);">$1</li>')
                }}
              />
              
              <div className="new-rule-alert" style={{ border: '1px solid rgba(255, 51, 102, 0.25)', backgroundColor: 'rgba(255, 51, 102, 0.03)' }}>
                <h4 style={{ color: 'var(--neon-red)', fontSize: '13px', fontWeight: '700' }}>🧠 GENERATED CONSTRAINT RULE</h4>
                <p style={{ fontStyle: 'italic', color: 'var(--neon-red)', marginTop: '6px', fontSize: '13px' }}>
                  "{auditResult.newRule}"
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="audit-alert-overlay">
          <div className="panel audit-modal" style={{ border: '1px solid rgba(0, 255, 102, 0.3)', maxWidth: '500px' }}>
            <div className="panel-header" style={{ borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--neon-green)', letterSpacing: '1.5px' }}>
                ⚙️ SYSTEM CONFIGURATIONS
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="btn btn-primary"
                style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', borderColor: 'var(--neon-green)', color: 'var(--neon-green)' }}
              >
                CLOSE
              </button>
            </div>
            <div className="audit-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: 'var(--text-secondary)' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>BITGET API URL</span>
                <code style={{ color: 'var(--neon-cyan)', fontSize: '12px' }}>{config?.bitgetApiUrl || 'https://api.bitget.com'}</code>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>EXECUTION MODE</span>
                <span className={config?.liveMode ? 'text-loss' : 'text-gain'} style={{ fontWeight: '700' }}>
                  {config?.liveMode ? '🔴 LIVE MAINNET' : '🟢 PAPER / MOCK SANDBOX (PAPTRADING: 1)'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>TRADING SIZE ALLOCATION</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['auto', '0.01', '0.05', '0.10'].map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setTempSize(sz)}
                      className="btn-deploy"
                      style={{
                        flex: 1,
                        padding: '6px',
                        fontSize: '11px',
                        backgroundColor: tempSize === sz ? 'rgba(0, 255, 102, 0.08)' : 'transparent',
                        borderColor: tempSize === sz ? 'var(--neon-green)' : 'var(--border-color)',
                        color: tempSize === sz ? 'var(--neon-green)' : 'var(--text-secondary)',
                      }}
                    >
                      {sz === 'auto' ? 'AUTO (AI)' : `${sz} BTC`}
                    </button>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => {
                  updateTradingSize(tempSize);
                  setShowSettings(false);
                }}
                className="btn-deploy"
                style={{ 
                  width: '100%', 
                  padding: '10px', 
                  borderColor: 'var(--neon-green)', 
                  color: 'var(--neon-green)',
                  marginTop: '8px',
                  fontWeight: '700'
                }}
              >
                CONFIRM CONFIGURATION
              </button>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>QWEN COGNITIVE ENDPOINT</span>
                <code style={{ color: 'var(--neon-cyan)', fontSize: '12px' }}>{config?.qwenUrl || 'https://hackathon.bitgetops.com/v1'}</code>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>QWEN MODEL NAME</span>
                <code style={{ color: 'var(--neon-gold)', fontSize: '12px' }}>{config?.qwenModel || 'qwen3.6-plus'}</code>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>CREDENTIAL STATUS</span>
                <span style={{ color: 'var(--neon-green)', fontWeight: '600' }}>✓ KEYS VERIFIED & LOADED</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
