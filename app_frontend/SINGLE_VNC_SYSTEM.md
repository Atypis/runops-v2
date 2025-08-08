# 🎯 Single VNC Session Management System

## Overview

The **SingleVNCSessionManager** is a bulletproof, simplified solution for managing VNC remote desktop sessions. It eliminates the complexity of multiple containers, dynamic port allocation, and session discovery by using a **single-container, fixed-port architecture**.

## 🔑 Key Benefits

### ✅ **Absolute Clarity**
- **One container only**: `aef-vnc-single`
- **Fixed ports always**: 13000 (API), 15900 (VNC), 16080 (noVNC)
- **Same URL every time**: `http://localhost:16080/vnc.html`
- **No confusion**: Always know exactly where your session is

### ✅ **Bulletproof Lifecycle**
- **Force cleanup**: Always destroys existing sessions before creating new ones
- **Atomic creation**: Session creation is all-or-nothing
- **Verification**: Ensures session is healthy before returning
- **No orphans**: Thorough cleanup prevents resource leaks

### ✅ **Simplified Architecture**
- **Single source of truth**: One manager, one session, one state
- **No dynamic allocation**: No more port conflicts or discovery issues
- **Fail-fast**: Clear error messages when things go wrong
- **Predictable**: Same behavior every time

## 📁 System Components

```
app_frontend/
├── lib/vnc/
│   ├── SingleVNCSessionManager.ts    # Core session manager
│   └── SimpleVNCWebSocket.ts         # WebSocket server
├── app/api/vnc/
│   ├── status/route.ts               # GET session status
│   ├── start/route.ts                # POST create session
│   ├── stop/route.ts                 # DELETE destroy session
│   └── action/route.ts               # POST execute actions
└── scripts/
    └── build-browser-image.sh        # Docker image builder
```

## 🚀 Quick Start

### 1. Build the Browser Image
```bash
cd app_frontend
npm run build-browser-image
```

### 2. Start the Frontend
```bash
npm run dev
```

### 3. Use the VNC System

#### Via API:
```bash
# Check status
npm run vnc:status

# Start session (kills existing first)
npm run vnc:start

# Stop session
npm run vnc:stop

# Emergency cleanup
npm run vnc:clean
```

#### Via Frontend:
1. Open the AEF Control Center
2. Click "Start VNC Environment"  
3. Access remote desktop at `http://localhost:16080/vnc.html`

## 🔧 API Reference

### GET `/api/vnc/status`
Get current session status
```json
{
  "status": "ready",
  "vncUrl": "http://localhost:16080/vnc.html",
  "ready": true,
  "session": {
    "id": "single-vnc-1703123456789",
    "createdAt": "2023-12-21T10:30:56.789Z",
    "ports": {
      "api": 13000,
      "vnc": 15900,
      "noVNC": 16080
    }
  }
}
```

### POST `/api/vnc/start`
Create new session (destroys existing)
```json
{
  "success": true,
  "status": "ready",
  "vncUrl": "http://localhost:16080/vnc.html",
  "session": {
    "id": "single-vnc-1703123456789",
    "createdAt": "2023-12-21T10:30:56.789Z",
    "ports": {
      "api": 13000,
      "vnc": 15900,
      "noVNC": 16080
    }
  },
  "executionId": "single-vnc-session"
}
```

### DELETE `/api/vnc/stop`
Destroy current session
```json
{
  "success": true,
  "message": "VNC session single-vnc-1703123456789 stopped successfully",
  "status": "stopped"
}
```

### POST `/api/vnc/action`
Execute action in session
```json
{
  "type": "execute_workflow",
  "workflow": {...},
  "executionMethod": "real"
}
```

## 🏗️ Architecture Details

### SingleVNCSessionManager Class

#### Core Properties:
- `FIXED_API_PORT = 13000` - Always the same
- `FIXED_VNC_PORT = 15900` - Always the same  
- `FIXED_NOVNC_PORT = 16080` - Always the same
- `CONTAINER_NAME = 'aef-vnc-single'` - Always the same
- `IMAGE_NAME = 'aef-browser:latest'` - Consistent image

#### Lifecycle Methods:
1. **`createSession()`** - Atomic session creation
   - Force cleanup existing
   - Verify clean state
   - Create container atomically
   - Verify session ready
   
2. **`destroySession()`** - Complete cleanup
   - Kill container with force
   - Kill processes on ports
   - Clear internal state

3. **`isSessionReady()`** - Health check
   - Container running check
   - API endpoint health check

### Session Creation Flow:
```
1. Force cleanup any existing session
2. Verify ports are free
3. Build Docker container with fixed config
4. Wait for container to be healthy
5. Verify API endpoint responds
6. Return session details
```

### Error Handling:
- **No image**: Clear error with build instructions
- **Port conflicts**: Force cleanup and retry
- **Container fails**: Detailed error logging
- **Timeout**: 60-second max wait with clear failure

## 🔍 Debugging

### Check Container Status:
```bash
docker ps -a --filter name=aef-vnc-single
```

### Check Port Usage:
```bash
lsof -i :13000
lsof -i :15900
lsof -i :16080
```

### View Container Logs:
```bash
docker logs aef-vnc-single
```

### Manual Cleanup:
```bash
docker rm -f aef-vnc-single
lsof -ti:13000 | xargs kill -9 2>/dev/null || true
lsof -ti:15900 | xargs kill -9 2>/dev/null || true
lsof -ti:16080 | xargs kill -9 2>/dev/null || true
```

## 🎯 Why This Works

### Problem with Old System:
- ❌ Multiple containers with dynamic ports
- ❌ Complex session discovery and registry
- ❌ Race conditions and port conflicts  
- ❌ Orphaned containers and leaked resources
- ❌ Confusing state management across multiple systems

### Solution with New System:
- ✅ **Single container**: `aef-vnc-single`
- ✅ **Fixed ports**: 13000, 15900, 16080
- ✅ **Atomic operations**: All-or-nothing lifecycle
- ✅ **Force cleanup**: No orphans ever
- ✅ **Single source of truth**: One manager, one state

## 🚨 Migration Notes

### Old System → New System:
1. **Multiple containers** → Single `aef-vnc-single` container
2. **Dynamic ports** → Fixed ports 13000/15900/16080
3. **Session discovery** → Direct status API
4. **Complex cleanup** → Force cleanup with verification
5. **Multiple managers** → SingleVNCSessionManager only

### Breaking Changes:
- VNC URL is always `http://localhost:16080/vnc.html`
- API URL is always `http://localhost:13000`
- Only one session can exist at a time
- Previous session databases/registries are ignored

## 🎉 Result

**You now have absolute clarity and control over your remote desktop environment:**

- 🎯 **Always know where your session is**
- 🔒 **Never worry about port conflicts**  
- 🚀 **Fast, reliable session creation**
- 🧹 **Clean, predictable cleanup**
- 🛡️ **Bulletproof error handling**

**One container. Fixed ports. Always works.** 