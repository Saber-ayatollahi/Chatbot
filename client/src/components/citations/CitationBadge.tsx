/**
 * Citation Badge Component
 * Displays individual citations with interactive features
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import {
  Chip,
  Tooltip,
  Popover,
  Typography,
  Box,
  Button,
  Divider,
} from '@mui/material';
import {
  Article as ArticleIcon,
  ContentCopy as CopyIcon,
  OpenInNew as OpenIcon,
  Verified as VerifiedIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { Citation } from '../../types/chat';
import { useTheme } from '../../contexts/ThemeContext';

interface CitationBadgeProps {
  citation: Citation;
  index: number;
  format?: 'inline' | 'detailed' | 'compact' | 'academic' | 'numbered';
  showTooltip?: boolean;
  interactive?: boolean;
  onCitationClick?: (citation: Citation) => void;
}

const StyledCitationChip = styled(motion.div)<{ 
  $isValid?: boolean; 
  $format: string;
  $isDark: boolean;
}>`
  display: inline-flex;
  align-items: center;
  margin: 2px 4px;
  
  .MuiChip-root {
    font-size: ${props => props.$format === 'compact' ? '0.7rem' : '0.75rem'};
    height: ${props => props.$format === 'compact' ? '20px' : '24px'};
    border: 1px solid ${props => 
      props.$isValid 
        ? props.$isDark ? '#4caf50' : '#2e7d32'
        : props.$isDark ? '#f44336' : '#d32f2f'
    };
    background: ${props => 
      props.$isValid 
        ? props.$isDark ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.05)'
        : props.$isDark ? 'rgba(244, 67, 54, 0.1)' : 'rgba(244, 67, 54, 0.05)'
    };
    color: ${props => 
      props.$isValid 
        ? props.$isDark ? '#81c784' : '#2e7d32'
        : props.$isDark ? '#ef5350' : '#d32f2f'
    };
    cursor: ${props => props.$format !== 'compact' ? 'pointer' : 'default'};
    transition: all 0.2s ease;
    
    &:hover {
      transform: ${props => props.$format !== 'compact' ? 'scale(1.05)' : 'none'};
      box-shadow: ${props => props.$format !== 'compact' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none'};
    }
    
    .MuiChip-icon {
      font-size: 0.875rem;
      margin-left: 4px;
    }
    
    .MuiChip-deleteIcon {
      font-size: 0.75rem;
      margin-right: 2px;
    }
  }
`;

const CitationPopover = styled(Box)<{ $isDark: boolean }>`
  padding: 16px;
  max-width: 320px;
  background: ${props => props.$isDark ? '#2d2d2d' : '#ffffff'};
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  
  .citation-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    
    .citation-status {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }
  }
  
  .citation-details {
    margin-bottom: 12px;
    
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 0.875rem;
      
      .label {
        font-weight: 500;
        color: ${props => props.$isDark ? '#b0b0b0' : '#666666'};
      }
      
      .value {
        font-weight: 400;
        color: ${props => props.$isDark ? '#ffffff' : '#000000'};
      }
    }
  }
  
  .citation-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
`;

export const CitationBadge: React.FC<CitationBadgeProps> = ({
  citation,
  index,
  format = 'inline',
  showTooltip = true,
  interactive = true,
  onCitationClick,
}) => {
  const { uiTheme } = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [copied, setCopied] = useState(false);

  const isValid = citation.isValid !== false;
  const isDark = uiTheme.mode === 'dark';

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (!interactive || format === 'compact') return;
    
    setAnchorEl(event.currentTarget);
    onCitationClick?.(citation);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCopy = async () => {
    try {
      const citationText = formatCitationText(citation);
      await navigator.clipboard.writeText(citationText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy citation:', error);
    }
  };

  const formatCitationText = (cit: Citation): string => {
    if (cit.page && cit.section) {
      return `${cit.source}, p.${cit.page}, ${cit.section}`;
    } else if (cit.page) {
      return `${cit.source}, p.${cit.page}`;
    }
    return cit.source;
  };

  const getCitationLabel = (): string => {
    switch (format) {
      case 'compact':
        return `[${index + 1}]`;
      case 'detailed':
        return `${citation.source}${citation.page ? `, p.${citation.page}` : ''}`;
      case 'academic':
        return `[${citation.source}${citation.page ? `, p.${citation.page}` : ''}]`;
      case 'numbered':
        return `[${index + 1}]`;
      case 'inline':
      default:
        return citation.page ? `[${index + 1}]` : citation.source;
    }
  };

  const tooltipTitle = showTooltip ? (
    <Box>
      <Typography variant="body2" fontWeight="medium">
        {citation.source}
      </Typography>
      {citation.page && (
        <Typography variant="caption">
          Page {citation.page}
        </Typography>
      )}
      {citation.section && (
        <Typography variant="caption" display="block">
          {citation.section}
        </Typography>
      )}
    </Box>
  ) : '';

  const citationChip = (
    <StyledCitationChip
      $isValid={isValid}
      $format={format}
      $isDark={isDark}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      whileHover={{ scale: interactive && format !== 'compact' ? 1.05 : 1 }}
      whileTap={{ scale: interactive && format !== 'compact' ? 0.95 : 1 }}
    >
      <Chip
        label={getCitationLabel()}
        size="small"
        icon={isValid ? <VerifiedIcon /> : <WarningIcon />}
        onClick={handleClick}
        variant="outlined"
      />
    </StyledCitationChip>
  );

  return (
    <>
      {showTooltip && format !== 'compact' ? (
        <Tooltip title={tooltipTitle} arrow placement="top">
          {citationChip}
        </Tooltip>
      ) : (
        citationChip
      )}

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
        <CitationPopover $isDark={isDark}>
          <div className="citation-header">
            <ArticleIcon fontSize="small" />
            <Typography variant="subtitle2" fontWeight="medium">
              Citation Details
            </Typography>
            <div className="citation-status">
              {isValid ? (
                <>
                  <VerifiedIcon fontSize="inherit" color="success" />
                  <span>Verified</span>
                </>
              ) : (
                <>
                  <WarningIcon fontSize="inherit" color="warning" />
                  <span>Unverified</span>
                </>
              )}
            </div>
          </div>

          <div className="citation-details">
            <div className="detail-row">
              <span className="label">Source:</span>
              <span className="value">{citation.source}</span>
            </div>
            {citation.page && (
              <div className="detail-row">
                <span className="label">Page:</span>
                <span className="value">{citation.page}</span>
              </div>
            )}
            {citation.section && (
              <div className="detail-row">
                <span className="label">Section:</span>
                <span className="value">{citation.section}</span>
              </div>
            )}
            {citation.chunk_id && (
              <div className="detail-row">
                <span className="label">Chunk ID:</span>
                <span className="value">{citation.chunk_id.substring(0, 8)}...</span>
              </div>
            )}
          </div>

          <Divider sx={{ margin: '8px 0' }} />

          <div className="citation-actions">
            <Button
              size="small"
              startIcon={<CopyIcon />}
              onClick={handleCopy}
              disabled={copied}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button
              size="small"
              startIcon={<OpenIcon />}
              onClick={() => {
                // In a real implementation, this would open the source document
                console.log('Open source:', citation);
              }}
            >
              View Source
            </Button>
          </div>
        </CitationPopover>
      </Popover>
    </>
  );
};

export default CitationBadge;
