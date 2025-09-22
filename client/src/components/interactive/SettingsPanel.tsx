/**
 * Settings Panel Component
 * Comprehensive settings management for chat and RAG configuration
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import {
  Drawer,
  Box,
  Typography,
  Divider,
  Switch,
  FormControl,
  FormControlLabel,
  Select,
  MenuItem,
  Slider,
  Button,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  Brightness4 as DarkModeIcon,
  Brightness7 as LightModeIcon,
  Psychology as RAGIcon,
  Tune as TuneIcon,
  Visibility as VisibilityIcon,
  Palette as PaletteIcon,
  Speed as PerformanceIcon,
  Restore as ResetIcon,
  Save as SaveIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useTheme } from '../../contexts/ThemeContext';
import { useChatSettings } from '../../contexts/ChatSettingsContext';
import { ChatSettings } from '../../types/chat';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  onSettingsChange?: (settings: Partial<ChatSettings>) => void;
}

const SettingsDrawer = styled(Drawer)<{ $isDark: boolean }>`
  .MuiDrawer-paper {
    width: 380px;
    background: ${props => props.$isDark ? '#1e1e1e' : '#ffffff'};
    border-left: 1px solid ${props => props.$isDark ? '#404040' : '#e0e0e0'};
    
    @media (max-width: 768px) {
      width: 100vw;
    }
  }
`;

const SettingsContent = styled(Box)<{ $isDark: boolean }>`
  padding: 24px;
  height: 100%;
  overflow-y: auto;
  
  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    
    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .header-icon {
        color: #2196f3;
      }
    }
  }
  
  .settings-section {
    margin-bottom: 24px;
    
    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      
      .section-icon {
        color: #666;
        font-size: 1.2rem;
      }
      
      .section-title {
        font-weight: 600;
        color: ${props => props.$isDark ? '#ffffff' : '#000000'};
      }
    }
    
    .section-description {
      font-size: 0.875rem;
      opacity: 0.8;
      margin-bottom: 16px;
      line-height: 1.4;
    }
  }
  
  .setting-item {
    margin-bottom: 16px;
    
    .setting-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      
      .setting-label {
        font-weight: 500;
        font-size: 0.875rem;
      }
      
      .setting-info {
        opacity: 0.6;
      }
    }
    
    .setting-description {
      font-size: 0.75rem;
      opacity: 0.7;
      margin-bottom: 8px;
      line-height: 1.3;
    }
    
    .setting-control {
      .MuiFormControl-root {
        min-width: 120px;
      }
      
      .MuiSlider-root {
        margin-left: 12px;
        margin-right: 12px;
      }
    }
  }
  
  .settings-actions {
    position: sticky;
    bottom: 0;
    background: ${props => props.$isDark ? '#1e1e1e' : '#ffffff'};
    padding: 16px 0;
    border-top: 1px solid ${props => props.$isDark ? '#404040' : '#e0e0e0'};
    margin: 0 -24px -24px -24px;
    padding-left: 24px;
    padding-right: 24px;
    
    .actions-row {
      display: flex;
      gap: 8px;
      justify-content: space-between;
    }
  }
  
  .advanced-settings {
    .MuiAccordion-root {
      background: ${props => props.$isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'};
      
      &:before {
        display: none;
      }
    }
  }
  
  .performance-info {
    margin-top: 12px;
    
    .performance-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 8px;
      
      .metric-item {
        text-align: center;
        padding: 8px;
        background: ${props => props.$isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'};
        border-radius: 8px;
        
        .metric-value {
          font-weight: 600;
          color: #2196f3;
          display: block;
        }
        
        .metric-label {
          font-size: 0.7rem;
          opacity: 0.8;
        }
      }
    }
  }
`;

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  open,
  onClose,
  onSettingsChange,
}) => {
  const { uiTheme, toggleTheme, updateTheme, resetTheme } = useTheme();
  const { 
    settings, 
    updateSettings, 
    resetSettings, 
    isAdvancedMode, 
    toggleAdvancedMode 
  } = useChatSettings();
  
  const [localSettings, setLocalSettings] = useState<ChatSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);

  const isDark = uiTheme.mode === 'dark';

  const handleSettingChange = <K extends keyof ChatSettings>(
    key: K,
    value: ChatSettings[K]
  ) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handleSaveSettings = async () => {
    await updateSettings(localSettings);
    setHasChanges(false);
    onSettingsChange?.(localSettings);
  };

  const handleResetSettings = () => {
    resetSettings();
    setLocalSettings(settings);
    setHasChanges(false);
  };

  const handleResetTheme = () => {
    resetTheme();
  };

  const getPerformanceEstimate = () => {
    let score = 85; // Base score
    
    if (localSettings.useKnowledgeBase) score -= 10;
    if (localSettings.maxChunks > 5) score -= 5;
    if (localSettings.retrievalStrategy === 'advanced_multi_feature') score -= 15; // More advanced = slightly slower
    if (localSettings.retrievalStrategy === 'multi_scale') score -= 8;
    if (localSettings.showProcessingTime) score -= 2;
    
    return Math.max(score, 50);
  };

  const getQualityEstimate = () => {
    let score = 70; // Base score
    
    if (localSettings.useKnowledgeBase) score += 20;
    if (localSettings.maxChunks >= 5) score += 5;
    if (localSettings.retrievalStrategy === 'advanced_multi_feature') score += 15; // Best quality
    if (localSettings.retrievalStrategy === 'multi_scale') score += 10;
    if (localSettings.retrievalStrategy === 'hybrid') score += 5;
    if (localSettings.showConfidence) score += 3;
    if (localSettings.showSources) score += 2;
    
    return Math.min(score, 95);
  };

  return (
    <SettingsDrawer
      anchor="right"
      open={open}
      onClose={onClose}
      $isDark={isDark}
    >
      <SettingsContent $isDark={isDark}>
        {/* Header */}
        <div className="settings-header">
          <div className="header-title">
            <TuneIcon className="header-icon" />
            <Typography variant="h6">Settings</Typography>
          </div>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </div>

        {/* Theme Settings */}
        <div className="settings-section">
          <div className="section-header">
            <PaletteIcon className="section-icon" />
            <Typography className="section-title">Appearance</Typography>
          </div>
          
          <div className="setting-item">
            <div className="setting-header">
              <span className="setting-label">Dark Mode</span>
              <FormControlLabel
                control={
                  <Switch
                    checked={isDark}
                    onChange={toggleTheme}
                    icon={<LightModeIcon />}
                    checkedIcon={<DarkModeIcon />}
                  />
                }
                label=""
              />
            </div>
            <div className="setting-description">
              Toggle between light and dark theme
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-header">
              <span className="setting-label">Font Size</span>
            </div>
            <div className="setting-control">
              <FormControl fullWidth size="small">
                <Select
                  value={uiTheme.fontSize}
                  onChange={(e) => updateTheme({ fontSize: e.target.value as any })}
                >
                  <MenuItem value="small">Small</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="large">Large</MenuItem>
                </Select>
              </FormControl>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-header">
              <span className="setting-label">Compact Mode</span>
              <Switch
                checked={uiTheme.compactMode}
                onChange={(e) => updateTheme({ compactMode: e.target.checked })}
              />
            </div>
            <div className="setting-description">
              Reduce spacing and padding for more content
            </div>
          </div>
        </div>

        <Divider />

        {/* RAG Settings */}
        <div className="settings-section">
          <div className="section-header">
            <RAGIcon className="section-icon" />
            <Typography className="section-title">AI & Knowledge Base</Typography>
          </div>
          <div className="section-description">
            Configure how the AI retrieves and uses information from the knowledge base
          </div>

          <div className="setting-item">
            <div className="setting-header">
              <span className="setting-label">Use Knowledge Base</span>
              <Switch
                checked={localSettings.useKnowledgeBase}
                onChange={(e) => handleSettingChange('useKnowledgeBase', e.target.checked)}
              />
            </div>
            <div className="setting-description">
              Enable RAG-powered responses using Fund Management documentation
            </div>
          </div>

          {localSettings.useKnowledgeBase && (
            <>
              <div className="setting-item">
                <div className="setting-header">
                  <span className="setting-label">Max Sources ({localSettings.maxChunks})</span>
                  <Tooltip title="More sources provide better context but slower responses">
                    <InfoIcon className="setting-info" fontSize="small" />
                  </Tooltip>
                </div>
                <div className="setting-control">
                  <Slider
                    value={localSettings.maxChunks}
                    onChange={(_, value) => handleSettingChange('maxChunks', value as number)}
                    min={1}
                    max={10}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                  />
                </div>
                <div className="setting-description">
                  Number of knowledge base sources to retrieve for each query
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-header">
                  <span className="setting-label">Retrieval Strategy</span>
                </div>
                <div className="setting-control">
                  <FormControl fullWidth size="small">
                    <Select
                      value={localSettings.retrievalStrategy}
                      onChange={(e) => handleSettingChange('retrievalStrategy', e.target.value as any)}
                    >
                      <MenuItem value="vector_only">Vector Only</MenuItem>
                      <MenuItem value="hybrid">Hybrid</MenuItem>
                      <MenuItem value="contextual">Contextual</MenuItem>
                      <MenuItem value="multi_scale">Multi-Scale</MenuItem>
                      <MenuItem value="advanced_multi_feature">Advanced Multi-Feature (Recommended)</MenuItem>
                    </Select>
                  </FormControl>
                </div>
                <div className="setting-description">
                  Method for finding relevant information in the knowledge base
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-header">
                  <span className="setting-label">Confidence Threshold ({(localSettings.confidenceThreshold || 0.6).toFixed(1)})</span>
                  <Tooltip title="Minimum confidence required for RAG responses. Lower values allow more responses but may reduce quality.">
                    <InfoIcon className="setting-info" fontSize="small" />
                  </Tooltip>
                </div>
                <div className="setting-control">
                  <Slider
                    value={localSettings.confidenceThreshold || 0.6}
                    onChange={(_, value) => handleSettingChange('confidenceThreshold', value as number)}
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    marks={[
                      { value: 0.1, label: '0.1' },
                      { value: 0.3, label: '0.3' },
                      { value: 0.5, label: '0.5' },
                      { value: 0.6, label: '0.6' },
                      { value: 0.8, label: '0.8' },
                      { value: 1.0, label: '1.0' }
                    ]}
                    valueLabelDisplay="auto"
                  />
                </div>
                <div className="setting-description">
                  Minimum confidence level required for RAG responses. Current: {localSettings.confidenceThreshold || 0.6}
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-header">
                  <span className="setting-label">Citation Format</span>
                </div>
                <div className="setting-control">
                  <FormControl fullWidth size="small">
                    <Select
                      value={localSettings.citationFormat}
                      onChange={(e) => handleSettingChange('citationFormat', e.target.value as any)}
                    >
                      <MenuItem value="inline">Inline [1]</MenuItem>
                      <MenuItem value="detailed">Detailed (Source, p.1)</MenuItem>
                      <MenuItem value="academic">[Source, p.1]</MenuItem>
                      <MenuItem value="numbered">[1] [2] [3]</MenuItem>
                    </Select>
                  </FormControl>
                </div>
              </div>
            </>
          )}
        </div>

        <Divider />

        {/* Display Settings */}
        <div className="settings-section">
          <div className="section-header">
            <VisibilityIcon className="section-icon" />
            <Typography className="section-title">Display Options</Typography>
          </div>

          <div className="setting-item">
            <div className="setting-header">
              <span className="setting-label">Show Confidence Scores</span>
              <Switch
                checked={localSettings.showConfidence}
                onChange={(e) => handleSettingChange('showConfidence', e.target.checked)}
              />
            </div>
            <div className="setting-description">
              Display AI confidence levels for responses
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-header">
              <span className="setting-label">Show Sources</span>
              <Switch
                checked={localSettings.showSources}
                onChange={(e) => handleSettingChange('showSources', e.target.checked)}
              />
            </div>
            <div className="setting-description">
              Display source documents and citations
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-header">
              <span className="setting-label">Show Processing Time</span>
              <Switch
                checked={localSettings.showProcessingTime}
                onChange={(e) => handleSettingChange('showProcessingTime', e.target.checked)}
              />
            </div>
            <div className="setting-description">
              Display response generation time and performance metrics
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        {isAdvancedMode && (
          <>
            <Divider />
            <div className="settings-section">
              <div className="advanced-settings">
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>Advanced Configuration</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <div className="setting-item">
                      <div className="setting-header">
                        <span className="setting-label">Template Type</span>
                      </div>
                      <div className="setting-control">
                        <FormControl fullWidth size="small">
                          <Select
                            value={localSettings.templateType || 'standard'}
                            onChange={(e) => handleSettingChange('templateType', e.target.value as any)}
                          >
                            <MenuItem value="standard">Standard</MenuItem>
                            <MenuItem value="definition">Definition</MenuItem>
                            <MenuItem value="procedure">Procedure</MenuItem>
                            <MenuItem value="comparison">Comparison</MenuItem>
                            <MenuItem value="troubleshooting">Troubleshooting</MenuItem>
                            <MenuItem value="list">List</MenuItem>
                            <MenuItem value="contextual">Contextual</MenuItem>
                          </Select>
                        </FormControl>
                      </div>
                      <div className="setting-description">
                        Prompt template for response generation
                      </div>
                    </div>
                  </AccordionDetails>
                </Accordion>
              </div>
            </div>
          </>
        )}

        {/* Performance Info */}
        <div className="settings-section">
          <div className="section-header">
            <PerformanceIcon className="section-icon" />
            <Typography className="section-title">Performance Impact</Typography>
          </div>
          
          <div className="performance-info">
            <Alert severity="info" variant="outlined">
              Current settings impact on response speed and quality
            </Alert>
            
            <div className="performance-metrics">
              <div className="metric-item">
                <span className="metric-value">{getPerformanceEstimate()}%</span>
                <div className="metric-label">Speed</div>
              </div>
              <div className="metric-item">
                <span className="metric-value">{getQualityEstimate()}%</span>
                <div className="metric-label">Quality</div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="settings-actions">
          <div className="actions-row">
            <Button
              startIcon={<ResetIcon />}
              onClick={handleResetSettings}
              variant="outlined"
              size="small"
            >
              Reset Chat
            </Button>
            
            <Button
              onClick={toggleAdvancedMode}
              variant="text"
              size="small"
            >
              {isAdvancedMode ? 'Simple' : 'Advanced'}
            </Button>
          </div>
          
          <div className="actions-row" style={{ marginTop: 8 }}>
            <Button
              startIcon={<ResetIcon />}
              onClick={handleResetTheme}
              variant="outlined"
              size="small"
            >
              Reset Theme
            </Button>
            
            <Button
              startIcon={<SaveIcon />}
              onClick={handleSaveSettings}
              variant="contained"
              disabled={!hasChanges}
              size="small"
            >
              Save Settings
            </Button>
          </div>
        </div>
      </SettingsContent>
    </SettingsDrawer>
  );
};

export default SettingsPanel;
