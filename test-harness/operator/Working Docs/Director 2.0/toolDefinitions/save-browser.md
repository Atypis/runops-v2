# Browser Profile Management - Complete Implementation Guide

## Overview

The browser profile management system enables persistent browser sessions across workflow runs by leveraging Chrome's user data directory feature. This allows workflows to maintain logged-in states on high-security sites like Gmail, banking platforms, and services with device verification.

## Architecture

### Core Concept: Chrome Profiles

Chrome profiles are complete browser environments stored on disk that include:
- Cookies and session data
- LocalStorage and IndexedDB
- Cache and service workers
- Autofill data and saved passwords
- Device fingerprints and certificates
- Extension data and preferences
- History and bookmarks

### System Components

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Director API   │────▶│ BrowserAction    │────▶│  NodeExecutor   │
│  (4 actions)    │     │    Service       │     │ (Implementation)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                           │
                                ┌──────────────────────────┴───────────┐
                                │                                      │
                                ▼                                      ▼
                        ┌──────────────┐                    ┌──────────────────┐
                        │ Local Files  │                    │ Supabase Cloud   │
                        │ ./browser-   │                    │ - Storage bucket │
                        │   profiles/  │                    │ - Database table │
                        └──────────────┘                    └──────────────────┘
```

## Database Schema

### Table: `browser_sessions`

```sql
CREATE TABLE browser_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    cookies JSONB DEFAULT '[]'::jsonb,
    local_storage JSONB,
    session_storage JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    scope TEXT DEFAULT 'origin' CHECK (scope IN ('origin', 'browser')),
    persist_strategy TEXT DEFAULT 'storageState' CHECK (persist_strategy IN ('storageState', 'profileDir')),
    origin TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);
```

### Key Fields for Profile Management

- **name**: Unique identifier for the profile (e.g., "gmail-work")
- **persist_strategy**: Must be 'profileDir' for profile-based sessions
- **metadata**: Stores snapshot information:
  ```json
  {
    "snapshot_file": "gmail-work-1753089684737.tar.gz",
    "size_mb": 49,
    "created_at": "2025-01-21T19:28:04.737Z"
  }
  ```

## Storage Implementation

### Local Storage
- **Path**: `./browser-profiles/{profileName}/`
- **Structure**: Complete Chrome user data directory
- **Lifecycle**: Persists until explicitly deleted

### Cloud Storage (Supabase)
- **Bucket**: `browser-profiles` (private)
- **Format**: Compressed tar.gz archives
- **Naming**: `{profileName}-{timestamp}.tar.gz`
- **Size**: Typically 50-200MB compressed

## API Reference

### 1. List Profiles

```javascript
browser_action({
  action: "listProfiles"
})
```

**Returns:**
```json
{
  "profiles": ["gmail-work", "chase-bank"],
  "count": 2
}
```

**Implementation:**
- Reads `./browser-profiles/` directory
- Returns only directory names
- Does NOT query cloud storage

### 2. Set Profile

```javascript
browser_action({
  action: "setProfile",
  config: {
    profileName: "gmail-work"  // or null for default
  }
})
```

**Returns:**
```json
{
  "profile": "gmail-work",
  "message": "Browser restarted with profile \"gmail-work\""
}
```

**Implementation:**
1. Closes current browser instance
2. Launches new browser with `--user-data-dir=./browser-profiles/gmail-work`
3. Chrome loads all saved state from profile
4. Creates profile directory if it doesn't exist

### 3. Snapshot Profile

```javascript
browser_action({
  action: "snapshotProfile",
  config: {
    profileName: "gmail-work"
  }
})
```

**Returns:**
```json
{
  "success": true,
  "profileName": "gmail-work",
  "sizeMB": 49,
  "fileName": "gmail-work-1753089684737.tar.gz",
  "message": "Profile snapshot created: 49MB"
}
```

**Implementation:**
1. Validates profile directory exists
2. Creates tar.gz archive: `tar -czf archive.tar.gz -C ./browser-profiles/ gmail-work`
3. Uploads to Supabase Storage bucket
4. Updates database with metadata
5. Cleans up local tar file

### 4. Restore Profile

```javascript
browser_action({
  action: "restoreProfile",
  config: {
    profileName: "gmail-work"
  }
})
```

**Returns:**
```json
{
  "profileName": "gmail-work",
  "message": "Profile restored from snapshot",
  "snapshotFile": "gmail-work-1753089684737.tar.gz",
  "browserRestarted": true
}
```

**Implementation:**
1. Queries database for snapshot metadata
2. Downloads tar.gz from Supabase Storage
3. Deletes existing profile directory if present
4. Extracts snapshot: `tar -xzf snapshot.tar.gz -C ./browser-profiles/`
5. Restarts browser with restored profile

### 5. Load Profile (Unified)

**As a workflow node:**
```javascript
{type: "browser_action", alias: "load_profile", config: {
  action: "loadProfile", 
  profileName: "gmail-work"
}}
```

**As a direct browser_action:**
```javascript
browser_action({
  action: "loadProfile",
  config: {
    profileName: "gmail-work"
  }
})
```

**Returns (if local):**
```json
{
  "profile": "gmail-work",
  "source": "local",
  "message": "Loaded profile \"gmail-work\" from local storage"
}
```

**Returns (if from cloud):**
```json
{
  "profile": "gmail-work",
  "source": "cloud",
  "message": "Restored profile \"gmail-work\" from cloud snapshot",
  "snapshotFile": "gmail-work-1753089684737.tar.gz"
}
```

**Implementation:**
1. Checks if profile exists locally
2. If yes → switches to local profile (like `setProfile`)
3. If no → downloads from cloud (like `restoreProfile`)
4. Throws error if profile not found anywhere
5. Always results in browser restart with the profile

**Use Case:**
- Simplifies workflows by combining local/cloud logic
- No need to check existence manually
- Perfect for "just load this profile" scenarios
- **Recommended**: Use as the first node in workflows requiring authentication

**Important**: Profile action availability:
- **loadProfile**: Available as BOTH workflow node AND browser_action tool
  - As a node: Can be the first step in your workflow
  - As a tool: For manual testing and exploration
- **setProfile, snapshotProfile, restoreProfile**: Only available as browser_action tools
  - These require manual intervention through Director
  - Cannot be used as workflow nodes

This design makes `loadProfile` ideal for starting workflows with the correct profile automatically, while other profile operations remain under manual control.

## Complete Code Flow

### Profile Creation/Switching

```javascript
// nodeExecutor.js - getStagehand()
if (profileName && profileName !== this.currentProfileName) {
  await this.cleanup();
  const profileDir = path.join(process.cwd(), 'browser-profiles', profileName);
  const browser = await chromium.launch({
    headless: false,
    userDataDir: profileDir,  // Chrome saves everything here
    // ... other options
  });
}
```

### Snapshot Creation

```javascript
// nodeExecutor.js - snapshotBrowserProfile()
async snapshotBrowserProfile(profileName) {
  // 1. Validate profile exists
  const profilePath = path.join(process.cwd(), 'browser-profiles', profileName);
  
  // 2. Create compressed archive
  const tarPath = path.join(os.tmpdir(), `${profileName}-${Date.now()}.tar.gz`);
  await execAsync(`tar -czf "${tarPath}" -C "${path.dirname(profilePath)}" "${profileName}"`);
  
  // 3. Upload to Supabase
  const { data, error } = await supabase.storage
    .from('browser-profiles')
    .upload(fileName, fileBuffer, { contentType: 'application/gzip' });
  
  // 4. Save metadata
  await supabase.from('browser_sessions').upsert({
    name: profileName,
    persist_strategy: 'profileDir',
    metadata: { snapshot_file: fileName, size_mb: sizeMB }
  });
}
```

### Profile Restoration

```javascript
// nodeExecutor.js - restoreBrowserProfile()
async restoreBrowserProfile(profileName) {
  // 1. Get snapshot metadata
  const { data: session } = await supabase
    .from('browser_sessions')
    .select('*')
    .eq('name', profileName)
    .eq('persist_strategy', 'profileDir')
    .single();
  
  // 2. Download snapshot
  const { data } = await supabase.storage
    .from('browser-profiles')
    .download(session.metadata.snapshot_file);
  
  // 3. Extract to profile directory
  await execAsync(`tar -xzf "${tarPath}" -C "${profilesDir}"`);
  
  // 4. Browser restart handled by caller
}
```

### LoadProfile Node Implementation

```javascript
// nodeExecutor.js - executeBrowserAction() case 'loadProfile'
case 'loadProfile':
  // Load profile - checks local first, then cloud
  const profileName = config.profileName;
  if (!profileName) {
    throw new Error('loadProfile requires profileName parameter');
  }
  
  // Check if profile exists locally
  const localProfiles = await this.listBrowserProfiles();
  const existsLocally = localProfiles.includes(profileName);
  
  if (existsLocally) {
    // Profile exists locally, restart browser with it
    await this.cleanup();
    await this.getStagehand({
      profileName,
      persistStrategy: 'profileDir'
    });
    
    return {
      profile: profileName,
      source: 'local',
      message: `Loaded profile "${profileName}" from local storage`
    };
  } else {
    try {
      // Try to restore from cloud
      const result = await this.restoreBrowserProfile(profileName);
      
      // Restart browser with restored profile
      await this.cleanup();
      await this.getStagehand({
        profileName,
        persistStrategy: 'profileDir'
      });
      
      return {
        profile: profileName,
        source: 'cloud',
        message: `Restored profile "${profileName}" from cloud snapshot`,
        snapshotFile: result.snapshotFile
      };
    } catch (error) {
      throw new Error(`Profile "${profileName}" not found locally or in cloud.`);
    }
  }
```

### LoadProfile Service Implementation

```javascript
// browserActionService.js - loadProfile()
async loadProfile(config) {
  const { profileName } = config;
  
  if (!profileName) {
    throw new Error('profileName is required for loadProfile');
  }
  
  // Check if profile exists locally
  const localProfiles = await this.nodeExecutor.listBrowserProfiles();
  const existsLocally = localProfiles.includes(profileName);
  
  if (existsLocally) {
    // Profile exists locally, just switch to it
    await this.nodeExecutor.cleanup();
    await this.nodeExecutor.getStagehand({
      profileName,
      persistStrategy: 'profileDir'
    });
    
    return {
      profile: profileName,
      source: 'local',
      message: `Loaded profile "${profileName}" from local storage`
    };
  } else {
    try {
      // Try to restore from cloud
      const result = await this.nodeExecutor.restoreBrowserProfile(profileName);
      
      // Restart browser with restored profile
      await this.nodeExecutor.cleanup();
      await this.nodeExecutor.getStagehand({
        profileName,
        persistStrategy: 'profileDir'
      });
      
      return {
        profile: profileName,
        source: 'cloud',
        message: `Restored profile "${profileName}" from cloud snapshot`,
        snapshotFile: result.snapshotFile
      };
    } catch (error) {
      throw new Error(`Profile "${profileName}" not found locally or in cloud.`);
    }
  }
}
```

## Error Handling

### Common Errors and Solutions

1. **"No profile directory found"**
   - Profile doesn't exist locally
   - Solution: Create profile first with `setProfile`

2. **"No snapshot found for profile"**
   - No database record or cloud backup exists
   - Solution: Create snapshot first with `snapshotProfile`

3. **"Browser must be restarted"**
   - Attempting to save non-profile browser as profile
   - Solution: Workflow will restart browser automatically

4. **Database constraint violation**
   - Fixed in latest version
   - Was using invalid `persist_strategy` value

## Security Considerations

### What's Stored in Profiles

⚠️ **Profiles contain sensitive data:**
- Authentication cookies and tokens
- Saved passwords (if Chrome password saving enabled)
- Credit card information (if autofill enabled)
- Browsing history
- Form data and autofill entries

### Security Measures

1. **Local Storage**: No encryption (relies on OS file permissions)
2. **Cloud Storage**: 
   - Private Supabase bucket
   - HTTPS transport encryption
   - No public access URLs
3. **Database**: RLS policies control access

### Best Practices

1. **Don't share profiles** - They contain authentication tokens
2. **Rotate snapshots** - Delete old snapshots regularly
3. **Use descriptive names** - Makes it clear what each profile is for
4. **Minimize data** - Clear unnecessary browsing data before snapshots

## Common Workflows

### First-Time Login Flow

```javascript
// 1. Create new profile
browser_action({
  action: "setProfile",
  config: {profileName: "gmail-work"}
})

// 2. Navigate and login manually
browser_action({
  action: "navigate",
  config: {url: "https://gmail.com"}
})
// ... user logs in ...

// 3. Create snapshot for future use
browser_action({
  action: "snapshotProfile",
  config: {profileName: "gmail-work"}
})
```

### Subsequent Runs

```javascript
// 1. Use existing profile
browser_action({
  action: "setProfile",
  config: {profileName: "gmail-work"}
})

// 2. Navigate - already logged in!
browser_action({
  action: "navigate",
  config: {url: "https://gmail.com"}
})
```

### Cloud Deployment

```javascript
// On new machine/container
browser_action({
  action: "restoreProfile",
  config: {profileName: "gmail-work"}
})
// Profile downloaded and browser restarted with saved session
```

### Simplified Workflow (Recommended)

```javascript
// Just use loadProfile - it handles both local and cloud
browser_action({
  action: "loadProfile",
  config: {profileName: "gmail-work"}
})

// Works regardless of whether profile is:
// - Already on this machine (uses local)
// - Only in cloud (downloads and restores)
// - Doesn't exist (throws clear error)
```

### Complete Workflow Example

```javascript
// Start every workflow that needs authentication with loadProfile
const workflow = [
  // Step 1: Load profile (local or cloud)
  {
    type: "browser_action",
    alias: "load_profile",
    config: {
      action: "loadProfile",
      profileName: "gmail-work"
    }
  },
  
  // Step 2: Navigate to Gmail (already logged in!)
  {
    type: "browser_action", 
    alias: "go_to_gmail",
    config: {
      action: "navigate",
      url: "https://gmail.com"
    }
  },
  
  // Step 3: Continue with automation...
  {
    type: "browser_ai_query",
    alias: "check_inbox",
    config: {
      instruction: "Extract the number of unread emails",
      schema: {type: "object", properties: {unread: {type: "number"}}}
    }
  }
];
```

## Limitations and Constraints

### Technical Limitations

1. **Platform Support**: Uses native `tar` command (Mac/Linux only)
2. **Browser Restart**: Profile switches always restart browser
3. **Size Limits**: Large profiles (>1GB) may hit storage limits
4. **Concurrency**: No locking - don't use same profile in parallel

### Design Constraints

1. **Profile Immutability**: Can't change profile mid-session
2. **State Loss**: Switching profiles loses in-memory state
3. **No Merging**: Profiles are completely separate environments
4. **Local First**: Must have local profile to snapshot

## Implementation Files

### Core Implementation
- `/test-harness/operator/backend/services/nodeExecutor.js`
  - `getStagehand()` - Profile-aware browser initialization
  - `listBrowserProfiles()` - List local profiles
  - `snapshotBrowserProfile()` - Create cloud backup
  - `restoreBrowserProfile()` - Restore from cloud
  - `executeBrowserAction()` - Contains loadProfile node implementation (case 'loadProfile')

### Service Layer
- `/test-harness/operator/backend/services/browserActionService.js`
  - `listProfiles()` - High-level API wrapper
  - `setProfile()` - Profile switching with browser restart
  - `snapshotProfile()` - Snapshot creation wrapper
  - `restoreProfile()` - Restoration with auto-restart

### Tool Definitions
- `/test-harness/operator/backend/tools/toolDefinitionsV2.js`
  - Defines the four profile actions
  - Parameter validation schemas
  - Integration with Director API

### Database Migrations
- `/test-harness/operator/supabase/migrations/20250119_add_browser_sessions_metadata.sql`
  - Adds profile-related columns
  - Defines constraints on persist_strategy

## Testing Profile Management

### Local Testing
```bash
# 1. Check profile directory
ls -la ./test-harness/operator/browser-profiles/

# 2. Verify snapshot in Supabase Storage
# Check browser-profiles bucket in Supabase dashboard

# 3. Verify database record
# Query browser_sessions table where name = 'your-profile'
```

### Integration Testing
1. Create profile and login to test site
2. Snapshot the profile
3. Delete local profile directory
4. Restore from cloud
5. Verify still logged in

## Troubleshooting

### Profile Not Saving
- Ensure browser is using profile: Check `currentProfileName`
- Verify profile directory exists and has content
- Check browser launch parameters include `userDataDir`

### Restore Failing
- Check database record exists with correct metadata
- Verify snapshot file exists in Supabase Storage
- Ensure persist_strategy is 'profileDir' (not 'profileSnapshot')
- Check Supabase storage bucket permissions

### Browser Not Staying Logged In
- Some sites require additional factors beyond cookies
- Try capturing profile after fully establishing session
- Ensure profile includes all Chrome subdirectories

### "Unknown browser action: loadProfile" Error
- This occurs if nodeExecutor.js is missing the loadProfile case
- Fixed by adding case 'loadProfile' to executeBrowserAction switch statement
- Ensure both nodeExecutor.js and browserActionService.js have the implementation

## Future Enhancements

### Potential Improvements
1. **Encryption**: Add client-side encryption for profiles
2. **Compression Options**: Support different compression algorithms
3. **Incremental Snapshots**: Only backup changes
4. **Windows Support**: Implement zip-based approach
5. **Profile Metadata**: Track last login time, site list
6. **Automatic Rotation**: Age out old snapshots
7. **Multi-Profile Sessions**: Support multiple concurrent profiles

### API Extensions
- `deleteProfile()` - Remove local and cloud data
- `listCloudProfiles()` - Show available snapshots
- `exportProfile()` - Download profile for sharing
- `importProfile()` - Upload external profile

## Summary

The browser profile management system provides a robust solution for maintaining persistent browser sessions across workflow runs. By leveraging Chrome's native profile functionality and cloud storage, it enables complex automation scenarios on sites that would otherwise require repeated manual authentication.

Key benefits:
- ✅ Complete session persistence (not just cookies)
- ✅ Works with high-security sites
- ✅ Cloud portability via snapshots
- ✅ Simple 5-action API (including unified loadProfile)
- ✅ Automatic state management

The implementation prioritizes simplicity and reliability over advanced features, making it easy to understand, debug, and extend.