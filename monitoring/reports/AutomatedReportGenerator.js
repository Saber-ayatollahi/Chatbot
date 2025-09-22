
const fs = require('fs').promises;
const path = require('path');
const MonitoringDashboard = require('./dashboards/MonitoringDashboard');

class AutomatedReportGenerator {
  constructor() {
    this.dashboard = new MonitoringDashboard();
    this.reportSchedule = {
      hourly: 3600000,  // 1 hour
      daily: 86400000,  // 24 hours
      weekly: 604800000 // 7 days
    };
  }

  async generateReport(type, metrics, timeRange = '1h') {
    const report = {
      timestamp: new Date().toISOString(),
      type: type,
      timeRange: timeRange,
      summary: this.generateSummary(metrics),
      details: this.generateDetails(metrics),
      recommendations: this.generateRecommendations(metrics)
    };

    return report;
  }

  generateSummary(metrics) {
    return {
      systemHealth: this.assessSystemHealth(metrics.system),
      applicationPerformance: this.assessApplicationPerformance(metrics.application),
      alertsCount: metrics.alerts?.length || 0,
      healthStatus: this.assessOverallHealth(metrics)
    };
  }

  generateDetails(metrics) {
    return {
      system: {
        cpu: metrics.system?.cpu,
        memory: metrics.system?.memory,
        disk: metrics.system?.disk,
        network: metrics.system?.network
      },
      application: {
        requests: metrics.application?.requests,
        performance: metrics.application?.performance,
        errors: metrics.application?.errors
      },
      alerts: metrics.alerts || [],
      health: metrics.health || {}
    };
  }

  generateRecommendations(metrics) {
    const recommendations = [];

    // System recommendations
    if (metrics.system?.cpu?.usage > 70) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Consider CPU optimization or scaling',
        details: `CPU usage at ${metrics.system.cpu.usage.toFixed(1)}%`
      });
    }

    if (metrics.system?.memory?.usage > 80) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Memory usage is high, consider optimization',
        details: `Memory usage at ${metrics.system.memory.usage.toFixed(1)}%`
      });
    }

    // Application recommendations
    if (metrics.application?.performance?.responseTime?.avg > 1500) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Response times are elevated',
        details: `Average response time: ${metrics.application.performance.responseTime.avg.toFixed(0)}ms`
      });
    }

    if (metrics.application?.errors?.rate > 3) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        message: 'Error rate is above acceptable threshold',
        details: `Error rate: ${metrics.application.errors.rate.toFixed(1)}%`
      });
    }

    return recommendations;
  }

  assessSystemHealth(systemMetrics) {
    if (!systemMetrics) return 'unknown';
    
    const scores = [];
    
    if (systemMetrics.cpu?.usage !== undefined) {
      scores.push(systemMetrics.cpu.usage < 80 ? 100 : 100 - systemMetrics.cpu.usage);
    }
    
    if (systemMetrics.memory?.usage !== undefined) {
      scores.push(systemMetrics.memory.usage < 85 ? 100 : 100 - systemMetrics.memory.usage);
    }
    
    if (systemMetrics.disk?.usage !== undefined) {
      scores.push(systemMetrics.disk.usage < 90 ? 100 : 100 - systemMetrics.disk.usage);
    }
    
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    if (avgScore >= 90) return 'excellent';
    if (avgScore >= 75) return 'good';
    if (avgScore >= 60) return 'fair';
    return 'poor';
  }

  assessApplicationPerformance(appMetrics) {
    if (!appMetrics) return 'unknown';
    
    let score = 100;
    
    // Response time impact
    if (appMetrics.performance?.responseTime?.avg > 2000) score -= 30;
    else if (appMetrics.performance?.responseTime?.avg > 1000) score -= 15;
    
    // Error rate impact
    if (appMetrics.errors?.rate > 5) score -= 40;
    else if (appMetrics.errors?.rate > 2) score -= 20;
    
    // Request rate (positive indicator)
    if (appMetrics.requests?.rate > 10) score += 10;
    
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    return 'poor';
  }

  assessOverallHealth(metrics) {
    const systemHealth = this.assessSystemHealth(metrics.system);
    const appPerformance = this.assessApplicationPerformance(metrics.application);
    const alertsCount = metrics.alerts?.length || 0;
    
    if (alertsCount > 5) return 'critical';
    if (systemHealth === 'poor' || appPerformance === 'poor') return 'poor';
    if (systemHealth === 'fair' || appPerformance === 'fair') return 'fair';
    if (systemHealth === 'good' && appPerformance === 'good') return 'good';
    return 'excellent';
  }

  async saveReport(report, filename) {
    const reportsDir = path.join(process.cwd(), 'monitoring', 'reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    const filepath = path.join(reportsDir, filename);
    await fs.writeFile(filepath, JSON.stringify(report, null, 2));
    
    return filepath;
  }

  async generateMarkdownReport(report) {
    return `# Monitoring Report - ${report.type}

Generated: ${report.timestamp}
Time Range: ${report.timeRange}

## Summary
- System Health: ${report.summary.systemHealth}
- Application Performance: ${report.summary.applicationPerformance}
- Active Alerts: ${report.summary.alertsCount}
- Overall Health: ${report.summary.healthStatus}

## System Metrics
${this.formatSystemMetrics(report.details.system)}

## Application Metrics
${this.formatApplicationMetrics(report.details.application)}

## Recommendations
${this.formatRecommendations(report.recommendations)}

---
*Report generated by Advanced Monitoring System*
`;
  }

  formatSystemMetrics(system) {
    return `
- CPU Usage: ${system.cpu?.usage?.toFixed(1) || 'N/A'}%
- Memory Usage: ${system.memory?.usage?.toFixed(1) || 'N/A'}%
- Disk Usage: ${system.disk?.usage?.toFixed(1) || 'N/A'}%
- Network Connections: ${system.network?.connections || 'N/A'}
`;
  }

  formatApplicationMetrics(application) {
    return `
- Total Requests: ${application.requests?.total || 0}
- Average Response Time: ${application.performance?.responseTime?.avg?.toFixed(0) || 0}ms
- Error Rate: ${application.errors?.rate?.toFixed(2) || 0}%
- Request Rate: ${application.requests?.rate?.toFixed(2) || 0} req/sec
`;
  }

  formatRecommendations(recommendations) {
    if (!recommendations || recommendations.length === 0) {
      return 'No recommendations at this time.';
    }
    
    return recommendations.map(rec => 
      `- [${rec.priority.toUpperCase()}] ${rec.message} (${rec.details})`
    ).join('\n');
  }
}

module.exports = AutomatedReportGenerator;
