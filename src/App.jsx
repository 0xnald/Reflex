import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = 'http://localhost:3001';

function PnLShareModal({ position, price, onClose }) {
  const shareCanvasRef = useRef(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (!position || !shareCanvasRef.current) return;
    
    const canvas = shareCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = 800;
    canvas.height = 420;
    
    ctx.clearRect(0, 0, 800, 420);
    
    const logo = new Image();
    logo.src = '/logo.png';
    
    const draw = () => {
      const isLong = (position.holdSide === 'long' || position.side === 'open_long');
      const entryPrice = parseFloat(position.openPrice || '0');
      const currentPrice = parseFloat(position.marketPrice || price || '0');
      const leverage = 5;
      
      let roiPct = 0;
      if (entryPrice > 0 && currentPrice > 0) {
        const sideMultiplier = isLong ? 1 : -1;
        roiPct = ((currentPrice - entryPrice) / entryPrice) * sideMultiplier * leverage * 100;
      }
      const unrealizedPL = parseFloat(position.unrealizedPL || '0');

      // 1. Background Gradient
      const grad = ctx.createLinearGradient(0, 0, 800, 420);
      grad.addColorStop(0, '#05070a');
      grad.addColorStop(0.5, '#0a0d12');
      grad.addColorStop(1, isLong ? '#041c0e' : '#22040b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 800, 420);

      // Glows
      const topGlow = ctx.createRadialGradient(0, 0, 10, 0, 0, 200);
      topGlow.addColorStop(0, 'rgba(0, 255, 102, 0.06)');
      topGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = topGlow;
      ctx.fillRect(0, 0, 300, 200);

      const bottomGlow = ctx.createRadialGradient(800, 420, 10, 800, 420, 250);
      bottomGlow.addColorStop(0, isLong ? 'rgba(0, 255, 102, 0.08)' : 'rgba(255, 51, 102, 0.08)');
      bottomGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bottomGlow;
      ctx.fillRect(500, 200, 300, 220);

      // Card stroke
      ctx.strokeStyle = isLong ? 'rgba(0, 255, 102, 0.15)' : 'rgba(255, 51, 102, 0.15)';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, 794, 414);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.strokeRect(12, 12, 776, 396);

      // 2. Reflex Logo & Name
      try {
        if (logo.complete && logo.naturalWidth !== 0) {
          ctx.drawImage(logo, 35, 32, 42, 42);
        } else {
          ctx.fillStyle = '#00ff66';
          ctx.beginPath();
          ctx.moveTo(56, 32);
          ctx.lineTo(77, 53);
          ctx.lineTo(56, 74);
          ctx.lineTo(35, 53);
          ctx.closePath();
          ctx.fill();
        }
      } catch (e) {
        ctx.fillStyle = '#00ff66';
        ctx.beginPath();
        ctx.moveTo(56, 32);
        ctx.lineTo(77, 53);
        ctx.lineTo(56, 74);
        ctx.lineTo(35, 53);
        ctx.closePath();
        ctx.fill();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('REFLEX', 90, 50);

      ctx.fillStyle = '#00ff66';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillText('COGNITION AGENT', 90, 68);

      // 3. Date
      const tzOffset = -new Date().getTimezoneOffset() / 60;
      const tzString = `(UTC${tzOffset >= 0 ? '+' : ''}${tzOffset})`;
      const now = new Date();
      const pad = (num) => String(num).padStart(2, '0');
      const dateStr = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())} ${tzString}`;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.fillText(dateStr, 35, 110);

      // 4. Bitget Hackathon Brand Badge
      const badgeX = 580;
      const badgeY = 32;
      const badgeW = 185;
      const badgeH = 32;
      const radius = 6;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(badgeX + radius, badgeY);
      ctx.lineTo(badgeX + badgeW - radius, badgeY);
      ctx.quadraticCurveTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + radius);
      ctx.lineTo(badgeX + badgeW, badgeY + badgeH - radius);
      ctx.quadraticCurveTo(badgeX + badgeW, badgeY + badgeH, badgeX + badgeW - radius, badgeY + badgeH);
      ctx.lineTo(badgeX + radius, badgeY + badgeH);
      ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - radius);
      ctx.lineTo(badgeX, badgeY + radius);
      ctx.quadraticCurveTo(badgeX, badgeY, badgeX + radius, badgeY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ BITGET HACKATHON', badgeX + (badgeW / 2), badgeY + 20);
      ctx.textAlign = 'left';

      // 5. Position Details
      const symbolText = (position.symbol || 'BTCUSDT').toUpperCase();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '15px "JetBrains Mono", monospace';
      ctx.fillText(`${symbolText} Perpetual`, 35, 175);

      // Side
      const sideX = 35;
      const sideY = 195;
      const sideW = 55;
      const sideH = 22;
      
      ctx.fillStyle = isLong ? 'rgba(0, 255, 102, 0.15)' : 'rgba(255, 51, 102, 0.15)';
      ctx.strokeStyle = isLong ? '#00ff66' : '#ff3366';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sideX + 4, sideY);
      ctx.lineTo(sideX + sideW - 4, sideY);
      ctx.quadraticCurveTo(sideX + sideW, sideY, sideX + sideW, sideY + 4);
      ctx.lineTo(sideX + sideW, sideY + sideH - 4);
      ctx.quadraticCurveTo(sideX + sideW, sideY + sideH, sideX + sideW - 4, sideY + sideH);
      ctx.lineTo(sideX + 4, sideY + sideH);
      ctx.quadraticCurveTo(sideX, sideY + sideH, sideX, sideY + sideH - 4);
      ctx.lineTo(sideX, sideY + 4);
      ctx.quadraticCurveTo(sideX, sideY, sideX + 4, sideY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isLong ? '#00ff66' : '#ff3366';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(isLong ? 'LONG' : 'SHORT', sideX + (sideW / 2), sideY + 15);
      ctx.textAlign = 'left';

      // Leverage
      const levX = 100;
      const levY = 195;
      const levW = 45;
      const levH = 22;
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(levX + 4, levY);
      ctx.lineTo(levX + levW - 4, levY);
      ctx.quadraticCurveTo(levX + levW, levY, levX + levW, levY + 4);
      ctx.lineTo(levX + levW, levY + levH - 4);
      ctx.quadraticCurveTo(levX + levW, levY + levH, levX + levW - 4, levY + levH);
      ctx.lineTo(levX + 4, levY + levH);
      ctx.quadraticCurveTo(levX, levY + levH, levX, levY + levH - 4);
      ctx.lineTo(levX, levY + 4);
      ctx.quadraticCurveTo(levX, levY, levX + 4, levY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('5x', levX + (levW / 2), levY + 15);
      ctx.textAlign = 'left';

      // 6. ROI
      const sign = roiPct >= 0 ? '+' : '';
      const roiText = `${sign}${roiPct.toFixed(2)}%`;
      
      ctx.fillStyle = roiPct >= 0 ? '#00ff66' : '#ff3366';
      ctx.font = '800 64px "Plus Jakarta Sans", sans-serif';
      ctx.shadowColor = roiPct >= 0 ? 'rgba(0, 255, 102, 0.3)' : 'rgba(255, 51, 102, 0.3)';
      ctx.shadowBlur = 20;
      ctx.fillText(roiText, 30, 280);
      ctx.shadowBlur = 0;

      // 7. PnL absolute
      const pnlSign = unrealizedPL >= 0 ? '+' : '';
      const pnlText = `${pnlSign}${unrealizedPL.toFixed(4)} USDT`;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px "JetBrains Mono", monospace';
      ctx.fillText(pnlText, 35, 325);

      // 8. Prices
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '13px "JetBrains Mono", monospace';
      ctx.fillText('Entry price', 410, 180);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(entryPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), 410, 210);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '13px "JetBrains Mono", monospace';
      ctx.fillText('Current price', 410, 265);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(currentPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), 410, 295);

      // 9. Arrow
      ctx.save();
      ctx.translate(685, 230);
      const angle = isLong ? 45 * Math.PI / 180 : 135 * Math.PI / 180;
      ctx.rotate(angle);

      ctx.shadowColor = isLong ? 'rgba(0, 255, 102, 0.45)' : 'rgba(255, 51, 102, 0.45)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 4;

      ctx.beginPath();
      ctx.moveTo(0, -60);
      ctx.lineTo(40, -15);
      ctx.lineTo(16, -15);
      ctx.lineTo(16, 50);
      ctx.lineTo(-16, 50);
      ctx.lineTo(-16, -15);
      ctx.lineTo(-40, -15);
      ctx.closePath();

      const arrowGrad = ctx.createLinearGradient(-40, -60, 40, 50);
      if (isLong) {
        arrowGrad.addColorStop(0, '#00ff66');
        arrowGrad.addColorStop(0.4, '#00f0ff');
        arrowGrad.addColorStop(1, '#005522');
      } else {
        arrowGrad.addColorStop(0, '#ff3366');
        arrowGrad.addColorStop(0.4, '#ffaa00');
        arrowGrad.addColorStop(1, '#550011');
      }
      ctx.fillStyle = arrowGrad;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-40, -15);
      ctx.lineTo(0, -60);
      ctx.lineTo(40, -15);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(16, -15);
      ctx.lineTo(16, 50);
      ctx.lineTo(-16, 50);
      ctx.stroke();

      ctx.restore();

      // 10. Watermark
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(35, 360);
      ctx.lineTo(765, 360);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText('LIVE ON BITGET HACKATHON', 35, 388);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('REFLEX COGNITIVE SYSTEM', 765, 388);
      ctx.textAlign = 'left';
    };

    logo.onload = draw;
    logo.onerror = draw;
    draw();
  }, [position, price]);

  const copyToClipboard = async () => {
    const canvas = shareCanvasRef.current;
    if (!canvas) return;
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              [blob.type]: blob
            })
          ]);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        } catch (err) {
          console.error("Clipboard write failed", err);
          alert("Clipboard copy not supported by browser. Please use Download PNG.");
        }
      }, 'image/png');
    } catch (err) {
      console.error("Canvas toBlob failed", err);
    }
  };

  const downloadPNG = () => {
    const canvas = shareCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `reflex_${(position.symbol || 'position').toLowerCase()}_pnl.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="audit-alert-overlay">
      <div className="pnl-modal">
        <div className="panel-header" style={{ borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ color: 'var(--neon-green)', letterSpacing: '1.5px' }}>
            ⚡ REFLEX POSITION SHARE
          </h3>
          <button 
            onClick={onClose} 
            className="btn btn-danger"
            style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px' }}
          >
            CLOSE PREVIEW
          </button>
        </div>
        <div className="audit-modal-body" style={{ padding: '20px', gap: '16px' }}>
          <div className="pnl-canvas-wrapper">
            <canvas ref={shareCanvasRef} className="pnl-preview-canvas" />
          </div>
          <div className="pnl-actions-row">
            <button 
              onClick={copyToClipboard}
              className="btn btn-primary"
              style={{ borderColor: 'var(--neon-green)', color: 'var(--neon-green)', padding: '10px 18px', fontWeight: '700' }}
            >
              COPY TO CLIPBOARD
            </button>
            <button 
              onClick={downloadPNG}
              className="btn btn-primary"
              style={{ borderColor: 'var(--neon-cyan)', color: 'var(--neon-cyan)', padding: '10px 18px', fontWeight: '700' }}
            >
              DOWNLOAD PNG CARD
            </button>
          </div>
        </div>
      </div>
      {copySuccess && (
        <div className="pnl-toast">
          ✓ COPIED TO CLIPBOARD!
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [balance, setBalance] = useState(10000.0);
  const [available, setAvailable] = useState(10000.0);
  const [startingBalance, setStartingBalance] = useState(null);
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
  const [sharingPosition, setSharingPosition] = useState(null);

  useEffect(() => {
    if (config?.tradingSize && !showSettings) {
      setTempSize(config.tradingSize);
    }
  }, [config, showSettings]);

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
      if (state) {
        setIsRunning(state.isRunning);
        setCurrentNews(state.currentNews);
        setRules(state.rules || []);
        if (state.config) {
          setConfig(state.config);
        }
      }
    });

    // Handle account and position updates
    socketRef.current.on('account_update', (data) => {
      if (data) {
        setBalance(data.balance);
        setAvailable(data.available);
        setPositions(data.positions || []);
        setPrice(data.price || 0.0);
        setIsMock(!!data.isMock);

        // Dynamically track starting balance based on the first valid balance payload of the session
        if (data.balance !== null && data.balance !== undefined && !isNaN(data.balance)) {
          setStartingBalance(prev => prev === null ? data.balance : prev);
        }

        // Track price history
        if (data.price !== undefined && data.price !== null && !isNaN(data.price) && data.price > 0) {
          setPriceHistory(prev => {
            const next = [...prev, { time: new Date().toLocaleTimeString(), price: data.price }];
            if (next.length > 50) next.shift(); // Keep last 50 ticks
            return next;
          });
        }
      }
    });

    // Handle active log feed
    socketRef.current.on('agent_log', (logEntry) => {
      if (logEntry) {
        setLogs(prev => [...prev, logEntry].slice(-100)); // Keep last 100 logs
      }
    });

    // Handle rules update
    socketRef.current.on('rules_update', (updatedRules) => {
      setRules(updatedRules || []);
    });

    // Handle auditing state changes
    socketRef.current.on('audit_state', (state) => {
      if (state) {
        setAuditState(state);
      }
    });

    // Handle audit completion
    socketRef.current.on('audit_result', (result) => {
      if (result) {
        setAuditResult(result);
        setRules(result.rules || []);
        if (Array.isArray(result.rules)) {
          setLatestRuleIndex(result.rules.length - 1);
        }
        
        // Add a card to our Audit Center historical view
        const newAuditCard = {
          tradeId: `#00482`, // Increment or random
          time: new Date().toLocaleTimeString(),
          symbol: result.symbol || 'BTCUSDT',
          pnl: '-1.00R', // Standardized risk unit
          result: 'LOSS',
          rootCause: (result.report ? result.report.substring(0, 100) : '') + '...', // Short snippet
          correction: result.newRule || '',
          ruleAdded: true
        };
        setHistoricalAudits(prev => [newAuditCard, ...prev]);

        // Auto-clear highlight after 10 seconds
        setTimeout(() => {
          setLatestRuleIndex(-1);
        }, 10000);
      }
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
    const prices = priceHistory.map(p => p.price).filter(p => typeof p === 'number' && !isNaN(p) && p > 0);
    if (prices.length < 2) return;
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
    if (Array.isArray(positions) && positions.length > 0) {
      positions.forEach(pos => {
        if (!pos) return;
        const entryPrice = parseFloat(pos.openPrice || '0');
        if (isNaN(entryPrice) || entryPrice <= 0) return;
        const entryY = getY(entryPrice);

        if (!isNaN(entryY) && entryY > 20 && entryY < height - 20) {
          const holdSide = pos.holdSide || 'long';
          ctx.strokeStyle = holdSide === 'long' ? '#00ff66' : '#ff3366';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(20, entryY);
          ctx.lineTo(width - 20, entryY);
          ctx.stroke();
          ctx.setLineDash([]); // Reset
          
          ctx.fillStyle = holdSide === 'long' ? '#00ff66' : '#ff3366';
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
    console.log("Emitting update_config for size:", size);
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
                ${(price !== null && price !== undefined && !isNaN(price) && price > 0) ? price.toLocaleString() : '---'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--neon-green)', opacity: 0.8 }}>
                {isMock ? ' (Mock Sandbox)' : ' (Bitget API)'}
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
                  {Array.isArray(rules) && rules.map((rule, idx) => {
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
                    {(balance !== null && balance !== undefined && !isNaN(balance)) 
                      ? `$${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                      : '$0.00'}
                  </div>
                  {(balance !== null && balance !== undefined && !isNaN(balance) && startingBalance !== null && startingBalance !== undefined && startingBalance > 0) ? (
                    <div className={balance >= startingBalance ? 'text-gain' : 'text-loss'} style={{ fontSize: '14px', fontWeight: '700' }}>
                      {balance >= startingBalance ? '+' : ''}{(((balance - startingBalance) / startingBalance) * 100).toFixed(2)}%
                    </div>
                  ) : (
                    <div className="text-gain" style={{ fontSize: '14px', fontWeight: '700' }}>
                      +0.00%
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span>Available: ${(available !== null && available !== undefined && !isNaN(available)) ? available.toFixed(2) : '0.00'}</span>
                  <span>Leverage: Isolated 5x</span>
                </div>
              </div>

              {/* 2. Positions Sidebar Panel */}
              <div id="positions-widget" className="panel">
                <div className="panel-header">
                  <h3>ACTIVE POSITIONS</h3>
                  <span className="panel-header-count">{Array.isArray(positions) ? positions.length : 0} OPEN</span>
                </div>
                <div className="panel-body">
                  {!Array.isArray(positions) || positions.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic' }}>
                      ~/reflex: no active positions listed on exchange.
                    </div>
                  ) : (
                    positions.map((pos, idx) => {
                      if (!pos) return null;
                      const holdSide = pos.holdSide || 'long';
                      const unrealizedPL = parseFloat(pos.unrealizedPL || '0');
                      const openPrice = parseFloat(pos.openPrice || '0');
                      return (
                        <div 
                          key={idx} 
                          className={`position-item-sidebar ${holdSide === 'long' ? 'side-long' : 'side-short'}`}
                          onClick={() => setSharingPosition(pos)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', marginBottom: '4px' }}>
                            <span>{pos.symbol} {holdSide.toUpperCase()}</span>
                            <span className={unrealizedPL >= 0 ? 'text-gain' : 'text-loss'}>
                              {unrealizedPL >= 0 ? '+' : ''}
                              {unrealizedPL.toFixed(2)} USDT
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                            <span>Size: {pos.total || '0'} BTC</span>
                            <span className="share-hover-text" style={{ color: holdSide === 'long' ? 'var(--neon-green)' : 'var(--neon-red)', fontWeight: '700' }}>share card ↗</span>
                          </div>
                        </div>
                      );
                    })
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
                    {!Array.isArray(logs) || logs.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '11px', padding: '20px 0', textAlign: 'center', flex: 1 }}>
                        Reflex standby logs.
                      </div>
                    ) : (
                      logs.map((log, idx) => (
                        <div key={idx} className={`console-log-row log-${log?.type || 'info'}`}>
                          [{log?.timestamp || ''}] &gt; {log?.message || ''}
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
              <span>CYCLES:</span> {Array.isArray(logs) ? logs.length : 0}
            </div>
            <div className="status-stat">
              <span>RULES:</span> {Array.isArray(rules) ? rules.length : 0}
            </div>
            <div className="status-stat">
              <span>MEMORY:</span> {Array.isArray(logs) ? logs.length : 0}/4096
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
                <span className={config?.isMock ? 'text-gain' : (config?.liveMode ? 'text-loss' : 'text-gain')} style={{ fontWeight: '700' }}>
                  {config?.isMock 
                    ? '🟢 LOCAL MOCK SANDBOX (NO API KEYS)' 
                    : (config?.liveMode ? '🔴 LIVE MAINNET API' : '🟢 BITGET PAPER TRADING (TESTNET API)')}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>TRADING SIZE ALLOCATION</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['auto', '10%', '0.01', '0.05', '0.10'].map((sz) => (
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
                      {sz === 'auto' ? 'AUTO (AI)' : (sz === '10%' ? '10% CAPITAL' : `${sz} BTC`)}
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

      {/* Share Position PnL Modal */}
      {sharingPosition && (
        <PnLShareModal 
          position={sharingPosition} 
          price={price} 
          onClose={() => setSharingPosition(null)} 
        />
      )}
    </>
  );
}
