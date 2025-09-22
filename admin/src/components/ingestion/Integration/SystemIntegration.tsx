/**
 * System Integration Component - Full Implementation
 * Phase 3, Day 14: Comprehensive system integration and orchestration
 * Advanced integration management with component coordination and system health monitoring
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
  CardActions,
  Button,
  IconButton,
  Chip,
  Alert,
  AlertTitle,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  LinearProgress,
  CircularProgress,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  Integration as IntegrationIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Visibility as ViewIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  NetworkCheck as NetworkIcon,
  Security as SecurityIcon,
  Assessment as ReportIcon,
  ExpandMore as ExpandIcon,
  CloudUpload as UploadIcon,
  CloudDownload as DownloadIcon,
  Sync as SyncIcon,
  Build as BuildIcon,
  BugReport as BugIcon,
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
  RadialBarChart,
  RadialBar,
  Legend,
} from 'recharts';
import { format } from 'date-fns';

interface SystemComponent {
  id: string;
  name: string;
  description: string;
  type: 'ui' | 'service' | 'database' | 'api' | 'external';
  status: 'healthy' | 'warning' | 'error' | 'offline';
  version: string;
  dependencies: string[];
  healthScore: number;
  lastCheck: Date;
  metrics: ComponentMetrics;
}

interface ComponentMetrics {
  uptime: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  memoryUsage: number;
  cpuUsage: number;
}

interface IntegrationTest {
  id: string;
  name: string;
  description: string;
  components: string[];
  status: 'pending' | 'running' | 'passed' | 'failed';
  lastRun?: Date;
  duration?: number;
  results?: TestResult[];
}

interface TestResult {
  component: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  details?: any;
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical' | 'degraded';
  score: number;
  components: Record<string, ComponentMetrics>;
  lastUpdate: Date;
  trends: HealthTrend[];
}

interface HealthTrend {
  timestamp: Date;
  score: number;
  category: string;
}

interface SystemIntegrationProps {
  enableRealTimeMonitoring?: boolean;
  enableAutomaticTesting?: boolean;
  enablePerformanceOptimization?: boolean;
  refreshInterval?: number;
}

// Mock system integration service
class SystemIntegrationService {
  private static instance: SystemIntegrationService;
  private components: SystemComponent[] = [];
  private integrationTests: IntegrationTest[] = [];
  private systemHealth: SystemHealth;
  private isMonitoring = false;

  static getInstance(): SystemIntegrationService {
    if (!SystemIntegrationService.instance) {
      SystemIntegrationService.instance = new SystemIntegrationService();
      SystemIntegrationService.instance.initializeMockData();
    }
    return SystemIntegrationService.instance;
  }

  private initializeMockData() {
    // Initialize system components
    this.components = [
      {
        id: 'document_upload',
        name: 'Document Upload',
        description: 'File upload and staging management component',
        type: 'ui',
        status: 'healthy',
        version: '1.2.0',
        dependencies: ['file_validation', 'storage_service'],
        healthScore: 95,
        lastCheck: new Date(),
        metrics: {
          uptime: 99.8,
          responseTime: 120,
          errorRate: 0.2,
          throughput: 150,
          memoryUsage: 45,
          cpuUsage: 12,
        },
      },
      {
        id: 'processing_pipeline',
        name: 'Processing Pipeline',
        description: 'Document processing and ingestion pipeline',
        type: 'service',
        status: 'healthy',
        version: '2.1.0',
        dependencies: ['openai_api', 'database', 'chunking_service'],
        healthScore: 92,
        lastCheck: new Date(),
        metrics: {
          uptime: 99.5,
          responseTime: 2500,
          errorRate: 0.8,
          throughput: 85,
          memoryUsage: 78,
          cpuUsage: 35,
        },
      },
      {
        id: 'knowledge_base',
        name: 'Knowledge Base',
        description: 'Vector database and search functionality',
        type: 'database',
        status: 'warning',
        version: '1.5.2',
        dependencies: ['pgvector', 'postgresql'],
        healthScore: 78,
        lastCheck: new Date(),
        metrics: {
          uptime: 98.9,
          responseTime: 450,
          errorRate: 2.1,
          throughput: 200,
          memoryUsage: 82,
          cpuUsage: 28,
        },
      },
      {
        id: 'monitoring_system',
        name: 'Monitoring System',
        description: 'System health and performance monitoring',
        type: 'service',
        status: 'healthy',
        version: '1.0.5',
        dependencies: ['metrics_collector', 'alert_service'],
        healthScore: 88,
        lastCheck: new Date(),
        metrics: {
          uptime: 99.9,
          responseTime: 85,
          errorRate: 0.1,
          throughput: 300,
          memoryUsage: 32,
          cpuUsage: 8,
        },
      },
      {
        id: 'configuration_manager',
        name: 'Configuration Manager',
        description: 'System configuration and settings management',
        type: 'service',
        status: 'healthy',
        version: '1.1.0',
        dependencies: ['config_storage', 'validation_service'],
        healthScore: 94,
        lastCheck: new Date(),
        metrics: {
          uptime: 99.7,
          responseTime: 95,
          errorRate: 0.3,
          throughput: 120,
          memoryUsage: 28,
          cpuUsage: 5,
        },
      },
      {
        id: 'openai_api',
        name: 'OpenAI API',
        description: 'External OpenAI API integration',
        type: 'external',
        status: 'healthy',
        version: 'v1',
        dependencies: [],
        healthScore: 96,
        lastCheck: new Date(),
        metrics: {
          uptime: 99.9,
          responseTime: 1200,
          errorRate: 0.1,
          throughput: 50,
          memoryUsage: 0,
          cpuUsage: 0,
        },
      },
    ];

    // Initialize integration tests
    this.integrationTests = [
      {
        id: 'end_to_end_workflow',
        name: 'End-to-End Document Processing',
        description: 'Complete workflow from upload to knowledge base storage',
        components: ['document_upload', 'processing_pipeline', 'knowledge_base'],
        status: 'passed',
        lastRun: new Date(Date.now() - 3600000), // 1 hour ago
        duration: 45000, // 45 seconds
        results: [
          {
            component: 'document_upload',
            status: 'passed',
            message: 'File upload completed successfully',
          },
          {
            component: 'processing_pipeline',
            status: 'passed',
            message: 'Document processed and chunked',
          },
          {
            component: 'knowledge_base',
            status: 'passed',
            message: 'Embeddings stored in vector database',
          },
        ],
      },
      {
        id: 'configuration_sync',
        name: 'Configuration Synchronization',
        description: 'Test configuration updates across all components',
        components: ['configuration_manager', 'processing_pipeline', 'monitoring_system'],
        status: 'passed',
        lastRun: new Date(Date.now() - 7200000), // 2 hours ago
        duration: 12000, // 12 seconds
        results: [
          {
            component: 'configuration_manager',
            status: 'passed',
            message: 'Configuration updated successfully',
          },
          {
            component: 'processing_pipeline',
            status: 'passed',
            message: 'Configuration applied and validated',
          },
          {
            component: 'monitoring_system',
            status: 'passed',
            message: 'Monitoring thresholds updated',
          },
        ],
      },
      {
        id: 'api_integration',
        name: 'External API Integration',
        description: 'Test integration with external services',
        components: ['openai_api', 'processing_pipeline'],
        status: 'warning',
        lastRun: new Date(Date.now() - 1800000), // 30 minutes ago
        duration: 8000, // 8 seconds
        results: [
          {
            component: 'openai_api',
            status: 'passed',
            message: 'API connection established',
          },
          {
            component: 'processing_pipeline',
            status: 'warning',
            message: 'Increased response times detected',
          },
        ],
      },
    ];

    // Initialize system health
    this.systemHealth = {
      overall: 'healthy',
      score: 89,
      components: this.components.reduce((acc, comp) => {
        acc[comp.id] = comp.metrics;
        return acc;
      }, {} as Record<string, ComponentMetrics>),
      lastUpdate: new Date(),
      trends: this.generateHealthTrends(),
    };
  }

  private generateHealthTrends(): HealthTrend[] {
    const trends: HealthTrend[] = [];
    const now = new Date();
    
    for (let i = 23; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000); // Every hour for 24 hours
      trends.push({
        timestamp,
        score: 85 + Math.random() * 10, // 85-95 range
        category: 'overall',
      });
    }
    
    return trends;
  }

  getComponents(): SystemComponent[] {
    return this.components;
  }

  getIntegrationTests(): IntegrationTest[] {
    return this.integrationTests;
  }

  getSystemHealth(): SystemHealth {
    return this.systemHealth;
  }

  async runIntegrationTest(testId: string): Promise<IntegrationTest> {
    const test = this.integrationTests.find(t => t.id === testId);
    if (!test) {
      throw new Error(`Integration test not found: ${testId}`);
    }

    test.status = 'running';
    const startTime = Date.now();

    // Simulate test execution
    await new Promise(resolve => setTimeout(resolve, Math.random() * 5000 + 2000));

    // Generate test results
    const results: TestResult[] = test.components.map(componentId => {
      const component = this.components.find(c => c.id === componentId);
      const success = Math.random() > 0.1; // 90% success rate
      
      return {
        component: componentId,
        status: success ? 'passed' : Math.random() > 0.5 ? 'failed' : 'warning',
        message: success 
          ? `${component?.name || componentId} integration successful`
          : `${component?.name || componentId} integration issues detected`,
      };
    });

    test.status = results.every(r => r.status === 'passed') ? 'passed' : 
                 results.some(r => r.status === 'failed') ? 'failed' : 'warning';
    test.lastRun = new Date();
    test.duration = Date.now() - startTime;
    test.results = results;

    return test;
  }

  async runAllIntegrationTests(): Promise<IntegrationTest[]> {
    const results: IntegrationTest[] = [];
    
    for (const test of this.integrationTests) {
      const result = await this.runIntegrationTest(test.id);
      results.push(result);
    }
    
    return results;
  }

  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    
    const interval = setInterval(() => {
      // Update component metrics
      this.components.forEach(component => {
        const metrics = component.metrics;
        
        // Simulate metric fluctuations
        metrics.responseTime += (Math.random() - 0.5) * 50;
        metrics.errorRate = Math.max(0, metrics.errorRate + (Math.random() - 0.5) * 0.5);
        metrics.throughput += (Math.random() - 0.5) * 20;
        metrics.memoryUsage = Math.max(0, Math.min(100, metrics.memoryUsage + (Math.random() - 0.5) * 5));
        metrics.cpuUsage = Math.max(0, Math.min(100, metrics.cpuUsage + (Math.random() - 0.5) * 10));
        
        // Update health score based on metrics
        component.healthScore = Math.max(0, Math.min(100, 
          100 - (metrics.errorRate * 10) - (Math.max(0, metrics.responseTime - 1000) / 100)
        ));
        
        // Update status based on health score
        if (component.healthScore >= 90) {
          component.status = 'healthy';
        } else if (component.healthScore >= 70) {
          component.status = 'warning';
        } else {
          component.status = 'error';
        }
        
        component.lastCheck = new Date();
      });
      
      // Update system health
      const avgScore = this.components.reduce((sum, comp) => sum + comp.healthScore, 0) / this.components.length;
      this.systemHealth.score = Math.round(avgScore);
      
      if (avgScore >= 90) {
        this.systemHealth.overall = 'healthy';
      } else if (avgScore >= 70) {
        this.systemHealth.overall = 'warning';
      } else if (avgScore >= 50) {
        this.systemHealth.overall = 'degraded';
      } else {
        this.systemHealth.overall = 'critical';
      }
      
      this.systemHealth.lastUpdate = new Date();
      
      // Add new health trend point
      this.systemHealth.trends.push({
        timestamp: new Date(),
        score: avgScore,
        category: 'overall',
      });
      
      // Keep only last 24 hours of trends
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      this.systemHealth.trends = this.systemHealth.trends.filter(t => t.timestamp >= cutoff);
      
    }, 10000); // Update every 10 seconds

    // Clean up after 10 minutes
    setTimeout(() => {
      clearInterval(interval);
      this.isMonitoring = false;
    }, 600000);
  }

  stopMonitoring() {
    this.isMonitoring = false;
  }

  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  getComponentDependencyGraph(): { nodes: any[], edges: any[] } {
    const nodes = this.components.map(comp => ({
      id: comp.id,
      label: comp.name,
      type: comp.type,
      status: comp.status,
      healthScore: comp.healthScore,
    }));

    const edges: any[] = [];
    this.components.forEach(comp => {
      comp.dependencies.forEach(depId => {
        edges.push({
          from: depId,
          to: comp.id,
          type: 'dependency',
        });
      });
    });

    return { nodes, edges };
  }

  async optimizeSystem(): Promise<{
    optimizations: string[];
    estimatedImprovement: number;
    affectedComponents: string[];
  }> {
    // Simulate system optimization
    await new Promise(resolve => setTimeout(resolve, 3000));

    const optimizations = [
      'Optimized database query performance',
      'Reduced memory usage in processing pipeline',
      'Improved caching strategy',
      'Enhanced error handling and recovery',
      'Updated component configurations',
    ];

    const affectedComponents = this.components
      .filter(comp => comp.healthScore < 90)
      .map(comp => comp.id);

    return {
      optimizations,
      estimatedImprovement: Math.random() * 15 + 5, // 5-20% improvement
      affectedComponents,
    };
  }
}

const SystemIntegration: React.FC<SystemIntegrationProps> = ({
  enableRealTimeMonitoring = true,
  enableAutomaticTesting = true,
  enablePerformanceOptimization = true,
  refreshInterval = 10000,
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [components, setComponents] = useState<SystemComponent[]>([]);
  const [integrationTests, setIntegrationTests] = useState<IntegrationTest[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<SystemComponent | null>(null);
  const [componentDetailsOpen, setComponentDetailsOpen] = useState(false);
  const [optimizationResults, setOptimizationResults] = useState<any>(null);
  const [healthExpanded, setHealthExpanded] = useState(true);
  const [componentsExpanded, setComponentsExpanded] = useState(true);
  const [testsExpanded, setTestsExpanded] = useState(true);

  const integrationService = SystemIntegrationService.getInstance();

  // Load data on mount and refresh
  useEffect(() => {
    refreshData();
    
    if (enableRealTimeMonitoring) {
      integrationService.startMonitoring();
      const interval = setInterval(refreshData, refreshInterval);
      return () => {
        clearInterval(interval);
        integrationService.stopMonitoring();
      };
    }
  }, [enableRealTimeMonitoring, refreshInterval]);

  const refreshData = () => {
    setComponents(integrationService.getComponents());
    setIntegrationTests(integrationService.getIntegrationTests());
    setSystemHealth(integrationService.getSystemHealth());
  };

  // Handle running all integration tests
  const handleRunAllTests = async () => {
    setIsRunningTests(true);
    try {
      await integrationService.runAllIntegrationTests();
      refreshData();
    } catch (error) {
      console.error('Integration tests failed:', error);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Handle system optimization
  const handleOptimizeSystem = async () => {
    setIsOptimizing(true);
    try {
      const results = await integrationService.optimizeSystem();
      setOptimizationResults(results);
      refreshData();
    } catch (error) {
      console.error('System optimization failed:', error);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      case 'offline': return 'error';
      case 'passed': return 'success';
      case 'failed': return 'error';
      case 'running': return 'info';
      default: return 'default';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <SuccessIcon />;
      case 'warning': return <WarningIcon />;
      case 'error': return <ErrorIcon />;
      case 'offline': return <ErrorIcon />;
      case 'passed': return <SuccessIcon />;
      case 'failed': return <ErrorIcon />;
      case 'running': return <CircularProgress size={20} />;
      default: return <InfoIcon />;
    }
  };

  // Render system health overview
  const renderSystemHealthOverview = () => {
    if (!systemHealth) return null;

    const trendData = systemHealth.trends.slice(-12).map(trend => ({
      time: format(trend.timestamp, 'HH:mm'),
      score: trend.score,
    }));

    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="System Health Score"
              subheader={`Last updated: ${format(systemHealth.lastUpdate, 'HH:mm:ss')}`}
              action={
                <Box display="flex" alignItems="center" gap={1}>
                  {getStatusIcon(systemHealth.overall)}
                  <Chip
                    label={systemHealth.overall.toUpperCase()}
                    color={getStatusColor(systemHealth.overall) as any}
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
                    color={getStatusColor(systemHealth.overall) as any}
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
                Overall System Health
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Health Trend (Last 12 Hours)" />
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis domain={[0, 100]} />
                  <RechartsTooltip />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#1976d2"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardHeader title="Component Health Summary" />
            <CardContent>
              <Grid container spacing={2}>
                {components.map((component) => (
                  <Grid item xs={12} sm={6} md={4} lg={2} key={component.id}>
                    <Box
                      textAlign="center"
                      p={2}
                      border={1}
                      borderColor="divider"
                      borderRadius={1}
                      sx={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedComponent(component);
                        setComponentDetailsOpen(true);
                      }}
                    >
                      <Box color={`${getStatusColor(component.status)}.main`} mb={1}>
                        {component.type === 'ui' && <IntegrationIcon />}
                        {component.type === 'service' && <SpeedIcon />}
                        {component.type === 'database' && <StorageIcon />}
                        {component.type === 'api' && <NetworkIcon />}
                        {component.type === 'external' && <NetworkIcon />}
                      </Box>
                      <Typography variant="body2" fontWeight="medium">
                        {component.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {component.healthScore}%
                      </Typography>
                      <Box mt={0.5}>
                        <Chip
                          label={component.status}
                          color={getStatusColor(component.status) as any}
                          size="small"
                        />
                      </Box>
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

  // Render component details
  const renderComponentDetails = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">System Components ({components.length})</Typography>
        <Box display="flex" gap={1}>
          {enablePerformanceOptimization && (
            <Button
              variant="contained"
              startIcon={isOptimizing ? <CircularProgress size={16} /> : <BuildIcon />}
              onClick={handleOptimizeSystem}
              disabled={isOptimizing}
            >
              {isOptimizing ? 'Optimizing...' : 'Optimize System'}
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={refreshData}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {optimizationResults && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setOptimizationResults(null)}>
          <AlertTitle>System Optimization Complete</AlertTitle>
          Applied {optimizationResults.optimizations.length} optimizations with estimated {optimizationResults.estimatedImprovement.toFixed(1)}% improvement.
        </Alert>
      )}

      <Grid container spacing={3}>
        {components.map((component) => (
          <Grid item xs={12} md={6} lg={4} key={component.id}>
            <Card>
              <CardHeader
                title={component.name}
                subheader={`v${component.version} • ${component.type}`}
                avatar={getStatusIcon(component.status)}
                action={
                  <Chip
                    label={`${component.healthScore}%`}
                    color={getStatusColor(component.status) as any}
                    size="small"
                  />
                }
              />
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {component.description}
                </Typography>
                
                <Box mt={2}>
                  <Typography variant="body2" fontWeight="medium" gutterBottom>
                    Key Metrics:
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Uptime: {component.metrics.uptime.toFixed(1)}% | 
                    Response: {component.metrics.responseTime.toFixed(0)}ms | 
                    Errors: {component.metrics.errorRate.toFixed(1)}%
                  </Typography>
                </Box>

                {component.dependencies.length > 0 && (
                  <Box mt={1}>
                    <Typography variant="body2" fontWeight="medium" gutterBottom>
                      Dependencies:
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {component.dependencies.map((dep) => (
                        <Chip key={dep} label={dep} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                )}
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  startIcon={<ViewIcon />}
                  onClick={() => {
                    setSelectedComponent(component);
                    setComponentDetailsOpen(true);
                  }}
                >
                  Details
                </Button>
                <Button size="small" startIcon={<SettingsIcon />}>
                  Configure
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  // Render integration tests
  const renderIntegrationTests = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Integration Tests ({integrationTests.length})
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="contained"
            startIcon={isRunningTests ? <CircularProgress size={16} /> : <StartIcon />}
            onClick={handleRunAllTests}
            disabled={isRunningTests}
          >
            {isRunningTests ? 'Running Tests...' : 'Run All Tests'}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={refreshData}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {integrationTests.map((test) => (
          <Grid item xs={12} md={6} key={test.id}>
            <Card>
              <CardHeader
                title={test.name}
                subheader={test.description}
                avatar={getStatusIcon(test.status)}
                action={
                  <Chip
                    label={test.status.toUpperCase()}
                    color={getStatusColor(test.status) as any}
                    size="small"
                  />
                }
              />
              <CardContent>
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary">
                    Components: {test.components.length}
                  </Typography>
                  {test.lastRun && (
                    <Typography variant="body2" color="text.secondary">
                      Last Run: {format(test.lastRun, 'MMM dd, HH:mm')}
                    </Typography>
                  )}
                  {test.duration && (
                    <Typography variant="body2" color="text.secondary">
                      Duration: {(test.duration / 1000).toFixed(1)}s
                    </Typography>
                  )}
                </Box>

                <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
                  {test.components.map((componentId) => {
                    const component = components.find(c => c.id === componentId);
                    return (
                      <Chip
                        key={componentId}
                        label={component?.name || componentId}
                        size="small"
                        variant="outlined"
                      />
                    );
                  })}
                </Box>

                {test.results && (
                  <Box>
                    <Typography variant="body2" fontWeight="medium" gutterBottom>
                      Test Results:
                    </Typography>
                    <List dense>
                      {test.results.map((result, index) => (
                        <ListItem key={index} sx={{ py: 0 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            {getStatusIcon(result.status)}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography variant="body2">
                                {components.find(c => c.id === result.component)?.name || result.component}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="caption" color="text.secondary">
                                {result.message}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  startIcon={<StartIcon />}
                  onClick={() => integrationService.runIntegrationTest(test.id)}
                  disabled={isRunningTests}
                >
                  Run Test
                </Button>
                <Button size="small" startIcon={<ViewIcon />}>
                  View Details
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  // Render component details dialog
  const renderComponentDetailsDialog = () => (
    <Dialog
      open={componentDetailsOpen}
      onClose={() => setComponentDetailsOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Component Details: {selectedComponent?.name}
      </DialogTitle>
      <DialogContent>
        {selectedComponent && (
          <Box>
            <Grid container spacing={2} mb={2}>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Type:</strong> {selectedComponent.type}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Version:</strong> {selectedComponent.version}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Status:</strong> {selectedComponent.status}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Health Score:</strong> {selectedComponent.healthScore}%
                </Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Performance Metrics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Uptime:</strong> {selectedComponent.metrics.uptime.toFixed(2)}%
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Response Time:</strong> {selectedComponent.metrics.responseTime.toFixed(0)}ms
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Error Rate:</strong> {selectedComponent.metrics.errorRate.toFixed(2)}%
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Throughput:</strong> {selectedComponent.metrics.throughput.toFixed(0)} req/min
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Memory Usage:</strong> {selectedComponent.metrics.memoryUsage.toFixed(1)}%
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>CPU Usage:</strong> {selectedComponent.metrics.cpuUsage.toFixed(1)}%
                </Typography>
              </Grid>
            </Grid>

            {selectedComponent.dependencies.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Dependencies ({selectedComponent.dependencies.length})
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {selectedComponent.dependencies.map((dep) => (
                    <Chip key={dep} label={dep} variant="outlined" />
                  ))}
                </Box>
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setComponentDetailsOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">
          System Integration Dashboard
        </Typography>
        <Box display="flex" gap={1} alignItems="center">
          <FormControlLabel
            control={
              <Switch
                checked={integrationService.isMonitoringActive()}
                onChange={(e) => {
                  if (e.target.checked) {
                    integrationService.startMonitoring();
                  } else {
                    integrationService.stopMonitoring();
                  }
                }}
              />
            }
            label="Real-time Monitoring"
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={refreshData}
          >
            Refresh All
          </Button>
        </Box>
      </Box>

      <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tab icon={<ReportIcon />} label="System Health" iconPosition="start" />
        <Tab icon={<IntegrationIcon />} label="Components" iconPosition="start" />
        <Tab icon={<BugIcon />} label="Integration Tests" iconPosition="start" />
      </Tabs>

      {currentTab === 0 && (
        <Accordion expanded={healthExpanded} onChange={() => setHealthExpanded(!healthExpanded)}>
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Typography variant="h6">System Health Overview</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {renderSystemHealthOverview()}
          </AccordionDetails>
        </Accordion>
      )}

      {currentTab === 1 && (
        <Accordion expanded={componentsExpanded} onChange={() => setComponentsExpanded(!componentsExpanded)}>
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Typography variant="h6">System Components</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {renderComponentDetails()}
          </AccordionDetails>
        </Accordion>
      )}

      {currentTab === 2 && (
        <Accordion expanded={testsExpanded} onChange={() => setTestsExpanded(!testsExpanded)}>
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Typography variant="h6">Integration Tests</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {renderIntegrationTests()}
          </AccordionDetails>
        </Accordion>
      )}

      {/* Dialogs */}
      {renderComponentDetailsDialog()}
    </Box>
  );
};

export default SystemIntegration;
