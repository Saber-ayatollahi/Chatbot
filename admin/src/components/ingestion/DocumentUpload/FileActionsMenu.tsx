/**
 * File Actions Menu Component
 * Phase 2, Day 7 Afternoon: Comprehensive file context operations
 * Advanced file actions with permissions, history, and batch operations
 */

import React, { useState } from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Chip,
  Box,
  Typography,
  Alert,
  AlertTitle,
  List,
  ListItem,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  Visibility as PreviewIcon,
  GetApp as DownloadIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileCopy as CopyIcon,
  DriveFileMove as MoveIcon,
  Share as ShareIcon,
  Info as InfoIcon,
  History as HistoryIcon,
  Security as SecurityIcon,
  Label as TagIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Transform as TransformIcon,
  Compress as CompressIcon,
  CloudUpload as UploadIcon,
  PlayArrow as ProcessIcon,
  Refresh as RetryIcon,
  Block as QuarantineIcon,
  CheckCircle as ValidateIcon,
  Bookmark as BookmarkIcon,
  Star as FavoriteIcon,
  Link as LinkIcon,
  QrCode as QrCodeIcon,
  Print as PrintIcon,
  Email as EmailIcon,
  ExpandMore as ExpandIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { FileUpload } from '../../../types/ingestion';

interface FileAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  category: 'view' | 'edit' | 'process' | 'share' | 'manage' | 'security';
  requiresPermission?: string;
  destructive?: boolean;
  disabled?: boolean;
  badge?: string;
}

interface FileActionsMenuProps {
  file: FileUpload;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onAction: (actionId: string, file: FileUpload, options?: any) => void;
  enabledActions?: string[];
  userPermissions?: string[];
}

interface ActionDialogState {
  open: boolean;
  actionId: string;
  title: string;
  content: React.ReactNode;
  actions: React.ReactNode;
}

const FileActionsMenu: React.FC<FileActionsMenuProps> = ({
  file,
  anchorEl,
  open,
  onClose,
  onAction,
  enabledActions = [],
  userPermissions = ['read', 'write', 'delete', 'share', 'admin'],
}) => {
  const [actionDialog, setActionDialog] = useState<ActionDialogState>({
    open: false,
    actionId: '',
    title: '',
    content: null,
    actions: null,
  });

  const [shareOptions, setShareOptions] = useState({
    shareType: 'link',
    expiresIn: '7d',
    allowDownload: true,
    requireAuth: false,
    password: '',
  });

  const [moveOptions, setMoveOptions] = useState({
    destination: '',
    createFolder: false,
    folderName: '',
  });

  const [tagOptions, setTagOptions] = useState({
    tags: [] as string[],
    newTag: '',
  });

  // Available file actions
  const fileActions: FileAction[] = [
    // View actions
    {
      id: 'preview',
      label: 'Preview',
      icon: <PreviewIcon />,
      description: 'View file content',
      category: 'view',
    },
    {
      id: 'metadata',
      label: 'View Metadata',
      icon: <InfoIcon />,
      description: 'Show detailed file information',
      category: 'view',
    },
    {
      id: 'history',
      label: 'View History',
      icon: <HistoryIcon />,
      description: 'Show file processing history',
      category: 'view',
    },

    // Edit actions
    {
      id: 'rename',
      label: 'Rename',
      icon: <EditIcon />,
      description: 'Change file name',
      category: 'edit',
      requiresPermission: 'write',
    },
    {
      id: 'edit_metadata',
      label: 'Edit Metadata',
      icon: <EditIcon />,
      description: 'Modify file metadata',
      category: 'edit',
      requiresPermission: 'write',
    },
    {
      id: 'add_tags',
      label: 'Add Tags',
      icon: <TagIcon />,
      description: 'Add or modify tags',
      category: 'edit',
      requiresPermission: 'write',
    },

    // Process actions
    {
      id: 'process',
      label: 'Process for Ingestion',
      icon: <ProcessIcon />,
      description: 'Start ingestion processing',
      category: 'process',
      requiresPermission: 'write',
      disabled: file.uploadStatus !== 'completed' || file.validationStatus !== 'valid',
    },
    {
      id: 'reprocess',
      label: 'Reprocess',
      icon: <RetryIcon />,
      description: 'Rerun processing pipeline',
      category: 'process',
      requiresPermission: 'write',
    },
    {
      id: 'validate',
      label: 'Validate',
      icon: <ValidateIcon />,
      description: 'Run validation checks',
      category: 'process',
    },
    {
      id: 'transform',
      label: 'Transform',
      icon: <TransformIcon />,
      description: 'Convert file format',
      category: 'process',
      requiresPermission: 'write',
    },

    // Share actions
    {
      id: 'download',
      label: 'Download',
      icon: <DownloadIcon />,
      description: 'Download file',
      category: 'share',
    },
    {
      id: 'share',
      label: 'Share',
      icon: <ShareIcon />,
      description: 'Create shareable link',
      category: 'share',
      requiresPermission: 'share',
    },
    {
      id: 'email',
      label: 'Send via Email',
      icon: <EmailIcon />,
      description: 'Email file as attachment',
      category: 'share',
      requiresPermission: 'share',
    },
    {
      id: 'qr_code',
      label: 'Generate QR Code',
      icon: <QrCodeIcon />,
      description: 'Create QR code for file access',
      category: 'share',
    },

    // Manage actions
    {
      id: 'copy',
      label: 'Duplicate',
      icon: <CopyIcon />,
      description: 'Create a copy',
      category: 'manage',
      requiresPermission: 'write',
    },
    {
      id: 'move',
      label: 'Move',
      icon: <MoveIcon />,
      description: 'Move to different location',
      category: 'manage',
      requiresPermission: 'write',
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: <ArchiveIcon />,
      description: 'Move to archive',
      category: 'manage',
      requiresPermission: 'write',
    },
    {
      id: 'favorite',
      label: 'Add to Favorites',
      icon: <FavoriteIcon />,
      description: 'Mark as favorite',
      category: 'manage',
    },
    {
      id: 'compress',
      label: 'Compress',
      icon: <CompressIcon />,
      description: 'Create compressed version',
      category: 'manage',
    },

    // Security actions
    {
      id: 'quarantine',
      label: 'Quarantine',
      icon: <QuarantineIcon />,
      description: 'Move to quarantine',
      category: 'security',
      requiresPermission: 'admin',
      destructive: true,
    },
    {
      id: 'security_scan',
      label: 'Security Scan',
      icon: <SecurityIcon />,
      description: 'Run security analysis',
      category: 'security',
      requiresPermission: 'admin',
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <DeleteIcon />,
      description: 'Permanently delete file',
      category: 'security',
      requiresPermission: 'delete',
      destructive: true,
    },
  ];

  // Filter actions based on permissions and enabled actions
  const availableActions = fileActions.filter(action => {
    // Check if action is enabled
    if (enabledActions.length > 0 && !enabledActions.includes(action.id)) {
      return false;
    }

    // Check permissions
    if (action.requiresPermission && !userPermissions.includes(action.requiresPermission)) {
      return false;
    }

    return true;
  });

  // Group actions by category
  const actionsByCategory = availableActions.reduce((acc, action) => {
    if (!acc[action.category]) {
      acc[action.category] = [];
    }
    acc[action.category].push(action);
    return acc;
  }, {} as Record<string, FileAction[]>);

  // Handle action click
  const handleActionClick = (action: FileAction) => {
    onClose();

    // Actions that require dialogs
    switch (action.id) {
      case 'share':
        openShareDialog();
        break;
      case 'move':
        openMoveDialog();
        break;
      case 'add_tags':
        openTagDialog();
        break;
      case 'rename':
        openRenameDialog();
        break;
      case 'delete':
        openDeleteConfirmDialog();
        break;
      case 'quarantine':
        openQuarantineConfirmDialog();
        break;
      default:
        // Direct actions
        onAction(action.id, file);
        break;
    }
  };

  // Dialog openers
  const openShareDialog = () => {
    setActionDialog({
      open: true,
      actionId: 'share',
      title: 'Share File',
      content: renderShareDialog(),
      actions: (
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            onClick={() => {
              onAction('share', file, shareOptions);
              closeDialog();
            }}
            variant="contained"
          >
            Create Share Link
          </Button>
        </>
      ),
    });
  };

  const openMoveDialog = () => {
    setActionDialog({
      open: true,
      actionId: 'move',
      title: 'Move File',
      content: renderMoveDialog(),
      actions: (
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            onClick={() => {
              onAction('move', file, moveOptions);
              closeDialog();
            }}
            variant="contained"
            disabled={!moveOptions.destination && !moveOptions.createFolder}
          >
            Move File
          </Button>
        </>
      ),
    });
  };

  const openTagDialog = () => {
    setActionDialog({
      open: true,
      actionId: 'add_tags',
      title: 'Manage Tags',
      content: renderTagDialog(),
      actions: (
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            onClick={() => {
              onAction('add_tags', file, tagOptions);
              closeDialog();
            }}
            variant="contained"
          >
            Update Tags
          </Button>
        </>
      ),
    });
  };

  const openRenameDialog = () => {
    const [newName, setNewName] = useState(file.originalName);
    
    setActionDialog({
      open: true,
      actionId: 'rename',
      title: 'Rename File',
      content: (
        <TextField
          autoFocus
          fullWidth
          label="New Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          sx={{ mt: 2 }}
        />
      ),
      actions: (
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            onClick={() => {
              onAction('rename', file, { newName });
              closeDialog();
            }}
            variant="contained"
            disabled={!newName.trim() || newName === file.originalName}
          >
            Rename
          </Button>
        </>
      ),
    });
  };

  const openDeleteConfirmDialog = () => {
    setActionDialog({
      open: true,
      actionId: 'delete',
      title: 'Confirm Delete',
      content: (
        <Alert severity="error">
          <AlertTitle>Permanent Deletion</AlertTitle>
          Are you sure you want to permanently delete "{file.originalName}"? 
          This action cannot be undone.
        </Alert>
      ),
      actions: (
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            onClick={() => {
              onAction('delete', file);
              closeDialog();
            }}
            variant="contained"
            color="error"
          >
            Delete Permanently
          </Button>
        </>
      ),
    });
  };

  const openQuarantineConfirmDialog = () => {
    setActionDialog({
      open: true,
      actionId: 'quarantine',
      title: 'Quarantine File',
      content: (
        <Alert severity="warning">
          <AlertTitle>Security Action</AlertTitle>
          This will move the file to quarantine and restrict access. 
          Are you sure you want to proceed?
        </Alert>
      ),
      actions: (
        <>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            onClick={() => {
              onAction('quarantine', file);
              closeDialog();
            }}
            variant="contained"
            color="warning"
          >
            Quarantine
          </Button>
        </>
      ),
    });
  };

  const closeDialog = () => {
    setActionDialog({
      open: false,
      actionId: '',
      title: '',
      content: null,
      actions: null,
    });
  };

  // Dialog content renderers
  const renderShareDialog = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <FormControl fullWidth>
          <InputLabel>Share Type</InputLabel>
          <Select
            value={shareOptions.shareType}
            onChange={(e) => setShareOptions(prev => ({ ...prev, shareType: e.target.value }))}
            label="Share Type"
          >
            <MenuItem value="link">Public Link</MenuItem>
            <MenuItem value="email">Email Invitation</MenuItem>
            <MenuItem value="embed">Embed Code</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControl fullWidth>
          <InputLabel>Expires In</InputLabel>
          <Select
            value={shareOptions.expiresIn}
            onChange={(e) => setShareOptions(prev => ({ ...prev, expiresIn: e.target.value }))}
            label="Expires In"
          >
            <MenuItem value="1h">1 Hour</MenuItem>
            <MenuItem value="1d">1 Day</MenuItem>
            <MenuItem value="7d">7 Days</MenuItem>
            <MenuItem value="30d">30 Days</MenuItem>
            <MenuItem value="never">Never</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12} sm={6}>
        <FormControlLabel
          control={
            <Switch
              checked={shareOptions.allowDownload}
              onChange={(e) => setShareOptions(prev => ({ ...prev, allowDownload: e.target.checked }))}
            />
          }
          label="Allow Download"
        />
      </Grid>

      <Grid item xs={12}>
        <FormControlLabel
          control={
            <Switch
              checked={shareOptions.requireAuth}
              onChange={(e) => setShareOptions(prev => ({ ...prev, requireAuth: e.target.checked }))}
            />
          }
          label="Require Authentication"
        />
      </Grid>

      {shareOptions.requireAuth && (
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Access Password (Optional)"
            type="password"
            value={shareOptions.password}
            onChange={(e) => setShareOptions(prev => ({ ...prev, password: e.target.value }))}
          />
        </Grid>
      )}
    </Grid>
  );

  const renderMoveDialog = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <FormControl fullWidth>
          <InputLabel>Destination</InputLabel>
          <Select
            value={moveOptions.destination}
            onChange={(e) => setMoveOptions(prev => ({ ...prev, destination: e.target.value }))}
            label="Destination"
          >
            <MenuItem value="staging">Staging</MenuItem>
            <MenuItem value="processed">Processed</MenuItem>
            <MenuItem value="archive">Archive</MenuItem>
            <MenuItem value="quarantine">Quarantine</MenuItem>
          </Select>
        </FormControl>
      </Grid>

      <Grid item xs={12}>
        <FormControlLabel
          control={
            <Switch
              checked={moveOptions.createFolder}
              onChange={(e) => setMoveOptions(prev => ({ ...prev, createFolder: e.target.checked }))}
            />
          }
          label="Create New Folder"
        />
      </Grid>

      {moveOptions.createFolder && (
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Folder Name"
            value={moveOptions.folderName}
            onChange={(e) => setMoveOptions(prev => ({ ...prev, folderName: e.target.value }))}
          />
        </Grid>
      )}
    </Grid>
  );

  const renderTagDialog = () => {
    const availableTags = ['Important', 'Draft', 'Review', 'Final', 'Archive', 'Confidential'];
    
    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Current Tags
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
            {tagOptions.tags.map((tag, index) => (
              <Chip
                key={index}
                label={tag}
                onDelete={() => setTagOptions(prev => ({
                  ...prev,
                  tags: prev.tags.filter((_, i) => i !== index)
                }))}
              />
            ))}
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Available Tags
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
            {availableTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                variant={tagOptions.tags.includes(tag) ? 'filled' : 'outlined'}
                onClick={() => {
                  if (tagOptions.tags.includes(tag)) {
                    setTagOptions(prev => ({
                      ...prev,
                      tags: prev.tags.filter(t => t !== tag)
                    }));
                  } else {
                    setTagOptions(prev => ({
                      ...prev,
                      tags: [...prev.tags, tag]
                    }));
                  }
                }}
              />
            ))}
          </Box>
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Add Custom Tag"
            value={tagOptions.newTag}
            onChange={(e) => setTagOptions(prev => ({ ...prev, newTag: e.target.value }))}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && tagOptions.newTag.trim()) {
                setTagOptions(prev => ({
                  ...prev,
                  tags: [...prev.tags, prev.newTag.trim()],
                  newTag: ''
                }));
              }
            }}
          />
        </Grid>
      </Grid>
    );
  };

  // Get category display name
  const getCategoryName = (category: string) => {
    switch (category) {
      case 'view': return 'View';
      case 'edit': return 'Edit';
      case 'process': return 'Process';
      case 'share': return 'Share';
      case 'manage': return 'Manage';
      case 'security': return 'Security';
      default: return category;
    }
  };

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: { minWidth: 250, maxWidth: 350 }
        }}
      >
        {/* File info header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" noWrap>
            {file.originalName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {Math.round(file.fileSize / 1024)} KB • {format(file.uploadedAt, 'MMM dd, yyyy')}
          </Typography>
        </Box>

        {/* Actions by category */}
        {Object.entries(actionsByCategory).map(([category, actions], categoryIndex) => (
          <Box key={category}>
            {categoryIndex > 0 && <Divider />}
            
            {/* Category header */}
            <Box sx={{ px: 2, py: 1, bgcolor: 'grey.50' }}>
              <Typography variant="caption" fontWeight="medium" color="text.secondary">
                {getCategoryName(category)}
              </Typography>
            </Box>

            {/* Category actions */}
            {actions.map((action) => (
              <MenuItem
                key={action.id}
                onClick={() => handleActionClick(action)}
                disabled={action.disabled}
                sx={{
                  color: action.destructive ? 'error.main' : 'inherit',
                  '&:hover': {
                    bgcolor: action.destructive ? 'error.50' : 'action.hover',
                  }
                }}
              >
                <ListItemIcon sx={{ color: 'inherit' }}>
                  {action.icon}
                </ListItemIcon>
                <ListItemText
                  primary={action.label}
                  secondary={action.description}
                />
                {action.badge && (
                  <Chip label={action.badge} size="small" />
                )}
              </MenuItem>
            ))}
          </Box>
        ))}
      </Menu>

      {/* Action dialog */}
      <Dialog
        open={actionDialog.open}
        onClose={closeDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{actionDialog.title}</DialogTitle>
        <DialogContent>
          {actionDialog.content}
        </DialogContent>
        <DialogActions>
          {actionDialog.actions}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FileActionsMenu;
