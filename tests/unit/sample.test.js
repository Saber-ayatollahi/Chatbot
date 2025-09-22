
const TestUtils = require('../utils/TestUtils');

describe('Sample Unit Tests', () => {
  describe('TestUtils', () => {
    test('should create mock chunk with default values', () => {
      const chunk = TestUtils.createMockChunk();
      
      expect(chunk).toHaveProperty('id');
      expect(chunk).toHaveProperty('content');
      expect(chunk).toHaveProperty('metadata');
      expect(chunk).toHaveProperty('embedding');
      expect(chunk.embedding).toHaveLength(3072);
    });
    
    test('should create mock chunk with overrides', () => {
      const overrides = { content: 'Custom content' };
      const chunk = TestUtils.createMockChunk(overrides);
      
      expect(chunk.content).toBe('Custom content');
    });
    
    test('should measure performance correctly', async () => {
      const testFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      };
      
      const results = await TestUtils.measurePerformance(testFunction, 5);
      
      expect(results.iterations).toBe(5);
      expect(results.average).toBeGreaterThan(8);
      expect(results.min).toBeGreaterThan(0);
      expect(results.max).toBeGreaterThan(results.min);
    });
  });
});
