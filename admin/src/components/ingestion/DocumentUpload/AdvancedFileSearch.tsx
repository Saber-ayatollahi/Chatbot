/**
 * Advanced File Search Component
 * Phase 2, Day 7: Comprehensive search and filtering system
 * Multi-criteria search with saved filters and advanced options
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  Switch,
  FormControlLabel,
  DatePicker,
  LocalizationProvider,
  Autocomplete,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
  ExpandMore as ExpandIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Tune as TuneIcon,
  History as HistoryIcon,
  BookmarkBorder as BookmarkIcon,
  Bookmark as BookmarkFilledIcon,
} from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import Fuse from 'fuse.js';
import { FileUpload, FileStatus, ValidationStatus } from '../../../types/ingestion';

interface SearchFilters {
  query: string;
  fileTypes: string[];
  statusFilter: FileStatus | 'all';
  validationFilter: ValidationStatus | 'all';
  sizeRange: [number, number];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  authorFilter: string;
  languageFilter: string;
  qualityRange: [number, number];
  hasErrors: boolean | null;
  hasWarnings: boolean | null;
  tags: string[];
}

interface SavedFilter {
  id: string;
  name: string;
  filters: SearchFilters;
  isDefault: boolean;
  isFavorite: boolean;
  createdAt: Date;
  usageCount: number;
}

interface AdvancedFileSearchProps {
  files: FileUpload[];
  onFiltersChange: (filteredFiles: FileUpload[]) => void;
  onSaveFilter?: (filter: SavedFilter) => void;
  savedFilters?: SavedFilter[];
  enableSavedFilters?: boolean;
  enableAdvancedSearch?: boolean;
}

const AdvancedFileSearch: React.FC<AdvancedFileSearchProps> = ({
  files,
  onFiltersChange,
  onSaveFilter,
  savedFilters = [],
  enableSavedFilters = true,
  enableAdvancedSearch = true,
}) => {
  // State management
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    fileTypes: [],
    statusFilter: 'all',
    validationFilter: 'all',
    sizeRange: [0, 100],
    dateRange: { start: null, end: null },
    authorFilter: '',
    languageFilter: '',
    qualityRange: [0, 100],
    hasErrors: null,
    hasWarnings: null,
    tags: [],
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saveFilterDialog, setSaveFilterDialog] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [recentFilters, setRecentFilters] = useState<SavedFilter[]>([]);

  // Fuse.js configuration for fuzzy search
  const fuseOptions = {
    keys: [
      { name: 'filename', weight: 0.3 },
      { name: 'originalName', weight: 0.3 },
      { name: 'metadata.title', weight: 0.2 },
      { name: 'metadata.author', weight: 0.1 },
      { name: 'mimeType', weight: 0.1 },
    ],
    threshold: 0.4,
    includeScore: true,
  };

  const fuse = useMemo(() => new Fuse(files, fuseOptions), [files]);

  // Available file types from current files
  const availableFileTypes = useMemo(() => {
    const types = new Set(files.map(file => {
      if (file.mimeType.includes('pdf')) return 'PDF';
      if (file.mimeType.includes('word')) return 'Word';
      if (file.mimeType.includes('text')) return 'Text';
      if (file.mimeType.includes('markdown')) return 'Markdown';
      return 'Other';
    }));
    return Array.from(types);
  }, [files]);

  // Available authors
  const availableAuthors = useMemo(() => {
    const authors = new Set(
      files
        .map(file => file.metadata?.author)
        .filter(Boolean)
    );
    return Array.from(authors);
  }, [files]);

  // Available languages
  const availableLanguages = useMemo(() => {
    const languages = new Set(
      files
        .map(file => file.metadata?.language)
        .filter(Boolean)
    );
    return Array.from(languages);
  }, [files]);

  // Available tags (simulated)
  const availableTags = useMemo(() => {
    return ['Important', 'Draft', 'Review', 'Final', 'Archive', 'Confidential'];
  }, []);

  // Filter files based on current filters
  const filteredFiles = useMemo(() => {
    let result = files;

    // Text search using Fuse.js
    if (filters.query.trim()) {
      const searchResults = fuse.search(filters.query);
      result = searchResults.map(result => result.item);
      
      // Add to search history
      if (!searchHistory.includes(filters.query)) {
        setSearchHistory(prev => [filters.query, ...prev.slice(0, 9)]);
      }
    }

    // File type filter
    if (filters.fileTypes.length > 0) {
      result = result.filter(file => {
        const fileType = file.mimeType.includes('pdf') ? 'PDF' :
                        file.mimeType.includes('word') ? 'Word' :
                        file.mimeType.includes('text') ? 'Text' :
                        file.mimeType.includes('markdown') ? 'Markdown' : 'Other';
        return filters.fileTypes.includes(fileType);
      });
    }

    // Status filters
    if (filters.statusFilter !== 'all') {
      result = result.filter(file => file.uploadStatus === filters.statusFilter);
    }

    if (filters.validationFilter !== 'all') {
      result = result.filter(file => file.validationStatus === filters.validationFilter);
    }

    // Size range filter (in MB)
    const [minSize, maxSize] = filters.sizeRange;
    result = result.filter(file => {
      const sizeMB = file.fileSize / (1024 * 1024);
      return sizeMB >= minSize && sizeMB <= maxSize;
    });

    // Date range filter
    if (filters.dateRange.start && filters.dateRange.end) {
      result = result.filter(file => {
        const uploadDate = file.uploadedAt;
        return uploadDate >= filters.dateRange.start! && uploadDate <= filters.dateRange.end!;
      });
    }

    // Author filter
    if (filters.authorFilter) {
      result = result.filter(file => 
        file.metadata?.author?.toLowerCase().includes(filters.authorFilter.toLowerCase())
      );
    }

    // Language filter
    if (filters.languageFilter) {
      result = result.filter(file => file.metadata?.language === filters.languageFilter);
    }

    // Error/Warning filters
    if (filters.hasErrors === true) {
      result = result.filter(file => file.validationErrors && file.validationErrors.length > 0);
    } else if (filters.hasErrors === false) {
      result = result.filter(file => !file.validationErrors || file.validationErrors.length === 0);
    }

    if (filters.hasWarnings === true) {
      result = result.filter(file => file.validationWarnings && file.validationWarnings.length > 0);
    } else if (filters.hasWarnings === false) {
      result = result.filter(file => !file.validationWarnings || file.validationWarnings.length === 0);
    }

    return result;
  }, [files, filters, fuse, searchHistory]);

  // Update parent component when filtered files change
  useEffect(() => {
    onFiltersChange(filteredFiles);
  }, [filteredFiles, onFiltersChange]);

  // Handle filter changes
  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      query: '',
      fileTypes: [],
      statusFilter: 'all',
      validationFilter: 'all',
      sizeRange: [0, 100],
      dateRange: { start: null, end: null },
      authorFilter: '',
      languageFilter: '',
      qualityRange: [0, 100],
      hasErrors: null,
      hasWarnings: null,
      tags: [],
    });
  };

  // Save current filter
  const saveCurrentFilter = () => {
    if (!filterName.trim()) return;

    const newFilter: SavedFilter = {
      id: `filter_${Date.now()}`,
      name: filterName,
      filters: { ...filters },
      isDefault: false,
      isFavorite: false,
      createdAt: new Date(),
      usageCount: 0,
    };

    if (onSaveFilter) {
      onSaveFilter(newFilter);
    }

    setRecentFilters(prev => [newFilter, ...prev.slice(0, 4)]);
    setSaveFilterDialog(false);
    setFilterName('');
  };

  // Load saved filter
  const loadSavedFilter = (savedFilter: SavedFilter) => {
    setFilters(savedFilter.filters);
    // Update usage count
    savedFilter.usageCount++;
  };

  // Quick filter presets
  const quickFilters = [
    {
      name: 'Recent Files',
      action: () => handleFilterChange('dateRange', {
        start: startOfDay(subDays(new Date(), 7)),
        end: endOfDay(new Date())
      })
    },
    {
      name: 'Failed Uploads',
      action: () => handleFilterChange('statusFilter', 'failed')
    },
    {
      name: 'Has Errors',
      action: () => handleFilterChange('hasErrors', true)
    },
    {
      name: 'Large Files (>10MB)',
      action: () => handleFilterChange('sizeRange', [10, 100])
    },
    {
      name: 'PDF Only',
      action: () => handleFilterChange('fileTypes', ['PDF'])
    },
  ];

  // Get active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.query) count++;
    if (filters.fileTypes.length > 0) count++;
    if (filters.statusFilter !== 'all') count++;
    if (filters.validationFilter !== 'all') count++;
    if (filters.sizeRange[0] > 0 || filters.sizeRange[1] < 100) count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    if (filters.authorFilter) count++;
    if (filters.languageFilter) count++;
    if (filters.hasErrors !== null) count++;
    if (filters.hasWarnings !== null) count++;
    if (filters.tags.length > 0) count++;
    return count;
  }, [filters]);

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      {/* Main search bar */}
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <TextField
          fullWidth
          placeholder="Search files by name, content, author..."
          value={filters.query}
          onChange={(e) => handleFilterChange('query', e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            endAdornment: filters.query && (
              <IconButton size="small" onClick={() => handleFilterChange('query', '')}>
                <ClearIcon />
              </IconButton>
            ),
          }}
        />
        
        <Badge badgeContent={activeFilterCount} color="primary">
          <Button
            variant={showAdvanced ? 'contained' : 'outlined'}
            startIcon={<FilterIcon />}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            Filters
          </Button>
        </Badge>

        <Button
          variant="outlined"
          startIcon={<ClearIcon />}
          onClick={clearFilters}
          disabled={activeFilterCount === 0}
        >
          Clear
        </Button>
      </Box>

      {/* Quick filters */}
      <Box display="flex" gap={1} mb={2} flexWrap="wrap">
        {quickFilters.map((filter, index) => (
          <Chip
            key={index}
            label={filter.name}
            onClick={filter.action}
            variant="outlined"
            size="small"
          />
        ))}
      </Box>

      {/* Advanced filters */}
      {showAdvanced && (
        <Accordion expanded={showAdvanced}>
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Typography variant="subtitle1">Advanced Filters</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              {/* File types */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>File Types</InputLabel>
                  <Select
                    multiple
                    value={filters.fileTypes}
                    onChange={(e) => handleFilterChange('fileTypes', e.target.value)}
                    label="File Types"
                    renderValue={(selected) => (
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {(selected as string[]).map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {availableFileTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Status filter */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Upload Status</InputLabel>
                  <Select
                    value={filters.statusFilter}
                    onChange={(e) => handleFilterChange('statusFilter', e.target.value)}
                    label="Upload Status"
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="uploaded">Uploaded</MenuItem>
                    <MenuItem value="processing">Processing</MenuItem>
                    <MenuItem value="completed">Completed</MenuItem>
                    <MenuItem value="failed">Failed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Validation filter */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Validation Status</InputLabel>
                  <Select
                    value={filters.validationFilter}
                    onChange={(e) => handleFilterChange('validationFilter', e.target.value)}
                    label="Validation Status"
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="valid">Valid</MenuItem>
                    <MenuItem value="invalid">Invalid</MenuItem>
                    <MenuItem value="warning">Warning</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Author filter */}
              <Grid item xs={12} sm={6} md={4}>
                <Autocomplete
                  size="small"
                  options={availableAuthors}
                  value={filters.authorFilter}
                  onChange={(_, value) => handleFilterChange('authorFilter', value || '')}
                  renderInput={(params) => (
                    <TextField {...params} label="Author" />
                  )}
                />
              </Grid>

              {/* Language filter */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Language</InputLabel>
                  <Select
                    value={filters.languageFilter}
                    onChange={(e) => handleFilterChange('languageFilter', e.target.value)}
                    label="Language"
                  >
                    <MenuItem value="">All</MenuItem>
                    {availableLanguages.map((lang) => (
                      <MenuItem key={lang} value={lang}>
                        {lang}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Date range */}
              <Grid item xs={12} sm={6} md={4}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="From Date"
                    value={filters.dateRange.start}
                    onChange={(date) => handleFilterChange('dateRange', {
                      ...filters.dateRange,
                      start: date
                    })}
                    renderInput={(params) => <TextField {...params} size="small" fullWidth />}
                  />
                </LocalizationProvider>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="To Date"
                    value={filters.dateRange.end}
                    onChange={(date) => handleFilterChange('dateRange', {
                      ...filters.dateRange,
                      end: date
                    })}
                    renderInput={(params) => <TextField {...params} size="small" fullWidth />}
                  />
                </LocalizationProvider>
              </Grid>

              {/* Size range */}
              <Grid item xs={12} md={6}>
                <Typography gutterBottom>File Size Range (MB)</Typography>
                <Slider
                  value={filters.sizeRange}
                  onChange={(_, value) => handleFilterChange('sizeRange', value)}
                  valueLabelDisplay="auto"
                  min={0}
                  max={100}
                  marks={[
                    { value: 0, label: '0MB' },
                    { value: 25, label: '25MB' },
                    { value: 50, label: '50MB' },
                    { value: 100, label: '100MB+' },
                  ]}
                />
              </Grid>

              {/* Error/Warning toggles */}
              <Grid item xs={12} md={6}>
                <Typography gutterBottom>Validation Issues</Typography>
                <Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={filters.hasErrors === true}
                        onChange={(e) => handleFilterChange('hasErrors', e.target.checked ? true : null)}
                      />
                    }
                    label="Has Errors"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={filters.hasWarnings === true}
                        onChange={(e) => handleFilterChange('hasWarnings', e.target.checked ? true : null)}
                      />
                    }
                    label="Has Warnings"
                  />
                </Box>
              </Grid>
            </Grid>

            {/* Filter actions */}
            <Box mt={3} display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {filteredFiles.length} of {files.length} files match your criteria
              </Typography>
              
              {enableSavedFilters && (
                <Box display="flex" gap={1}>
                  <Button
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={() => setSaveFilterDialog(true)}
                    disabled={activeFilterCount === 0}
                  >
                    Save Filter
                  </Button>
                </Box>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Search history and saved filters */}
      {enableSavedFilters && (searchHistory.length > 0 || recentFilters.length > 0) && (
        <Box mt={2}>
          <Divider sx={{ mb: 2 }} />
          
          {/* Search history */}
          {searchHistory.length > 0 && (
            <Box mb={2}>
              <Typography variant="subtitle2" gutterBottom>
                <HistoryIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Recent Searches
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {searchHistory.slice(0, 5).map((query, index) => (
                  <Chip
                    key={index}
                    label={query}
                    size="small"
                    variant="outlined"
                    onClick={() => handleFilterChange('query', query)}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Recent filters */}
          {recentFilters.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                <BookmarkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Recent Filters
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {recentFilters.map((filter) => (
                  <Chip
                    key={filter.id}
                    label={filter.name}
                    size="small"
                    variant="outlined"
                    onClick={() => loadSavedFilter(filter)}
                    icon={filter.isFavorite ? <StarIcon /> : <StarBorderIcon />}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Save filter dialog */}
      <Dialog open={saveFilterDialog} onClose={() => setSaveFilterDialog(false)}>
        <DialogTitle>Save Filter</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Filter Name"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveFilterDialog(false)}>Cancel</Button>
          <Button onClick={saveCurrentFilter} disabled={!filterName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default AdvancedFileSearch;
