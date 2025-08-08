import { ExtractListProcessor } from '../extractList';
import { ExtractListConfig } from '../../types';

// Mock page object for testing
const createMockPage = (items: any[] = [], canScroll: boolean = false) => ({
  evaluate: jest.fn()
    .mockImplementationOnce(() => Promise.resolve(items))
    .mockImplementation(() => Promise.resolve(canScroll)),
  act: jest.fn().mockResolvedValue('{"itemSelector":".test-item","nextPageSelector":null}'),
  url: jest.fn().mockReturnValue('https://example.com/list')
});

describe('ExtractListProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should extract items from a single page', async () => {
    const mockItems = [
      { id: '1', title: 'Item 1' },
      { id: '2', title: 'Item 2' }
    ];
    
    const mockPage = createMockPage(mockItems, false);
    
    const config: ExtractListConfig = {
      fields: { title: '.title' },
      itemSelector: '.test-item',
      debug: false
    };

    const processor = new ExtractListProcessor(config);
    const result = await processor.extract(mockPage, 'https://example.com/list');

    expect(result.items).toHaveLength(2);
    expect(result.pagesVisited).toBe(0);
    expect(result.totalItems).toBe(2);
  });

  test('should handle empty results', async () => {
    const mockPage = createMockPage([], false);
    
    const config: ExtractListConfig = {
      fields: { title: '.title' },
      itemSelector: '.test-item'
    };

    const processor = new ExtractListProcessor(config);
    const result = await processor.extract(mockPage, 'https://example.com/list');

    expect(result.items).toHaveLength(0);
    expect(result.totalItems).toBe(0);
  });

  test('should handle JSON parsing fallback', async () => {
    const mockPage = {
      evaluate: jest.fn().mockResolvedValue([{ id: '1', title: 'Item 1' }]),
      act: jest.fn().mockResolvedValue('The selector is {"itemSelector":".fallback-item","nextPageSelector":null} for this page'),
      url: jest.fn().mockReturnValue('https://example.com/list')
    };
    
    const config: ExtractListConfig = {
      fields: { title: '.title' },
      debug: false
    };

    const processor = new ExtractListProcessor(config);
    const result = await processor.extract(mockPage, 'https://example.com/list');

    expect(result.items).toHaveLength(1);
    expect(mockPage.act).toHaveBeenCalled();
  });

  test('should deduplicate items correctly', async () => {
    const duplicateItems = [
      { id: '1', title: 'Item 1' },
      { id: '1', title: 'Item 1' }, // Duplicate
      { id: '2', title: 'Item 2' }
    ];
    
    const mockPage = createMockPage(duplicateItems, false);
    
    const config: ExtractListConfig = {
      fields: { title: '.title' },
      itemSelector: '.test-item',
      deduplication: true
    };

    const processor = new ExtractListProcessor(config);
    const result = await processor.extract(mockPage, 'https://example.com/list');

    expect(result.items).toHaveLength(2);
    expect(result.items.map(item => item.id)).toEqual(['1', '2']);
  });

  test('should respect maxItems limit', async () => {
    const manyItems = Array.from({ length: 10 }, (_, i) => ({
      id: `${i + 1}`,
      title: `Item ${i + 1}`
    }));
    
    const mockPage = createMockPage(manyItems, false);
    
    const config: ExtractListConfig = {
      fields: { title: '.title' },
      itemSelector: '.test-item',
      maxItems: 5
    };

    const processor = new ExtractListProcessor(config);
    const result = await processor.extract(mockPage, 'https://example.com/list');

    expect(result.items.length).toBeLessThanOrEqual(5);
  });
}); 