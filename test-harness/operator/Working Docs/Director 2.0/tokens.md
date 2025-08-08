# Token Usage Comparison: Screenshots vs Text

## Screenshot Token Usage

### Gmail Sign-in Page Screenshot
- **Gemini 2.5 Flash**: 3,384 input tokens
- **OpenAI o4-mini**: 2,612 input tokens

### Key Findings
- Google Gemini counts ~30% more tokens for the same image compared to OpenAI
- Both models successfully analyzed the screenshot content
- o4-mini includes "reasoning tokens" (448) as part of completion tokens

## Text-Only Token Usage

### Simple Prompt
"please concisely describe: 1. What page are you on? 2. What components are visible? 3. What values are visible?"
- **Gemini 2.5 Flash**: 30 input tokens
- **OpenAI o4-mini**: Not tested separately

### Detailed Text Description
A comprehensive description of an Airtable interface (~400 words)
- **OpenAI o4-mini**: 515 input tokens

## Summary
- Screenshots consume significantly more tokens than text descriptions
- A single screenshot uses 5-6x more tokens than a detailed text description
- Token counting differs between providers, with Gemini typically counting more tokens than OpenAI for images