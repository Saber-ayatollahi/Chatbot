/**
 * Processing Indicator Component
 * Shows processing time, steps, and performance metrics
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  IconButton,
  Popover,
  Divider,
} from '@mui/material';
import {
  Speed as SpeedIcon,
  AccessTime as TimeIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  Psychology as BrainIcon,
  Article as ArticleIcon,
  AutoAwesome as GenerationIcon,
} from '@mui/icons-material';
import { useTheme } from '../../contexts/ThemeContext';
import { ProcessingMetadata } from '../../types/chat';

interface ProcessingIndicatorProps {
  processingTime: number;
  processingMetadata?: ProcessingMetadata;
  showDetails?: boolean;
  compact?: boolean;
  showSteps?: boolean;
}

const ProcessingContainer = styled(motion.div)<{ $compact?: boolean; $isDark: boolean }>`
  display: flex;
  align-items: center;
  gap: ${props => props.$compact ? '4px' : '6px'};
  padding: ${props => props.$compact ? '2px 6px' : '4px 8px'};
  background: ${props => props.$isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'};
  border-radius: 8px;
  font-size: ${props => props.$compact ? '0.7rem' : '0.75rem'};
  opacity: 0.8;
  transition: all 0.2s ease;
  
  &:hover {
    opacity: 1;
    background: ${props => props.$isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'};
  }
  
  .processing-icon {
    font-size: ${props => props.$compact ? '0.8rem' : '1rem'};
    opacity: 0.7;
  }
  
  .processing-time {
    font-weight: 500;
    white-space: nowrap;
  }
  
  .processing-details {
    margin-left: 4px;
  }
`;

const ProcessingBreakdown = styled(Box)<{ $isDark: boolean }>`
  padding: 16px;
  max-width: 400px;
  background: ${props => props.$isDark ? '#2d2d2d' : '#ffffff'};
  border-radius: 12px;
  
  .breakdown-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    
    .header-icon {
      color: #2196f3;
    }
  }
  
  .performance-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
    
    .metric-item {
      text-align: center;
      padding: 8px;
      background: ${props => props.$isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'};
      border-radius: 8px;
      
      .metric-value {
        font-size: 1.25rem;
        font-weight: 600;
        color: #2196f3;
        display: block;
      }
      
      .metric-label {
        font-size: 0.75rem;
        opacity: 0.8;
        margin-top: 2px;
      }
    }
  }
  
  .processing-timeline {
    .step-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      
      .step-name {
        font-size: 0.875rem;
        font-weight: 500;
      }
      
      .step-time {
        font-size: 0.75rem;
        opacity: 0.7;
      }
    }
    
    .step-details {
      font-size: 0.75rem;
      opacity: 0.8;
      margin-top: 2px;
    }
  }
`;

const getStepIcon = (step: string, success?: boolean) => {
  const iconProps = { fontSize: 'small' as const };
  
  if (success === false) {
    return <ErrorIcon {...iconProps} color="error" />;
  }
  
  if (success === true) {
    return <CheckIcon {...iconProps} color="success" />;
  }
  
  switch (step) {
    case 'rag_generation':
      return <BrainIcon {...iconProps} color="primary" />;
    case 'retrieval':
      return <SearchIcon {...iconProps} color="primary" />;
    case 'prompt_assembly':
      return <ArticleIcon {...iconProps} color="primary" />;
    case 'generation':
      return <GenerationIcon {...iconProps} color="primary" />;
    case 'fallback_strategy':
      return <ErrorIcon {...iconProps} color="warning" />;
    default:
      return <InfoIcon {...iconProps} color="action" />;
  }
};

const formatStepName = (step: string): string => {
  switch (step) {
    case 'rag_generation':
      return 'RAG Generation';
    case 'retrieval':
      return 'Source Retrieval';
    case 'prompt_assembly':
      return 'Prompt Assembly';
    case 'generation':
      return 'Response Generation';
    case 'fallback_strategy':
      return 'Fallback Strategy';
    default:
      return step.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
};

const formatTime = (timeMs: number): string => {
  if (timeMs < 1000) {
    return `${timeMs}ms`;
  } else if (timeMs < 60000) {
    return `${(timeMs / 1000).toFixed(1)}s`;
  } else {
    return `${(timeMs / 60000).toFixed(1)}m`;
  }
};

const getPerformanceLevel = (timeMs: number): { level: string; color: string } => {
  if (timeMs < 1000) {
    return { level: 'Excellent', color: '#4caf50' };
  } else if (timeMs < 3000) {
    return { level: 'Good', color: '#2196f3' };
  } else if (timeMs < 5000) {
    return { level: 'Fair', color: '#ff9800' };
  } else {
    return { level: 'Slow', color: '#f44336' };
  }
};

export const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({
  processingTime,
  processingMetadata,
  showDetails = true,
  compact = false,
  showSteps = false,
}) => {
  const { uiTheme } = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  
  const isDark = uiTheme.mode === 'dark';
  const formattedTime = formatTime(processingTime);
  const performance = getPerformanceLevel(processingTime);

  const handleDetailsClick = (event: React.MouseEvent<HTMLElement>) => {
    if (showSteps && processingMetadata) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const hasSteps = processingMetadata?.processingSteps && processingMetadata.processingSteps.length > 0;

  return (
    <>
      <ProcessingContainer
        $compact={compact}
        $isDark={isDark}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.8 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <TimeIcon className="processing-icon" />
        <span className="processing-time" style={{ color: performance.color }}>
          {formattedTime}
        </span>
        
        {!compact && processingMetadata?.useRAG && (
          <Chip
            label="RAG"
            size="small"
            variant="outlined"
            sx={{
              fontSize: '0.6rem',
              height: '16px',
              borderColor: '#2196f3',
              color: '#2196f3',
            }}
          />
        )}
        
        {showDetails && showSteps && hasSteps && (
          <div className="processing-details">
            <Tooltip title="View processing steps">
              <IconButton
                size="small"
                onClick={handleDetailsClick}
                sx={{ 
                  width: '16px',
                  height: '16px',
                  padding: 0
                }}
              >
                <InfoIcon sx={{ fontSize: '0.8rem' }} />
              </IconButton>
            </Tooltip>
          </div>
        )}
      </ProcessingContainer>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <ProcessingBreakdown $isDark={isDark}>
          <div className="breakdown-header">
            <SpeedIcon className="header-icon" />
            <Typography variant="subtitle1" fontWeight="medium">
              Processing Breakdown
            </Typography>
          </div>

          <div className="performance-metrics">
            <div className="metric-item">
              <span className="metric-value">{formattedTime}</span>
              <div className="metric-label">Total Time</div>
            </div>
            <div className="metric-item">
              <span className="metric-value" style={{ color: performance.color }}>
                {performance.level}
              </span>
              <div className="metric-label">Performance</div>
            </div>
          </div>

          {hasSteps && (
            <>
              <Divider sx={{ margin: '12px 0' }} />
              <Typography variant="body2" fontWeight="medium" sx={{ marginBottom: 1 }}>
                Processing Steps
              </Typography>
              
              <div className="processing-timeline">
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {processingMetadata!.processingSteps.map((step, index) => {
                    const stepTime = step.endTime && step.startTime 
                      ? step.endTime - step.startTime 
                      : 0;
                    
                    return (
                      <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 24 }}>
                          {getStepIcon(step.step, step.success)}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <div className="step-header">
                            <span className="step-name">
                              {formatStepName(step.step)}
                            </span>
                            {stepTime > 0 && (
                              <span className="step-time">
                                {formatTime(stepTime)}
                              </span>
                            )}
                          </div>
                          {step.strategy && (
                            <div className="step-details">
                              Strategy: {step.strategy}
                            </div>
                          )}
                          {step.error && (
                            <div className="step-details" style={{ color: '#f44336' }}>
                              Error: {step.error}
                            </div>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </div>
            </>
          )}
        </ProcessingBreakdown>
      </Popover>
    </>
  );
};

export default ProcessingIndicator;
