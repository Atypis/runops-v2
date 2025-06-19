# AEF Rapid Test Harness

This test harness allows you to iterate on individual nodes and primitives without rebuilding the entire system.

## Setup

1. **Start Chrome with debugging enabled:**
```bash
# Mac
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222

# Keep this Chrome window open and log into Gmail/Airtable
```

2. **Install dependencies:**
```bash
npm install playwright @browserbasehq/stagehand dotenv
```

3. **Create `.env` file:**
```
GMAIL_EMAIL=your-email@gmail.com
GMAIL_PASSWORD=your-password
AIRTABLE_BASE_ID=your-base-id
AIRTABLE_API_KEY=your-api-key
```

## Usage

Test individual nodes:
```bash
node --watch test-node.js
```

Test full primitives:
```bash
node --watch test-primitive.js
```

Test composed workflows:
```bash
node --watch test-workflow.js
```

## Benefits

- **Instant feedback**: Changes reload automatically with `--watch`
- **No Docker**: Uses your actual browser
- **Persistent sessions**: Stay logged in between tests
- **Live debugging**: See everything happening in real-time
- **Quick iteration**: Test changes in seconds, not minutes