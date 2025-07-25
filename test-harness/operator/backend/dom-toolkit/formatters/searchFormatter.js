/**
 * Search Formatter - Format search results for token efficiency
 */

export class SearchFormatter {
  /**
   * Format search results
   */
  formatSearchResults(data) {
    const lines = [];
    
    // Header
    lines.push(`=== DOM SEARCH RESULTS: ${data.url} ===`);
    lines.push(`Query: ${this.formatQuery(data.query)}`);
    lines.push('');

    // Visibility stats and warnings
    if (data.visibilityStats && data.visibilityStats.totalElements > 0) {
      const stats = data.visibilityStats;
      
      // Show match summary with visibility breakdown
      if (stats.zeroHeightCount > 0 || stats.hiddenCount > 0) {
        lines.push(`[MATCHES - ${stats.totalElements} found, ${stats.visibleCount} visible, ${stats.zeroHeightCount} zero-height]`);
      } else {
        lines.push(`[MATCHES - ${stats.totalElements} found${data.summary.truncated ? '+' : ''}]`);
      }
      
      // Show pattern warnings
      if (data.patterns && data.patterns.length > 0) {
        lines.push('');
        for (const pattern of data.patterns) {
          lines.push(`⚠️  WARNING: ${pattern.message}`);
          lines.push(`💡 TIP: ${pattern.suggestion}`);
        }
      }
      
      lines.push('');
    } else if (data.matches.length === 0) {
      lines.push('No matches found.');
    } else {
      lines.push(`[MATCHES - ${data.summary.matches_found} found${data.summary.truncated ? '+' : ''}]`);
    }

    // Results with visibility indicators
    for (const match of data.matches) {
      lines.push(this.formatMatch(match));
    }

    // Summary
    lines.push('');
    lines.push(`[SUMMARY]`);
    lines.push(`Searched: ${data.summary.total_searched} elements | Found: ${data.summary.matches_found}`);
    if (data.summary.truncated) {
      lines.push(`Results truncated at limit.`);
    }

    return lines.join('\n');
  }

  /**
   * Format search query for display
   */
  formatQuery(query) {
    const parts = [];
    
    if (query.text) parts.push(`text="${query.text}"`);
    if (query.selector) parts.push(`selector="${query.selector}"`);
    if (query.tag) parts.push(`tag="${query.tag}"`);
    if (query.role) parts.push(`role="${query.role}"`);
    if (query.attributes) {
      const attrs = Object.entries(query.attributes)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      parts.push(`attributes={${attrs}}`);
    }

    return parts.join(', ') || 'empty';
  }

  /**
   * Format a single match
   */
  formatMatch(match) {
    let line = match.id;
    
    // Add tag
    line += ` ${match.tag}`;

    // Add key attributes
    if (match.attributes) {
      if (match.attributes.id) {
        line += `#${match.attributes.id}`;
      } else if (match.attributes.class) {
        const firstClass = match.attributes.class.split(' ')[0];
        line += `.${firstClass}`;
      }
    }

    // Add matched text or preview
    if (match.matchedText) {
      line += ` → "${match.matchedText}"`;
    } else if (match.text) {
      line += ` → "${match.text}"`;
    }

    // Add first selector hint if available
    if (match.selector_hints && match.selector_hints[0]) {
      line += ` | ${match.selector_hints[0]}`;
    }

    // Add visibility indicator
    if (match.visibility) {
      if (match.visibility.zeroHeight) {
        line += ' [hidden: zero-height]';
      } else if (!match.visibility.visible) {
        line += ' [hidden]';
      } else if (!match.visibility.inViewport) {
        line += ' [off-screen]';
      } else {
        line += ' [visible]';
      }
    }

    return line;
  }
}