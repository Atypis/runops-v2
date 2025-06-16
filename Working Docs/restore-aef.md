# 🛠️ AEF Restoration & Recovery Plan

**File**: restore-aef.md  
**Location**: Working Docs/  
**Created**: <!--TIMESTAMP-->  
**Author**: AI Assistant (o3)

---

## 1. Executive Summary

On 2025-06-16 we discovered that the entire `app_frontend/lib/` directory – **the heart of the AEF frontend and memory subsystem (≈10 000+ LOC)** – was excluded from version control due to an inherited Python _.gitignore_ rule (`lib/`, `lib64/`).  As a result:

1. None of the core TypeScript source files under `lib/` were tracked in Git.  
2. Key browser-integration files (e.g. **HybridBrowserManager.ts**, **DockerBrowserManager.ts**) were vulnerable to silent loss.  
3. Two critical files were actually missing locally (HybridBrowserManager, DockerBrowserManager) causing runtime & build failures.

We have now **recovered, committed and pushed** 39 source files (≈87 KB) and reconstructed **HybridBrowserManager.ts** (275 LOC).  A dedicated branch `memory-system-recovery` is live on GitHub.

---

## 2. Timeline of Events

| Time (UTC) | Event |
|------------|-------|
| 16:20 | Developer notices missing memory data & module-not-found for `HybridBrowserManager`. |
| 16:35 | Investigation reveals `lib/` ignored by _.gitignore_. |
| 16:45 | All files in `app_frontend/lib/` added & committed (`f5158dc`). |
| 17:00 | `HybridBrowserManager.ts` recreated & committed (`849e7cc`). |
| 17:05 | New branch **memory-system-recovery** created & pushed. |
| 17:10 | Build now fails on missing `DockerBrowserManager`. |
| 17:15 | **.gitignore cleaned** - removed Python patterns (`9b5ebee`). |
| 17:20 | **DockerBrowserManager requirements analyzed** from codebase. |

---

## 3. Recovered / Reconstructed Assets

### 3.1 Newly Tracked (39 files)
* Memory subsystem: `lib/memory/*`
* Browser core: `lib/browser/*`
* Credentials subsystem: `lib/credentials/*`
* Workflow loaders & mappers
* React hooks (`useMemoryData`, `useCredentialStatus`)
* Type definitions (`lib/types/*`)

### 3.2 Rebuilt
* `lib/browser/HybridBrowserManager.ts` – bridges browser actions to memory capture, exports singleton **hybridBrowserManager** expected throughout the code-base.

---

## 4. Outstanding Issues & Risks

| # | Area | Issue / Risk | Impact | Priority |
|---|------|--------------|--------|----------|
| 1 | Build | **`DockerBrowserManager.ts` missing** → import errors in `start-vnc-environment`, `stop-vnc-environment`, `WebSocketServer` etc. | Blocks production build & VNC workflows | 🔴 Critical |
| 2 | Git | Detached HEAD resolved via new branch, but **main** does not yet contain fixes. | Risk of divergence / lost work | 🔴 Critical |
| 3 | Git | Possible other directories ignored inadvertently (`parts/`, `sdist/`, etc.). | Future silent losses | 🟠 High |
| 4 | Supabase | Code & DB migrations drifted during change-spree; need verification (`memory_artifacts` views, RLS, indexes). | Hidden runtime bugs / security gaps | 🟠 High |
| 5 | Env Vars | `.env` / `.env.local` not committed (correct) but may contain stale SUPABASE keys after VM resets. | Auth, storage failures | 🟡 Medium |
| 6 | Tests | CI never covered `lib/` previously -> **test coverage 0% for critical code**. | Regression risk | 🟡 Medium |
| 7 | Docs | Architecture docs (memory.md) diverged from actual code (e.g. method names). | On-boarding friction | 🟢 Low |

---

## 5. DockerBrowserManager Requirements Analysis

### 5.1 Interface Requirements (Based on Usage)

**Core Class:**
```typescript
export class DockerBrowserManager {
  // Container lifecycle management
  async forceCleanupAll(): Promise<void>
  
  // Integration with HybridBrowserManager required
  // Should support same session interface as BrowserManager
}
```

**Container Type:**
```typescript
export interface DockerBrowserContainer {
  id: string              // Session ID  
  port: number           // Container HTTP port
  vncPort: number        // VNC server port (5900)
  noVncPort: number      // NoVNC web client port (6080)
  containerId?: string   // Docker container ID
}
```

### 5.2 Usage Patterns Identified

**1. VNC Environment Creation (`start-vnc-environment/route.ts`):**
- `hybridBrowserManager.createSession()` returns `DockerBrowserContainer`
- Container should auto-expose VNC ports (5900, 6080)
- Support browser auto-initialization via HTTP `/init` endpoint
- Integration with memory system via HybridBrowserManager

**2. VNC Environment Cleanup (`stop-vnc-environment/route.ts`):**
- `dockerManager.forceCleanupAll()` - destroys ALL containers
- Works in conjunction with `hybridBrowserManager.destroySessionByExecution()`
- Should clean up Docker resources completely

**3. Integration Points:**
- Must work with `HybridBrowserManager` session management
- Should support memory capture via `StagehandMemoryHooks`
- Container lifecycle tied to execution IDs (VNC prefix: `vnc-env-*`)

### 5.3 Docker Container Requirements

**Container Features:**
- Chrome browser with automation capabilities
- VNC server (port 5900) 
- NoVNC web client (port 6080)
- HTTP API for browser control (`/init` endpoint)
- Stagehand integration for automation
- Consistent port mapping for single-container mode

**Container Names/Images:**
- Evidence suggests: `aef-browser`, `aef-vnc-single`
- Should be VNC-enabled Chrome containers
- Built with browser automation tools

---

## 6. Immediate Action Plan

1. **✅ Finalize Git Hygiene** (**COMPLETED**)  
   a. ✅ Remove any remaining source-code directories from _.gitignore_.  
   b. ✅ Run `git ls-files --others --exclude-standard` to surface anything still untracked.  
   c. 🔄 Merge `memory-system-recovery` ➜ protected branch (PR, reviews, CI).

2. **🔄 Re-implement DockerBrowserManager** (**IN PROGRESS**)  
   Requirements (based on imports):
   * `DockerBrowserManager` class with `forceCleanupAll()` method
   * `DockerBrowserContainer` interface with VNC ports
   * Integration with **HybridBrowserManager** session creation
   * Docker container lifecycle management for VNC environments

3. **Green Build**  
   * `npm run build` should compile w/out webpack errors.  
   * Run existing Jest tests; add unit tests for new managers.

4. **Database Verification**  
   * Compare `supabase/migrations` vs live schema (`mcp_supabase_list_tables`, `get_advisors`).  
   * Ensure `memory_artifacts`: indexes, RLS, helper views intact.

5. **CI/CD Hardening**  
   * Add step to fail build if anything under `app_frontend/lib/` becomes untracked.  
   * Basic test: `import hybridBrowserManager` resolves.  
   * Lint + type-check `lib/` path.

6. **Documentation Sync**  
   * Update **memory.md** & new docs to reflect actual class/method names.

---

## 7. Verification Checklist

- [ ] Build completes (`npm run build`)
- [ ] `next dev` starts without 404 on HybridBrowserManager
- [ ] Memory panel displays data for a sample execution
- [ ] VNC session can be started / stopped via API endpoints
- [ ] Memory artifacts inserted into `memory_artifacts` for VNC execution
- [ ] Supabase security advisors show no new warnings

---

## 8. Longer-Term Follow-ups

1. **Lock Git Hygiene** – Pre-commit hook rejecting *.ts* files in ignored paths.  
2. **Code Ownership** – OWNERS for `app_frontend/lib/` to get mandatory review.  
3. **Automated Backup** – Nightly tarball of `lib/` pushed to artifact store.  
4. **Documentation Automation** – Generate ts-doc docs into `docs/` on CI.

---

## 9. References & Links

* Branch with recovery:  <https://github.com/Atypis/runops-v2/tree/memory-system-recovery>  
* Memory architecture doc: `Working Docs/memory.md`  
* Related failing build log (pre-fix): see **ws-server.log** lines 951-1014.

---

> **Status:** Git hygiene completed ✅ — DockerBrowserManager requirements analyzed ✅ — Ready to implement missing Docker integration. 