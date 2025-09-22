
const { getDatabase } = require('../../config/database');

class HealthCheckManager {
  constructor() {
    this.checks = new Map();
    this.results = new Map();
    this.setupDefaultChecks();
  }

  setupDefaultChecks() {
    // Database health check
    this.addCheck('database', async () => {
      try {
        const db = getDatabase();
        const result = await db.query('SELECT 1 as health_check');
        return {
          status: 'healthy',
          responseTime: Date.now(),
          details: { connected: true, result: result.rows[0] }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          responseTime: Date.now(),
          error: error.message,
          details: { connected: false }
        };
      }
    });

    // Memory health check
    this.addCheck('memory', async () => {
      const memUsage = process.memoryUsage();
      const totalMem = require('os').totalmem();
      const freeMem = require('os').freemem();
      const usedPercent = ((totalMem - freeMem) / totalMem) * 100;
      
      return {
        status: usedPercent > 90 ? 'unhealthy' : 'healthy',
        responseTime: Date.now(),
        details: {
          usedPercent: usedPercent.toFixed(1),
          heap: memUsage.heapUsed,
          rss: memUsage.rss
        }
      };
    });

    // API health check
    this.addCheck('api', async () => {
      try {
        // Simulate API health check
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 10)); // Simulate API call
        const responseTime = Date.now() - startTime;
        
        return {
          status: responseTime < 1000 ? 'healthy' : 'unhealthy',
          responseTime: responseTime,
          details: { endpoint: '/api/health', method: 'GET' }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          responseTime: Date.now(),
          error: error.message
        };
      }
    });

    // Disk space health check
    this.addCheck('disk', async () => {
      try {
        const fs = require('fs').promises;
        const stats = await fs.stat('./');
        
        // Simulated disk usage (in production, use proper disk usage library)
        const diskUsage = Math.random() * 100;
        
        return {
          status: diskUsage > 90 ? 'unhealthy' : 'healthy',
          responseTime: Date.now(),
          details: {
            usage: diskUsage.toFixed(1) + '%',
            path: './'
          }
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          responseTime: Date.now(),
          error: error.message
        };
      }
    });
  }

  addCheck(name, checkFunction) {
    this.checks.set(name, checkFunction);
  }

  async runCheck(name) {
    const checkFunction = this.checks.get(name);
    if (!checkFunction) {
      throw new Error(`Health check '${name}' not found`);
    }

    const startTime = Date.now();
    try {
      const result = await checkFunction();
      const endTime = Date.now();
      
      const checkResult = {
        name: name,
        timestamp: new Date().toISOString(),
        duration: endTime - startTime,
        ...result
      };
      
      this.results.set(name, checkResult);
      return checkResult;
    } catch (error) {
      const checkResult = {
        name: name,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        status: 'error',
        error: error.message
      };
      
      this.results.set(name, checkResult);
      return checkResult;
    }
  }

  async runAllChecks() {
    const results = {};
    const promises = Array.from(this.checks.keys()).map(async (name) => {
      results[name] = await this.runCheck(name);
    });
    
    await Promise.all(promises);
    
    const overallStatus = Object.values(results).every(r => r.status === 'healthy') 
      ? 'healthy' 
      : 'unhealthy';
    
    return {
      timestamp: new Date().toISOString(),
      status: overallStatus,
      checks: results,
      summary: {
        total: Object.keys(results).length,
        healthy: Object.values(results).filter(r => r.status === 'healthy').length,
        unhealthy: Object.values(results).filter(r => r.status === 'unhealthy').length,
        errors: Object.values(results).filter(r => r.status === 'error').length
      }
    };
  }

  getLastResults() {
    return Object.fromEntries(this.results);
  }
}

module.exports = HealthCheckManager;
