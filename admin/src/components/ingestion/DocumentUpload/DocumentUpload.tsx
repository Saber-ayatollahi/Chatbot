/**
 * Document Upload Component - Full Implementation
 * Phase 2: Document Upload & Staging
 * Comprehensive drag-and-drop upload with validation and staging management
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Badge,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Visibility as PreviewIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  GetApp as DownloadIcon,
  FolderOpen as FolderIcon,
  InsertDriveFile as FileIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  TextSnippet as TextIcon,
  Code as CodeIcon,
  Clear as ClearIcon,
  PlayArrow as ProcessIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';

import { DocumentUploadProps, FileUpload, ValidationStatus, FileStatus } from '../../../types/ingestion';
import { useFileUpload } from '../../../hooks/useFileUpload';
import UploadProgress from './UploadProgress';
import StagingManager from './StagingManager';
import FileMetadataViewer from './FileMetadataViewer';
import AdvancedFileSearch from './AdvancedFileSearch';

// File type icons mapping
const getFileIcon = (mimeType: string) => {
  if (mimeType.includes('pdf')) return <PdfIcon />;
  if (mimeType.includes('word') || mimeType.includes('document')) return <DocIcon />;
  if (mimeType.includes('text')) return <TextIcon />;
  if (mimeType.includes('markdown')) return <CodeIcon />;
  return <FileIcon />;
};

// File size formatter
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Status color mapping
const getStatusColor = (status: FileStatus | ValidationStatus) => {
  switch (status) {
    case 'completed':
    case 'valid': return 'success';
    case 'processing':
    case 'pending': return 'info';
    case 'failed':
    case 'invalid': return 'error';
    case 'quarantined':
    case 'warning': return 'warning';
    default: return 'default';
  }
};

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  onUpload,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  supportedFormats,
  maxFileSize,
  maxFiles,
  stagingFolder,
  enableDragDrop = true,
  enableBulkUpload = true,
  enablePreview = true,
}) => {
  // State management
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewFile, setPreviewFile] = useState<FileUpload | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [filteredUploads, setFilteredUploads] = useState<FileUpload[]>([]);
  const [uploadSettings, setUploadSettings] = useState({
    autoProcess: false,
    virusScanning: true,
    duplicateDetection: true,
    qualityValidation: true,
  });

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Use file upload hook
  const {
    uploads,
    uploading,
    uploadProgress,
    error: uploadError,
    uploadFiles,
    cancelUpload,
    retryUpload,
    deleteUpload,
    clearUploads,
  } = useFileUpload();

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setValidationErrors([]);
    
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(({ file, errors }) => 
        `${file.name}: ${errors.map((e: any) => e.message).join(', ')}`
      );
      setValidationErrors(errors);
    }

    // Validate accepted files
    const validFiles: File[] = [];
    const newErrors: string[] = [];

    acceptedFiles.forEach(file => {
      // Check file size
      if (file.size > maxFileSize) {
        newErrors.push(`${file.name}: File size exceeds ${formatFileSize(maxFileSize)}`);
        return;
      }

      // Check file type
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (fileExtension && !supportedFormats.includes(fileExtension)) {
        newErrors.push(`${file.name}: Unsupported file type. Supported: ${supportedFormats.join(', ')}`);
        return;
      }

      // Check total files limit
      if (selectedFiles.length + validFiles.length >= maxFiles) {
        newErrors.push(`Maximum ${maxFiles} files allowed`);
        return;
      }

      validFiles.push(file);
    });

    if (newErrors.length > 0) {
      setValidationErrors(prev => [...prev, ...newErrors]);
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  }, [maxFileSize, maxFiles, supportedFormats, selectedFiles.length]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: supportedFormats.reduce((acc, format) => {
      switch (format) {
        case 'pdf': acc['application/pdf'] = ['.pdf']; break;
        case 'docx': acc['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] = ['.docx']; break;
        case 'txt': acc['text/plain'] = ['.txt']; break;
        case 'md': acc['text/markdown'] = ['.md']; break;
        default: break;
      }
      return acc;
    }, {} as any),
    maxSize: maxFileSize,
    maxFiles: maxFiles,
    disabled: !enableDragDrop || uploading,
  });

  // Handle file upload
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      await uploadFiles(selectedFiles);
      onUploadComplete(uploads);
      setSelectedFiles([]);
      setValidationErrors([]);
    } catch (error) {
      onUploadError(error as Error);
    }
  };

  // Handle file removal from selection
  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle clear all
  const handleClearAll = () => {
    setSelectedFiles([]);
    setValidationErrors([]);
  };

  // Handle file preview
  const handlePreview = (upload: FileUpload) => {
    setPreviewFile(upload);
    setPreviewDialogOpen(true);
  };

  // Handle metadata view
  const handleViewMetadata = (upload: FileUpload) => {
    setPreviewFile(upload);
    setMetadataDialogOpen(true);
  };

  // Handle search filter changes
  const handleSearchFiltersChange = (filtered: FileUpload[]) => {
    setFilteredUploads(filtered);
  };

  // Use filtered uploads from search component, fallback to basic filtering
  const displayUploads = filteredUploads.length > 0 ? filteredUploads : uploads.filter(upload => {
    const matchesStatus = statusFilter === 'all' || upload.uploadStatus === statusFilter;
    const matchesSearch = searchFilter === '' || 
      upload.filename.toLowerCase().includes(searchFilter.toLowerCase()) ||
      upload.originalName.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Paginated uploads
  const paginatedUploads = displayUploads.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Handle page change
  const handlePageChange = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Upload progress handler
  useEffect(() => {
    if (uploadProgress > 0) {
      onUploadProgress(uploadProgress);
    }
  }, [uploadProgress, onUploadProgress]);

  // Render upload statistics
  const renderUploadStats = () => {
    const stats = [
      {
        label: 'Total Files',
        value: uploads.length,
        color: 'primary',
      },
      {
        label: 'Completed',
        value: uploads.filter(u => u.uploadStatus === 'completed').length,
        color: 'success',
      },
      {
        label: 'Processing',
        value: uploads.filter(u => u.uploadStatus === 'processing').length,
        color: 'info',
      },
      {
        label: 'Failed',
        value: uploads.filter(u => u.uploadStatus === 'failed').length,
        color: 'error',
      },
    ];

    return (
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
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

  // Render drag and drop zone
  const renderDropZone = () => (
    <Paper
      {...getRootProps()}
      sx={{
        p: 4,
        border: '2px dashed',
        borderColor: isDragActive ? 'primary.main' : isDragReject ? 'error.main' : 'grey.300',
        bgcolor: isDragActive ? 'primary.50' : isDragReject ? 'error.50' : 'grey.50',
        cursor: enableDragDrop && !uploading ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          borderColor: enableDragDrop && !uploading ? 'primary.main' : 'grey.300',
          bgcolor: enableDragDrop && !uploading ? 'primary.50' : 'grey.50',
        },
      }}
    >
      <input {...getInputProps()} />
      <Box textAlign="center">
        <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          {isDragActive ? 'Drop files here...' : 'Drag & drop files here'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          or click to select files
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Supported formats: {supportedFormats.join(', ').toUpperCase()}
        </Typography>
        <br />
        <Typography variant="caption" color="text.secondary">
          Max file size: {formatFileSize(maxFileSize)} | Max files: {maxFiles}
        </Typography>
      </Box>
    </Paper>
  );

  // Render selected files
  const renderSelectedFiles = () => {
    if (selectedFiles.length === 0) return null;

    return (
      <Paper sx={{ p: 2, mt: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Selected Files ({selectedFiles.length})
          </Typography>
          <Box>
            <Button
              variant="outlined"
              size="small"
              onClick={handleClearAll}
              startIcon={<ClearIcon />}
              sx={{ mr: 1 }}
            >
              Clear All
            </Button>
            <Button
              variant="contained"
              onClick={handleUpload}
              disabled={uploading || selectedFiles.length === 0}
              startIcon={<UploadIcon />}
            >
              Upload Files
            </Button>
          </Box>
        </Box>

        {uploading && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              Uploading... {uploadProgress}%
            </Typography>
            <LinearProgress variant="determinate" value={uploadProgress} />
          </Box>
        )}

        <List>
          {selectedFiles.map((file, index) => (
            <ListItem key={index} divider>
              <ListItemIcon>
                {getFileIcon(file.type)}
              </ListItemIcon>
              <ListItemText
                primary={file.name}
                secondary={`${formatFileSize(file.size)} • ${file.type}`}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => handleRemoveFile(index)}
                  disabled={uploading}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>
    );
  };

  // Render validation errors
  const renderValidationErrors = () => {
    if (validationErrors.length === 0 && !uploadError) return null;

    return (
      <Alert severity="error" sx={{ mt: 2 }} onClose={() => setValidationErrors([])}>
        <AlertTitle>Validation Errors</AlertTitle>
        {validationErrors.map((error, index) => (
          <Typography key={index} variant="body2">
            • {error}
          </Typography>
        ))}
        {uploadError && (
          <Typography variant="body2">
            • Upload Error: {uploadError}
          </Typography>
        )}
      </Alert>
    );
  };

  // Render staging area
  const renderStagingArea = () => (
    <Paper sx={{ mt: 3 }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Staging Area ({filteredUploads.length} files)
          </Typography>
          <Box display="flex" gap={1}>
            <TextField
              size="small"
              placeholder="Search files..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              sx={{ width: 200 }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="uploaded">Uploaded</MenuItem>
                <MenuItem value="processing">Processing</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              size="small"
              onClick={clearUploads}
              startIcon={<ClearIcon />}
            >
              Clear All
            </Button>
          </Box>
        </Box>
      </Box>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>File</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Validation</TableCell>
              <TableCell>Uploaded</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedUploads.map((upload) => (
              <TableRow key={upload.uploadId}>
                <TableCell>
                  <Box display="flex" alignItems="center">
                    {getFileIcon(upload.mimeType)}
                    <Box ml={1}>
                      <Typography variant="body2" fontWeight="medium">
                        {upload.filename}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {upload.originalName}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatFileSize(upload.fileSize)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={upload.uploadStatus}
                    color={getStatusColor(upload.uploadStatus) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={upload.validationStatus}
                    color={getStatusColor(upload.validationStatus) as any}
                    size="small"
                  />
                  {upload.validationErrors && upload.validationErrors.length > 0 && (
                    <Tooltip title={upload.validationErrors.join(', ')}>
                      <WarningIcon color="warning" sx={{ ml: 1, fontSize: 16 }} />
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {format(upload.uploadedAt, 'MMM dd, HH:mm')}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={0.5}>
                    {enablePreview && (
                      <Tooltip title="Preview">
                        <IconButton size="small" onClick={() => handlePreview(upload)}>
                          <PreviewIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {upload.uploadStatus === 'failed' && (
                      <Tooltip title="Retry">
                        <IconButton size="small" onClick={() => retryUpload(upload.uploadId)}>
                          <RefreshIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => deleteUpload(upload.uploadId)}>
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
        count={filteredUploads.length}
        page={page}
        onPageChange={handlePageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleRowsPerPageChange}
        rowsPerPageOptions={[5, 10, 25, 50]}
      />
    </Paper>
  );

  // Render file preview dialog
  const renderPreviewDialog = () => (
    <Dialog
      open={previewDialogOpen}
      onClose={() => setPreviewDialogOpen(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>File Preview</DialogTitle>
      <DialogContent>
        {previewFile && (
          <Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2">File Information</Typography>
                <List dense>
                  <ListItem>
                    <ListItemText primary="Filename" secondary={previewFile.filename} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Original Name" secondary={previewFile.originalName} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Size" secondary={formatFileSize(previewFile.fileSize)} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Type" secondary={previewFile.mimeType} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Upload Status" secondary={
                      <Chip
                        label={previewFile.uploadStatus}
                        color={getStatusColor(previewFile.uploadStatus) as any}
                        size="small"
                      />
                    } />
                  </ListItem>
                </List>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2">Metadata</Typography>
                {previewFile.metadata && (
                  <List dense>
                    {previewFile.metadata.title && (
                      <ListItem>
                        <ListItemText primary="Title" secondary={previewFile.metadata.title} />
                      </ListItem>
                    )}
                    {previewFile.metadata.author && (
                      <ListItem>
                        <ListItemText primary="Author" secondary={previewFile.metadata.author} />
                      </ListItem>
                    )}
                    {previewFile.metadata.totalPages && (
                      <ListItem>
                        <ListItemText primary="Pages" secondary={previewFile.metadata.totalPages} />
                      </ListItem>
                    )}
                    {previewFile.metadata.wordCount && (
                      <ListItem>
                        <ListItemText primary="Words" secondary={previewFile.metadata.wordCount.toLocaleString()} />
                      </ListItem>
                    )}
                  </List>
                )}
              </Grid>
            </Grid>
            
            {previewFile.validationErrors && previewFile.validationErrors.length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <AlertTitle>Validation Errors</AlertTitle>
                {previewFile.validationErrors.map((error, index) => (
                  <Typography key={index} variant="body2">• {error}</Typography>
                ))}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPreviewDialogOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  // Handle file processing
  const handleProcessFiles = (fileIds: string[]) => {
    console.log('Processing files:', fileIds);
    // In real implementation, this would trigger the ingestion pipeline
  };

  // Handle file download
  const handleDownloadFile = (file: FileUpload) => {
    console.log('Downloading file:', file.filename);
    // In real implementation, this would download the file
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Document Upload & Staging
      </Typography>
      
      {renderUploadStats()}
      {renderDropZone()}
      {renderSelectedFiles()}
      {renderValidationErrors()}
      
      {/* Upload Progress Component */}
      {(uploading || uploads.length > 0) && (
        <UploadProgress
          uploads={uploads}
          totalProgress={uploadProgress}
          uploading={uploading}
          onCancel={cancelUpload}
          showDetails={true}
        />
      )}

      {/* Advanced Search and Filtering */}
      {uploads.length > 0 && (
        <AdvancedFileSearch
          files={uploads}
          onFiltersChange={handleSearchFiltersChange}
          enableSavedFilters={true}
          enableAdvancedSearch={true}
        />
      )}

      {/* Enhanced Staging Manager */}
      <Paper sx={{ mt: 3 }}>
        <StagingManager
          files={displayUploads}
          onDelete={(fileIds) => {
            fileIds.forEach(id => deleteUpload(id));
          }}
          onProcess={handleProcessFiles}
          onPreview={handlePreview}
          onDownload={handleDownloadFile}
          enableBulkOperations={true}
          enableProcessing={true}
        />
      </Paper>

      {renderPreviewDialog()}

      {/* Enhanced Metadata Dialog */}
      <Dialog
        open={metadataDialogOpen}
        onClose={() => setMetadataDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent sx={{ p: 0 }}>
          {previewFile && (
            <FileMetadataViewer
              file={previewFile}
              onClose={() => setMetadataDialogOpen(false)}
              onDownload={handleDownloadFile}
              showActions={true}
              compact={false}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default DocumentUpload;
