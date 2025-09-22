/**
 * Status Monitoring Component - Full Implementation
 * Phase 3, Day 12: Comprehensive status monitoring and analytics dashboard
 * Real-time system health, performance metrics, and operational insights
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  Chip,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  LinearProgress,
  CircularProgress,
  Switch,
  FormControlLabel,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Assessment as QualityIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  NetworkCheck as NetworkIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandIcon,
  Refresh as RefreshIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import { format, subHours } from 'date-fns';
import { StatusMonitoringProps } from '../../../types/ingestion';

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical' | 'degraded';
  score: number;
  components: {
    database: 'healthy' | 'warning' | 'critical';
    api: 'healthy' | 'warning' | 'critical';
    processing: 'healthy' | 'warning' | 'critical';
    storage: 'healthy' | 'warning' | 'critical';
    network: 'healthy' | 'warning' | 'critical';
  };
  lastCheck: Date;
}

interface PerformanceMetrics {
  timestamp: Date;
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  activeConnections: number;
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  networkLatency: number;
}

interface OperationalStats {
  totalDocuments: number;
  totalChunks: number;
  totalEmbeddings: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageProcessingTime: number;
  averageQualityScore: number;
  systemUptime: number;
  lastBackup: Date;
}

interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'system' | 'performance' | 'security' | 'data';
  source: string;
}

// Mock status monitoring service
class StatusMonitoringService {
  private static instance: StatusMonitoringService;
  private metrics: PerformanceMetrics[] = [];
  private alerts: SystemAlert[] = [];
  private isMonitoring = false;

  static getInstance(): StatusMonitoringService {
    if (!StatusMonitoringService.instance) {
      StatusMonitoringService.instance = new StatusMonitoringService();
      StatusMonitoringService.instance.initializeMockData();
    }
    return StatusMonitoringService.instance;
  }

  private initializeMockData() {
    // Generate historical metrics (last 24 hours)
    const now = new Date();
    for (let i = 143; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 10 * 60000); // Every 10 minutes
      this.metrics.push({
        timestamp,
        requestsPerSecond: 50 + Math.random() * 100,
        averageResponseTime: 100 + Math.random() * 200,
        errorRate: Math.random() * 5,
        throughput: 1000 + Math.random() * 500,
        activeConnections: 20 + Math.random() * 30,
        memoryUsage: 40 + Math.random() * 40,
        cpuUsage: 20 + Math.random() * 60,
        diskUsage: 60 + Math.random() * 20,
        networkLatency: 10 + Math.random() * 40,
      });
    }

    // Generate system alerts
    this.alerts = [
      {
        id: 'alert_001',
        type: 'warning',
        title: 'High Memory Usage',
        message: 'System memory usage has exceeded 85% threshold',
        timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
        acknowledged: false,
        severity: 'medium',
        category: 'performance',
        source: 'System Monitor',
      },
      {
        id: 'alert_002',
        type: 'success',
        title: 'Backup Completed',
        message: 'Daily knowledge base backup completed successfully',
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
        acknowledged: true,
        severity: 'low',
        category: 'data',
        source: 'Backup Service',
      },
      {
        id: 'alert_003',
        type: 'error',
        title: 'Processing Job Failed',
        message: 'Enhanced processing job failed with validation errors',
        timestamp: new Date(Date.now() - 7200000), // 2 hours ago
        acknowledged: false,
        severity: 'high',
        category: 'system',
        source: 'Processing Engine',
      },
    ];
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    const interval = setInterval(() => {
      // Add new metric point
      const latest = this.metrics[this.metrics.length - 1];
      const newMetric: PerformanceMetrics = {
        timestamp: new Date(),
        requestsPerSecond: Math.max(0, latest.requestsPerSecond + (Math.random() - 0.5) * 20),
        averageResponseTime: Math.max(50, latest.averageResponseTime + (Math.random() - 0.5) * 50),
        errorRate: Math.max(0, Math.min(10, latest.errorRate + (Math.random() - 0.5) * 1)),
        throughput: Math.max(500, latest.throughput + (Math.random() - 0.5) * 100),
        activeConnections: Math.max(0, latest.activeConnections + Math.floor((Math.random() - 0.5) * 10)),
        memoryUsage: Math.max(0, Math.min(100, latest.memoryUsage + (Math.random() - 0.5) * 5)),
        cpuUsage: Math.max(0, Math.min(100, latest.cpuUsage + (Math.random() - 0.5) * 15)),
        diskUsage: Math.max(0, Math.min(100, latest.diskUsage + (Math.random() - 0.5) * 2)),
        networkLatency: Math.max(5, latest.networkLatency + (Math.random() - 0.5) * 10),
      };

      this.metrics.push(newMetric);
      
      // Keep only last 144 points (24 hours at 10-minute intervals)
      if (this.metrics.length > 144) {
        this.metrics.shift();
      }

      // Occasionally generate alerts
      if (Math.random() > 0.98) {
        this.generateRandomAlert();
      }
    }, 10000); // Update every 10 seconds

    // Clean up after 10 minutes
    setTimeout(() => {
      clearInterval(interval);
      this.isMonitoring = false;
    }, 600000);
  }

  private generateRandomAlert() {
    const alertTypes = ['warning', 'info', 'error', 'success'] as const;
    const severities = ['low', 'medium', 'high'] as const;
    const categories = ['system', 'performance', 'security', 'data'] as const;
    const sources = ['System Monitor', 'Processing Engine', 'Database', 'API Gateway'];
    
    const messages = [
      'Performance threshold exceeded',
      'New processing job started',
      'System optimization completed',
      'Security scan finished',
      'Data backup in progress',
    ];

    const newAlert: SystemAlert = {
      id: `alert_${Date.now()}`,
      type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
      title: 'System Event',
      message: messages[Math.floor(Math.random() * messages.length)],
      timestamp: new Date(),
      acknowledged: false,
      severity: severities[Math.floor(Math.random() * severities.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
    };

    this.alerts.unshift(newAlert);
    
    // Keep only last 20 alerts
    if (this.alerts.length > 20) {
      this.alerts.pop();
    }
  }

  stopMonitoring() {
    this.isMonitoring = false;
  }

  getMetrics(timeRange: '1h' | '6h' | '24h' = '24h'): PerformanceMetrics[] {
    const now = new Date();
    let cutoff: Date;
    
    switch (timeRange) {
      case '1h':
        cutoff = subHours(now, 1);
        break;
      case '6h':
        cutoff = subHours(now, 6);
        break;
      default:
        cutoff = subHours(now, 24);
    }

    return this.metrics.filter(m => m.timestamp >= cutoff);
  }

  getAlerts(): SystemAlert[] {
    return this.alerts;
  }

  getSystemHealth(): SystemHealth {
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) {
      return {
        overall: 'critical',
        score: 0,
        components: {
          database: 'critical',
          api: 'critical',
          processing: 'critical',
          storage: 'critical',
          network: 'critical',
        },
        lastCheck: new Date(),
      };
    }

    // Calculate component health based on metrics
    const dbHealth = latest.errorRate < 2 ? 'healthy' : latest.errorRate < 5 ? 'warning' : 'critical';
    const apiHealth = latest.averageResponseTime < 200 ? 'healthy' : latest.averageResponseTime < 500 ? 'warning' : 'critical';
    const processingHealth = latest.cpuUsage < 70 ? 'healthy' : latest.cpuUsage < 90 ? 'warning' : 'critical';
    const storageHealth = latest.diskUsage < 80 ? 'healthy' : latest.diskUsage < 95 ? 'warning' : 'critical';
    const networkHealth = latest.networkLatency < 30 ? 'healthy' : latest.networkLatency < 60 ? 'warning' : 'critical';

    // Calculate overall health score
    const healthScores = {
      healthy: 100,
      warning: 70,
      critical: 30,
    };

    const avgScore = (
      healthScores[dbHealth] +
      healthScores[apiHealth] +
      healthScores[processingHealth] +
      healthScores[storageHealth] +
      healthScores[networkHealth]
    ) / 5;

    let overall: SystemHealth['overall'];
    if (avgScore >= 90) overall = 'healthy';
    else if (avgScore >= 70) overall = 'warning';
    else if (avgScore >= 50) overall = 'degraded';
    else overall = 'critical';

    return {
      overall,
      score: Math.round(avgScore),
      components: {
        database: dbHealth,
        api: apiHealth,
        processing: processingHealth,
        storage: storageHealth,
        network: networkHealth,
      },
      lastCheck: new Date(),
    };
  }

  getOperationalStats(): OperationalStats {
    return {
      totalDocuments: 1247,
      totalChunks: 45623,
      totalEmbeddings: 45623,
      activeJobs: 3,
      completedJobs: 892,
      failedJobs: 23,
      averageProcessingTime: 180000, // 3 minutes in ms
      averageQualityScore: 87.3,
      systemUptime: Date.now() - new Date('2024-01-01').getTime(),
      lastBackup: new Date(Date.now() - 3600000), // 1 hour ago
    };
  }

  acknowledgeAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }
}

const StatusMonitoring: React.FC<StatusMonitoringProps> = ({
  refreshInterval = 10000,
  enableRealTime = true,
  showAlerts = true,
  showMetrics = true,
}) => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [operationalStats, setOperationalStats] = useState<OperationalStats | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('24h');
  const [realTimeEnabled, setRealTimeEnabled] = useState(enableRealTime);
  const [alertsExpanded, setAlertsExpanded] = useState(true);
  const [metricsExpanded, setMetricsExpanded] = useState(true);
  const [healthExpanded, setHealthExpanded] = useState(true);

  const monitoringService = StatusMonitoringService.getInstance();

  // Initialize and manage monitoring
  useEffect(() => {
    const updateData = () => {
      setSystemHealth(monitoringService.getSystemHealth());
      setMetrics(monitoringService.getMetrics(timeRange));
      setAlerts(monitoringService.getAlerts());
      setOperationalStats(monitoringService.getOperationalStats());
    };

    updateData();

    if (realTimeEnabled) {
      monitoringService.startMonitoring();
      const interval = setInterval(updateData, refreshInterval);
      return () => {
        clearInterval(interval);
        monitoringService.stopMonitoring();
      };
    }
  }, [realTimeEnabled, refreshInterval, timeRange]);

  // Get health color
  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'degraded': return 'info';
      case 'critical': return 'error';
      default: return 'default';
    }
  };

  // Get health icon
  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <SuccessIcon />;
      case 'warning': return <WarningIcon />;
      case 'degraded': return <InfoIcon />;
      case 'critical': return <ErrorIcon />;
      default: return <InfoIcon />;
    }
  };

  // Get alert color
  const getAlertColor = (type: string) => {
    switch (type) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'success': return 'success';
      default: return 'info';
    }
  };

  // Handle alert acknowledgment
  const handleAcknowledgeAlert = (alertId: string) => {
    monitoringService.acknowledgeAlert(alertId);
    setAlerts(monitoringService.getAlerts());
  };

  // Render system health overview
  const renderSystemHealth = () => {
    if (!systemHealth) return null;

    const healthData = [
      { name: 'Database', value: systemHealth.components.database === 'healthy' ? 100 : systemHealth.components.database === 'warning' ? 70 : 30, fill: systemHealth.components.database === 'healthy' ? '#4caf50' : systemHealth.components.database === 'warning' ? '#ff9800' : '#f44336' },
      { name: 'API', value: systemHealth.components.api === 'healthy' ? 100 : systemHealth.components.api === 'warning' ? 70 : 30, fill: systemHealth.components.api === 'healthy' ? '#4caf50' : systemHealth.components.api === 'warning' ? '#ff9800' : '#f44336' },
      { name: 'Processing', value: systemHealth.components.processing === 'healthy' ? 100 : systemHealth.components.processing === 'warning' ? 70 : 30, fill: systemHealth.components.processing === 'healthy' ? '#4caf50' : systemHealth.components.processing === 'warning' ? '#ff9800' : '#f44336' },
      { name: 'Storage', value: systemHealth.components.storage === 'healthy' ? 100 : systemHealth.components.storage === 'warning' ? 70 : 30, fill: systemHealth.components.storage === 'healthy' ? '#4caf50' : systemHealth.components.storage === 'warning' ? '#ff9800' : '#f44336' },
      { name: 'Network', value: systemHealth.components.network === 'healthy' ? 100 : systemHealth.components.network === 'warning' ? 70 : 30, fill: systemHealth.components.network === 'healthy' ? '#4caf50' : systemHealth.components.network === 'warning' ? '#ff9800' : '#f44336' },
    ];

    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="System Health Overview"
              subheader={`Last check: ${format(systemHealth.lastCheck, 'HH:mm:ss')}`}
              action={
                <Box display="flex" alignItems="center" gap={1}>
                  {getHealthIcon(systemHealth.overall)}
                  <Chip
                    label={systemHealth.overall.toUpperCase()}
                    color={getHealthColor(systemHealth.overall) as any}
                    size="small"
                  />
                </Box>
              }
            />
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
                <Box position="relative" display="inline-flex">
                  <CircularProgress
                    variant="determinate"
                    value={systemHealth.score}
                    size={120}
                    thickness={4}
                    color={getHealthColor(systemHealth.overall) as any}
                  />
                  <Box
                    position="absolute"
                    top={0}
                    left={0}
                    bottom={0}
                    right={0}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Typography variant="h4" component="div" color="text.secondary">
                      {systemHealth.score}%
                    </Typography>
                  </Box>
                </Box>
              </Box>
              
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Overall System Health Score
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Component Health" />
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" data={healthData}>
                  <RadialBar dataKey="value" cornerRadius={10} fill="#8884d8" />
                  <Legend />
                </RadialBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardHeader title="Component Status Details" />
            <CardContent>
              <Grid container spacing={2}>
                {Object.entries(systemHealth.components).map(([component, status]) => (
                  <Grid item xs={12} sm={6} md={2.4} key={component}>
                    <Box textAlign="center" p={2} border={1} borderColor="divider" borderRadius={1}>
                      <Box color={`${getHealthColor(status)}.main`} mb={1}>
                        {component === 'database' && <StorageIcon />}
                        {component === 'api' && <NetworkIcon />}
                        {component === 'processing' && <SpeedIcon />}
                        {component === 'storage' && <MemoryIcon />}
                        {component === 'network' && <NetworkIcon />}
                      </Box>
                      <Typography variant="body2" fontWeight="medium" textTransform="capitalize">
                        {component}
                      </Typography>
                      <Chip
                        label={status}
                        color={getHealthColor(status) as any}
                        size="small"
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Render operational statistics
  const renderOperationalStats = () => {
    if (!operationalStats) return null;

    const statCards = [
      {
        title: 'Total Documents',
        value: operationalStats.totalDocuments.toLocaleString(),
        icon: <StorageIcon />,
        color: 'primary',
      },
      {
        title: 'Total Chunks',
        value: operationalStats.totalChunks.toLocaleString(),
        icon: <TimelineIcon />,
        color: 'secondary',
      },
      {
        title: 'Total Embeddings',
        value: operationalStats.totalEmbeddings.toLocaleString(),
        icon: <QualityIcon />,
        color: 'info',
      },
      {
        title: 'Active Jobs',
        value: operationalStats.activeJobs.toString(),
        icon: <SpeedIcon />,
        color: 'warning',
      },
      {
        title: 'Completed Jobs',
        value: operationalStats.completedJobs.toLocaleString(),
        icon: <SuccessIcon />,
        color: 'success',
      },
      {
        title: 'Failed Jobs',
        value: operationalStats.failedJobs.toString(),
        icon: <ErrorIcon />,
        color: 'error',
      },
      {
        title: 'Avg Processing Time',
        value: `${Math.round(operationalStats.averageProcessingTime / 1000)}s`,
        icon: <TimelineIcon />,
        color: 'info',
      },
      {
        title: 'Avg Quality Score',
        value: `${operationalStats.averageQualityScore.toFixed(1)}%`,
        icon: <QualityIcon />,
        color: 'success',
      },
    ];

    return (
      <Grid container spacing={2}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h5" color={`${stat.color}.main`}>
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.title}
                    </Typography>
                  </Box>
                  <Box color={`${stat.color}.main`}>
                    {stat.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  // Render performance charts
  const renderPerformanceCharts = () => {
    const chartData = metrics.map(metric => ({
      time: format(metric.timestamp, timeRange === '1h' ? 'HH:mm' : timeRange === '6h' ? 'HH:mm' : 'MM/dd HH:mm'),
      requests: metric.requestsPerSecond,
      responseTime: metric.averageResponseTime,
      errorRate: metric.errorRate,
      throughput: metric.throughput,
      memory: metric.memoryUsage,
      cpu: metric.cpuUsage,
      disk: metric.diskUsage,
      latency: metric.networkLatency,
    }));

    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Request Rate & Response Time" />
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <RechartsTooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="requests"
                    stroke="#1976d2"
                    strokeWidth={2}
                    dot={false}
                    name="Requests/sec"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="responseTime"
                    stroke="#f57c00"
                    strokeWidth={2}
                    dot={false}
                    name="Response Time (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="System Resources" />
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis domain={[0, 100]} />
                  <RechartsTooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="memory"
                    stackId="1"
                    stroke="#4caf50"
                    fill="#4caf50"
                    fillOpacity={0.6}
                    name="Memory %"
                  />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    stackId="2"
                    stroke="#ff9800"
                    fill="#ff9800"
                    fillOpacity={0.6}
                    name="CPU %"
                  />
                  <Area
                    type="monotone"
                    dataKey="disk"
                    stackId="3"
                    stroke="#9c27b0"
                    fill="#9c27b0"
                    fillOpacity={0.6}
                    name="Disk %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Error Rate & Throughput" />
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <RechartsTooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="errorRate"
                    stroke="#f44336"
                    strokeWidth={2}
                    dot={false}
                    name="Error Rate %"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="throughput"
                    stroke="#2196f3"
                    strokeWidth={2}
                    dot={false}
                    name="Throughput"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Network Latency" />
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData.slice(-20)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="latency" fill="#673ab7" name="Latency (ms)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Render alerts panel
  const renderAlertsPanel = () => {
    const unacknowledgedAlerts = alerts.filter(alert => !alert.acknowledged);

    return (
      <Card>
        <CardHeader
          title={
            <Box display="flex" alignItems="center" gap={1}>
              <Badge badgeContent={unacknowledgedAlerts.length} color="error">
                <NotificationsIcon />
              </Badge>
              <Typography variant="h6">
                System Alerts ({alerts.length})
              </Typography>
            </Box>
          }
          action={
            <Button
              size="small"
              onClick={() => setAlerts(monitoringService.getAlerts())}
              startIcon={<RefreshIcon />}
            >
              Refresh
            </Button>
          }
        />
        <CardContent>
          {alerts.length === 0 ? (
            <Alert severity="success">
              <AlertTitle>All Clear</AlertTitle>
              No system alerts at this time.
            </Alert>
          ) : (
            <List>
              {alerts.map((alert) => (
                <ListItem
                  key={alert.id}
                  sx={{
                    border: 1,
                    borderColor: alert.acknowledged ? 'grey.300' : `${getAlertColor(alert.type)}.main`,
                    borderRadius: 1,
                    mb: 1,
                    opacity: alert.acknowledged ? 0.7 : 1,
                  }}
                >
                  <ListItemIcon>
                    {alert.type === 'error' && <ErrorIcon />}
                    {alert.type === 'warning' && <WarningIcon />}
                    {alert.type === 'success' && <SuccessIcon />}
                    {alert.type === 'info' && <InfoIcon />}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        {alert.title}
                        <Chip
                          label={alert.severity}
                          size="small"
                          color={getAlertColor(alert.type) as any}
                        />
                        <Chip
                          label={alert.category}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2">{alert.message}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {alert.source} • {format(alert.timestamp, 'MMM dd, yyyy HH:mm:ss')}
                        </Typography>
                      </Box>
                    }
                  />
                  {!alert.acknowledged && (
                    <ListItemSecondaryAction>
                      <Button
                        size="small"
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">
          System Status Dashboard
        </Typography>
        <Box display="flex" gap={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              label="Time Range"
            >
              <MenuItem value="1h">Last Hour</MenuItem>
              <MenuItem value="6h">Last 6 Hours</MenuItem>
              <MenuItem value="24h">Last 24 Hours</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={realTimeEnabled}
                onChange={(e) => setRealTimeEnabled(e.target.checked)}
              />
            }
            label="Real-time"
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => {
              setSystemHealth(monitoringService.getSystemHealth());
              setMetrics(monitoringService.getMetrics(timeRange));
              setAlerts(monitoringService.getAlerts());
              setOperationalStats(monitoringService.getOperationalStats());
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* System Health Overview */}
      {showMetrics && (
        <Accordion expanded={healthExpanded} onChange={() => setHealthExpanded(!healthExpanded)} sx={{ mb: 3 }}>
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Typography variant="h6">System Health</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {renderSystemHealth()}
          </AccordionDetails>
        </Accordion>
      )}

      {/* Operational Statistics */}
      <Box mb={3}>
        <Typography variant="h6" gutterBottom>
          Operational Statistics
        </Typography>
        {renderOperationalStats()}
      </Box>

      {/* Performance Metrics */}
      {showMetrics && (
        <Accordion expanded={metricsExpanded} onChange={() => setMetricsExpanded(!metricsExpanded)} sx={{ mb: 3 }}>
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Typography variant="h6">Performance Metrics</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {renderPerformanceCharts()}
          </AccordionDetails>
        </Accordion>
      )}

      {/* System Alerts */}
      {showAlerts && (
        <Accordion expanded={alertsExpanded} onChange={() => setAlertsExpanded(!alertsExpanded)}>
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Typography variant="h6">System Alerts</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {renderAlertsPanel()}
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};

export default StatusMonitoring;
