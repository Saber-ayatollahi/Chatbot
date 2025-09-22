/**
 * Enhanced File Preview Component
 * Phase 2, Day 7 Afternoon: Advanced file preview with content extraction
 * Multi-format preview with text extraction, annotations, and analysis
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
  Button,
  IconButton,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Toolbar,
  Divider,
  Chip,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Slider,
  FormControlLabel,
  Switch,
  CircularProgress,
  LinearProgress,
  Tooltip,
  Badge,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  ZoomOutMap as FitIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as ExitFullscreenIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Highlight as HighlightIcon,
  Comment as CommentIcon,
  Bookmark as BookmarkIcon,
  ExpandMore as ExpandIcon,
  Close as CloseIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Settings as SettingsIcon,
  Visibility as ViewIcon,
  TextFields as TextIcon,
  Image as ImageIcon,
  TableChart as TableIcon,
  Link as LinkIcon,
  Assessment as AnalysisIcon,
  AutoAwesome as AIIcon,
  Translate as TranslateIcon,
  VolumeUp as SpeechIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { FileUpload } from '../../../types/ingestion';

interface PreviewContent {
  type: 'text' | 'image' | 'pdf' | 'document';
  content: string;
  pages?: PreviewPage[];
  metadata: ContentMetadata;
  extractedData: ExtractedData;
  analysis: ContentAnalysis;
}

interface PreviewPage {
  pageNumber: number;
  content: string;
  images: ExtractedImage[];
  tables: ExtractedTable[];
  annotations: Annotation[];
}

interface ExtractedImage {
  id: string;
  url: string;
  caption?: string;
  alt?: string;
  position: { x: number; y: number; width: number; height: number };
}

interface ExtractedTable {
  id: string;
  headers: string[];
  rows: string[][];
  caption?: string;
  position: { x: number; y: number; width: number; height: number };
}

interface Annotation {
  id: string;
  type: 'highlight' | 'comment' | 'bookmark';
  content: string;
  position: { x: number; y: number; width: number; height: number };
  author: string;
  createdAt: Date;
}

interface ContentMetadata {
  wordCount: number;
  characterCount: number;
  pageCount: number;
  language: string;
  readingTime: number;
  complexity: 'simple' | 'moderate' | 'complex';
}

interface ExtractedData {
  headings: string[];
  links: string[];
  entities: {
    people: string[];
    organizations: string[];
    locations: string[];
    dates: string[];
  };
  keywords: string[];
  summary: string;
}

interface ContentAnalysis {
  sentiment: number; // -1 to 1
  topics: string[];
  readabilityScore: number;
  qualityScore: number;
  aiInsights: string[];
}

interface EnhancedFilePreviewProps {
  file: FileUpload;
  open: boolean;
  onClose: () => void;
  onAction?: (action: string, data?: any) => void;
  enableAnnotations?: boolean;
  enableAIAnalysis?: boolean;
  enableTextToSpeech?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ height: '100%' }}>
    {value === index && children}
  </div>
);

// Mock content extraction service
class ContentExtractionService {
  static async extractContent(file: FileUpload): Promise<PreviewContent> {
    // Simulate content extraction
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockContent: PreviewContent = {
      type: file.mimeType.includes('pdf') ? 'pdf' : 'text',
      content: `This is the extracted content from ${file.originalName}. 
      
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
      
      ## Key Points
      - Important information extracted from the document
      - Structured data and metadata
      - Analysis and insights
      
      ### Technical Details
      The document contains technical specifications and detailed information about the implementation process. This includes code examples, configuration details, and best practices.
      
      ### Conclusion
      The content has been successfully extracted and processed for analysis.`,
      
      pages: Array.from({ length: Math.floor(Math.random() * 10) + 1 }, (_, i) => ({
        pageNumber: i + 1,
        content: `Page ${i + 1} content...`,
        images: [],
        tables: [],
        annotations: [],
      })),
      
      metadata: {
        wordCount: 450 + Math.floor(Math.random() * 1000),
        characterCount: 2800 + Math.floor(Math.random() * 5000),
        pageCount: Math.floor(Math.random() * 10) + 1,
        language: 'en',
        readingTime: Math.floor(Math.random() * 15) + 2,
        complexity: ['simple', 'moderate', 'complex'][Math.floor(Math.random() * 3)] as any,
      },
      
      extractedData: {
        headings: ['Introduction', 'Key Points', 'Technical Details', 'Conclusion'],
        links: ['https://example.com', 'https://docs.example.com'],
        entities: {
          people: ['John Smith', 'Jane Doe'],
          organizations: ['Acme Corp', 'Tech Solutions Inc'],
          locations: ['New York', 'San Francisco'],
          dates: ['2024-01-15', '2024-02-20'],
        },
        keywords: ['implementation', 'analysis', 'processing', 'technical', 'documentation'],
        summary: 'This document provides comprehensive information about the implementation process and technical specifications.',
      },
      
      analysis: {
        sentiment: (Math.random() - 0.5) * 2,
        topics: ['Technology', 'Implementation', 'Documentation'],
        readabilityScore: Math.random() * 100,
        qualityScore: Math.random() * 100,
        aiInsights: [
          'The document is well-structured with clear headings',
          'Technical content is appropriate for the target audience',
          'Contains actionable information and best practices',
        ],
      },
    };

    return mockContent;
  }
}

const EnhancedFilePreview: React.FC<EnhancedFilePreviewProps> = ({
  file,
  open,
  onClose,
  onAction,
  enableAnnotations = true,
  enableAIAnalysis = true,
  enableTextToSpeech = false,
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [previewContent, setPreviewContent] = useState<PreviewContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [settingsMenuAnchor, setSettingsMenuAnchor] = useState<null | HTMLElement>(null);
  const [aiAnalysisExpanded, setAiAnalysisExpanded] = useState(false);

  // Load content when dialog opens
  useEffect(() => {
    if (open && !previewContent) {
      loadContent();
    }
  }, [open, file.uploadId]);

  const loadContent = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const content = await ContentExtractionService.extractContent(file);
      setPreviewContent(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  // Handle zoom
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 25));
  const handleZoomFit = () => setZoom(100);

  // Handle search
  const handleSearch = () => {
    if (!searchQuery || !previewContent) return;
    
    // Mock search results
    const results = Array.from({ length: Math.floor(Math.random() * 5) + 1 }, (_, i) => i + 1);
    setSearchResults(results);
  };

  // Handle page navigation
  const handlePrevPage = () => {
    if (previewContent && currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (previewContent && currentPage < previewContent.metadata.pageCount) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // Render toolbar
  const renderToolbar = () => (
    <Toolbar variant="dense" sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Typography variant="h6" sx={{ flexGrow: 1 }}>
        {file.originalName}
      </Typography>

      {/* Search */}
      <Box display="flex" alignItems="center" gap={1} mr={2}>
        <TextField
          size="small"
          placeholder="Search content..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          sx={{ width: 200 }}
        />
        <IconButton size="small" onClick={handleSearch}>
          <SearchIcon />
        </IconButton>
        {searchResults.length > 0 && (
          <Chip label={`${searchResults.length} results`} size="small" />
        )}
      </Box>

      {/* Page navigation */}
      {previewContent && previewContent.metadata.pageCount > 1 && (
        <Box display="flex" alignItems="center" gap={1} mr={2}>
          <IconButton size="small" onClick={handlePrevPage} disabled={currentPage === 1}>
            <PrevIcon />
          </IconButton>
          <Typography variant="body2">
            {currentPage} / {previewContent.metadata.pageCount}
          </Typography>
          <IconButton
            size="small"
            onClick={handleNextPage}
            disabled={currentPage === previewContent.metadata.pageCount}
          >
            <NextIcon />
          </IconButton>
        </Box>
      )}

      {/* Zoom controls */}
      <Box display="flex" alignItems="center" gap={1} mr={2}>
        <IconButton size="small" onClick={handleZoomOut} disabled={zoom <= 25}>
          <ZoomOutIcon />
        </IconButton>
        <Typography variant="body2" sx={{ minWidth: 50, textAlign: 'center' }}>
          {zoom}%
        </Typography>
        <IconButton size="small" onClick={handleZoomIn} disabled={zoom >= 200}>
          <ZoomInIcon />
        </IconButton>
        <IconButton size="small" onClick={handleZoomFit}>
          <FitIcon />
        </IconButton>
      </Box>

      {/* Action buttons */}
      <Box display="flex" gap={1}>
        <Tooltip title="Fullscreen">
          <IconButton size="small" onClick={() => setFullscreen(!fullscreen)}>
            {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Download">
          <IconButton size="small" onClick={() => onAction?.('download')}>
            <DownloadIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Print">
          <IconButton size="small" onClick={() => onAction?.('print')}>
            <PrintIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Share">
          <IconButton size="small" onClick={() => onAction?.('share')}>
            <ShareIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Settings">
          <IconButton
            size="small"
            onClick={(e) => setSettingsMenuAnchor(e.currentTarget)}
          >
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Toolbar>
  );

  // Render content preview
  const renderContentPreview = () => {
    if (!previewContent) return null;

    return (
      <Box
        sx={{
          height: '100%',
          overflow: 'auto',
          p: 2,
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top left',
        }}
      >
        <Paper sx={{ p: 3, minHeight: '100%' }}>
          <Typography variant="body1" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
            {previewContent.content}
          </Typography>
        </Paper>
      </Box>
    );
  };

  // Render extracted data tab
  const renderExtractedData = () => {
    if (!previewContent) return null;

    const { extractedData } = previewContent;

    return (
      <Box sx={{ p: 2 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Document Structure" />
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>Headings</Typography>
                <List dense>
                  {extractedData.headings.map((heading, index) => (
                    <ListItem key={index}>
                      <ListItemIcon><TextIcon /></ListItemIcon>
                      <ListItemText primary={heading} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Extracted Entities" />
              <CardContent>
                {Object.entries(extractedData.entities).map(([type, entities]) => (
                  entities.length > 0 && (
                    <Box key={type} mb={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </Typography>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {entities.map((entity, index) => (
                          <Chip key={index} label={entity} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  )
                ))}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardHeader title="Keywords & Summary" />
              <CardContent>
                <Box mb={2}>
                  <Typography variant="subtitle2" gutterBottom>Keywords</Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {extractedData.keywords.map((keyword, index) => (
                      <Chip key={index} label={keyword} size="small" />
                    ))}
                  </Box>
                </Box>
                
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Summary</Typography>
                  <Typography variant="body2">{extractedData.summary}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {extractedData.links.length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardHeader title="External Links" />
                <CardContent>
                  <List dense>
                    {extractedData.links.map((link, index) => (
                      <ListItem key={index}>
                        <ListItemIcon><LinkIcon /></ListItemIcon>
                        <ListItemText
                          primary={link}
                          secondary="External reference"
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </CardContent>
            </Grid>
          )}
        </Grid>
      </Box>
    );
  };

  // Render analysis tab
  const renderAnalysis = () => {
    if (!previewContent) return null;

    const { analysis, metadata } = previewContent;

    return (
      <Box sx={{ p: 2 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Content Metrics" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="h4" color="primary">
                      {metadata.wordCount.toLocaleString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Words
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h4" color="secondary">
                      {metadata.readingTime}m
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Reading Time
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h4" color="info.main">
                      {metadata.pageCount}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Pages
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Chip
                      label={metadata.complexity}
                      color={
                        metadata.complexity === 'simple' ? 'success' :
                        metadata.complexity === 'moderate' ? 'warning' : 'error'
                      }
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Quality Scores" />
              <CardContent>
                <Box mb={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Readability Score
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={analysis.readabilityScore}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption">
                    {Math.round(analysis.readabilityScore)}%
                  </Typography>
                </Box>

                <Box mb={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Quality Score
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={analysis.qualityScore}
                    color="secondary"
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption">
                    {Math.round(analysis.qualityScore)}%
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Sentiment
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={(analysis.sentiment + 1) * 50}
                    color={analysis.sentiment > 0 ? 'success' : 'error'}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption">
                    {analysis.sentiment > 0 ? 'Positive' : 'Negative'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card>
              <CardHeader title="Topics" />
              <CardContent>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {analysis.topics.map((topic, index) => (
                    <Chip key={index} label={topic} variant="outlined" />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {enableAIAnalysis && (
            <Grid item xs={12}>
              <Accordion expanded={aiAnalysisExpanded} onChange={() => setAiAnalysisExpanded(!aiAnalysisExpanded)}>
                <AccordionSummary expandIcon={<ExpandIcon />}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <AIIcon />
                    <Typography variant="h6">AI Insights</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <List>
                    {analysis.aiInsights.map((insight, index) => (
                      <ListItem key={index}>
                        <ListItemIcon><AnalysisIcon /></ListItemIcon>
                        <ListItemText primary={insight} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            </Grid>
          )}
        </Grid>
      </Box>
    );
  };

  // Render annotations tab
  const renderAnnotations = () => {
    if (!enableAnnotations) return null;

    return (
      <Box sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Annotations</Typography>
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={showAnnotations}
                  onChange={(e) => setShowAnnotations(e.target.checked)}
                />
              }
              label="Show on preview"
            />
            <Button startIcon={<CommentIcon />} variant="outlined" size="small">
              Add Comment
            </Button>
          </Box>
        </Box>

        {annotations.length === 0 ? (
          <Alert severity="info">
            No annotations yet. Add comments, highlights, or bookmarks to get started.
          </Alert>
        ) : (
          <List>
            {annotations.map((annotation) => (
              <ListItem key={annotation.id}>
                <ListItemIcon>
                  {annotation.type === 'highlight' && <HighlightIcon />}
                  {annotation.type === 'comment' && <CommentIcon />}
                  {annotation.type === 'bookmark' && <BookmarkIcon />}
                </ListItemIcon>
                <ListItemText
                  primary={annotation.content}
                  secondary={`${annotation.author} • ${format(annotation.createdAt, 'MMM dd, yyyy HH:mm')}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    );
  };

  // Settings menu
  const renderSettingsMenu = () => (
    <Menu
      anchorEl={settingsMenuAnchor}
      open={Boolean(settingsMenuAnchor)}
      onClose={() => setSettingsMenuAnchor(null)}
    >
      <MenuItem onClick={() => setShowAnnotations(!showAnnotations)}>
        <ListItemIcon><CommentIcon /></ListItemIcon>
        <ListItemText primary={`${showAnnotations ? 'Hide' : 'Show'} Annotations`} />
      </MenuItem>
      
      {enableTextToSpeech && (
        <MenuItem onClick={() => onAction?.('text_to_speech')}>
          <ListItemIcon><SpeechIcon /></ListItemIcon>
          <ListItemText primary="Text to Speech" />
        </MenuItem>
      )}
      
      <MenuItem onClick={() => onAction?.('translate')}>
        <ListItemIcon><TranslateIcon /></ListItemIcon>
        <ListItemText primary="Translate" />
      </MenuItem>
      
      <MenuItem onClick={() => onAction?.('export_annotations')}>
        <ListItemIcon><DownloadIcon /></ListItemIcon>
        <ListItemText primary="Export Annotations" />
      </MenuItem>
    </Menu>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      fullScreen={fullscreen}
      PaperProps={{
        sx: {
          width: fullscreen ? '100%' : '90vw',
          height: fullscreen ? '100%' : '90vh',
          maxWidth: 'none',
          maxHeight: 'none',
        }
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        {renderToolbar()}
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Extracting content...
            </Typography>
          </Box>
        )}

        {error && (
          <Box p={3}>
            <Alert severity="error">
              <AlertTitle>Content Extraction Failed</AlertTitle>
              {error}
            </Alert>
          </Box>
        )}

        {previewContent && !loading && !error && (
          <>
            <Tabs value={currentTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab icon={<ViewIcon />} label="Preview" />
              <Tab icon={<TextIcon />} label="Extracted Data" />
              <Tab icon={<AnalysisIcon />} label="Analysis" />
              {enableAnnotations && <Tab icon={<CommentIcon />} label="Annotations" />}
            </Tabs>

            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
              <TabPanel value={currentTab} index={0}>
                {renderContentPreview()}
              </TabPanel>

              <TabPanel value={currentTab} index={1}>
                {renderExtractedData()}
              </TabPanel>

              <TabPanel value={currentTab} index={2}>
                {renderAnalysis()}
              </TabPanel>

              {enableAnnotations && (
                <TabPanel value={currentTab} index={3}>
                  {renderAnnotations()}
                </TabPanel>
              )}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      {renderSettingsMenu()}
    </Dialog>
  );
};

export default EnhancedFilePreview;
