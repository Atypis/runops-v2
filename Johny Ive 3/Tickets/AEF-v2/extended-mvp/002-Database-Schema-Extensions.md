# 🗄️ Ticket 002: Database Schema Extensions

## 📋 Summary
Extend the existing Supabase database schema to support AEF execution tracking, state management, audit logging, and real-time monitoring without breaking existing functionality.

## 🎯 Acceptance Criteria
- [ ] New database tables created for AEF execution tracking
- [ ] Existing tables preserved and backward compatible
- [ ] Row Level Security (RLS) policies configured for all new tables
- [ ] Database migrations created and tested
- [ ] Indexes optimized for execution queries
- [ ] Real-time subscription capabilities enabled

## 📝 Implementation Details

### New Tables Required
```sql
-- Core execution tracking
aef_executions (
  id UUID PRIMARY KEY,
  sop_id UUID REFERENCES sops(id),
  user_id UUID,
  status execution_status,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  current_step_id VARCHAR,
  execution_context JSONB,
  browser_session_id VARCHAR,
  config JSONB
);

-- Detailed step-by-step logging
aef_execution_logs (
  id UUID PRIMARY KEY,
  execution_id UUID REFERENCES aef_executions(id),
  step_id VARCHAR,
  event_type log_event_type,
  timestamp TIMESTAMP,
  data JSONB,
  browser_state JSONB
);

-- Human checkpoint management
aef_checkpoints (
  id UUID PRIMARY KEY,
  execution_id UUID REFERENCES aef_executions(id),
  step_id VARCHAR,
  checkpoint_type checkpoint_type,
  status checkpoint_status,
  user_response JSONB,
  created_at TIMESTAMP,
  resolved_at TIMESTAMP
);

-- Browser session management
aef_browser_sessions (
  id VARCHAR PRIMARY KEY,
  user_id UUID,
  status browser_session_status,
  created_at TIMESTAMP,
  last_active TIMESTAMP,
  session_data JSONB
);
```

### Custom Types (Enums)
```sql
CREATE TYPE execution_status AS ENUM (
  'idle', 'running', 'paused', 'completed', 'error', 'cancelled'
);

CREATE TYPE log_event_type AS ENUM (
  'step_started', 'step_completed', 'step_failed', 
  'browser_action', 'user_input', 'checkpoint_reached',
  'loop_iteration', 'decision_made', 'error_occurred'
);

CREATE TYPE checkpoint_type AS ENUM (
  'before_execution', 'after_execution', 'on_error',
  'manual_review', 'data_validation', 'custom'
);

CREATE TYPE checkpoint_status AS ENUM (
  'pending', 'approved', 'rejected', 'skipped', 'timeout'
);

CREATE TYPE browser_session_status AS ENUM (
  'active', 'idle', 'terminated', 'error'
);
```

## 🤔 Key Design Decisions Needed

### 1. **Execution Context Storage**
**Decision Required**: How much execution context should be stored in JSONB?
- **Option A**: Minimal (step IDs and basic state only)
- **Option B**: Complete (full variable state, browser state, etc.)
- **Option C**: Configurable (user chooses level of detail)

**Impact**: Affects database size, query performance, and debugging capabilities

### 2. **Log Retention Strategy**
**Decision Required**: How long should execution logs be retained?
- **Option A**: Forever (full audit trail)
- **Option B**: Time-based (30/90/365 days)
- **Option C**: Size-based (last N executions per user)

**Impact**: Affects storage costs and compliance capabilities

### 3. **Real-time Update Frequency**
**Decision Required**: How often should execution state be persisted?
- **Option A**: Every step completion
- **Option B**: Time-based intervals (every 5-10 seconds)
- **Option C**: Event-driven (checkpoints, errors, user actions)

**Impact**: Affects database load and real-time accuracy

### 4. **Browser Session Sharing**
**Decision Required**: Should browser sessions be shareable across executions?
- **Option A**: One session per execution (isolated)
- **Option B**: Persistent sessions per user (shared state)
- **Option C**: Session pools (resource optimization)

**Impact**: Affects resource usage and state isolation

### 5. **Checkpoint Timeout Handling**
**Decision Required**: How should checkpoint timeouts be handled?
- **Option A**: Database-level timeouts with automatic cleanup
- **Option B**: Application-level timeout management
- **Option C**: User-configurable timeout policies

**Impact**: Affects user experience and resource cleanup

### 6. **Historical Execution Data**
**Decision Required**: Should old executions be archived or deleted?
- **Option A**: Keep everything (full history)
- **Option B**: Archive to cold storage after N days
- **Option C**: Delete after retention period

**Impact**: Affects compliance, analytics, and storage costs

## 📦 Dependencies
- Ticket 001 (AEF Data Models) for type definitions
- Current Supabase schema understanding
- RLS policy patterns from existing tables

## 🧪 Testing Requirements
- [ ] Migration scripts run without errors
- [ ] All indexes perform efficiently under load
- [ ] RLS policies prevent unauthorized access
- [ ] Real-time subscriptions work correctly
- [ ] Rollback procedures tested and documented

## 📚 Documentation Needs
- [ ] Database schema documentation
- [ ] Migration procedure documentation  
- [ ] RLS policy explanations
- [ ] Query optimization guidelines
- [ ] Backup and recovery procedures

## 🔒 Security Considerations
- [ ] All new tables have proper RLS policies
- [ ] Sensitive execution data (credentials) properly encrypted
- [ ] Audit trail cannot be tampered with
- [ ] Browser session data secured

---
**Priority**: High  
**Estimated Time**: 4-5 days  
**Dependencies**: Ticket 001  
**Blocks**: Tickets 003, 007, 008 