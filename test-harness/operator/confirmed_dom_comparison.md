# CONFIRMED DOM/Accessibility Tree Comparison: Browser-Use vs Stagehand

## Browser-Use DOM Format (ACTUAL from results.md)

```
[Start of page]
[0]<div  />
	[1]<a >Über Google />
	[2]<a >Store />
	[3]<a >Gmail />
	[4]<a aria-label='Nach Bildern suchen '>Bilder />
	[5]<div  />
		[6]<a aria-label='Google-Apps' aria-expanded='false' role='button' />
	[7]<a aria-label='Google-Konto: Michael Burner  
(michaelburner595@gmail.com)' aria-expanded='false' role='button' />
	[8]<form role='search' />
		[9]<div  />
		[10]<textarea title='Suche' value='' aria-label='Suche' placeholder='' aria-expanded='false' name='q' role='combobox' />
		[11]<div aria-label='Suche anhand von Bildern' role='button' />
		[12]<input value='Google Suche' aria-label='Google Suche' name='btnK' role='button' type='submit' />
		[13]<input value='Auf gut Glück!' aria-label='Auf gut Glück!' name='btnI' role='button' type='submit' />
	Deutschland
	[14]<a >Werbeprogramme />
	[15]<a >Unternehmen />
	[16]<a >Wie funktioniert die Google Suche? />
	[17]<a  />
		Drei Jahrzehnte Klimaschutz: Jede Entscheidung zählt
	[18]<a >Datenschutzerklärung />
	[19]<a >Nutzungsbedingungen />
	[20]<div aria-expanded='false' role='button' />
		Einstellungen
[End of page]
```

## Stagehand Accessibility Tree Format (CONFIRMED from verbose logs)

```
Accessibility Tree: 
[7] RootWebArea: Google
  [26] scrollable
    [54] body
      [59] div
        [62] navigation
          [16] link: Über Google
          [66] link: Store
          [69] div
            [71] div
              [73] link: Gmail
              [76] link: Nach Bildern suchen
                [77] StaticText: Bilder
            [80] button: Google-Apps
              [82] image
            [86] link: Anmelden
        [98] image
        [21] search
          [142] div
            [146] div
              [152] image
              [22] combobox: Suche
              [161] div
                [176] button: Sprachsuche
                  [177] image
                [181] button: Suche anhand von Bildern
                  [182] image
            [344] center
              [345] button: Google Suche
              [348] button: Auf gut Glück!
        [399] div
          [400] StaticText: Google gibt es auch auf:
          [401] link: English
        [407] contentinfo
          [411] StaticText: Deutschland
          [412] div
            [413] div
              [414] link: Werbeprogramme
              [17] link: Unternehmen
              [417] link: Wie funktioniert die Google Suche?
            [420] link: Drei Jahrzehnte Klimaschutz: Jede Entscheidung zählt
            [423] div
              [424] link: Datenschutzerklärung
              [426] link: Nutzungsbedingungen
              [435] button: Einstellungen
```

## Key Differences Confirmed

### 1. **Element Format**
- **Browser-Use**: `[index]<tag attributes>text />`
- **Stagehand**: `[index] role: text`

### 2. **Indexing Systems**
- **Browser-Use**: Sequential (0, 1, 2, 3...) - only interactive elements
- **Stagehand**: Non-sequential (7, 26, 54, 59...) - all elements including containers

### 3. **Structure Representation**
- **Browser-Use**: HTML-like with tab indentation, filtered to interactive elements
- **Stagehand**: Full accessibility tree with space indentation, includes all nodes

### 4. **Same Elements Compared**

| Element | Browser-Use | Stagehand |
|---------|-------------|-----------|
| About Google | `[1]<a >Über Google />` | `[16] link: Über Google` |
| Store | `[2]<a >Store />` | `[66] link: Store` |
| Gmail | `[3]<a >Gmail />` | `[73] link: Gmail` |
| Search box | `[10]<textarea ... role='combobox' />` | `[22] combobox: Suche` |
| Google Search | `[12]<input value='Google Suche' ... />` | `[345] button: Google Suche` |

### 5. **Text Node Handling**
- **Browser-Use**: Inline text (e.g., "Deutschland") or inside elements
- **Stagehand**: Explicit `StaticText` nodes with their own IDs

### 6. **Attributes**
- **Browser-Use**: Preserves HTML attributes (aria-label, role, name, value, etc.)
- **Stagehand**: Only shows semantic role and text content

## Why Stagehand Can Extract DOM Selectors

Even though Stagehand shows the accessibility tree format to the LLM, it can still extract DOM selectors because:

1. **Each element has an internal reference** - The numbers like `[73]` map to actual DOM elements
2. **When you use `observe()`**, Stagehand returns selectors like `xpath=/html/body/div[1]/div[1]/a[1]`
3. **The LLM receives the accessibility tree** but Stagehand's backend maintains the DOM mapping

This is why in our test, when we called `observe()`, it returned:
```json
{
  "description": "Gmail",
  "method": "click",
  "selector": "xpath=/html[1]/body[1]/div[1]/div[1]/div[1]/div[1]/header[1]/div[1]/div[1]/a[1]"
}
```

## Scout System Implications

For your Scout system using Browser-Use:
1. **Conceptual understanding** ✓ - Both formats work
2. **DOM selector extraction** ✓ - Browser-Use can provide CSS/XPath selectors
3. **Format translation** - The Scout just needs to provide multiple selector strategies:
   - CSS selectors
   - XPath selectors  
   - Text-based selectors (`text:Gmail`)
   - Attribute selectors (`[aria-label='Gmail']`)

The format differences are not a blocker - they're actually complementary views of the same page!