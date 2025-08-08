/**
 * Minimal type definitions extracted from Stagehand for POV generation
 * Original: https://github.com/browserbase/stagehand/blob/main/types/context.ts
 */
// Scout's battle-tested automation attributes + real-world web attributes
export const AUTOMATION_ATTRIBUTES = [
    // Test Framework Hooks (Priority 1)
    "data-testid", "data-test", "data-cy", "data-qa", "data-pw",
    "data-test-id", "data-automation", "data-automation-id", "data-selenium",
    // Core Identifiers (Priority 2)
    "id",
    // Component/Role Markers (Priority 3)  
    "data-component", "data-role", "data-field",
    // Accessibility Hooks (Priority 4) - EXPANDED
    "aria-label", "aria-labelledby", "aria-describedby", "aria-controls",
    // Navigation & Forms (Priority 5)
    "href", "formcontrolname", "autocomplete",
    // Analytics & Tracking (Priority 6) - EXPANDED
    "data-track", "data-analytics-title", "data-analytics-element-engagement", 
    "data-analytics-exit-link", "data-analytics-activitymap-link-id",
    // Site-Specific Navigation (Priority 7) - NEW
    "data-globalnav-item-name", "data-topnav-flyout-trigger-compact",
    "data-module-template", "data-module-name",
    // Traditional Form Attributes (Priority 8)
    "type", "name", "class"
];
