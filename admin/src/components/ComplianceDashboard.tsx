/**
 * Compliance Dashboard - Admin Interface
 * Comprehensive admin dashboard for compliance monitoring and audit management
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Button,
  IconButton,
  Chip,
  Alert,
  AlertTitle,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  DatePicker,
  LocalizationProvider,
  CircularProgress,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
  Security as SecurityIcon,
  Assessment as ReportIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

// Types
interface AuditLog {
  id: string;
  session_id: string;
  message_id: string;
  user_query: string;
  final_response: string;
  confidence_score: number;
  response_time_ms: number;
  pii_detected: boolean;
  compliance_status: 'compliant' | 'non_compliant' | 'under_review';
  created_at: string;
  model_version: string;
  citations?: Citation[];
  content_flags?: ContentFlag[];
}

interface Citation {
  source: string;
  page?: number;
  relevance_score?: number;
}

interface ContentFlag {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

interface ComplianceStats {
  total_interactions: number;
  unique_sessions: number;
  pii_detections: number;
  compliance_violations: number;
  avg_confidence: number;
  avg_response_time: number;
  error_rate: number;
}

interface ComplianceReport {
  id: string;
  report_type: string;
  report_period_start: string;
  report_period_end: string;
  status: 'generated' | 'reviewed' | 'approved';
  created_at: string;
  total_records: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// Tab Panel Component
const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ paddingTop: 16 }}>
    {value === index && children}
  </div>
);

// Main Dashboard Component
const ComplianceDashboard: React.FC = () => {
  // State management
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [complianceStats, setComplianceStats] = useState<ComplianceStats | null>(null);
  const [complianceReports, setComplianceReports] = useState<ComplianceReport[]>([]);
  const [dailyTrends, setDailyTrends] = useState<any[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
  
  // Filter state
  const [filters, setFilters] = useState({
    dateFrom: startOfDay(subDays(new Date(), 30)),
    dateTo: endOfDay(new Date()),
    sessionId: '',
    complianceStatus: '',
    piiDetected: '',
    minConfidence: '',
    maxConfidence: '',
  });
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Dialog state
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Load initial data
  useEffect(() => {
    loadDashboardData();
  }, [filters, page, rowsPerPage]);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        loadAuditLogs(),
        loadComplianceStats(),
        loadComplianceReports(),
        loadTrendData(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [filters, page, rowsPerPage]);

  // Load audit logs
  const loadAuditLogs = async () => {
    const params = new URLSearchParams({
      page: (page + 1).toString(),
      limit: rowsPerPage.toString(),
      dateFrom: filters.dateFrom.toISOString(),
      dateTo: filters.dateTo.toISOString(),
      ...(filters.sessionId && { sessionId: filters.sessionId }),
      ...(filters.complianceStatus && { complianceStatus: filters.complianceStatus }),
      ...(filters.piiDetected && { piiDetected: filters.piiDetected }),
      ...(filters.minConfidence && { minConfidence: filters.minConfidence }),
      ...(filters.maxConfidence && { maxConfidence: filters.maxConfidence }),
    });

    const response = await fetch(`/api/admin/audit-logs?${params}`);
    if (!response.ok) throw new Error('Failed to load audit logs');
    
    const data = await response.json();
    setAuditLogs(data.logs);
    setTotalRecords(data.pagination.total);
  };

  // Load compliance statistics
  const loadComplianceStats = async () => {
    const params = new URLSearchParams({
      dateFrom: filters.dateFrom.toISOString(),
      dateTo: filters.dateTo.toISOString(),
    });

    const response = await fetch(`/api/admin/compliance-stats?${params}`);
    if (!response.ok) throw new Error('Failed to load compliance stats');
    
    const data = await response.json();
    setComplianceStats(data);
  };

  // Load compliance reports
  const loadComplianceReports = async () => {
    const response = await fetch('/api/admin/compliance-reports?limit=10');
    if (!response.ok) throw new Error('Failed to load compliance reports');
    
    const data = await response.json();
    setComplianceReports(data.reports);
  };

  // Load trend data
  const loadTrendData = async () => {
    const params = new URLSearchParams({
      dateFrom: filters.dateFrom.toISOString(),
      dateTo: filters.dateTo.toISOString(),
    });

    const [trendsResponse, categoryResponse] = await Promise.all([
      fetch(`/api/admin/daily-trends?${params}`),
      fetch(`/api/admin/category-breakdown?${params}`),
    ]);

    if (!trendsResponse.ok || !categoryResponse.ok) {
      throw new Error('Failed to load trend data');
    }

    const [trendsData, categoryData] = await Promise.all([
      trendsResponse.json(),
      categoryResponse.json(),
    ]);

    setDailyTrends(trendsData);
    setCategoryBreakdown(categoryData);
  };

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  // Handle filter changes
  const handleFilterChange = (field: string, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0); // Reset to first page when filters change
  };

  // Handle page change
  const handlePageChange = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle log detail view
  const handleViewLogDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailDialogOpen(true);
  };

  // Handle export
  const handleExport = async (format: string) => {
    try {
      const params = new URLSearchParams({
        format,
        dateFrom: filters.dateFrom.toISOString(),
        dateTo: filters.dateTo.toISOString(),
        ...(filters.sessionId && { sessionId: filters.sessionId }),
        ...(filters.complianceStatus && { complianceStatus: filters.complianceStatus }),
      });

      const response = await fetch(`/api/admin/export-audit-data?${params}`);
      if (!response.ok) throw new Error('Export failed');

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_export_${format}_${format(new Date(), 'yyyy-MM-dd')}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  // Generate report
  const handleGenerateReport = async (reportType: string) => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/admin/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: reportType,
          startDate: filters.dateFrom.toISOString(),
          endDate: filters.dateTo.toISOString(),
          exportFormats: ['pdf', 'excel'],
        }),
      });

      if (!response.ok) throw new Error('Report generation failed');

      const result = await response.json();
      
      // Refresh reports list
      await loadComplianceReports();
      
      setReportDialogOpen(false);
      
      // Show success message
      alert(`Report generated successfully. Report ID: ${result.reportId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report generation failed');
    } finally {
      setLoading(false);
    }
  };

  // Render statistics cards
  const renderStatsCards = () => {
    if (!complianceStats) return null;

    const cards = [
      {
        title: 'Total Interactions',
        value: complianceStats.total_interactions.toLocaleString(),
        icon: <ReportIcon />,
        color: 'primary',
      },
      {
        title: 'Unique Sessions',
        value: complianceStats.unique_sessions.toLocaleString(),
        icon: <SecurityIcon />,
        color: 'secondary',
      },
      {
        title: 'PII Detections',
        value: complianceStats.pii_detections.toLocaleString(),
        icon: <WarningIcon />,
        color: complianceStats.pii_detections > 0 ? 'warning' : 'success',
      },
      {
        title: 'Compliance Violations',
        value: complianceStats.compliance_violations.toLocaleString(),
        icon: <InfoIcon />,
        color: complianceStats.compliance_violations > 0 ? 'error' : 'success',
      },
      {
        title: 'Avg Confidence',
        value: `${Math.round(complianceStats.avg_confidence * 100)}%`,
        icon: complianceStats.avg_confidence >= 0.8 ? <TrendingUpIcon /> : <TrendingDownIcon />,
        color: complianceStats.avg_confidence >= 0.8 ? 'success' : 'warning',
      },
      {
        title: 'Avg Response Time',
        value: `${Math.round(complianceStats.avg_response_time)}ms`,
        icon: complianceStats.avg_response_time <= 3000 ? <TrendingUpIcon /> : <TrendingDownIcon />,
        color: complianceStats.avg_response_time <= 3000 ? 'success' : 'warning',
      },
    ];

    return (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {cards.map((card, index) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" color={`${card.color}.main`}>
                      {card.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.title}
                    </Typography>
                  </Box>
                  <Box color={`${card.color}.main`}>
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  // Render filters
  const renderFilters = () => (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        <FilterIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Filters
      </Typography>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} sm={6} md={3}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="From Date"
              value={filters.dateFrom}
              onChange={(date) => handleFilterChange('dateFrom', startOfDay(date || new Date()))}
              renderInput={(params) => <TextField {...params} fullWidth size="small" />}
            />
          </LocalizationProvider>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="To Date"
              value={filters.dateTo}
              onChange={(date) => handleFilterChange('dateTo', endOfDay(date || new Date()))}
              renderInput={(params) => <TextField {...params} fullWidth size="small" />}
            />
          </LocalizationProvider>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <TextField
            label="Session ID"
            value={filters.sessionId}
            onChange={(e) => handleFilterChange('sessionId', e.target.value)}
            fullWidth
            size="small"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Compliance Status</InputLabel>
            <Select
              value={filters.complianceStatus}
              onChange={(e) => handleFilterChange('complianceStatus', e.target.value)}
              label="Compliance Status"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="compliant">Compliant</MenuItem>
              <MenuItem value="non_compliant">Non-Compliant</MenuItem>
              <MenuItem value="under_review">Under Review</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>PII Detected</InputLabel>
            <Select
              value={filters.piiDetected}
              onChange={(e) => handleFilterChange('piiDetected', e.target.value)}
              label="PII Detected"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          onClick={loadDashboardData}
          startIcon={<RefreshIcon />}
          disabled={loading}
        >
          Refresh
        </Button>
        <Button
          variant="outlined"
          onClick={() => setExportDialogOpen(true)}
          startIcon={<DownloadIcon />}
        >
          Export
        </Button>
        <Button
          variant="outlined"
          onClick={() => setReportDialogOpen(true)}
          startIcon={<ReportIcon />}
        >
          Generate Report
        </Button>
      </Box>
    </Paper>
  );

  // Render audit logs table
  const renderAuditLogsTable = () => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Timestamp</TableCell>
            <TableCell>Session ID</TableCell>
            <TableCell>Query Preview</TableCell>
            <TableCell>Confidence</TableCell>
            <TableCell>Response Time</TableCell>
            <TableCell>PII</TableCell>
            <TableCell>Compliance</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {auditLogs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {log.session_id.substring(0, 12)}...
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                  {log.user_query.substring(0, 100)}...
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={`${Math.round(log.confidence_score * 100)}%`}
                  color={log.confidence_score >= 0.8 ? 'success' : log.confidence_score >= 0.6 ? 'warning' : 'error'}
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {log.response_time_ms}ms
                </Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={log.pii_detected ? 'Yes' : 'No'}
                  color={log.pii_detected ? 'warning' : 'success'}
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Chip
                  label={log.compliance_status}
                  color={
                    log.compliance_status === 'compliant' ? 'success' :
                    log.compliance_status === 'non_compliant' ? 'error' : 'warning'
                  }
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Tooltip title="View Details">
                  <IconButton
                    size="small"
                    onClick={() => handleViewLogDetail(log)}
                  >
                    <ViewIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={totalRecords}
        page={page}
        onPageChange={handlePageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleRowsPerPageChange}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </TableContainer>
  );

  // Render trends charts
  const renderTrendsCharts = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Daily Interaction Trends
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              <Line type="monotone" dataKey="interactions" stroke="#8884d8" name="Interactions" />
              <Line type="monotone" dataKey="sessions" stroke="#82ca9d" name="Sessions" />
              <Line type="monotone" dataKey="pii_detections" stroke="#ffc658" name="PII Detections" />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      </Grid>
      <Grid item xs={12} md={4}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Category Breakdown
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryBreakdown}
                dataKey="interactions"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(0)}%`}
              >
                {categoryBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                ))}
              </Pie>
              <RechartsTooltip />
            </PieChart>
          </ResponsiveContainer>
        </Paper>
      </Grid>
    </Grid>
  );

  // Render reports table
  const renderReportsTable = () => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Report Type</TableCell>
            <TableCell>Period</TableCell>
            <TableCell>Records</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Generated</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {complianceReports.map((report) => (
            <TableRow key={report.id}>
              <TableCell>{report.report_type}</TableCell>
              <TableCell>
                {format(new Date(report.report_period_start), 'MMM dd')} - {format(new Date(report.report_period_end), 'MMM dd, yyyy')}
              </TableCell>
              <TableCell>{report.total_records.toLocaleString()}</TableCell>
              <TableCell>
                <Chip
                  label={report.status}
                  color={
                    report.status === 'approved' ? 'success' :
                    report.status === 'reviewed' ? 'info' : 'default'
                  }
                  size="small"
                />
              </TableCell>
              <TableCell>
                {format(new Date(report.created_at), 'MMM dd, yyyy HH:mm')}
              </TableCell>
              <TableCell>
                <Button size="small" variant="outlined">
                  Download
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Compliance Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" my={3}>
          <CircularProgress />
        </Box>
      )}

      {renderStatsCards()}
      {renderFilters()}

      <Paper sx={{ width: '100%' }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label="Audit Logs" />
          <Tab label="Analytics" />
          <Tab label="Reports" />
          <Tab label="Violations" />
        </Tabs>

        <TabPanel value={currentTab} index={0}>
          {renderAuditLogsTable()}
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          {renderTrendsCharts()}
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          {renderReportsTable()}
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <Typography>Compliance violations management coming soon...</Typography>
        </TabPanel>
      </Paper>

      {/* Log Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Audit Log Details</DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Box>
              <Typography variant="subtitle2">Session ID:</Typography>
              <Typography variant="body2" sx={{ mb: 2, fontFamily: 'monospace' }}>
                {selectedLog.session_id}
              </Typography>

              <Typography variant="subtitle2">User Query:</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {selectedLog.user_query}
              </Typography>

              <Typography variant="subtitle2">Response:</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {selectedLog.final_response}
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Confidence Score:</Typography>
                  <Typography variant="body2">
                    {Math.round(selectedLog.confidence_score * 100)}%
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Response Time:</Typography>
                  <Typography variant="body2">
                    {selectedLog.response_time_ms}ms
                  </Typography>
                </Grid>
              </Grid>

              {selectedLog.citations && selectedLog.citations.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">Citations:</Typography>
                  {selectedLog.citations.map((citation, index) => (
                    <Typography key={index} variant="body2">
                      • {citation.source} {citation.page && `(p. ${citation.page})`}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>Export Audit Data</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Choose export format:
          </Typography>
          <Box display="flex" flexDirection="column" gap={1}>
            <Button variant="outlined" onClick={() => handleExport('csv')}>
              Export as CSV
            </Button>
            <Button variant="outlined" onClick={() => handleExport('json')}>
              Export as JSON
            </Button>
            <Button variant="outlined" onClick={() => handleExport('excel')}>
              Export as Excel
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Report Generation Dialog */}
      <Dialog open={reportDialogOpen} onClose={() => setReportDialogOpen(false)}>
        <DialogTitle>Generate Compliance Report</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Choose report type:
          </Typography>
          <Box display="flex" flexDirection="column" gap={1}>
            <Button variant="outlined" onClick={() => handleGenerateReport('daily')}>
              Daily Report
            </Button>
            <Button variant="outlined" onClick={() => handleGenerateReport('weekly')}>
              Weekly Report
            </Button>
            <Button variant="outlined" onClick={() => handleGenerateReport('monthly')}>
              Monthly Report
            </Button>
            <Button variant="outlined" onClick={() => handleGenerateReport('custom')}>
              Custom Period Report
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ComplianceDashboard;
