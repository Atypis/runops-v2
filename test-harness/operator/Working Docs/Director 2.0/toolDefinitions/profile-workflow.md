# Browser Profile Management Workflow

## Overview

The new profile management system replaces the old cookie-based session saving with a simpler, more powerful approach using Chrome profiles. Here's how it works:

## The Four Profile Actions

1. **listProfiles** - Shows what profiles exist on your local machine
2. **setProfile** - Creates or switches to a profile (restarts browser)
3. **snapshotProfile** - Saves profile to cloud (for future deployment)
4. **restoreProfile** - Downloads profile from cloud and switches to it

## Common Workflows

### Workflow 1: First Time Login (Gmail Example)

```javascript
// Step 1: Check what profiles exist
browser_action({
  action: "listProfiles"
})
// Returns: {profiles: []} (empty if first time)

// Step 2: Create and switch to a new profile
browser_action({
  action: "setProfile",
  config: {profileName: "gmail-work"}
})
// Browser restarts with empty profile "gmail-work"

// Step 3: Navigate and login manually
browser_action({
  action: "navigate",
  config: {url: "https://gmail.com"}
})
// ... Director guides through login process ...
// Profile auto-saves everything to disk

// Step 4: (Optional) Create cloud snapshot after login
browser_action({
  action: "snapshotProfile",
  config: {profileName: "gmail-work"}
})
// Uploads profile to Supabase for cloud deployment
```

### Workflow 2: Subsequent Runs (Already Logged In)

```javascript
// Step 1: Check available profiles
browser_action({
  action: "listProfiles"
})
// Returns: {profiles: ["gmail-work"]}

// Step 2: Use existing profile
browser_action({
  action: "setProfile",
  config: {profileName: "gmail-work"}
})
// Browser restarts with profile, cookies intact

// Step 3: Navigate - already logged in!
browser_action({
  action: "navigate",
  config: {url: "https://gmail.com"}
})
// Gmail recognizes the session, no login needed
```

### Workflow 3: Incognito Mode (No Profile)

```javascript
// Simply don't set a profile - default behavior
browser_action({
  action: "navigate",
  config: {url: "https://example.com"}
})
// Browser runs in default mode, nothing saved
```

### Workflow 4: Cloud Deployment (Future)

```javascript
// Download and restore profile from cloud
browser_action({
  action: "restoreProfile",
  config: {profileName: "gmail-work"}
})
// Downloads snapshot, extracts it, restarts browser with profile
```

## Key Concepts

### Profile = Complete Browser State
- Cookies, localStorage, IndexedDB
- Cache, history, autofill
- Device fingerprints, certificates
- Everything Chrome saves to disk

### Profile Lifecycle
1. **Create**: First `setProfile` with new name creates empty profile
2. **Use**: Browser auto-saves all changes to profile directory
3. **Persist**: Profile stays on disk between runs
4. **Snapshot**: Optional cloud backup for portability

### When to Use Profiles

**Use Profiles For:**
- Gmail, Google Workspace
- Banking sites
- Any site requiring persistent login
- Sites with 2FA/device verification

**Skip Profiles For:**
- Public sites
- One-time scraping
- Testing/debugging

## Important Notes

1. **Browser Restart Required**: Switching profiles always restarts the browser
2. **Profile Names**: Use lowercase, numbers, hyphens only (e.g., "gmail-work", "chase-bank")
3. **Local by Default**: Profiles are stored locally unless you explicitly snapshot
4. **One Profile at a Time**: Can't mix profiles in same browser instance

## Director's Decision Process

When Director starts a workflow, it should:

1. Ask: "Do I need to stay logged in?"
   - No → Use default browser (no profile)
   - Yes → Continue to step 2

2. Check available profiles: `listProfiles()`

3. If profile exists:
   - Use it: `setProfile({profileName: "site-name"})`
   
4. If profile doesn't exist:
   - Create it: `setProfile({profileName: "site-name"})`
   - Guide through login
   - Optionally snapshot for cloud

## Example Director Conversation

```
User: "I need to check my Gmail inbox daily"

Director: "I'll set up Gmail automation with persistent login. Let me check available profiles..."
*listProfiles()*
"No Gmail profile found. I'll create one."

*setProfile({profileName: "gmail-work"})*
"Browser restarted with new profile. Please log into Gmail manually this first time."

*navigate({url: "https://gmail.com"})*
"After you log in, this profile will remember your session for future runs."

[User logs in]

"Great! Your Gmail session is now saved in the 'gmail-work' profile. 
Next time, I'll just use this profile and you'll already be logged in."
```

## Profile Storage Locations

- **Local**: `./browser-profiles/{profileName}/`
- **Cloud**: Supabase Storage bucket `browser-profiles`
- **Database**: Metadata only in `browser_sessions` table