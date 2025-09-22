/**
 * Processing Pipeline Component - Full Implementation
 * Phase 3: Processing Pipeline & Monitoring
 * Comprehensive processing method selection and job management
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
  Tabs,
  Tab,
  Stepper,
  Step,
  StepLabel,
  StepContent,
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
  Chip,
  LinearProgress,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Slider,
  Tooltip,
  Badge,
  Divider,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Assessment as QualityIcon,
  Memory as MemoryIcon,
  Timer as TimerIcon,
  TrendingUp as PerformanceIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Compare as CompareIcon,
  Recommend as RecommendIcon,
  ExpandMore as ExpandIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  Queue as QueueIcon,
  Monitoring as MonitoringIcon,
} from '@mui/icons-material';
import { ProcessingPipelineProps, IngestionMethod, IngestionConfig } from '../../../types/ingestion';

// Import new components
import MethodSelector from './MethodSelector';
import JobManagement from './JobManagement';
import ProcessingMonitor from './ProcessingMonitor';

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

const ProcessingPipeline: React.FC<ProcessingPipelineProps> = ({
  methods,
  onMethodSelect,
  onConfigurationChange,
  onStartProcessing,
  onStopProcessing,
  onPauseProcessing,
  onResumeProcessing,
  currentJob,
  availableConfigurations,
  enableAdvancedOptions,
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<IngestionMethod>('enhanced');
  const [configuration, setConfiguration] = useState<IngestionConfig | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  // Handle method selection
  const handleMethodSelect = (method: IngestionMethod) => {
    setSelectedMethod(method);
    onMethodSelect(method);
  };

  // Handle configuration change
  const handleConfigurationChange = (config: IngestionConfig) => {
    setConfiguration(config);
    onConfigurationChange(config);
  };

  // Handle start processing
  const handleStartProcessing = async () => {
    if (!configuration) return;
    
    setLoading(true);
    try {
      await onStartProcessing(configuration);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start processing');
    } finally {
      setLoading(false);
    }
  };

  // Render pipeline status
  const renderPipelineStatus = () => {
    if (!currentJob) {
      return (
        <Alert severity="info">
          <AlertTitle>No Active Processing</AlertTitle>
          Select a processing method and configuration to get started.
        </Alert>
      );
    }

    return (
      <Card>
        <CardHeader
          title={`Current Job: ${currentJob.method.toUpperCase()}`}
          subheader={`Status: ${currentJob.jobStatus}`}
          action={
            <Box display="flex" gap={1}>
              {currentJob.jobStatus === 'running' && (
                <>
                  <Button
                    size="small"
                    startIcon={<PauseIcon />}
                    onClick={() => onPauseProcessing(currentJob.jobId)}
                  >
                    Pause
                  </Button>
                  <Button
                    size="small"
                    startIcon={<StopIcon />}
                    onClick={() => onStopProcessing(currentJob.jobId)}
                    color="error"
                  >
                    Stop
                  </Button>
                </>
              )}
              {currentJob.jobStatus === 'paused' && (
                <Button
                  size="small"
                  startIcon={<StartIcon />}
                  onClick={() => onResumeProcessing(currentJob.jobId)}
                  color="primary"
                >
                  Resume
                </Button>
              )}
            </Box>
          }
        />
        <CardContent>
          <Box mb={2}>
            <Typography variant="body2" gutterBottom>
              {currentJob.progress.currentStep}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={currentJob.progress.progressPercentage}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Box display="flex" justifyContent="space-between" mt={1}>
              <Typography variant="caption">
                {Math.round(currentJob.progress.progressPercentage)}% Complete
              </Typography>
              <Typography variant="caption">
                {currentJob.progress.completedSteps} / {currentJob.progress.totalSteps} steps
              </Typography>
            </Box>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="h6" color="primary">
                {currentJob.stats.documentsProcessed}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Documents
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="h6" color="secondary">
                {currentJob.stats.chunksGenerated}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Chunks
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="h6" color="info.main">
                {currentJob.stats.embeddingsCreated}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Embeddings
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="h6" color="success.main">
                {Math.round(currentJob.stats.averageChunkQuality)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Quality
              </Typography>
            </Grid>
          </Grid>

          {currentJob.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <AlertTitle>Processing Error</AlertTitle>
              {currentJob.error.errorMessage}
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Processing Pipeline Control
      </Typography>

      {/* Pipeline Status */}
      <Box mb={3}>
        {renderPipelineStatus()}
      </Box>

      {/* Main Tabs */}
      <Paper>
        <Tabs value={currentTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab 
            icon={<SettingsIcon />} 
            label="Method Selection" 
            iconPosition="start"
          />
          <Tab 
            icon={<QueueIcon />} 
            label="Job Management" 
            iconPosition="start"
          />
          <Tab 
            icon={<MonitoringIcon />} 
            label="Monitoring" 
            iconPosition="start"
          />
        </Tabs>

        <TabPanel value={currentTab} index={0}>
          <MethodSelector
            methods={methods}
            selectedMethod={selectedMethod}
            onMethodSelect={handleMethodSelect}
            onConfigurationChange={handleConfigurationChange}
            onStartProcessing={handleStartProcessing}
            availableConfigurations={availableConfigurations}
            enableAdvancedOptions={enableAdvancedOptions}
            loading={loading}
            error={error}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <JobManagement
            currentJob={currentJob}
            onStartProcessing={onStartProcessing}
            onStopProcessing={onStopProcessing}
            onPauseProcessing={onPauseProcessing}
            onResumeProcessing={onResumeProcessing}
          />
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <ProcessingMonitor
            currentJob={currentJob}
            refreshInterval={5000}
            enableRealTime={true}
          />
        </TabPanel>
      </Paper>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          <AlertTitle>Pipeline Error</AlertTitle>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default ProcessingPipeline;
