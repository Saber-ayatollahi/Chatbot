
const { performance } = require('perf_hooks');

class TestUtils {
  static async measurePerformance(fn, iterations = 1) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }
    
    return {
      average: times.reduce((sum, time) => sum + time, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      total: times.reduce((sum, time) => sum + time, 0),
      iterations: iterations
    };
  }
  
  static createMockChunk(overrides = {}) {
    return {
      id: `chunk-${Date.now()}`,
      content: 'Test chunk content',
      metadata: { source: 'test' },
      embedding: new Array(3072).fill(0).map(() => Math.random()),
      ...overrides
    };
  }
  
  static createMockDocument(overrides = {}) {
    return {
      id: `doc-${Date.now()}`,
      name: 'test.pdf',
      content: 'Test document content',
      metadata: { pages: 1 },
      ...overrides
    };
  }
  
  static async waitFor(condition, timeout = 5000, interval = 100) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }
}

module.exports = TestUtils;
