# 🖥️ Ticket 006-01: VNC Dynamic Resolution & Mouse Interaction Fix

## 📋 Summary
Comprehensive solution for responsive VNC browser integration with accurate mouse interaction. This ticket documents the complete journey from identifying the root cause of mouse coordinate issues to implementing a production-ready TigerVNC solution with dynamic resolution support.

**Status**: 🚧 **IN PROGRESS** - TigerVNC implementation completed, testing & integration pending

**Parent Ticket**: [006-Browser-Integration.md](./006-Browser-Integration.md)

## 🎯 Problem Statement

### 🐛 **Original Issues Identified**
1. **Green "VNC Remote Desktop" banner** blocking screen view in frontend
2. **Chrome browser appearing cut off** at bottom in both frontend and direct noVNC 
3. **Broken mouse interaction** when VNC content was scaled to fit browser windows
4. **No window drag/resize capability** in frontend VNC viewer (worked in test files)

### 🔍 **Root Cause Analysis**

**Deep Investigation Revealed:**
- Browser windows were **tiny (200x200px)** instead of expected 1280x720px
- **x11vnc doesn't support VNC ExtendedDesktopSize extension** for dynamic resolution
- **CSS scaling + mouse coordinate translation** approach was complex and error-prone
- **Stagehand/Playwright overrides custom browser window size flags**

**Core Conflict Identified:**
```
✅ Responsive scaling BUT ❌ Broken mouse interaction (CSS transforms)
OR
✅ Perfect mouse interaction BUT ❌ Fixed resolution (no responsive scaling)
```

## 🔬 Research & Solution Discovery

### 📚 **Comprehensive Research Conducted**
Leveraged an AI research assistant to explore VNC alternatives, browser-based rendering, dynamic resolution architectures, and scaling-preserving protocols.

**Key Research Findings:**
1. **VNC Protocol-Level Solutions**: TigerVNC supports ExtendedDesktopSize for true dynamic resolution
2. **Alternative Protocols**: WebRTC streaming, Apache Guacamole (RDP), SPICE for VMs
3. **Frontend Techniques**: Mouse coordinate translation (complex maintenance)
4. **Backend Display Management**: Oversized framebuffers, dynamic Xvfb restart

**Recommended Solution**: **TigerVNC + noVNC Remote Resize Mode**

### 🎯 **Why TigerVNC is the Optimal Solution**
- ✅ **Native dynamic resolution** via VNC ExtendedDesktopSize extension
- ✅ **Perfect mouse interaction** (no coordinate translation needed)
- ✅ **Minimal frontend changes** (noVNC already supports remote resize)
- ✅ **Battle-tested** (used in Proxmox, ThinLinc, KasmVNC)
- ✅ **Cross-browser compatible** (works in all modern browsers)

## 🏗️ Implementation Completed

### 🐳 **TigerVNC Docker Container**

**New Container Architecture:**
```
app_frontend/docker/browser/
├── Dockerfile                 # ✅ NEW: TigerVNC-based container
├── supervisord.conf          # ✅ NEW: Service management config
├── vnc-startup.sh           # ✅ NEW: VNC session startup script
├── fluxbox-init             # ✅ NEW: Window manager config
├── fluxbox-apps             # ✅ NEW: Application window rules
├── websockify-wrapper.sh    # ✅ NEW: noVNC WebSocket proxy
└── browser-server.js        # ✅ UPDATED: Compatible with DISPLAY=:1
```

**Key Changes from x11vnc → TigerVNC:**
```dockerfile
# OLD: x11vnc approach
RUN apt-get install -y xvfb x11vnc novnc

# NEW: TigerVNC approach  
RUN apt-get install -y tigervnc-standalone-server tigervnc-tools novnc
```

### 🔧 **Technical Implementation Details**

#### **TigerVNC Configuration**
```bash
# Supervisor service configuration
[program:tigervnc]
command=Xvnc :1 -geometry 1280x720 -depth 24 -dpi 96 
  -localhost no -SecurityTypes None -rfbport 5900 
  -AlwaysShared=1 -AcceptKeyEvents=1 -AcceptPointerEvents=1
  -AcceptCutText=1 -SendCutText=1 -desktop 'AEF Browser'
```

#### **noVNC Remote Resize Integration**
```javascript
// Frontend: ResponsiveVNCFrame.tsx updated with native remote resize
const optimizedVncUrl = useMemo(() => {
  const url = new URL(vncUrl);
  url.searchParams.set('autoconnect', 'true');
  url.searchParams.set('resize', 'remote'); // 🎯 Magic setting!
  url.searchParams.set('quality', '6');
  url.searchParams.set('compression', '2');
  return url.toString();
}, [vncUrl, resizeMode]);
```

#### **System Dependencies Added**
```dockerfile
# Playwright browser dependencies (missing from original container)
RUN apt-get install -y \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libxkbcommon0 libatspi2.0-0 libxdamage1 libasound2 \
    libxcomposite1 libxrandr2 libgbm1 libxss1 libgtk-3-0
```

### 🖼️ **Frontend Integration**

#### **Updated ResponsiveVNCFrame.tsx**
```typescript
type ResizeMode = 'remote' | 'scale' | 'off';

// Three modes available:
// - 'remote': Uses TigerVNC ExtendedDesktopSize (RECOMMENDED)
// - 'scale': Client-side scaling (fallback)  
// - 'off': Native resolution, no scaling

const ResizeMode = {
  REMOTE: 'remote',   // 🎯 Dynamic server resolution (TigerVNC)
  SCALE: 'scale',     // 📏 Client scaling (fallback)
  NATIVE: 'off'       // 1:1 Native size
};
```

**Key Features:**
- ✅ **No CSS transforms or coordinate translation** in remote mode
- ✅ **Responsive scaling controls** with visual mode indicators  
- ✅ **Quick resolution presets** (Mobile, Tablet, Desktop)
- ✅ **Real-time status feedback** with connection indicators
- ✅ **Fullscreen support** with automatic resolution adaptation

### 🧪 **Testing Infrastructure**

#### **Created Test Files**
```html
test-tigervnc-dynamic.html     # ✅ NEW: TigerVNC dynamic resolution test
test-vnc-minimal.html          # ✅ EXISTING: Baseline x11vnc test  
test-resolution-api.js         # ✅ NEW: Dynamic resolution API server
```

**Test Capabilities:**
- **Real-time resolution changes** via JavaScript API
- **Window resize detection** with automatic VNC adaptation
- **Mouse interaction validation** (drag, resize, click accuracy)
- **Performance comparison** between x11vnc and TigerVNC

## 🧩 Architecture Comparison

### **OLD: x11vnc + CSS Scaling (Problematic)**
```
Browser Window → CSS Transform → Scaled VNC Canvas → Mouse Coordinate Translation → x11vnc → Fixed Resolution Desktop
```
**Issues**: Complex coordinate math, maintenance overhead, visual cursor misalignment

### **NEW: TigerVNC + Remote Resize (Optimal)**
```
Browser Window → noVNC Remote Resize Request → TigerVNC ExtendedDesktopSize → Dynamic Resolution Desktop
```
**Benefits**: Native 1:1 mouse mapping, automatic resolution adaptation, no client-side complexity

## 📊 Current Status

### ✅ **Completed Components**
- [x] **TigerVNC Docker container** with all dependencies
- [x] **Supervisor service configuration** for process management
- [x] **Window manager setup** (fluxbox) with proper permissions
- [x] **Browser automation server** compatible with DISPLAY=:1
- [x] **Frontend ResponsiveVNCFrame** with remote resize support
- [x] **Test infrastructure** for validation and comparison
- [x] **noVNC WebSocket proxy** (websockify) configuration

### 🚧 **In Progress**
- [ ] **Complete Docker build** ⚠️ **INTERRUPTED** - Critical command didn't finish
- [ ] **Browser automation testing** with TigerVNC environment
- [ ] **Frontend integration testing** with dynamic resolution
- [ ] **Performance validation** vs. old x11vnc approach

### ⚠️ **Critical Command Interrupted**
```bash
# This command was building the TigerVNC container + starting test instance
docker build -t aef-browser-tigervnc . && docker run -d -p 16085:6080 -p 5901:5900 -e ANTHROPIC_API_KEY=test-key --name aef-browser-tigervnc-test aef-browser-tigervnc
```

**What this command does:**
1. **`docker build -t aef-browser-tigervnc .`**
   - Builds the new TigerVNC-based container image
   - Installs all Playwright dependencies we added
   - Sets up TigerVNC, fluxbox, websockify, browser-server
   - Creates the production-ready container

2. **`docker run -d -p 16085:6080 -p 5901:5900 -e ANTHROPIC_API_KEY=test-key --name aef-browser-tigervnc-test aef-browser-tigervnc`**
   - Starts a test instance of the TigerVNC container
   - **Port 16085**: noVNC web client (http://localhost:16085)
   - **Port 5901**: Direct VNC connection
   - **Environment**: ANTHROPIC_API_KEY for browser automation
   - **Container name**: aef-browser-tigervnc-test (for easy testing)

**Why it's critical:**
- This validates our entire TigerVNC implementation works
- Creates the test container needed for `test-tigervnc-dynamic.html`
- Proves the browser automation + dynamic resolution integration
- **Without this, we can't test if our solution actually solves the mouse coordinate issues**

### 📋 **Next Steps**

#### **Immediate (Next Session)**
1. **🚨 PRIORITY 1: Complete Interrupted Docker Build**
   ```bash
   cd app_frontend/docker/browser
   
   # The exact command that was interrupted - this is the validation step
   docker build -t aef-browser-tigervnc . && docker run -d -p 16085:6080 -p 5901:5900 -e ANTHROPIC_API_KEY=test-key --name aef-browser-tigervnc-test aef-browser-tigervnc
   
   # Expected outcome: 
   # - TigerVNC container builds successfully 
   # - Test container starts on ports 16085 (noVNC) and 5901 (direct VNC)
   # - Ready for validation testing
   ```

2. **Validate TigerVNC Solution** 
   - Open `test-tigervnc-dynamic.html` in browser (points to localhost:16085)
   - Verify responsive scaling with perfect mouse interaction
   - Test browser automation API endpoints: `curl http://localhost:3000/init` inside container

3. **Frontend Integration**
   - Update container creation to use TigerVNC image
   - Enable remote resize mode in production VNC viewers
   - A/B test against old x11vnc containers

#### **Short Term**
- **Performance optimization** (compression, quality settings)
- **Container orchestration** integration  
- **Monitoring and health checks** for TigerVNC services
- **Documentation** for development team

#### **Long Term Considerations**
- **WebRTC streaming evaluation** for even better performance
- **Multi-resolution support** for different device classes
- **Load balancing** for high-concurrency scenarios

## 🔧 Technical Specifications

### **Container Configuration**
```yaml
Environment Variables:
  DISPLAY: ":1"
  VNC_RESOLUTION: "1280x720"  
  VNC_COL_DEPTH: "24"
  VNC_DPI: "96"
  ANTHROPIC_API_KEY: "[required for browser automation]"

Ports Exposed:
  5900: VNC server (TigerVNC)
  6080: WebSocket proxy (websockify + noVNC)
  3000: Browser automation API (Node.js)

Services (Supervisor):
  - tigervnc: Xvnc server with ExtendedDesktopSize
  - xstartup: Session startup (fluxbox + browser-server)  
  - websockify: noVNC WebSocket proxy
```

### **Key File Changes**
```diff
# Dockerfile
- FROM node:18-slim
+ FROM debian:bookworm-slim
- RUN apt-get install -y xvfb x11vnc  
+ RUN apt-get install -y tigervnc-standalone-server tigervnc-tools

# browser-server.js  
- DISPLAY: ':99'
+ DISPLAY: ':1'
- execSync('xdpyinfo -display :99', { stdio: 'ignore' });
+ execSync('xdpyinfo -display :1', { stdio: 'ignore' });

# ResponsiveVNCFrame.tsx
- url.searchParams.set('resize', 'off');
+ url.searchParams.set('resize', 'remote'); // Enable ExtendedDesktopSize
```

## 📖 Research References

**Key Research Insights:**
- **TigerVNC ExtendedDesktopSize**: VNC protocol extension for dynamic resolution
- **noVNC Remote Resize**: Built-in support for server-side resolution changes
- **KasmVNC Example**: Production implementation of TigerVNC + dynamic scaling
- **Mouse Coordinate Translation**: Why client-side approaches are problematic
- **WebRTC Alternative**: Future consideration for high-performance streaming

**Research Sources:**
- NoVNC maintainers documentation on ExtendedDesktopSize extension
- TigerVNC manual on RandR (resize and rotate) support  
- KasmVNC implementation as real-world example
- Apache Guacamole VNC coordinate scaling issues and solutions
- Browser automation community discussions on Playwright viewport handling

## 🎯 Success Metrics

### **Technical Validation**
- [ ] **Mouse click accuracy**: 100% coordinate alignment across all resolutions
- [ ] **Window manipulation**: Drag, resize, minimize/maximize works flawlessly  
- [ ] **Responsive scaling**: Desktop adapts to browser window in <200ms
- [ ] **Cross-browser compatibility**: Chrome, Firefox, Safari, Edge support
- [ ] **Performance**: No lag or visual artifacts during resolution changes

### **User Experience**
- [ ] **Seamless resizing**: No visible flicker or repainting during adaptation
- [ ] **Intuitive controls**: Easy switching between resize modes
- [ ] **Mobile compatibility**: Touch interactions work correctly on mobile devices
- [ ] **Accessibility**: Screen readers and keyboard navigation support

### **Development Impact**  
- [ ] **Reduced complexity**: Eliminate coordinate translation code
- [ ] **Maintainability**: Single source of truth for resolution (VNC server)
- [ ] **Reliability**: Fewer edge cases and browser-specific quirks
- [ ] **Scalability**: Support for arbitrary resolutions without code changes

---

## 💡 Notes for Next Session

**Priority 1**: Complete the Docker build and validate the TigerVNC solution works end-to-end

**Priority 2**: Test frontend integration and compare performance to old approach  

**Priority 3**: Document migration path for production deployment

**Key Files to Review**:
- `app_frontend/docker/browser/Dockerfile` (TigerVNC container definition)
- `app_frontend/components/aef/ResponsiveVNCFrame.tsx` (Frontend integration)
- `test-tigervnc-dynamic.html` (Testing interface)

**Expected Outcome**: A fully functional VNC browser integration with responsive scaling and perfect mouse interaction, solving the fundamental UX issues identified in the original investigation. 