import { ExtractListConfig, ExtractListResult } from '../types';
import crypto from 'crypto';

interface SelectorCache {
  [key: string]: {
    domain: string;
    path: string;
    itemSelector: string;
    nextPageSelector?: string;
    timestamp: number;
  };
}

// In-memory selector cache (in production, this could be Redis/DB)
const selectorCache: SelectorCache = {};

export class ExtractListProcessor {
  private config: ExtractListConfig;
  private seenIds: Set<string> = new Set();
  private items: any[] = [];
  private pagesVisited: number = 0;
  private unchangedIterations: number = 0;

  constructor(config: ExtractListConfig) {
    this.config = {
      maxItems: 300,
      maxPages: 20,
      scrollStrategy: 'auto',
      deduplication: true,
      stream: false,
      throttleMs: 250,
      ...config
    };
  }

  /**
   * Main extraction method - works with any page object (Playwright or Stagehand)
   */
  async extract(page: any, currentUrl: string): Promise<ExtractListResult> {
    if (this.config.debug) {
      console.log(`[ExtractList] Starting extraction with config:`, this.config);
    }
    
    const urlObj = new URL(currentUrl);
    const cacheKey = `${urlObj.hostname}${urlObj.pathname}`;
    
    // Step 1: Get or learn selectors
    let itemSelector = this.config.itemSelector;
    let nextPageSelector = this.config.nextPageSelector;
    
    if (!itemSelector) {
      if (this.config.debug) {
        console.log(`[ExtractList] No itemSelector provided, checking cache for ${cacheKey}`);
      }
      const cached = selectorCache[cacheKey];
      
      if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) { // 24h cache
        if (this.config.debug) {
          console.log(`[ExtractList] Using cached selectors:`, cached);
        }
        itemSelector = cached.itemSelector;
        nextPageSelector = cached.nextPageSelector;
      } else {
        if (this.config.debug) {
          console.log(`[ExtractList] Learning selectors via LLM...`);
        }
        const learned = await this.learnSelectors(page);
        itemSelector = learned.itemSelector;
        nextPageSelector = learned.nextPageSelector;
        
        // Cache the learned selectors
        selectorCache[cacheKey] = {
          domain: urlObj.hostname,
          path: urlObj.pathname,
          itemSelector,
          nextPageSelector,
          timestamp: Date.now()
        };
      }
    }

    if (!itemSelector) {
      throw new Error('Could not determine itemSelector for list extraction');
    }

    if (this.config.debug) {
      console.log(`[ExtractList] Using itemSelector: ${itemSelector}`);
    }

    // Step 2: Deterministic extraction loop
    let retryCount = 0;
    const maxRetries = 2;

    while (this.pagesVisited < this.config.maxPages! && this.items.length < this.config.maxItems!) {
      try {
        // Extract current page items
        const pageItems = await this.extractCurrentPage(page, itemSelector);
        const initialCount = this.items.length;
        
        // Process and deduplicate items
        this.processPageItems(pageItems);
        
        // Check if we got new items
        if (this.items.length === initialCount) {
          this.unchangedIterations++;
          if (this.config.debug) {
            console.log(`[ExtractList] No new items found (iteration ${this.unchangedIterations})`);
          }
          
          if (this.unchangedIterations >= 2) {
            if (this.config.debug) {
              console.log(`[ExtractList] Stopping - no new items for 2 iterations`);
            }
            break;
          }
        } else {
          this.unchangedIterations = 0;
          if (this.config.debug) {
            console.log(`[ExtractList] Found ${this.items.length - initialCount} new items`);
          }
        }

        // Check stop predicate if provided
        if (this.config.stopPredicate && this.shouldStop()) {
          console.log(`[ExtractList] Stopping - stop predicate returned true`);
          break;
        }

        // Stream results if enabled
        if (this.config.stream) {
          // TODO: Emit via WebSocket
        }

        // Scroll to next page
        const scrolled = await this.scrollToNextPage(page, nextPageSelector);
        if (!scrolled) {
          console.log(`[ExtractList] Cannot scroll further - reached end`);
          break;
        }

        this.pagesVisited++;
        
        // Throttle between scrolls
        await new Promise(resolve => setTimeout(resolve, this.config.throttleMs));
        
        retryCount = 0; // Reset retry count on successful page

      } catch (error) {
        console.error(`[ExtractList] Error on page ${this.pagesVisited}:`, error);
        retryCount++;
        
        if (retryCount >= maxRetries) {
          console.error(`[ExtractList] Max retries reached, attempting selector recovery...`);
          
          try {
            // Fallback: re-learn selectors
            const learned = await this.learnSelectors(page);
            itemSelector = learned.itemSelector;
            nextPageSelector = learned.nextPageSelector;
            
            // Update cache
            selectorCache[cacheKey] = {
              domain: urlObj.hostname,
              path: urlObj.pathname,
              itemSelector,
              nextPageSelector,
              timestamp: Date.now()
            };
            
            retryCount = 0;
            console.log(`[ExtractList] Selector recovery successful, continuing...`);
          } catch (recoveryError) {
            console.error(`[ExtractList] Selector recovery failed:`, recoveryError);
            throw new Error(`Extraction failed after recovery attempt: ${recoveryError}`);
          }
        }
      }
    }

    if (this.config.debug) {
      console.log(`[ExtractList] Extraction complete: ${this.items.length} items, ${this.pagesVisited} pages`);
    }

    return {
      items: this.items,
      pagesVisited: this.pagesVisited,
      totalItems: this.items.length,
      selectorCache: selectorCache[cacheKey]
    };
  }

  /**
   * Learn selectors using LLM (Stagehand act) with JSON contract
   */
  private async learnSelectors(page: any): Promise<{ itemSelector: string; nextPageSelector?: string }> {
    try {
      // First attempt: strict JSON contract
      const selectorResult = await page.act(
        "Return ONLY valid JSON with two keys: " +
        '{"itemSelector":"<css_selector>", "nextPageSelector":"<css_selector_or_null>"}. ' +
        "Find the CSS selector for repeating list items/rows and optional next/older button. " +
        "No prose, just JSON."
      );

      let parsedResult: any = null;
      
      // Try to parse JSON response
      if (typeof selectorResult === 'string') {
        try {
          // First try direct parse
          parsedResult = JSON.parse(selectorResult.trim());
        } catch (parseError) {
          // Try to extract JSON from prose response
          const jsonMatch = selectorResult.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsedResult = JSON.parse(jsonMatch[0]);
            } catch (innerError) {
              console.warn(`[ExtractList] JSON extraction failed, using regex fallback`);
              
              // Final fallback: extract from prose response
              const itemMatch = selectorResult.match(/[.#][\w-]+(?:\[[\w-="']+\])?/);
              if (itemMatch) {
                parsedResult = { itemSelector: itemMatch[0], nextPageSelector: null };
              }
            }
          } else {
            console.warn(`[ExtractList] No JSON found, using regex fallback`);
            
            // Final fallback: extract from prose response
            const itemMatch = selectorResult.match(/[.#][\w-]+(?:\[[\w-="']+\])?/);
            if (itemMatch) {
              parsedResult = { itemSelector: itemMatch[0], nextPageSelector: null };
            }
          }
        }
      }

      // Validate the learned selector
      let itemSelector = parsedResult?.itemSelector || '.zA'; // Gmail fallback
      
      if (itemSelector) {
        try {
          // Test selector - should find at least 2 elements
          const elementCount = await page.evaluate((selector: string) => {
            return document.querySelectorAll(selector).length;
          }, itemSelector);
          
          if (elementCount < 1) {
            console.warn(`[ExtractList] Selector ${itemSelector} found ${elementCount} elements, using fallback`);
            itemSelector = await this.getFallbackSelector(page);
          }
        } catch (error) {
          console.warn(`[ExtractList] Selector validation failed:`, error);
          itemSelector = await this.getFallbackSelector(page);
        }
      }

      const nextPageSelector = parsedResult?.nextPageSelector || undefined;
      
      if (this.config.debug) {
        console.log(`[ExtractList] Learned selectors - item: ${itemSelector}, next: ${nextPageSelector}`);
      }
      
      return { itemSelector, nextPageSelector };
    } catch (error) {
      console.error(`[ExtractList] Failed to learn selectors:`, error);
      throw new Error(`Selector learning failed: ${error}`);
    }
  }

  /**
   * Get fallback selector based on common patterns (batched for performance)
   */
  private async getFallbackSelector(page: any): Promise<string> {
    const fallbacks = ['.zA', 'tr[role="row"]', '.list-item', '[data-testid*="row"]', 'li'];
    
    try {
      // Batch all selector checks in one evaluate call
      const results = await page.evaluate((selectors: string[]) => {
        return selectors.map(selector => ({
          selector,
          count: document.querySelectorAll(selector).length
        }));
      }, fallbacks);
      
      // Find first selector with at least 1 element
      for (const result of results) {
        if (result.count >= 1) {
          if (this.config.debug) {
            console.log(`[ExtractList] Using fallback selector: ${result.selector} (${result.count} elements)`);
          }
          return result.selector;
        }
      }
    } catch (error) {
      console.warn(`[ExtractList] Fallback selector evaluation failed:`, error);
    }
    
    return '.zA'; // Ultimate fallback
  }

  /**
   * Extract items from current page using deterministic DOM queries
   */
  private async extractCurrentPage(page: any, itemSelector: string): Promise<any[]> {
    try {
      // Use page.evaluate for deterministic extraction
      const pageItems = await page.evaluate((selector: string, fields: Record<string, string>) => {
        const items: any[] = [];
        const elements = document.querySelectorAll(selector);
        
        elements.forEach((element, index) => {
          const item: any = {};
          
          // Extract each field using its selector
          for (const [fieldName, fieldSelector] of Object.entries(fields)) {
            try {
              let value = '';
              
              if (fieldSelector.startsWith('@')) {
                // Attribute selector: @data-thread-id
                const attrName = fieldSelector.substring(1);
                value = element.getAttribute(attrName) || '';
              } else {
                // CSS selector
                const fieldElement = element.querySelector(fieldSelector);
                value = fieldElement?.textContent?.trim() || '';
              }
              
              item[fieldName] = value;
            } catch (fieldError) {
              console.warn(`Failed to extract field ${fieldName}:`, fieldError);
              item[fieldName] = '';
            }
          }
          
          // Generate fallback ID if not provided
          if (!item.id && !item.threadId) {
            item.id = `item_${index}_${Date.now()}`;
          }
          
          items.push(item);
        });
        
        return items;
      }, itemSelector, this.config.fields);

      console.log(`[ExtractList] Extracted ${pageItems.length} items from current page`);
      return pageItems;
    } catch (error) {
      console.error(`[ExtractList] Failed to extract current page:`, error);
      throw error;
    }
  }

  /**
   * Process and deduplicate page items
   */
  private processPageItems(pageItems: any[]): void {
    for (const item of pageItems) {
      // Check maxItems limit
      if (this.items.length >= this.config.maxItems!) {
        break;
      }
      
      // Generate unique ID for deduplication
      const itemId = item.id || item.threadId || this.generateItemHash(item);
      
      if (this.config.deduplication && this.seenIds.has(itemId)) {
        continue; // Skip duplicate
      }
      
      this.seenIds.add(itemId);
      this.items.push(item);
    }
  }

  /**
   * Generate hash for item deduplication
   */
  private generateItemHash(item: any): string {
    const content = JSON.stringify(item);
    return crypto.createHash('sha1').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Check stop predicate
   */
  private shouldStop(): boolean {
    if (!this.config.stopPredicate) return false;
    
    try {
      // Create a simple function from the predicate string
      const predicateFunction = new Function('items', `return (${this.config.stopPredicate})(items);`);
      return predicateFunction(this.items);
    } catch (error) {
      console.warn(`[ExtractList] Stop predicate evaluation failed:`, error);
      return false;
    }
  }

  /**
   * Scroll to next page with MutationObserver fallback
   */
  private async scrollToNextPage(page: any, nextPageSelector?: string): Promise<boolean> {
    try {
      if (this.config.scrollStrategy === 'manual' && nextPageSelector) {
        // Click next page button
        const clicked = await page.evaluate((selector: string) => {
          const button = document.querySelector(selector);
          if (button && !button.hasAttribute('disabled')) {
            (button as HTMLElement).click();
            return true;
          }
          return false;
        }, nextPageSelector);
        
        if (clicked) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for load
          return true;
        }
      }
      
      // Enhanced infinite scroll with MutationObserver fallback
      const scrolled = await page.evaluate((itemSelector: string) => {
        const initialHeight = document.body.scrollHeight;
        const initialItemCount = document.querySelectorAll(itemSelector).length;
        
        window.scrollBy(0, window.innerHeight);
        
        return new Promise<boolean>((resolve) => {
          let resolved = false;
          
          // Primary check: height change
          const heightTimer = setTimeout(() => {
            if (!resolved) {
              const newHeight = document.body.scrollHeight;
              if (newHeight > initialHeight) {
                resolved = true;
                observer.disconnect();
                resolve(true);
                return;
              }
              
              // Fallback: check item count change (for virtualized lists)
              const newItemCount = document.querySelectorAll(itemSelector).length;
              resolved = true;
              observer.disconnect();
              resolve(newItemCount > initialItemCount);
            }
          }, 500);
          
          // MutationObserver fallback for dynamic content
          const observer = new MutationObserver(() => {
            if (!resolved) {
              const newItemCount = document.querySelectorAll(itemSelector).length;
              if (newItemCount > initialItemCount) {
                resolved = true;
                observer.disconnect();
                clearTimeout(heightTimer);
                resolve(true);
              }
            }
          });
          
          observer.observe(document.body, { 
            childList: true, 
            subtree: true 
          });
          
          // Cleanup observer after timeout
          setTimeout(() => {
            if (!resolved) {
              observer.disconnect();
            }
          }, 1000);
        });
      }, this.config.itemSelector || '.zA');
      
      return scrolled;
    } catch (error) {
      console.error(`[ExtractList] Failed to scroll to next page:`, error);
      return false;
    }
  }
}

/**
 * Utility function to create and run extraction
 */
export async function extractList(
  page: any, 
  currentUrl: string, 
  config: ExtractListConfig
): Promise<ExtractListResult> {
  const processor = new ExtractListProcessor(config);
  return processor.extract(page, currentUrl);
} 