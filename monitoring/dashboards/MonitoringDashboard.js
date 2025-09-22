
class MonitoringDashboard {
  constructor() {
    this.refreshInterval = 5000; // 5 seconds
    this.charts = new Map();
  }

  generateSystemDashboard(metrics) {
    return `
# System Health Dashboard
Generated: ${new Date().toISOString()}

## CPU Usage
Current: ${metrics.cpu?.usage?.toFixed(1) || 0}%
Cores: ${metrics.cpu?.cores || 0}
Status: ${this.getStatusIndicator(metrics.cpu?.usage, 80)}

## Memory Usage  
Used: ${this.formatBytes(metrics.memory?.used || 0)}
Total: ${this.formatBytes(metrics.memory?.total || 0)}
Usage: ${metrics.memory?.usage?.toFixed(1) || 0}%
Status: ${this.getStatusIndicator(metrics.memory?.usage, 85)}

## Disk Usage
Used: ${this.formatBytes(metrics.disk?.used || 0)}
Total: ${this.formatBytes(metrics.disk?.total || 0)}
Usage: ${metrics.disk?.usage?.toFixed(1) || 0}%
Status: ${this.getStatusIndicator(metrics.disk?.usage, 90)}

## Network
Bytes In: ${this.formatBytes(metrics.network?.bytesIn || 0)}
Bytes Out: ${this.formatBytes(metrics.network?.bytesOut || 0)}
Connections: ${metrics.network?.connections || 0}
`;
  }

  generateApplicationDashboard(metrics) {
    return `
# Application Performance Dashboard
Generated: ${new Date().toISOString()}

## Request Metrics
Total Requests: ${metrics.requests?.total || 0}
Successful: ${metrics.requests?.successful || 0}
Failed: ${metrics.requests?.failed || 0}
Success Rate: ${this.calculateSuccessRate(metrics.requests)}%
Request Rate: ${metrics.requests?.rate?.toFixed(2) || 0} req/sec

## Response Time
Average: ${metrics.performance?.responseTime?.avg?.toFixed(0) || 0}ms
95th Percentile: ${metrics.performance?.responseTime?.p95?.toFixed(0) || 0}ms
99th Percentile: ${metrics.performance?.responseTime?.p99?.toFixed(0) || 0}ms
Status: ${this.getStatusIndicator(metrics.performance?.responseTime?.avg, 2000)}

## Error Metrics
Total Errors: ${metrics.errors?.total || 0}
Error Rate: ${metrics.errors?.rate?.toFixed(2) || 0}%
Status: ${this.getStatusIndicator(metrics.errors?.rate, 5)}

## Top Endpoints
${this.formatEndpoints(metrics.endpoints)}
`;
  }

  generateBusinessDashboard(metrics) {
    return `
# Business KPIs Dashboard
Generated: ${new Date().toISOString()}

## Quality Metrics
Context Quality: ${metrics.quality?.contextQuality || 0}%
Retrieval Precision: ${metrics.quality?.retrievalPrecision || 0}%
Semantic Coherence: ${metrics.quality?.semanticCoherence || 0}%

## User Metrics
User Satisfaction: ${metrics.business?.userSatisfaction || 0}%
Query Resolution Rate: ${metrics.business?.queryResolutionRate || 0}%
Response Accuracy: ${metrics.business?.responseAccuracy || 0}%

## Performance Indicators
Processing Throughput: ${metrics.business?.processingThroughput || 0} docs/hour
Average Session Duration: ${metrics.business?.averageSessionDuration || 0} minutes
System Uptime: ${metrics.business?.systemUptime || 0}%
`;
  }

  getStatusIndicator(value, threshold) {
    if (!value) return '⚪ Unknown';
    if (value < threshold * 0.7) return '🟢 Good';
    if (value < threshold * 0.9) return '🟡 Warning';
    if (value < threshold) return '🟠 High';
    return '🔴 Critical';
  }

  calculateSuccessRate(requests) {
    if (!requests || requests.total === 0) return 0;
    return ((requests.successful / requests.total) * 100).toFixed(1);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatEndpoints(endpoints) {
    if (!endpoints) return 'No endpoint data available';
    
    const sorted = Object.entries(endpoints)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 5);
    
    return sorted.map(([endpoint, data]) => 
      `- ${endpoint}: ${data.count} requests, ${data.avgTime.toFixed(0)}ms avg`
    ).join('\n') || 'No endpoints recorded';
  }
}

module.exports = MonitoringDashboard;
