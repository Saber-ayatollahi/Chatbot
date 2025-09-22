/**
 * Logs and Reports Component - Full Implementation
 * Phase 3, Day 13: Comprehensive logging and reporting system
 * Advanced log management, filtering, export, and automated report generation
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
  TextField,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Menu,
  Checkbox,
} from '@mui/material';
import {
  Description as LogIcon,
  Assessment as ReportIcon,
  FilterList as FilterIcon,
  GetApp as DownloadIcon,
  Schedule as ScheduleIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandIcon,
  Visibility as ViewIcon,
  CloudDownload as ExportIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, subDays, subHours } from 'date-fns';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  category: 'system' | 'ingestion' | 'processing' | 'api' | 'database' | 'security';
  source: string;
  message: string;
  details?: any;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

interface LogFilter {
  levels: string[];
  categories: string[];
  sources: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  searchQuery: string;
  userId?: string;
  sessionId?: string;
}

interface Report {
  id: string;
  name: string;
  description: string;
  type: 'system_health' | 'performance' | 'error_analysis' | 'usage_stats' | 'security_audit' | 'custom';
  schedule: 'manual' | 'daily' | 'weekly' | 'monthly';
  format: 'pdf' | 'csv' | 'json' | 'html';
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: Date;
  lastGenerated?: Date;
  nextGeneration?: Date;
  parameters: Record<string, any>;
  recipients: string[];
}

interface LogsAndReportsProps {
  showLogs?: boolean;
  showReports?: boolean;
  enableExport?: boolean;
  enableScheduledReports?: boolean;
}

// Mock logging service
class LoggingService {
  private static instance: LoggingService;
  private logs: LogEntry[] = [];
  private reports: Report[] = [];

  static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
      LoggingService.instance.initializeMockData();
    }
    return LoggingService.instance;
  }

  private initializeMockData() {
    // Generate mock logs
    const levels: LogEntry['level'][] = ['debug', 'info', 'warn', 'error', 'fatal'];
    const categories: LogEntry['category'][] = ['system', 'ingestion', 'processing', 'api', 'database', 'security'];
    const sources = ['ProcessingEngine', 'IngestionPipeline', 'DatabaseManager', 'APIGateway', 'SecurityManager', 'SystemMonitor'];
    const messages = [
      'Processing job started successfully',
      'Document ingestion completed',
      'Database connection established',
      'API request processed',
      'Security scan completed',
      'System health check passed',
      'Memory usage threshold exceeded',
      'Processing job failed with validation errors',
      'Database query timeout',
      'Authentication failed',
      'File upload completed',
      'Backup operation started',
      'Configuration updated',
      'User session expired',
      'Rate limit exceeded',
    ];

    // Generate logs for the last 7 days
    const now = new Date();
    for (let i = 0; i < 1000; i++) {
      const timestamp = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      const level = levels[Math.floor(Math.random() * levels.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      const source = sources[Math.floor(Math.random() * sources.length)];
      const message = messages[Math.floor(Math.random() * messages.length)];

      this.logs.push({
        id: `log_${i + 1}`,
        timestamp,
        level,
        category,
        source,
        message,
        userId: Math.random() > 0.7 ? `user_${Math.floor(Math.random() * 100)}` : undefined,
        sessionId: `session_${Math.floor(Math.random() * 1000)}`,
        requestId: `req_${Math.floor(Math.random() * 10000)}`,
        duration: Math.random() > 0.5 ? Math.floor(Math.random() * 5000) : undefined,
        details: level === 'error' ? { error: 'Simulated error details', stack: 'Error stack trace...' } : undefined,
        metadata: {
          version: '1.0.0',
          environment: 'production',
          region: 'us-east-1',
        },
      });
    }

    // Sort logs by timestamp (newest first)
    this.logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Generate mock reports
    this.reports = [
      {
        id: 'report_001',
        name: 'Daily System Health Report',
        description: 'Comprehensive system health and performance metrics',
        type: 'system_health',
        schedule: 'daily',
        format: 'pdf',
        status: 'completed',
        createdAt: new Date(Date.now() - 86400000),
        lastGenerated: new Date(Date.now() - 3600000),
        nextGeneration: new Date(Date.now() + 82800000),
        parameters: {
          includeCharts: true,
          includeAlerts: true,
          timeRange: '24h',
        },
        recipients: ['admin@company.com', 'ops@company.com'],
      },
      {
        id: 'report_002',
        name: 'Weekly Performance Analysis',
        description: 'Detailed performance analysis and optimization recommendations',
        type: 'performance',
        schedule: 'weekly',
        format: 'html',
        status: 'generating',
        createdAt: new Date(Date.now() - 604800000),
        lastGenerated: new Date(Date.now() - 604800000),
        nextGeneration: new Date(Date.now() + 86400000),
        parameters: {
          includeRecommendations: true,
          includeComparisons: true,
          timeRange: '7d',
        },
        recipients: ['performance@company.com'],
      },
      {
        id: 'report_003',
        name: 'Error Analysis Report',
        description: 'Analysis of system errors and failure patterns',
        type: 'error_analysis',
        schedule: 'manual',
        format: 'csv',
        status: 'pending',
        createdAt: new Date(Date.now() - 172800000),
        parameters: {
          errorLevels: ['error', 'fatal'],
          includeStackTraces: true,
          groupBySource: true,
        },
        recipients: ['dev@company.com'],
      },
    ];
  }

  getLogs(filter?: Partial<LogFilter>, page = 0, pageSize = 100): { logs: LogEntry[]; total: number } {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.levels && filter.levels.length > 0) {
        filteredLogs = filteredLogs.filter(log => filter.levels!.includes(log.level));
      }

      if (filter.categories && filter.categories.length > 0) {
        filteredLogs = filteredLogs.filter(log => filter.categories!.includes(log.category));
      }

      if (filter.sources && filter.sources.length > 0) {
        filteredLogs = filteredLogs.filter(log => filter.sources!.includes(log.source));
      }

      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        filteredLogs = filteredLogs.filter(log =>
          log.message.toLowerCase().includes(query) ||
          log.source.toLowerCase().includes(query) ||
          log.category.toLowerCase().includes(query)
        );
      }

      if (filter.dateRange?.start) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.dateRange!.start!);
      }

      if (filter.dateRange?.end) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filter.dateRange!.end!);
      }

      if (filter.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filter.userId);
      }

      if (filter.sessionId) {
        filteredLogs = filteredLogs.filter(log => log.sessionId === filter.sessionId);
      }
    }

    const start = page * pageSize;
    const end = start + pageSize;

    return {
      logs: filteredLogs.slice(start, end),
      total: filteredLogs.length,
    };
  }

  getLogStatistics(timeRange: '1h' | '24h' | '7d' | '30d' = '24h') {
    const now = new Date();
    let cutoff: Date;

    switch (timeRange) {
      case '1h':
        cutoff = subHours(now, 1);
        break;
      case '24h':
        cutoff = subHours(now, 24);
        break;
      case '7d':
        cutoff = subDays(now, 7);
        break;
      case '30d':
        cutoff = subDays(now, 30);
        break;
    }

    const filteredLogs = this.logs.filter(log => log.timestamp >= cutoff);

    const levelCounts = filteredLogs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const categoryCounts = filteredLogs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sourceCounts = filteredLogs.reduce((acc, log) => {
      acc[log.source] = (acc[log.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: filteredLogs.length,
      levelCounts,
      categoryCounts,
      sourceCounts,
      errorRate: ((levelCounts.error || 0) + (levelCounts.fatal || 0)) / filteredLogs.length * 100,
      averageLogsPerHour: filteredLogs.length / (timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720),
    };
  }

  getReports(): Report[] {
    return this.reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async generateReport(reportId: string): Promise<void> {
    const report = this.reports.find(r => r.id === reportId);
    if (report) {
      report.status = 'generating';
      
      // Simulate report generation
      setTimeout(() => {
        report.status = 'completed';
        report.lastGenerated = new Date();
        
        // Set next generation time based on schedule
        if (report.schedule === 'daily') {
          report.nextGeneration = new Date(Date.now() + 24 * 60 * 60 * 1000);
        } else if (report.schedule === 'weekly') {
          report.nextGeneration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        } else if (report.schedule === 'monthly') {
          report.nextGeneration = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }
      }, 3000);
    }
  }

  async exportLogs(filter: Partial<LogFilter>, format: 'csv' | 'json' | 'txt'): Promise<string> {
    const { logs } = this.getLogs(filter, 0, 10000); // Export up to 10k logs
    
    // Simulate export processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return `export_${Date.now()}.${format}`;
  }
}

const LogsAndReports: React.FC<LogsAndReportsProps> = ({
  showLogs = true,
  showReports = true,
  enableExport = true,
  enableScheduledReports = true,
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [reports, setReports] = useState<Report[]>([]);
  const [logStatistics, setLogStatistics] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [logFilter, setLogFilter] = useState<LogFilter>({
    levels: [],
    categories: [],
    sources: [],
    dateRange: { start: null, end: null },
    searchQuery: '',
  });
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(true);
  const [reportsExpanded, setReportsExpanded] = useState(true);
  const [statsExpanded, setStatsExpanded] = useState(true);

  const loggingService = LoggingService.getInstance();

  // Load data on mount and refresh
  useEffect(() => {
    refreshData();
    
    // Set up refresh interval
    const interval = setInterval(refreshData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [page, rowsPerPage, logFilter]);

  const refreshData = () => {
    const { logs: fetchedLogs, total } = loggingService.getLogs(logFilter, page, rowsPerPage);
    setLogs(fetchedLogs);
    setTotalLogs(total);
    setReports(loggingService.getReports());
    setLogStatistics(loggingService.getLogStatistics('24h'));
  };

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  // Handle filter change
  const handleFilterChange = (newFilter: Partial<LogFilter>) => {
    setLogFilter(prev => ({ ...prev, ...newFilter }));
    setPage(0); // Reset to first page when filter changes
  };

  // Handle log selection
  const handleLogSelection = (logId: string, selected: boolean) => {
    if (selected) {
      setSelectedLogIds(prev => [...prev, logId]);
    } else {
      setSelectedLogIds(prev => prev.filter(id => id !== logId));
    }
  };

  // Handle select all logs
  const handleSelectAllLogs = (selected: boolean) => {
    if (selected) {
      setSelectedLogIds(logs.map(log => log.id));
    } else {
      setSelectedLogIds([]);
    }
  };

  // Handle export logs
  const handleExportLogs = async (format: 'csv' | 'json' | 'txt') => {
    try {
      const filename = await loggingService.exportLogs(logFilter, format);
      // In a real implementation, this would trigger a download
      console.log(`Exported logs to ${filename}`);
      setExportDialogOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Handle report generation
  const handleGenerateReport = async (reportId: string) => {
    try {
      await loggingService.generateReport(reportId);
      refreshData();
    } catch (error) {
      console.error('Report generation failed:', error);
    }
  };

  // Get log level color
  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'debug': return 'default';
      case 'info': return 'info';
      case 'warn': return 'warning';
      case 'error': return 'error';
      case 'fatal': return 'error';
      default: return 'default';
    }
  };

  // Get log level icon
  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'debug': return <InfoIcon />;
      case 'info': return <InfoIcon />;
      case 'warn': return <WarningIcon />;
      case 'error': return <ErrorIcon />;
      case 'fatal': return <ErrorIcon />;
      default: return <InfoIcon />;
    }
  };

  // Get report status color
  const getReportStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'generating': return 'info';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  // Render log statistics
  const renderLogStatistics = () => {
    if (!logStatistics) return null;

    const levelData = Object.entries(logStatistics.levelCounts).map(([level, count]) => ({
      name: level.toUpperCase(),
      value: count as number,
      fill: level === 'error' || level === 'fatal' ? '#f44336' : 
            level === 'warn' ? '#ff9800' : 
            level === 'info' ? '#2196f3' : '#9e9e9e',
    }));

    const categoryData = Object.entries(logStatistics.categoryCounts).map(([category, count]) => ({
      name: category,
      count: count as number,
    }));

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
                        {logStatistics.total.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Logs
                      </Typography>
                    </Box>
                    <LogIcon color="primary" />
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
                        {logStatistics.errorRate.toFixed(1)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Error Rate
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
                        {logStatistics.averageLogsPerHour.toFixed(0)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Logs/Hour
                      </Typography>
                    </Box>
                    <SpeedIcon color="info" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h4" color="secondary">
                        {Object.keys(logStatistics.sourceCounts).length}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Sources
                      </Typography>
                    </Box>
                    <StorageIcon color="secondary" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Log Levels Distribution" />
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={levelData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {levelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardHeader title="Log Categories" />
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="#1976d2" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Render logs table
  const renderLogsTable = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          System Logs ({totalLogs.toLocaleString()})
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FilterIcon />}
            onClick={() => setFilterDialogOpen(true)}
          >
            Filter
          </Button>
          {enableExport && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<ExportIcon />}
              onClick={() => setExportDialogOpen(true)}
              disabled={selectedLogIds.length === 0 && !logFilter.searchQuery}
            >
              Export
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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedLogIds.length > 0 && selectedLogIds.length < logs.length}
                  checked={logs.length > 0 && selectedLogIds.length === logs.length}
                  onChange={(e) => handleSelectAllLogs(e.target.checked)}
                />
              </TableCell>
              <TableCell>Timestamp</TableCell>
              <TableCell>Level</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Message</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} selected={selectedLogIds.includes(log.id)}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedLogIds.includes(log.id)}
                    onChange={(e) => handleLogSelection(log.id, e.target.checked)}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {format(log.timestamp, 'MMM dd, HH:mm:ss')}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getLogLevelIcon(log.level)}
                    <Chip
                      label={log.level.toUpperCase()}
                      color={getLogLevelColor(log.level) as any}
                      size="small"
                    />
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={log.category} size="small" variant="outlined" />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {log.source}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ maxWidth: 300 }}>
                    {log.message}
                  </Typography>
                  {log.duration && (
                    <Typography variant="caption" color="text.secondary">
                      Duration: {log.duration}ms
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Tooltip title="View Details">
                    <IconButton size="small">
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
        count={totalLogs}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </Box>
  );

  // Render reports management
  const renderReportsManagement = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Reports ({reports.length})
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="contained"
            startIcon={<ReportIcon />}
            onClick={() => {/* Open create report dialog */}}
          >
            Create Report
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
        {reports.map((report) => (
          <Grid item xs={12} md={6} lg={4} key={report.id}>
            <Card>
              <CardHeader
                title={report.name}
                subheader={report.description}
                action={
                  <Chip
                    label={report.status}
                    color={getReportStatusColor(report.status) as any}
                    size="small"
                  />
                }
              />
              <CardContent>
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary">
                    Type: {report.type.replace('_', ' ').toUpperCase()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Schedule: {report.schedule.toUpperCase()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Format: {report.format.toUpperCase()}
                  </Typography>
                </Box>

                {report.lastGenerated && (
                  <Typography variant="body2" color="text.secondary">
                    Last Generated: {format(report.lastGenerated, 'MMM dd, yyyy HH:mm')}
                  </Typography>
                )}

                {report.nextGeneration && (
                  <Typography variant="body2" color="text.secondary">
                    Next Generation: {format(report.nextGeneration, 'MMM dd, yyyy HH:mm')}
                  </Typography>
                )}

                <Box mt={1}>
                  <Typography variant="body2" color="text.secondary">
                    Recipients: {report.recipients.length}
                  </Typography>
                </Box>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  startIcon={<ReportIcon />}
                  onClick={() => handleGenerateReport(report.id)}
                  disabled={report.status === 'generating'}
                >
                  Generate
                </Button>
                <Button size="small" startIcon={<DownloadIcon />}>
                  Download
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

  // Render filter dialog
  const renderFilterDialog = () => (
    <Dialog
      open={filterDialogOpen}
      onClose={() => setFilterDialogOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Filter Logs</DialogTitle>
      <DialogContent>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Log Levels</InputLabel>
              <Select
                multiple
                value={logFilter.levels}
                onChange={(e) => handleFilterChange({ levels: e.target.value as string[] })}
                label="Log Levels"
              >
                <MenuItem value="debug">Debug</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="warn">Warning</MenuItem>
                <MenuItem value="error">Error</MenuItem>
                <MenuItem value="fatal">Fatal</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Categories</InputLabel>
              <Select
                multiple
                value={logFilter.categories}
                onChange={(e) => handleFilterChange({ categories: e.target.value as string[] })}
                label="Categories"
              >
                <MenuItem value="system">System</MenuItem>
                <MenuItem value="ingestion">Ingestion</MenuItem>
                <MenuItem value="processing">Processing</MenuItem>
                <MenuItem value="api">API</MenuItem>
                <MenuItem value="database">Database</MenuItem>
                <MenuItem value="security">Security</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Search Message"
              value={logFilter.searchQuery}
              onChange={(e) => handleFilterChange({ searchQuery: e.target.value })}
              placeholder="Search in log messages..."
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="datetime-local"
              label="Start Date"
              value={logFilter.dateRange.start ? format(logFilter.dateRange.start, "yyyy-MM-dd'T'HH:mm") : ''}
              onChange={(e) => handleFilterChange({
                dateRange: {
                  ...logFilter.dateRange,
                  start: e.target.value ? new Date(e.target.value) : null
                }
              })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="datetime-local"
              label="End Date"
              value={logFilter.dateRange.end ? format(logFilter.dateRange.end, "yyyy-MM-dd'T'HH:mm") : ''}
              onChange={(e) => handleFilterChange({
                dateRange: {
                  ...logFilter.dateRange,
                  end: e.target.value ? new Date(e.target.value) : null
                }
              })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => {
          setLogFilter({
            levels: [],
            categories: [],
            sources: [],
            dateRange: { start: null, end: null },
            searchQuery: '',
          });
        }}>
          Clear
        </Button>
        <Button onClick={() => setFilterDialogOpen(false)}>
          Cancel
        </Button>
        <Button onClick={() => setFilterDialogOpen(false)} variant="contained">
          Apply Filter
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Render export dialog
  const renderExportDialog = () => (
    <Dialog
      open={exportDialogOpen}
      onClose={() => setExportDialogOpen(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Export Logs</DialogTitle>
      <DialogContent>
        <Typography variant="body2" gutterBottom>
          Export {selectedLogIds.length > 0 ? `${selectedLogIds.length} selected logs` : 'filtered logs'} in the following format:
        </Typography>
        <Box mt={2}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => handleExportLogs('csv')}
            sx={{ mb: 1 }}
          >
            Export as CSV
          </Button>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => handleExportLogs('json')}
            sx={{ mb: 1 }}
          >
            Export as JSON
          </Button>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => handleExportLogs('txt')}
          >
            Export as Text
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setExportDialogOpen(false)}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Logs and Reports
      </Typography>

      <Tabs value={currentTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        {showLogs && <Tab icon={<LogIcon />} label="Logs" iconPosition="start" />}
        {showReports && <Tab icon={<ReportIcon />} label="Reports" iconPosition="start" />}
      </Tabs>

      {showLogs && currentTab === 0 && (
        <>
          {/* Log Statistics */}
          <Accordion expanded={statsExpanded} onChange={() => setStatsExpanded(!statsExpanded)} sx={{ mb: 3 }}>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">Log Statistics</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {renderLogStatistics()}
            </AccordionDetails>
          </Accordion>

          {/* Logs Table */}
          <Accordion expanded={logsExpanded} onChange={() => setLogsExpanded(!logsExpanded)}>
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="h6">System Logs</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {renderLogsTable()}
            </AccordionDetails>
          </Accordion>
        </>
      )}

      {showReports && currentTab === (showLogs ? 1 : 0) && (
        <Accordion expanded={reportsExpanded} onChange={() => setReportsExpanded(!reportsExpanded)}>
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Typography variant="h6">Report Management</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {renderReportsManagement()}
          </AccordionDetails>
        </Accordion>
      )}

      {/* Dialogs */}
      {renderFilterDialog()}
      {renderExportDialog()}
    </Box>
  );
};

export default LogsAndReports;
