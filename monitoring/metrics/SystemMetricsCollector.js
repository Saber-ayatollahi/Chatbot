
const os = require('os');
const fs = require('fs').promises;
const { performance } = require('perf_hooks');

class SystemMetricsCollector {
  constructor() {
    this.metrics = {
      timestamp: null,
      cpu: { usage: 0, cores: os.cpus().length },
      memory: { used: 0, total: os.totalmem(), free: 0, usage: 0 },
      disk: { used: 0, total: 0, free: 0, usage: 0 },
      network: { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 }
    };
    
    this.previousCpuUsage = process.cpuUsage();
    this.startTime = performance.now();
  }

  async collectMetrics() {
    this.metrics.timestamp = new Date().toISOString();
    
    // CPU metrics
    await this.collectCpuMetrics();
    
    // Memory metrics
    await this.collectMemoryMetrics();
    
    // Disk metrics
    await this.collectDiskMetrics();
    
    // Network metrics (simulated)
    await this.collectNetworkMetrics();
    
    return { ...this.metrics };
  }

  async collectCpuMetrics() {
    const currentUsage = process.cpuUsage(this.previousCpuUsage);
    const currentTime = performance.now();
    const timeDiff = currentTime - this.startTime;
    
    // Calculate CPU usage percentage
    const totalUsage = currentUsage.user + currentUsage.system;
    const cpuPercent = (totalUsage / (timeDiff * 1000)) * 100;
    
    this.metrics.cpu.usage = Math.min(cpuPercent, 100);
    this.previousCpuUsage = process.cpuUsage();
    this.startTime = currentTime;
  }

  async collectMemoryMetrics() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    this.metrics.memory = {
      used: usedMem,
      total: totalMem,
      free: freeMem,
      usage: (usedMem / totalMem) * 100,
      heap: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        usage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      rss: memUsage.rss,
      external: memUsage.external
    };
  }

  async collectDiskMetrics() {
    try {
      const stats = await fs.stat('./');
      // Note: This is a simplified disk usage calculation
      // In production, you'd use a proper disk usage library
      this.metrics.disk = {
        used: stats.size || 0,
        total: 1000000000, // 1GB simulated
        free: 800000000,   // 800MB simulated
        usage: 20 // 20% simulated
      };
    } catch (error) {
      this.metrics.disk = { used: 0, total: 0, free: 0, usage: 0, error: error.message };
    }
  }

  async collectNetworkMetrics() {
    // Simulated network metrics
    // In production, you'd collect real network statistics
    this.metrics.network = {
      bytesIn: Math.floor(Math.random() * 1000000),
      bytesOut: Math.floor(Math.random() * 1000000),
      packetsIn: Math.floor(Math.random() * 10000),
      packetsOut: Math.floor(Math.random() * 10000),
      connections: Math.floor(Math.random() * 100) + 10
    };
  }
}

module.exports = SystemMetricsCollector;
