/**
 * Bulk Operations Manager Component
 * Phase 2, Day 7 Afternoon: Advanced bulk file operations
 * Comprehensive batch processing with progress tracking and error handling
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
  LinearProgress,
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
  Stepper,
  Step,
  StepLabel,
  StepContent,
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
  Divider,
  Tooltip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Refresh as RetryIcon,
  Delete as DeleteIcon,
  GetApp as DownloadIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  FileCopy as CopyIcon,
  DriveFileMove as MoveIcon,
  Label as TagIcon,
  Security as SecurityIcon,
  Compress as CompressIcon,
  Transform as TransformIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandIcon,
  Close as CloseIcon,
  Settings as SettingsIcon,
  Schedule as ScheduleIcon,
  Assessment as ReportIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { FileUpload } from '../../../types/ingestion';

interface BulkOperation {
  id: string;
  type: BulkOperationType;
  name: string;
  description: string;
  fileIds: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
  progress: number;
  currentStep: string;
  totalSteps: number;
  completedItems: number;
  failedItems: number;
  results: BulkOperationResult[];
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;
  options: BulkOperationOptions;
  error?: string;
}

interface BulkOperationResult {
  fileId: string;
  filename: string;
  status: 'success' | 'error' | 'skipped';
  message?: string;
  details?: any;
}

interface BulkOperationOptions {
  continueOnError: boolean;
  createBackup: boolean;
  notifyOnCompletion: boolean;
  parallelProcessing: boolean;
  maxConcurrency: number;
  retryFailures: boolean;
  maxRetries: number;
  customSettings?: Record<string, any>;
}

type BulkOperationType = 
  | 'delete'
  | 'archive'
  | 'unarchive'
  | 'move'
  | 'copy'
  | 'tag'
  | 'process'
  | 'download'
  | 'compress'
  | 'transform'
  | 'validate'
  | 'backup';

interface BulkOperationsManagerProps {
  files: FileUpload[];
  selectedFileIds: string[];
  onOperationComplete: (operation: BulkOperation) => void;
  onFilesChanged: () => void;
  enabledOperations?: BulkOperationType[];
}

// Mock bulk operations service
class BulkOperationsService {
  private static instance: BulkOperationsService;
  private operations: Map<string, BulkOperation> = new Map();
  private activeOperations: Map<string, AbortController> = new Map();

  static getInstance(): BulkOperationsService {
    if (!BulkOperationsService.instance) {
      BulkOperationsService.instance = new BulkOperationsService();
    }
    return BulkOperationsService.instance;
  }

  async executeOperation(
    operation: BulkOperation,
    onProgress: (progress: number, currentStep: string) => void
  ): Promise<BulkOperationResult[]> {
    const abortController = new AbortController();
    this.activeOperations.set(operation.id, abortController);

    try {
      const results: BulkOperationResult[] = [];
      const totalFiles = operation.fileIds.length;
      
      operation.status = 'running';
      operation.startedAt = new Date();
      this.operations.set(operation.id, operation);

      // Simulate processing each file
      for (let i = 0; i < totalFiles; i++) {
        if (abortController.signal.aborted) {
          throw new Error('Operation cancelled');
        }

        const fileId = operation.fileIds[i];
        const progress = ((i + 1) / totalFiles) * 100;
        
        onProgress(progress, `Processing file ${i + 1} of ${totalFiles}`);

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

        // Simulate success/failure
        const success = Math.random() > 0.1; // 90% success rate
        
        results.push({
          fileId,
          filename: `file_${fileId}`,
          status: success ? 'success' : 'error',
          message: success ? 'Operation completed successfully' : 'Operation failed',
          details: success ? { processed: true } : { error: 'Simulated error' }
        });

        if (!success && !operation.options.continueOnError) {
          throw new Error(`Operation failed for file ${fileId}`);
        }
      }

      operation.status = 'completed';
      operation.completedAt = new Date();
      operation.progress = 100;
      operation.results = results;
      operation.completedItems = results.filter(r => r.status === 'success').length;
      operation.failedItems = results.filter(r => r.status === 'error').length;

      this.operations.set(operation.id, operation);
      this.activeOperations.delete(operation.id);

      return results;
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      operation.completedAt = new Date();
      
      this.operations.set(operation.id, operation);
      this.activeOperations.delete(operation.id);
      
      throw error;
    }
  }

  cancelOperation(operationId: string): void {
    const controller = this.activeOperations.get(operationId);
    if (controller) {
      controller.abort();
    }

    const operation = this.operations.get(operationId);
    if (operation) {
      operation.status = 'cancelled';
      operation.completedAt = new Date();
      this.operations.set(operationId, operation);
    }
  }

  getOperation(operationId: string): BulkOperation | undefined {
    return this.operations.get(operationId);
  }

  getAllOperations(): BulkOperation[] {
    return Array.from(this.operations.values()).sort((a, b) => 
      (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0)
    );
  }
}

const BulkOperationsManager: React.FC<BulkOperationsManagerProps> = ({
  files,
  selectedFileIds,
  onOperationComplete,
  onFilesChanged,
  enabledOperations = ['delete', 'archive', 'move', 'copy', 'tag', 'process', 'download', 'compress'],
}) => {
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [currentOperation, setCurrentOperation] = useState<BulkOperation | null>(null);
  const [operationDialogOpen, setOperationDialogOpen] = useState(false);
  const [selectedOperationType, setSelectedOperationType] = useState<BulkOperationType>('process');
  const [operationOptions, setOperationOptions] = useState<BulkOperationOptions>({
    continueOnError: true,
    createBackup: false,
    notifyOnCompletion: true,
    parallelProcessing: false,
    maxConcurrency: 3,
    retryFailures: true,
    maxRetries: 2,
  });
  const [activeStep, setActiveStep] = useState(0);

  const bulkService = BulkOperationsService.getInstance();

  // Load operations on mount
  useEffect(() => {
    refreshOperations();
  }, []);

  const refreshOperations = () => {
    setOperations(bulkService.getAllOperations());
  };

  // Available operation types
  const operationTypes: Record<BulkOperationType, { name: string; description: string; icon: React.ReactNode; color: string }> = {
    delete: {
      name: 'Delete Files',
      description: 'Permanently remove selected files',
      icon: <DeleteIcon />,
      color: 'error'
    },
    archive: {
      name: 'Archive Files',
      description: 'Move files to archive folder',
      icon: <ArchiveIcon />,
      color: 'warning'
    },
    unarchive: {
      name: 'Unarchive Files',
      description: 'Restore files from archive',
      icon: <UnarchiveIcon />,
      color: 'info'
    },
    move: {
      name: 'Move Files',
      description: 'Move files to different location',
      icon: <MoveIcon />,
      color: 'primary'
    },
    copy: {
      name: 'Copy Files',
      description: 'Create copies of selected files',
      icon: <CopyIcon />,
      color: 'secondary'
    },
    tag: {
      name: 'Tag Files',
      description: 'Add tags to selected files',
      icon: <TagIcon />,
      color: 'success'
    },
    process: {
      name: 'Process Files',
      description: 'Start ingestion processing',
      icon: <TransformIcon />,
      color: 'primary'
    },
    download: {
      name: 'Download Files',
      description: 'Download files as archive',
      icon: <DownloadIcon />,
      color: 'info'
    },
    compress: {
      name: 'Compress Files',
      description: 'Create compressed archive',
      icon: <CompressIcon />,
      color: 'secondary'
    },
    transform: {
      name: 'Transform Files',
      description: 'Convert file formats',
      icon: <TransformIcon />,
      color: 'warning'
    },
    validate: {
      name: 'Validate Files',
      description: 'Run validation checks',
      icon: <SecurityIcon />,
      color: 'info'
    },
    backup: {
      name: 'Backup Files',
      description: 'Create backup copies',
      icon: <ArchiveIcon />,
      color: 'success'
    }
  };

  // Start bulk operation
  const startBulkOperation = async () => {
    if (selectedFileIds.length === 0) return;

    const operation: BulkOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: selectedOperationType,
      name: operationTypes[selectedOperationType].name,
      description: operationTypes[selectedOperationType].description,
      fileIds: [...selectedFileIds],
      status: 'pending',
      progress: 0,
      currentStep: 'Initializing...',
      totalSteps: selectedFileIds.length,
      completedItems: 0,
      failedItems: 0,
      results: [],
      options: { ...operationOptions },
    };

    setCurrentOperation(operation);
    setOperationDialogOpen(false);
    setActiveStep(1);

    try {
      const results = await bulkService.executeOperation(operation, (progress, step) => {
        setCurrentOperation(prev => prev ? {
          ...prev,
          progress,
          currentStep: step,
        } : null);
      });

      onOperationComplete(operation);
      onFilesChanged();
      refreshOperations();
      setActiveStep(2);
    } catch (error) {
      console.error('Bulk operation failed:', error);
      refreshOperations();
      setActiveStep(2);
    }
  };

  // Cancel operation
  const cancelOperation = (operationId: string) => {
    bulkService.cancelOperation(operationId);
    refreshOperations();
    if (currentOperation?.id === operationId) {
      setCurrentOperation(null);
      setActiveStep(0);
    }
  };

  // Get operation status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'info';
      case 'failed': return 'error';
      case 'cancelled': return 'warning';
      default: return 'default';
    }
  };

  // Get operation status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <SuccessIcon />;
      case 'running': return <CircularProgress size={20} />;
      case 'failed': return <ErrorIcon />;
      case 'cancelled': return <WarningIcon />;
      default: return <InfoIcon />;
    }
  };

  // Render operation configuration dialog
  const renderOperationDialog = () => (
    <Dialog
      open={operationDialogOpen}
      onClose={() => setOperationDialogOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Configure Bulk Operation
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Alert severity="info">
              <AlertTitle>Selected Files</AlertTitle>
              {selectedFileIds.length} files selected for bulk operation
            </Alert>
          </Grid>

          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Operation Type</InputLabel>
              <Select
                value={selectedOperationType}
                onChange={(e) => setSelectedOperationType(e.target.value as BulkOperationType)}
                label="Operation Type"
              >
                {enabledOperations.map((type) => (
                  <MenuItem key={type} value={type}>
                    <Box display="flex" alignItems="center" gap={1}>
                      {operationTypes[type].icon}
                      <Box>
                        <Typography variant="body1">{operationTypes[type].name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {operationTypes[type].description}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>Operation Options</Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={operationOptions.continueOnError}
                      onChange={(e) => setOperationOptions(prev => ({
                        ...prev,
                        continueOnError: e.target.checked
                      }))}
                    />
                  }
                  label="Continue on Error"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={operationOptions.createBackup}
                      onChange={(e) => setOperationOptions(prev => ({
                        ...prev,
                        createBackup: e.target.checked
                      }))}
                    />
                  }
                  label="Create Backup"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={operationOptions.notifyOnCompletion}
                      onChange={(e) => setOperationOptions(prev => ({
                        ...prev,
                        notifyOnCompletion: e.target.checked
                      }))}
                    />
                  }
                  label="Notify on Completion"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={operationOptions.parallelProcessing}
                      onChange={(e) => setOperationOptions(prev => ({
                        ...prev,
                        parallelProcessing: e.target.checked
                      }))}
                    />
                  }
                  label="Parallel Processing"
                />
              </Grid>

              {operationOptions.parallelProcessing && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Max Concurrency"
                    value={operationOptions.maxConcurrency}
                    onChange={(e) => setOperationOptions(prev => ({
                      ...prev,
                      maxConcurrency: parseInt(e.target.value) || 1
                    }))}
                    inputProps={{ min: 1, max: 10 }}
                  />
                </Grid>
              )}

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Max Retries"
                  value={operationOptions.maxRetries}
                  onChange={(e) => setOperationOptions(prev => ({
                    ...prev,
                    maxRetries: parseInt(e.target.value) || 0
                  }))}
                  inputProps={{ min: 0, max: 5 }}
                />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOperationDialogOpen(false)}>
          Cancel
        </Button>
        <Button
          onClick={startBulkOperation}
          variant="contained"
          disabled={selectedFileIds.length === 0}
        >
          Start Operation
        </Button>
      </DialogActions>
    </Dialog>
  );

  // Render current operation progress
  const renderCurrentOperation = () => {
    if (!currentOperation) return null;

    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Current Operation: {currentOperation.name}
        </Typography>

        <Stepper activeStep={activeStep} orientation="vertical">
          <Step>
            <StepLabel>Configure Operation</StepLabel>
            <StepContent>
              <Typography>Operation configured and ready to start</Typography>
            </StepContent>
          </Step>
          
          <Step>
            <StepLabel>Processing Files</StepLabel>
            <StepContent>
              <Box mb={2}>
                <Typography variant="body2" gutterBottom>
                  {currentOperation.currentStep}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={currentOperation.progress}
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Box display="flex" justifyContent="space-between" mt={1}>
                  <Typography variant="caption">
                    {Math.round(currentOperation.progress)}% Complete
                  </Typography>
                  <Typography variant="caption">
                    {currentOperation.completedItems} / {currentOperation.totalSteps} files
                  </Typography>
                </Box>
              </Box>
              
              <Box display="flex" gap={1}>
                <Button
                  size="small"
                  onClick={() => cancelOperation(currentOperation.id)}
                  startIcon={<StopIcon />}
                >
                  Cancel
                </Button>
              </Box>
            </StepContent>
          </Step>
          
          <Step>
            <StepLabel>Operation Complete</StepLabel>
            <StepContent>
              <Alert severity={currentOperation.status === 'completed' ? 'success' : 'error'}>
                <AlertTitle>
                  {currentOperation.status === 'completed' ? 'Success' : 'Failed'}
                </AlertTitle>
                Operation {currentOperation.status}. 
                {currentOperation.completedItems} files processed successfully.
                {currentOperation.failedItems > 0 && ` ${currentOperation.failedItems} files failed.`}
              </Alert>
              
              <Button
                sx={{ mt: 2 }}
                onClick={() => {
                  setCurrentOperation(null);
                  setActiveStep(0);
                }}
              >
                Close
              </Button>
            </StepContent>
          </Step>
        </Stepper>
      </Paper>
    );
  };

  // Render operations history
  const renderOperationsHistory = () => (
    <Paper sx={{ mt: 3 }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6">Operations History</Typography>
      </Box>
      
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Operation</TableCell>
              <TableCell>Files</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell>Started</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {operations.map((operation) => (
              <TableRow key={operation.id}>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    {operationTypes[operation.type].icon}
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {operation.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {operation.description}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {operation.fileIds.length} files
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    icon={getStatusIcon(operation.status)}
                    label={operation.status}
                    color={getStatusColor(operation.status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box width={100}>
                    <LinearProgress
                      variant="determinate"
                      value={operation.progress}
                      sx={{ height: 4 }}
                    />
                    <Typography variant="caption">
                      {Math.round(operation.progress)}%
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {operation.startedAt ? format(operation.startedAt, 'MMM dd, HH:mm') : '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={0.5}>
                    {operation.status === 'running' && (
                      <Tooltip title="Cancel">
                        <IconButton
                          size="small"
                          onClick={() => cancelOperation(operation.id)}
                        >
                          <StopIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {operation.status === 'failed' && (
                      <Tooltip title="Retry">
                        <IconButton size="small">
                          <RetryIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );

  return (
    <Box>
      {/* Bulk operations toolbar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Bulk Operations
            {selectedFileIds.length > 0 && (
              <Chip
                label={`${selectedFileIds.length} selected`}
                color="primary"
                size="small"
                sx={{ ml: 2 }}
              />
            )}
          </Typography>
          
          <Button
            variant="contained"
            startIcon={<SettingsIcon />}
            onClick={() => setOperationDialogOpen(true)}
            disabled={selectedFileIds.length === 0}
          >
            Configure Operation
          </Button>
        </Box>

        {selectedFileIds.length > 0 && (
          <Box mt={2}>
            <Typography variant="subtitle2" gutterBottom>
              Quick Actions:
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {enabledOperations.slice(0, 6).map((type) => (
                <Button
                  key={type}
                  size="small"
                  variant="outlined"
                  startIcon={operationTypes[type].icon}
                  onClick={() => {
                    setSelectedOperationType(type);
                    setOperationDialogOpen(true);
                  }}
                >
                  {operationTypes[type].name}
                </Button>
              ))}
            </Box>
          </Box>
        )}
      </Paper>

      {/* Current operation progress */}
      {renderCurrentOperation()}

      {/* Operations history */}
      {renderOperationsHistory()}

      {/* Operation configuration dialog */}
      {renderOperationDialog()}
    </Box>
  );
};

export default BulkOperationsManager;
