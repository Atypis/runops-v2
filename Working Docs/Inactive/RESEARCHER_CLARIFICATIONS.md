# Researcher Clarification Responses

## 1. Exact Height Measurements

### Current Measurements (User Confirmed):
- **VNC Display Resolution**: 1280x960 (when running - was increased from 720 to 960)
- **Browser Actual Size**: ~1280x840-900 pixels (user measured)
- **Height Cutoff**: ~60-120 pixels cut off at bottom
- **Behavior**: Browser extends beyond visible VNC viewport, bottom portion not accessible

### Key Issue:
- Browser renders at **840-900px height** when configured for smaller sizes
- VNC viewport shows full **1280px width** ✅ but cuts off at **~840px height** ❌  
- User can scroll browser content, but bottom chrome UI (address bar, etc.) is inaccessible

## 2. ResponsiveVNCFrame.tsx CSS Analysis

### Container Sizing:
```tsx
// Container uses full available space with no height restrictions
<div className={`relative w-full h-full overflow-hidden bg-gray-900 ${className}`}>

// Iframe also uses full space - NO height constraints found
<iframe className="w-full h-full border-0" />
```

### Key Findings:
- ✅ **No CSS height constraints** in ResponsiveVNCFrame component
- ✅ Uses `w-full h-full` (100% width/height) 
- ✅ Container adapts to parent dimensions via ResizeObserver
- ❌ **Not the source of height limitation**

### Default Props:
```tsx
nativeWidth = 1280,
nativeHeight = 720  // This is only used for display, not actual constraints
```

## 3. Container & Log Access

### Container Status:
- **Previous Container**: `fc9a6af11d04` (stopped)
- **To Start New**: Use existing Docker compose/run commands
- **Current Status**: No aef-browser container running

### Log Locations to Check:
```bash
# When container is running:
docker logs [container-id]                          # Docker container logs
docker exec [container-id] cat /var/log/tigervnc.log    # VNC server logs  
docker exec [container-id] journalctl               # System logs
docker exec [container-id] cat /tmp/browser-server.log  # Browser server logs (if exists)

# Browser dev console (via VNC):
# F12 in browser → Console tab for JavaScript errors
# F12 → Network tab for failed requests
```

### Screenshots/Evidence:
The user has visual confirmation of:
1. **Width fixed successfully** - browser spans full 1280px width
2. **Height cutoff persists** - bottom ~60-120px of browser not visible
3. **Content scrollable** - can scroll page content, but chrome UI cut off

## 4. Key Investigation Areas

### A. Window Size Reporting Discrepancy
```bash
# xwininfo shows wrong dimensions:
docker exec [container] bash -c "DISPLAY=:1 xwininfo -root -tree | grep chrome"
# Output: 200x200 (clearly incorrect)

# But user visually confirms: ~1280x840-900 actual size
```

### B. Fluxbox Configuration Applied?
```bash
# Check if fluxbox apps config is being read:
cat app_frontend/docker/browser/fluxbox-apps
# Contains: [Decorations] {NONE} and [Maximized] {yes}
```

### C. Playwright vs Chrome vs Fluxbox Hierarchy
Current config attempts:
- **Chrome args**: `--window-size=1280,920`
- **Playwright viewport**: `{ width: 1280, height: 920 }`
- **Fluxbox config**: `[Maximized] {yes}`
- **VNC resolution**: `1280x960`

**Result**: Browser still renders at ~840-900px height, ignoring smaller configurations

## 5. Specific Debug Commands

### When Container Running:
```bash
# Get real window dimensions
docker exec [container] bash -c "DISPLAY=:1 wmctrl -l -G" # if wmctrl available
docker exec [container] bash -c "DISPLAY=:1 xdotool search --name chrome getwindowgeometry --shell %1"

# Check fluxbox config loading
docker exec [container] bash -c "cat ~/.fluxbox/apps"
docker exec [container] bash -c "fluxbox-remote 'version'"

# Browser process details
docker exec [container] bash -c "ps aux | grep chrome | grep -v grep"
```

### Measurements Needed:
1. **Exact VNC framebuffer size** via `xrandr`
2. **Actual Chrome window geometry** via reliable tool (not xwininfo)
3. **Available screen real estate** after window manager overhead
4. **Browser viewport size** vs **OS window size** comparison

## 6. Hypothesis to Test

**Primary Theory**: Browser has internal minimum height preferences that override external configuration, causing it to render larger than VNC can display.

**Secondary Theory**: Fluxbox window management not properly constraining Chrome window size despite configuration.

**Test Strategy**: Try alternative approaches like:
- Headless mode with screenshot scaling
- Different window manager (openbox, xfwm4)  
- Force Chrome kiosk mode with explicit geometry
- VNC server with larger default resolution

---

*Container must be running for measurements. Use standard startup process to recreate environment.* 