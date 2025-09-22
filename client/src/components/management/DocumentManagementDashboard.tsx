/**
 * Document Management Dashboard
 * Comprehensive document management interface showing all files in knowledge base
 * with processing status, database comparison, and management actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import RAGDataAnalytics from '../analytics/RAGDataAnalytics';
import DocumentIngestionManager from '../ingestion/DocumentIngestionManager';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  LinearProgress,
  Alert,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Badge,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Description as DocumentIcon,
  Delete as DeleteIcon,
  PlayArrow as ProcessIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
  Folder as FolderIcon,
  CloudUpload as UploadIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';

interface DocumentStatus {
  filename: string;
  filePath: string;
  relativePath: string;
  fileSize: number;
  fileHash: string;
  lastModified: string | null;
  documentType: string;
  status: 'processed' | 'unprocessed' | 'modified' | 'missing_file' | 'orphaned';
  sourceId: string | null;
  processingStatus: string | null;
  totalChunks: number;
  avgQualityScore: number | null;
  lastProcessed: string | null;
  processingMethod: string | null;
  version?: string;
  title?: string;
  lastJobStatus?: string;
  lastProcessingCompleted?: string;
}

interface ProcessingStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  runningJobs: number;
  pendingJobs: number;
  avgChunksPerDoc: number;
  avgProcessingTimeSeconds: number;
}

interface DocumentSummary {
  totalFilesInFileSystem: number;
  totalDocumentsInDatabase: number;
  processedDocuments: number;
  unprocessedDocuments: number;
  modifiedDocuments: number;
  missingFiles: number;
  orphanedRecords: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`document-tabpanel-${index}`}
      aria-labelledby={`document-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const DocumentManagementDashboard: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentStatus[]>([]);
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedDocument, setSelectedDocument] = useState<DocumentStatus | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reprocessOpen, setReprocessOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch document status data
  const fetchDocumentStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/document-management/documents/status');
      const result = await response.json();
      
      if (result.success) {
        setDocuments(result.data.documents);
        setSummary(result.data.summary);
        setProcessingStats(result.data.processingStats);
      } else {
        setError(result.error || 'Failed to fetch document status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocumentStatus();
  }, [fetchDocumentStatus]);

  // Filter documents based on status and search term
  const filteredDocuments = documents.filter(doc => {
    const matchesStatus = filterStatus === 'all' || doc.status === filterStatus;
    const matchesSearch = searchTerm === '' || 
      doc.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.title && doc.title.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  // Paginated documents
  const paginatedDocuments = filteredDocuments.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <SuccessIcon color="success" />;
      case 'modified':
        return <WarningIcon color="warning" />;
      case 'unprocessed':
        return <PendingIcon color="info" />;
      case 'missing_file':
        return <ErrorIcon color="error" />;
      case 'orphaned':
        return <ErrorIcon color="error" />;
      default:
        return <InfoIcon color="disabled" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed':
        return 'success';
      case 'modified':
        return 'warning';
      case 'unprocessed':
        return 'info';
      case 'missing_file':
      case 'orphaned':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'processed':
        return 'Processed';
      case 'modified':
        return 'Modified';
      case 'unprocessed':
        return 'Unprocessed';
      case 'missing_file':
        return 'Missing File';
      case 'orphaned':
        return 'Orphaned Record';
      default:
        return status;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const handleViewDetails = async (document: DocumentStatus) => {
    setSelectedDocument(document);
    setDetailsOpen(true);
  };

  const handleReprocess = (document: DocumentStatus) => {
    setSelectedDocument(document);
    setReprocessOpen(true);
  };

  const handleDelete = (document: DocumentStatus) => {
    setSelectedDocument(document);
    setDeleteOpen(true);
  };

  const confirmReprocess = async () => {
    if (!selectedDocument?.sourceId) return;
    
    try {
      const response = await fetch(`/api/document-management/documents/${selectedDocument.sourceId}/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'advanced' })
      });
      
      const result = await response.json();
      
      if (result.success) {
        await fetchDocumentStatus();
        setReprocessOpen(false);
      } else {
        setError(result.error || 'Failed to trigger reprocessing');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };

  const handleCleanupOrphaned = async () => {
    try {
      setError(null);
      const response = await fetch('/api/document-management/documents/cleanup-orphaned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Cleaned up ${result.data.deletedRecords.length} orphaned records`);
        await fetchDocumentStatus();
      } else {
        setError(result.error || 'Failed to cleanup orphaned records');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };

  const confirmDelete = async () => {
    if (!selectedDocument?.sourceId) return;
    
    try {
      const response = await fetch(`/api/document-management/documents/${selectedDocument.sourceId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteFile: false })
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Deleted document: ${result.data.filename}`);
        console.log(`📊 Deleted records:`, result.data.deletedRecords);
        await fetchDocumentStatus();
        setDeleteOpen(false);
      } else {
        setError(result.error || 'Failed to delete document');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading document status...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="document management tabs">
          <Tab label="📄 Document Overview" />
          <Tab label="📊 Analytics" />
          <Tab label="🔗 RAG Data" />
          <Tab label="⚙️ Management" />
        </Tabs>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TabPanel value={tabValue} index={0}>
        {/* Summary Cards */}
        {summary && (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <FolderIcon color="primary" sx={{ mr: 1 }} />
                    <Box>
                      <Typography variant="h4">{summary.totalFilesInFileSystem}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Files in Knowledge Base
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <SuccessIcon color="success" sx={{ mr: 1 }} />
                    <Box>
                      <Typography variant="h4">{summary.processedDocuments}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Processed Documents
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <WarningIcon color="warning" sx={{ mr: 1 }} />
                    <Box>
                      <Typography variant="h4">
                        {summary.unprocessedDocuments + summary.modifiedDocuments}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Need Processing
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center">
                    <ErrorIcon color="error" sx={{ mr: 1 }} />
                    <Box>
                      <Typography variant="h4">{summary.missingFiles}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Missing Files
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Filters and Search */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Search documents"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Filter by Status</InputLabel>
                  <Select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    label="Filter by Status"
                  >
                    <MenuItem value="all">All Documents</MenuItem>
                    <MenuItem value="processed">Processed</MenuItem>
                    <MenuItem value="unprocessed">Unprocessed</MenuItem>
                    <MenuItem value="modified">Modified</MenuItem>
                    <MenuItem value="missing_file">Missing Files</MenuItem>
                    <MenuItem value="orphaned">Orphaned Records</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={5}>
                <Box display="flex" gap={1} justifyContent="flex-end">
                  <Button
                    startIcon={<RefreshIcon />}
                    onClick={fetchDocumentStatus}
                    variant="outlined"
                  >
                    Refresh
                  </Button>
                  {summary && summary.missingFiles > 0 && (
                    <Button
                      startIcon={<DeleteIcon />}
                      onClick={handleCleanupOrphaned}
                      variant="outlined"
                      color="warning"
                    >
                      Cleanup ({summary.missingFiles})
                    </Button>
                  )}
                  <Button
                    startIcon={<UploadIcon />}
                    variant="contained"
                    onClick={() => setTabValue(2)}
                  >
                    Upload Documents
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Documents Table */}
        <Card>
          <CardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Document</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Chunks</TableCell>
                    <TableCell>Quality</TableCell>
                    <TableCell>Last Modified</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedDocuments.map((doc, index) => (
                    <TableRow key={`${doc.filePath}-${index}`} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center">
                          <DocumentIcon sx={{ mr: 1, color: 'text.secondary' }} />
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {doc.filename}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {doc.title || doc.relativePath}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getStatusIcon(doc.status)}
                          <Chip
                            label={getStatusLabel(doc.status)}
                            color={getStatusColor(doc.status) as any}
                            size="small"
                          />
                        </Box>
                      </TableCell>
                      <TableCell>{formatFileSize(doc.fileSize)}</TableCell>
                      <TableCell>
                        <Badge badgeContent={doc.totalChunks} color="primary">
                          <DocumentIcon />
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {doc.avgQualityScore ? (
                          <Box display="flex" alignItems="center">
                            <LinearProgress
                              variant="determinate"
                              value={doc.avgQualityScore * 100}
                              sx={{ width: 60, mr: 1 }}
                            />
                            <Typography variant="caption">
                              {(doc.avgQualityScore * 100).toFixed(0)}%
                            </Typography>
                          </Box>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {formatDate(doc.lastModified)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={0.5}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => handleViewDetails(doc)}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          {doc.sourceId && (
                            <>
                              <Tooltip title="Reprocess">
                                <IconButton
                                  size="small"
                                  onClick={() => handleReprocess(doc)}
                                >
                                  <ProcessIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDelete(doc)}
                                  color="error"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={filteredDocuments.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {/* Analytics Content */}
        {processingStats && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Processing Statistics
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography>Total Jobs:</Typography>
                      <Typography fontWeight="bold">{processingStats.totalJobs}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography>Completed:</Typography>
                      <Typography fontWeight="bold" color="success.main">
                        {processingStats.completedJobs}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography>Failed:</Typography>
                      <Typography fontWeight="bold" color="error.main">
                        {processingStats.failedJobs}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography>Running:</Typography>
                      <Typography fontWeight="bold" color="warning.main">
                        {processingStats.runningJobs}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Performance Metrics
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Box display="flex" justifyContent="space-between">
                      <Typography>Avg Chunks per Document:</Typography>
                      <Typography fontWeight="bold">
                        {processingStats.avgChunksPerDoc.toFixed(1)}
                      </Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between">
                      <Typography>Avg Processing Time:</Typography>
                      <Typography fontWeight="bold">
                        {(processingStats.avgProcessingTimeSeconds / 60).toFixed(1)} min
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {/* RAG Data Analytics */}
        <RAGDataAnalytics />
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        {/* Management Content - Include the existing DocumentIngestionManager */}
        <DocumentIngestionManager />
      </TabPanel>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Document Details</DialogTitle>
        <DialogContent>
          {selectedDocument && (
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Filename:</Typography>
                  <Typography variant="body2">{selectedDocument.filename}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Status:</Typography>
                  <Chip
                    label={getStatusLabel(selectedDocument.status)}
                    color={getStatusColor(selectedDocument.status) as any}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">File Size:</Typography>
                  <Typography variant="body2">{formatFileSize(selectedDocument.fileSize)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Document Type:</Typography>
                  <Typography variant="body2">{selectedDocument.documentType.toUpperCase()}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">File Path:</Typography>
                  <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                    {selectedDocument.filePath}
                  </Typography>
                </Grid>
                {selectedDocument.totalChunks > 0 && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2">Total Chunks:</Typography>
                      <Typography variant="body2">{selectedDocument.totalChunks}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="subtitle2">Average Quality:</Typography>
                      <Typography variant="body2">
                        {selectedDocument.avgQualityScore 
                          ? `${(selectedDocument.avgQualityScore * 100).toFixed(1)}%`
                          : 'N/A'
                        }
                      </Typography>
                    </Grid>
                  </>
                )}
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Last Modified:</Typography>
                  <Typography variant="body2">{formatDate(selectedDocument.lastModified)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Last Processed:</Typography>
                  <Typography variant="body2">{formatDate(selectedDocument.lastProcessed)}</Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Reprocess Dialog */}
      <Dialog open={reprocessOpen} onClose={() => setReprocessOpen(false)}>
        <DialogTitle>Reprocess Document</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to reprocess "{selectedDocument?.filename}"?
            This will regenerate all chunks and embeddings.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReprocessOpen(false)}>Cancel</Button>
          <Button onClick={confirmReprocess} variant="contained" color="primary">
            Reprocess
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Document from Database</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to delete "{selectedDocument?.filename}" from the database?
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            This will remove:
          </Typography>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>Document source record</li>
            <li>All associated text chunks ({selectedDocument?.totalChunks || 0} chunks)</li>
            <li>Processing job history</li>
            <li>Quality validation reports</li>
          </ul>
          <Typography variant="body2" color="text.secondary">
            <strong>Note:</strong> The physical file will remain in the filesystem and can be reprocessed later.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} variant="contained" color="error">
            Delete from Database
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentManagementDashboard;
