# "Show Me" Mode: Interactive Workflow Learning

## Core Concept
Transform workflow creation from "describing what to do" to "showing how it's done" - where users demonstrate workflows in real-time while the Director watches, learns, and asks clarifying questions.

## User Experience
```
Director: "Show me how you complete this task. I'll watch and learn!"
User: [Starts clicking through the workflow]
Director: "I see you filtered by 'Pending' - do you always use this filter, or are there other statuses you sometimes check?"
User: "Sometimes I also filter by 'Urgent'"
Director: [Builds robust workflow handling both cases]
```

## Technical Implementation

### Using Current Architecture (Playwright)
```javascript
// Inject monitoring into controlled browser
page.on('framenavigated', url => recordNavigation(url));
await page.evaluateOnNewDocument(() => {
  document.addEventListener('click', captureClick, true);
  document.addEventListener('input', captureTyping, true);
});
```

### Key Features
1. **Real-time Capture**: Every click, type, and navigation recorded
2. **Intelligent Analysis**: AI understands intent, not just actions
3. **Interactive Questions**: Director asks about edge cases mid-demo
4. **Pattern Recognition**: Detects loops and suggests optimizations
5. **Multi-selector Strategy**: Captures robust selectors for reliability

## Benefits
- **Natural**: Users show instead of describe
- **Comprehensive**: Catches edge cases through questions
- **Efficient**: Converts manual steps to optimized workflows
- **Intuitive**: Like teaching a colleague over their shoulder

## Quick Win Implementation
Add recording mode to existing Director:
- User clicks "Show Me" button
- Director enters observation mode
- Captures all browser interactions
- Builds workflow from demonstration
- Asks clarifying questions in real-time

This transforms the Director from a "tell me what to do" system into a "show me how you do it" learning system.