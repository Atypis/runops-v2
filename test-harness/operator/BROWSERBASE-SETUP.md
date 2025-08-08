# 🌐 BrowserBase Integration Setup

## Quick Start Guide

### 1. Get BrowserBase Credentials

1. Sign up at [browserbase.com](https://browserbase.com)
2. Get your **API Key** from Settings
3. Get your **Project ID** from your project dashboard

### 2. Configure Environment

Add to your `.env` file:
```bash
# BrowserBase Configuration
BROWSERBASE_API_KEY=your_browserbase_api_key_here  
BROWSERBASE_PROJECT_ID=your_browserbase_project_id_here

# Enable cloud browser mode
BROWSER_MODE=cloud
```

### 3. Test Integration

```bash
# Test BrowserBase connection
npm run test:browserbase

# Start debug server (in separate terminal)
npm run debug

# Start main server
npm run dev
```

### 4. View Live Browser Streaming

When a workflow runs, visit: `http://localhost:3010/debug/{workflowId}`

## Architecture

```
Director Workflow
  ↓
NodeExecutor (modified)
  ↓
Stagehand (BROWSERBASE mode)
  ↓
BrowserBase Cloud Browser
  ↓
Live View Stream → Debug Server :3010
```

## Integration Points

### Modified Files:
- ✅ `backend/services/nodeExecutor.js` - BrowserBase configuration
- ✅ `backend/debugServer.js` - Live view server (NEW)
- ✅ `.env.example` - Environment variables
- ✅ `package.json` - New scripts

### Environment Variables:
- `BROWSER_MODE=cloud` - Enables BrowserBase
- `BROWSERBASE_API_KEY` - Your API key
- `BROWSERBASE_PROJECT_ID` - Your project ID

## Usage

### Local Development (Default)
```bash
BROWSER_MODE=local  # or not set
npm run dev
```
Uses local Chrome browser as before.

### Cloud Production
```bash
BROWSER_MODE=cloud
npm run dev
```
Uses BrowserBase cloud browsers with live streaming.

## Live View Features

- 📺 **Real-time browser streaming**
- 🎮 **Interactive control** (click, type, scroll)
- 📊 **Session information sidebar**
- 🔄 **Auto-refresh capabilities**
- 🐛 **Perfect for debugging workflows**

## Costs

- **Free Tier**: 1 browser hour/month
- **Developer Plan**: $20/month, 100 browser hours
- **Overage**: $0.12/hour (Developer) or $0.10/hour (Startup)

## Testing

### Test Script Output:
```
🧪 BrowserBase Integration Test Starting...

1️⃣  Testing Environment Configuration...
   BROWSER_MODE: cloud
   BROWSERBASE_API_KEY: configured ✅
   BROWSERBASE_PROJECT_ID: configured ✅

2️⃣  Testing BrowserBase SDK Connection...
   BrowserBase SDK initialized ✅

3️⃣  Testing Session Creation...
   Session created: sess_abc123 ✅
   Connect URL: available ✅

4️⃣  Testing Live View URL Generation...
   Live View URL: generated ✅

5️⃣  Testing Debug Server Communication...
   Session registration: success ✅
   Debug server health: ok ✅

✅ BrowserBase integration test completed successfully!
```

## Troubleshooting

### Common Issues:

**❌ "BrowserBase credentials missing"**
- Solution: Add `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` to `.env`

**❌ "Debug server not accessible"**
- Solution: Start debug server: `npm run debug`

**❌ "Session creation failed"**
- Check API key validity
- Check project ID
- Verify BrowserBase account status

**❌ "Live view URL failed"**
- Session may have expired
- Try restarting workflow

### Debug Commands:
```bash
# Check environment
node -e "console.log(process.env.BROWSER_MODE)"

# Test BrowserBase directly
npm run test:browserbase

# Check debug server
curl http://localhost:3010/health
```

## Next Steps

1. ✅ **Basic Integration** - Complete
2. 🔄 **Profile Migration** - Adapt existing profiles to cloud sessions  
3. 📊 **Usage Monitoring** - Track costs and performance
4. 🔄 **Scheduling Service** - Add automated workflow triggers

## Support

- [BrowserBase Docs](https://docs.browserbase.com)
- [Stagehand Integration](https://docs.stagehand.dev/examples/customize_browser)
- Implementation Guide: `Working Docs/Director 2.0/toolDefinitions/browserbase.md`