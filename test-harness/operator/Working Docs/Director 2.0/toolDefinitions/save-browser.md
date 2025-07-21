# Browser Session Management - Design Document

## Overview

Browser session management allows Director to maintain logged-in states across workflow executions. This is critical for automating sites like Gmail, banks, and other high-security applications that use sophisticated authentication.

## Current Design Decision

After evaluating multiple approaches, we've chosen a **profile-based snapshot system** for maximum simplicity:

1. **Chrome Profiles Only** - No cookie/localStorage extraction
2. **Snapshot After Login** - Capture complete profile state after successful authentication
3. **Restore Before Use** - Download and restore profile snapshot when needed

## How Chrome Profiles Work

Chrome profiles are local directories containing ALL browser state:
- Cookies, localStorage, sessionStorage
- IndexedDB, Cache, Service Workers  
- Device fingerprints, TLS state
- History, autofill, preferences
- ~100-200MB after login, can grow to GBs

Key insight: Profiles must be set at browser launch time - you cannot switch profiles without restarting the browser.

## Implementation Approach

### Local Development (Current)
```javascript
// Simple profile directory usage
browser.launch({ userDataDir: './browser-profiles/gmail-work' });
```

### Cloud Deployment (Future)
```javascript
// 1. After successful login
snapshotProfile('gmail-work'); // Zips and uploads to Supabase

// 2. In future workflows  
restoreProfile('gmail-work'); // Downloads and extracts
browser.launch({ userDataDir: './browser-profiles/gmail-work' });
```

## Simplified API

We're removing all cookie-based session management in favor of two simple actions:

### Core Actions

1. **listProfiles** - Show available profiles
   ```javascript
   browser_action({ action: "listProfiles" })
   // Returns: { profiles: ["gmail-work", "chase-bank"] }
   ```

2. **setProfile** - Use a profile (or null for incognito)
   ```javascript
   browser_action({ 
     action: "setProfile", 
     config: { profileName: "gmail-work" } // or null
   })
   ```

### Snapshot Actions (Cloud support)

3. **snapshotProfile** - Save current profile state
   ```javascript
   browser_action({
     action: "snapshotProfile",
     config: { profileName: "gmail-work" }
   })
   ```

4. **restoreProfile** - Restore saved profile state
   ```javascript
   browser_action({
     action: "restoreProfile", 
     config: { profileName: "gmail-work" }
   })
   ```

## Workflow Examples

### First Time Login
```javascript
// 1. Create new profile
setProfile({ profileName: "gmail-work" })

// 2. Navigate and login manually
navigate({ url: "https://gmail.com" })
// ... user logs in ...

// 3. Snapshot the logged-in state
snapshotProfile({ profileName: "gmail-work" })
```

### Subsequent Runs
```javascript
// 1. Restore snapshot (cloud) or just use profile (local)
restoreProfile({ profileName: "gmail-work" }) // Cloud
// OR
setProfile({ profileName: "gmail-work" }) // Local

// 2. Navigate - already logged in!
navigate({ url: "https://gmail.com" })
```

## Technical Details

### Profile Storage
- **Local**: `./browser-profiles/{name}/`
- **Cloud**: Supabase Storage as compressed archives
- **Size**: 100-200MB per snapshot (compressed to ~50-100MB)

### Why Not Cookie Extraction?
Modern auth uses multiple storage mechanisms:
- Cookies (we can extract) ✅
- LocalStorage (we can extract) ✅  
- IndexedDB (hard to extract) ⚠️
- Service Workers (cannot extract) ❌
- Device fingerprints (cannot extract) ❌

Gmail specifically checks all of these - partial extraction fails.

### Snapshot Timing
The key insight: Snapshot immediately after login when all auth tokens are fresh. The profile can accumulate junk afterwards - we don't care, we always restore from the clean snapshot.

## Implementation Status

- [x] Profile directory support
- [x] setProfile/listProfiles actions
- [ ] snapshotProfile action (in progress)
- [ ] restoreProfile action (in progress)
- [ ] Compression optimization (future)
- [ ] Incremental snapshots (future)

## Migration Path

1. Remove all cookie-based session code
2. Update Director prompt to only mention profiles
3. Implement snapshot/restore for cloud support
4. Test with Gmail as primary use case