/**
 * Testing Dashboard Component - Full Implementation
 * Phase 3, Day 14: Comprehensive testing and optimization dashboard
 * Advanced testing interface with integration tests, performance monitoring, and optimization recommendations
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Assessment as ReportIcon,
  Speed as PerformanceIcon,
  Security as SecurityIcon,
  BugReport as BugIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandIcon,
  Timeline as TimelineIcon,
  Memory as MemoryIcon,
  NetworkCheck as NetworkIcon,
  Visibility as ViewIcon,
  GetApp as DownloadIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Lightbulb as RecommendationIcon,
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
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import {
  integrationTestingService,
  TestSuite,
  TestResult,
  TestScenario,
} from '../../../utils/integrationTesting';
import {
  performanceMonitoringService,
  PerformanceProfile,
  PerformanceMetric,
  OptimizationRecommendation,
  usePerformanceMonitoring,
} from '../../../utils/performanceOptimization';

interface TestingDashboardProps {
  enableIntegrationTests?: boolean;
  enablePerformanceMonitoring?: boolean;
  enableOptimizationRecommendations?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const TestingDashboard: React.FC<TestingDashboardProps> = ({
  enableIntegrationTests = true,
  enablePerformanceMonitoring = true,
  enableOptimizationRecommendations = true,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [performanceProfiles, setPerformanceProfiles] = useState<PerformanceProfile[]>([]);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState<string>('');
  const [testDetailsOpen, setTestDetailsOpen] = useState(false);
  const [selectedTestResult, setSelectedTestResult] = useState<TestResult | null>(null);
  const [performanceStatsExpanded, setPerformanceStatsExpanded] = useState(true);
  const [testResultsExpanded, setTestResultsExpanded] = useState(true);
  const [recommendationsExpanded, setRecommendationsExpanded] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const { startProfiling, stopProfiling, getStatistics, getRecommendations } = usePerformanceMonitoring();

  // Load data on mount and refresh
  useEffect(() => {
    refreshData();
    
    if (autoRefresh) {
      const interval = setInterval(refreshData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const refreshData = () => {
    if (enableIntegrationTests) {
      setTestSuites(integrationTestingService.getTestSuites());
      setTestResults(integrationTestingService.getTestResults());
    }
    
    if (enablePerformanceMonitoring) {
      setPerformanceProfiles(performanceMonitoringService.getProfiles());
    }
    
    if (enableOptimizationRecommendations) {
      setRecommendations(performanceMonitoringService.generateOptimizationRecommendations());
    }
  };

  // Handle test suite execution
  const handleRunTestSuite = async (suiteId: string) => {
    setIsRunningTests(true);
    try {
      const results = await integrationTestingService.runTestSuite(suiteId, {
        parallel: true,
        maxConcurrency: 3,
        stopOnFirstFailure: false,
        generateReport: true,
      });
      
      setTestResults(prev => [...prev, ...results]);
    } catch (error) {
      console.error('Test suite execution failed:', error);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Handle performance profiling
  const handleStartProfiling = () => {
    startProfiling('Dashboard Performance Test', 'Manual profiling session from testing dashboard');
  };

  const handleStopProfiling = () => {
    const profile = stopProfiling();
    if (profile) {
      setPerformanceProfiles(prev => [...prev, profile]);
    }
  };

  // Get test status color
  const getTestStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'success';
      case 'failed': return 'error';
      case 'skipped': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  // Get test status icon
  const getTestStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <SuccessIcon />;
      case 'failed': return <ErrorIcon />;
      case 'skipped': return <WarningIcon />;
      case 'error': return <BugIcon />;
      default: return <InfoIcon />;
    }
  };

  // Get recommendation priority color
  const getRecommendationPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  // Render test overview
  const renderTestOverview = () => {
    const testStats = integrationTestingService.getTestStatistics();
    
    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h4" color="primary">
                        {testStats.totalTests}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Tests
                      </Typography>
                    </Box>
                    <BugIcon color="primary" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h4" color="success.main">
                        {testStats.passedTests}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Passed
                      </Typography>
                    </Box>
                    <SuccessIcon color="success" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h4" color="error">
                        {testStats.failedTests}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Failed
                      </Typography>
                    </Box>
                    <ErrorIcon color="error" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h4" color="info.main">
                        {testStats.successRate.toFixed(1)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Success Rate
                      </Typography>
                    </Box>
                    <ReportIcon color="info" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Test Results Distribution" />
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Passed', value: testStats.passedTests, fill: '#4caf50' },
                      { name: 'Failed', value: testStats.failedTests, fill: '#f44336' },
                      { name: 'Skipped', value: testStats.skippedTests, fill: '#ff9800' },
                      { name: 'Error', value: testStats.errorTests, fill: '#9c27b0' },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={60}
                    dataKey="value"
                  >
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Render test suites
  const renderTestSuites = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Test Suites</Typography>
        <Box display="flex" gap={1}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Select Suite</InputLabel>
            <Select
              value={selectedSuite}
              onChange={(e) => setSelectedSuite(e.target.value)}
              label="Select Suite"
            >
              {testSuites.map((suite) => (
                <MenuItem key={suite.id} value={suite.id}>
                  {suite.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={isRunningTests ? <CircularProgress size={16} /> : <RunIcon />}
            onClick={() => selectedSuite && handleRunTestSuite(selectedSuite)}
            disabled={!selectedSuite || isRunningTests}
          >
            {isRunningTests ? 'Running...' : 'Run Tests'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {testSuites.map((suite) => (
          <Grid item xs={12} md={6} lg={4} key={suite.id}>
            <Card>
              <CardHeader
                title={suite.name}
                subheader={suite.description}
                action={
                  <Chip
                    label={suite.parallel ? 'Parallel' : 'Sequential'}
                    size="small"
                    color={suite.parallel ? 'primary' : 'default'}
                  />
                }
              />
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Scenarios: {suite.scenarios.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Max Concurrency: {suite.maxConcurrency}
                </Typography>
                
                <Box mt={2}>
                  <Typography variant="body2" fontWeight="medium" gutterBottom>
                    Categories:
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {Array.from(new Set(suite.scenarios.map(s => s.category))).map((category) => (
                      <Chip key={category} label={category} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  startIcon={<RunIcon />}
                  onClick={() => handleRunTestSuite(suite.id)}
                  disabled={isRunningTests}
                >
                  Run Suite
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

  // Render test results
  const renderTestResults = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Test Results ({testResults.length})
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
          >
            Export Results
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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Scenario</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Steps</TableCell>
              <TableCell>Errors</TableCell>
              <TableCell>Started</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {testResults.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((result) => (
              <TableRow key={`${result.scenarioId}-${result.startTime.getTime()}`}>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {result.scenarioId}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getTestStatusIcon(result.status)}
                    <Chip
                      label={result.status.toUpperCase()}
                      color={getTestStatusColor(result.status) as any}
                      size="small"
                    />
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {(result.duration / 1000).toFixed(2)}s
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {result.stepResults.filter(s => s.status === 'passed').length} / {result.stepResults.length}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color={result.errors.length > 0 ? 'error' : 'text.secondary'}>
                    {result.errors.length}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {format(result.startTime, 'MMM dd, HH:mm')}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Tooltip title="View Details">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedTestResult(result);
                        setTestDetailsOpen(true);
                      }}
                    >
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={testResults.length}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 25, 50]}
      />
    </Box>
  );

  // Render performance monitoring
  const renderPerformanceMonitoring = () => {
    const stats = getStatistics();
    const activeProfile = performanceMonitoringService.getActiveProfile();

    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Performance Monitoring</Typography>
          <Box display="flex" gap={1}>
            {activeProfile ? (
              <Button
                variant="contained"
                color="error"
                startIcon={<StopIcon />}
                onClick={handleStopProfiling}
              >
                Stop Profiling
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<RunIcon />}
                onClick={handleStartProfiling}
              >
                Start Profiling
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

        {activeProfile && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <AlertTitle>Active Profiling Session</AlertTitle>
            Profiling "{activeProfile.name}" started at {format(activeProfile.startTime, 'HH:mm:ss')}
          </Alert>
        )}

        <Grid container spacing={3}>
          {Object.entries(stats).map(([category, data]) => (
            <Grid item xs={12} sm={6} md={4} key={category}>
              <Card>
                <CardHeader
                  title={category.charAt(0).toUpperCase() + category.slice(1)}
                  avatar={
                    category === 'render' ? <TimelineIcon /> :
                    category === 'memory' ? <MemoryIcon /> :
                    category === 'network' ? <NetworkIcon /> :
                    <PerformanceIcon />
                  }
                />
                <CardContent>
                  <Typography variant="h6" color="primary">
                    {data.average?.toFixed(2) || 0}
                    {category === 'memory' ? ' MB' : ' ms'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Average ({data.count || 0} samples)
                  </Typography>
                  
                  <Box mt={1}>
                    <Typography variant="caption" color="text.secondary">
                      Min: {data.min?.toFixed(2) || 0} | Max: {data.max?.toFixed(2) || 0}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Box mt={3}>
          <Typography variant="h6" gutterBottom>
            Performance Profiles ({performanceProfiles.length})
          </Typography>
          
          <List>
            {performanceProfiles.slice(-5).map((profile) => (
              <ListItem key={profile.id} divider>
                <ListItemIcon>
                  <PerformanceIcon />
                </ListItemIcon>
                <ListItemText
                  primary={profile.name}
                  secondary={
                    <Box>
                      <Typography variant="body2">
                        {profile.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Duration: {profile.duration ? (profile.duration / 1000).toFixed(2) + 's' : 'Active'} | 
                        Metrics: {profile.metrics.length} | 
                        Started: {format(profile.startTime, 'MMM dd, HH:mm')}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton size="small">
                    <ViewIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      </Box>
    );
  };

  // Render optimization recommendations
  const renderOptimizationRecommendations = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Optimization Recommendations ({recommendations.length})
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={() => setRecommendations(getRecommendations())}
        >
          Refresh
        </Button>
      </Box>

      {recommendations.length === 0 ? (
        <Alert severity="success">
          <AlertTitle>Great Performance!</AlertTitle>
          No optimization recommendations at this time. Your application is performing well.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {recommendations.map((recommendation) => (
            <Grid item xs={12} md={6} key={recommendation.id}>
              <Card>
                <CardHeader
                  title={recommendation.title}
                  subheader={recommendation.description}
                  avatar={<RecommendationIcon />}
                  action={
                    <Box display="flex" gap={0.5}>
                      <Chip
                        label={recommendation.priority}
                        color={getRecommendationPriorityColor(recommendation.priority) as any}
                        size="small"
                      />
                      <Chip
                        label={recommendation.type}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  }
                />
                <CardContent>
                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Impact:</strong> {recommendation.impact} | 
                      <strong> Effort:</strong> {recommendation.effort}
                    </Typography>
                    <Typography variant="body2" color="primary">
                      <strong>Estimated Improvement:</strong> {recommendation.estimatedImprovement}
                    </Typography>
                  </Box>

                  <Typography variant="body2" fontWeight="medium" gutterBottom>
                    Implementation Steps:
                  </Typography>
                  <List dense>
                    {recommendation.implementation.slice(0, 3).map((step, index) => (
                      <ListItem key={index} sx={{ py: 0 }}>
                        <ListItemText
                          primary={
                            <Typography variant="body2">
                              {index + 1}. {step}
                            </Typography>
                          }
                        />
                      </ListItem>
                    ))}
                    {recommendation.implementation.length > 3 && (
                      <ListItem sx={{ py: 0 }}>
                        <ListItemText
                          primary={
                            <Typography variant="body2" color="text.secondary">
                              +{recommendation.implementation.length - 3} more steps...
                            </Typography>
                          }
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
                <CardActions>
                  <Button size="small" startIcon={<ViewIcon />}>
                    View Details
                  </Button>
                  <Button size="small">
                    Mark as Done
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );

  // Render test details dialog
  const renderTestDetailsDialog = () => (
    <Dialog
      open={testDetailsOpen}
      onClose={() => setTestDetailsOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Test Result Details: {selectedTestResult?.scenarioId}
      </DialogTitle>
      <DialogContent>
        {selectedTestResult && (
          <Box>
            <Grid container spacing={2} mb={2}>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Status:</strong> {selectedTestResult.status}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Duration:</strong> {(selectedTestResult.duration / 1000).toFixed(2)}s
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Started:</strong> {format(selectedTestResult.startTime, 'MMM dd, yyyy HH:mm:ss')}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2">
                  <strong>Ended:</strong> {format(selectedTestResult.endTime, 'MMM dd, yyyy HH:mm:ss')}
                </Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="h6" gutterBottom>
              Step Results ({selectedTestResult.stepResults.length})
            </Typography>
            <List>
              {selectedTestResult.stepResults.map((stepResult) => (
                <ListItem key={stepResult.stepId}>
                  <ListItemIcon>
                    {getTestStatusIcon(stepResult.status)}
                  </ListItemIcon>
                  <ListItemText
                    primary={stepResult.stepId}
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          Duration: {(stepResult.duration / 1000).toFixed(2)}s
                        </Typography>
                        {stepResult.error && (
                          <Typography variant="body2" color="error">
                            Error: {stepResult.error}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>

            {selectedTestResult.errors.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Errors ({selectedTestResult.errors.length})
                </Typography>
                <List>
                  {selectedTestResult.errors.map((error, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <ErrorIcon color="error" />
                      </ListItemIcon>
                      <ListItemText
                        primary={error.message}
                        secondary={error.type}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setTestDetailsOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Testing & Optimization Dashboard
      </Typography>

      <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        {enableIntegrationTests && <Tab icon={<BugIcon />} label="Integration Tests" iconPosition="start" />}
        {enablePerformanceMonitoring && <Tab icon={<PerformanceIcon />} label="Performance" iconPosition="start" />}
        {enableOptimizationRecommendations && <Tab icon={<RecommendationIcon />} label="Recommendations" iconPosition="start" />}
      </Tabs>

      {enableIntegrationTests && currentTab === 0 && (
        <>
          {/* Test Overview */}
          <Accordion expanded={performanceStatsExpanded} onChange={() => setPerformanceStatsExpanded(!performanceStatsExpanded)} sx={{ mb: 3 }}>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Test Overview</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {renderTestOverview()}
            </AccordionDetails>
          </Accordion>

          {/* Test Suites */}
          <Box mb={3}>
            {renderTestSuites()}
          </Box>

          {/* Test Results */}
          <Accordion expanded={testResultsExpanded} onChange={() => setTestResultsExpanded(!testResultsExpanded)}>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Test Results</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {renderTestResults()}
            </AccordionDetails>
          </Accordion>
        </>
      )}

      {enablePerformanceMonitoring && currentTab === (enableIntegrationTests ? 1 : 0) && renderPerformanceMonitoring()}

      {enableOptimizationRecommendations && currentTab === ((enableIntegrationTests ? 1 : 0) + (enablePerformanceMonitoring ? 1 : 0)) && (
        <Accordion expanded={recommendationsExpanded} onChange={() => setRecommendationsExpanded(!recommendationsExpanded)}>
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Typography variant="h6">Optimization Recommendations</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {renderOptimizationRecommendations()}
          </AccordionDetails>
        </Accordion>
      )}

      {/* Dialogs */}
      {renderTestDetailsDialog()}
    </Box>
  );
};

export default TestingDashboard;
