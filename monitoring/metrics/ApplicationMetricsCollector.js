
const { performance } = require('perf_hooks');

class ApplicationMetricsCollector {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        rate: 0,
        averageResponseTime: 0
      },
      endpoints: new Map(),
      errors: {
        total: 0,
        rate: 0,
        types: new Map()
      },
      performance: {
        responseTime: { min: 0, max: 0, avg: 0, p95: 0, p99: 0 },
        throughput: 0,
        concurrency: 0
      }
    };
    
    this.requestTimes = [];
    this.startTime = Date.now();
  }

  recordRequest(endpoint, method, responseTime, statusCode) {
    const key = `${method} ${endpoint}`;
    
    // Update overall metrics
    this.metrics.requests.total++;
    if (statusCode < 400) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }
    
    // Record response time
    this.requestTimes.push(responseTime);
    if (this.requestTimes.length > 1000) {
      this.requestTimes = this.requestTimes.slice(-1000); // Keep last 1000
    }
    
    // Update endpoint-specific metrics
    if (!this.metrics.endpoints.has(key)) {
      this.metrics.endpoints.set(key, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        errors: 0
      });
    }
    
    const endpointMetrics = this.metrics.endpoints.get(key);
    endpointMetrics.count++;
    endpointMetrics.totalTime += responseTime;
    endpointMetrics.avgTime = endpointMetrics.totalTime / endpointMetrics.count;
    
    if (statusCode >= 400) {
      endpointMetrics.errors++;
    }
    
    // Update performance metrics
    this.updatePerformanceMetrics();
  }

  recordError(error, endpoint = 'unknown') {
    this.metrics.errors.total++;
    
    const errorType = error.name || 'UnknownError';
    if (!this.metrics.errors.types.has(errorType)) {
      this.metrics.errors.types.set(errorType, 0);
    }
    this.metrics.errors.types.set(errorType, this.metrics.errors.types.get(errorType) + 1);
  }

  updatePerformanceMetrics() {
    if (this.requestTimes.length === 0) return;
    
    const sorted = [...this.requestTimes].sort((a, b) => a - b);
    
    this.metrics.performance.responseTime = {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: this.requestTimes.reduce((sum, time) => sum + time, 0) / this.requestTimes.length,
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
    
    // Calculate rates
    const timeElapsed = (Date.now() - this.startTime) / 1000; // seconds
    this.metrics.requests.rate = this.metrics.requests.total / timeElapsed;
    this.metrics.errors.rate = (this.metrics.errors.total / this.metrics.requests.total) * 100;
    this.metrics.performance.throughput = this.metrics.requests.rate;
  }

  getMetrics() {
    this.updatePerformanceMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      ...this.metrics,
      endpoints: Object.fromEntries(this.metrics.endpoints),
      errors: {
        ...this.metrics.errors,
        types: Object.fromEntries(this.metrics.errors.types)
      }
    };
  }

  reset() {
    this.metrics.requests = { total: 0, successful: 0, failed: 0, rate: 0, averageResponseTime: 0 };
    this.metrics.endpoints.clear();
    this.metrics.errors = { total: 0, rate: 0, types: new Map() };
    this.requestTimes = [];
    this.startTime = Date.now();
  }
}

module.exports = ApplicationMetricsCollector;
