# API Requirements for Ingestion Management System

## 🎯 **Overview**

This document outlines the API endpoints required for the Ingestion Management UI system. These endpoints will be implemented as extensions to the existing admin routes.

## 📁 **File Structure**

```
routes/
├── admin.js (existing - will be extended)
└── ingestion.js (new - dedicated ingestion routes)

services/
├── IngestionJobManager.js (new)
├── FileUploadService.js (new)
├── KnowledgeBaseManager.js (new)
└── IngestionMonitoringService.js (new)
```

## 🔗 **API Endpoints**

### **File Upload Management**

#### **POST /admin/ingestion/upload**
Upload documents to staging area
```typescript
Request: FormData with files
Response: {
  success: boolean;
  uploads: FileUpload[];
  message: string;
}
```

#### **GET /admin/ingestion/staging**
List files in staging area
```typescript
Query Parameters:
- page?: number
- limit?: number
- filter?: string
- sortBy?: string
- sortOrder?: 'asc' | 'desc'

Response: PaginatedResponse<FileUpload>
```

#### **DELETE /admin/ingestion/staging/:fileId**
Remove file from staging
```typescript
Response: {
  success: boolean;
  message: string;
}
```

#### **POST /admin/ingestion/staging/validate**
Validate staged files
```typescript
Request: {
  fileIds: string[];
}
Response: {
  success: boolean;
  validationResults: ValidationResult[];
}
```

### **Job Management**

#### **POST /admin/ingestion/jobs**
Create new ingestion job
```typescript
Request: {
  sourceIds: string[];
  method: IngestionMethod;
  configuration: IngestionConfig;
  priority?: number;
}
Response: {
  success: boolean;
  job: IngestionJob;
}
```

#### **GET /admin/ingestion/jobs**
List ingestion jobs
```typescript
Query Parameters:
- page?: number
- limit?: number
- status?: JobStatus
- method?: IngestionMethod
- dateFrom?: string
- dateTo?: string

Response: PaginatedResponse<IngestionJob>
```

#### **GET /admin/ingestion/jobs/:jobId**
Get specific job details
```typescript
Response: {
  success: boolean;
  job: IngestionJob;
}
```

#### **PUT /admin/ingestion/jobs/:jobId**
Update job (pause/resume/cancel)
```typescript
Request: {
  action: 'pause' | 'resume' | 'cancel' | 'retry';
}
Response: {
  success: boolean;
  job: IngestionJob;
}
```

#### **DELETE /admin/ingestion/jobs/:jobId**
Delete job
```typescript
Response: {
  success: boolean;
  message: string;
}
```

#### **POST /admin/ingestion/jobs/batch**
Create batch job
```typescript
Request: {
  documents: Array<{
    filePath: string;
    sourceId: string;
    version: string;
  }>;
  method: IngestionMethod;
  configuration: IngestionConfig;
}
Response: {
  success: boolean;
  batchJob: IngestionJob;
}
```

### **Knowledge Base Management**

#### **GET /admin/ingestion/kb/status**
Get knowledge base statistics
```typescript
Response: {
  success: boolean;
  stats: KnowledgeBaseStats;
}
```

#### **GET /admin/ingestion/kb/sources**
List document sources
```typescript
Query Parameters:
- page?: number
- limit?: number
- search?: string
- status?: string
- dateFrom?: string
- dateTo?: string

Response: PaginatedResponse<DocumentSource>
```

#### **DELETE /admin/ingestion/kb/sources/:sourceId**
Delete document source
```typescript
Response: {
  success: boolean;
  message: string;
}
```

#### **POST /admin/ingestion/kb/backup**
Create knowledge base backup
```typescript
Request: {
  backupName: string;
  backupType: BackupType;
  options: BackupOptions;
}
Response: {
  success: boolean;
  backup: KnowledgeBaseBackup;
}
```

#### **POST /admin/ingestion/kb/restore**
Restore knowledge base from backup
```typescript
Request: {
  backupId: string;
  options: RestoreOptions;
}
Response: {
  success: boolean;
  message: string;
}
```

#### **DELETE /admin/ingestion/kb/clear**
Clear entire knowledge base
```typescript
Request: {
  confirmation: 'DELETE'; // Required confirmation
  createBackup?: boolean;
}
Response: {
  success: boolean;
  message: string;
  backupId?: string;
}
```

#### **GET /admin/ingestion/kb/chunks**
List chunks with filtering
```typescript
Query Parameters:
- page?: number
- limit?: number
- sourceId?: string
- search?: string
- qualityMin?: number
- qualityMax?: number

Response: PaginatedResponse<ChunkInfo>
```

### **Monitoring and Analytics**

#### **GET /admin/ingestion/status**
Get system status
```typescript
Response: {
  success: boolean;
  monitoring: SystemMonitoring;
}
```

#### **GET /admin/ingestion/metrics**
Get performance metrics
```typescript
Query Parameters:
- period?: 'hour' | 'day' | 'week' | 'month'
- dateFrom?: string
- dateTo?: string

Response: {
  success: boolean;
  analytics: IngestionAnalytics;
}
```

#### **GET /admin/ingestion/logs**
Get ingestion logs
```typescript
Query Parameters:
- page?: number
- limit?: number
- level?: 'debug' | 'info' | 'warn' | 'error'
- category?: string
- dateFrom?: string
- dateTo?: string

Response: PaginatedResponse<ActivityLog>
```

#### **GET /admin/ingestion/health**
Health check endpoint
```typescript
Response: {
  success: boolean;
  health: {
    status: HealthStatus;
    checks: HealthCheck[];
    timestamp: string;
  };
}
```

### **Configuration Management**

#### **GET /admin/ingestion/config**
Get ingestion configuration
```typescript
Response: {
  success: boolean;
  config: IngestionSettings;
}
```

#### **PUT /admin/ingestion/config**
Update ingestion configuration
```typescript
Request: Partial<IngestionSettings>
Response: {
  success: boolean;
  config: IngestionSettings;
}
```

#### **GET /admin/ingestion/presets**
Get configuration presets
```typescript
Response: {
  success: boolean;
  presets: Array<{
    id: string;
    name: string;
    description: string;
    config: IngestionConfig;
  }>;
}
```

### **Export and Reporting**

#### **POST /admin/ingestion/export**
Export data
```typescript
Request: {
  type: 'sources' | 'chunks' | 'jobs' | 'logs';
  format: 'json' | 'csv' | 'excel';
  options: ExportOptions;
}
Response: File download or {
  success: boolean;
  downloadUrl: string;
}
```

#### **POST /admin/ingestion/reports**
Generate reports
```typescript
Request: {
  type: 'performance' | 'quality' | 'usage' | 'errors';
  period: DateRange;
  format: 'pdf' | 'excel' | 'json';
}
Response: {
  success: boolean;
  reportId: string;
  downloadUrl?: string;
}
```

### **WebSocket Events**

#### **Connection: /admin/ingestion/updates**
Real-time updates via WebSocket

**Event Types:**
- `job_started`
- `job_progress`
- `job_completed`
- `job_failed`
- `job_cancelled`
- `file_uploaded`
- `file_processed`
- `kb_updated`
- `system_alert`
- `error_occurred`

**Event Format:**
```typescript
{
  type: IngestionEventType;
  jobId?: string;
  sourceId?: string;
  data: any;
  timestamp: string;
}
```

## 🔐 **Authentication & Authorization**

All endpoints require admin authentication:
```typescript
Headers: {
  'Authorization': 'Bearer <admin_token>',
  'Content-Type': 'application/json'
}
```

**Required Permissions:**
- `admin:ingestion:read` - View ingestion data
- `admin:ingestion:write` - Create/update ingestion jobs
- `admin:ingestion:delete` - Delete jobs/sources
- `admin:kb:manage` - Manage knowledge base
- `admin:system:monitor` - View system metrics

## 📊 **Rate Limiting**

- **File Upload**: 10 requests per minute per user
- **Job Creation**: 5 requests per minute per user
- **General API**: 100 requests per minute per user
- **WebSocket**: 1 connection per user

## 🚨 **Error Handling**

**Standard Error Response:**
```typescript
{
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId: string;
}
```

**Common Error Codes:**
- `INVALID_REQUEST` - Malformed request
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Input validation failed
- `PROCESSING_ERROR` - Internal processing error
- `RATE_LIMITED` - Too many requests
- `SERVICE_UNAVAILABLE` - Service temporarily unavailable

## 📝 **Request/Response Examples**

### **Create Ingestion Job**
```bash
POST /admin/ingestion/jobs
Content-Type: application/json
Authorization: Bearer <token>

{
  "sourceIds": ["doc1", "doc2"],
  "method": "enhanced",
  "configuration": {
    "chunkingOptions": {
      "strategy": "semantic",
      "maxTokens": 450,
      "overlapTokens": 50
    },
    "embeddingOptions": {
      "model": "text-embedding-3-large",
      "batchSize": 100
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "job": {
    "jobId": "job_123456",
    "sourceId": "batch_001",
    "jobType": "batch_ingestion",
    "jobStatus": "pending",
    "method": "enhanced",
    "createdAt": "2024-01-15T10:30:00Z",
    "progress": {
      "currentStep": "initializing",
      "progressPercentage": 0,
      "totalSteps": 8
    }
  }
}
```

### **Upload Files**
```bash
POST /admin/ingestion/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

files: [file1.pdf, file2.docx]
```

**Response:**
```json
{
  "success": true,
  "uploads": [
    {
      "uploadId": "upload_789",
      "filename": "file1.pdf",
      "originalName": "document.pdf",
      "fileSize": 1024000,
      "uploadStatus": "completed",
      "validationStatus": "valid"
    }
  ],
  "message": "2 files uploaded successfully"
}
```

## 🧪 **Testing Requirements**

### **Unit Tests**
- API endpoint validation
- Service layer functionality
- Error handling scenarios
- Authentication/authorization

### **Integration Tests**
- End-to-end job processing
- File upload workflows
- WebSocket connections
- Database operations

### **Performance Tests**
- Concurrent job processing
- Large file uploads
- High-frequency API calls
- Memory usage under load

## 📈 **Monitoring & Logging**

### **Metrics to Track**
- API response times
- Request success/failure rates
- Job processing times
- File upload speeds
- WebSocket connection stability
- Database query performance

### **Log Levels**
- **DEBUG**: Detailed processing information
- **INFO**: General operational messages
- **WARN**: Non-critical issues
- **ERROR**: Error conditions requiring attention

### **Health Checks**
- Database connectivity
- File system access
- External service availability
- Memory/CPU usage
- Queue status

## 🔄 **Implementation Priority**

### **Phase 1 (Days 1-5): Foundation**
1. Basic job management endpoints
2. File upload endpoints
3. Knowledge base status endpoints
4. Authentication middleware

### **Phase 2 (Days 6-10): Core Features**
1. Advanced job operations
2. File validation and processing
3. WebSocket implementation
4. Basic monitoring endpoints

### **Phase 3 (Days 11-15): Advanced Features**
1. Analytics and metrics
2. Export functionality
3. Configuration management
4. Advanced filtering/search

### **Phase 4 (Days 16-20): Polish & Optimization**
1. Performance optimization
2. Advanced error handling
3. Comprehensive logging
4. Documentation and testing

This API specification provides the foundation for the ingestion management system and will be implemented progressively according to the project timeline.
