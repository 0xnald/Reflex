import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import * as agentLoop from './agentLoop.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: '*', // Allow all origins for the hackathon demo dashboard ease of access
  methods: ['GET', 'POST', 'DELETE']
}));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE']
  }
});

// REST Endpoints
app.get('/api/status', (req, res) => {
  res.json(agentLoop.getStatus());
});

app.post('/api/toggle', (req, res) => {
  const { running } = req.body;
  if (running) {
    agentLoop.startLoop(io, 45000); // 45s ticks to accommodate LLM completion latency
  } else {
    agentLoop.stopLoop();
  }
  res.json(agentLoop.getStatus());
});

app.post('/api/config', (req, res) => {
  const { tradingSize } = req.body;
  if (tradingSize) {
    agentLoop.setTradingSize(tradingSize);
  }
  res.json(agentLoop.getStatus());
});

app.post('/api/news', (req, res) => {
  const { news } = req.body;
  if (!news) {
    return res.status(400).json({ error: 'News content required' });
  }
  agentLoop.injectNews(news);
  res.json(agentLoop.getStatus());
});

app.post('/api/rule', (req, res) => {
  const { rule } = req.body;
  if (!rule) {
    return res.status(400).json({ error: 'Rule content required' });
  }
  agentLoop.addRule(rule);
  res.json(agentLoop.getStatus());
});

app.delete('/api/rule/:index', (req, res) => {
  const index = parseInt(req.params.index);
  agentLoop.deleteRule(index);
  res.json(agentLoop.getStatus());
});

app.post('/api/close-position', async (req, res) => {
  const { symbol, holdSide } = req.body;
  if (!symbol || !holdSide) {
    return res.status(400).json({ error: 'Symbol and holdSide required' });
  }
  try {
    const success = await agentLoop.manualClosePosition(symbol, holdSide);
    if (success) {
      res.json({ success: true, message: `Position for ${symbol} successfully closed.` });
    } else {
      res.status(404).json({ error: 'Matching position not found in active tracking state.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Root check
app.get('/', (req, res) => {
  res.send('Reflex Agent Server is running.');
});

// WebSocket Connection Handler
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  // Send initial data immediately
  socket.emit('initial_state', agentLoop.getStatus());

  socket.on('update_config', (data) => {
    if (data.tradingSize) {
      agentLoop.setTradingSize(data.tradingSize);
      io.emit('initial_state', agentLoop.getStatus()); // Broadcast updated config to all clients
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Boot Server
httpServer.listen(PORT, () => {
  console.log(`🚀 Reflex Agent Server listening on http://localhost:${PORT}`);
  
  // Start the agent loop automatically if configured to run on startup
  if (process.env.AUTO_START_AGENT === 'true') {
    agentLoop.startLoop(io, 45000);
  }
});
