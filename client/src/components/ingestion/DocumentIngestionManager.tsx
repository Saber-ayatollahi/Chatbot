/**
 * Document Ingestion Manager Component
 * Advanced document processing and ingestion management interface
 */

import React, { useState, useCallback } from 'react';
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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
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
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Description as DocumentIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';

interface AvailableFile {
  filename: string;
  filePath: string;
  relativePath: string;
  fileSize: number;
  lastModified: string;
  documentType: string;
  status: string;
  selected?: boolean;
}

interface IngestionJob {
  id: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  processingMethod: 'standard' | 'advanced';
  chunksGenerated?: number;
  qualityScore?: number;
  createdAt: string;
  error?: string;
  sourceId?: string;
  archivedPath?: string;
}

interface ProcessingConfig {
  method: 'standard' | 'advanced';
  enableHierarchicalChunking: boolean;
  enableMultiScaleEmbeddings: boolean;
  enableAdvancedRetrieval: boolean;
  enableQualityValidation: boolean;
  batchSize: number;
  
  // Advanced Hierarchical Chunking Options
  hierarchicalChunkingOptions: {
    semanticBoundaryDetection: boolean;
    sentenceSimilarityThreshold: number;
    enableParentChildLinks: boolean;
    enableSiblingLinks: boolean;
    qualityThresholds: {
      minTokenCount: number;
      maxTokenCount: number;
      minQualityScore: number;
    };
  };
  
  // Multi-Scale Embedding Options
  multiScaleEmbeddingOptions: {
    embeddingTypes: {
      content: boolean;
      contextual: boolean;
      hierarchical: boolean;
      semantic: boolean;
    };
    domainOptimization: {
      enabled: boolean;
      domain: string;
      keywordBoost: number;
    };
    qualityValidation: {
      enabled: boolean;
      minQualityThreshold: number;
    };
  };
  
  // Advanced Retrieval Options
  advancedRetrievalOptions: {
    strategies: {
      vectorOnly: boolean;
      hybrid: boolean;
      multiScale: boolean;
      contextual: boolean;
    };
    contextExpansion: {
      enabled: boolean;
      hierarchicalExpansion: boolean;
      semanticExpansion: boolean;
      maxExpansionChunks: number;
    };
    lostInMiddleMitigation: {
      enabled: boolean;
      reorderByRelevance: boolean;
      interleaveChunks: boolean;
    };
    qualityOptimization: {
      enabled: boolean;
      coherenceScoring: boolean;
      redundancyReduction: boolean;
      complementarityMaximization: boolean;
    };
  };
}

const DocumentIngestionManager: React.FC = () => {
  const [availableFiles, setAvailableFiles] = useState<AvailableFile[]>([]);
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [configOpen, setConfigOpen] = useState(false);
  const [config, setConfig] = useState<ProcessingConfig>({
    method: 'advanced',
    enableHierarchicalChunking: true,
    enableMultiScaleEmbeddings: true,
    enableAdvancedRetrieval: true,
    enableQualityValidation: true,
    batchSize: 5,
    
    // Advanced Hierarchical Chunking Options
    hierarchicalChunkingOptions: {
      semanticBoundaryDetection: true,
      sentenceSimilarityThreshold: 0.3,
      enableParentChildLinks: true,
      enableSiblingLinks: true,
      qualityThresholds: {
        minTokenCount: 50,
        maxTokenCount: 800,
        minQualityScore: 0.6,
      },
    },
    
    // Multi-Scale Embedding Options
    multiScaleEmbeddingOptions: {
      embeddingTypes: {
        content: true,
        contextual: true,
        hierarchical: true,
        semantic: true,
      },
      domainOptimization: {
        enabled: true,
        domain: 'fundManagement',
        keywordBoost: 1.2,
      },
      qualityValidation: {
        enabled: true,
        minQualityThreshold: 0.7,
      },
    },
    
    // Advanced Retrieval Options
    advancedRetrievalOptions: {
      strategies: {
        vectorOnly: true,
        hybrid: true,
        multiScale: true,
        contextual: true,
      },
      contextExpansion: {
        enabled: true,
        hierarchicalExpansion: true,
        semanticExpansion: true,
        maxExpansionChunks: 3,
      },
      lostInMiddleMitigation: {
        enabled: true,
        reorderByRelevance: true,
        interleaveChunks: true,
      },
      qualityOptimization: {
        enabled: true,
        coherenceScoring: true,
        redundancyReduction: true,
        complementarityMaximization: true,
      },
    },
  });

  // Fetch available files from the knowledge base
  const fetchAvailableFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/ingestion/files/available');
      const result = await response.json();
      
      if (result.success) {
        setAvailableFiles(result.files.map((file: AvailableFile) => ({ ...file, selected: false })));
      } else {
        console.error('Failed to fetch available files:', result.error);
      }
    } catch (error) {
      console.error('Error fetching available files:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load available files on component mount
  React.useEffect(() => {
    fetchAvailableFiles();
  }, [fetchAvailableFiles]);

  const processSelectedFiles = useCallback(async (selectedFiles: AvailableFile[], config: ProcessingConfig) => {
    try {
      const response = await fetch('/api/ingestion/files/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: selectedFiles,
          config: { ...config, method: config.method }
        }),
      });

      if (!response.ok) {
        throw new Error('Ingestion request failed');
      }

      const result = await response.json();
      
      if (result.success) {
        // Update jobs with results
        result.results.forEach((fileResult: any) => {
          const jobId = `job_${Date.now()}_${fileResult.filename}`;
          const newJob: IngestionJob = {
            id: jobId,
            fileName: fileResult.filename,
            status: fileResult.status === 'success' ? 'completed' : 'error',
            progress: fileResult.status === 'success' ? 100 : 0,
            processingMethod: config.method,
            createdAt: new Date().toISOString(),
            sourceId: fileResult.sourceId,
            archivedPath: fileResult.archivedPath,
            error: fileResult.error
          };
          
          setJobs(prev => [...prev, newJob]);
        });
        
        // Refresh available files list (processed files should be gone)
        await fetchAvailableFiles();
      } else {
        throw new Error(result.error || 'Processing failed');
      }

    } catch (error) {
      console.error('Processing failed:', error);
      // Add error jobs for all selected files
      selectedFiles.forEach(file => {
        const jobId = `job_${Date.now()}_${file.filename}`;
        const errorJob: IngestionJob = {
          id: jobId,
          fileName: file.filename,
          status: 'error',
          progress: 0,
          processingMethod: config.method,
          createdAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        setJobs(prev => [...prev, errorJob]);
      });
    }
  }, []);

  const pollJobStatus = async (serverJobId: string, clientJobId: string) => {
    const maxPolls = 60; // 5 minutes max
    let polls = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/ingestion/jobs/${serverJobId}`);
        if (!response.ok) return;

        const result = await response.json();
        const job = result.job;

        // Update progress
        setJobs(prev => prev.map(j => 
          j.id === clientJobId 
            ? { 
                ...j, 
                progress: job.progress_percentage || 0,
                status: job.job_status === 'completed' ? 'completed' : 
                       job.job_status === 'failed' ? 'error' : 'processing'
              }
            : j
        ));

        // If completed, update with final results
        if (job.job_status === 'completed') {
          setJobs(prev => prev.map(j => 
            j.id === clientJobId 
              ? { 
                  ...j, 
                  status: 'completed',
                  progress: 100,
                  chunksGenerated: job.chunks_processed || 0,
                  qualityScore: job.processing_stats?.averageQuality || 0.8
                }
              : j
          ));
          return;
        }

        // If failed, update with error
        if (job.job_status === 'failed') {
          setJobs(prev => prev.map(j => 
            j.id === clientJobId 
              ? { ...j, status: 'error', error: job.error_message }
              : j
          ));
          return;
        }

        // Continue polling if still processing
        if (polls < maxPolls && job.job_status === 'running') {
          polls++;
          setTimeout(poll, 5000); // Poll every 5 seconds
        }

      } catch (error) {
        console.error('Polling failed:', error);
      }
    };

    poll();
  };

  const handleRunIngestion = useCallback(async () => {
    const selectedFiles = availableFiles.filter(file => file.selected);
    
    if (selectedFiles.length === 0) {
      alert('Please select at least one file to process.');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      await processSelectedFiles(selectedFiles, config);
    } catch (error) {
      console.error('Ingestion failed:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [availableFiles, config, processSelectedFiles]);

  const handleFileSelection = useCallback((filename: string, selected: boolean) => {
    setAvailableFiles(prev => prev.map(file => 
      file.filename === filename ? { ...file, selected } : file
    ));
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    setAvailableFiles(prev => prev.map(file => ({ ...file, selected })));
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <SuccessIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'processing':
        return <PendingIcon color="primary" />;
      default:
        return <PendingIcon color="disabled" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'processing':
        return 'primary';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        📄 Document Ingestion Management
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Run ingestion on available documents - processed files will be moved to archives
      </Typography>

      <Grid container spacing={3}>
        {/* Available Files */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6">Available Files for Ingestion</Typography>
                <Button
                  startIcon={<RefreshIcon />}
                  onClick={fetchAvailableFiles}
                  disabled={isLoading}
                  size="small"
                >
                  Refresh
                </Button>
              </Box>
              
              {isLoading ? (
                <Box display="flex" justifyContent="center" p={3}>
                  <Typography>Loading available files...</Typography>
                </Box>
              ) : availableFiles.length === 0 ? (
                <Alert severity="info">
                  No files available for ingestion. Add files to the knowledge_base/documents folder.
                </Alert>
              ) : (
                <Box>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="body2" color="text.secondary">
                      {availableFiles.length} files available
                    </Typography>
                    <Box>
                      <Button
                        size="small"
                        onClick={() => handleSelectAll(true)}
                        sx={{ mr: 1 }}
                      >
                        Select All
                      </Button>
                      <Button
                        size="small"
                        onClick={() => handleSelectAll(false)}
                      >
                        Clear All
                      </Button>
                    </Box>
                  </Box>
                  
                  <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {availableFiles.map((file) => (
                      <ListItem key={file.filename} divider>
                        <Box display="flex" alignItems="center" width="100%">
                          <input
                            type="checkbox"
                            checked={file.selected || false}
                            onChange={(e) => handleFileSelection(file.filename, e.target.checked)}
                            style={{ marginRight: 8 }}
                          />
                          <Box flex={1}>
                            <ListItemText
                              primary={file.filename}
                              secondary={
                                <Box>
                                  <Typography variant="caption" display="block">
                                    {formatFileSize(file.fileSize)} • {file.documentType.toUpperCase()}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    Modified: {new Date(file.lastModified).toLocaleDateString()}
                                  </Typography>
                                </Box>
                              }
                            />
                          </Box>
                          <DocumentIcon color="action" />
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                  
                  <Box mt={2}>
                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<UploadIcon />}
                      onClick={handleRunIngestion}
                      disabled={isProcessing || !availableFiles.some(f => f.selected)}
                    >
                      {isProcessing ? 'Processing...' : 'Run Ingestion on Selected Files'}
                    </Button>
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Configuration Panel */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6">Processing Configuration</Typography>
                <IconButton onClick={() => setConfigOpen(true)}>
                  <SettingsIcon />
                </IconButton>
              </Box>
              
              <Box mb={2}>
                <Chip 
                  label={`Method: ${config.method.toUpperCase()}`}
                  color={config.method === 'advanced' ? 'primary' : 'default'}
                  variant="outlined"
                />
              </Box>

              <Typography variant="body2" color="text.secondary">
                Advanced Features:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="Hierarchical Chunking"
                    secondary={config.enableHierarchicalChunking ? 
                      `Enabled (Semantic: ${config.hierarchicalChunkingOptions.semanticBoundaryDetection ? 'ON' : 'OFF'})` : 
                      'Disabled'
                    }
                  />
                  <Chip 
                    size="small" 
                    label={config.enableHierarchicalChunking ? 'ON' : 'OFF'}
                    color={config.enableHierarchicalChunking ? 'success' : 'default'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Multi-Scale Embeddings"
                    secondary={config.enableMultiScaleEmbeddings ? 
                      `Enabled (${Object.values(config.multiScaleEmbeddingOptions.embeddingTypes).filter(Boolean).length}/4 types)` : 
                      'Disabled'
                    }
                  />
                  <Chip 
                    size="small" 
                    label={config.enableMultiScaleEmbeddings ? 'ON' : 'OFF'}
                    color={config.enableMultiScaleEmbeddings ? 'success' : 'default'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Advanced Retrieval"
                    secondary={config.enableAdvancedRetrieval ? 
                      `Enabled (${Object.values(config.advancedRetrievalOptions.strategies).filter(Boolean).length}/4 strategies)` : 
                      'Disabled'
                    }
                  />
                  <Chip 
                    size="small" 
                    label={config.enableAdvancedRetrieval ? 'ON' : 'OFF'}
                    color={config.enableAdvancedRetrieval ? 'success' : 'default'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Quality Validation"
                    secondary={config.enableQualityValidation ? 
                      `Enabled (Min Score: ${config.hierarchicalChunkingOptions.qualityThresholds.minQualityScore})` : 
                      'Disabled'
                    }
                  />
                  <Chip 
                    size="small" 
                    label={config.enableQualityValidation ? 'ON' : 'OFF'}
                    color={config.enableQualityValidation ? 'success' : 'default'}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Processing Jobs */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6">Processing Jobs</Typography>
                <Button startIcon={<RefreshIcon />} onClick={() => setJobs([])}>
                  Clear All
                </Button>
              </Box>

              {jobs.length === 0 ? (
                <Alert severity="info">
                  No processing jobs yet. Upload documents to get started.
                </Alert>
              ) : (
                <List>
                  {jobs.map((job) => (
                    <React.Fragment key={job.id}>
                      <ListItem>
                        <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                          {getStatusIcon(job.status)}
                        </Box>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <DocumentIcon fontSize="small" />
                              {job.fileName}
                              <Chip 
                                size="small" 
                                label={job.processingMethod}
                                color={job.processingMethod === 'advanced' ? 'primary' : 'default'}
                              />
                              <Chip 
                                size="small" 
                                label={job.status}
                                color={getStatusColor(job.status) as any}
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              {job.status === 'processing' && (
                                <LinearProgress 
                                  variant="determinate" 
                                  value={job.progress} 
                                  sx={{ mt: 1, mb: 1 }}
                                />
                              )}
                              {job.status === 'completed' && (
                                <Box>
                                  <Typography variant="body2" color="text.secondary">
                                    {job.chunksGenerated ? `Generated ${job.chunksGenerated} chunks` : 'Processing completed'}
                                    {job.qualityScore && ` • Quality: ${(job.qualityScore * 100).toFixed(1)}%`}
                                  </Typography>
                                  {job.archivedPath && (
                                    <Typography variant="caption" color="success.main">
                                      ✅ Archived to: {job.archivedPath.split('/').pop()}
                                    </Typography>
                                  )}
                                </Box>
                              )}
                              {job.status === 'error' && (
                                <Typography variant="body2" color="error">
                                  Error: {job.error}
                                </Typography>
                              )}
                              <Typography variant="caption" color="text.secondary">
                                {new Date(job.createdAt).toLocaleString()}
                              </Typography>
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton edge="end" onClick={() => setJobs(prev => prev.filter(j => j.id !== job.id))}>
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Configuration Dialog */}
      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Processing Configuration</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Processing Method</InputLabel>
              <Select
                value={config.method}
                onChange={(e) => setConfig(prev => ({ ...prev, method: e.target.value as 'standard' | 'advanced' }))}
              >
                <MenuItem value="standard">Standard Processing</MenuItem>
                <MenuItem value="advanced">Advanced Processing</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>Core Advanced Features</Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={config.enableHierarchicalChunking}
                  onChange={(e) => setConfig(prev => ({ ...prev, enableHierarchicalChunking: e.target.checked }))}
                />
              }
              label="Hierarchical Chunking"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={config.enableMultiScaleEmbeddings}
                  onChange={(e) => setConfig(prev => ({ ...prev, enableMultiScaleEmbeddings: e.target.checked }))}
                />
              }
              label="Multi-Scale Embeddings"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={config.enableAdvancedRetrieval}
                  onChange={(e) => setConfig(prev => ({ ...prev, enableAdvancedRetrieval: e.target.checked }))}
                />
              }
              label="Advanced Retrieval"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={config.enableQualityValidation}
                  onChange={(e) => setConfig(prev => ({ ...prev, enableQualityValidation: e.target.checked }))}
                />
              }
              label="Quality Validation"
            />

            {/* Hierarchical Chunking Options */}
            {config.enableHierarchicalChunking && (
              <Box sx={{ mt: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>Hierarchical Chunking Options</Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.hierarchicalChunkingOptions.semanticBoundaryDetection}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        hierarchicalChunkingOptions: {
                          ...prev.hierarchicalChunkingOptions,
                          semanticBoundaryDetection: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="Semantic Boundary Detection"
                />
                
                <TextField
                  fullWidth
                  margin="normal"
                  label="Sentence Similarity Threshold"
                  type="number"
                  value={config.hierarchicalChunkingOptions.sentenceSimilarityThreshold}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    hierarchicalChunkingOptions: {
                      ...prev.hierarchicalChunkingOptions,
                      sentenceSimilarityThreshold: parseFloat(e.target.value) || 0.3
                    }
                  }))}
                  inputProps={{ min: 0, max: 1, step: 0.1 }}
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.hierarchicalChunkingOptions.enableParentChildLinks}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        hierarchicalChunkingOptions: {
                          ...prev.hierarchicalChunkingOptions,
                          enableParentChildLinks: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="Parent-Child Relationships"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.hierarchicalChunkingOptions.enableSiblingLinks}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        hierarchicalChunkingOptions: {
                          ...prev.hierarchicalChunkingOptions,
                          enableSiblingLinks: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="Sibling Relationships"
                />
              </Box>
            )}

            {/* Multi-Scale Embedding Options */}
            {config.enableMultiScaleEmbeddings && (
              <Box sx={{ mt: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>Multi-Scale Embedding Options</Typography>
                
                <Typography variant="body2" sx={{ mb: 1 }}>Embedding Types:</Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.multiScaleEmbeddingOptions.embeddingTypes.content}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        multiScaleEmbeddingOptions: {
                          ...prev.multiScaleEmbeddingOptions,
                          embeddingTypes: {
                            ...prev.multiScaleEmbeddingOptions.embeddingTypes,
                            content: e.target.checked
                          }
                        }
                      }))}
                    />
                  }
                  label="Content Embeddings"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.multiScaleEmbeddingOptions.embeddingTypes.contextual}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        multiScaleEmbeddingOptions: {
                          ...prev.multiScaleEmbeddingOptions,
                          embeddingTypes: {
                            ...prev.multiScaleEmbeddingOptions.embeddingTypes,
                            contextual: e.target.checked
                          }
                        }
                      }))}
                    />
                  }
                  label="Contextual Embeddings"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.multiScaleEmbeddingOptions.embeddingTypes.hierarchical}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        multiScaleEmbeddingOptions: {
                          ...prev.multiScaleEmbeddingOptions,
                          embeddingTypes: {
                            ...prev.multiScaleEmbeddingOptions.embeddingTypes,
                            hierarchical: e.target.checked
                          }
                        }
                      }))}
                    />
                  }
                  label="Hierarchical Embeddings"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.multiScaleEmbeddingOptions.embeddingTypes.semantic}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        multiScaleEmbeddingOptions: {
                          ...prev.multiScaleEmbeddingOptions,
                          embeddingTypes: {
                            ...prev.multiScaleEmbeddingOptions.embeddingTypes,
                            semantic: e.target.checked
                          }
                        }
                      }))}
                    />
                  }
                  label="Semantic Embeddings"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.multiScaleEmbeddingOptions.domainOptimization.enabled}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        multiScaleEmbeddingOptions: {
                          ...prev.multiScaleEmbeddingOptions,
                          domainOptimization: {
                            ...prev.multiScaleEmbeddingOptions.domainOptimization,
                            enabled: e.target.checked
                          }
                        }
                      }))}
                    />
                  }
                  label="Domain Optimization"
                />
                
                <TextField
                  fullWidth
                  margin="normal"
                  label="Keyword Boost Factor"
                  type="number"
                  value={config.multiScaleEmbeddingOptions.domainOptimization.keywordBoost}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    multiScaleEmbeddingOptions: {
                      ...prev.multiScaleEmbeddingOptions,
                      domainOptimization: {
                        ...prev.multiScaleEmbeddingOptions.domainOptimization,
                        keywordBoost: parseFloat(e.target.value) || 1.2
                      }
                    }
                  }))}
                  inputProps={{ min: 1, max: 2, step: 0.1 }}
                />
              </Box>
            )}

            {/* Advanced Retrieval Options */}
            {config.enableAdvancedRetrieval && (
              <Box sx={{ mt: 3, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>Advanced Retrieval Options</Typography>
                
                <Typography variant="body2" sx={{ mb: 1 }}>Retrieval Strategies:</Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.advancedRetrievalOptions.strategies.vectorOnly}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        advancedRetrievalOptions: {
                          ...prev.advancedRetrievalOptions,
                          strategies: {
                            ...prev.advancedRetrievalOptions.strategies,
                            vectorOnly: e.target.checked
                          }
                        }
                      }))}
                    />
                  }
                  label="Vector-Only Search"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.advancedRetrievalOptions.strategies.hybrid}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        advancedRetrievalOptions: {
                          ...prev.advancedRetrievalOptions,
                          strategies: {
                            ...prev.advancedRetrievalOptions.strategies,
                            hybrid: e.target.checked
                          }
                        }
                      }))}
                    />
                  }
                  label="Hybrid Search"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.advancedRetrievalOptions.strategies.multiScale}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        advancedRetrievalOptions: {
                          ...prev.advancedRetrievalOptions,
                          strategies: {
                            ...prev.advancedRetrievalOptions.strategies,
                            multiScale: e.target.checked
                          }
                        }
                      }))}
                    />
                  }
                  label="Multi-Scale Search"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.advancedRetrievalOptions.strategies.contextual}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        advancedRetrievalOptions: {
                          ...prev.advancedRetrievalOptions,
                          strategies: {
                            ...prev.advancedRetrievalOptions.strategies,
                            contextual: e.target.checked
                          }
                        }
                      }))}
                    />
                  }
                  label="Contextual Search"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.advancedRetrievalOptions.contextExpansion.enabled}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        advancedRetrievalOptions: {
                          ...prev.advancedRetrievalOptions,
                          contextExpansion: {
                            ...prev.advancedRetrievalOptions.contextExpansion,
                            enabled: e.target.checked
                          }
                        }
                      }))}
                    />
                  }
                  label="Context Expansion"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.advancedRetrievalOptions.lostInMiddleMitigation.enabled}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        advancedRetrievalOptions: {
                          ...prev.advancedRetrievalOptions,
                          lostInMiddleMitigation: {
                            ...prev.advancedRetrievalOptions.lostInMiddleMitigation,
                            enabled: e.target.checked
                          }
                        }
                      }))}
                    />
                  }
                  label="Lost-in-Middle Mitigation"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.advancedRetrievalOptions.qualityOptimization.enabled}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        advancedRetrievalOptions: {
                          ...prev.advancedRetrievalOptions,
                          qualityOptimization: {
                            ...prev.advancedRetrievalOptions.qualityOptimization,
                            enabled: e.target.checked
                          }
                        }
                      }))}
                    />
                  }
                  label="Quality Optimization"
                />
              </Box>
            )}

            <TextField
              fullWidth
              margin="normal"
              label="Batch Size"
              type="number"
              value={config.batchSize}
              onChange={(e) => setConfig(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 5 }))}
              inputProps={{ min: 1, max: 10 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigOpen(false)}>Cancel</Button>
          <Button onClick={() => setConfigOpen(false)} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentIngestionManager;
