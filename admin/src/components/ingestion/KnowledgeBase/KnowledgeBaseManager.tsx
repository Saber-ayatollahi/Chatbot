/**
 * Knowledge Base Manager Component - Full Implementation
 * Phase 3, Day 12: Comprehensive knowledge base management system
 * Advanced KB operations, backup/restore, statistics, and data lifecycle management
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
} from '@mui/material';
import {
  Storage as StorageIcon,
  Delete as DeleteIcon,
  Backup as BackupIcon,
  Restore as RestoreIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { KnowledgeBaseManagerProps } from '../../../types/ingestion';

interface KnowledgeBaseStats {
  totalSources: number;
  totalChunks: number;
  totalEmbeddings: number;
  totalSize: number; // in bytes
  averageChunkSize: number;
  averageQuality: number;
  lastUpdated: Date;
  oldestDocument: Date;
  newestDocument: Date;
  sourceTypes: Record<string, number>;
  qualityDistribution: { range: string; count: number }[];
  sizeDistribution: { range: string; count: number }[];
}

interface BackupInfo {
  id: string;
  name: string;
  createdAt: Date;
  size: number;
  type: 'manual' | 'automatic' | 'scheduled';
  status: 'completed' | 'in_progress' | 'failed';
  description: string;
  metadata: {
    sources: number;
    chunks: number;
    embeddings: number;
    version: string;
  };
}

interface MaintenanceOperation {
  id: string;
  type: 'clear_kb' | 'backup' | 'restore' | 'optimize' | 'vacuum' | 'reindex';
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  results?: any;
}

// Mock knowledge base service
class KnowledgeBaseService {
  private static instance: KnowledgeBaseService;
  private operations: MaintenanceOperation[] = [];
  private backups: BackupInfo[] = [];

  static getInstance(): KnowledgeBaseService {
    if (!KnowledgeBaseService.instance) {
      KnowledgeBaseService.instance = new KnowledgeBaseService();
      KnowledgeBaseService.instance.initializeMockData();
    }
    return KnowledgeBaseService.instance;
  }

  private initializeMockData() {
    // Initialize mock backups
    this.backups = [
      {
        id: 'backup_001',
        name: 'Daily Backup - 2024-01-15',
        createdAt: new Date(Date.now() - 86400000), // 1 day ago
        size: 1024 * 1024 * 150, // 150MB
        type: 'automatic',
        status: 'completed',
        description: 'Automated daily backup',
        metadata: {
          sources: 1247,
          chunks: 45623,
          embeddings: 45623,
          version: '1.0.0',
        },
      },
      {
        id: 'backup_002',
        name: 'Pre-Migration Backup',
        createdAt: new Date(Date.now() - 172800000), // 2 days ago
        size: 1024 * 1024 * 142, // 142MB
        type: 'manual',
        status: 'completed',
        description: 'Manual backup before system migration',
        metadata: {
          sources: 1198,
          chunks: 43891,
          embeddings: 43891,
          version: '0.9.8',
        },
      },
      {
        id: 'backup_003',
        name: 'Weekly Backup - 2024-01-08',
        createdAt: new Date(Date.now() - 604800000), // 1 week ago
        size: 1024 * 1024 * 128, // 128MB
        type: 'scheduled',
        status: 'completed',
        description: 'Weekly scheduled backup',
        metadata: {
          sources: 1089,
          chunks: 39876,
          embeddings: 39876,
          version: '0.9.5',
        },
      },
    ];
  }

  getKnowledgeBaseStats(): KnowledgeBaseStats {
    return {
      totalSources: 1247,
      totalChunks: 45623,
      totalEmbeddings: 45623,
      totalSize: 1024 * 1024 * 180, // 180MB
      averageChunkSize: 4096, // 4KB average
      averageQuality: 87.3,
      lastUpdated: new Date(Date.now() - 3600000), // 1 hour ago
      oldestDocument: new Date('2023-06-15'),
      newestDocument: new Date(Date.now() - 1800000), // 30 minutes ago
      sourceTypes: {
        'PDF': 892,
        'DOCX': 234,
        'TXT': 89,
        'MD': 32,
      },
      qualityDistribution: [
        { range: '90-100%', count: 18456 },
        { range: '80-89%', count: 15234 },
        { range: '70-79%', count: 8934 },
        { range: '60-69%', count: 2567 },
        { range: '<60%', count: 432 },
      ],
      sizeDistribution: [
        { range: '<1KB', count: 2345 },
        { range: '1-5KB', count: 23456 },
        { range: '5-10KB', count: 15678 },
        { range: '10-20KB', count: 3456 },
        { range: '>20KB', count: 688 },
      ],
    };
  }

  getBackups(): BackupInfo[] {
    return this.backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getOperations(): MaintenanceOperation[] {
    return this.operations.sort((a, b) => (b.startedAt?.getTime() || 0) - (a.startedAt?.getTime() || 0));
  }

  async executeOperation(type: MaintenanceOperation['type'], options?: any): Promise<string> {
    const operation: MaintenanceOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      name: this.getOperationName(type),
      description: this.getOperationDescription(type),
      status: 'pending',
      progress: 0,
      startedAt: new Date(),
    };

    this.operations.push(operation);

    // Simulate operation execution
    setTimeout(() => {
      operation.status = 'running';
      this.simulateProgress(operation);
    }, 1000);

    return operation.id;
  }

  private simulateProgress(operation: MaintenanceOperation) {
    const interval = setInterval(() => {
      operation.progress += Math.random() * 20;
      
      if (operation.progress >= 100) {
        operation.progress = 100;
        operation.status = Math.random() > 0.1 ? 'completed' : 'failed';
        operation.completedAt = new Date();
        
        if (operation.status === 'failed') {
          operation.error = 'Simulated operation failure for demonstration';
        } else {
          operation.results = this.getOperationResults(operation.type);
        }
        
        clearInterval(interval);
      }
    }, 500);
  }

  private getOperationName(type: MaintenanceOperation['type']): string {
    switch (type) {
      case 'clear_kb': return 'Clear Knowledge Base';
      case 'backup': return 'Create Backup';
      case 'restore': return 'Restore from Backup';
      case 'optimize': return 'Optimize Database';
      case 'vacuum': return 'Vacuum Database';
      case 'reindex': return 'Rebuild Indexes';
      default: return 'Unknown Operation';
    }
  }

  private getOperationDescription(type: MaintenanceOperation['type']): string {
    switch (type) {
      case 'clear_kb': return 'Remove all sources, chunks, and embeddings from the knowledge base';
      case 'backup': return 'Create a complete backup of the knowledge base';
      case 'restore': return 'Restore knowledge base from a backup file';
      case 'optimize': return 'Optimize database performance and storage';
      case 'vacuum': return 'Reclaim storage space and defragment database';
      case 'reindex': return 'Rebuild database indexes for improved query performance';
      default: return 'Perform maintenance operation';
    }
  }

  private getOperationResults(type: MaintenanceOperation['type']): any {
    switch (type) {
      case 'clear_kb':
        return {
          sourcesRemoved: 1247,
          chunksRemoved: 45623,
          embeddingsRemoved: 45623,
          spaceReclaimed: '180MB',
        };
      case 'backup':
        return {
          backupSize: '180MB',
          sourcesBackedUp: 1247,
          chunksBackedUp: 45623,
          compressionRatio: '65%',
        };
      case 'optimize':
        return {
          performanceImprovement: '23%',
          spaceReclaimed: '15MB',
          indexesOptimized: 12,
        };
      default:
        return { completed: true };
    }
  }

  async cancelOperation(operationId: string): Promise<void> {
    const operation = this.operations.find(op => op.id === operationId);
    if (operation && (operation.status === 'pending' || operation.status === 'running')) {
      operation.status = 'cancelled';
      operation.completedAt = new Date();
    }
  }
}

const KnowledgeBaseManager: React.FC<KnowledgeBaseManagerProps> = ({
  onClearKnowledgeBase,
  onBackupKnowledgeBase,
  onRestoreKnowledgeBase,
  enableAdvancedOperations = true,
}) => {
  const [stats, setStats] = useState<KnowledgeBaseStats | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [operations, setOperations] = useState<MaintenanceOperation[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: string;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    type: '',
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [statsExpanded, setStatsExpanded] = useState(true);
  const [backupsExpanded, setBackupsExpanded] = useState(true);
  const [operationsExpanded, setOperationsExpanded] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const kbService = KnowledgeBaseService.getInstance();

  // Load data on mount
  useEffect(() => {
    refreshData();
    
    // Set up refresh interval
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, []);

  const refreshData = () => {
    setStats(kbService.getKnowledgeBaseStats());
    setBackups(kbService.getBackups());
    setOperations(kbService.getOperations());
  };

  // Handle operation execution
  const handleOperation = async (type: MaintenanceOperation['type']) => {
    try {
      await kbService.executeOperation(type);
      refreshData();
    } catch (error) {
      console.error('Operation failed:', error);
    }
  };

  // Handle clear knowledge base
  const handleClearKnowledgeBase = () => {
    setConfirmDialog({
      open: true,
      type: 'clear_kb',
      title: 'Clear Knowledge Base',
      message: 'This will permanently delete all sources, chunks, and embeddings. This action cannot be undone. Are you sure you want to proceed?',
      onConfirm: () => {
        handleOperation('clear_kb');
        onClearKnowledgeBase?.();
        setConfirmDialog({ ...confirmDialog, open: false });
      },
    });
  };

  // Handle backup creation
  const handleCreateBackup = () => {
    setConfirmDialog({
      open: true,
      type: 'backup',
      title: 'Create Backup',
      message: 'This will create a complete backup of the current knowledge base. The process may take several minutes depending on the size of your data.',
      onConfirm: () => {
        handleOperation('backup');
        onBackupKnowledgeBase?.();
        setConfirmDialog({ ...confirmDialog, open: false });
      },
    });
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'running': return 'info';
      case 'failed': return 'error';
      case 'cancelled': return 'warning';
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
      default: return <InfoIcon />;
    }
  };

  // Render knowledge base statistics
  const renderKnowledgeBaseStats = () => {
    if (!stats) return null;

    const pieData = Object.entries(stats.sourceTypes).map(([type, count]) => ({
      name: type,
      value: count,
      fill: ['#1976d2', '#f57c00', '#4caf50', '#9c27b0'][Object.keys(stats.sourceTypes).indexOf(type)],
    }));

    return (
      <Grid container spacing={3}>
        {/* Overview Cards */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h4" color="primary">
                        {stats.totalSources.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Sources
                      </Typography>
                    </Box>
                    <StorageIcon color="primary" />
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
                        {stats.totalChunks.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Chunks
                      </Typography>
                    </Box>
                    <TimelineIcon color="secondary" />
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
                        {stats.totalEmbeddings.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Embeddings
                      </Typography>
                    </Box>
                    <MemoryIcon color="info" />
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
                        {formatFileSize(stats.totalSize)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Size
                      </Typography>
                    </Box>
                    <SpeedIcon color="success" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* Charts */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Source Types Distribution" />
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Quality Distribution" />
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.qualityDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="count" fill="#4caf50" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Additional Stats */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Additional Statistics" />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Average Chunk Size"
                        secondary={formatFileSize(stats.averageChunkSize)}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Average Quality Score"
                        secondary={`${stats.averageQuality.toFixed(1)}%`}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Last Updated"
                        secondary={format(stats.lastUpdated, 'MMM dd, yyyy HH:mm')}
                      />
                    </ListItem>
                  </List>
                </Grid>
                <Grid item xs={12} md={6}>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Oldest Document"
                        secondary={format(stats.oldestDocument, 'MMM dd, yyyy')}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Newest Document"
                        secondary={format(stats.newestDocument, 'MMM dd, yyyy HH:mm')}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Storage Efficiency"
                        secondary={`${((stats.totalChunks * stats.averageChunkSize) / stats.totalSize * 100).toFixed(1)}%`}
                      />
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Render backup management
  const renderBackupManagement = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Backup Management</Typography>
          <Box display="flex" gap={1}>
            <Button
              variant="contained"
              startIcon={<BackupIcon />}
              onClick={handleCreateBackup}
            >
              Create Backup
            </Button>
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => onRestoreKnowledgeBase?.()}
            >
              Restore from File
            </Button>
          </Box>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Backup Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {backups.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {backup.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {backup.description}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={backup.type}
                      size="small"
                      color={backup.type === 'manual' ? 'primary' : backup.type === 'automatic' ? 'secondary' : 'info'}
                    />
                  </TableCell>
                  <TableCell>{formatFileSize(backup.size)}</TableCell>
                  <TableCell>{format(backup.createdAt, 'MMM dd, yyyy HH:mm')}</TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      {getStatusIcon(backup.status)}
                      <Chip
                        label={backup.status}
                        color={getStatusColor(backup.status) as any}
                        size="small"
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5}>
                      <Tooltip title="Download">
                        <IconButton size="small">
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Restore">
                        <IconButton size="small">
                          <RestoreIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small">
                          <DeleteIcon />
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
          count={backups.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </Grid>
    </Grid>
  );

  // Render maintenance operations
  const renderMaintenanceOperations = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Maintenance Operations</Typography>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={() => handleOperation('optimize')}
            >
              Optimize
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => handleOperation('reindex')}
            >
              Reindex
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleClearKnowledgeBase}
            >
              Clear Knowledge Base
            </Button>
          </Box>
        </Box>

        {operations.length === 0 ? (
          <Alert severity="info">
            <AlertTitle>No Operations</AlertTitle>
            No maintenance operations have been performed recently.
          </Alert>
        ) : (
          <List>
            {operations.map((operation) => (
              <ListItem
                key={operation.id}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                <ListItemIcon>
                  {getStatusIcon(operation.status)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      {operation.name}
                      <Chip
                        label={operation.status}
                        color={getStatusColor(operation.status) as any}
                        size="small"
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2">{operation.description}</Typography>
                      {operation.status === 'running' && (
                        <LinearProgress
                          variant="determinate"
                          value={operation.progress}
                          sx={{ mt: 1, height: 4 }}
                        />
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {operation.startedAt && `Started: ${format(operation.startedAt, 'MMM dd, yyyy HH:mm')}`}
                        {operation.completedAt && ` • Completed: ${format(operation.completedAt, 'MMM dd, yyyy HH:mm')}`}
                      </Typography>
                    </Box>
                  }
                />
                {operation.status === 'running' && (
                  <ListItemSecondaryAction>
                    <Button
                      size="small"
                      onClick={() => kbService.cancelOperation(operation.id)}
                    >
                      Cancel
                    </Button>
                  </ListItemSecondaryAction>
                )}
              </ListItem>
            ))}
          </List>
        )}
      </Grid>
    </Grid>
  );

  // Render confirmation dialog
  const renderConfirmationDialog = () => (
    <Dialog
      open={confirmDialog.open}
      onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{confirmDialog.title}</DialogTitle>
      <DialogContent>
        <Alert severity={confirmDialog.type === 'clear_kb' ? 'error' : 'warning'}>
          <AlertTitle>Confirmation Required</AlertTitle>
          {confirmDialog.message}
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
          Cancel
        </Button>
        <Button
          onClick={confirmDialog.onConfirm}
          variant="contained"
          color={confirmDialog.type === 'clear_kb' ? 'error' : 'primary'}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">
          Knowledge Base Management
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={refreshData}
        >
          Refresh
        </Button>
      </Box>

      {/* Knowledge Base Statistics */}
      <Accordion expanded={statsExpanded} onChange={() => setStatsExpanded(!statsExpanded)} sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandIcon />}>
          <Typography variant="h6">Knowledge Base Statistics</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {renderKnowledgeBaseStats()}
        </AccordionDetails>
      </Accordion>

      {/* Backup Management */}
      <Accordion expanded={backupsExpanded} onChange={() => setBackupsExpanded(!backupsExpanded)} sx={{ mb: 3 }}>
        <AccordionSummary expandIcon={<ExpandIcon />}>
          <Typography variant="h6">Backup Management</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {renderBackupManagement()}
        </AccordionDetails>
      </Accordion>

      {/* Maintenance Operations */}
      <Accordion expanded={operationsExpanded} onChange={() => setOperationsExpanded(!operationsExpanded)}>
        <AccordionSummary expandIcon={<ExpandIcon />}>
          <Typography variant="h6">Maintenance Operations</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {renderMaintenanceOperations()}
        </AccordionDetails>
      </Accordion>

      {/* Confirmation Dialog */}
      {renderConfirmationDialog()}
    </Box>
  );
};

export default KnowledgeBaseManager;
