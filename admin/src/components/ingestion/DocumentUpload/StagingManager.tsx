/**
 * Staging Manager Component
 * Advanced staging folder management with bulk operations
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Checkbox,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Toolbar,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  Visibility as PreviewIcon,
  GetApp as DownloadIcon,
  PlayArrow as ProcessIcon,
  SelectAll as SelectAllIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  PictureAsPdf as PdfIcon,
  Description as DocIcon,
  TextSnippet as TextIcon,
  Code as CodeIcon,
  CheckCircle as ValidIcon,
  Error as InvalidIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { FileUpload, ValidationStatus, FileStatus } from '../../../types/ingestion';

interface StagingManagerProps {
  files: FileUpload[];
  onDelete: (fileIds: string[]) => void;
  onProcess: (fileIds: string[]) => void;
  onPreview: (file: FileUpload) => void;
  onDownload?: (file: FileUpload) => void;
  enableBulkOperations?: boolean;
  enableProcessing?: boolean;
}

type SortField = 'filename' | 'fileSize' | 'uploadedAt' | 'uploadStatus' | 'validationStatus';
type SortDirection = 'asc' | 'desc';

const StagingManager: React.FC<StagingManagerProps> = ({
  files,
  onDelete,
  onProcess,
  onPreview,
  onDownload,
  enableBulkOperations = true,
  enableProcessing = true,
}) => {
  // State management
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortField, setSortField] = useState<SortField>('uploadedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [validationFilter, setValidationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedFile, setSelectedFile] = useState<FileUpload | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);

  // Get file icon based on mime type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <PdfIcon />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <DocIcon />;
    if (mimeType.includes('text')) return <TextIcon />;
    if (mimeType.includes('markdown')) return <CodeIcon />;
    return <FileIcon />;
  };

  // Get validation icon
  const getValidationIcon = (status: ValidationStatus) => {
    switch (status) {
      case 'valid': return <ValidIcon color="success" />;
      case 'invalid': return <InvalidIcon color="error" />;
      case 'warning': return <WarningIcon color="warning" />;
      default: return <WarningIcon color="disabled" />;
    }
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

  // Filter and sort files
  const filteredAndSortedFiles = useMemo(() => {
    let filtered = files.filter(file => {
      const matchesStatus = statusFilter === 'all' || file.uploadStatus === statusFilter;
      const matchesValidation = validationFilter === 'all' || file.validationStatus === validationFilter;
      const matchesSearch = searchQuery === '' || 
        file.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.originalName.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesStatus && matchesValidation && matchesSearch;
    });

    // Sort files
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'filename':
          aValue = a.filename.toLowerCase();
          bValue = b.filename.toLowerCase();
          break;
        case 'fileSize':
          aValue = a.fileSize;
          bValue = b.fileSize;
          break;
        case 'uploadedAt':
          aValue = a.uploadedAt.getTime();
          bValue = b.uploadedAt.getTime();
          break;
        case 'uploadStatus':
          aValue = a.uploadStatus;
          bValue = b.uploadStatus;
          break;
        case 'validationStatus':
          aValue = a.validationStatus;
          bValue = b.validationStatus;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [files, statusFilter, validationFilter, searchQuery, sortField, sortDirection]);

  // Paginated files
  const paginatedFiles = filteredAndSortedFiles.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Handle selection
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelected(paginatedFiles.map(file => file.uploadId));
    } else {
      setSelected([]);
    }
  };

  const handleSelect = (fileId: string) => {
    setSelected(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle menu actions
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, file: FileUpload) => {
    setAnchorEl(event.currentTarget);
    setSelectedFile(file);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedFile(null);
  };

  // Handle bulk operations
  const handleBulkDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleBulkProcess = () => {
    setProcessDialogOpen(true);
  };

  const confirmDelete = () => {
    onDelete(selected);
    setSelected([]);
    setDeleteDialogOpen(false);
  };

  const confirmProcess = () => {
    onProcess(selected);
    setSelected([]);
    setProcessDialogOpen(false);
  };

  // Handle pagination
  const handlePageChange = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const total = filteredAndSortedFiles.length;
    const completed = filteredAndSortedFiles.filter(f => f.uploadStatus === 'completed').length;
    const failed = filteredAndSortedFiles.filter(f => f.uploadStatus === 'failed').length;
    const processing = filteredAndSortedFiles.filter(f => f.uploadStatus === 'processing').length;
    const valid = filteredAndSortedFiles.filter(f => f.validationStatus === 'valid').length;
    const invalid = filteredAndSortedFiles.filter(f => f.validationStatus === 'invalid').length;
    const totalSize = filteredAndSortedFiles.reduce((sum, f) => sum + f.fileSize, 0);

    return { total, completed, failed, processing, valid, invalid, totalSize };
  }, [filteredAndSortedFiles]);

  return (
    <Box>
      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="h6" color="primary">
                {stats.total}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Files
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="h6" color="success.main">
                {stats.completed}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="h6" color="error.main">
                {stats.failed}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Failed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="h6" color="success.main">
                {stats.valid}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Valid
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="h6" color="error.main">
                {stats.invalid}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Invalid
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 1 }}>
              <Typography variant="h6" color="info.main">
                {formatFileSize(stats.totalSize)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Size
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Toolbar */}
      <Paper sx={{ mb: 2 }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Staging Area ({stats.total} files)
          </Typography>
          
          <Box display="flex" gap={1} alignItems="center">
            {/* Search */}
            <TextField
              size="small"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ width: 200 }}
            />

            {/* Status Filter */}
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

            {/* Validation Filter */}
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Validation</InputLabel>
              <Select
                value={validationFilter}
                onChange={(e) => setValidationFilter(e.target.value)}
                label="Validation"
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="valid">Valid</MenuItem>
                <MenuItem value="invalid">Invalid</MenuItem>
                <MenuItem value="warning">Warning</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Toolbar>

        {/* Bulk Actions */}
        {enableBulkOperations && selected.length > 0 && (
          <Toolbar variant="dense" sx={{ bgcolor: 'action.selected' }}>
            <Typography variant="subtitle1" sx={{ flex: 1 }}>
              {selected.length} files selected
            </Typography>
            <Box display="flex" gap={1}>
              {enableProcessing && (
                <Button
                  size="small"
                  startIcon={<ProcessIcon />}
                  onClick={handleBulkProcess}
                >
                  Process
                </Button>
              )}
              <Button
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleBulkDelete}
              >
                Delete
              </Button>
              <Button
                size="small"
                startIcon={<ClearIcon />}
                onClick={() => setSelected([])}
              >
                Clear Selection
              </Button>
            </Box>
          </Toolbar>
        )}
      </Paper>

      {/* Files Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {enableBulkOperations && (
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selected.length > 0 && selected.length < paginatedFiles.length}
                    checked={paginatedFiles.length > 0 && selected.length === paginatedFiles.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
              )}
              <TableCell>
                <Button
                  size="small"
                  onClick={() => handleSort('filename')}
                  endIcon={sortField === 'filename' ? <SortIcon /> : null}
                >
                  File
                </Button>
              </TableCell>
              <TableCell>
                <Button
                  size="small"
                  onClick={() => handleSort('fileSize')}
                  endIcon={sortField === 'fileSize' ? <SortIcon /> : null}
                >
                  Size
                </Button>
              </TableCell>
              <TableCell>
                <Button
                  size="small"
                  onClick={() => handleSort('uploadStatus')}
                  endIcon={sortField === 'uploadStatus' ? <SortIcon /> : null}
                >
                  Status
                </Button>
              </TableCell>
              <TableCell>
                <Button
                  size="small"
                  onClick={() => handleSort('validationStatus')}
                  endIcon={sortField === 'validationStatus' ? <SortIcon /> : null}
                >
                  Validation
                </Button>
              </TableCell>
              <TableCell>
                <Button
                  size="small"
                  onClick={() => handleSort('uploadedAt')}
                  endIcon={sortField === 'uploadedAt' ? <SortIcon /> : null}
                >
                  Uploaded
                </Button>
              </TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedFiles.map((file) => (
              <TableRow key={file.uploadId} selected={selected.includes(file.uploadId)}>
                {enableBulkOperations && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selected.includes(file.uploadId)}
                      onChange={() => handleSelect(file.uploadId)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <Box display="flex" alignItems="center">
                    {getFileIcon(file.mimeType)}
                    <Box ml={1}>
                      <Typography variant="body2" fontWeight="medium">
                        {file.filename}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {file.originalName}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatFileSize(file.fileSize)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={file.uploadStatus}
                    color={getStatusColor(file.uploadStatus) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={0.5}>
                    {getValidationIcon(file.validationStatus)}
                    <Chip
                      label={file.validationStatus}
                      color={getStatusColor(file.validationStatus) as any}
                      size="small"
                    />
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {format(file.uploadedAt, 'MMM dd, HH:mm')}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={0.5}>
                    <Tooltip title="Preview">
                      <IconButton size="small" onClick={() => onPreview(file)}>
                        <PreviewIcon />
                      </IconButton>
                    </Tooltip>
                    {onDownload && (
                      <Tooltip title="Download">
                        <IconButton size="small" onClick={() => onDownload(file)}>
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, file)}
                    >
                      <MoreIcon />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={filteredAndSortedFiles.length}
        page={page}
        onPageChange={handlePageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleRowsPerPageChange}
        rowsPerPageOptions={[5, 10, 25, 50]}
      />

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { selectedFile && onPreview(selectedFile); handleMenuClose(); }}>
          <PreviewIcon sx={{ mr: 1 }} />
          Preview
        </MenuItem>
        {enableProcessing && (
          <MenuItem onClick={() => { selectedFile && onProcess([selectedFile.uploadId]); handleMenuClose(); }}>
            <ProcessIcon sx={{ mr: 1 }} />
            Process
          </MenuItem>
        )}
        {onDownload && (
          <MenuItem onClick={() => { selectedFile && onDownload(selectedFile); handleMenuClose(); }}>
            <DownloadIcon sx={{ mr: 1 }} />
            Download
          </MenuItem>
        )}
        <MenuItem onClick={() => { selectedFile && onDelete([selectedFile.uploadId]); handleMenuClose(); }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selected.length} selected file(s)? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Process Confirmation Dialog */}
      <Dialog open={processDialogOpen} onClose={() => setProcessDialogOpen(false)}>
        <DialogTitle>Confirm Processing</DialogTitle>
        <DialogContent>
          <Typography>
            Start processing {selected.length} selected file(s) for ingestion?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProcessDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmProcess} color="primary">Process</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StagingManager;
