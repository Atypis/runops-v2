# AEF Frontend Test Dashboard

A visual interface for testing AEF nodes and workflows in real-time.

## Features

- **Visual Node Execution**: Click buttons to execute individual nodes
- **Workflow Testing**: Run predefined workflows with one click
- **Custom Node Editor**: Write and test custom nodes on the fly
- **State Viewer**: See workflow state updates in real-time
- **Execution Logs**: Color-coded logs show success/error/info
- **Connection Status**: Know if you're connected to Chrome

## Setup

1. **Start Chrome with debugging** (if not already running):
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

2. **Install dependencies**:
```bash
cd test-harness
npm install
```

3. **Start the server**:
```bash
npm start
# or for auto-reload during development:
npm run dev
```

4. **Open the dashboard**:
Navigate to http://localhost:3001 in any browser

## Dashboard Sections

### Quick Actions
- **Individual Nodes**: Pre-configured buttons for common operations
  - Navigate to Gmail
  - Click email
  - Extract emails
  - Classify with AI
  - Transform data

- **Workflows**: Complete flows you can run
  - Extract and Filter Emails
  - Gmail Login Flow

### Custom Node
Write any node JSON and execute it:
```json
{
  "type": "browser_query",
  "method": "extract",
  "instruction": "Get page title",
  "schema": {
    "title": "string"
  }
}
```

### Current State
Shows the accumulated workflow state - useful for debugging data flow between nodes.

### Execution Logs
Real-time logs with timestamps showing:
- 🟢 Success messages (green)
- 🔴 Error messages (red)
- ℹ️ Info messages (gray)

## Adding New Nodes

Edit `frontend/app.js` and add to `SAMPLE_NODES`:
```javascript
myNewNode: {
  type: 'browser_action',
  method: 'click',
  target: 'my button'
}
```

## Tips

- Keep Chrome logged into Gmail/Airtable for best results
- Use Custom Node editor to quickly test variations
- Check State Viewer to debug data transformations
- Clear logs regularly to keep output readable