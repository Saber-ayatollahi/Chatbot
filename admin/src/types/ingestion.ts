/**
 * TypeScript Interfaces for Ingestion Management System
 * Comprehensive type definitions for the ingestion UI components
 */

// Core Ingestion Types
export type IngestionMethod = 'enhanced' | 'standard' | 'simple' | 'advanced';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
export type JobType = 'initial_ingestion' | 'reingest' | 'batch_ingestion' | 'maintenance';
export type FileStatus = 'uploaded' | 'processing' | 'completed' | 'failed' | 'quarantined';
export type ValidationStatus = 'pending' | 'valid' | 'invalid' | 'warning';
export type BackupType = 'full' | 'incremental' | 'differential';
export type HealthStatus = 'healthy' | 'warning' | 'error' | 'maintenance';

// File Upload Interfaces
export interface FileUpload {
  uploadId: string;
  filename: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  fileHash: string;
  mimeType: string;
  uploadStatus: FileStatus;
  validationStatus: ValidationStatus;
  validationErrors?: string[];
  validationWarnings?: string[];
  metadata: FileMetadata;
  uploadProgress?: number;
  uploadedBy?: string;
  uploadedAt: Date;
  processedAt?: Date;
}

export interface FileMetadata {
  title?: string;
  author?: string;
  creationDate?: Date;
  modificationDate?: Date;
  totalPages?: number;
  characterCount?: number;
  wordCount?: number;
  language?: string;
  documentType?: string;
  extractedImages?: number;
  extractedTables?: number;
  extractedLinks?: number;
  qualityScore?: number;
  ocrProcessed?: boolean;
  securityScan?: SecurityScanResult;
}

export interface SecurityScanResult {
  scanned: boolean;
  scanDate: Date;
  virusDetected: boolean;
  malwareDetected: boolean;
  suspiciousContent: boolean;
  scanEngine: string;
  scanVersion: string;
  threats?: string[];
}

// Ingestion Job Interfaces
export interface IngestionJob {
  jobId: string;
  sourceId: string;
  jobType: JobType;
  jobStatus: JobStatus;
  method: IngestionMethod;
  configuration: IngestionConfig;
  progress: JobProgress;
  stats: ProcessingStats;
  error?: ErrorDetails;
  warnings?: string[];
  priority: number;
  dependencies?: string[];
  parentJobId?: string;
  childJobIds?: string[];
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;
  retryCount: number;
  maxRetries: number;
}

export interface IngestionConfig {
  method: IngestionMethod;
  chunkingOptions: ChunkingOptions;
  embeddingOptions: EmbeddingOptions;
  qualityOptions: QualityOptions;
  performanceOptions: PerformanceOptions;
  advancedOptions?: AdvancedOptions;
}

export interface ChunkingOptions {
  strategy: 'semantic' | 'hierarchical' | 'adaptive' | 'fixed';
  maxTokens: number;
  minTokens: number;
  overlapTokens: number;
  preserveStructure: boolean;
  semanticBoundaryDetection: boolean;
  sentenceSimilarityThreshold?: number;
  paragraphSimilarityThreshold?: number;
  sectionSimilarityThreshold?: number;
  hierarchicalOverlap?: boolean;
  parentChildRelationships?: boolean;
  crossReferenceTracking?: boolean;
  narrativeFlowPreservation?: boolean;
}

export interface EmbeddingOptions {
  model: string;
  batchSize: number;
  useCache: boolean;
  validateDimensions: boolean;
  embeddingTypes?: string[];
  domainOptimization?: boolean;
  domain?: string;
  keywordBoost?: number;
  qualityValidation?: boolean;
  minQualityScore?: number;
  maxCacheSize?: number;
}

export interface QualityOptions {
  minChunkQuality: number;
  minEmbeddingQuality: number;
  validateHierarchy: boolean;
  checkDuplicates: boolean;
  enableSemanticValidation: boolean;
  enableContextualEnrichment: boolean;
  qualityThresholds: QualityThresholds;
}

export interface QualityThresholds {
  minTokenCount: number;
  maxTokenCount: number;
  minCharacterCount: number;
  maxCharacterCount: number;
  minWordCount: number;
  maxWordCount: number;
  minQualityScore: number;
  maxErrorRate: number;
}

export interface PerformanceOptions {
  batchSize: number;
  parallelProcessing: boolean;
  memoryOptimization: boolean;
  progressReporting: boolean;
  delayBetweenDocuments: number;
  maxConcurrentJobs: number;
  timeoutMinutes: number;
  enableProfiling: boolean;
}

export interface AdvancedOptions {
  // Core Advanced Features
  hierarchicalChunking: boolean;
  multiScaleEmbeddings: boolean;
  advancedRetrieval: boolean;
  
  // Hierarchical Chunking Options
  hierarchicalChunkingOptions?: HierarchicalChunkingOptions;
  
  // Multi-Scale Embedding Options
  multiScaleEmbeddingOptions?: MultiScaleEmbeddingOptions;
  
  // Advanced Retrieval Options
  advancedRetrievalOptions?: AdvancedRetrievalOptions;
  
  // Legacy Options (maintained for compatibility)
  crossDocumentLinking: boolean;
  semanticValidation: boolean;
  contextualEnrichment: boolean;
  adaptiveChunking: boolean;
  structureAwareChunking: boolean;
  contentTypeSpecificStrategies: boolean;
  qualityBasedAdaptiveChunking: boolean;
  enableExperimentalFeatures: boolean;
  customProcessingRules?: ProcessingRule[];
}

export interface HierarchicalChunkingOptions {
  enabled: boolean;
  scales: {
    document: ScaleConfig;
    section: ScaleConfig;
    paragraph: ScaleConfig;
    sentence: ScaleConfig;
  };
  semanticCoherence: {
    enabled: boolean;
    sentenceSimilarityThreshold: number;
    paragraphSimilarityThreshold: number;
    sectionSimilarityThreshold: number;
  };
  qualityThresholds: {
    minTokenCount: number;
    maxTokenCount: number;
    minQualityScore: number;
  };
  hierarchicalRelationships: {
    enableParentChildLinks: boolean;
    enableSiblingLinks: boolean;
    enableCrossReferences: boolean;
  };
}

export interface ScaleConfig {
  enabled: boolean;
  minTokens: number;
  maxTokens: number;
  targetTokens: number;
  overlapTokens: number;
}

export interface MultiScaleEmbeddingOptions {
  enabled: boolean;
  embeddingTypes: {
    content: boolean;
    contextual: boolean;
    hierarchical: boolean;
    semantic: boolean;
  };
  domainOptimization: {
    enabled: boolean;
    domain: string;
    keywordBoost: number;
    strategies: {
      selectiveBoost: boolean;
      weightedEnhancement: boolean;
      dimensionalFocus: boolean;
    };
  };
  qualityValidation: {
    enabled: boolean;
    minQualityThreshold: number;
    validateDimensions: boolean;
  };
  caching: {
    enabled: boolean;
    maxCacheSize: number;
    cacheExpiration: number;
  };
}

export interface AdvancedRetrievalOptions {
  enabled: boolean;
  strategies: {
    vectorOnly: boolean;
    hybrid: boolean;
    multiScale: boolean;
    contextual: boolean;
  };
  contextExpansion: {
    enabled: boolean;
    hierarchicalExpansion: boolean;
    semanticExpansion: boolean;
    temporalExpansion: boolean;
    maxExpansionChunks: number;
  };
  lostInMiddleMitigation: {
    enabled: boolean;
    reorderByRelevance: boolean;
    interleaveChunks: boolean;
    maxReorderDistance: number;
  };
  qualityOptimization: {
    enabled: boolean;
    coherenceScoring: boolean;
    redundancyReduction: boolean;
    complementarityMaximization: boolean;
    minCoherenceScore: number;
    maxRedundancyScore: number;
  };
}

export interface ProcessingRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: string;
  parameters: Record<string, any>;
  enabled: boolean;
  priority: number;
}

export interface JobProgress {
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  progressPercentage: number;
  estimatedTimeRemaining?: number;
  currentOperation?: string;
  itemsProcessed: number;
  totalItems: number;
  processingRate?: number;
  lastUpdateTime: Date;
}

export interface ProcessingStats {
  documentsProcessed: number;
  chunksGenerated: number;
  embeddingsCreated: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  averageChunkQuality: number;
  averageEmbeddingQuality: number;
  hierarchyCoherence?: number;
  overallQualityScore: number;
  errorCount: number;
  warningCount: number;
  retryCount: number;
  cacheHitRate?: number;
  memoryUsage?: MemoryUsage;
  performanceMetrics?: PerformanceMetrics;
}

export interface MemoryUsage {
  peak: number;
  average: number;
  current: number;
  unit: 'bytes' | 'KB' | 'MB' | 'GB';
}

export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskIO: number;
  networkIO: number;
  databaseConnections: number;
  apiCalls: number;
  cacheOperations: number;
}

export interface ErrorDetails {
  errorCode: string;
  errorMessage: string;
  errorType: 'validation' | 'processing' | 'system' | 'network' | 'database';
  severity: 'low' | 'medium' | 'high' | 'critical';
  stackTrace?: string;
  context?: Record<string, any>;
  timestamp: Date;
  recoverable: boolean;
  retryable: boolean;
  suggestedActions?: string[];
}

// Knowledge Base Interfaces
export interface KnowledgeBaseStats {
  totalSources: number;
  totalChunks: number;
  totalEmbeddings: number;
  averageQuality: number;
  totalTokens: number;
  totalCharacters: number;
  totalWords: number;
  uniqueDocuments: number;
  duplicateChunks: number;
  lastUpdated: Date;
  healthStatus: HealthStatus;
  storageUsed: StorageInfo;
  indexHealth: IndexHealth;
  performanceStats: KBPerformanceStats;
}

export interface StorageInfo {
  totalSize: number;
  usedSize: number;
  availableSize: number;
  unit: 'bytes' | 'KB' | 'MB' | 'GB' | 'TB';
  compressionRatio?: number;
}

export interface IndexHealth {
  vectorIndexHealth: number;
  textIndexHealth: number;
  metadataIndexHealth: number;
  lastOptimized: Date;
  fragmentationLevel: number;
  queryPerformance: number;
}

export interface KBPerformanceStats {
  averageQueryTime: number;
  averageInsertTime: number;
  averageUpdateTime: number;
  averageDeleteTime: number;
  queriesPerSecond: number;
  insertsPerSecond: number;
  cacheHitRate: number;
  indexUtilization: number;
}

export interface DocumentSource {
  sourceId: string;
  filename: string;
  title: string;
  author?: string;
  version: string;
  documentType: string;
  fileSize: number;
  totalPages: number;
  totalChunks: number;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  qualityScore: number;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  lastAccessedAt?: Date;
  accessCount: number;
  metadata: Record<string, any>;
  tags?: string[];
  categories?: string[];
}

export interface ChunkInfo {
  chunkId: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  heading?: string;
  subheading?: string;
  pageNumbers?: number[];
  sectionPath?: string[];
  contentType: string;
  tokenCount: number;
  characterCount: number;
  wordCount: number;
  qualityScore: number;
  embeddingTypes: string[];
  parentChunkId?: string;
  childChunkIds?: string[];
  siblingChunkIds?: string[];
  scale?: string;
  hierarchyLevel?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Backup and Restore Interfaces
export interface KnowledgeBaseBackup {
  backupId: string;
  backupName: string;
  backupPath: string;
  backupSize: number;
  backupType: BackupType;
  compressionType?: string;
  encryptionEnabled: boolean;
  sourcesCount: number;
  chunksCount: number;
  embeddingsCount: number;
  createdBy?: string;
  createdAt: Date;
  restoredAt?: Date;
  backupStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  backupProgress?: number;
  estimatedCompletion?: Date;
  metadata: BackupMetadata;
  verificationStatus?: 'pending' | 'verified' | 'failed';
  retentionPolicy?: RetentionPolicy;
}

export interface BackupMetadata {
  version: string;
  databaseVersion: string;
  schemaVersion: string;
  applicationVersion: string;
  backupMethod: 'full' | 'incremental' | 'differential';
  compressionRatio?: number;
  encryptionAlgorithm?: string;
  checksums: Record<string, string>;
  dependencies?: string[];
  tags?: string[];
  description?: string;
}

export interface RetentionPolicy {
  retentionDays: number;
  autoDelete: boolean;
  archiveAfterDays?: number;
  compressionAfterDays?: number;
  notifyBeforeDelete?: boolean;
  notificationDays?: number;
}

export interface RestoreOptions {
  backupId: string;
  restoreType: 'full' | 'selective' | 'merge';
  selectedSources?: string[];
  selectedChunks?: string[];
  overwriteExisting: boolean;
  validateIntegrity: boolean;
  createBackupBeforeRestore: boolean;
  restoreMetadata: boolean;
  restoreIndexes: boolean;
  dryRun: boolean;
}

// Monitoring and Analytics Interfaces
export interface SystemMonitoring {
  systemHealth: HealthStatus;
  activeJobs: number;
  queuedJobs: number;
  completedJobs: number;
  failedJobs: number;
  systemLoad: SystemLoad;
  resourceUsage: ResourceUsage;
  alertsActive: number;
  lastHealthCheck: Date;
  uptime: number;
  version: string;
}

export interface SystemLoad {
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  database: number;
  loadAverage: number[];
  processCount: number;
  threadCount: number;
}

export interface ResourceUsage {
  memory: MemoryUsage;
  disk: DiskUsage;
  network: NetworkUsage;
  database: DatabaseUsage;
}

export interface DiskUsage {
  total: number;
  used: number;
  available: number;
  usagePercentage: number;
  iopsRead: number;
  iopsWrite: number;
  throughputRead: number;
  throughputWrite: number;
}

export interface NetworkUsage {
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  connectionsActive: number;
  connectionsTotal: number;
  bandwidth: number;
  latency: number;
}

export interface DatabaseUsage {
  connections: number;
  maxConnections: number;
  activeQueries: number;
  slowQueries: number;
  cacheHitRate: number;
  indexUsage: number;
  storageUsed: number;
  storageAvailable: number;
}

export interface IngestionAnalytics {
  totalDocumentsProcessed: number;
  totalChunksGenerated: number;
  totalEmbeddingsCreated: number;
  averageProcessingTime: number;
  averageQualityScore: number;
  successRate: number;
  errorRate: number;
  retryRate: number;
  methodUsageStats: MethodUsageStats;
  timeSeriesData: TimeSeriesData[];
  performanceTrends: PerformanceTrend[];
  qualityTrends: QualityTrend[];
  errorAnalysis: ErrorAnalysis;
}

export interface MethodUsageStats {
  enhanced: MethodStats;
  standard: MethodStats;
  simple: MethodStats;
  advanced: MethodStats;
}

export interface MethodStats {
  usageCount: number;
  successRate: number;
  averageTime: number;
  averageQuality: number;
  totalDocuments: number;
  totalChunks: number;
  totalEmbeddings: number;
}

export interface TimeSeriesData {
  timestamp: Date;
  documentsProcessed: number;
  chunksGenerated: number;
  embeddingsCreated: number;
  averageQuality: number;
  processingTime: number;
  errorCount: number;
  successCount: number;
}

export interface PerformanceTrend {
  period: string;
  averageProcessingTime: number;
  throughput: number;
  resourceUtilization: number;
  trend: 'improving' | 'stable' | 'degrading';
  changePercentage: number;
}

export interface QualityTrend {
  period: string;
  averageQuality: number;
  qualityDistribution: QualityDistribution;
  trend: 'improving' | 'stable' | 'degrading';
  changePercentage: number;
}

export interface QualityDistribution {
  excellent: number; // 0.9-1.0
  good: number;      // 0.7-0.9
  fair: number;      // 0.5-0.7
  poor: number;      // 0.0-0.5
}

export interface ErrorAnalysis {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByMethod: Record<IngestionMethod, number>;
  errorsByTime: TimeSeriesData[];
  commonErrors: CommonError[];
  errorResolutionStats: ErrorResolutionStats;
}

export interface CommonError {
  errorCode: string;
  errorMessage: string;
  occurrences: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  affectedMethods: IngestionMethod[];
  resolution?: string;
  preventionTips?: string[];
}

export interface ErrorResolutionStats {
  autoResolved: number;
  manualResolved: number;
  unresolved: number;
  averageResolutionTime: number;
  resolutionRate: number;
}

// UI Component Props Interfaces
export interface IngestionDashboardProps {
  initialTab?: number;
  refreshInterval?: number;
  enableRealTimeUpdates?: boolean;
}

export interface DocumentUploadProps {
  onUpload: (files: File[]) => Promise<void>;
  onUploadProgress: (progress: number) => void;
  onUploadComplete: (uploads: FileUpload[]) => void;
  onUploadError: (error: Error) => void;
  supportedFormats: string[];
  maxFileSize: number;
  maxFiles: number;
  stagingFolder: string;
  enableDragDrop: boolean;
  enableBulkUpload: boolean;
  enablePreview: boolean;
}

export interface ProcessingPipelineProps {
  methods: IngestionMethod[];
  onMethodSelect: (method: IngestionMethod) => void;
  onConfigurationChange: (config: IngestionConfig) => void;
  onStartProcessing: (config: IngestionConfig) => Promise<void>;
  onStopProcessing: (jobId: string) => Promise<void>;
  onPauseProcessing: (jobId: string) => Promise<void>;
  onResumeProcessing: (jobId: string) => Promise<void>;
  currentJob?: IngestionJob;
  availableConfigurations?: IngestionConfig[];
  enableAdvancedOptions: boolean;
}

export interface StatusMonitoringProps {
  knowledgeBaseStats: KnowledgeBaseStats;
  systemMonitoring: SystemMonitoring;
  activeJobs: IngestionJob[];
  recentActivity: ActivityLog[];
  refreshInterval?: number;
  enableAlerts: boolean;
  enableNotifications: boolean;
}

export interface ActivityLog {
  id: string;
  timestamp: Date;
  type: 'info' | 'warning' | 'error' | 'success';
  category: 'ingestion' | 'system' | 'user' | 'backup' | 'maintenance';
  message: string;
  details?: Record<string, any>;
  userId?: string;
  jobId?: string;
  sourceId?: string;
}

export interface KnowledgeBaseManagerProps {
  sources: DocumentSource[];
  chunks: ChunkInfo[];
  onDeleteSource: (sourceId: string) => Promise<void>;
  onDeleteChunk: (chunkId: string) => Promise<void>;
  onClearKnowledgeBase: () => Promise<void>;
  onBackupKnowledgeBase: (options: BackupOptions) => Promise<void>;
  onRestoreKnowledgeBase: (options: RestoreOptions) => Promise<void>;
  onExportData: (format: string, options: ExportOptions) => Promise<void>;
  enableBulkOperations: boolean;
  enableAdvancedSearch: boolean;
}

export interface BackupOptions {
  backupName: string;
  backupType: BackupType;
  includeEmbeddings: boolean;
  includeMetadata: boolean;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  retentionPolicy?: RetentionPolicy;
  description?: string;
  tags?: string[];
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'excel' | 'xml';
  includeMetadata: boolean;
  includeEmbeddings: boolean;
  includeContent: boolean;
  dateRange?: DateRange;
  sources?: string[];
  compressionEnabled: boolean;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// API Response Interfaces
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  timestamp: Date;
  requestId?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationInfo;
  totalCount: number;
  hasMore: boolean;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Configuration and Settings Interfaces
export interface IngestionSettings {
  defaultMethod: IngestionMethod;
  defaultConfiguration: IngestionConfig;
  autoProcessing: boolean;
  notifications: NotificationSettings;
  security: SecuritySettings;
  performance: PerformanceSettings;
  backup: BackupSettings;
  monitoring: MonitoringSettings;
}

export interface NotificationSettings {
  enabled: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  slackIntegration: boolean;
  webhookUrl?: string;
  notificationTypes: NotificationType[];
}

export interface NotificationType {
  type: string;
  enabled: boolean;
  threshold?: number;
  recipients?: string[];
}

export interface SecuritySettings {
  enableVirusScanning: boolean;
  enableContentFiltering: boolean;
  enablePIIDetection: boolean;
  quarantineEnabled: boolean;
  encryptionEnabled: boolean;
  accessControl: AccessControlSettings;
}

export interface AccessControlSettings {
  requireAuthentication: boolean;
  allowedRoles: string[];
  allowedUsers: string[];
  ipWhitelist?: string[];
  sessionTimeout: number;
}

export interface PerformanceSettings {
  maxConcurrentJobs: number;
  defaultBatchSize: number;
  memoryLimit: number;
  timeoutMinutes: number;
  cacheEnabled: boolean;
  cacheSize: number;
  optimizationLevel: 'low' | 'medium' | 'high';
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  backupSchedule: string; // cron expression
  retentionDays: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  backupLocation: string;
  maxBackups: number;
}

export interface MonitoringSettings {
  metricsEnabled: boolean;
  loggingLevel: 'debug' | 'info' | 'warn' | 'error';
  alertsEnabled: boolean;
  healthCheckInterval: number;
  performanceMonitoring: boolean;
  auditLogging: boolean;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Event Types for Real-time Updates
export interface IngestionEvent {
  type: IngestionEventType;
  jobId?: string;
  sourceId?: string;
  data: any;
  timestamp: Date;
}

export type IngestionEventType = 
  | 'job_started'
  | 'job_progress'
  | 'job_completed'
  | 'job_failed'
  | 'job_cancelled'
  | 'job_paused'
  | 'job_resumed'
  | 'file_uploaded'
  | 'file_processed'
  | 'kb_updated'
  | 'backup_created'
  | 'backup_restored'
  | 'system_alert'
  | 'error_occurred';

// Hook Return Types
export interface UseIngestionJobsReturn {
  jobs: IngestionJob[];
  activeJobs: IngestionJob[];
  completedJobs: IngestionJob[];
  failedJobs: IngestionJob[];
  loading: boolean;
  error: string | null;
  createJob: (config: IngestionConfig) => Promise<IngestionJob>;
  cancelJob: (jobId: string) => Promise<void>;
  pauseJob: (jobId: string) => Promise<void>;
  resumeJob: (jobId: string) => Promise<void>;
  retryJob: (jobId: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  refreshJobs: () => Promise<void>;
}

export interface UseKnowledgeBaseReturn {
  stats: KnowledgeBaseStats | null;
  sources: DocumentSource[];
  loading: boolean;
  error: string | null;
  clearKnowledgeBase: () => Promise<void>;
  deleteSource: (sourceId: string) => Promise<void>;
  backupKnowledgeBase: (options: BackupOptions) => Promise<void>;
  restoreKnowledgeBase: (options: RestoreOptions) => Promise<void>;
  refreshStats: () => Promise<void>;
  refreshSources: () => Promise<void>;
}

export interface UseFileUploadReturn {
  uploads: FileUpload[];
  uploading: boolean;
  uploadProgress: number;
  error: string | null;
  uploadFiles: (files: File[]) => Promise<void>;
  cancelUpload: (uploadId: string) => Promise<void>;
  retryUpload: (uploadId: string) => Promise<void>;
  deleteUpload: (uploadId: string) => Promise<void>;
  clearUploads: () => void;
}

export interface UseRealTimeUpdatesReturn {
  connected: boolean;
  events: IngestionEvent[];
  subscribe: (eventTypes: IngestionEventType[]) => void;
  unsubscribe: (eventTypes: IngestionEventType[]) => void;
  clearEvents: () => void;
}

export interface UseIngestionAnalyticsReturn {
  analytics: IngestionAnalytics | null;
  loading: boolean;
  error: string | null;
  refreshAnalytics: () => Promise<void>;
  getAnalyticsByDateRange: (startDate: Date, endDate: Date) => Promise<IngestionAnalytics>;
  exportAnalytics: (format: string) => Promise<void>;
}
