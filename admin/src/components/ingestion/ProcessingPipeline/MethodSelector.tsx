/**
 * Method Selector Component
 * Phase 3, Day 11: Advanced processing method selection
 * Comprehensive method comparison and configuration system
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
  CardActions,
  Button,
  IconButton,
  Chip,
  Alert,
  AlertTitle,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import {
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
  Settings as SettingsIcon,
  PlayArrow as StartIcon,
  AutoAwesome as AIIcon,
  Layers as LayersIcon,
  Transform as TransformIcon,
  Tune as TuneIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { IngestionMethod, IngestionConfig, ChunkingOptions, EmbeddingOptions, QualityOptions, PerformanceOptions } from '../../../types/ingestion';

interface MethodInfo {
  id: IngestionMethod;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
  pros: string[];
  cons: string[];
  performance: {
    speed: number;
    quality: number;
    memory: number;
    complexity: number;
  };
  estimatedTime: string;
  recommendedFor: string[];
  defaultConfig: IngestionConfig;
}

interface MethodSelectorProps {
  methods: IngestionMethod[];
  selectedMethod: IngestionMethod;
  onMethodSelect: (method: IngestionMethod) => void;
  onConfigurationChange: (config: IngestionConfig) => void;
  onStartProcessing: () => Promise<void>;
  availableConfigurations?: IngestionConfig[];
  enableAdvancedOptions: boolean;
  loading: boolean;
  error: string | null;
}

// Method definitions with comprehensive information
const methodDefinitions: Record<IngestionMethod, MethodInfo> = {
  enhanced: {
    id: 'enhanced',
    name: 'Enhanced Processing',
    description: 'Real OpenAI embeddings with advanced semantic chunking for highest quality',
    icon: <AIIcon />,
    color: 'primary',
    features: [
      'Real OpenAI embeddings (text-embedding-3-large)',
      'Advanced semantic chunking',
      'Quality validation',
      'Structure preservation',
      'Context awareness'
    ],
    pros: [
      'Highest quality embeddings',
      'Best semantic understanding',
      'Excellent for complex documents',
      'Production-ready accuracy'
    ],
    cons: [
      'Slower processing',
      'Higher API costs',
      'Requires OpenAI API key'
    ],
    performance: {
      speed: 60,
      quality: 95,
      memory: 70,
      complexity: 85
    },
    estimatedTime: '2-5 minutes per document',
    recommendedFor: [
      'Production environments',
      'Complex technical documents',
      'High-accuracy requirements',
      'Legal and compliance documents'
    ],
    defaultConfig: {
      method: 'enhanced',
      chunkingOptions: {
        strategy: 'semantic',
        maxTokens: 450,
        minTokens: 100,
        overlapTokens: 50,
        preserveStructure: true,
        semanticBoundaryDetection: true,
        sentenceSimilarityThreshold: 0.7,
        paragraphSimilarityThreshold: 0.6,
        sectionSimilarityThreshold: 0.5,
      },
      embeddingOptions: {
        model: 'text-embedding-3-large',
        batchSize: 100,
        useCache: true,
        validateDimensions: true,
        domainOptimization: true,
        qualityValidation: true,
        minQualityScore: 0.8,
      },
      qualityOptions: {
        minChunkQuality: 0.7,
        minEmbeddingQuality: 0.8,
        validateHierarchy: true,
        checkDuplicates: true,
        enableSemanticValidation: true,
        enableContextualEnrichment: true,
        qualityThresholds: {
          minTokenCount: 50,
          maxTokenCount: 500,
          minCharacterCount: 200,
          maxCharacterCount: 2000,
          minWordCount: 30,
          maxWordCount: 300,
          minQualityScore: 0.7,
          maxErrorRate: 0.1,
        },
      },
      performanceOptions: {
        batchSize: 50,
        parallelProcessing: true,
        memoryOptimization: true,
        progressReporting: true,
        delayBetweenDocuments: 1000,
        maxConcurrentJobs: 2,
        timeoutMinutes: 30,
        enableProfiling: true,
      },
    },
  },
  standard: {
    id: 'standard',
    name: 'Standard Processing',
    description: 'Production pipeline with balanced speed and quality',
    icon: <QualityIcon />,
    color: 'secondary',
    features: [
      'Production ingestion pipeline',
      'Semantic chunking',
      'Structure preservation',
      'Quality validation',
      'Balanced performance'
    ],
    pros: [
      'Good balance of speed and quality',
      'Reliable and stable',
      'Suitable for most documents',
      'Cost-effective'
    ],
    cons: [
      'Lower quality than enhanced',
      'Less semantic understanding',
      'Limited customization'
    ],
    performance: {
      speed: 80,
      quality: 75,
      memory: 60,
      complexity: 60
    },
    estimatedTime: '1-2 minutes per document',
    recommendedFor: [
      'General purpose processing',
      'Medium-sized document collections',
      'Balanced quality requirements',
      'Development and testing'
    ],
    defaultConfig: {
      method: 'standard',
      chunkingOptions: {
        strategy: 'semantic',
        maxTokens: 400,
        minTokens: 80,
        overlapTokens: 40,
        preserveStructure: true,
        semanticBoundaryDetection: true,
        sentenceSimilarityThreshold: 0.6,
      },
      embeddingOptions: {
        model: 'text-embedding-ada-002',
        batchSize: 200,
        useCache: true,
        validateDimensions: false,
        qualityValidation: false,
      },
      qualityOptions: {
        minChunkQuality: 0.6,
        minEmbeddingQuality: 0.7,
        validateHierarchy: false,
        checkDuplicates: true,
        enableSemanticValidation: false,
        enableContextualEnrichment: false,
        qualityThresholds: {
          minTokenCount: 40,
          maxTokenCount: 450,
          minCharacterCount: 150,
          maxCharacterCount: 1800,
          minWordCount: 25,
          maxWordCount: 250,
          minQualityScore: 0.6,
          maxErrorRate: 0.15,
        },
      },
      performanceOptions: {
        batchSize: 100,
        parallelProcessing: true,
        memoryOptimization: false,
        progressReporting: true,
        delayBetweenDocuments: 500,
        maxConcurrentJobs: 3,
        timeoutMinutes: 20,
        enableProfiling: false,
      },
    },
  },
  simple: {
    id: 'simple',
    name: 'Simple Processing',
    description: 'Fast processing with basic chunking for testing',
    icon: <SpeedIcon />,
    color: 'success',
    features: [
      'Basic chunking strategy',
      'Mock embeddings',
      'Fast processing',
      'Minimal validation',
      'Testing focused'
    ],
    pros: [
      'Very fast processing',
      'No API costs',
      'Good for testing',
      'Low resource usage'
    ],
    cons: [
      'Lower quality results',
      'No real embeddings',
      'Limited features',
      'Not production ready'
    ],
    performance: {
      speed: 95,
      quality: 40,
      memory: 30,
      complexity: 20
    },
    estimatedTime: '10-30 seconds per document',
    recommendedFor: [
      'Development and testing',
      'Quick prototyping',
      'Large document batches',
      'Performance testing'
    ],
    defaultConfig: {
      method: 'simple',
      chunkingOptions: {
        strategy: 'fixed',
        maxTokens: 300,
        minTokens: 50,
        overlapTokens: 20,
        preserveStructure: false,
        semanticBoundaryDetection: false,
      },
      embeddingOptions: {
        model: 'mock-embedding',
        batchSize: 500,
        useCache: false,
        validateDimensions: false,
        qualityValidation: false,
      },
      qualityOptions: {
        minChunkQuality: 0.3,
        minEmbeddingQuality: 0.5,
        validateHierarchy: false,
        checkDuplicates: false,
        enableSemanticValidation: false,
        enableContextualEnrichment: false,
        qualityThresholds: {
          minTokenCount: 20,
          maxTokenCount: 350,
          minCharacterCount: 80,
          maxCharacterCount: 1400,
          minWordCount: 15,
          maxWordCount: 200,
          minQualityScore: 0.3,
          maxErrorRate: 0.3,
        },
      },
      performanceOptions: {
        batchSize: 200,
        parallelProcessing: true,
        memoryOptimization: false,
        progressReporting: false,
        delayBetweenDocuments: 0,
        maxConcurrentJobs: 5,
        timeoutMinutes: 10,
        enableProfiling: false,
      },
    },
  },
  advanced: {
    id: 'advanced',
    name: 'Advanced Processing',
    description: 'State-of-the-art hierarchical chunking with multi-scale embeddings',
    icon: <LayersIcon />,
    color: 'warning',
    features: [
      'Hierarchical chunking',
      'Multi-scale embeddings',
      'Advanced context preservation',
      'Experimental features',
      'Highest quality processing'
    ],
    pros: [
      'Cutting-edge technology',
      'Best possible quality',
      'Advanced features',
      'Research-grade results'
    ],
    cons: [
      'Slowest processing',
      'Highest resource usage',
      'Experimental stability',
      'Complex configuration'
    ],
    performance: {
      speed: 30,
      quality: 98,
      memory: 90,
      complexity: 95
    },
    estimatedTime: '5-15 minutes per document',
    recommendedFor: [
      'Research applications',
      'Highest quality requirements',
      'Complex document structures',
      'Experimental features'
    ],
    defaultConfig: {
      method: 'advanced',
      chunkingOptions: {
        strategy: 'hierarchical',
        maxTokens: 500,
        minTokens: 150,
        overlapTokens: 75,
        preserveStructure: true,
        semanticBoundaryDetection: true,
        sentenceSimilarityThreshold: 0.8,
        paragraphSimilarityThreshold: 0.7,
        sectionSimilarityThreshold: 0.6,
        hierarchicalOverlap: true,
        parentChildRelationships: true,
        crossReferenceTracking: true,
        narrativeFlowPreservation: true,
      },
      embeddingOptions: {
        model: 'text-embedding-3-large',
        batchSize: 50,
        useCache: true,
        validateDimensions: true,
        embeddingTypes: ['content', 'contextual', 'hierarchical', 'semantic'],
        domainOptimization: true,
        qualityValidation: true,
        minQualityScore: 0.9,
        maxCacheSize: 10000,
      },
      qualityOptions: {
        minChunkQuality: 0.8,
        minEmbeddingQuality: 0.9,
        validateHierarchy: true,
        checkDuplicates: true,
        enableSemanticValidation: true,
        enableContextualEnrichment: true,
        qualityThresholds: {
          minTokenCount: 75,
          maxTokenCount: 600,
          minCharacterCount: 300,
          maxCharacterCount: 2500,
          minWordCount: 50,
          maxWordCount: 400,
          minQualityScore: 0.8,
          maxErrorRate: 0.05,
        },
      },
      performanceOptions: {
        batchSize: 25,
        parallelProcessing: false,
        memoryOptimization: true,
        progressReporting: true,
        delayBetweenDocuments: 2000,
        maxConcurrentJobs: 1,
        timeoutMinutes: 60,
        enableProfiling: true,
      },
      advancedOptions: {
        crossDocumentLinking: true,
        semanticValidation: true,
        contextualEnrichment: true,
        adaptiveChunking: true,
        multiScaleEmbeddings: true,
        structureAwareChunking: true,
        contentTypeSpecificStrategies: true,
        qualityBasedAdaptiveChunking: true,
        enableExperimentalFeatures: true,
      },
    },
  },
};

const MethodSelector: React.FC<MethodSelectorProps> = ({
  methods,
  selectedMethod,
  onMethodSelect,
  onConfigurationChange,
  onStartProcessing,
  availableConfigurations,
  enableAdvancedOptions,
  loading,
  error,
}) => {
  const [configuration, setConfiguration] = useState<IngestionConfig>(
    methodDefinitions[selectedMethod].defaultConfig
  );
  const [showComparison, setShowComparison] = useState(false);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [configurationExpanded, setConfigurationExpanded] = useState(false);

  // Update configuration when method changes
  useEffect(() => {
    const newConfig = methodDefinitions[selectedMethod].defaultConfig;
    setConfiguration(newConfig);
    onConfigurationChange(newConfig);
  }, [selectedMethod, onConfigurationChange]);

  // Handle method selection
  const handleMethodSelect = (method: IngestionMethod) => {
    onMethodSelect(method);
  };

  // Handle configuration change
  const handleConfigurationChange = (newConfig: Partial<IngestionConfig>) => {
    const updatedConfig = { ...configuration, ...newConfig };
    setConfiguration(updatedConfig);
    onConfigurationChange(updatedConfig);
  };

  // Render method card
  const renderMethodCard = (methodId: IngestionMethod) => {
    const method = methodDefinitions[methodId];
    const isSelected = selectedMethod === methodId;
    const isAvailable = methods.includes(methodId);

    return (
      <Card
        key={methodId}
        sx={{
          cursor: isAvailable ? 'pointer' : 'not-allowed',
          border: isSelected ? 2 : 1,
          borderColor: isSelected ? `${method.color}.main` : 'divider',
          opacity: isAvailable ? 1 : 0.5,
          '&:hover': {
            borderColor: isAvailable ? `${method.color}.main` : 'divider',
            boxShadow: isAvailable ? 2 : 0,
          },
        }}
        onClick={() => isAvailable && handleMethodSelect(methodId)}
      >
        <CardHeader
          avatar={
            <Box color={`${method.color}.main`}>
              {method.icon}
            </Box>
          }
          title={
            <Box display="flex" alignItems="center" gap={1}>
              {method.name}
              {isSelected && <StarIcon color="primary" />}
            </Box>
          }
          subheader={method.description}
          action={
            <Chip
              label={method.estimatedTime}
              color={method.color as any}
              size="small"
            />
          }
        />
        
        <CardContent>
          {/* Performance indicators */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Speed</Typography>
              <LinearProgress
                variant="determinate"
                value={method.performance.speed}
                color="success"
                sx={{ height: 4 }}
              />
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Quality</Typography>
              <LinearProgress
                variant="determinate"
                value={method.performance.quality}
                color="primary"
                sx={{ height: 4 }}
              />
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Memory</Typography>
              <LinearProgress
                variant="determinate"
                value={method.performance.memory}
                color="warning"
                sx={{ height: 4 }}
              />
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Complexity</Typography>
              <LinearProgress
                variant="determinate"
                value={method.performance.complexity}
                color="error"
                sx={{ height: 4 }}
              />
            </Grid>
          </Grid>

          {/* Features */}
          <Typography variant="subtitle2" gutterBottom>Key Features</Typography>
          <Box display="flex" gap={0.5} flexWrap="wrap" mb={2}>
            {method.features.slice(0, 3).map((feature, index) => (
              <Chip key={index} label={feature} size="small" variant="outlined" />
            ))}
            {method.features.length > 3 && (
              <Chip label={`+${method.features.length - 3} more`} size="small" />
            )}
          </Box>

          {/* Recommended for */}
          <Typography variant="subtitle2" gutterBottom>Recommended For</Typography>
          <List dense>
            {method.recommendedFor.slice(0, 2).map((item, index) => (
              <ListItem key={index} sx={{ py: 0 }}>
                <ListItemIcon sx={{ minWidth: 20 }}>
                  <SuccessIcon color="success" sx={{ fontSize: 16 }} />
                </ListItemIcon>
                <ListItemText primary={item} />
              </ListItem>
            ))}
          </List>
        </CardContent>

        <CardActions>
          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setShowComparison(true);
            }}
            startIcon={<CompareIcon />}
          >
            Compare
          </Button>
          {isSelected && (
            <Button
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setShowAdvancedConfig(true);
              }}
              startIcon={<SettingsIcon />}
            >
              Configure
            </Button>
          )}
        </CardActions>
      </Card>
    );
  };

  // Render configuration panel
  const renderConfigurationPanel = () => {
    const method = methodDefinitions[selectedMethod];

    return (
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Configuration: {method.name}
          </Typography>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowComparison(true)}
              startIcon={<CompareIcon />}
            >
              Compare Methods
            </Button>
            <Button
              variant="contained"
              onClick={onStartProcessing}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={16} /> : <StartIcon />}
            >
              {loading ? 'Starting...' : 'Start Processing'}
            </Button>
          </Box>
        </Box>

        {/* Quick configuration */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Chunking Strategy</InputLabel>
              <Select
                value={configuration.chunkingOptions.strategy}
                onChange={(e) => handleConfigurationChange({
                  chunkingOptions: {
                    ...configuration.chunkingOptions,
                    strategy: e.target.value as any
                  }
                })}
                label="Chunking Strategy"
              >
                <MenuItem value="semantic">Semantic</MenuItem>
                <MenuItem value="hierarchical">Hierarchical</MenuItem>
                <MenuItem value="adaptive">Adaptive</MenuItem>
                <MenuItem value="fixed">Fixed</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Max Tokens"
              value={configuration.chunkingOptions.maxTokens}
              onChange={(e) => handleConfigurationChange({
                chunkingOptions: {
                  ...configuration.chunkingOptions,
                  maxTokens: parseInt(e.target.value) || 400
                }
              })}
              inputProps={{ min: 100, max: 1000 }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Embedding Model</InputLabel>
              <Select
                value={configuration.embeddingOptions.model}
                onChange={(e) => handleConfigurationChange({
                  embeddingOptions: {
                    ...configuration.embeddingOptions,
                    model: e.target.value
                  }
                })}
                label="Embedding Model"
              >
                <MenuItem value="text-embedding-3-large">text-embedding-3-large</MenuItem>
                <MenuItem value="text-embedding-ada-002">text-embedding-ada-002</MenuItem>
                <MenuItem value="mock-embedding">Mock (Testing)</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Batch Size"
              value={configuration.embeddingOptions.batchSize}
              onChange={(e) => handleConfigurationChange({
                embeddingOptions: {
                  ...configuration.embeddingOptions,
                  batchSize: parseInt(e.target.value) || 100
                }
              })}
              inputProps={{ min: 10, max: 1000 }}
            />
          </Grid>
        </Grid>

        {/* Advanced configuration */}
        {enableAdvancedOptions && (
          <Accordion
            expanded={configurationExpanded}
            onChange={() => setConfigurationExpanded(!configurationExpanded)}
            sx={{ mt: 2 }}
          >
            <AccordionSummary expandIcon={<ExpandIcon />}>
              <Typography variant="subtitle1">Advanced Configuration</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                {/* Quality options */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>Quality Settings</Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography gutterBottom>Min Chunk Quality</Typography>
                  <Slider
                    value={configuration.qualityOptions.minChunkQuality * 100}
                    onChange={(_, value) => handleConfigurationChange({
                      qualityOptions: {
                        ...configuration.qualityOptions,
                        minChunkQuality: (value as number) / 100
                      }
                    })}
                    min={0}
                    max={100}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={configuration.qualityOptions.enableSemanticValidation}
                        onChange={(e) => handleConfigurationChange({
                          qualityOptions: {
                            ...configuration.qualityOptions,
                            enableSemanticValidation: e.target.checked
                          }
                        })}
                      />
                    }
                    label="Semantic Validation"
                  />
                </Grid>

                {/* Performance options */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>Performance Settings</Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={configuration.performanceOptions.parallelProcessing}
                        onChange={(e) => handleConfigurationChange({
                          performanceOptions: {
                            ...configuration.performanceOptions,
                            parallelProcessing: e.target.checked
                          }
                        })}
                      />
                    }
                    label="Parallel Processing"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Max Concurrent Jobs"
                    value={configuration.performanceOptions.maxConcurrentJobs}
                    onChange={(e) => handleConfigurationChange({
                      performanceOptions: {
                        ...configuration.performanceOptions,
                        maxConcurrentJobs: parseInt(e.target.value) || 1
                      }
                    })}
                    inputProps={{ min: 1, max: 10 }}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <AlertTitle>Configuration Error</AlertTitle>
            {error}
          </Alert>
        )}
      </Paper>
    );
  };

  // Render comparison dialog
  const renderComparisonDialog = () => (
    <Dialog
      open={showComparison}
      onClose={() => setShowComparison(false)}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>Method Comparison</DialogTitle>
      <DialogContent>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Method</TableCell>
                <TableCell>Speed</TableCell>
                <TableCell>Quality</TableCell>
                <TableCell>Memory</TableCell>
                <TableCell>Est. Time</TableCell>
                <TableCell>Best For</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {methods.map((methodId) => {
                const method = methodDefinitions[methodId];
                return (
                  <TableRow key={methodId} selected={selectedMethod === methodId}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        {method.icon}
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {method.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {method.description}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <LinearProgress
                        variant="determinate"
                        value={method.performance.speed}
                        color="success"
                        sx={{ width: 60, height: 4 }}
                      />
                    </TableCell>
                    <TableCell>
                      <LinearProgress
                        variant="determinate"
                        value={method.performance.quality}
                        color="primary"
                        sx={{ width: 60, height: 4 }}
                      />
                    </TableCell>
                    <TableCell>
                      <LinearProgress
                        variant="determinate"
                        value={method.performance.memory}
                        color="warning"
                        sx={{ width: 60, height: 4 }}
                      />
                    </TableCell>
                    <TableCell>{method.estimatedTime}</TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {method.recommendedFor[0]}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowComparison(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Select Processing Method
      </Typography>

      {/* Method cards */}
      <Grid container spacing={3}>
        {methods.map((methodId) => (
          <Grid item xs={12} md={6} lg={3} key={methodId}>
            {renderMethodCard(methodId)}
          </Grid>
        ))}
      </Grid>

      {/* Configuration panel */}
      {renderConfigurationPanel()}

      {/* Comparison dialog */}
      {renderComparisonDialog()}
    </Box>
  );
};

export default MethodSelector;
