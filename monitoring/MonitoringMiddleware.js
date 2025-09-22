
const SystemMetricsCollector = require('./metrics/SystemMetricsCollector');
const ApplicationMetricsCollector = require('./metrics/ApplicationMetricsCollector');
const AlertManager = require('./alerts/AlertManager');
const HealthCheckManager = require('./health-checks/HealthCheckManager');

class MonitoringMiddleware {
  constructor(config = {}) {
    this.systemMetrics = new SystemMetricsCollector();
    this.appMetrics = new ApplicationMetricsCollector();
    this.alertManager = new AlertManager(config.alerts);
    this.healthCheck = new HealthCheckManager();
    
    this.config = {
      collectInterval: 30000, // 30 seconds
      alertCheckInterval: 60000, // 1 minute
      healthCheckInterval: 120000, // 2 minutes
      ...config
    };
    
    this.startCollection();
  }

  // Express middleware for request monitoring
  requestMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Override res.end to capture response time
      const originalEnd = res.end;
      res.end = (...args) => {
        const responseTime = Date.now() - startTime;
        
        // Record metrics
        this.appMetrics.recordRequest(
          req.path,
          req.method,
          responseTime,
          res.statusCode
        );
        
        // Call original end
        originalEnd.apply(res, args);
      };
      
      next();
    };
  }

  // Error monitoring middleware
  errorMiddleware() {
    return (error, req, res, next) => {
      // Record error
      this.appMetrics.recordError(error, req.path);
      
      // Continue with error handling
      next(error);
    };
  }

  startCollection() {
    // System metrics collection
    setInterval(async () => {
      try {
        const systemMetrics = await this.systemMetrics.collectMetrics();
        const appMetrics = this.appMetrics.getMetrics();
        
        const combinedMetrics = {
          timestamp: new Date().toISOString(),
          system: systemMetrics,
          application: appMetrics
        };
        
        // Check for alerts
        this.alertManager.checkMetrics(combinedMetrics);
        
        // Store metrics (could be sent to external monitoring service)
        this.storeMetrics(combinedMetrics);
        
      } catch (error) {
        console.error('Error collecting metrics:', error);
      }
    }, this.config.collectInterval);

    // Health checks
    setInterval(async () => {
      try {
        await this.healthCheck.runAllChecks();
      } catch (error) {
        console.error('Error running health checks:', error);
      }
    }, this.config.healthCheckInterval);
  }

  async storeMetrics(metrics) {
    // In production, you might send these to a time-series database
    // For now, we'll just log them
    const fs = require('fs').promises;
    const path = require('path');
    
    const metricsDir = path.join(process.cwd(), 'logs', 'monitoring');
    await fs.mkdir(metricsDir, { recursive: true });
    
    const filename = `metrics-${new Date().toISOString().split('T')[0]}.log`;
    const filepath = path.join(metricsDir, filename);
    
    const logEntry = JSON.stringify(metrics) + '\n';
    await fs.appendFile(filepath, logEntry);
  }

  getMetrics() {
    return {
      system: this.systemMetrics.metrics,
      application: this.appMetrics.getMetrics(),
      alerts: this.alertManager.getActiveAlerts(),
      health: this.healthCheck.getLastResults()
    };
  }

  getAlerts() {
    return this.alertManager.getActiveAlerts();
  }

  async getHealthStatus() {
    return await this.healthCheck.runAllChecks();
  }
}

module.exports = MonitoringMiddleware;
