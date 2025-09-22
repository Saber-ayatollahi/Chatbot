/**
 * Ingestion Management Dashboard - Main Component
 * Comprehensive dashboard for document ingestion management
 * Phase 1: Foundation & Infrastructure Setup
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Tabs,
  Tab,
  Alert,
  AlertTitle,
  CircularProgress,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Tooltip,
  Badge,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Settings as SettingsIcon,
  Monitoring as MonitoringIcon,
  Storage as StorageIcon,
  Assessment as ReportsIcon,
  Refresh as RefreshIcon,
  Notifications as NotificationsIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

// Import types
import {
  IngestionJob,
  KnowledgeBaseStats,
  SystemMonitoring,
  ActivityLog,
  IngestionDashboardProps,
  HealthStatus,
} from '../../types/ingestion';

// Import components (will be created in subsequent phases)
import DocumentUpload from './DocumentUpload/DocumentUpload';
import ProcessingPipeline from './ProcessingPipeline/ProcessingPipeline';
import StatusMonitoring from './Monitoring/StatusMonitoring';
import KnowledgeBaseManager from './KnowledgeBase/KnowledgeBaseManager';
import LogsAndReports from './Logging/LogsAndReports';

// Import hooks (will be created in subsequent phases)
import { useIngestionJobs } from '../../hooks/useIngestionJobs';
import { useKnowledgeBase } from '../../hooks/useKnowledgeBase';
import { useRealTimeUpdates } from '../../hooks/useRealTimeUpdates';

// Tab Panel Component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ paddingTop: 16 }}>
    {value === index && children}
  </div>
);

// Main Dashboard Component
const IngestionDashboard: React.FC<IngestionDashboardProps> = ({
  initialTab = 0,
  refreshInterval = 30000, // 30 seconds
  enableRealTimeUpdates = true,
}) => {
  // State management
  const [currentTab, setCurrentTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemHealth, setSystemHealth] = useState<HealthStatus>('healthy');
  
  // Dialog states
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<ActivityLog | null>(null);

  // Data from custom hooks
  const {
    jobs: ingestionJobs,
    activeJobs,
    loading: jobsLoading,
    error: jobsError,
    refreshJobs,
  } = useIngestionJobs();

  const {
    stats: kbStats,
    loading: kbLoading,
    error: kbError,
    refreshStats: refreshKbStats,
  } = useKnowledgeBase();

  const {
    connected: wsConnected,
    events: realTimeEvents,
  } = useRealTimeUpdates(enableRealTimeUpdates ? ['job_progress', 'system_alert', 'kb_updated'] : []);

  // Mock data for initial development (will be replaced with real data)
  const [systemMonitoring] = useState<SystemMonitoring>({
    systemHealth: 'healthy',
    activeJobs: 0,
    queuedJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    systemLoad: {
      cpu: 45,
      memory: 62,
      disk: 78,
      network: 23,
      database: 34,
      loadAverage: [1.2, 1.5, 1.8],
      processCount: 156,
      threadCount: 892,
    },
    resourceUsage: {
      memory: {
        peak: 2048,
        average: 1536,
        current: 1792,
        unit: 'MB',
      },
      disk: {
        total: 1000000,
        used: 780000,
        available: 220000,
        usagePercentage: 78,
        iopsRead: 150,
        iopsWrite: 89,
        throughputRead: 45.6,
        throughputWrite: 23.4,
      },
      network: {
        bytesReceived: 1024000,
        bytesSent: 512000,
        packetsReceived: 8500,
        packetsSent: 4200,
        connectionsActive: 12,
        connectionsTotal: 156,
        bandwidth: 100,
        latency: 15,
      },
      database: {
        connections: 8,
        maxConnections: 100,
        activeQueries: 3,
        slowQueries: 0,
        cacheHitRate: 94.5,
        indexUsage: 87.2,
        storageUsed: 5120,
        storageAvailable: 15360,
      },
    },
    alertsActive: 2,
    lastHealthCheck: new Date(),
    uptime: 86400, // 24 hours in seconds
    version: '2.0.0',
  });

  const [recentActivity] = useState<ActivityLog[]>([
    {
      id: '1',
      timestamp: new Date(Date.now() - 300000), // 5 minutes ago
      type: 'success',
      category: 'ingestion',
      message: 'Document "compliance_manual.pdf" processed successfully',
      details: { sourceId: 'comp_manual_v1', chunksGenerated: 156, processingTime: 45000 },
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 600000), // 10 minutes ago
      type: 'info',
      category: 'system',
      message: 'Automatic backup completed',
      details: { backupSize: '2.3GB', duration: 120000 },
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 900000), // 15 minutes ago
      type: 'warning',
      category: 'ingestion',
      message: 'High memory usage detected during batch processing',
      details: { memoryUsage: '85%', jobId: 'job_123' },
    },
  ]);

  // Load initial data
  useEffect(() => {
    loadDashboardData();
  }, []);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(loadDashboardData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval]);

  // Handle real-time events
  useEffect(() => {
    if (realTimeEvents.length > 0) {
      const latestEvent = realTimeEvents[realTimeEvents.length - 1];
      handleRealTimeEvent(latestEvent);
    }
  }, [realTimeEvents]);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        refreshJobs(),
        refreshKbStats(),
        // Add other data loading calls here
      ]);
      
      // Update system health based on loaded data
      updateSystemHealth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [refreshJobs, refreshKbStats]);

  // Handle real-time events
  const handleRealTimeEvent = (event: any) => {
    switch (event.type) {
      case 'job_progress':
        // Update job progress in real-time
        break;
      case 'system_alert':
        // Show system alert
        setSelectedAlert(event.data);
        setAlertDialogOpen(true);
        break;
      case 'kb_updated':
        // Refresh knowledge base stats
        refreshKbStats();
        break;
      default:
        break;
    }
  };

  // Update system health based on current state
  const updateSystemHealth = () => {
    const hasErrors = jobsError || kbError;
    const hasActiveFailedJobs = activeJobs.some(job => job.jobStatus === 'failed');
    const highResourceUsage = systemMonitoring.systemLoad.cpu > 80 || 
                             systemMonitoring.systemLoad.memory > 85;

    if (hasErrors || hasActiveFailedJobs) {
      setSystemHealth('error');
    } else if (highResourceUsage || systemMonitoring.alertsActive > 0) {
      setSystemHealth('warning');
    } else {
      setSystemHealth('healthy');
    }
  };

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  // Handle manual refresh
  const handleRefresh = () => {
    loadDashboardData();
  };

  // Render system status indicator
  const renderSystemStatus = () => {
    const getStatusColor = (status: HealthStatus) => {
      switch (status) {
        case 'healthy': return 'success';
        case 'warning': return 'warning';
        case 'error': return 'error';
        case 'maintenance': return 'info';
        default: return 'default';
      }
    };

    const getStatusIcon = (status: HealthStatus) => {
      switch (status) {
        case 'healthy': return <SuccessIcon />;
        case 'warning': return <WarningIcon />;
        case 'error': return <ErrorIcon />;
        case 'maintenance': return <InfoIcon />;
        default: return <InfoIcon />;
      }
    };

    return (
      <Box display="flex" alignItems="center" gap={2}>
        <Chip
          icon={getStatusIcon(systemHealth)}
          label={`System ${systemHealth.charAt(0).toUpperCase() + systemHealth.slice(1)}`}
          color={getStatusColor(systemHealth) as any}
          variant="outlined"
        />
        {wsConnected && (
          <Chip
            icon={<CheckCircle />}
            label="Real-time Connected"
            color="success"
            size="small"
            variant="outlined"
          />
        )}
      </Box>
    );
  };

  // Render header with controls
  const renderHeader = () => (
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          Ingestion Management
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Document processing and knowledge base management
        </Typography>
      </Box>
      
      <Box display="flex" alignItems="center" gap={2}>
        {renderSystemStatus()}
        
        <Tooltip title="Notifications">
          <IconButton onClick={() => setAlertDialogOpen(true)}>
            <Badge badgeContent={systemMonitoring.alertsActive} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Refresh Dashboard">
          <IconButton onClick={handleRefresh} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Settings">
          <IconButton onClick={() => setSettingsDialogOpen(true)}>
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  // Render quick stats cards
  const renderQuickStats = () => {
    const stats = [
      {
        title: 'Active Jobs',
        value: activeJobs.length,
        icon: <SettingsIcon />,
        color: 'primary',
      },
      {
        title: 'Total Sources',
        value: kbStats?.totalSources || 0,
        icon: <StorageIcon />,
        color: 'secondary',
      },
      {
        title: 'Total Chunks',
        value: kbStats?.totalChunks?.toLocaleString() || '0',
        icon: <AssessmentIcon />,
        color: 'info',
      },
      {
        title: 'System Health',
        value: systemHealth.charAt(0).toUpperCase() + systemHealth.slice(1),
        icon: getStatusIcon(systemHealth),
        color: getStatusColor(systemHealth),
      },
    ];

    return (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" color={`${stat.color}.main`}>
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

  // Helper functions for status
  const getStatusColor = (status: HealthStatus) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      case 'maintenance': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case 'healthy': return <SuccessIcon />;
      case 'warning': return <WarningIcon />;
      case 'error': return <ErrorIcon />;
      case 'maintenance': return <InfoIcon />;
      default: return <InfoIcon />;
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {renderHeader()}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}

      {(jobsError || kbError) && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Data Loading Issues</AlertTitle>
          {jobsError && <div>Jobs: {jobsError}</div>}
          {kbError && <div>Knowledge Base: {kbError}</div>}
        </Alert>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" my={3}>
          <CircularProgress />
        </Box>
      )}

      {renderQuickStats()}

      <Paper sx={{ width: '100%' }}>
        <Tabs value={currentTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab 
            icon={<UploadIcon />} 
            label="Document Upload" 
            iconPosition="start"
          />
          <Tab 
            icon={<SettingsIcon />} 
            label="Processing Pipeline" 
            iconPosition="start"
          />
          <Tab 
            icon={<MonitoringIcon />} 
            label="Status Monitoring" 
            iconPosition="start"
          />
          <Tab 
            icon={<StorageIcon />} 
            label="Knowledge Base" 
            iconPosition="start"
          />
          <Tab 
            icon={<ReportsIcon />} 
            label="Logs & Reports" 
            iconPosition="start"
          />
        </Tabs>

        <TabPanel value={currentTab} index={0}>
          <DocumentUpload
            onUpload={async (files) => {
              // Handle file upload
              console.log('Uploading files:', files);
            }}
            onUploadProgress={(progress) => {
              console.log('Upload progress:', progress);
            }}
            onUploadComplete={(uploads) => {
              console.log('Upload completed:', uploads);
            }}
            onUploadError={(error) => {
              setError(`Upload failed: ${error.message}`);
            }}
            supportedFormats={['pdf', 'docx', 'txt', 'md']}
            maxFileSize={50 * 1024 * 1024} // 50MB
            maxFiles={10}
            stagingFolder="staging"
            enableDragDrop={true}
            enableBulkUpload={true}
            enablePreview={true}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <ProcessingPipeline
            methods={['enhanced', 'standard', 'simple', 'advanced']}
            onMethodSelect={(method) => {
              console.log('Method selected:', method);
            }}
            onConfigurationChange={(config) => {
              console.log('Configuration changed:', config);
            }}
            onStartProcessing={async (config) => {
              console.log('Starting processing with config:', config);
            }}
            onStopProcessing={async (jobId) => {
              console.log('Stopping job:', jobId);
            }}
            onPauseProcessing={async (jobId) => {
              console.log('Pausing job:', jobId);
            }}
            onResumeProcessing={async (jobId) => {
              console.log('Resuming job:', jobId);
            }}
            currentJob={activeJobs[0]}
            enableAdvancedOptions={true}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <StatusMonitoring
            knowledgeBaseStats={kbStats || {
              totalSources: 0,
              totalChunks: 0,
              totalEmbeddings: 0,
              averageQuality: 0,
              totalTokens: 0,
              totalCharacters: 0,
              totalWords: 0,
              uniqueDocuments: 0,
              duplicateChunks: 0,
              lastUpdated: new Date(),
              healthStatus: 'healthy',
              storageUsed: {
                totalSize: 0,
                usedSize: 0,
                availableSize: 0,
                unit: 'MB',
              },
              indexHealth: {
                vectorIndexHealth: 100,
                textIndexHealth: 100,
                metadataIndexHealth: 100,
                lastOptimized: new Date(),
                fragmentationLevel: 0,
                queryPerformance: 100,
              },
              performanceStats: {
                averageQueryTime: 50,
                averageInsertTime: 100,
                averageUpdateTime: 75,
                averageDeleteTime: 25,
                queriesPerSecond: 10,
                insertsPerSecond: 5,
                cacheHitRate: 95,
                indexUtilization: 85,
              },
            }}
            systemMonitoring={systemMonitoring}
            activeJobs={activeJobs}
            recentActivity={recentActivity}
            refreshInterval={refreshInterval}
            enableAlerts={true}
            enableNotifications={true}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <KnowledgeBaseManager
            sources={[]}
            chunks={[]}
            onDeleteSource={async (sourceId) => {
              console.log('Deleting source:', sourceId);
            }}
            onDeleteChunk={async (chunkId) => {
              console.log('Deleting chunk:', chunkId);
            }}
            onClearKnowledgeBase={async () => {
              console.log('Clearing knowledge base');
            }}
            onBackupKnowledgeBase={async (options) => {
              console.log('Creating backup:', options);
            }}
            onRestoreKnowledgeBase={async (options) => {
              console.log('Restoring backup:', options);
            }}
            onExportData={async (format, options) => {
              console.log('Exporting data:', format, options);
            }}
            enableBulkOperations={true}
            enableAdvancedSearch={true}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={4}>
          <LogsAndReports
            logs={[]}
            onExportLogs={async (format, options) => {
              console.log('Exporting logs:', format, options);
            }}
            onGenerateReport={async (type, options) => {
              console.log('Generating report:', type, options);
            }}
            enableRealTimeLogs={true}
            enableAdvancedFiltering={true}
          />
        </TabPanel>
      </Paper>

      {/* Settings Dialog */}
      <Dialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Ingestion Settings</DialogTitle>
        <DialogContent>
          <Typography>Settings panel will be implemented in Phase 2</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Alert Dialog */}
      <Dialog
        open={alertDialogOpen}
        onClose={() => setAlertDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>System Alert</DialogTitle>
        <DialogContent>
          {selectedAlert ? (
            <Box>
              <Typography variant="subtitle2">Type:</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {selectedAlert.type}
              </Typography>
              
              <Typography variant="subtitle2">Message:</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {selectedAlert.message}
              </Typography>
              
              <Typography variant="subtitle2">Time:</Typography>
              <Typography variant="body2">
                {selectedAlert.timestamp.toLocaleString()}
              </Typography>
            </Box>
          ) : (
            <Typography>No alerts to display</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default IngestionDashboard;
