/**
 * Processing Monitor Component
 * Phase 3, Day 11: Real-time processing monitoring and analytics
 * Advanced monitoring dashboard with performance metrics and alerts
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
  IconButton,
  Chip,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  CircularProgress,
  Switch,
  FormControlLabel,
  Tooltip,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Assessment as QualityIcon,
  Memory as MemoryIcon,
  Timer as TimerIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandIcon,
  Refresh as RefreshIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  Fullscreen as FullscreenIcon,
  GetApp as DownloadIcon,
  Share as ShareIcon,
  Settings as SettingsIcon,
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
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { IngestionJob } from '../../../types/ingestion';

interface ProcessingMonitorProps {
  currentJob?: IngestionJob;
  refreshInterval: number;
  enableRealTime: boolean;
}

interface PerformanceMetrics {
  timestamp: Date;
  processingRate: number;
  memoryUsage: number;
  cpuUsage: number;
  queueLength: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageQuality: number;
  throughput: number;
}

interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'performance' | 'quality' | 'system' | 'job';
}

// Mock monitoring service
class MonitoringService {
  private static instance: MonitoringService;
  private metrics: PerformanceMetrics[] = [];
  private alerts: SystemAlert[] = [];
  private isGeneratingData = false;

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
      MonitoringService.instance.initializeMockData();
    }
    return MonitoringService.instance;
  }

  private initializeMockData() {
    // Generate initial metrics data
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60000); // Every minute
      this.metrics.push({
        timestamp,
        processingRate: 2.5 + Math.random() * 2,
        memoryUsage: 45 + Math.random() * 30,
        cpuUsage: 30 + Math.random() * 40,
        queueLength: Math.floor(Math.random() * 10),
        activeJobs: Math.floor(Math.random() * 3) + 1,
        completedJobs: Math.floor(Math.random() * 50) + 100,
        failedJobs: Math.floor(Math.random() * 5),
        averageQuality: 75 + Math.random() * 20,
        throughput: 150 + Math.random() * 100,
      });
    }

    // Generate initial alerts
    this.alerts = [
      {
        id: 'alert_001',
        type: 'warning',
        title: 'High Memory Usage',
        message: 'Memory usage has exceeded 80% for the last 5 minutes',
        timestamp: new Date(Date.now() - 300000),
        acknowledged: false,
        severity: 'medium',
        category: 'performance',
      },
      {
        id: 'alert_002',
        type: 'info',
        title: 'Job Completed Successfully',
        message: 'Enhanced processing job for compliance manual completed with 92% quality',
        timestamp: new Date(Date.now() - 600000),
        acknowledged: true,
        severity: 'low',
        category: 'job',
      },
      {
        id: 'alert_003',
        type: 'error',
        title: 'Processing Failed',
        message: 'Simple processing job failed due to validation errors',
        timestamp: new Date(Date.now() - 1800000),
        acknowledged: false,
        severity: 'high',
        category: 'job',
      },
    ];
  }

  startRealTimeUpdates() {
    if (this.isGeneratingData) return;
    
    this.isGeneratingData = true;
    const interval = setInterval(() => {
      // Add new metric point
      const latest = this.metrics[this.metrics.length - 1];
      const newMetric: PerformanceMetrics = {
        timestamp: new Date(),
        processingRate: Math.max(0, latest.processingRate + (Math.random() - 0.5) * 0.5),
        memoryUsage: Math.max(0, Math.min(100, latest.memoryUsage + (Math.random() - 0.5) * 5)),
        cpuUsage: Math.max(0, Math.min(100, latest.cpuUsage + (Math.random() - 0.5) * 10)),
        queueLength: Math.max(0, latest.queueLength + Math.floor((Math.random() - 0.5) * 3)),
        activeJobs: Math.max(0, Math.min(5, latest.activeJobs + Math.floor((Math.random() - 0.5) * 2))),
        completedJobs: latest.completedJobs + Math.floor(Math.random() * 2),
        failedJobs: latest.failedJobs + (Math.random() > 0.9 ? 1 : 0),
        averageQuality: Math.max(0, Math.min(100, latest.averageQuality + (Math.random() - 0.5) * 3)),
        throughput: Math.max(0, latest.throughput + (Math.random() - 0.5) * 20),
      };

      this.metrics.push(newMetric);
      
      // Keep only last 30 points
      if (this.metrics.length > 30) {
        this.metrics.shift();
      }

      // Occasionally generate alerts
      if (Math.random() > 0.95) {
        this.generateRandomAlert();
      }
    }, 5000);

    // Clean up after 5 minutes
    setTimeout(() => {
      clearInterval(interval);
      this.isGeneratingData = false;
    }, 300000);
  }

  private generateRandomAlert() {
    const alertTypes = ['warning', 'info', 'error'] as const;
    const severities = ['low', 'medium', 'high'] as const;
    const categories = ['performance', 'quality', 'system', 'job'] as const;
    
    const messages = [
      'Processing rate has increased significantly',
      'New job added to queue',
      'Quality threshold exceeded',
      'System resources optimized',
      'Background maintenance completed',
    ];

    const newAlert: SystemAlert = {
      id: `alert_${Date.now()}`,
      type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
      title: 'System Update',
      message: messages[Math.floor(Math.random() * messages.length)],
      timestamp: new Date(),
      acknowledged: false,
      severity: severities[Math.floor(Math.random() * severities.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
    };

    this.alerts.unshift(newAlert);
    
    // Keep only last 10 alerts
    if (this.alerts.length > 10) {
      this.alerts.pop();
    }
  }

  stopRealTimeUpdates() {
    this.isGeneratingData = false;
  }

  getMetrics(): PerformanceMetrics[] {
    return this.metrics;
  }

  getAlerts(): SystemAlert[] {
    return this.alerts;
  }

  acknowledgeAlert(alertId: string) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  getCurrentStats() {
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) return null;

    return {
      processingRate: latest.processingRate,
      memoryUsage: latest.memoryUsage,
      cpuUsage: latest.cpuUsage,
      queueLength: latest.queueLength,
      activeJobs: latest.activeJobs,
      totalCompleted: latest.completedJobs,
      totalFailed: latest.failedJobs,
      averageQuality: latest.averageQuality,
      throughput: latest.throughput,
    };
  }
}

const ProcessingMonitor: React.FC<ProcessingMonitorProps> = ({
  currentJob,
  refreshInterval,
  enableRealTime,
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [realTimeEnabled, setRealTimeEnabled] = useState(enableRealTime);
  const [alertsExpanded, setAlertsExpanded] = useState(true);
  const [metricsExpanded, setMetricsExpanded] = useState(true);

  const monitoringService = MonitoringService.getInstance();

  // Initialize and manage real-time updates
  useEffect(() => {
    const updateData = () => {
      setMetrics(monitoringService.getMetrics());
      setAlerts(monitoringService.getAlerts());
    };

    updateData();

    if (realTimeEnabled) {
      monitoringService.startRealTimeUpdates();
      const interval = setInterval(updateData, refreshInterval);
      return () => {
        clearInterval(interval);
        monitoringService.stopRealTimeUpdates();
      };
    }
  }, [realTimeEnabled, refreshInterval]);

  // Handle alert acknowledgment
  const handleAcknowledgeAlert = (alertId: string) => {
    monitoringService.acknowledgeAlert(alertId);
    setAlerts(monitoringService.getAlerts());
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

  // Get alert icon
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error': return <ErrorIcon />;
      case 'warning': return <WarningIcon />;
      case 'success': return <SuccessIcon />;
      default: return <InfoIcon />;
    }
  };

  // Render current stats cards
  const renderStatsCards = () => {
    const stats = monitoringService.getCurrentStats();
    if (!stats) return null;

    const statCards = [
      {
        title: 'Processing Rate',
        value: `${stats.processingRate.toFixed(1)} docs/min`,
        icon: <SpeedIcon />,
        color: 'primary',
        trend: stats.processingRate > 2.5 ? 'up' : 'down',
      },
      {
        title: 'Memory Usage',
        value: `${Math.round(stats.memoryUsage)}%`,
        icon: <MemoryIcon />,
        color: stats.memoryUsage > 80 ? 'error' : 'secondary',
        trend: stats.memoryUsage > 60 ? 'up' : 'down',
      },
      {
        title: 'Queue Length',
        value: stats.queueLength.toString(),
        icon: <TimelineIcon />,
        color: 'info',
        trend: stats.queueLength > 5 ? 'up' : 'down',
      },
      {
        title: 'Average Quality',
        value: `${Math.round(stats.averageQuality)}%`,
        icon: <QualityIcon />,
        color: stats.averageQuality > 80 ? 'success' : 'warning',
        trend: stats.averageQuality > 80 ? 'up' : 'down',
      },
    ];

    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="h4" color={`${stat.color}.main`}>
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.title}
                    </Typography>
                  </Box>
                  <Box display="flex" flexDirection="column" alignItems="center">
                    <Box color={`${stat.color}.main`} mb={0.5}>
                      {stat.icon}
                    </Box>
                    {stat.trend === 'up' ? (
                      <TrendingUpIcon color="success" fontSize="small" />
                    ) : (
                      <TrendingDownIcon color="error" fontSize="small" />
                    )}
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
      time: format(metric.timestamp, 'HH:mm'),
      processingRate: metric.processingRate,
      memoryUsage: metric.memoryUsage,
      cpuUsage: metric.cpuUsage,
      quality: metric.averageQuality,
      throughput: metric.throughput,
    }));

    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Processing Rate" />
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <RechartsTooltip />
                  <Line
                    type="monotone"
                    dataKey="processingRate"
                    stroke="#1976d2"
                    strokeWidth={2}
                    dot={false}
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
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <RechartsTooltip />
                  <Area
                    type="monotone"
                    dataKey="memoryUsage"
                    stackId="1"
                    stroke="#f57c00"
                    fill="#f57c00"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="cpuUsage"
                    stackId="2"
                    stroke="#388e3c"
                    fill="#388e3c"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Quality Metrics" />
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis domain={[0, 100]} />
                  <RechartsTooltip />
                  <Line
                    type="monotone"
                    dataKey="quality"
                    stroke="#4caf50"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Throughput" />
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData.slice(-10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="throughput" fill="#9c27b0" />
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
      <Paper sx={{ mt: 3 }}>
        <Accordion expanded={alertsExpanded} onChange={() => setAlertsExpanded(!alertsExpanded)}>
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              <Badge badgeContent={unacknowledgedAlerts.length} color="error">
                <NotificationsIcon />
              </Badge>
              <Typography variant="h6">
                System Alerts ({alerts.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
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
                      {getAlertIcon(alert.type)}
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
                            {format(alert.timestamp, 'MMM dd, yyyy HH:mm:ss')}
                          </Typography>
                        </Box>
                      }
                    />
                    {!alert.acknowledged && (
                      <Button
                        size="small"
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </ListItem>
                ))}
              </List>
            )}
          </AccordionDetails>
        </Accordion>
      </Paper>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">
          Processing Monitor
        </Typography>
        <Box display="flex" gap={1} alignItems="center">
          <FormControlLabel
            control={
              <Switch
                checked={realTimeEnabled}
                onChange={(e) => setRealTimeEnabled(e.target.checked)}
              />
            }
            label="Real-time Updates"
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => {
              setMetrics(monitoringService.getMetrics());
              setAlerts(monitoringService.getAlerts());
            }}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Current Stats */}
      {renderStatsCards()}

      {/* Performance Charts */}
      <Paper sx={{ mb: 3 }}>
        <Accordion expanded={metricsExpanded} onChange={() => setMetricsExpanded(!metricsExpanded)}>
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Typography variant="h6">Performance Metrics</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {renderPerformanceCharts()}
          </AccordionDetails>
        </Accordion>
      </Paper>

      {/* Current Job Status */}
      {currentJob && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Current Job Status
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <Box mb={2}>
                <Typography variant="body2" gutterBottom>
                  {currentJob.progress.currentStep}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={currentJob.progress.progressPercentage}
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption">
                  {Math.round(currentJob.progress.progressPercentage)}% Complete
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="body2">
                Method: {currentJob.method.toUpperCase()}
              </Typography>
              <Typography variant="body2">
                Quality: {Math.round(currentJob.stats.overallQualityScore)}%
              </Typography>
              <Typography variant="body2">
                Chunks: {currentJob.stats.chunksGenerated}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* System Alerts */}
      {renderAlertsPanel()}
    </Box>
  );
};

export default ProcessingMonitor;
