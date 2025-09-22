/**
 * Enhanced Message Bubble Component
 * Advanced message display with RAG features, citations, and interactive elements
 */

import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Alert,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ContentCopy as CopyIcon,
  Share as ShareIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Refresh as RefreshIcon,
  AutoAwesome as AIIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { Message } from '../../types/chat';
import { useTheme } from '../../contexts/ThemeContext';
import { useChatSettings } from '../../contexts/ChatSettingsContext';
import CitationBadge from '../citations/CitationBadge';
import SourcePanel from '../citations/SourcePanel';
import ConfidenceIndicator from '../indicators/ConfidenceIndicator';
import ProcessingIndicator from '../indicators/ProcessingIndicator';
import { animationVariants } from '../../theme';

interface EnhancedMessageBubbleProps {
  message: Message;
  isLatest?: boolean;
  showTimestamp?: boolean;
  onCopy?: (content: string) => void;
  onShare?: (message: Message) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
  onRegenerateResponse?: (messageId: string) => void;
  onCitationClick?: (citation: any) => void;
}

const MessageContainer = styled(motion.div)<{ 
  $isUser: boolean; 
  $isDark: boolean;
  $isLatest?: boolean;
}>`
  display: flex;
  flex-direction: column;
  margin: 16px 0;
  align-items: ${props => props.$isUser ? 'flex-end' : 'flex-start'};
  
  .message-wrapper {
    max-width: 85%;
    min-width: 200px;
    position: relative;
    
    @media (max-width: 768px) {
      max-width: 95%;
      min-width: 150px;
    }
  }
  
  .message-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    padding: 0 4px;
    
    .sender-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      opacity: 0.8;
      
      .sender-icon {
        font-size: 1rem;
      }
      
      .sender-name {
        font-weight: 500;
      }
    }
    
    .message-timestamp {
      font-size: 0.7rem;
      opacity: 0.6;
    }
  }
  
  .message-bubble {
    background: ${props => 
      props.$isUser 
        ? props.$isDark ? '#1976d2' : '#2196f3'
        : props.$isDark ? '#2d2d2d' : '#f5f5f5'
    };
    color: ${props => 
      props.$isUser 
        ? '#ffffff'
        : props.$isDark ? '#ffffff' : '#000000'
    };
    border-radius: 18px;
    padding: 12px 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    position: relative;
    word-wrap: break-word;
    line-height: 1.4;
    
    ${props => props.$isLatest && `
      box-shadow: 0 4px 16px rgba(33, 150, 243, 0.2);
      border: 1px solid rgba(33, 150, 243, 0.3);
    `}
    
    .message-content {
      .markdown-content {
        p {
          margin: 0 0 8px 0;
          
          &:last-child {
            margin-bottom: 0;
          }
        }
        
        ul, ol {
          margin: 8px 0;
          padding-left: 20px;
        }
        
        li {
          margin-bottom: 4px;
        }
        
        code {
          background: ${props => props.$isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
          padding: 2px 4px;
          border-radius: 4px;
          font-size: 0.875em;
        }
        
        pre {
          background: ${props => props.$isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
          padding: 12px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 8px 0;
          
          code {
            background: none;
            padding: 0;
          }
        }
        
        strong {
          font-weight: 600;
        }
        
        em {
          font-style: italic;
        }
      }
      
      .inline-citations {
        display: inline;
        
        .citation-badge {
          margin: 0 2px;
        }
      }
    }
  }
  
  .message-metadata {
    margin-top: 8px;
    padding: 0 4px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .message-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    padding: 0 4px;
    opacity: 0.7;
    transition: opacity 0.2s ease;
    
    &:hover {
      opacity: 1;
    }
    
    .action-button {
      padding: 4px;
      
      .MuiIconButton-root {
        width: 28px;
        height: 28px;
      }
    }
    
    .feedback-buttons {
      display: flex;
      gap: 2px;
      margin-left: auto;
    }
  }
  
  .expandable-content {
    margin-top: 12px;
  }
  
  .warning-section {
    margin-top: 8px;
    
    .MuiAlert-root {
      font-size: 0.75rem;
      padding: 6px 12px;
    }
  }
  
  .suggestions-section {
    margin-top: 8px;
    
    .suggestions-header {
      font-size: 0.75rem;
      font-weight: 500;
      margin-bottom: 6px;
      opacity: 0.8;
    }
    
    .suggestions-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      
      .suggestion-item {
        font-size: 0.75rem;
        padding: 4px 8px;
        background: ${props => props.$isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s ease;
        
        &:hover {
          background: ${props => props.$isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
        }
      }
    }
  }
`;

const MetadataRow = styled.div<{ $isDark: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  
  .metadata-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }
  
  .metadata-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
`;

export const EnhancedMessageBubble: React.FC<EnhancedMessageBubbleProps> = ({
  message,
  isLatest = false,
  showTimestamp = true,
  onCopy,
  onShare,
  onFeedback,
  onRegenerateResponse,
  onCitationClick,
}) => {
  const { uiTheme } = useTheme();
  const { settings } = useChatSettings();
  const [showSources, setShowSources] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [copied, setCopied] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);

  const isDark = uiTheme.mode === 'dark';
  const isUser = message.sender === 'user';
  const isAssistant = message.sender === 'assistant';
  const hasRAGData = message.useKnowledgeBase && (message.citations?.length || 0) > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.(message.content);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const handleShare = () => {
    onShare?.(message);
  };

  const handleFeedback = (feedback: 'positive' | 'negative') => {
    onFeedback?.(message.id, feedback);
  };

  const handleRegenerate = () => {
    onRegenerateResponse?.(message.id);
  };

  const renderInlineCitations = (content: string) => {
    if (!message.citations || message.citations.length === 0) {
      return <ReactMarkdown className="markdown-content">{content}</ReactMarkdown>;
    }

    // For now, just render the content with citations at the end
    // In a more sophisticated implementation, we would parse and inject citations inline
    return (
      <div>
        <ReactMarkdown className="markdown-content">{content}</ReactMarkdown>
        <div className="inline-citations">
          {message.citations.map((citation, index) => (
            <CitationBadge
              key={index}
              citation={citation}
              index={index}
              format={settings.citationFormat}
              onCitationClick={onCitationClick}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <MessageContainer
      $isUser={isUser}
      $isDark={isDark}
      $isLatest={isLatest}
      ref={messageRef}
      variants={animationVariants.slideUp}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
    >
      <div className="message-wrapper">
        {/* Message Header */}
        <div className="message-header">
          <div className="sender-info">
            {isUser ? (
              <PersonIcon className="sender-icon" />
            ) : (
              <AIIcon className="sender-icon" />
            )}
            <span className="sender-name">
              {isUser ? 'You' : 'Fund Assistant'}
            </span>
          </div>
          {showTimestamp && (
            <span className="message-timestamp">
              {format(message.timestamp, 'HH:mm')}
            </span>
          )}
        </div>

        {/* Message Bubble */}
        <div className="message-bubble">
          <div className="message-content">
            {renderInlineCitations(message.content)}
          </div>

          {/* Error State */}
          {message.isError && (
            <div className="warning-section">
              <Alert severity="error" variant="outlined">
                This message encountered an error
              </Alert>
            </div>
          )}

          {/* Warnings */}
          {message.warnings && message.warnings.length > 0 && (
            <div className="warning-section">
              <Alert severity="warning" variant="outlined">
                {message.warnings[0]}
              </Alert>
            </div>
          )}

          {/* Suggestions */}
          {message.suggestions && message.suggestions.length > 0 && (
            <div className="suggestions-section">
              <div className="suggestions-header">Suggestions:</div>
              <div className="suggestions-list">
                {message.suggestions.map((suggestion, index) => (
                  <div key={index} className="suggestion-item">
                    • {suggestion}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Message Metadata */}
        {isAssistant && (
          <div className="message-metadata">
            {/* Primary Metadata Row */}
            <MetadataRow $isDark={isDark}>
              <div className="metadata-left">
                {settings.showConfidence && message.confidence !== undefined && (
                  <ConfidenceIndicator
                    confidence={message.confidence}
                    confidenceLevel={message.confidenceLevel || 'medium'}
                    compact
                    showBreakdown={settings.showProcessingTime}
                    qualityIndicators={message.qualityIndicators}
                  />
                )}

                {hasRAGData && settings.showSources && (
                  <Chip
                    label={`${message.sources?.length || 0} sources`}
                    size="small"
                    variant="outlined"
                    onClick={() => setShowSources(!showSources)}
                    sx={{ fontSize: '0.7rem', height: '20px' }}
                  />
                )}

                {message.fallbackApplied && (
                  <Chip
                    label="Fallback"
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: '20px' }}
                  />
                )}
              </div>

              <div className="metadata-right">
                {settings.showProcessingTime && message.processingMetadata && (
                  <ProcessingIndicator
                    processingTime={message.processingMetadata.totalTime}
                    processingMetadata={message.processingMetadata}
                    compact
                    showSteps
                  />
                )}

                {hasRAGData && (
                  <Tooltip title="Show detailed metadata">
                    <IconButton
                      size="small"
                      onClick={() => setShowMetadata(!showMetadata)}
                      sx={{ width: '20px', height: '20px' }}
                    >
                      {showMetadata ? (
                        <ExpandLessIcon sx={{ fontSize: '0.9rem' }} />
                      ) : (
                        <ExpandMoreIcon sx={{ fontSize: '0.9rem' }} />
                      )}
                    </IconButton>
                  </Tooltip>
                )}
              </div>
            </MetadataRow>

            {/* Expandable Sources */}
            <AnimatePresence>
              {showSources && message.sources && message.sources.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <SourcePanel
                    sources={message.sources}
                    citations={message.citations || []}
                    compact
                    maxSources={3}
                    showRelevanceScores={settings.showProcessingTime}
                    showContentTypes
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Expandable Metadata */}
            <AnimatePresence>
              {showMetadata && hasRAGData && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="expandable-content"
                >
                  <Box sx={{ 
                    padding: 2, 
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                    borderRadius: 2,
                    fontSize: '0.75rem'
                  }}>
                    <Typography variant="caption" fontWeight="medium" display="block" gutterBottom>
                      Response Metadata
                    </Typography>
                    
                    {message.retrievalMetadata && (
                      <Box mb={1}>
                        <strong>Retrieval:</strong> {message.retrievalMetadata.strategy} strategy, 
                        {message.retrievalMetadata.chunksRetrieved} chunks retrieved
                        {message.retrievalMetadata.retrievalTime && 
                          ` in ${message.retrievalMetadata.retrievalTime}ms`
                        }
                      </Box>
                    )}
                    
                    {message.generationMetadata && (
                      <Box mb={1}>
                        <strong>Generation:</strong> {message.generationMetadata.model}
                        {message.generationMetadata.tokensUsed?.total_tokens && 
                          `, ${message.generationMetadata.tokensUsed.total_tokens} tokens`
                        }
                        {message.generationMetadata.generationTime && 
                          ` in ${message.generationMetadata.generationTime}ms`
                        }
                      </Box>
                    )}
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Message Actions */}
        <div className="message-actions">
          <div className="action-button">
            <Tooltip title={copied ? 'Copied!' : 'Copy message'}>
              <IconButton size="small" onClick={handleCopy} disabled={copied}>
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>

          <div className="action-button">
            <Tooltip title="Share message">
              <IconButton size="small" onClick={handleShare}>
                <ShareIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>

          {isAssistant && (
            <>
              <div className="action-button">
                <Tooltip title="Regenerate response">
                  <IconButton size="small" onClick={handleRegenerate}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </div>

              <div className="feedback-buttons">
                <Tooltip title={message.feedbackSubmitted === 'positive' ? 'You liked this response' : 'Good response'}>
                  <IconButton 
                    size="small" 
                    onClick={() => handleFeedback('positive')}
                    color={message.feedbackSubmitted === 'positive' ? 'success' : 'default'}
                    disabled={!!message.feedbackSubmitted}
                  >
                    <ThumbUpIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={message.feedbackSubmitted === 'negative' ? 'You disliked this response' : 'Poor response'}>
                  <IconButton 
                    size="small" 
                    onClick={() => handleFeedback('negative')}
                    color={message.feedbackSubmitted === 'negative' ? 'error' : 'default'}
                    disabled={!!message.feedbackSubmitted}
                  >
                    <ThumbDownIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {message.feedbackSubmitted && (
                  <Typography variant="caption" sx={{ ml: 1, opacity: 0.7 }}>
                    Feedback submitted
                  </Typography>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </MessageContainer>
  );
};

export default EnhancedMessageBubble;
