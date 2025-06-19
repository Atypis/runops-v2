# Test Harness: Rapid Iteration Plan

## 🎯 Mission
Build a lean, fast iteration environment to develop and validate our 9-primitive system until we can execute the Gmail→Airtable CRM workflow with 90%+ reliability.

## 🏁 Desired End State

### What Success Looks Like
1. **Complete primitive set** that works like LEGO blocks - composable, reliable, predictable
2. **Gmail→Airtable workflow** executing with 90%+ success rate 
3. **Proven patterns** for common automation challenges (auth, loops, error handling)
4. **Clear migration path** to production AEF with all learnings incorporated

### The 9 Canonical Primitives We're Validating

**Execution Layer (4):**
- `browser_action` - goto, click, type
- `browser_query` - extract, observe  
- `transform` - pure data manipulation
- `cognition` - AI-powered reasoning

**Control Layer (4):**
- `sequence` - serial execution
- `iterate` - loops with state
- `route` - multi-way branching
- `handle` - error boundaries

**State Layer (1):**
- `memory` - explicit state management

## 🚀 Why This Test Harness?

### Speed of Iteration
- **10-second feedback loops** vs 5-minute Docker rebuilds
- **Live browser** you can see and debug
- **Hot reload** with `--watch` flag
- **Visual dashboard** for triggering individual nodes

### Focus on What Matters
- **No infrastructure complexity** - just primitives and logic
- **Direct StageHand/OpenAI integration** - see exactly what works/fails
- **Isolated testing** - run single nodes or full workflows
- **State visibility** - watch data flow in real-time

## 📋 Development Process

### Phase 1: Primitive Validation ✅
- [x] Set up test environment with frontend
- [x] Implement all 9 primitives in server
- [x] Connect to StageHand with GPT-4o-mini
- [x] Basic Gmail login flow working

### Phase 2: Workflow Robustness (Current)
- [ ] Handle Gmail 2FA and captchas gracefully
- [ ] Reliable email extraction with pagination
- [ ] Robust investor classification (reduce false positives/negatives)
- [ ] Airtable record creation/update with proper error handling
- [ ] Idempotency - don't process same email twice

### Phase 3: Pattern Discovery
- [ ] Identify missing primitives (if any)
- [ ] Document composition patterns that work
- [ ] Build reusable sub-workflows (login, search, extract)
- [ ] Error recovery strategies

### Phase 4: Production Migration
- [ ] Generate migration guide from test learnings
- [ ] Update production AEF with validated primitives
- [ ] Port successful patterns and compositions
- [ ] Performance optimizations (caching, parallel execution)

## 🔧 How to Use This Test Harness

### Daily Workflow
1. Start Chrome and server: `npm start`
2. Open dashboard: http://localhost:3001
3. Run individual nodes to test specific behaviors
4. Run full workflow to test end-to-end
5. Check logs and state viewer for issues
6. Iterate on problematic nodes in isolation

### Testing Strategy
- **Unit test primitives**: Each primitive should work in isolation
- **Integration test compositions**: Common patterns should be reliable
- **End-to-end test workflow**: Full Gmail→Airtable should hit 90%+

### Key Files
- `server.js` - Primitive implementations
- `frontend/app.js` - Test workflows and UI
- `test-*.js` - Focused test scripts
- `primitives.md` - Canonical primitive definitions

## 📊 Success Metrics

### Primitive Level
- Each primitive has clear input/output contract
- Primitives are truly orthogonal (no overlap)
- Error messages are actionable

### Workflow Level
- Gmail login: 95%+ success rate
- Email extraction: 90%+ accuracy
- Investor classification: 85%+ precision
- Airtable updates: 95%+ success rate
- End-to-end: 90%+ success rate

### Development Speed
- New node implementation: <5 minutes
- Workflow modification: <2 minutes  
- Debug cycle: <30 seconds

## 🚨 Current Blockers & Solutions

### Known Issues
1. **Gmail 2FA** - Need handle primitive with human escalation
2. **Dynamic selectors** - StageHand AI helps but needs refinement
3. **State management** - Complex data flows need better patterns
4. **Error recovery** - Need consistent retry/fallback strategies

### Next Experiments
1. Test `handle` primitive with Gmail 2FA scenario
2. Build sub-workflow library (reusable login, search patterns)
3. Implement workflow persistence/resume
4. Add performance metrics to each primitive

## 🎓 Learnings So Far

### What's Working
- 9-primitive system is expressive enough
- StageHand + GPT-4o-mini handles dynamic content well
- Visual dashboard accelerates debugging
- Composition over configuration approach

### What Needs Work
- Memory primitive needs better scope management
- Route primitive needs better condition evaluation
- Need patterns for common sub-workflows
- Error messages need more context

## 🏗️ Migration to Production

### When We're Ready
- [ ] All primitives battle-tested
- [ ] Gmail→Airtable at 90%+ reliability
- [ ] Documented patterns for common scenarios
- [ ] Performance baseline established

### How We'll Migrate
1. **Primitive Layer**: Port the 9 primitives as new node types
2. **Adapter Layer**: Map old nodes to new primitives
3. **Workflow Converter**: Transform existing JSONs to new format
4. **Gradual Rollout**: New workflows use new system, old ones migrate over time

## 💡 Key Insight

**The test harness isn't just for testing - it's our laboratory for discovering the right abstractions.**

Every hack we need in here teaches us what's missing from our primitives. Every composition pattern that emerges shows us how developers will actually use the system. Every reliability issue we fix here saves hours of debugging in production.

**This is how we build the right thing, not just something that works.**

---

*Remember: Fast iteration → Quick learning → Better system*