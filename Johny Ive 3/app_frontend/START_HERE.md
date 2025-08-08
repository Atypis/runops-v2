# 🚀 BRAINDEAD SIMPLE VNC STARTUP

## How to Start Everything (One Command!)

1. **Navigate to app_frontend directory**:
   ```bash
   cd app_frontend
   ```

2. **Run the magic command**:
   ```bash
   npm run dev:full
   ```

That's it! This command does **EVERYTHING**:
- ✅ Starts Docker Desktop (if not running)
- ✅ Builds the browser image (if needed)
- ✅ Cleans up old containers
- ✅ Installs dependencies
- ✅ Starts the Next.js server

## What You Get

After running `npm run dev:full`, you'll have:

- **Frontend**: http://localhost:3000
- **VNC Desktop**: http://localhost:16080/vnc.html (after starting a session)

## How to Use

1. Open http://localhost:3000
2. Go to **AEF Control Center**
3. Click **"Start VNC Environment"**
4. Access remote desktop at http://localhost:16080/vnc.html

## Quick Commands

```bash
# Start everything
npm run dev:full

# Check VNC status
npm run vnc:status

# Start VNC session
npm run vnc:start

# Stop VNC session  
npm run vnc:stop

# Emergency cleanup
npm run vnc:clean
```

## Troubleshooting

If something goes wrong:

1. **Stop everything**: `Ctrl+C`
2. **Clean up**: `npm run vnc:clean`
3. **Try again**: `npm run dev:full`

## That's It!

**One command starts everything. No complexity. Just works.** 