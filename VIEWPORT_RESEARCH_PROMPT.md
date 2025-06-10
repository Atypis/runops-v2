# VNC Browser Viewport Cutoff Investigation

## Problem Statement
We have a Docker container running Chrome browser automation via Stagehand/Playwright inside a TigerVNC environment, accessed through noVNC. Despite multiple configuration attempts, the browser consistently gets cut off at the bottom of the VNC viewport, preventing full visibility of browser automation workflows.

## Current Status
- **VNC Resolution**: 1280x960 (confirmed via xrandr)
- **Browser Actual Size**: ~1280x840-900 (user measured, but still cut off)
- **Expected**: Full browser visibility within VNC viewport
- **Issue**: Bottom portion of browser consistently cut off regardless of resolution changes

## Key Technical Context

### Stack Components
1. **Docker Container**: Custom browser automation container
2. **VNC Server**: TigerVNC with DISPLAY=:1
3. **Window Manager**: Fluxbox with custom configuration
4. **Browser**: Chrome/Chromium via Stagehand (Playwright wrapper)
5. **VNC Client**: noVNC web interface
6. **Access**: HTTP interface on port 16080

### File Locations
- Browser server: `app_frontend/docker/browser/browser-server.js`
- Docker config: `app_frontend/docker/browser/Dockerfile`
- Fluxbox config: `app_frontend/docker/browser/fluxbox-apps`, `app_frontend/docker/browser/fluxbox-init`
- VNC startup: `app_frontend/docker/browser/vnc-startup.sh`
- Frontend VNC component: `app_frontend/components/aef/ResponsiveVNCFrame.tsx`

## What We've Tried (All Failed to Fix Height Issue)

### 1. noVNC Resize Mode Fix ✅ (Partially Successful)
- **Problem**: Dynamic resize was shrinking VNC to iframe size (740x419)
- **Solution**: Changed `resize=remote` to `resize=off` in ResponsiveVNCFrame.tsx
- **Result**: Fixed width issue (now full 1280px), but height still cut off

### 2. Playwright Viewport Configuration ❌
- Updated browser-server.js viewport settings multiple times
- Tried: 1280x720, 1280x700, 1280x680, 1280x920
- Added explicit `setViewportSize()` calls after Stagehand initialization
- **Result**: No improvement in height cutoff

### 3. Chrome Launch Arguments ❌
- Modified `--window-size` parameter to match viewport
- Added `--window-position=0,0`
- Tried `--kiosk` mode (caused initialization failures)
- **Result**: Width fixed, height still cut off

### 4. VNC Resolution Scaling ❌
- Increased VNC resolution from 1280x720 → 1280x960
- **Result**: More space available, but browser still cut off at same relative position

### 5. Fluxbox Window Manager Configuration ❌
- Verified `[Decorations] {NONE}` is set for Chrome windows
- Confirmed `[Maximized] {yes}` configuration
- **Result**: Should remove window decorations, but height issue persists

## Key Observations & Anomalies

### 1. Measurement Discrepancy
- **xwininfo output**: Shows Chrome windows as 200x200 (clearly wrong)
- **User measurement**: Browser appears as ~1280x840-900
- **Investigation needed**: Why is xwininfo reporting incorrect dimensions?

### 2. Width vs Height Behavior
- **Width fix**: Changing noVNC resize mode immediately fixed width to full 1280px
- **Height issue**: Persists regardless of VNC resolution, viewport config, or window settings
- **Investigation needed**: What's different about height handling?

### 3. Fluxbox vs Browser Interaction
- Browser appears larger than VNC viewport can display
- Window manager should enforce window sizing, but seems ineffective
- **Investigation needed**: Is fluxbox properly managing Chrome window size?

### 4. Playwright/Stagehand Override Behavior
- Browser launch arguments seem ignored for height
- Viewport settings don't translate to actual window size
- **Investigation needed**: How does Stagehand/Playwright override native browser settings?

## Research Questions to Answer

### 1. Root Cause Analysis
- Why does the browser render at ~840-900px height when configured for smaller sizes?
- What component is overriding the height settings (Playwright, Chrome, Fluxbox, VNC)?
- Why is xwininfo reporting incorrect window dimensions?

### 2. Window Management Deep Dive
- How does Fluxbox interact with Chrome's native window management?
- Are there Fluxbox settings we're missing that control maximum window size?
- Does Chrome have built-in size preferences that override external settings?

### 3. Playwright/Stagehand Investigation
- Does Stagehand have internal viewport/window sizing logic that overrides config?
- Are there Playwright browser context settings affecting window geometry?
- How does Playwright's `setViewportSize()` relate to actual OS window size?

### 4. VNC/Display Server Analysis
- Is there a relationship between VNC server resolution and window manager constraints?
- Could there be multiple display contexts or virtual screens interfering?
- Are there TigerVNC-specific configurations affecting window sizing?

### 5. Alternative Solutions
- Can we force Chrome into a true fullscreen/kiosk mode that VNC can contain?
- Should we modify the VNC setup to use a different window manager?
- Are there CSS/JavaScript solutions to force browser content sizing?

## Deliverables Expected

### 1. Root Cause Identification
- Precise component/configuration causing the height override
- Technical explanation of why height behaves differently from width
- Definitive answer on xwininfo dimension reporting issue

### 2. Working Solution
- Step-by-step fix that ensures browser fits within VNC viewport
- Configuration changes with clear rationale
- Verification method to confirm fix is stable

### 3. Technical Documentation
- Explanation of browser → window manager → VNC interaction chain
- Settings hierarchy and override behavior
- Best practices for similar setups

### 4. Fallback Options
- Alternative approaches if primary solution isn't feasible
- Workarounds that provide acceptable user experience
- Future-proofing recommendations

## Container Access
- Container ID: `fc9a6af11d04` (may change, use `docker ps | grep aef-browser`)
- VNC Access: `http://localhost:16080/vnc.html?autoconnect=true&resize=off`
- Browser API: `http://localhost:3000/` (init, restart-browser endpoints)

## Timeline
- **Research Phase**: 30 minutes
- **Implementation**: TBD based on findings
- **Verification**: Must confirm browser fully visible in VNC without cutoff

## Success Criteria
✅ Browser automation fully visible in VNC viewport  
✅ No bottom cutoff regardless of content  
✅ Stable configuration that persists across container restarts  
✅ Clear understanding of technical root cause  

---

*Note: This is a blocking issue for browser automation visibility. The solution must provide full browser viewport access for effective automation monitoring.* 