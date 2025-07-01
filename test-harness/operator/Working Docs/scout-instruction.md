# Scout Deployment Guide for Directors

## What is a Scout?

Scouts are autonomous Browser-Use agents configured for **reconnaissance missions**. They explore web UIs to discover stable selectors, test interaction patterns, and report back technical intelligence that Directors can use to build robust automation workflows.

## Key Capabilities

### 1. **Autonomous Web Navigation**
- Scouts can navigate websites independently
- They understand context and adapt to different UI states
- They can handle login flows, multi-step processes, and dynamic content

### 2. **Enhanced DOM Visibility**
Scouts see **33 DOM attributes** (vs. standard 13), including:
- `id` - HTML element IDs (even seemingly random ones)
- `data-testid`, `data-qa`, `data-test` - Explicit test hooks
- `href` - Link destinations
- `data-automation`, `data-selenium` - Automation markers
- `aria-labelledby`, `aria-describedby` - Extended accessibility
- And 15+ more attributes crucial for stable automation

### 3. **Intelligent Analysis**
- Pattern recognition across similar UI elements
- Selector stability testing
- Timing measurement for operations
- Edge case discovery

### 4. **Natural Language Reporting**
- Reports are AI-readable, perfect for Director consumption
- Includes discovered selectors, patterns, and recommendations
- Provides ready-to-use selector strategies

## How to Deploy a Scout

### Simple Deployment (Coming Soon)
```javascript
// In your Director workflow builder:
const scoutReport = await deployScout({
  mission: "Find all selectors for Airtable's filter system",
  url: "https://airtable.com/appXXX" // Optional
});
```

### Current Manual Deployment
For now, request scout deployment through the operator with:
```
"Deploy a scout to explore [target] and find [objectives]"
```

## Scout Mission Examples

### 1. **UI Pattern Discovery**
```
Mission: "Explore Gmail's compose interface and document all reliable selectors for email composition, including To, CC, BCC, Subject, Body, and Send button. Test what happens with attachments."
```

### 2. **Form Analysis**
```
Mission: "Analyze the login form at example.com. Find stable selectors for username, password, remember me checkbox, and submit button. Also check for any 2FA flows."
```

### 3. **Dynamic Content Investigation**
```
Mission: "Investigate how Airtable's filter panel works. Document selectors for opening filters, adding conditions, selecting fields, choosing operators, and applying filters. Measure how long each operation takes."
```

### 4. **State Detection**
```
Mission: "Explore different states of a shopping cart. Find selectors that indicate empty cart, items in cart, and checkout button availability. Document how to detect each state reliably."
```

## What Scouts Report Back

### Selector Discoveries
```
Reliable selectors found:
- Submit button: #login-submit (ID - highest priority)
- Email input: [data-testid="email-input"] (test hook - very stable)
- Password: input[type="password"][name="password"] (semantic - good fallback)
```

### Timing Requirements
```
Operation timings:
- Filter panel opens: 200ms (wait required)
- Results update after filter: 800ms
- Page navigation: 2-3 seconds
```

### Pattern Recognition
```
Consistent patterns:
- All form inputs have data-qa attributes
- Buttons use aria-label for actions
- Dynamic IDs follow pattern: "button-{action}-{timestamp}"
```

### Edge Cases
```
Potential issues:
- Login button disabled until both fields filled
- ReCAPTCHA appears after 3 failed attempts
- Session timeout redirects after 30 minutes
```

## Best Practices

### 1. **Be Specific in Missions**
❌ "Explore the website"
✅ "Find all selectors for creating a new record in the CRM, including all form fields and validation messages"

### 2. **Request Stability Testing**
Include phrases like:
- "Test if selectors work across different states"
- "Verify selectors remain stable after page refresh"
- "Check if IDs are dynamic or static"

### 3. **Ask for Timing Measurements**
- "Measure how long it takes for X to appear"
- "Note any loading delays"
- "Identify when the page is fully interactive"

### 4. **Specify Output Format**
- "List selectors in order of reliability"
- "Group findings by UI component"
- "Prioritize data-testid attributes when available"

## Technical Details

- **Model**: Gemini 2.5 Pro (optimized for web understanding)
- **Temperature**: 1.0 (balanced exploration/consistency)
- **Vision**: Enabled (scouts can see screenshots)
- **Max Steps**: 30 (configurable per mission)

## Integration with Director Workflows

Scout reports integrate seamlessly with Director's workflow design:

1. **Director identifies knowledge gap** → "How do I interact with this filter UI?"
2. **Director deploys Scout** → Specific reconnaissance mission
3. **Scout explores and reports** → Detailed findings with selectors
4. **Director uses intelligence** → Builds workflow with discovered selectors

## Example Scout Report

```
# Scout Reconnaissance Report

**Mission**: Find all selectors for Airtable filter UI
**Status**: Successful
**Steps Taken**: 18

## Key Discoveries

### Filter Button
- Primary: [data-testid="view-filter-button"]
- Fallback: button[aria-label="Filter"]
- Click delay needed: 200ms for panel to open

### Add Condition Button
- Reliable: [data-testid="add-filter-condition"]
- Alternative: button.addConditionButton
- Becomes visible after panel opens

### Field Selector Dropdown
- Best: [data-automation="filter-field-select"]
- Good: div[role="combobox"][aria-label="Choose field"]
- Dynamic ID pattern: select-{timestamp}

### Timing Requirements
- Panel animation: 200ms
- Dropdown populate: 100ms
- Filter apply: 500-800ms

### Edge Cases
- Empty state shows different UI
- Maximum 10 conditions allowed
- Keyboard navigation available (Tab/Arrow keys)
```

## Real-World Scout Results

### Google Search (Success)
Scout discovered hidden attributes:
- Search input: `id="APjFqb"` ✅ (normally hidden!)
- Google Search button: `name="btnK"`
- I'm Feeling Lucky: `id="gbqfbb"` ✅ (normally hidden!)

### Airtable Login (Success)
Scout found test automation hooks:
- Email input: `id="emailLogin"`, `data-testid="emailInput"` ✅
- Both ID and test hook were invisible without Scout enhancement

### OpenAI Login (Challenges)
Scout encountered:
- Cloudflare bot protection
- Dynamic React IDs: `radix-:R1ab9svffa:` (changes every load)
- No stable test attributes

This intelligence helps Directors understand site automation-friendliness!

## Technical Implementation

- **Model**: Gemini 2.5 Pro (gemini-2.5-pro)
- **Temperature**: 1.0
- **API**: Pre-configured, no setup needed
- **File Output**: Saves to `results.md` in agent's temp directory

## Future Enhancements

- **Parallel Scouts**: Deploy multiple scouts simultaneously
- **Scout Memory**: Remember patterns across missions
- **Continuous Monitoring**: Periodic re-scouting for UI changes
- **Direct Integration**: `scout()` function in Director's workflow builder

---

Remember: Scouts are your eyes into web pages. They see what you cannot and report back the technical details needed to build bulletproof automations!

## Quick Start: Creating Scout Mission Files

When you need specific reconnaissance as a Director, create a focused scout mission file:

### 1. Basic Scout Mission Template

```python
#!/usr/bin/env python3
import asyncio
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scout_engine import ScoutEngine

async def run_reconnaissance():
    scout = ScoutEngine()  # Uses Gemini 2.5 Pro by default
    
    mission = '''
    YOUR MISSION TITLE HERE
    
    OBJECTIVE: What you need to discover
    
    CREDENTIALS (if needed):
    - Login method: 
    - Username: 
    - Password: 
    
    RECONNAISSANCE TARGETS:
    [List specific things to investigate]
    
    DELIVERABLE: Save findings to 'results.md' using write_file action
    '''
    
    result = await scout.deploy_scout(
        mission=mission,
        target_url='https://target-site.com',
        max_steps=30
    )
    
    print(f"Scout Report: {result}")

if __name__ == "__main__":
    asyncio.run(run_reconnaissance())
```

### 2. Key Points for Effective Missions

- **Be Specific**: List exact selectors, timings, and patterns you need
- **Include Credentials**: Provide login details if authentication required  
- **Request File Output**: Always ask scout to save findings to 'results.md'
- **Focus Areas**: DOM selectors, timing measurements, state detection, edge cases
- **Structured Output**: Request JSON format for easy parsing

### 3. Run Your Scout

```bash
cd /path/to/scouts
python3 your_scout_mission.py
```

The scout will use Browser-Use with enhanced DOM visibility (33 attributes) to gather intelligence and save findings for your workflow design.