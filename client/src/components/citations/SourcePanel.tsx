/**
 * Source Panel Component
 * Displays comprehensive source information and citations
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Button,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Article as ArticleIcon,
  TableChart as TableIcon,
  List as ListIcon,
  Psychology as ProcedureIcon,
  QuestionAnswer as DefinitionIcon,
  Compare as CompareIcon,
  Star as StarIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import { Source, Citation } from '../../types/chat';
import { useTheme } from '../../contexts/ThemeContext';
import { contentTypeColors } from '../../theme';

interface SourcePanelProps {
  sources: Source[];
  citations: Citation[];
  showRelevanceScores?: boolean;
  showContentTypes?: boolean;
  compact?: boolean;
  maxSources?: number;
  onSourceClick?: (source: Source) => void;
}

const SourceContainer = styled(motion.div)<{ $compact?: boolean }>`
  margin: ${props => props.$compact ? '8px 0' : '16px 0'};
  
  .source-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    
    .source-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }
    
    .source-count {
      font-size: 0.875rem;
      opacity: 0.7;
    }
  }
  
  .sources-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
    
    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }
  
  .sources-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
`;

const SourceCard = styled(motion.div)<{ $isDark: boolean; $compact?: boolean }>`
  .MuiCard-root {
    border-radius: 12px;
    border: 1px solid ${props => props.$isDark ? '#404040' : '#e0e0e0'};
    background: ${props => props.$isDark ? '#2d2d2d' : '#ffffff'};
    transition: all 0.2s ease;
    cursor: pointer;
    
    &:hover {
      border-color: ${props => props.$isDark ? '#666666' : '#1976d2'};
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }
  }
  
  .source-content {
    padding: ${props => props.$compact ? '12px' : '16px'} !important;
    
    .source-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 8px;
      
      .source-info {
        flex: 1;
        
        .source-title {
          font-weight: 600;
          font-size: ${props => props.$compact ? '0.875rem' : '1rem'};
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .source-details {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          font-size: 0.75rem;
          opacity: 0.8;
          
          .detail-item {
            display: flex;
            align-items: center;
            gap: 4px;
          }
        }
      }
      
      .source-actions {
        display: flex;
        gap: 4px;
      }
    }
    
    .source-metrics {
      margin: 12px 0;
      
      .metric-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
        font-size: 0.75rem;
        
        .metric-label {
          opacity: 0.8;
        }
        
        .metric-value {
          font-weight: 500;
        }
      }
      
      .relevance-bar {
        margin-top: 8px;
        
        .MuiLinearProgress-root {
          border-radius: 4px;
          height: 4px;
        }
      }
    }
    
    .source-citations {
      margin-top: 12px;
      
      .citations-header {
        font-size: 0.75rem;
        font-weight: 500;
        margin-bottom: 6px;
        opacity: 0.8;
      }
      
      .citations-list {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
    }
  }
`;

const ContentTypeIcon = ({ type }: { type: string }) => {
  const iconProps = { fontSize: 'small' as const };
  
  switch (type) {
    case 'table':
      return <TableIcon {...iconProps} />;
    case 'list':
      return <ListIcon {...iconProps} />;
    case 'procedure':
      return <ProcedureIcon {...iconProps} />;
    case 'definition':
      return <DefinitionIcon {...iconProps} />;
    case 'comparison':
      return <CompareIcon {...iconProps} />;
    default:
      return <ArticleIcon {...iconProps} />;
  }
};

const RelevanceBar: React.FC<{ score: number; isDark: boolean }> = ({ score, isDark }) => {
  const getColor = (score: number): string => {
    if (score >= 0.8) return '#4caf50';
    if (score >= 0.6) return '#2196f3';
    if (score >= 0.4) return '#ff9800';
    return '#f44336';
  };

  return (
    <Box className="relevance-bar">
      <LinearProgress
        variant="determinate"
        value={score * 100}
        sx={{
          '& .MuiLinearProgress-bar': {
            backgroundColor: getColor(score),
          },
          backgroundColor: isDark ? '#404040' : '#e0e0e0',
        }}
      />
    </Box>
  );
};

export const SourcePanel: React.FC<SourcePanelProps> = ({
  sources,
  citations,
  showRelevanceScores = true,
  showContentTypes = true,
  compact = false,
  maxSources = 10,
  onSourceClick,
}) => {
  const { uiTheme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [copiedSource, setCopiedSource] = useState<string | null>(null);

  const isDark = uiTheme.mode === 'dark';
  const displaySources = expanded ? sources : sources.slice(0, maxSources);
  const hasMoreSources = sources.length > maxSources;

  const handleCopySource = async (source: Source) => {
    try {
      const sourceText = `${source.title}${source.page ? `, p.${source.page}` : ''}${source.section ? `, ${source.section}` : ''}`;
      await navigator.clipboard.writeText(sourceText);
      setCopiedSource(source.chunk_id || source.title);
      setTimeout(() => setCopiedSource(null), 2000);
    } catch (error) {
      console.error('Failed to copy source:', error);
    }
  };

  const getSourceCitations = (source: Source): Citation[] => {
    return citations.filter(citation => 
      citation.source === source.title || citation.chunk_id === source.chunk_id
    );
  };

  const getContentTypeColor = (type: string): string => {
    return contentTypeColors[type as keyof typeof contentTypeColors] || contentTypeColors.text;
  };

  if (sources.length === 0) {
    return null;
  }

  return (
    <SourceContainer
      $compact={compact}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="source-header">
        <div className="source-title">
          <ArticleIcon />
          <Typography variant={compact ? 'subtitle2' : 'h6'}>
            Sources
          </Typography>
          <span className="source-count">
            ({sources.length} {sources.length === 1 ? 'source' : 'sources'})
          </span>
        </div>
        
        {hasMoreSources && (
          <Button
            size="small"
            endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show Less' : `Show All (${sources.length})`}
          </Button>
        )}
      </div>

      <div className={compact ? 'sources-list' : 'sources-grid'}>
        <AnimatePresence>
          {displaySources.map((source, index) => {
            const sourceCitations = getSourceCitations(source);
            const relevanceScore = source.relevance_score || 0;
            
            return (
              <SourceCard
                key={source.chunk_id || index}
                $isDark={isDark}
                $compact={compact}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card onClick={() => onSourceClick?.(source)}>
                  <CardContent className="source-content">
                    <div className="source-header">
                      <div className="source-info">
                        <div className="source-title">
                          {showContentTypes && source.content_type && (
                            <ContentTypeIcon type={source.content_type} />
                          )}
                          <Typography
                            variant={compact ? 'body2' : 'subtitle1'}
                            component="div"
                          >
                            {source.title}
                          </Typography>
                          {showRelevanceScores && relevanceScore > 0.8 && (
                            <Tooltip title="High relevance">
                              <StarIcon fontSize="small" color="warning" />
                            </Tooltip>
                          )}
                        </div>
                        
                        <div className="source-details">
                          {source.page && (
                            <div className="detail-item">
                              <span>Page {source.page}</span>
                            </div>
                          )}
                          {source.section && (
                            <div className="detail-item">
                              <span>{source.section}</span>
                            </div>
                          )}
                          {showContentTypes && source.content_type && (
                            <Chip
                              label={source.content_type}
                              size="small"
                              variant="outlined"
                              sx={{
                                fontSize: '0.6rem',
                                height: '16px',
                                borderColor: getContentTypeColor(source.content_type),
                                color: getContentTypeColor(source.content_type),
                              }}
                            />
                          )}
                        </div>
                      </div>
                      
                      <div className="source-actions">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopySource(source);
                          }}
                          disabled={copiedSource === (source.chunk_id || source.title)}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            // In a real implementation, this would open the source document
                            console.log('Open source:', source);
                          }}
                        >
                          <OpenIcon fontSize="small" />
                        </IconButton>
                      </div>
                    </div>

                    {showRelevanceScores && relevanceScore > 0 && (
                      <div className="source-metrics">
                        <div className="metric-row">
                          <span className="metric-label">Relevance:</span>
                          <span className="metric-value">
                            {(relevanceScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        <RelevanceBar score={relevanceScore} isDark={isDark} />
                      </div>
                    )}

                    {sourceCitations.length > 0 && (
                      <div className="source-citations">
                        <div className="citations-header">
                          Referenced {sourceCitations.length} time{sourceCitations.length !== 1 ? 's' : ''}:
                        </div>
                        <div className="citations-list">
                          {sourceCitations.map((citation, citIndex) => (
                            <Chip
                              key={citIndex}
                              label={`[${citations.indexOf(citation) + 1}]`}
                              size="small"
                              variant="filled"
                              color="primary"
                              sx={{ fontSize: '0.6rem', height: '16px' }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </SourceCard>
            );
          })}
        </AnimatePresence>
      </div>

      {copiedSource && (
        <Typography
          variant="caption"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            background: isDark ? '#333' : '#fff',
            padding: '4px 8px',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            zIndex: 1000,
          }}
        >
          Source copied to clipboard!
        </Typography>
      )}
    </SourceContainer>
  );
};

export default SourcePanel;
