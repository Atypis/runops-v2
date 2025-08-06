# BrowserBase Cloud Browser Integration Plan

## Overview

This document outlines the implementation plan for integrating BrowserBase cloud browsers with Director 2.0, enabling workflows to run on scalable cloud infrastructure instead of local browser processes.

## Why BrowserBase?

### Current State: Local Browser Limitations
- **Single Machine Dependency**: Workflows tied to local machine uptime
- **Resource Constraints**: Limited by local CPU/memory
- **Scaling Issues**: Can't run multiple workflows concurrently at scale
- **Reliability**: Local crashes affect workflow execution

### BrowserBase Benefits
- **Cloud Scale**: 100+ concurrent browsers (Developer plan)
- **Session Persistence**: Built-in profile/cookie management
- **Reliability**: Enterprise-grade infrastructure (99.9% uptime)
- **Cost Effective**: $20/month for 100 hours (development)
- **Zero Infrastructure**: No browser management overhead

## Current Director Browser Architecture

```
Frontend (Director UI)
  ↓
DirectorService
  ↓
NodeExecutor.getStagehand() [Lines 1261-1330]
  ↓
Stagehand({ env: 'LOCAL' })
  ↓  
Playwright → Local Chromium Process
```

### Key Integration Point
**File: `backend/services/nodeExecutor.js`**
**Function: `getStagehand()`** 
**Lines: 1261-1330**

This is the ONLY place where browser initialization happens - perfect for clean integration.

## Integration Strategy

### Phase 1: Environment Configuration
Add BrowserBase credentials and mode switching to support both local development and cloud production.

### Phase 2: Stagehand Configuration 
Modify the existing Stagehand initialization to use BrowserBase when in cloud mode.

### Phase 3: Profile Management Adaptation
Adapt existing profile persistence to work with BrowserBase cloud sessions.

### Phase 4: Testing & Validation
Ensure existing workflows work seamlessly on cloud browsers.

## Detailed Implementation

### 1. Environment Variables

**File: `.env`**
```bash
# BrowserBase Configuration
BROWSERBASE_API_KEY=your_browserbase_api_key_here
BROWSERBASE_PROJECT_ID=your_browserbase_project_id_here

# Browser Mode Selection
BROWSER_MODE=local  # or 'cloud' for BrowserBase
```

**File: `.env.example`**
```bash
# BrowserBase Configuration (optional - for cloud browser execution)
BROWSERBASE_API_KEY=your_browserbase_api_key_here  
BROWSERBASE_PROJECT_ID=your_browserbase_project_id_here

# Browser Mode Selection
BROWSER_MODE=local  # Set to 'cloud' to use BrowserBase instead of local browser
```

### 2. Stagehand Configuration Update

**File: `backend/services/nodeExecutor.js`**
**Function: `getStagehand()`** 
**Lines: 1263-1286**

```javascript
const stagehandConfig = {
  env: process.env.BROWSER_MODE === 'cloud' ? 'BROWSERBASE' : 'LOCAL',
  headless: false,
  enableCaching: true,
  modelName: 'o4-mini', // Using o4-mini for browser actions
  modelClientOptions: {
    apiKey: process.env.OPENAI_API_KEY
  },
  verbose: process.env.STAGEHAND_VERBOSE ? parseInt(process.env.STAGEHAND_VERBOSE) : 1,
  logger: (logLine) => {
    // Existing filter logic unchanged
    if (logLine.category === 'stagehand:openai') {
      if (logLine.level === 0 || logLine.message.includes('error')) {
        console.log(`[${logLine.category}] ${logLine.message.substring(0, 200)}...`);
      }
      return;
    }
    const timestamp = new Date().toISOString();
    console.log(`${timestamp}::[${logLine.category || 'stagehand'}] ${logLine.message}`);
  }
};

// BrowserBase-specific configuration
if (process.env.BROWSER_MODE === 'cloud') {
  console.log(`[NodeExecutor] Using BrowserBase cloud browsers`);
  
  // Set BrowserBase credentials
  if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
    throw new Error('BrowserBase credentials required: BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID');
  }
  
  stagehandConfig.apiKey = process.env.BROWSERBASE_API_KEY;
  stagehandConfig.projectId = process.env.BROWSERBASE_PROJECT_ID;
  
  // Handle profile persistence for cloud browsers
  if (profileName && persistStrategy === 'profileDir') {
    stagehandConfig.browserbaseSessionCreateParams = {
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      browserSettings: {
        context: { id: profileName }, // Use profile name as context ID
        viewport: { width: 1920, height: 1080 }
      }
    };
    
    this.currentProfileName = profileName;
    this.persistStrategy = 'cloudSession';
    console.log(`[NodeExecutor] Using BrowserBase context: ${profileName}`);
  }
} else {
  // Existing local browser configuration (unchanged)
  if (profileName && persistStrategy === 'profileDir') {
    const profilePath = path.join(
      this.getBrowserProfilesBasePath(),
      profileName
    );
    
    console.log(`[NodeExecutor] Full profile path: ${profilePath}`);
    
    stagehandConfig.localBrowserLaunchOptions = {
      userDataDir: profilePath,
      preserveUserDataDir: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox", 
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--allow-file-access-from-files",
        "--allow-file-access",
        "--allow-cross-origin-auth-prompt"
      ]
    };
    
    this.currentProfileName = profileName;
    this.persistStrategy = 'profileDir';
    console.log(`[NodeExecutor] Using local profile directory: ${profilePath}`);
  }
}
```

### 3. Profile Management Strategy

#### Local Mode (Existing)
- Uses `/browser-profiles/` directory
- Tar.gz snapshots stored in Supabase Storage
- Direct file system access

#### Cloud Mode (New)
- Uses BrowserBase context IDs
- Session persistence handled by BrowserBase
- No local file system dependency

#### Implementation Details

**Profile Operations Mapping:**
- `loadProfile` → Create BrowserBase session with context ID
- `snapshotProfile` → Store context state in BrowserBase
- Profile switching → Create new session with different context ID

### 4. Error Handling & Fallbacks

```javascript
// Add to nodeExecutor.js initialization
try {
  this.stagehandInstance = new Stagehand(stagehandConfig);
  await this.stagehandInstance.init();
} catch (error) {
  if (process.env.BROWSER_MODE === 'cloud') {
    console.error('[NodeExecutor] BrowserBase initialization failed:', error.message);
    
    // Optional: Fallback to local mode
    if (process.env.BROWSERBASE_FALLBACK_TO_LOCAL === 'true') {
      console.log('[NodeExecutor] Falling back to local browser');
      stagehandConfig.env = 'LOCAL';
      // Remove BrowserBase-specific config
      delete stagehandConfig.apiKey;
      delete stagehandConfig.projectId;
      delete stagehandConfig.browserbaseSessionCreateParams;
      
      this.stagehandInstance = new Stagehand(stagehandConfig);
      await this.stagehandInstance.init();
    } else {
      throw error;
    }
  } else {
    throw error;
  }
}
```

### 5. Package Dependencies

**File: `package.json`**

No additional dependencies required! BrowserBase integration is already included in `@browserbasehq/stagehand: ^2.4.1`.

## Testing Plan

### Phase 1: Basic Integration Testing

1. **Environment Setup**
   - Create BrowserBase account
   - Generate API key and project ID
   - Test both `BROWSER_MODE=local` and `BROWSER_MODE=cloud`

2. **Simple Navigation Test**
   ```javascript
   // Test basic navigation works on both modes
   const testNode = {
     type: 'browser_action',
     config: {
       action: 'navigate',
       url: 'https://example.com'
     }
   };
   ```

3. **Profile Persistence Test**
   - Create profile in local mode
   - Switch to cloud mode  
   - Verify session persistence works

### Phase 2: Workflow Compatibility Testing

1. **Existing Municipal Workflow**
   - Run the German municipal monitoring workflow
   - Verify PDF extraction works in cloud
   - Test session navigation and data extraction

2. **Complex Interactions**
   - Form submissions
   - File downloads
   - Multi-tab operations
   - PDF processing with extractPdf

### Phase 3: Performance & Reliability Testing

1. **Latency Comparison**
   - Measure action execution times: local vs cloud
   - Test with German municipal site (potentially slow)

2. **Long-running Sessions**
   - Test 1+ hour workflows
   - Verify session doesn't timeout
   - Test reconnection handling

3. **Error Scenarios**
   - BrowserBase API key invalid
   - Network connectivity issues
   - Session creation failures

## Migration Strategy

### Phase 1: Parallel Development (Week 1-2)
- Implement cloud mode alongside existing local mode
- No disruption to current workflows
- Feature flag controlled (`BROWSER_MODE`)

### Phase 2: Testing & Validation (Week 3)
- Test existing workflows on cloud browsers
- Performance benchmarking
- Edge case identification

### Phase 3: Production Readiness (Week 4)
- Error handling refinement
- Documentation updates
- Deployment guides

### Phase 4: Gradual Rollout (Week 5+)
- Start with development/testing workflows
- Monitor costs and performance
- Scale based on results

## Cost Management

### Development Phase
- **Free Tier**: 1 browser hour/month (basic testing)
- **Developer Plan**: $20/month, 100 hours (~3 hours/day)

### Production Scaling
- **Startup Plan**: $99/month, 500 hours (~16 hours/day)
- **Overage**: $0.10/hour beyond included hours

### Usage Monitoring
```javascript
// Add to nodeExecutor.js for cost tracking
if (process.env.BROWSER_MODE === 'cloud') {
  const sessionStart = Date.now();
  
  // Log session duration on cleanup
  process.on('exit', () => {
    const duration = (Date.now() - sessionStart) / 1000 / 60; // minutes
    console.log(`[BrowserBase] Session duration: ${duration.toFixed(1)} minutes`);
  });
}
```

## Risk Mitigation

### High Priority Risks

1. **API Rate Limits**
   - **Risk**: BrowserBase session creation limits
   - **Mitigation**: Implement retry logic with exponential backoff
   - **Monitoring**: Track session creation success/failure rates

2. **Network Latency**
   - **Risk**: Slower browser interactions compared to local
   - **Mitigation**: Adjust timeout values; optimize wait strategies
   - **Testing**: Benchmark critical workflows

3. **Cost Overruns**
   - **Risk**: Unexpected usage spikes
   - **Mitigation**: Usage monitoring; session timeout enforcement
   - **Alerting**: Daily/weekly cost reports

### Medium Priority Risks

1. **Session Persistence**
   - **Risk**: Cloud sessions may not persist as expected
   - **Testing**: Extensive profile management testing
   - **Fallback**: Document manual session recreation steps

2. **PDF/File Handling**
   - **Risk**: File operations may behave differently in cloud
   - **Testing**: Comprehensive file upload/download testing
   - **Documentation**: Cloud-specific file handling notes

## Success Metrics

### Technical Metrics
- [ ] 100% existing workflow compatibility
- [ ] <2x latency increase vs local browsers
- [ ] 99%+ session creation success rate
- [ ] Zero data loss in profile persistence

### Business Metrics  
- [ ] Successful German municipal workflow execution
- [ ] <$50/month development costs
- [ ] <5 minutes setup time for new developers
- [ ] 24/7 workflow execution capability

## Implementation Checklist

### Environment Setup
- [ ] Add BrowserBase environment variables
- [ ] Update .env.example with cloud configuration
- [ ] Create BrowserBase account and generate credentials

### Code Changes
- [ ] Modify `nodeExecutor.js` getStagehand() configuration
- [ ] Add cloud/local mode detection logic  
- [ ] Implement BrowserBase session creation parameters
- [ ] Add error handling and fallback mechanisms

### Profile Management
- [ ] Adapt profile loading for cloud sessions
- [ ] Test profile persistence across sessions
- [ ] Document cloud profile limitations/differences

### Testing
- [ ] Basic navigation and interaction tests
- [ ] Municipal workflow end-to-end test
- [ ] Performance benchmarking
- [ ] Error scenario testing

### Documentation
- [ ] Update setup instructions for cloud mode
- [ ] Document cost management strategies
- [ ] Create troubleshooting guide
- [ ] Update deployment documentation

### Deployment
- [ ] Test in staging environment
- [ ] Gradual rollout to production workflows
- [ ] Monitor usage and costs
- [ ] Gather performance feedback

## Next Steps

1. **Create BrowserBase Account**: Get API credentials for development
2. **Environment Setup**: Add variables to development environment  
3. **Basic Integration**: Implement the Stagehand configuration changes
4. **Test Navigation**: Verify simple browser actions work in cloud mode
5. **Profile Testing**: Validate session persistence functionality
6. **Workflow Testing**: Run existing municipal workflow on cloud browsers

Once this foundation is solid, we can consider the scheduling service as a separate enhancement that leverages the cloud browser infrastructure.

## References

- [BrowserBase Documentation](https://docs.browserbase.com/introduction/playwright)
- [Stagehand BrowserBase Integration](https://docs.stagehand.dev/examples/customize_browser)
- Current Implementation: `backend/services/nodeExecutor.js:1261-1330`