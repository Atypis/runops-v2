# 🎨 Ticket 004: UI Framework Setup - Third View Mode

## 📋 Summary
Implement the foundational UI framework for the AEF Control Center as a third view mode alongside the existing List and ReactFlow views, establishing the tri-panel layout and basic navigation.

## 🎯 Acceptance Criteria
- [ ] Third view mode toggle added to SOP page header (List | Flow | **AEF**)
- [ ] AEF Control Center component created with tri-panel layout
- [ ] Smooth transitions between all three view modes
- [ ] Responsive design works on different screen sizes
- [ ] No breaking changes to existing List/Flow view functionality
- [ ] Loading states and error handling implemented

## 📝 Implementation Details

### Files to Create/Modify
```
components/aef/
├── AEFControlCenter.tsx         # Main control center container
├── ExecutionPanel.tsx           # Left panel (40% width)
├── BrowserPanel.tsx             # Right panel (40% width)  
├── ExecutionLog.tsx             # Bottom panel (20% height)
└── AEFViewToggle.tsx            # Enhanced view mode switcher

app/sop/[sopId]/page.tsx         # Add AEF view mode integration
```

### Layout Architecture
```typescript
// Tri-panel responsive layout
<div className="aef-control-center h-full flex flex-col">
  <div className="top-panels flex-1 flex">
    <ExecutionPanel className="w-2/5 border-r" />
    <BrowserPanel className="w-2/5" />
  </div>
  <ExecutionLog className="h-1/5 border-t" />
</div>
```

### Component Structure
```typescript
// AEF Control Center props
interface AEFControlCenterProps {
  sopData: SOPDocument;
  onTransformToAEF?: () => void;
  executionId?: string;
  isLoading?: boolean;
}

// View mode management
type ViewMode = 'list' | 'flow' | 'aef';

// Enhanced view toggle
interface AEFViewToggleProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  sopData: SOPDocument;
  isAEFEnabled?: boolean;
}
```

## 🤔 Key Design Decisions Needed

### 1. **View Mode State Management**
**Decision Required**: How should view mode state be managed?
- **Option A**: Local component state (resets on page refresh)
- **Option B**: URL query parameters (persists across refreshes)
- **Option C**: User preferences in database (persists across sessions)

**Impact**: Affects user experience and state persistence

### 2. **AEF View Access Control**
**Decision Required**: When should the AEF view mode be available?
- **Option A**: Always available (even for non-transformed SOPs)
- **Option B**: Only after SOP transformation to AEF
- **Option C**: Progressive enhancement (disabled → transform → enabled)

**Impact**: Affects user discovery and workflow progression

### 3. **Panel Resizing Strategy**
**Decision Required**: Should panels be resizable by users?
- **Option A**: Fixed layout (40/40/20 split)
- **Option B**: Resizable with drag handles
- **Option C**: Preset layouts with quick switcher

**Impact**: Affects user customization and implementation complexity

### 4. **Mobile/Tablet Experience**
**Decision Required**: How should AEF view work on smaller screens?
- **Option A**: Horizontal scroll for panels
- **Option B**: Stacked layout with tabs
- **Option C**: Simplified single-panel mobile view

**Impact**: Affects mobile usability and responsive design complexity

### 5. **Empty State Design**
**Decision Required**: What should be shown before SOP transformation?
- **Option A**: Empty panels with "Transform to AEF" prompt
- **Option B**: Preview of what AEF will look like
- **Option C**: Guided tour explaining AEF capabilities

**Impact**: Affects user onboarding and feature discovery

### 6. **Loading State Strategy**
**Decision Required**: How should loading states be handled across panels?
- **Option A**: Full-screen loading overlay
- **Option B**: Individual panel loading states
- **Option C**: Skeleton screens with progressive loading

**Impact**: Affects perceived performance and user experience

### 7. **Error State Handling**
**Decision Required**: How should errors be displayed in the tri-panel layout?
- **Option A**: Error overlay covering entire AEF view
- **Option B**: Panel-specific error states
- **Option C**: Toast notifications with panel-specific fallbacks

**Impact**: Affects error recovery UX and debugging

## 📦 Dependencies
- Ticket 003 (API Infrastructure) for data fetching
- Current SOP page structure understanding
- Existing view mode toggle implementation
- CSS framework and design system

## 🧪 Testing Requirements
- [ ] View mode switching works correctly
- [ ] Responsive design on multiple screen sizes
- [ ] Loading and error states display properly
- [ ] No regressions in existing List/Flow views
- [ ] Keyboard navigation and accessibility
- [ ] Performance testing with large SOPs

## 📚 Documentation Needs
- [ ] Component API documentation
- [ ] Layout and styling guidelines
- [ ] Responsive design breakpoint documentation
- [ ] Accessibility features documentation
- [ ] Integration guide for AEF components

## ♿ Accessibility Considerations
- [ ] Proper ARIA labels for panel regions
- [ ] Keyboard navigation between panels
- [ ] Screen reader support for view mode switching
- [ ] High contrast mode compatibility
- [ ] Focus management during mode transitions

## 🎨 Design System Integration
- [ ] Consistent with existing component styling
- [ ] Proper use of design tokens (colors, spacing, typography)
- [ ] Dark mode support
- [ ] Animation and transition guidelines
- [ ] Icon usage standards

---
**Priority**: High  
**Estimated Time**: 4-5 days  
**Dependencies**: Ticket 003  
**Blocks**: Tickets 005, 009, 012 