/**
 * Upload Progress Component
 * Real-time upload progress tracking with detailed statistics
 */

import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  Collapse,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Speed as SpeedIcon,
  Timer as TimerIcon,
  Storage as SizeIcon,
} from '@mui/icons-material';
import { FileUpload } from '../../../types/ingestion';

interface UploadProgressProps {
  uploads: FileUpload[];
  totalProgress: number;
  uploading: boolean;
  onCancel?: (uploadId: string) => void;
  showDetails?: boolean;
}

const UploadProgress: React.FC<UploadProgressProps> = ({
  uploads,
  totalProgress,
  uploading,
  onCancel,
  showDetails = true,
}) => {
  const [expanded, setExpanded] = React.useState(false);

  // Calculate statistics
  const stats = React.useMemo(() => {
    const total = uploads.length;
    const completed = uploads.filter(u => u.uploadStatus === 'completed').length;
    const failed = uploads.filter(u => u.uploadStatus === 'failed').length;
    const processing = uploads.filter(u => u.uploadStatus === 'processing').length;
    const totalSize = uploads.reduce((sum, u) => sum + u.fileSize, 0);
    const completedSize = uploads
      .filter(u => u.uploadStatus === 'completed')
      .reduce((sum, u) => sum + u.fileSize, 0);

    return {
      total,
      completed,
      failed,
      processing,
      totalSize,
      completedSize,
      successRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }, [uploads]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Get file icon based on status
  const getStatusIcon = (upload: FileUpload) => {
    switch (upload.uploadStatus) {
      case 'completed':
        return <SuccessIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'processing':
        return <UploadIcon color="primary" />;
      default:
        return <UploadIcon />;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'processing': return 'primary';
      default: return 'default';
    }
  };

  if (uploads.length === 0) {
    return null;
  }

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        {/* Header with overall progress */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Upload Progress
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body2" color="text.secondary">
              {stats.completed}/{stats.total} files
            </Typography>
            {showDetails && (
              <IconButton
                size="small"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <CollapseIcon /> : <ExpandIcon />}
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Overall progress bar */}
        <Box mb={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2">
              Overall Progress
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(totalProgress)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={totalProgress}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {/* Statistics */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center">
              <Typography variant="h6" color="primary">
                {stats.total}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Files
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center">
              <Typography variant="h6" color="success.main">
                {stats.completed}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Completed
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center">
              <Typography variant="h6" color="error.main">
                {stats.failed}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Failed
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Box textAlign="center">
              <Typography variant="h6" color="info.main">
                {stats.processing}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Processing
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Additional stats */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Tooltip title="Total Size">
              <Box display="flex" alignItems="center" gap={0.5}>
                <SizeIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {formatFileSize(stats.totalSize)}
                </Typography>
              </Box>
            </Tooltip>
            <Tooltip title="Success Rate">
              <Box display="flex" alignItems="center" gap={0.5}>
                <SpeedIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {Math.round(stats.successRate)}%
                </Typography>
              </Box>
            </Tooltip>
          </Box>
          <Chip
            label={uploading ? 'Uploading...' : 'Complete'}
            color={uploading ? 'primary' : 'success'}
            size="small"
          />
        </Box>

        {/* Detailed file list */}
        {showDetails && (
          <Collapse in={expanded}>
            <Typography variant="subtitle2" gutterBottom>
              File Details
            </Typography>
            <List dense>
              {uploads.map((upload) => (
                <ListItem key={upload.uploadId} divider>
                  <ListItemIcon>
                    {getStatusIcon(upload)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" noWrap>
                          {upload.originalName}
                        </Typography>
                        <Chip
                          label={upload.uploadStatus}
                          color={getStatusColor(upload.uploadStatus) as any}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {formatFileSize(upload.fileSize)}
                        </Typography>
                        {upload.uploadProgress !== undefined && upload.uploadStatus === 'processing' && (
                          <Box sx={{ mt: 0.5 }}>
                            <LinearProgress
                              variant="determinate"
                              value={upload.uploadProgress}
                              size="small"
                              sx={{ height: 4 }}
                            />
                          </Box>
                        )}
                        {upload.validationErrors && upload.validationErrors.length > 0 && (
                          <Typography variant="caption" color="error.main">
                            {upload.validationErrors[0]}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    {upload.uploadStatus === 'processing' && onCancel && (
                      <Tooltip title="Cancel Upload">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => onCancel(upload.uploadId)}
                        >
                          <CancelIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Collapse>
        )}
      </CardContent>
    </Card>
  );
};

export default UploadProgress;
