/**
 * Grouping Processor - Detect and group similar elements
 * Reduces token usage by collapsing repetitive elements like table rows
 */

export class GroupingProcessor {
  constructor() {
    // Minimum elements to form a group
    this.minGroupSize = 3;
    
    // Maximum distance between elements to be considered adjacent
    this.maxSiblingDistance = 3;
  }

  /**
   * Process elements and group similar ones
   */
  process(elements) {
    if (!elements || elements.length === 0) return elements;

    // First, build a map of elements by their parent
    const elementsByParent = this.groupByParent(elements);
    
    // Process each parent's children for similar elements
    const processedElements = [];
    const processedIndices = new Set();

    for (const [parentId, siblings] of elementsByParent) {
      // Try to find groups among siblings
      const groups = this.findSimilarGroups(siblings);

      // Process groups
      for (const group of groups) {
        if (group.length >= this.minGroupSize) {
          // Create grouped element
          const grouped = this.createGroupedElement(group);
          processedElements.push(grouped);
          
          // Mark all group members as processed
          group.forEach(item => processedIndices.add(item.index));
        }
      }
    }

    // Add ungrouped elements
    elements.forEach((element, index) => {
      if (!processedIndices.has(index)) {
        processedElements.push(element);
      }
    });

    // Sort by original order (using element IDs)
    processedElements.sort((a, b) => {
      const aId = this.extractFirstId(a.id);
      const bId = this.extractFirstId(b.id);
      return aId - bId;
    });

    return processedElements;
  }

  /**
   * Group elements by their parent
   */
  groupByParent(elements) {
    const groups = new Map();
    
    elements.forEach((element, index) => {
      // We need parent info - for now, we'll group by adjacency
      // In a real implementation, we'd have parentId from the snapshot
      const key = 'default'; // Simplified for now
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      
      groups.get(key).push({ element, index });
    });

    return groups;
  }

  /**
   * Find groups of similar elements among siblings
   */
  findSimilarGroups(siblings) {
    const groups = [];
    const used = new Set();

    for (let i = 0; i < siblings.length; i++) {
      if (used.has(i)) continue;

      const group = [siblings[i]];
      used.add(i);
      
      // Look for similar elements nearby
      for (let j = i + 1; j < siblings.length && j < i + this.maxSiblingDistance + group.length; j++) {
        if (used.has(j)) continue;

        if (this.areSimilar(siblings[i].element, siblings[j].element)) {
          group.push(siblings[j]);
          used.add(j);
        }
      }

      if (group.length >= this.minGroupSize) {
        groups.push(group);
      }
    }

    return groups;
  }

  /**
   * Check if two elements are similar enough to group
   */
  areSimilar(elem1, elem2) {
    // Must be same type and tag
    if (elem1.type !== elem2.type || elem1.tag !== elem2.tag) {
      return false;
    }

    // For now, check key attributes
    // In the future, we'll compare selector hints
    const key1 = this.generateSimilarityKey(elem1);
    const key2 = this.generateSimilarityKey(elem2);

    return key1 === key2;
  }

  /**
   * Generate a key for similarity comparison
   */
  generateSimilarityKey(element) {
    const parts = [
      element.type,
      element.tag
    ];

    // Include key attributes but not unique ones
    if (element.attributes) {
      // Include class (common across similar elements)
      if (element.attributes.class) {
        parts.push(`class:${element.attributes.class}`);
      }
      
      // Include role
      if (element.attributes.role) {
        parts.push(`role:${element.attributes.role}`);
      }

      // Include type for inputs
      if (element.attributes.type) {
        parts.push(`type:${element.attributes.type}`);
      }
    }

    // For links/buttons, check if text follows a pattern
    if (element.text) {
      // Extract pattern (e.g., "Edit" from "Edit Row 1", "Edit Row 2")
      const pattern = this.extractTextPattern(element.text);
      if (pattern) {
        parts.push(`pattern:${pattern}`);
      }
    }

    return parts.join('|');
  }

  /**
   * Extract pattern from text (for grouping similar text)
   */
  extractTextPattern(text) {
    // Remove numbers and common variables
    const pattern = text
      .replace(/\d+/g, '#')  // Replace numbers with #
      .replace(/\s+#\s*/g, ' ') // Normalize spaces around numbers
      .trim();

    // Only return if it looks like a pattern
    if (pattern.includes('#') || pattern.length < text.length * 0.8) {
      return pattern;
    }

    return text; // Return full text if no clear pattern
  }

  /**
   * Create a grouped element representation
   */
  createGroupedElement(group) {
    const first = group[0].element;
    const last = group[group.length - 1].element;
    
    // Extract ID range
    const firstId = this.extractNumericId(first.id);
    const lastId = this.extractNumericId(last.id);

    const grouped = {
      id: `[${firstId}-${lastId}]`,
      group: this.generateGroupName(first),
      count: group.length,
      type: first.type,
      tag: first.tag
    };

    // If all elements have the same selector hints, include them
    // This will be populated by the selector hints processor
    if (first.selector_hints) {
      grouped.selector_hints = first.selector_hints;
    }

    // Add common attributes
    if (first.attributes) {
      grouped.attributes = { ...first.attributes };
      // Remove unique identifiers
      delete grouped.attributes.id;
      delete grouped.attributes.name;
    }

    return grouped;
  }

  /**
   * Generate a descriptive name for the group
   */
  generateGroupName(element) {
    // Use text pattern if available
    if (element.text) {
      const pattern = this.extractTextPattern(element.text);
      if (pattern && pattern !== element.text) {
        return pattern.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      }
    }

    // Use tag and type/role
    const parts = [element.tag];
    
    if (element.attributes?.role) {
      parts.push(element.attributes.role);
    } else if (element.type && element.type !== element.tag) {
      parts.push(element.type);
    }

    return parts.join('-');
  }

  /**
   * Extract numeric ID from element ID string
   */
  extractNumericId(idString) {
    const match = idString.match(/\[(\d+)\]/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Extract first ID for sorting
   */
  extractFirstId(idString) {
    if (idString.includes('-')) {
      // It's a range like [100-105]
      const match = idString.match(/\[(\d+)-\d+\]/);
      return match ? parseInt(match[1]) : 0;
    } else {
      // Single ID like [100]
      return this.extractNumericId(idString);
    }
  }
}