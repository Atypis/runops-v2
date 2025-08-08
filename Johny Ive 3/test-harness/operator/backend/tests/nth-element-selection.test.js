import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BrowserActionService } from '../services/browserActionService.js';
import { NodeExecutor } from '../services/nodeExecutor.js';

describe('Nth Element Selection', () => {
  let browserActionService;
  let nodeExecutor;
  let mockPage;
  let mockElements;

  beforeEach(() => {
    browserActionService = new BrowserActionService();
    nodeExecutor = new NodeExecutor();
    
    // Mock elements
    mockElements = [
      { click: jest.fn(), type: jest.fn() },
      { click: jest.fn(), type: jest.fn() },
      { click: jest.fn(), type: jest.fn() },
      { click: jest.fn(), type: jest.fn() },
      { click: jest.fn(), type: jest.fn() }
    ];
    
    // Mock page
    mockPage = {
      $$: jest.fn().mockResolvedValue(mockElements),
      click: jest.fn(),
      type: jest.fn()
    };
  });

  describe('BrowserActionService.resolveIndex', () => {
    it('should handle positive indices', () => {
      expect(browserActionService.resolveIndex(0, 5)).toBe(0);
      expect(browserActionService.resolveIndex(2, 5)).toBe(2);
      expect(browserActionService.resolveIndex(4, 5)).toBe(4);
    });

    it('should handle negative indices', () => {
      expect(browserActionService.resolveIndex(-1, 5)).toBe(4);
      expect(browserActionService.resolveIndex(-2, 5)).toBe(3);
      expect(browserActionService.resolveIndex(-5, 5)).toBe(0);
    });

    it('should handle keywords', () => {
      expect(browserActionService.resolveIndex('first', 5)).toBe(0);
      expect(browserActionService.resolveIndex('last', 5)).toBe(4);
    });

    it('should handle string numbers', () => {
      expect(browserActionService.resolveIndex('0', 5)).toBe(0);
      expect(browserActionService.resolveIndex('2', 5)).toBe(2);
      expect(browserActionService.resolveIndex('-1', 5)).toBe(4);
    });
  });

  describe('BrowserActionService click with nth', () => {
    it('should click the nth element when specified', async () => {
      const config = {
        action: 'click',
        selector: 'button.submit',
        nth: 2
      };

      await browserActionService.click(mockPage, config);

      expect(mockPage.$$).toHaveBeenCalledWith('button.submit');
      expect(mockElements[2].click).toHaveBeenCalled();
      expect(mockElements[0].click).not.toHaveBeenCalled();
      expect(mockElements[1].click).not.toHaveBeenCalled();
    });

    it('should click the last element with nth: -1', async () => {
      const config = {
        action: 'click',
        selector: 'button.submit',
        nth: -1
      };

      await browserActionService.click(mockPage, config);

      expect(mockPage.$$).toHaveBeenCalledWith('button.submit');
      expect(mockElements[4].click).toHaveBeenCalled();
    });

    it('should click first element with nth: "first"', async () => {
      const config = {
        action: 'click',
        selector: 'button.submit',
        nth: 'first'
      };

      await browserActionService.click(mockPage, config);

      expect(mockPage.$$).toHaveBeenCalledWith('button.submit');
      expect(mockElements[0].click).toHaveBeenCalled();
    });

    it('should throw error when nth exceeds bounds', async () => {
      const config = {
        action: 'click',
        selector: 'button.submit',
        nth: 10
      };

      await expect(browserActionService.click(mockPage, config))
        .rejects.toThrow('No element at index 10');
    });

    it('should throw error when no elements match', async () => {
      mockPage.$$ = jest.fn().mockResolvedValue([]);
      
      const config = {
        action: 'click',
        selector: 'button.missing',
        nth: 0
      };

      await expect(browserActionService.click(mockPage, config))
        .rejects.toThrow('No element at index 0');
    });
  });

  describe('BrowserActionService type with nth', () => {
    it('should type into the nth element when specified', async () => {
      const config = {
        action: 'type',
        selector: 'input.email',
        text: 'test@example.com',
        nth: 1
      };

      await browserActionService.type(mockPage, config);

      expect(mockPage.$$).toHaveBeenCalledWith('input.email');
      expect(mockElements[1].type).toHaveBeenCalledWith('test@example.com');
      expect(mockElements[0].type).not.toHaveBeenCalled();
    });
  });

  describe('NodeExecutor.resolveIndex', () => {
    it('should handle positive indices', () => {
      expect(nodeExecutor.resolveIndex(0, 5)).toBe(0);
      expect(nodeExecutor.resolveIndex(2, 5)).toBe(2);
      expect(nodeExecutor.resolveIndex(4, 5)).toBe(4);
    });

    it('should handle negative indices', () => {
      expect(nodeExecutor.resolveIndex(-1, 5)).toBe(4);
      expect(nodeExecutor.resolveIndex(-2, 5)).toBe(3);
      expect(nodeExecutor.resolveIndex(-5, 5)).toBe(0);
    });

    it('should handle keywords', () => {
      expect(nodeExecutor.resolveIndex('first', 5)).toBe(0);
      expect(nodeExecutor.resolveIndex('last', 5)).toBe(4);
    });

    it('should handle string numbers', () => {
      expect(nodeExecutor.resolveIndex('0', 5)).toBe(0);
      expect(nodeExecutor.resolveIndex('2', 5)).toBe(2);
      expect(nodeExecutor.resolveIndex('-1', 5)).toBe(4);
    });
  });

  describe('Variable resolution', () => {
    it('should resolve nth from template variables', () => {
      const memory = { index: 3 };
      const resolvedNth = nodeExecutor.resolveTemplateVariables('{{index}}', memory);
      expect(resolvedNth).toBe('3');
    });
  });
});

describe('Count Method for browser_query', () => {
  let nodeExecutor;
  let mockPage;

  beforeEach(() => {
    nodeExecutor = new NodeExecutor();
    
    mockPage = {
      evaluate: jest.fn()
    };
    
    // Mock getActiveStagehandPage
    global.getActiveStagehandPage = jest.fn().mockResolvedValue(mockPage);
  });

  it('should count elements matching selector', async () => {
    mockPage.evaluate.mockResolvedValue(14);
    
    const config = {
      method: 'count',
      selector: 'tr.email-row'
    };

    const result = await nodeExecutor.executeBrowserQuery(config);

    expect(mockPage.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      'tr.email-row'
    );
    expect(result).toEqual({ count: 14 });
  });

  it('should return 0 when no elements match', async () => {
    mockPage.evaluate.mockResolvedValue(0);
    
    const config = {
      method: 'count',
      selector: 'button.missing'
    };

    const result = await nodeExecutor.executeBrowserQuery(config);

    expect(result).toEqual({ count: 0 });
  });

  it('should handle complex selectors', async () => {
    mockPage.evaluate.mockResolvedValue(5);
    
    const config = {
      method: 'count',
      selector: 'div.container > ul.list > li.item:not(.disabled)'
    };

    const result = await nodeExecutor.executeBrowserQuery(config);

    expect(mockPage.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      'div.container > ul.list > li.item:not(.disabled)'
    );
    expect(result).toEqual({ count: 5 });
  });
});