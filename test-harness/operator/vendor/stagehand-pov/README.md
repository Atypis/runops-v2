# Stagehand POV (Page-Object-View) Extraction

## Overview

This vendor module contains extracted and modified POV generation functionality from [Stagehand](https://github.com/browserbase/stagehand), adapted for Director 2.0's tab inspection needs.

## What This Is

- **Purpose**: Generate LLM-friendly page representations with stable DOM selectors
- **Source**: Extracted from Stagehand v1.x accessibility tree processing
- **Modifications**: Enhanced to include DOM selectors for deterministic workflow building

## Key Modifications

### Original Stagehand Output
```
[0-123] button: Submit
[1-456] textbox: Email
```

### Our Enhanced Output
```
[0-123] button#submit-btn[data-testid="login"][data-qa="submit"]: Submit
[1-456] input#email[type="email"][data-cy="email-input"]: Email
```

## What We Extracted

From Stagehand's ~1500 line `lib/a11y/utils.ts`, we extracted only:
- `formatSimplifiedTree()` - Core formatting function
- `cleanText()` - Text normalization
- Tree processing utilities
- Relevant type definitions

Total: ~200 lines of focused POV generation code

## What We Added

1. **Scout Attribute Discovery**: 20 battle-tested automation attributes
   - Test IDs: `data-testid`, `data-test`, `data-cy`, `data-qa`, `data-pw`
   - Automation: `data-automation`, `data-automation-id`, `data-selenium`
   - Core: `id`, `href`, `type`, `name`
   - Accessibility: `aria-labelledby`, `aria-describedby`, `aria-controls`
   - Framework: `formcontrolname`, `autocomplete`
   - Component: `data-component`, `data-role`, `data-field`, `data-track`

2. **Selector Formatting**: Inline selector inclusion for Director's consumption

## Usage

```typescript
import { inspectTab } from './vendor/stagehand-pov';

// Get enhanced POV with selectors
const pov = await inspectTab(page);

// Output includes selectors inline:
// [0-123] button#submit-btn[data-qa="submit"]: Submit
```

## Attribution

- Original code from [Stagehand](https://github.com/browserbase/stagehand) by Browserbase
- Licensed under MIT License (see LICENSE file)
- Modifications for Director 2.0 by RunOps team

## ⚠️ IMPORTANT: Pure JavaScript Implementation

**MAINTENANCE NOTE**: This vendor module is **pure JavaScript** - no TypeScript compilation needed or supported.

### What Happened
- Originally extracted from Stagehand's TypeScript codebase
- Compiled to JavaScript and manually modified for Director 2.0's two-tool approach
- **TypeScript source removed** to prevent confusion and accidental recompilation

### Current Status
- **Working Code**: `dist/src/*.js` files (manually maintained, committed to git)
- **No TypeScript**: Removed to prevent sync issues and accidental compilation
- **Imports**: Code imports directly from `dist/src/*.js`

### If You Need to Modify
1. **Edit the JavaScript files directly** in `dist/src/`
2. **Test your changes** with the tab inspection tools
3. **Commit the JavaScript changes** to git
4. **Update this README** with your changes

### Why JavaScript Only?
- **Simplicity**: Single source of truth, no compilation step
- **Clarity**: No confusion about which files are authoritative
- **Safety**: Impossible to accidentally overwrite working code
- **Maintenance**: Direct modification of working code

## Why Vendor?

We chose to vendor this code because:
1. We need specific modifications for RPA selector discovery
2. The POV generation is self-contained (~200 lines)
3. We want stability without upstream breaking changes
4. Clear separation of third-party vs our code