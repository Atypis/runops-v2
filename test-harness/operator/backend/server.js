import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import directorRoutes from './routes/director.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

// Gmail credentials should be set in .env file
// GMAIL_EMAIL=your_email@gmail.com
// GMAIL_PASSWORD=your_password

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Serve mock-operator files FIRST (before frontend)
app.use('/mock-director', express.static(join(__dirname, '../mock-director')));

// Serve static files from frontend directory
app.use(express.static(join(__dirname, '../frontend')));

// API routes
app.use('/api/director', directorRoutes);

// Reasoning broadcast API route
app.post('/api/reasoning/broadcast', (req, res) => {
  try {
    const { executionId, data } = req.body;
    
    if (!executionId || !data) {
      return res.status(400).json({ error: 'Missing executionId or data' });
    }
    
    // Broadcast to WebSocket clients
    broadcastToClients(executionId, {
      type: 'reasoning_update',
      timestamp: Date.now(),
      data
    });
    
    console.log(`[API] Broadcast reasoning update for ${executionId}: ${data.type}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error broadcasting reasoning update:', error);
    res.status(500).json({ error: 'Failed to broadcast reasoning update' });
  }
});

// Error handling middleware
app.use(errorHandler);

// Catch-all route to serve the frontend
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../frontend/index.html'));
});

// Create HTTP server and WebSocket server
const server = createServer(app);
const wss = new WebSocketServer({ server });

// WebSocket connection management
const clients = new Map(); // executionId -> Set of WebSocket connections

wss.on('connection', (ws, req) => {
  console.log('[WebSocket] New connection');
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'reasoning_subscribe' && message.executionId) {
        // Subscribe to reasoning updates for specific execution
        if (!clients.has(message.executionId)) {
          clients.set(message.executionId, new Set());
        }
        clients.get(message.executionId).add(ws);
        
        ws.send(JSON.stringify({
          type: 'reasoning_subscribed',
          executionId: message.executionId,
          timestamp: Date.now()
        }));
        
        console.log(`[WebSocket] Client subscribed to reasoning for ${message.executionId}`);
      }
    } catch (error) {
      console.error('[WebSocket] Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    // Remove client from all subscriptions
    for (const [executionId, clientSet] of clients.entries()) {
      clientSet.delete(ws);
      if (clientSet.size === 0) {
        clients.delete(executionId);
      }
    }
    console.log('[WebSocket] Client disconnected');
  });
});

// Broadcast function
function broadcastToClients(executionId, message) {
  const clientSet = clients.get(executionId);
  if (!clientSet) return;
  
  const messageStr = JSON.stringify(message);
  for (const client of clientSet) {
    if (client.readyState === client.OPEN) {
      client.send(messageStr);
    }
  }
}

server.listen(PORT, () => {
  console.log(`Operator server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready for reasoning streams`);
});

// Graceful hot-reload for development
if (process.env.NODE_ENV === 'development') {
  process.once('SIGUSR2', () => {
    console.log('[HOT-RELOAD] Graceful restart requested');
    server.close(() => {
      console.log('[HOT-RELOAD] HTTP server closed, exiting process');
      process.kill(process.pid, 'SIGUSR2'); // hand control back to nodemon
    });
  });
}