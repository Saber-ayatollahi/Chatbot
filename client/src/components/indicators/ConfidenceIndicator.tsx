/**
 * Confidence Indicator Component
 * Displays confidence scores with visual indicators and detailed breakdown
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
  Popover,
  Divider,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Psychology as BrainIcon,
  Search as SearchIcon,
  Article as ContentIcon,
  Settings as ContextIcon,
  AutoAwesome as GenerationIcon,
} from '@mui/icons-material';
import { useTheme } from '../../contexts/ThemeContext';
import { getConfidenceColor } from '../../theme';

interface ConfidenceIndicatorProps {
  confidence: number;
  confidenceLevel: 'very_low' | 'low' | 'medium' | 'high';
  showDetails?: boolean;
  showBreakdown?: boolean;
  compact?: boolean;
  components?: {
    retrieval?: number;
    content?: number;
    context?: number;
    generation?: number;
  };
  qualityIndicators?: {
    hasRelevantSources?: boolean;
    citationsPresent?: boolean;
    confidenceAboveThreshold?: boolean;
    responseComplete?: boolean;
  };
  onDetailsClick?: () => void;
}

const ConfidenceContainer = styled(motion.div)<{ $compact?: boolean; $isDark: boolean }>`
  display: flex;
  align-items: center;
  gap: ${props => props.$compact ? '6px' : '8px'};
  padding: ${props => props.$compact ? '4px 8px' : '8px 12px'};
  background: ${props => props.$isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'};
  border-radius: 12px;
  border: 1px solid ${props => props.$isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'};
    border-color: ${props => props.$isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'};
  }
  
  .confidence-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${props => props.$compact ? '20px' : '24px'};
    height: ${props => props.$compact ? '20px' : '24px'};
    border-radius: 50%;
    font-size: ${props => props.$compact ? '0.75rem' : '1rem'};
  }
  
  .confidence-content {
    flex: 1;
    min-width: 0;
    
    .confidence-main {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: ${props => props.$compact ? '0' : '2px'};
      
      .confidence-score {
        font-weight: 600;
        font-size: ${props => props.$compact ? '0.75rem' : '0.875rem'};
      }
      
      .confidence-level {
        font-size: ${props => props.$compact ? '0.65rem' : '0.75rem'};
        text-transform: capitalize;
        opacity: 0.8;
      }
    }
    
    .confidence-bar {
      margin-top: ${props => props.$compact ? '2px' : '4px'};
      
      .MuiLinearProgress-root {
        height: ${props => props.$compact ? '3px' : '4px'};
        border-radius: 2px;
      }
    }
  }
  
  .confidence-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
`;

const ConfidenceBreakdown = styled(Box)<{ $isDark: boolean }>`
  padding: 16px;
  max-width: 360px;
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
  
  .component-list {
    margin-bottom: 16px;
    
    .component-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid ${props => props.$isDark ? '#404040' : '#f0f0f0'};
      
      &:last-child {
        border-bottom: none;
      }
      
      .component-info {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .component-icon {
          font-size: 1rem;
          opacity: 0.7;
        }
        
        .component-name {
          font-size: 0.875rem;
          font-weight: 500;
        }
      }
      
      .component-score {
        display: flex;
        align-items: center;
        gap: 8px;
        
        .score-value {
          font-weight: 600;
          font-size: 0.875rem;
        }
        
        .score-bar {
          width: 60px;
          
          .MuiLinearProgress-root {
            height: 4px;
            border-radius: 2px;
          }
        }
      }
    }
  }
  
  .quality-indicators {
    .indicator-header {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 8px;
      opacity: 0.8;
    }
    
    .indicator-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      
      .indicator-chip {
        font-size: 0.7rem;
        height: 20px;
      }
    }
  }
`;

const getConfidenceIcon = (level: string, isDark: boolean) => {
  const iconProps = { fontSize: 'inherit' as const };
  
  switch (level) {
    case 'high':
      return <CheckIcon {...iconProps} style={{ color: '#4caf50' }} />;
    case 'medium':
      return <TrendingUpIcon {...iconProps} style={{ color: '#2196f3' }} />;
    case 'low':
      return <WarningIcon {...iconProps} style={{ color: '#ff9800' }} />;
    case 'very_low':
      return <ErrorIcon {...iconProps} style={{ color: '#f44336' }} />;
    default:
      return <InfoIcon {...iconProps} />;
  }
};

const getComponentIcon = (component: string) => {
  const iconProps = { className: 'component-icon' };
  
  switch (component) {
    case 'retrieval':
      return <SearchIcon {...iconProps} />;
    case 'content':
      return <ContentIcon {...iconProps} />;
    case 'context':
      return <ContextIcon {...iconProps} />;
    case 'generation':
      return <GenerationIcon {...iconProps} />;
    default:
      return <BrainIcon {...iconProps} />;
  }
};

const getComponentName = (component: string): string => {
  switch (component) {
    case 'retrieval':
      return 'Source Retrieval';
    case 'content':
      return 'Content Quality';
    case 'context':
      return 'Query Context';
    case 'generation':
      return 'Response Generation';
    default:
      return component;
  }
};

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  confidenceLevel,
  showDetails = true,
  showBreakdown = false,
  compact = false,
  components,
  qualityIndicators,
  onDetailsClick,
}) => {
  const { uiTheme } = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  
  const isDark = uiTheme.mode === 'dark';
  const confidenceColor = getConfidenceColor(confidenceLevel);
  const confidencePercentage = Math.round(confidence * 100);

  const handleDetailsClick = (event: React.MouseEvent<HTMLElement>) => {
    if (showBreakdown) {
      setAnchorEl(event.currentTarget);
    }
    onDetailsClick?.();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const getQualityChipColor = (indicator: string, value: boolean) => {
    return value ? 'success' : 'warning';
  };

  const formatQualityIndicatorName = (key: string): string => {
    switch (key) {
      case 'hasRelevantSources':
        return 'Relevant Sources';
      case 'citationsPresent':
        return 'Citations Present';
      case 'confidenceAboveThreshold':
        return 'Above Threshold';
      case 'responseComplete':
        return 'Complete Response';
      default:
        return key;
    }
  };

  return (
    <>
      <ConfidenceContainer
        $compact={compact}
        $isDark={isDark}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        whileHover={{ scale: 1.02 }}
      >
        <div 
          className="confidence-icon"
          style={{ 
            background: `${confidenceColor}20`,
            color: confidenceColor 
          }}
        >
          {getConfidenceIcon(confidenceLevel, isDark)}
        </div>

        <div className="confidence-content">
          <div className="confidence-main">
            <span className="confidence-score" style={{ color: confidenceColor }}>
              {confidencePercentage}%
            </span>
            <span className="confidence-level">
              {confidenceLevel.replace('_', ' ')}
            </span>
          </div>
          
          {!compact && (
            <div className="confidence-bar">
              <LinearProgress
                variant="determinate"
                value={confidencePercentage}
                sx={{
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: confidenceColor,
                  },
                  backgroundColor: isDark ? '#404040' : '#e0e0e0',
                }}
              />
            </div>
          )}
        </div>

        {showDetails && (showBreakdown || components) && (
          <div className="confidence-actions">
            <Tooltip title="View confidence breakdown">
              <IconButton
                size="small"
                onClick={handleDetailsClick}
                sx={{ 
                  width: compact ? '20px' : '24px',
                  height: compact ? '20px' : '24px'
                }}
              >
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        )}
      </ConfidenceContainer>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <ConfidenceBreakdown $isDark={isDark}>
          <div className="breakdown-header">
            <BrainIcon className="header-icon" />
            <Typography variant="subtitle1" fontWeight="medium">
              Confidence Breakdown
            </Typography>
          </div>

          <Typography variant="body2" sx={{ marginBottom: 2, opacity: 0.8 }}>
            Overall confidence: <strong>{confidencePercentage}%</strong> ({confidenceLevel.replace('_', ' ')})
          </Typography>

          {components && (
            <div className="component-list">
              {Object.entries(components).map(([component, score]) => (
                <div key={component} className="component-item">
                  <div className="component-info">
                    {getComponentIcon(component)}
                    <span className="component-name">
                      {getComponentName(component)}
                    </span>
                  </div>
                  <div className="component-score">
                    <span className="score-value">
                      {Math.round(score * 100)}%
                    </span>
                    <div className="score-bar">
                      <LinearProgress
                        variant="determinate"
                        value={score * 100}
                        sx={{
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: getConfidenceColor(
                              score >= 0.8 ? 'high' : 
                              score >= 0.6 ? 'medium' : 
                              score >= 0.4 ? 'low' : 'very_low'
                            ),
                          },
                          backgroundColor: isDark ? '#404040' : '#e0e0e0',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {qualityIndicators && (
            <>
              <Divider sx={{ margin: '12px 0' }} />
              <div className="quality-indicators">
                <div className="indicator-header">Quality Indicators</div>
                <div className="indicator-list">
                  {Object.entries(qualityIndicators).map(([key, value]) => (
                    <Chip
                      key={key}
                      label={formatQualityIndicatorName(key)}
                      size="small"
                      color={getQualityChipColor(key, value)}
                      variant={value ? 'filled' : 'outlined'}
                      className="indicator-chip"
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </ConfidenceBreakdown>
      </Popover>
    </>
  );
};

export default ConfidenceIndicator;
