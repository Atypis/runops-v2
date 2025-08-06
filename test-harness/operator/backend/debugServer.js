import express from 'express';
import Browserbase from '@browserbasehq/sdk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3010;

// Enable JSON parsing for POST requests
app.use(express.json());

// Store active sessions for live view access
const activeSessions = new Map();

// Endpoint to register a session for live viewing
app.post('/register-session/:workflowId', async (req, res) => {
  const { workflowId } = req.params;
  const { sessionId } = req.body;
  
  console.log(`[DebugServer] Registering session ${sessionId} for workflow ${workflowId}`);
  activeSessions.set(workflowId, sessionId);
  res.json({ success: true, message: `Session registered for workflow ${workflowId}` });
});

// Live view page for watching workflow execution
app.get('/debug/:workflowId', async (req, res) => {
  const { workflowId } = req.params;
  const sessionId = activeSessions.get(workflowId);
  
  if (process.env.BROWSER_MODE === 'cloud' && sessionId) {
    try {
      console.log(`[DebugServer] Getting live view for session ${sessionId}`);
      
      const bb = new Browserbase({ 
        apiKey: process.env.BROWSERBASE_API_KEY 
      });
      
      const liveViewLinks = await bb.sessions.debug(sessionId);
      const debugUrl = liveViewLinks.debuggerFullscreenUrl;
      
      console.log(`[DebugServer] Live view URL generated: ${debugUrl}`);
      
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Director Live View - ${workflowId}</title>
            <style>
              body { margin: 0; font-family: Arial, sans-serif; background: #f5f5f5; }
              .header { background: #2563eb; color: white; padding: 12px; text-align: center; }
              .container { display: flex; height: calc(100vh - 60px); }
              .sidebar { width: 300px; background: white; padding: 20px; border-right: 1px solid #ddd; }
              .main { flex: 1; }
              iframe { width: 100%; height: 100%; border: none; }
              .status { padding: 10px; background: #dcfce7; border-radius: 6px; margin-bottom: 15px; }
              .info { margin-bottom: 15px; }
              .refresh-btn { background: #2563eb; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; }
              .info p { margin: 5px 0; font-size: 14px; }
              .info strong { color: #374151; }
              .controls { margin-top: 20px; font-size: 14px; color: #666; }
              .controls h4 { margin-bottom: 10px; color: #374151; }
              .controls p { margin: 8px 0; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>🎯 Director Live View - Workflow: ${workflowId}</h2>
            </div>
            <div class="container">
              <div class="sidebar">
                <div class="status">
                  <strong>✅ Live Session Active</strong>
                </div>
                <div class="info">
                  <h4>Session Details</h4>
                  <p><strong>Workflow ID:</strong> ${workflowId}</p>
                  <p><strong>Session ID:</strong> ${sessionId}</p>
                  <p><strong>Mode:</strong> BrowserBase Cloud</p>
                  <p><strong>Debug Server:</strong> localhost:${PORT}</p>
                </div>
                <button class="refresh-btn" onclick="location.reload()">
                  🔄 Refresh View
                </button>
                <div class="controls">
                  <h4>Live Controls</h4>
                  <p>• Click and interact directly in the browser</p>
                  <p>• Scroll to follow automation actions</p>
                  <p>• Take manual control when needed</p>
                  <p>• View real-time workflow execution</p>
                </div>
                <div class="controls" style="border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 15px;">
                  <h4>Debugging Tips</h4>
                  <p>• Watch console for automation logs</p>
                  <p>• Pause execution to inspect elements</p>
                  <p>• Use browser dev tools if needed</p>
                </div>
              </div>
              <div class="main">
                <iframe src="${debugUrl}&navbar=false" 
                        sandbox="allow-same-origin allow-scripts allow-forms allow-pointer-lock allow-popups" 
                        allow="clipboard-read; clipboard-write; camera; microphone">
                </iframe>
              </div>
            </div>
            
            <script>
              // Auto-refresh session info every 30 seconds
              setInterval(() => {
                console.log('Live view active for workflow: ${workflowId}');
              }, 30000);
              
              // Log iframe load events
              const iframe = document.querySelector('iframe');
              iframe.onload = function() {
                console.log('BrowserBase live view loaded successfully');
              };
              iframe.onerror = function() {
                console.error('BrowserBase live view failed to load');
              };
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error(`[DebugServer] Live view error:`, error.message);
      res.send(`
        <div style="padding: 40px; text-align: center; font-family: Arial;">
          <h3 style="color: red;">❌ Live View Error</h3>
          <p>Failed to get live view for session: <strong>${sessionId}</strong></p>
          <p>Error: <code>${error.message}</code></p>
          <p>Check console for details.</p>
          <button onclick="location.reload()" style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 10px;">
            🔄 Try Again
          </button>
        </div>
      `);
    }
  } else if (process.env.BROWSER_MODE !== 'cloud') {
    res.send(`
      <div style="padding: 40px; text-align: center; font-family: Arial;">
        <h3>🔧 Local Mode Active</h3>
        <p>Live view is only available in cloud mode.</p>
        <p>Set <code>BROWSER_MODE=cloud</code> and add BrowserBase credentials to enable live browser streaming.</p>
        <div style="margin: 20px 0; padding: 15px; background: #f3f4f6; border-radius: 8px; text-align: left;">
          <h4>Required Environment Variables:</h4>
          <code>BROWSER_MODE=cloud</code><br>
          <code>BROWSERBASE_API_KEY=your_api_key</code><br>
          <code>BROWSERBASE_PROJECT_ID=your_project_id</code>
        </div>
        <button onclick="location.reload()" style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">
          🔄 Refresh
        </button>
      </div>
    `);
  } else {
    res.send(`
      <div style="padding: 40px; text-align: center; font-family: Arial;">
        <h3>⏳ No Active Session</h3>
        <p>No browser session found for workflow: <strong>${workflowId}</strong></p>
        <p>Start a workflow execution to begin live viewing.</p>
        <div style="margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px;">
          <h4>How to start a session:</h4>
          <p>1. Execute a workflow node that uses the browser</p>
          <p>2. The session will automatically register here</p>
          <p>3. Refresh this page to see the live view</p>
        </div>
        <button onclick="location.reload()" style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">
          🔄 Check Again
        </button>
      </div>
    `);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    port: PORT,
    activeSessions: Array.from(activeSessions.keys()),
    mode: process.env.BROWSER_MODE || 'local',
    browserbaseConfigured: !!(process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID)
  });
});

// Root endpoint with links to active sessions
app.get('/', (req, res) => {
  const sessions = Array.from(activeSessions.keys());
  
  res.send(`
    <div style="padding: 40px; font-family: Arial;">
      <h2>🎯 Director Live View Debug Server</h2>
      <p>Status: <strong style="color: green;">Running on port ${PORT}</strong></p>
      <p>Browser Mode: <strong>${process.env.BROWSER_MODE || 'local'}</strong></p>
      
      ${sessions.length > 0 ? `
        <h3>Active Sessions:</h3>
        <ul>
          ${sessions.map(workflowId => `
            <li>
              <a href="/debug/${workflowId}" style="color: #2563eb; text-decoration: none;">
                📺 ${workflowId}
              </a>
            </li>
          `).join('')}
        </ul>
      ` : `
        <h3>No Active Sessions</h3>
        <p>Execute a workflow to see live browser sessions here.</p>
      `}
      
      <div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 8px;">
        <h4>Quick Links:</h4>
        <p><a href="/health" style="color: #2563eb;">Health Check</a></p>
        <p><strong>Debug URL Format:</strong> <code>/debug/{workflowId}</code></p>
      </div>
    </div>
  `);
});

app.listen(PORT, () => {
  console.log(`🎯 Director Live View Server running on http://localhost:${PORT}`);
  console.log(`📺 Debug URL format: http://localhost:${PORT}/debug/{workflowId}`);
  console.log(`🔧 Browser Mode: ${process.env.BROWSER_MODE || 'local'}`);
  console.log(`🌐 BrowserBase Configured: ${!!(process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID)}`);
});