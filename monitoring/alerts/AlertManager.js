
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class AlertManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      thresholds: {
        cpu: 80,
        memory: 85,
        disk: 90,
        responseTime: 2000,
        errorRate: 5,
        ...config.thresholds
      },
      channels: ['console', 'file', ...(config.channels || [])],
      escalation: {
        low: { delay: 600000 },    // 10 minutes
        medium: { delay: 300000 }, // 5 minutes
        high: { delay: 180000 },   // 3 minutes
        critical: { delay: 60000 }, // 1 minute
        ...config.escalation
      }
    };
    
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.on('alert', this.handleAlert.bind(this));
    this.on('resolve', this.handleResolve.bind(this));
  }

  checkMetrics(metrics) {
    const alerts = [];
    
    // System metrics checks
    if (metrics.system) {
      if (metrics.system.cpu.usage > this.config.thresholds.cpu) {
        alerts.push(this.createAlert('high_cpu_usage', 'high', {
          current: metrics.system.cpu.usage,
          threshold: this.config.thresholds.cpu,
          message: `CPU usage at ${metrics.system.cpu.usage.toFixed(1)}%`
        }));
      }
      
      if (metrics.system.memory.usage > this.config.thresholds.memory) {
        alerts.push(this.createAlert('high_memory_usage', 'high', {
          current: metrics.system.memory.usage,
          threshold: this.config.thresholds.memory,
          message: `Memory usage at ${metrics.system.memory.usage.toFixed(1)}%`
        }));
      }
      
      if (metrics.system.disk.usage > this.config.thresholds.disk) {
        alerts.push(this.createAlert('high_disk_usage', 'critical', {
          current: metrics.system.disk.usage,
          threshold: this.config.thresholds.disk,
          message: `Disk usage at ${metrics.system.disk.usage.toFixed(1)}%`
        }));
      }
    }
    
    // Application metrics checks
    if (metrics.application) {
      if (metrics.application.performance.responseTime.avg > this.config.thresholds.responseTime) {
        alerts.push(this.createAlert('slow_response_time', 'medium', {
          current: metrics.application.performance.responseTime.avg,
          threshold: this.config.thresholds.responseTime,
          message: `Average response time: ${metrics.application.performance.responseTime.avg.toFixed(0)}ms`
        }));
      }
      
      if (metrics.application.errors.rate > this.config.thresholds.errorRate) {
        alerts.push(this.createAlert('high_error_rate', 'high', {
          current: metrics.application.errors.rate,
          threshold: this.config.thresholds.errorRate,
          message: `Error rate at ${metrics.application.errors.rate.toFixed(1)}%`
        }));
      }
    }
    
    // Process alerts
    for (const alert of alerts) {
      this.emit('alert', alert);
    }
    
    // Check for resolved alerts
    this.checkResolvedAlerts(metrics);
  }

  createAlert(type, severity, data) {
    return {
      id: `${type}-${Date.now()}`,
      type: type,
      severity: severity,
      timestamp: new Date().toISOString(),
      data: data,
      resolved: false,
      resolvedAt: null
    };
  }

  async handleAlert(alert) {
    const existingAlert = this.activeAlerts.get(alert.type);
    
    if (existingAlert) {
      // Update existing alert
      existingAlert.data = alert.data;
      existingAlert.timestamp = alert.timestamp;
    } else {
      // New alert
      this.activeAlerts.set(alert.type, alert);
      this.alertHistory.push(alert);
      
      // Send notifications
      await this.sendNotifications(alert);
    }
  }

  async handleResolve(alertType) {
    const alert = this.activeAlerts.get(alertType);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      this.activeAlerts.delete(alertType);
      
      await this.sendNotifications({
        ...alert,
        message: `RESOLVED: ${alert.data.message}`
      });
    }
  }

  checkResolvedAlerts(metrics) {
    // Check if any active alerts should be resolved
    for (const [type, alert] of this.activeAlerts) {
      let shouldResolve = false;
      
      switch (type) {
        case 'high_cpu_usage':
          shouldResolve = metrics.system?.cpu.usage < this.config.thresholds.cpu * 0.9;
          break;
        case 'high_memory_usage':
          shouldResolve = metrics.system?.memory.usage < this.config.thresholds.memory * 0.9;
          break;
        case 'high_disk_usage':
          shouldResolve = metrics.system?.disk.usage < this.config.thresholds.disk * 0.9;
          break;
        case 'slow_response_time':
          shouldResolve = metrics.application?.performance.responseTime.avg < this.config.thresholds.responseTime * 0.9;
          break;
        case 'high_error_rate':
          shouldResolve = metrics.application?.errors.rate < this.config.thresholds.errorRate * 0.9;
          break;
      }
      
      if (shouldResolve) {
        this.emit('resolve', type);
      }
    }
  }

  async sendNotifications(alert) {
    for (const channel of this.config.channels) {
      try {
        await this.sendToChannel(channel, alert);
      } catch (error) {
        console.error(`Failed to send alert to ${channel}:`, error.message);
      }
    }
  }

  async sendToChannel(channel, alert) {
    switch (channel) {
      case 'console':
        this.sendToConsole(alert);
        break;
      case 'file':
        await this.sendToFile(alert);
        break;
      default:
        console.warn(`Unknown alert channel: ${channel}`);
    }
  }

  sendToConsole(alert) {
    const emoji = this.getSeverityEmoji(alert.severity);
    const message = `${emoji} [${alert.severity.toUpperCase()}] ${alert.data.message}`;
    
    if (alert.severity === 'critical' || alert.severity === 'high') {
      console.error(message);
    } else {
      console.warn(message);
    }
  }

  async sendToFile(alert) {
    const logDir = path.join(process.cwd(), 'logs', 'monitoring');
    await fs.mkdir(logDir, { recursive: true });
    
    const logFile = path.join(logDir, 'alerts.log');
    const logEntry = `[${alert.timestamp}] [${alert.severity.toUpperCase()}] ${alert.type}: ${alert.data.message}\n`;
    
    await fs.appendFile(logFile, logEntry);
  }

  getSeverityEmoji(severity) {
    const emojis = {
      low: '🟡',
      medium: '🟠', 
      high: '🔴',
      critical: '🚨'
    };
    return emojis[severity] || '⚪';
  }

  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(-limit);
  }
}

module.exports = AlertManager;
