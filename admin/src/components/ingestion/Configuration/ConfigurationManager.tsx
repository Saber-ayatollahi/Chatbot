/**
 * Configuration Manager Component - Full Implementation
 * Phase 3, Day 13: Advanced configuration management system
 * Comprehensive settings management with validation, presets, and environment support
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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  Divider,
  Slider,
  FormGroup,
  Checkbox,
  RadioGroup,
  Radio,
  FormLabel,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Edit as EditIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Code as CodeIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  CloudUpload as CloudUploadIcon,
  CloudDownload as CloudDownloadIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

interface ConfigurationSection {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'system' | 'processing' | 'security' | 'performance' | 'ui' | 'advanced';
  settings: ConfigurationSetting[];
}

interface ConfigurationSetting {
  id: string;
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'slider' | 'password' | 'json' | 'file';
  value: any;
  defaultValue: any;
  options?: { label: string; value: any }[];
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    custom?: (value: any) => string | null;
  };
  sensitive?: boolean;
  restartRequired?: boolean;
  environment?: string[];
  dependencies?: string[];
}

interface ConfigurationPreset {
  id: string;
  name: string;
  description: string;
  category: 'development' | 'staging' | 'production' | 'testing' | 'custom';
  settings: Record<string, any>;
  createdAt: Date;
  lastUsed?: Date;
  isDefault?: boolean;
  isFavorite?: boolean;
}

interface ConfigurationManagerProps {
  onConfigurationChange?: (config: Record<string, any>) => void;
  onSaveConfiguration?: (config: Record<string, any>) => Promise<void>;
  onLoadConfiguration?: () => Promise<Record<string, any>>;
  enablePresets?: boolean;
  enableImportExport?: boolean;
  enableValidation?: boolean;
}

// Mock configuration service
class ConfigurationService {
  private static instance: ConfigurationService;
  private sections: ConfigurationSection[] = [];
  private presets: ConfigurationPreset[] = [];
  private currentConfig: Record<string, any> = {};

  static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
      ConfigurationService.instance.initializeMockData();
    }
    return ConfigurationService.instance;
  }

  private initializeMockData() {
    // Initialize configuration sections
    this.sections = [
      {
        id: 'system',
        name: 'System Settings',
        description: 'Core system configuration and behavior',
        icon: <SettingsIcon />,
        category: 'system',
        settings: [
          {
            id: 'system.environment',
            name: 'Environment',
            description: 'Current deployment environment',
            type: 'select',
            value: 'production',
            defaultValue: 'development',
            options: [
              { label: 'Development', value: 'development' },
              { label: 'Staging', value: 'staging' },
              { label: 'Production', value: 'production' },
            ],
            validation: { required: true },
            restartRequired: true,
          },
          {
            id: 'system.debug_mode',
            name: 'Debug Mode',
            description: 'Enable detailed logging and debugging features',
            type: 'boolean',
            value: false,
            defaultValue: false,
            restartRequired: true,
            environment: ['development', 'staging'],
          },
          {
            id: 'system.log_level',
            name: 'Log Level',
            description: 'Minimum log level to record',
            type: 'select',
            value: 'info',
            defaultValue: 'info',
            options: [
              { label: 'Debug', value: 'debug' },
              { label: 'Info', value: 'info' },
              { label: 'Warning', value: 'warn' },
              { label: 'Error', value: 'error' },
              { label: 'Fatal', value: 'fatal' },
            ],
          },
          {
            id: 'system.max_concurrent_jobs',
            name: 'Max Concurrent Jobs',
            description: 'Maximum number of concurrent processing jobs',
            type: 'slider',
            value: 3,
            defaultValue: 3,
            validation: { min: 1, max: 10 },
          },
        ],
      },
      {
        id: 'processing',
        name: 'Processing Settings',
        description: 'Document processing and ingestion configuration',
        icon: <SpeedIcon />,
        category: 'processing',
        settings: [
          {
            id: 'processing.default_method',
            name: 'Default Processing Method',
            description: 'Default method for document processing',
            type: 'select',
            value: 'enhanced',
            defaultValue: 'standard',
            options: [
              { label: 'Simple', value: 'simple' },
              { label: 'Standard', value: 'standard' },
              { label: 'Enhanced', value: 'enhanced' },
              { label: 'Advanced', value: 'advanced' },
            ],
          },
          {
            id: 'processing.chunk_size',
            name: 'Default Chunk Size',
            description: 'Default maximum tokens per chunk',
            type: 'number',
            value: 400,
            defaultValue: 400,
            validation: { min: 100, max: 1000 },
          },
          {
            id: 'processing.overlap_tokens',
            name: 'Overlap Tokens',
            description: 'Number of overlapping tokens between chunks',
            type: 'number',
            value: 50,
            defaultValue: 50,
            validation: { min: 0, max: 200 },
          },
          {
            id: 'processing.enable_ocr',
            name: 'Enable OCR',
            description: 'Enable OCR fallback for scanned documents',
            type: 'boolean',
            value: true,
            defaultValue: true,
          },
          {
            id: 'processing.quality_threshold',
            name: 'Quality Threshold',
            description: 'Minimum quality score for processed chunks',
            type: 'slider',
            value: 0.7,
            defaultValue: 0.7,
            validation: { min: 0, max: 1 },
          },
        ],
      },
      {
        id: 'security',
        name: 'Security Settings',
        description: 'Security and authentication configuration',
        icon: <SecurityIcon />,
        category: 'security',
        settings: [
          {
            id: 'security.api_key',
            name: 'OpenAI API Key',
            description: 'API key for OpenAI services',
            type: 'password',
            value: 'sk-...',
            defaultValue: '',
            validation: { required: true, pattern: '^sk-[a-zA-Z0-9]{48}$' },
            sensitive: true,
          },
          {
            id: 'security.session_timeout',
            name: 'Session Timeout',
            description: 'User session timeout in minutes',
            type: 'number',
            value: 60,
            defaultValue: 60,
            validation: { min: 5, max: 480 },
          },
          {
            id: 'security.enable_2fa',
            name: 'Two-Factor Authentication',
            description: 'Require 2FA for admin access',
            type: 'boolean',
            value: false,
            defaultValue: false,
            restartRequired: true,
          },
          {
            id: 'security.allowed_file_types',
            name: 'Allowed File Types',
            description: 'Permitted file types for upload',
            type: 'multiselect',
            value: ['pdf', 'docx', 'txt', 'md'],
            defaultValue: ['pdf', 'docx', 'txt', 'md'],
            options: [
              { label: 'PDF', value: 'pdf' },
              { label: 'Word Document', value: 'docx' },
              { label: 'Text File', value: 'txt' },
              { label: 'Markdown', value: 'md' },
              { label: 'HTML', value: 'html' },
              { label: 'RTF', value: 'rtf' },
            ],
          },
        ],
      },
      {
        id: 'performance',
        name: 'Performance Settings',
        description: 'Performance optimization and resource management',
        icon: <MemoryIcon />,
        category: 'performance',
        settings: [
          {
            id: 'performance.cache_enabled',
            name: 'Enable Caching',
            description: 'Enable result caching for improved performance',
            type: 'boolean',
            value: true,
            defaultValue: true,
          },
          {
            id: 'performance.cache_ttl',
            name: 'Cache TTL',
            description: 'Cache time-to-live in seconds',
            type: 'number',
            value: 3600,
            defaultValue: 3600,
            validation: { min: 60, max: 86400 },
            dependencies: ['performance.cache_enabled'],
          },
          {
            id: 'performance.max_memory_usage',
            name: 'Max Memory Usage',
            description: 'Maximum memory usage percentage',
            type: 'slider',
            value: 0.8,
            defaultValue: 0.8,
            validation: { min: 0.1, max: 0.95 },
          },
          {
            id: 'performance.batch_size',
            name: 'Batch Size',
            description: 'Default batch size for processing operations',
            type: 'number',
            value: 100,
            defaultValue: 100,
            validation: { min: 10, max: 1000 },
          },
        ],
      },
      {
        id: 'advanced',
        name: 'Advanced Settings',
        description: 'Advanced configuration options',
        icon: <CodeIcon />,
        category: 'advanced',
        settings: [
          {
            id: 'advanced.custom_config',
            name: 'Custom Configuration',
            description: 'Custom JSON configuration for advanced users',
            type: 'json',
            value: '{}',
            defaultValue: '{}',
            validation: {
              custom: (value: string) => {
                try {
                  JSON.parse(value);
                  return null;
                } catch {
                  return 'Invalid JSON format';
                }
              },
            },
          },
          {
            id: 'advanced.experimental_features',
            name: 'Experimental Features',
            description: 'Enable experimental features (use with caution)',
            type: 'boolean',
            value: false,
            defaultValue: false,
            restartRequired: true,
          },
          {
            id: 'advanced.telemetry_enabled',
            name: 'Telemetry',
            description: 'Enable anonymous usage telemetry',
            type: 'boolean',
            value: true,
            defaultValue: true,
          },
        ],
      },
    ];

    // Initialize presets
    this.presets = [
      {
        id: 'preset_dev',
        name: 'Development',
        description: 'Optimized for development environment',
        category: 'development',
        settings: {
          'system.environment': 'development',
          'system.debug_mode': true,
          'system.log_level': 'debug',
          'processing.default_method': 'simple',
          'security.session_timeout': 480,
          'performance.cache_enabled': false,
        },
        createdAt: new Date(Date.now() - 86400000 * 30),
        isDefault: true,
      },
      {
        id: 'preset_prod',
        name: 'Production',
        description: 'Optimized for production environment',
        category: 'production',
        settings: {
          'system.environment': 'production',
          'system.debug_mode': false,
          'system.log_level': 'warn',
          'processing.default_method': 'enhanced',
          'security.session_timeout': 60,
          'security.enable_2fa': true,
          'performance.cache_enabled': true,
          'performance.max_memory_usage': 0.7,
        },
        createdAt: new Date(Date.now() - 86400000 * 15),
        isFavorite: true,
      },
      {
        id: 'preset_testing',
        name: 'Testing',
        description: 'Optimized for testing and QA',
        category: 'testing',
        settings: {
          'system.environment': 'staging',
          'system.debug_mode': true,
          'system.log_level': 'info',
          'processing.default_method': 'standard',
          'security.session_timeout': 120,
          'performance.cache_enabled': true,
          'performance.cache_ttl': 1800,
        },
        createdAt: new Date(Date.now() - 86400000 * 7),
      },
    ];

    // Initialize current configuration
    this.currentConfig = this.sections.reduce((acc, section) => {
      section.settings.forEach(setting => {
        acc[setting.id] = setting.value;
      });
      return acc;
    }, {} as Record<string, any>);
  }

  getSections(): ConfigurationSection[] {
    return this.sections;
  }

  getPresets(): ConfigurationPreset[] {
    return this.presets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getCurrentConfiguration(): Record<string, any> {
    return { ...this.currentConfig };
  }

  async updateSetting(settingId: string, value: any): Promise<void> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.currentConfig[settingId] = value;
    
    // Update the setting in sections
    for (const section of this.sections) {
      const setting = section.settings.find(s => s.id === settingId);
      if (setting) {
        setting.value = value;
        break;
      }
    }
  }

  async saveConfiguration(config: Record<string, any>): Promise<void> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.currentConfig = { ...config };
    
    // Update all settings
    for (const section of this.sections) {
      section.settings.forEach(setting => {
        if (config.hasOwnProperty(setting.id)) {
          setting.value = config[setting.id];
        }
      });
    }
  }

  async applyPreset(presetId: string): Promise<void> {
    const preset = this.presets.find(p => p.id === presetId);
    if (preset) {
      await this.saveConfiguration(preset.settings);
      preset.lastUsed = new Date();
    }
  }

  async createPreset(preset: Omit<ConfigurationPreset, 'id' | 'createdAt'>): Promise<string> {
    const newPreset: ConfigurationPreset = {
      ...preset,
      id: `preset_${Date.now()}`,
      createdAt: new Date(),
    };
    
    this.presets.push(newPreset);
    return newPreset.id;
  }

  async deletePreset(presetId: string): Promise<void> {
    this.presets = this.presets.filter(p => p.id !== presetId);
  }

  validateSetting(setting: ConfigurationSetting, value: any): string | null {
    if (!setting.validation) return null;

    const { required, min, max, pattern, custom } = setting.validation;

    if (required && (value === null || value === undefined || value === '')) {
      return 'This field is required';
    }

    if (typeof value === 'number') {
      if (min !== undefined && value < min) {
        return `Value must be at least ${min}`;
      }
      if (max !== undefined && value > max) {
        return `Value must be at most ${max}`;
      }
    }

    if (typeof value === 'string' && pattern) {
      const regex = new RegExp(pattern);
      if (!regex.test(value)) {
        return 'Invalid format';
      }
    }

    if (custom) {
      return custom(value);
    }

    return null;
  }

  async exportConfiguration(): Promise<string> {
    // Simulate export processing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const exportData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      configuration: this.currentConfig,
      metadata: {
        environment: this.currentConfig['system.environment'],
        exported_by: 'admin',
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  async importConfiguration(configData: string): Promise<void> {
    try {
      const data = JSON.parse(configData);
      
      if (!data.configuration) {
        throw new Error('Invalid configuration format');
      }

      await this.saveConfiguration(data.configuration);
    } catch (error) {
      throw new Error('Failed to import configuration: ' + (error as Error).message);
    }
  }
}

const ConfigurationManager: React.FC<ConfigurationManagerProps> = ({
  onConfigurationChange,
  onSaveConfiguration,
  onLoadConfiguration,
  enablePresets = true,
  enableImportExport = true,
  enableValidation = true,
}) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [sections, setSections] = useState<ConfigurationSection[]>([]);
  const [presets, setPresets] = useState<ConfigurationPreset[]>([]);
  const [currentConfig, setCurrentConfig] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    system: true,
    processing: true,
  });

  const configService = ConfigurationService.getInstance();

  // Load data on mount
  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setSections(configService.getSections());
    setPresets(configService.getPresets());
    setCurrentConfig(configService.getCurrentConfiguration());
  };

  // Handle setting change
  const handleSettingChange = async (settingId: string, value: any) => {
    const newConfig = { ...currentConfig, [settingId]: value };
    setCurrentConfig(newConfig);
    setHasUnsavedChanges(true);

    // Validate setting
    if (enableValidation) {
      const section = sections.find(s => s.settings.some(setting => setting.id === settingId));
      const setting = section?.settings.find(s => s.id === settingId);
      
      if (setting) {
        const error = configService.validateSetting(setting, value);
        setValidationErrors(prev => ({
          ...prev,
          [settingId]: error || '',
        }));
      }
    }

    // Update service
    try {
      await configService.updateSetting(settingId, value);
      onConfigurationChange?.(newConfig);
    } catch (error) {
      console.error('Failed to update setting:', error);
    }
  };

  // Handle save configuration
  const handleSaveConfiguration = async () => {
    setSaving(true);
    try {
      await configService.saveConfiguration(currentConfig);
      await onSaveConfiguration?.(currentConfig);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save configuration:', error);
    } finally {
      setSaving(false);
    }
  };

  // Handle apply preset
  const handleApplyPreset = async (presetId: string) => {
    try {
      await configService.applyPreset(presetId);
      refreshData();
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to apply preset:', error);
    }
  };

  // Handle export configuration
  const handleExportConfiguration = async () => {
    try {
      const configData = await configService.exportConfiguration();
      // In a real implementation, this would trigger a download
      console.log('Exported configuration:', configData);
      setExportDialogOpen(false);
    } catch (error) {
      console.error('Failed to export configuration:', error);
    }
  };

  // Handle import configuration
  const handleImportConfiguration = async (configData: string) => {
    try {
      await configService.importConfiguration(configData);
      refreshData();
      setHasUnsavedChanges(false);
      setImportDialogOpen(false);
    } catch (error) {
      console.error('Failed to import configuration:', error);
    }
  };

  // Render setting input
  const renderSettingInput = (setting: ConfigurationSetting) => {
    const error = validationErrors[setting.id];
    const isDisabled = setting.dependencies?.some(dep => !currentConfig[dep]);

    switch (setting.type) {
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={currentConfig[setting.id] || false}
                onChange={(e) => handleSettingChange(setting.id, e.target.checked)}
                disabled={isDisabled}
              />
            }
            label=""
          />
        );

      case 'select':
        return (
          <FormControl fullWidth size="small" error={!!error}>
            <Select
              value={currentConfig[setting.id] || ''}
              onChange={(e) => handleSettingChange(setting.id, e.target.value)}
              disabled={isDisabled}
            >
              {setting.options?.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case 'multiselect':
        return (
          <FormControl fullWidth size="small" error={!!error}>
            <Select
              multiple
              value={currentConfig[setting.id] || []}
              onChange={(e) => handleSettingChange(setting.id, e.target.value)}
              disabled={isDisabled}
            >
              {setting.options?.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Checkbox checked={(currentConfig[setting.id] || []).includes(option.value)} />
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case 'slider':
        return (
          <Box sx={{ px: 2 }}>
            <Slider
              value={currentConfig[setting.id] || setting.defaultValue}
              onChange={(_, value) => handleSettingChange(setting.id, value)}
              min={setting.validation?.min || 0}
              max={setting.validation?.max || 100}
              step={setting.validation?.max && setting.validation.max <= 1 ? 0.1 : 1}
              valueLabelDisplay="auto"
              disabled={isDisabled}
            />
          </Box>
        );

      case 'password':
        return (
          <TextField
            fullWidth
            size="small"
            type={showSensitive[setting.id] ? 'text' : 'password'}
            value={currentConfig[setting.id] || ''}
            onChange={(e) => handleSettingChange(setting.id, e.target.value)}
            error={!!error}
            helperText={error}
            disabled={isDisabled}
            InputProps={{
              endAdornment: (
                <IconButton
                  size="small"
                  onClick={() => setShowSensitive(prev => ({
                    ...prev,
                    [setting.id]: !prev[setting.id]
                  }))}
                >
                  {showSensitive[setting.id] ? <HideIcon /> : <ViewIcon />}
                </IconButton>
              ),
            }}
          />
        );

      case 'json':
        return (
          <TextField
            fullWidth
            multiline
            rows={4}
            size="small"
            value={currentConfig[setting.id] || ''}
            onChange={(e) => handleSettingChange(setting.id, e.target.value)}
            error={!!error}
            helperText={error}
            disabled={isDisabled}
            sx={{ fontFamily: 'monospace' }}
          />
        );

      case 'number':
        return (
          <TextField
            fullWidth
            size="small"
            type="number"
            value={currentConfig[setting.id] || ''}
            onChange={(e) => handleSettingChange(setting.id, parseFloat(e.target.value) || 0)}
            error={!!error}
            helperText={error}
            disabled={isDisabled}
            inputProps={{
              min: setting.validation?.min,
              max: setting.validation?.max,
            }}
          />
        );

      default:
        return (
          <TextField
            fullWidth
            size="small"
            value={currentConfig[setting.id] || ''}
            onChange={(e) => handleSettingChange(setting.id, e.target.value)}
            error={!!error}
            helperText={error}
            disabled={isDisabled}
          />
        );
    }
  };

  // Render configuration sections
  const renderConfigurationSections = () => (
    <Box>
      {sections.map((section) => (
        <Accordion
          key={section.id}
          expanded={expandedSections[section.id] || false}
          onChange={() => setExpandedSections(prev => ({
            ...prev,
            [section.id]: !prev[section.id]
          }))}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              {section.icon}
              <Typography variant="h6">{section.name}</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {section.description}
            </Typography>
            
            <Grid container spacing={3}>
              {section.settings.map((setting) => (
                <Grid item xs={12} md={6} key={setting.id}>
                  <Box>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Typography variant="subtitle2">
                        {setting.name}
                      </Typography>
                      {setting.restartRequired && (
                        <Chip label="Restart Required" size="small" color="warning" />
                      )}
                      {setting.sensitive && (
                        <Chip label="Sensitive" size="small" color="error" />
                      )}
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {setting.description}
                    </Typography>
                    
                    {renderSettingInput(setting)}
                  </Box>
                </Grid>
              ))}
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );

  // Render presets management
  const renderPresetsManagement = () => (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Configuration Presets</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setPresetDialogOpen(true)}
        >
          Create Preset
        </Button>
      </Box>

      <Grid container spacing={3}>
        {presets.map((preset) => (
          <Grid item xs={12} md={6} lg={4} key={preset.id}>
            <Card>
              <CardHeader
                title={
                  <Box display="flex" alignItems="center" gap={1}>
                    {preset.name}
                    {preset.isFavorite && <StarIcon color="primary" />}
                    {preset.isDefault && <Chip label="Default" size="small" />}
                  </Box>
                }
                subheader={preset.description}
                action={
                  <Chip
                    label={preset.category.toUpperCase()}
                    size="small"
                    color="primary"
                  />
                }
              />
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Created: {format(preset.createdAt, 'MMM dd, yyyy')}
                </Typography>
                {preset.lastUsed && (
                  <Typography variant="body2" color="text.secondary">
                    Last Used: {format(preset.lastUsed, 'MMM dd, yyyy')}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  Settings: {Object.keys(preset.settings).length}
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  startIcon={<RestoreIcon />}
                  onClick={() => handleApplyPreset(preset.id)}
                >
                  Apply
                </Button>
                <Button size="small" startIcon={<EditIcon />}>
                  Edit
                </Button>
                <Button size="small" startIcon={<DeleteIcon />}>
                  Delete
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Configuration Management</Typography>
        <Box display="flex" gap={1}>
          {enableImportExport && (
            <>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CloudUploadIcon />}
                onClick={() => setImportDialogOpen(true)}
              >
                Import
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CloudDownloadIcon />}
                onClick={() => setExportDialogOpen(true)}
              >
                Export
              </Button>
            </>
          )}
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSaveConfiguration}
            disabled={!hasUnsavedChanges || saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>

      {hasUnsavedChanges && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Unsaved Changes</AlertTitle>
          You have unsaved configuration changes. Remember to save your changes.
        </Alert>
      )}

      <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tab icon={<SettingsIcon />} label="Configuration" iconPosition="start" />
        {enablePresets && <Tab icon={<StarIcon />} label="Presets" iconPosition="start" />}
      </Tabs>

      {currentTab === 0 && renderConfigurationSections()}
      {currentTab === 1 && enablePresets && renderPresetsManagement()}

      {/* Import Dialog */}
      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Import Configuration</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={10}
            label="Configuration JSON"
            placeholder="Paste your configuration JSON here..."
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancel</Button>
          <Button variant="contained">Import</Button>
        </DialogActions>
      </Dialog>

      {/* Export Dialog */}
      <Dialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Export Configuration</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Export your current configuration as a JSON file.
          </Typography>
          <Button
            fullWidth
            variant="outlined"
            onClick={handleExportConfiguration}
            startIcon={<DownloadIcon />}
            sx={{ mt: 2 }}
          >
            Download Configuration
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConfigurationManager;
