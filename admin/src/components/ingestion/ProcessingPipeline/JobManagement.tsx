/**
 * Job Management Component
 * Phase 3, Day 11: Advanced job queue and scheduling system
 * Comprehensive job lifecycle management with dependencies and priorities
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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  LinearProgress,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Tooltip,
  Badge,
  Menu,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  Refresh as RetryIcon,
  Schedule as ScheduleIcon,
  Queue as QueueIcon,
  Priority as PriorityIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  MoreVert as MoreIcon,
  ExpandMore as ExpandIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Assessment as QualityIcon,
  Memory as MemoryIcon,
  Timer as TimerIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow } from 'date-fns';
import { IngestionJob, IngestionConfig } from '../../../types/ingestion';

interface JobManagementProps {
  currentJob?: IngestionJob;
  onStartProcessing: (config: IngestionConfig) => Promise<void>;
  onStopProcessing: (jobId: string) => Promise<void>;
  onPauseProcessing: (jobId: string) => Promise<void>;
  onResumeProcessing: (jobId: string) => Promise<void>;
}

interface JobQueue {
  pending: IngestionJob[];
  running: IngestionJob[];
  completed: IngestionJob[];
  failed: IngestionJob[];
  cancelled: IngestionJob[];
}

// Mock job management service
class JobManagementService {
  private static instance: JobManagementService;
  private jobs: Map<string, IngestionJob> = new Map();
  private jobQueue: JobQueue = {
    pending: [],
    running: [],
    completed: [],
    failed: [],
    cancelled: [],
  };

  static getInstance(): JobManagementService {
    if (!JobManagementService.instance) {
      JobManagementService.instance = new JobManagementService();
      JobManagementService.instance.initializeMockJobs();
    }
    return JobManagementService.instance;
  }

  private initializeMockJobs() {
    // Create some mock jobs for demonstration
    const mockJobs: Partial<IngestionJob>[] = [
      {
        jobId: 'job_001',
        sourceId: 'doc_compliance_manual',
        jobType: 'initial_ingestion',
        jobStatus: 'completed',
        method: 'enhanced',
        progress: {
          currentStep: 'Completed',
          totalSteps: 8,
          completedSteps: 8,
          progressPercentage: 100,
          itemsProcessed: 156,
          totalItems: 156,
          lastUpdateTime: new Date(Date.now() - 3600000), // 1 hour ago
        },
        stats: {
          documentsProcessed: 1,
          chunksGenerated: 156,
          embeddingsCreated: 156,
          totalProcessingTime: 180000,
          averageProcessingTime: 180000,
          averageChunkQuality: 92,
          averageEmbeddingQuality: 94,
          overallQualityScore: 93,
          errorCount: 0,
          warningCount: 2,
          retryCount: 0,
        },
        createdAt: new Date(Date.now() - 7200000), // 2 hours ago
        startedAt: new Date(Date.now() - 3900000), // 1h 5m ago
        completedAt: new Date(Date.now() - 3600000), // 1 hour ago
        priority: 1,
        retryCount: 0,
        maxRetries: 3,
      },
      {
        jobId: 'job_002',
        sourceId: 'doc_technical_specs',
        jobType: 'reingest',
        jobStatus: 'running',
        method: 'standard',
        progress: {
          currentStep: 'Generating embeddings',
          totalSteps: 8,
          completedSteps: 5,
          progressPercentage: 62,
          itemsProcessed: 89,
          totalItems: 143,
          processingRate: 2.3,
          lastUpdateTime: new Date(),
        },
        stats: {
          documentsProcessed: 1,
          chunksGenerated: 89,
          embeddingsCreated: 67,
          totalProcessingTime: 120000,
          averageProcessingTime: 120000,
          averageChunkQuality: 78,
          averageEmbeddingQuality: 81,
          overallQualityScore: 79,
          errorCount: 0,
          warningCount: 1,
          retryCount: 0,
        },
        createdAt: new Date(Date.now() - 300000), // 5 minutes ago
        startedAt: new Date(Date.now() - 180000), // 3 minutes ago
        estimatedCompletion: new Date(Date.now() + 120000), // 2 minutes from now
        priority: 2,
        retryCount: 0,
        maxRetries: 3,
      },
      {
        jobId: 'job_003',
        sourceId: 'doc_user_manual',
        jobType: 'batch_ingestion',
        jobStatus: 'pending',
        method: 'enhanced',
        progress: {
          currentStep: 'Queued',
          totalSteps: 8,
          completedSteps: 0,
          progressPercentage: 0,
          itemsProcessed: 0,
          totalItems: 234,
          lastUpdateTime: new Date(),
        },
        stats: {
          documentsProcessed: 0,
          chunksGenerated: 0,
          embeddingsCreated: 0,
          totalProcessingTime: 0,
          averageProcessingTime: 0,
          averageChunkQuality: 0,
          averageEmbeddingQuality: 0,
          overallQualityScore: 0,
          errorCount: 0,
          warningCount: 0,
          retryCount: 0,
        },
        createdAt: new Date(Date.now() - 60000), // 1 minute ago
        priority: 3,
        retryCount: 0,
        maxRetries: 3,
      },
      {
        jobId: 'job_004',
        sourceId: 'doc_api_reference',
        jobType: 'initial_ingestion',
        jobStatus: 'failed',
        method: 'simple',
        progress: {
          currentStep: 'Failed at chunk validation',
          totalSteps: 8,
          completedSteps: 3,
          progressPercentage: 37,
          itemsProcessed: 45,
          totalItems: 120,
          lastUpdateTime: new Date(Date.now() - 1800000), // 30 minutes ago
        },
        stats: {
          documentsProcessed: 1,
          chunksGenerated: 45,
          embeddingsCreated: 0,
          totalProcessingTime: 45000,
          averageProcessingTime: 45000,
          averageChunkQuality: 34,
          averageEmbeddingQuality: 0,
          overallQualityScore: 17,
          errorCount: 1,
          warningCount: 5,
          retryCount: 1,
        },
        error: {
          errorCode: 'VALIDATION_FAILED',
          errorMessage: 'Chunk quality below minimum threshold',
          errorType: 'validation',
          severity: 'high',
          timestamp: new Date(Date.now() - 1800000),
          recoverable: true,
          retryable: true,
          suggestedActions: [
            'Increase minimum quality threshold',
            'Use enhanced processing method',
            'Review document content quality'
          ],
        },
        createdAt: new Date(Date.now() - 2400000), // 40 minutes ago
        startedAt: new Date(Date.now() - 2100000), // 35 minutes ago
        completedAt: new Date(Date.now() - 1800000), // 30 minutes ago
        priority: 2,
        retryCount: 1,
        maxRetries: 3,
      },
    ];

    // Add mock jobs to the system
    mockJobs.forEach(jobData => {
      const job = jobData as IngestionJob;
      this.jobs.set(job.jobId, job);
      
      // Add to appropriate queue
      switch (job.jobStatus) {
        case 'pending':
          this.jobQueue.pending.push(job);
          break;
        case 'running':
          this.jobQueue.running.push(job);
          break;
        case 'completed':
          this.jobQueue.completed.push(job);
          break;
        case 'failed':
          this.jobQueue.failed.push(job);
          break;
        case 'cancelled':
          this.jobQueue.cancelled.push(job);
          break;
      }
    });
  }

  getJobQueue(): JobQueue {
    return this.jobQueue;
  }

  getJob(jobId: string): IngestionJob | undefined {
    return this.jobs.get(jobId);
  }

  getAllJobs(): IngestionJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async pauseJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job && job.jobStatus === 'running') {
      job.jobStatus = 'paused';
      // Move from running to pending queue
      this.jobQueue.running = this.jobQueue.running.filter(j => j.jobId !== jobId);
      this.jobQueue.pending.push(job);
    }
  }

  async resumeJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job && job.jobStatus === 'paused') {
      job.jobStatus = 'running';
      // Move from pending to running queue
      this.jobQueue.pending = this.jobQueue.pending.filter(j => j.jobId !== jobId);
      this.jobQueue.running.push(job);
    }
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.jobStatus = 'cancelled';
      job.completedAt = new Date();
      
      // Remove from current queue and add to cancelled
      Object.keys(this.jobQueue).forEach(queueName => {
        if (queueName !== 'cancelled') {
          (this.jobQueue as any)[queueName] = (this.jobQueue as any)[queueName].filter(
            (j: IngestionJob) => j.jobId !== jobId
          );
        }
      });
      this.jobQueue.cancelled.push(job);
    }
  }

  async retryJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job && job.jobStatus === 'failed' && job.retryCount < job.maxRetries) {
      job.jobStatus = 'pending';
      job.retryCount++;
      job.error = undefined;
      job.progress.progressPercentage = 0;
      job.progress.completedSteps = 0;
      job.progress.currentStep = 'Queued for retry';
      
      // Move from failed to pending queue
      this.jobQueue.failed = this.jobQueue.failed.filter(j => j.jobId !== jobId);
      this.jobQueue.pending.push(job);
    }
  }
}

const JobManagement: React.FC<JobManagementProps> = ({
  currentJob,
  onStartProcessing,
  onStopProcessing,
  onPauseProcessing,
  onResumeProcessing,
}) => {
  const [jobQueue, setJobQueue] = useState<JobQueue>({
    pending: [],
    running: [],
    completed: [],
    failed: [],
    cancelled: [],
  });
  const [selectedTab, setSelectedTab] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<IngestionJob | null>(null);
  const [jobDetailOpen, setJobDetailOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const jobService = JobManagementService.getInstance();

  // Load job queue on mount
  useEffect(() => {
    refreshJobQueue();
    
    // Set up refresh interval
    const interval = setInterval(refreshJobQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const refreshJobQueue = () => {
    setJobQueue(jobService.getJobQueue());
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'info';
      case 'failed': return 'error';
      case 'cancelled': return 'warning';
      case 'paused': return 'warning';
      default: return 'default';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <SuccessIcon />;
      case 'running': return <CircularProgress size={20} />;
      case 'failed': return <ErrorIcon />;
      case 'cancelled': return <WarningIcon />;
      case 'paused': return <PauseIcon />;
      default: return <InfoIcon />;
    }
  };

  // Handle job actions
  const handleJobAction = async (action: string, jobId: string) => {
    try {
      switch (action) {
        case 'pause':
          await jobService.pauseJob(jobId);
          onPauseProcessing(jobId);
          break;
        case 'resume':
          await jobService.resumeJob(jobId);
          onResumeProcessing(jobId);
          break;
        case 'cancel':
          await jobService.cancelJob(jobId);
          onStopProcessing(jobId);
          break;
        case 'retry':
          await jobService.retryJob(jobId);
          break;
      }
      refreshJobQueue();
    } catch (error) {
      console.error('Job action failed:', error);
    }
  };

  // Handle job detail view
  const handleJobDetail = (job: IngestionJob) => {
    setSelectedJob(job);
    setJobDetailOpen(true);
  };

  // Render queue statistics
  const renderQueueStats = () => {
    const stats = [
      {
        label: 'Pending',
        value: jobQueue.pending.length,
        color: 'info',
        icon: <QueueIcon />,
      },
      {
        label: 'Running',
        value: jobQueue.running.length,
        color: 'primary',
        icon: <CircularProgress size={20} />,
      },
      {
        label: 'Completed',
        value: jobQueue.completed.length,
        color: 'success',
        icon: <SuccessIcon />,
      },
      {
        label: 'Failed',
        value: jobQueue.failed.length,
        color: 'error',
        icon: <ErrorIcon />,
      },
    ];

    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Box display="flex" alignItems="center" justifyContent="center" mb={1}>
                  <Box color={`${stat.color}.main`}>
                    {stat.icon}
                  </Box>
                </Box>
                <Typography variant="h4" color={`${stat.color}.main`}>
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stat.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  };

  // Render job table
  const renderJobTable = (jobs: IngestionJob[]) => {
    const sortedJobs = [...jobs].sort((a, b) => {
      const aValue = (a as any)[sortField];
      const bValue = (b as any)[sortField];
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    const paginatedJobs = sortedJobs.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );

    return (
      <>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Job ID</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedJobs.map((job) => (
                <TableRow key={job.jobId}>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {job.jobId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {job.sourceId}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {job.jobType}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={job.method.toUpperCase()}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon(job.jobStatus)}
                      <Chip
                        label={job.jobStatus}
                        color={getStatusColor(job.jobStatus) as any}
                        size="small"
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box width={100}>
                      <LinearProgress
                        variant="determinate"
                        value={job.progress.progressPercentage}
                        sx={{ height: 4, mb: 0.5 }}
                      />
                      <Typography variant="caption">
                        {Math.round(job.progress.progressPercentage)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDistanceToNow(job.createdAt, { addSuffix: true })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5}>
                      {job.jobStatus === 'running' && (
                        <Tooltip title="Pause">
                          <IconButton
                            size="small"
                            onClick={() => handleJobAction('pause', job.jobId)}
                          >
                            <PauseIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {job.jobStatus === 'paused' && (
                        <Tooltip title="Resume">
                          <IconButton
                            size="small"
                            onClick={() => handleJobAction('resume', job.jobId)}
                          >
                            <StartIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {job.jobStatus === 'failed' && job.retryCount < job.maxRetries && (
                        <Tooltip title="Retry">
                          <IconButton
                            size="small"
                            onClick={() => handleJobAction('retry', job.jobId)}
                          >
                            <RetryIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(job.jobStatus === 'running' || job.jobStatus === 'paused') && (
                        <Tooltip title="Cancel">
                          <IconButton
                            size="small"
                            onClick={() => handleJobAction('cancel', job.jobId)}
                          >
                            <StopIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Details">
                        <IconButton
                          size="small"
                          onClick={() => handleJobDetail(job)}
                        >
                          <InfoIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={sortedJobs.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </>
    );
  };

  // Render job detail dialog
  const renderJobDetailDialog = () => (
    <Dialog
      open={jobDetailOpen}
      onClose={() => setJobDetailOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Job Details</DialogTitle>
      <DialogContent>
        {selectedJob && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Job Information</Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="Job ID" secondary={selectedJob.jobId} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Source ID" secondary={selectedJob.sourceId} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Method" secondary={selectedJob.method.toUpperCase()} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Type" secondary={selectedJob.jobType} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Priority" secondary={selectedJob.priority} />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Retry Count" secondary={`${selectedJob.retryCount}/${selectedJob.maxRetries}`} />
                </ListItem>
              </List>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>Progress</Typography>
              <Box mb={2}>
                <Typography variant="body2" gutterBottom>
                  {selectedJob.progress.currentStep}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={selectedJob.progress.progressPercentage}
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption">
                  {Math.round(selectedJob.progress.progressPercentage)}% Complete
                </Typography>
              </Box>
              
              <Typography variant="subtitle2" gutterBottom>Statistics</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2">Documents: {selectedJob.stats.documentsProcessed}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">Chunks: {selectedJob.stats.chunksGenerated}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">Embeddings: {selectedJob.stats.embeddingsCreated}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">Quality: {Math.round(selectedJob.stats.overallQualityScore)}%</Typography>
                </Grid>
              </Grid>
            </Grid>

            {selectedJob.error && (
              <Grid item xs={12}>
                <Alert severity="error">
                  <AlertTitle>Error Details</AlertTitle>
                  <Typography variant="body2" gutterBottom>
                    <strong>Code:</strong> {selectedJob.error.errorCode}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Message:</strong> {selectedJob.error.errorMessage}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Type:</strong> {selectedJob.error.errorType}
                  </Typography>
                  {selectedJob.error.suggestedActions && (
                    <Box mt={1}>
                      <Typography variant="body2" gutterBottom>
                        <strong>Suggested Actions:</strong>
                      </Typography>
                      <List dense>
                        {selectedJob.error.suggestedActions.map((action, index) => (
                          <ListItem key={index}>
                            <ListItemText primary={`• ${action}`} />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                </Alert>
              </Grid>
            )}
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setJobDetailOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  const allJobs = jobService.getAllJobs();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Job Management
      </Typography>

      {/* Queue Statistics */}
      {renderQueueStats()}

      {/* Job Table */}
      <Paper>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box display="flex" justifyContent="between" alignItems="center">
            <Typography variant="h6">
              All Jobs ({allJobs.length})
            </Typography>
            <Box display="flex" gap={1}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="running">Running</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                size="small"
                onClick={refreshJobQueue}
                startIcon={<RefreshIcon />}
              >
                Refresh
              </Button>
            </Box>
          </Box>
        </Box>

        {renderJobTable(
          filterStatus === 'all' 
            ? allJobs 
            : allJobs.filter(job => job.jobStatus === filterStatus)
        )}
      </Paper>

      {/* Job Detail Dialog */}
      {renderJobDetailDialog()}
    </Box>
  );
};

export default JobManagement;
