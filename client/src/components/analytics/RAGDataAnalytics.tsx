/**
 * RAG Data Analytics Component
 * Displays live RAG system data including embeddings, chunks, models, and performance metrics
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Paper,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Storage as StorageIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  Assessment as AssessmentIcon,
  DataUsage as DataUsageIcon,
} from '@mui/icons-material';

interface RAGOverview {
  totalDocuments: number;
  totalChunks: number;
  totalEmbeddings: number;
  completedJobs: number;
  storage: {
    chunks_size: string;
    sources_size: string;
    total_db_size: string;
  };
  recentActivity: {
    jobsLast24h: number;
    avgProcessingTime: number;
  };
  lastUpdated: string;
}

interface EmbeddingStats {
  byModel: Array<{
    embedding_model: string;
    dimensions: number;
    count: number;
    avg_quality: number;
  }>;
  byType: Array<{
    embedding_type: string;
    count: number;
    avg_quality: number;
  }>;
  qualityDistribution: Array<{
    quality_range: string;
    count: number;
  }>;
  lastUpdated: string;
}

interface ChunkAnalytics {
  sizeDistribution: Array<{
    size_range: string;
    count: number;
    avg_length: number;
  }>;
  hierarchicalInfo: Array<{
    chunk_type: string;
    count: number;
    has_parent: number;
    avg_level: number;
  }>;
  processingMethods: Array<{
    processing_method: string;
    count: number;
    avg_quality: number;
    avg_length: number;
  }>;
  lastUpdated: string;
}

interface ModelInfo {
  embeddingModels: Array<{
    embedding_model: string;
    embeddings_count: number;
    dimensions: number;
    first_used: string;
    last_used: string;
    avg_quality: number;
  }>;
  configurationUsage: Array<{
    hierarchical_chunking: string;
    multi_scale_embeddings: string;
    advanced_retrieval: string;
    quality_validation: string;
    usage_count: number;
  }>;
  systemInfo: {
    databaseVersion: string;
    pgvectorVersion: string;
  };
  lastUpdated: string;
}

interface QualityMetrics {
  overallQuality: Array<{
    type: string;
    total_count: number;
    avg_score: number;
    min_score: number;
    max_score: number;
    median_score: number;
  }>;
  qualityTrends: Array<{
    date: string;
    avg_quality: number;
    count: number;
  }>;
  lastUpdated: string;
}

const RAGDataAnalytics: React.FC = () => {
  const [overview, setOverview] = useState<RAGOverview | null>(null);
  const [embeddingStats, setEmbeddingStats] = useState<EmbeddingStats | null>(null);
  const [chunkAnalytics, setChunkAnalytics] = useState<ChunkAnalytics | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRAGData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [overviewRes, embeddingRes, chunkRes, modelRes, qualityRes] = await Promise.all([
        fetch('/api/rag-analytics/overview'),
        fetch('/api/rag-analytics/embeddings/stats'),
        fetch('/api/rag-analytics/chunks/analytics'),
        fetch('/api/rag-analytics/models/info'),
        fetch('/api/rag-analytics/quality/metrics')
      ]);

      const [overviewData, embeddingData, chunkData, modelData, qualityData] = await Promise.all([
        overviewRes.json(),
        embeddingRes.json(),
        chunkRes.json(),
        modelRes.json(),
        qualityRes.json()
      ]);

      if (overviewData.success) setOverview(overviewData.data);
      if (embeddingData.success) setEmbeddingStats(embeddingData.data);
      if (chunkData.success) setChunkAnalytics(chunkData.data);
      if (modelData.success) setModelInfo(modelData.data);
      if (qualityData.success) setQualityMetrics(qualityData.data);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch RAG data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRAGData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchRAGData, 30000);
    return () => clearInterval(interval);
  }, [fetchRAGData]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };


  if (loading && !overview) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading RAG analytics...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Error loading RAG data: {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        📊 RAG System Analytics
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Live data from your RAG system - embeddings, chunks, models, and performance metrics
      </Typography>

      {/* Overview Cards */}
      {overview && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center">
                  <DataUsageIcon color="primary" sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="h4">{formatNumber(overview.totalDocuments)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Documents Processed
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
                  <MemoryIcon color="success" sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="h4">{formatNumber(overview.totalChunks)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Text Chunks
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
                  <AssessmentIcon color="warning" sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="h4">{formatNumber(overview.totalEmbeddings)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Embeddings Generated
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
                  <SpeedIcon color="info" sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="h4">{overview.recentActivity.jobsLast24h}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Jobs Last 24h
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Storage Information */}
      {overview && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" mb={2}>
              <StorageIcon sx={{ mr: 1 }} />
              <Typography variant="h6">Storage Usage</Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="text.secondary">Text Chunks</Typography>
                <Typography variant="h6">{overview.storage.chunks_size}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="text.secondary">Sources</Typography>
                <Typography variant="h6">{overview.storage.sources_size}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="body2" color="text.secondary">Total Database</Typography>
                <Typography variant="h6">{overview.storage.total_db_size}</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Detailed Analytics Accordions */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          {/* Embedding Statistics */}
          {embeddingStats && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">🔗 Embedding Statistics</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  <Typography variant="subtitle1" gutterBottom>Models in Use</Typography>
                  <TableContainer component={Paper} sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Model</TableCell>
                          <TableCell>Dimensions</TableCell>
                          <TableCell>Count</TableCell>
                          <TableCell>Avg Quality</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {embeddingStats.byModel.map((model, index) => (
                          <TableRow key={index}>
                            <TableCell>{model.embedding_model}</TableCell>
                            <TableCell>{model.dimensions}</TableCell>
                            <TableCell>{formatNumber(model.count)}</TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center">
                                <LinearProgress
                                  variant="determinate"
                                  value={model.avg_quality * 100}
                                  sx={{ width: 60, mr: 1 }}
                                />
                                {formatPercentage(model.avg_quality)}
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Typography variant="subtitle1" gutterBottom>Quality Distribution</Typography>
                  <List dense>
                    {embeddingStats.qualityDistribution.map((quality, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={quality.quality_range}
                          secondary={`${formatNumber(quality.count)} embeddings`}
                        />
                        <Chip label={formatNumber(quality.count)} size="small" />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              </AccordionDetails>
            </Accordion>
          )}
        </Grid>

        <Grid item xs={12} md={6}>
          {/* Chunk Analytics */}
          {chunkAnalytics && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">📄 Chunk Analytics</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  <Typography variant="subtitle1" gutterBottom>Size Distribution</Typography>
                  <List dense sx={{ mb: 2 }}>
                    {chunkAnalytics.sizeDistribution.map((size, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={size.size_range}
                          secondary={`Avg: ${Math.round(size.avg_length)} chars`}
                        />
                        <Chip label={formatNumber(size.count)} size="small" />
                      </ListItem>
                    ))}
                  </List>

                  <Typography variant="subtitle1" gutterBottom>Processing Methods</Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Method</TableCell>
                          <TableCell>Count</TableCell>
                          <TableCell>Quality</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {chunkAnalytics.processingMethods.map((method, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Chip 
                                label={method.processing_method || 'Standard'} 
                                size="small"
                                color={method.processing_method === 'advanced' ? 'primary' : 'default'}
                              />
                            </TableCell>
                            <TableCell>{formatNumber(method.count)}</TableCell>
                            <TableCell>
                              {method.avg_quality ? formatPercentage(method.avg_quality) : 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </AccordionDetails>
            </Accordion>
          )}
        </Grid>

        <Grid item xs={12} md={6}>
          {/* Model Information */}
          {modelInfo && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">🤖 Model & Configuration Info</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  <Typography variant="subtitle1" gutterBottom>System Information</Typography>
                  <List dense sx={{ mb: 2 }}>
                    <ListItem>
                      <ListItemText
                        primary="Database Version"
                        secondary={modelInfo.systemInfo.databaseVersion.split(' ')[0]}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="pgvector Version"
                        secondary={modelInfo.systemInfo.pgvectorVersion}
                      />
                    </ListItem>
                  </List>

                  <Typography variant="subtitle1" gutterBottom>Configuration Usage</Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Feature</TableCell>
                          <TableCell>Usage</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {modelInfo.configurationUsage.slice(0, 5).map((config, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Box>
                                <Chip 
                                  label={`HC: ${config.hierarchical_chunking === 'true' ? 'ON' : 'OFF'}`} 
                                  size="small" 
                                  sx={{ mr: 0.5, mb: 0.5 }}
                                  color={config.hierarchical_chunking === 'true' ? 'primary' : 'default'}
                                />
                                <Chip 
                                  label={`MSE: ${config.multi_scale_embeddings === 'true' ? 'ON' : 'OFF'}`} 
                                  size="small" 
                                  sx={{ mr: 0.5, mb: 0.5 }}
                                  color={config.multi_scale_embeddings === 'true' ? 'primary' : 'default'}
                                />
                                <Chip 
                                  label={`AR: ${config.advanced_retrieval === 'true' ? 'ON' : 'OFF'}`} 
                                  size="small" 
                                  sx={{ mr: 0.5, mb: 0.5 }}
                                  color={config.advanced_retrieval === 'true' ? 'primary' : 'default'}
                                />
                              </Box>
                            </TableCell>
                            <TableCell>{formatNumber(config.usage_count)} jobs</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </AccordionDetails>
            </Accordion>
          )}
        </Grid>

        <Grid item xs={12} md={6}>
          {/* Quality Metrics */}
          {qualityMetrics && (
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">⭐ Quality Metrics</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  <Typography variant="subtitle1" gutterBottom>Overall Quality Scores</Typography>
                  <TableContainer component={Paper} sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell>Count</TableCell>
                          <TableCell>Average</TableCell>
                          <TableCell>Range</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {qualityMetrics.overallQuality.map((quality, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Chip 
                                label={quality.type} 
                                size="small"
                                color={quality.type === 'chunks' ? 'primary' : 'secondary'}
                              />
                            </TableCell>
                            <TableCell>{formatNumber(quality.total_count)}</TableCell>
                            <TableCell>
                              <Box display="flex" alignItems="center">
                                <LinearProgress
                                  variant="determinate"
                                  value={quality.avg_score * 100}
                                  sx={{ width: 60, mr: 1 }}
                                />
                                {formatPercentage(quality.avg_score)}
                              </Box>
                            </TableCell>
                            <TableCell>
                              {formatPercentage(quality.min_score)} - {formatPercentage(quality.max_score)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {qualityMetrics.qualityTrends.length > 0 && (
                    <>
                      <Typography variant="subtitle1" gutterBottom>Recent Quality Trends</Typography>
                      <List dense>
                        {qualityMetrics.qualityTrends.slice(0, 7).map((trend, index) => (
                          <ListItem key={index}>
                            <ListItemText
                              primary={new Date(trend.date).toLocaleDateString()}
                              secondary={`${formatNumber(trend.count)} chunks processed`}
                            />
                            <Box display="flex" alignItems="center">
                              <LinearProgress
                                variant="determinate"
                                value={trend.avg_quality * 100}
                                sx={{ width: 60, mr: 1 }}
                              />
                              {formatPercentage(trend.avg_quality)}
                            </Box>
                          </ListItem>
                        ))}
                      </List>
                    </>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          )}
        </Grid>
      </Grid>

      {/* Last Updated */}
      {overview && (
        <Box mt={3} textAlign="center">
          <Typography variant="caption" color="text.secondary">
            Last updated: {new Date(overview.lastUpdated).toLocaleString()}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default RAGDataAnalytics;
