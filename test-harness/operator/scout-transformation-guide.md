# Scout Transformation Guide: Browser-Use to Stagehand

## Quick Reference: Key Transformations

### 1. Element Index Transformation

```python
# Browser-Use: Sparse indices only on interactive elements
browser_use_output = """
[0]<button>Submit</button>
Text content here
[1]<input type="text" />
More text
[2]<a href="/link">Click</a>
"""

# Stagehand: Dense indices on all elements and text
stagehand_output = """
0:<button>Submit</button>
1:Text content here
2:<input type="text" />
3:More text
4:<a href="/link">Click</a>
"""

# Transformation needed:
def transform_indices(browser_use_element):
    # 1. Assign indices to text nodes
    # 2. Renumber sequentially
    # 3. Map old -> new indices
```

### 2. Selector Format Transformation

```python
# Browser-Use selector
{
    "xpath": "/html/body/div[2]/button[@id='submit']",
    "css": "#submit"  # Enhanced CSS selector
}

# Stagehand selector (always an array)
{
    42: [
        "//button[@id='submit']",
        "//button[@class='btn-primary']", 
        "//div[2]/button[1]"
    ]
}

# Transformation:
def transform_selector(browser_use_selector):
    return {
        stagehand_index: [
            browser_use_selector["xpath"],
            # Generate alternatives...
        ]
    }
```

### 3. Attribute Handling

| Browser-Use Behavior | Stagehand Requirement | Transformation |
|---------------------|----------------------|----------------|
| Removes redundant aria-label | Always includes aria-label | Re-add from element text |
| Skips role if matches tag | Always includes role | Infer from tag name |
| Optimizes placeholder | Always includes placeholder | Preserve all attributes |
| No data-* attributes | Includes all data-* | Scout must capture these |

### 4. Text Node Transformation

```python
# Browser-Use: Text within parent
class BrowserUseElement:
    highlight_index = 5
    text = "Submit Form"  # Via get_all_text_till_next_clickable_element()

# Stagehand: Separate text nodes
"5:<button>Submit Form</button>"
"6:Additional text here"  # Separate entry

# Transform by extracting text nodes
def extract_text_nodes(browser_use_tree):
    text_nodes = []
    for element in tree:
        # Extract text between elements
        # Create new numbered entries
```

## Practical Transformation Pipeline

### Step 1: Parse Browser-Use Output
```python
def parse_browser_use_dom(dom_string):
    elements = []
    current_index = 0
    
    for line in dom_string.split('\n'):
        if line.startswith('[') or line.startswith('*['):
            # Interactive element with index
            index = extract_index(line)
            element = parse_element(line)
            elements.append({
                'type': 'element',
                'browser_use_index': index,
                'element': element
            })
        else:
            # Text node - needs synthetic index
            elements.append({
                'type': 'text',
                'browser_use_index': None,
                'text': line.strip()
            })
```

### Step 2: Generate Stagehand Indices
```python
def assign_stagehand_indices(parsed_elements):
    stagehand_index = 0
    index_mapping = {}
    
    for element in parsed_elements:
        element['stagehand_index'] = stagehand_index
        
        if element['browser_use_index'] is not None:
            index_mapping[element['browser_use_index']] = stagehand_index
            
        stagehand_index += 1
    
    return index_mapping
```

### Step 3: Transform Selectors
```python
def transform_selectors(element, index):
    # Browser-Use provides single xpath
    base_xpath = element.get('xpath')
    
    # Generate Stagehand-style alternatives
    selectors = [base_xpath]
    
    # Add ID-based selector if available
    if element.get('id'):
        selectors.append(f"//*[@id='{element['id']}']")
    
    # Add class-based selector
    if element.get('class'):
        selectors.append(f"//*[@class='{element['class']}']")
    
    return {index: selectors}
```

### Step 4: Format Output
```python
def format_stagehand_output(transformed_elements):
    output_lines = []
    selector_map = {}
    
    for elem in transformed_elements:
        index = elem['stagehand_index']
        
        if elem['type'] == 'text':
            output_lines.append(f"{index}:{elem['text']}")
        else:
            # Format element with all attributes
            tag = elem['element']['tag']
            attrs = format_attributes(elem['element']['attributes'])
            text = elem['element'].get('text', '')
            
            output_lines.append(
                f"{index}:<{tag}{attrs}>{text}</{tag}>"
            )
            
            # Add to selector map
            selector_map.update(
                transform_selectors(elem['element'], index)
            )
    
    return {
        'outputString': '\n'.join(output_lines),
        'selectorMap': selector_map
    }
```

## Critical Compatibility Checks

### 1. Viewport Handling
- **Browser-Use**: Includes `is_in_viewport` flag
- **Stagehand**: Only includes visible elements in chunk
- **Transform**: Filter elements based on viewport flag

### 2. Shadow DOM
- **Browser-Use**: Special handling with root switching
- **Stagehand**: Marked with `shadow_root: true`
- **Transform**: Ensure shadow root indicators are preserved

### 3. New Element Detection
- **Browser-Use**: `*[index]*` notation for new elements
- **Stagehand**: No built-in new element tracking
- **Transform**: Add metadata layer for element state

## Scout Recommendations

### 1. Capture Extra Data
Scouts should capture MORE than Browser-Use typically exposes:
- All attributes (not just optimized set)
- Explicit text node boundaries
- Data attributes
- Computed styles (if needed)

### 2. Dual Output Format
```python
scout_output = {
    "browser_use_format": "[0]<button>Click</button>",
    "stagehand_format": "0:<button id='btn'>Click</button>",
    "metadata": {
        "index_mapping": {0: 0},
        "attributes_captured": ["id", "class", "aria-label"],
        "text_nodes": []
    }
}
```

### 3. Validation Layer
```python
def validate_transformation(browser_use_dom, stagehand_dom):
    # Check index mappings
    # Verify selector compatibility  
    # Ensure no data loss
    # Test element findability
```

## Common Pitfalls

1. **Lost Text Nodes**: Browser-Use embeds text; Stagehand separates it
2. **Attribute Optimization**: Browser-Use removes "redundant" attributes Stagehand needs
3. **Index Gaps**: Browser-Use sparse indices create gaps Stagehand can't handle
4. **Selector Specificity**: Browser-Use single selector vs Stagehand multiple fallbacks
5. **Cross-Frame References**: Different iframe handling approaches

## Testing Transformation

```python
# Test case
browser_use_input = """
[0]<button aria-label='Submit' >Submit />
Please fill out the form
[1]<input placeholder='Name' />
"""

expected_stagehand = """
0:<button aria-label="Submit">Submit</button>
1:Please fill out the form
2:<input placeholder="Name" />
"""

# Verify transformation preserves functionality
assert transform(browser_use_input) == expected_stagehand
```