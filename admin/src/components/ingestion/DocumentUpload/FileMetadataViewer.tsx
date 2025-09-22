/**
 * File Metadata Viewer Component
 * Phase 2, Day 7: Advanced metadata extraction and display
 * Comprehensive file analysis with detailed information extraction
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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Alert,
  AlertTitle,
  Tooltip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  Info as InfoIcon,
  Security as SecurityIcon,
  Assessment as AnalysisIcon,
  Image as ImageIcon,
  TableChart as TableIcon,
  Link as LinkIcon,
  Language as LanguageIcon,
  Schedule as TimeIcon,
  Storage as SizeIcon,
  Person as AuthorIcon,
  Title as TitleIcon,
  Description as ContentIcon,
  Visibility as PreviewIcon,
  GetApp as DownloadIcon,
  Share as ShareIcon,
  Edit as EditIcon,
  FileCopy as CopyIcon,
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Speed as QualityIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { FileUpload, FileMetadata } from '../../../types/ingestion';

interface FileMetadataViewerProps {
  file: FileUpload;
  onClose?: () => void;
  onEdit?: (file: FileUpload) => void;
  onDownload?: (file: FileUpload) => void;
  onShare?: (file: FileUpload) => void;
  showActions?: boolean;
  compact?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ paddingTop: 16 }}>
    {value === index && children}
  </div>
);

// Enhanced metadata extraction service
class MetadataExtractionService {
  static async extractAdvancedMetadata(file: FileUpload): Promise<any> {
    // Simulate advanced metadata extraction
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const baseMetadata = file.metadata;
    
    // Simulate content analysis
    const contentAnalysis = {
      readabilityScore: Math.random() * 100,
      complexityLevel: ['Simple', 'Moderate', 'Complex'][Math.floor(Math.random() * 3)],
      keywordDensity: Math.random() * 10,
      sentimentScore: (Math.random() - 0.5) * 2, // -1 to 1
      topicCategories: ['Business', 'Technical', 'Legal', 'Financial'].slice(0, Math.floor(Math.random() * 3) + 1),
      estimatedReadingTime: Math.floor(Math.random() * 30) + 5, // 5-35 minutes
    };

    // Simulate structure analysis
    const structureAnalysis = {
      hasTableOfContents: Math.random() > 0.5,
      headingLevels: Math.floor(Math.random() * 6) + 1,
      paragraphCount: Math.floor(Math.random() * 100) + 10,
      listCount: Math.floor(Math.random() * 20),
      footnoteCount: Math.floor(Math.random() * 15),
      crossReferences: Math.floor(Math.random() * 10),
    };

    // Simulate quality metrics
    const qualityMetrics = {
      overallScore: Math.random() * 100,
      textQuality: Math.random() * 100,
      structureQuality: Math.random() * 100,
      metadataCompleteness: Math.random() * 100,
      processingRecommendation: ['Excellent', 'Good', 'Needs Review'][Math.floor(Math.random() * 3)],
    };

    // Simulate extracted entities
    const extractedEntities = {
      people: ['John Smith', 'Jane Doe', 'Michael Johnson'].slice(0, Math.floor(Math.random() * 3)),
      organizations: ['Acme Corp', 'Global Industries', 'Tech Solutions'].slice(0, Math.floor(Math.random() * 3)),
      locations: ['New York', 'London', 'Tokyo'].slice(0, Math.floor(Math.random() * 3)),
      dates: ['2024-01-15', '2024-02-20', '2024-03-10'].slice(0, Math.floor(Math.random() * 3)),
      currencies: ['USD', 'EUR', 'GBP'].slice(0, Math.floor(Math.random() * 2)),
    };

    return {
      ...baseMetadata,
      contentAnalysis,
      structureAnalysis,
      qualityMetrics,
      extractedEntities,
      extractionTimestamp: new Date(),
    };
  }
}

const FileMetadataViewer: React.FC<FileMetadataViewerProps> = ({
  file,
  onClose,
  onEdit,
  onDownload,
  onShare,
  showActions = true,
  compact = false,
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [advancedMetadata, setAdvancedMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load advanced metadata on mount
  useEffect(() => {
    loadAdvancedMetadata();
  }, [file.uploadId]);

  const loadAdvancedMetadata = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const metadata = await MetadataExtractionService.extractAdvancedMetadata(file);
      setAdvancedMetadata(metadata);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract metadata');
    } finally {
      setLoading(false);
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

  // Get file type icon
  const getFileTypeIcon = () => {
    if (file.mimeType.includes('pdf')) return <InfoIcon color="error" />;
    if (file.mimeType.includes('word')) return <InfoIcon color="primary" />;
    if (file.mimeType.includes('text')) return <InfoIcon color="success" />;
    return <InfoIcon />;
  };

  // Get quality color
  const getQualityColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  // Render basic information tab
  const renderBasicInfo = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader
            avatar={getFileTypeIcon()}
            title="File Information"
            subheader="Basic file properties"
          />
          <CardContent>
            <List dense>
              <ListItem>
                <ListItemIcon><TitleIcon /></ListItemIcon>
                <ListItemText
                  primary="Filename"
                  secondary={file.filename}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><ContentIcon /></ListItemIcon>
                <ListItemText
                  primary="Original Name"
                  secondary={file.originalName}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><SizeIcon /></ListItemIcon>
                <ListItemText
                  primary="File Size"
                  secondary={formatFileSize(file.fileSize)}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><InfoIcon /></ListItemIcon>
                <ListItemText
                  primary="MIME Type"
                  secondary={file.mimeType}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><TimeIcon /></ListItemIcon>
                <ListItemText
                  primary="Uploaded"
                  secondary={format(file.uploadedAt, 'PPP pp')}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader
            title="Status Information"
            subheader="Upload and validation status"
          />
          <CardContent>
            <Box mb={2}>
              <Typography variant="subtitle2" gutterBottom>Upload Status</Typography>
              <Chip
                label={file.uploadStatus}
                color={file.uploadStatus === 'completed' ? 'success' : 'error'}
                icon={file.uploadStatus === 'completed' ? <ValidIcon /> : <ErrorIcon />}
              />
            </Box>
            
            <Box mb={2}>
              <Typography variant="subtitle2" gutterBottom>Validation Status</Typography>
              <Chip
                label={file.validationStatus}
                color={
                  file.validationStatus === 'valid' ? 'success' :
                  file.validationStatus === 'warning' ? 'warning' : 'error'
                }
                icon={
                  file.validationStatus === 'valid' ? <ValidIcon /> :
                  file.validationStatus === 'warning' ? <WarningIcon /> : <ErrorIcon />
                }
              />
            </Box>

            {file.validationErrors && file.validationErrors.length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                <AlertTitle>Validation Errors</AlertTitle>
                {file.validationErrors.map((error, index) => (
                  <Typography key={index} variant="body2">• {error}</Typography>
                ))}
              </Alert>
            )}

            {file.validationWarnings && file.validationWarnings.length > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <AlertTitle>Validation Warnings</AlertTitle>
                {file.validationWarnings.map((warning, index) => (
                  <Typography key={index} variant="body2">• {warning}</Typography>
                ))}
              </Alert>
            )}
          </CardContent>
        </Card>
      </Grid>

      {file.metadata && (
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Document Metadata"
              subheader="Extracted document properties"
            />
            <CardContent>
              <Grid container spacing={2}>
                {file.metadata.title && (
                  <Grid item xs={12} sm={6}>
                    <ListItem>
                      <ListItemIcon><TitleIcon /></ListItemIcon>
                      <ListItemText primary="Title" secondary={file.metadata.title} />
                    </ListItem>
                  </Grid>
                )}
                {file.metadata.author && (
                  <Grid item xs={12} sm={6}>
                    <ListItem>
                      <ListItemIcon><AuthorIcon /></ListItemIcon>
                      <ListItemText primary="Author" secondary={file.metadata.author} />
                    </ListItem>
                  </Grid>
                )}
                {file.metadata.totalPages && (
                  <Grid item xs={12} sm={6}>
                    <ListItem>
                      <ListItemIcon><ContentIcon /></ListItemIcon>
                      <ListItemText primary="Pages" secondary={file.metadata.totalPages} />
                    </ListItem>
                  </Grid>
                )}
                {file.metadata.wordCount && (
                  <Grid item xs={12} sm={6}>
                    <ListItem>
                      <ListItemIcon><ContentIcon /></ListItemIcon>
                      <ListItemText primary="Words" secondary={file.metadata.wordCount.toLocaleString()} />
                    </ListItem>
                  </Grid>
                )}
                {file.metadata.language && (
                  <Grid item xs={12} sm={6}>
                    <ListItem>
                      <ListItemIcon><LanguageIcon /></ListItemIcon>
                      <ListItemText primary="Language" secondary={file.metadata.language} />
                    </ListItem>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      )}
    </Grid>
  );

  // Render content analysis tab
  const renderContentAnalysis = () => {
    if (!advancedMetadata?.contentAnalysis) return null;

    const { contentAnalysis } = advancedMetadata;

    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Content Metrics" />
            <CardContent>
              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>Readability Score</Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <LinearProgress
                    variant="determinate"
                    value={contentAnalysis.readabilityScore}
                    sx={{ flexGrow: 1, height: 8 }}
                  />
                  <Typography variant="body2">
                    {Math.round(contentAnalysis.readabilityScore)}%
                  </Typography>
                </Box>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>Complexity Level</Typography>
                <Chip
                  label={contentAnalysis.complexityLevel}
                  color={
                    contentAnalysis.complexityLevel === 'Simple' ? 'success' :
                    contentAnalysis.complexityLevel === 'Moderate' ? 'warning' : 'error'
                  }
                />
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>Estimated Reading Time</Typography>
                <Typography variant="body2">
                  {contentAnalysis.estimatedReadingTime} minutes
                </Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>Keyword Density</Typography>
                <Typography variant="body2">
                  {contentAnalysis.keywordDensity.toFixed(2)}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Content Categories" />
            <CardContent>
              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>Topic Categories</Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {contentAnalysis.topicCategories.map((category: string, index: number) => (
                    <Chip key={index} label={category} variant="outlined" />
                  ))}
                </Box>
              </Box>

              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>Sentiment Score</Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <LinearProgress
                    variant="determinate"
                    value={(contentAnalysis.sentimentScore + 1) * 50}
                    color={contentAnalysis.sentimentScore > 0 ? 'success' : 'error'}
                    sx={{ flexGrow: 1, height: 8 }}
                  />
                  <Typography variant="body2">
                    {contentAnalysis.sentimentScore > 0 ? 'Positive' : 'Negative'}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Render structure analysis tab
  const renderStructureAnalysis = () => {
    if (!advancedMetadata?.structureAnalysis) return null;

    const { structureAnalysis } = advancedMetadata;

    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Document Structure" />
            <CardContent>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Table of Contents"
                    secondary={structureAnalysis.hasTableOfContents ? 'Present' : 'Not found'}
                  />
                  <Chip
                    size="small"
                    label={structureAnalysis.hasTableOfContents ? 'Yes' : 'No'}
                    color={structureAnalysis.hasTableOfContents ? 'success' : 'default'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Heading Levels"
                    secondary={`${structureAnalysis.headingLevels} levels detected`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Paragraphs"
                    secondary={`${structureAnalysis.paragraphCount} paragraphs`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Lists"
                    secondary={`${structureAnalysis.listCount} lists found`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="References & Links" />
            <CardContent>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Footnotes"
                    secondary={`${structureAnalysis.footnoteCount} footnotes`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Cross References"
                    secondary={`${structureAnalysis.crossReferences} internal references`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Render quality metrics tab
  const renderQualityMetrics = () => {
    if (!advancedMetadata?.qualityMetrics) return null;

    const { qualityMetrics } = advancedMetadata;

    return (
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardHeader
              title="Quality Assessment"
              subheader="Overall document quality analysis"
            />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color={`${getQualityColor(qualityMetrics.overallScore)}.main`}>
                      {Math.round(qualityMetrics.overallScore)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Overall Score
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color={`${getQualityColor(qualityMetrics.textQuality)}.main`}>
                      {Math.round(qualityMetrics.textQuality)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Text Quality
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color={`${getQualityColor(qualityMetrics.structureQuality)}.main`}>
                      {Math.round(qualityMetrics.structureQuality)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Structure Quality
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color={`${getQualityColor(qualityMetrics.metadataCompleteness)}.main`}>
                      {Math.round(qualityMetrics.metadataCompleteness)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Metadata Complete
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              <Box mt={3}>
                <Typography variant="subtitle2" gutterBottom>Processing Recommendation</Typography>
                <Chip
                  label={qualityMetrics.processingRecommendation}
                  color={
                    qualityMetrics.processingRecommendation === 'Excellent' ? 'success' :
                    qualityMetrics.processingRecommendation === 'Good' ? 'warning' : 'error'
                  }
                  icon={<QualityIcon />}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Render extracted entities tab
  const renderExtractedEntities = () => {
    if (!advancedMetadata?.extractedEntities) return null;

    const { extractedEntities } = advancedMetadata;

    return (
      <Grid container spacing={3}>
        {Object.entries(extractedEntities).map(([entityType, entities]) => (
          entities.length > 0 && (
            <Grid item xs={12} sm={6} md={4} key={entityType}>
              <Card>
                <CardHeader
                  title={entityType.charAt(0).toUpperCase() + entityType.slice(1)}
                  subheader={`${entities.length} found`}
                />
                <CardContent>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {entities.map((entity: string, index: number) => (
                      <Chip key={index} label={entity} variant="outlined" size="small" />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )
        ))}
      </Grid>
    );
  };

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  if (compact) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {file.originalName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {formatFileSize(file.fileSize)} • {format(file.uploadedAt, 'MMM dd, yyyy')}
          </Typography>
          <Box mt={1}>
            <Chip
              label={file.uploadStatus}
              color={file.uploadStatus === 'completed' ? 'success' : 'error'}
              size="small"
            />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {/* Header with actions */}
      {showActions && (
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5">
            File Metadata: {file.originalName}
          </Typography>
          <Box display="flex" gap={1}>
            {onDownload && (
              <Button
                startIcon={<DownloadIcon />}
                onClick={() => onDownload(file)}
              >
                Download
              </Button>
            )}
            {onShare && (
              <Button
                startIcon={<ShareIcon />}
                onClick={() => onShare(file)}
              >
                Share
              </Button>
            )}
            {onEdit && (
              <Button
                startIcon={<EditIcon />}
                onClick={() => onEdit(file)}
              >
                Edit
              </Button>
            )}
            {onClose && (
              <Button onClick={onClose}>
                Close
              </Button>
            )}
          </Box>
        </Box>
      )}

      {/* Loading state */}
      {loading && (
        <Box display="flex" justifyContent="center" alignItems="center" py={4}>
          <CircularProgress />
          <Typography variant="body2" sx={{ ml: 2 }}>
            Extracting advanced metadata...
          </Typography>
        </Box>
      )}

      {/* Error state */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Metadata Extraction Failed</AlertTitle>
          {error}
        </Alert>
      )}

      {/* Content tabs */}
      {!loading && !error && (
        <Paper>
          <Tabs value={currentTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
            <Tab label="Basic Info" />
            <Tab label="Content Analysis" disabled={!advancedMetadata} />
            <Tab label="Structure" disabled={!advancedMetadata} />
            <Tab label="Quality Metrics" disabled={!advancedMetadata} />
            <Tab label="Extracted Entities" disabled={!advancedMetadata} />
          </Tabs>

          <TabPanel value={currentTab} index={0}>
            {renderBasicInfo()}
          </TabPanel>

          <TabPanel value={currentTab} index={1}>
            {renderContentAnalysis()}
          </TabPanel>

          <TabPanel value={currentTab} index={2}>
            {renderStructureAnalysis()}
          </TabPanel>

          <TabPanel value={currentTab} index={3}>
            {renderQualityMetrics()}
          </TabPanel>

          <TabPanel value={currentTab} index={4}>
            {renderExtractedEntities()}
          </TabPanel>
        </Paper>
      )}
    </Box>
  );
};

export default FileMetadataViewer;
