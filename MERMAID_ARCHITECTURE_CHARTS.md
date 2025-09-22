# Fund Management Chatbot - Mermaid Architecture Charts

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UC[User Client<br/>React + TypeScript]
        AC[Admin Dashboard<br/>React + TypeScript]
    end
    
    subgraph "API Gateway"
        ES[Express Server<br/>Port 5000]
        WS[WebSocket Server<br/>Real-time Communication]
    end
    
    subgraph "Service Layer"
        CS[Chat Service<br/>RAG Processing]
        DPS[Document Processing<br/>Service]
        AS[Auth Service<br/>JWT + RBAC]
        CRS[Compliance<br/>Reporting Service]
        AL[Audit Logger]
        EM[Encryption Manager]
    end
    
    subgraph "Data Layer"
        PG[(PostgreSQL<br/>+ pgvector)]
        KB[Knowledge Base<br/>Documents & Vectors]
        FS[File System<br/>Document Storage]
    end
    
    subgraph "External Services"
        OAI[OpenAI API<br/>GPT-4 + Embeddings]
    end
    
    UC --> ES
    AC --> ES
    UC <--> WS
    AC <--> WS
    
    ES --> CS
    ES --> DPS
    ES --> AS
    ES --> CRS
    ES --> AL
    
    CS --> PG
    CS --> KB
    CS --> OAI
    DPS --> PG
    DPS --> FS
    DPS --> KB
    AS --> PG
    CRS --> PG
    AL --> PG
    EM --> PG
    
    style UC fill:#e1f5fe
    style AC fill:#e8f5e8
    style ES fill:#fff3e0
    style PG fill:#f3e5f5
    style OAI fill:#ffebee
```

## 2. Data Flow Architecture

```mermaid
flowchart TD
    subgraph "Document Ingestion Flow"
        A[Document Upload] --> B[File Validation]
        B --> C[Content Extraction<br/>PDF/DOCX/TXT]
        C --> D[Text Preprocessing]
        D --> E[Intelligent Chunking]
        E --> F[Generate Embeddings<br/>OpenAI API]
        F --> G[Store in pgvector]
        G --> H[Index for Search]
    end
    
    subgraph "Chat Query Flow"
        I[User Query] --> J[Query Classification]
        J --> K[Semantic Search<br/>Vector Similarity]
        K --> L[Context Retrieval]
        L --> M[Prompt Engineering]
        M --> N[OpenAI API Call]
        N --> O[Response Generation]
        O --> P[Citation Addition]
        P --> Q[Response to User]
    end
    
    subgraph "Compliance & Audit Flow"
        R[User Action] --> S[Audit Logger]
        S --> T[PII Detection]
        T --> U[Encryption]
        U --> V[Store Audit Log]
        V --> W[Compliance Report]
    end
    
    H --> K
    Q --> R
    
    style A fill:#e3f2fd
    style I fill:#e8f5e8
    style R fill:#fff3e0
```

## 3. Service Component Architecture

```mermaid
graph LR
    subgraph "Core Services"
        RAG[RAGChatService<br/>• Query Processing<br/>• Context Retrieval<br/>• Response Generation]
        
        DOC[DocumentProcessingService<br/>• File Parsing<br/>• Content Extraction<br/>• Chunking Strategy]
        
        AUTH[AuthService<br/>• JWT Management<br/>• RBAC<br/>• Session Control]
    end
    
    subgraph "Specialized Services"
        COMP[ComplianceReportGenerator<br/>• Regulatory Reports<br/>• Audit Summaries<br/>• Risk Assessment]
        
        AUDIT[AuditLogger<br/>• Activity Tracking<br/>• Security Events<br/>• Compliance Logs]
        
        ENC[EncryptionManager<br/>• Data Encryption<br/>• Key Management<br/>• Security Validation]
    end
    
    subgraph "AI/ML Services"
        FEEDBACK[FeedbackAnalysisSystem<br/>• User Feedback<br/>• Quality Metrics<br/>• Improvement Suggestions]
        
        FINETUNE[ModelFineTuningService<br/>• Custom Training<br/>• Model Optimization<br/>• Performance Tuning]
        
        PII[PIIDetector<br/>• Sensitive Data Detection<br/>• Privacy Protection<br/>• Data Masking]
    end
    
    subgraph "Knowledge Management"
        KB[KnowledgeBaseMaintenanceSystem<br/>• Document Sync<br/>• Version Control<br/>• Content Updates]
        
        CHUNK[SmartChunkSelector<br/>• Context Selection<br/>• Relevance Scoring<br/>• Chunk Optimization]
        
        QUERY[QueryClassifier<br/>• Intent Recognition<br/>• Query Routing<br/>• Context Analysis]
    end
    
    RAG --> CHUNK
    RAG --> QUERY
    DOC --> KB
    AUTH --> AUDIT
    COMP --> AUDIT
    FEEDBACK --> FINETUNE
    RAG --> PII
    
    style RAG fill:#e1f5fe
    style DOC fill:#e8f5e8
    style AUTH fill:#fff3e0
    style COMP fill:#f3e5f5
```

## 4. Database Schema Architecture

```mermaid
erDiagram
    USERS {
        uuid id PK
        string username UK
        string email UK
        string password_hash
        string role
        timestamp created_at
        timestamp updated_at
        boolean is_active
    }
    
    DOCUMENTS {
        uuid id PK
        string filename
        string original_name
        string mime_type
        integer file_size
        string storage_path
        string processing_status
        json metadata
        timestamp uploaded_at
        uuid uploaded_by FK
    }
    
    CHUNKS {
        uuid id PK
        uuid document_id FK
        text content
        vector embedding
        integer chunk_index
        json metadata
        float confidence_score
        timestamp created_at
    }
    
    CONVERSATIONS {
        uuid id PK
        uuid user_id FK
        string session_id
        json messages
        timestamp started_at
        timestamp last_activity
        boolean is_active
    }
    
    AUDIT_LOGS {
        uuid id PK
        uuid user_id FK
        string action
        string resource
        json details
        string ip_address
        timestamp timestamp
        string severity
    }
    
    COMPLIANCE_RECORDS {
        uuid id PK
        string report_type
        json data
        timestamp generated_at
        uuid generated_by FK
        string status
    }
    
    FEEDBACK {
        uuid id PK
        uuid conversation_id FK
        uuid user_id FK
        integer rating
        text comment
        json metadata
        timestamp created_at
    }
    
    USERS ||--o{ DOCUMENTS : uploads
    USERS ||--o{ CONVERSATIONS : participates
    USERS ||--o{ AUDIT_LOGS : generates
    USERS ||--o{ COMPLIANCE_RECORDS : creates
    DOCUMENTS ||--o{ CHUNKS : contains
    CONVERSATIONS ||--o{ FEEDBACK : receives
    USERS ||--o{ FEEDBACK : provides
```

## 5. API Route Architecture

```mermaid
graph TD
    subgraph "API Routes"
        ROOT["/api"]
        
        subgraph "Chat Routes"
            CHAT["/api/chat"]
            CHAT_POST[POST /message]
            CHAT_GET[GET /history]
            CHAT_WS[WebSocket /ws]
        end
        
        subgraph "Document Routes"
            DOC["/api/document-management"]
            DOC_POST[POST /upload]
            DOC_GET[GET /list]
            DOC_DELETE[DELETE /:id]
            DOC_STATUS[GET /:id/status]
        end
        
        subgraph "Ingestion Routes"
            ING["/api/ingestion"]
            ING_POST[POST /process]
            ING_STATUS[GET /status]
            ING_STATS[GET /statistics]
        end
        
        subgraph "Analytics Routes"
            ANA["/api/rag-analytics"]
            ANA_METRICS[GET /metrics]
            ANA_PERFORMANCE[GET /performance]
            ANA_QUALITY[GET /quality]
        end
        
        subgraph "Admin Routes"
            ADM["/api/admin"]
            ADM_USERS[GET /users]
            ADM_AUDIT[GET /audit-logs]
            ADM_COMPLIANCE[GET /compliance]
            ADM_CONFIG[POST /config]
        end
    end
    
    ROOT --> CHAT
    ROOT --> DOC
    ROOT --> ING
    ROOT --> ANA
    ROOT --> ADM
    
    CHAT --> CHAT_POST
    CHAT --> CHAT_GET
    CHAT --> CHAT_WS
    
    DOC --> DOC_POST
    DOC --> DOC_GET
    DOC --> DOC_DELETE
    DOC --> DOC_STATUS
    
    ING --> ING_POST
    ING --> ING_STATUS
    ING --> ING_STATS
    
    ANA --> ANA_METRICS
    ANA --> ANA_PERFORMANCE
    ANA --> ANA_QUALITY
    
    ADM --> ADM_USERS
    ADM --> ADM_AUDIT
    ADM --> ADM_COMPLIANCE
    ADM --> ADM_CONFIG
    
    style CHAT fill:#e1f5fe
    style DOC fill:#e8f5e8
    style ING fill:#fff3e0
    style ANA fill:#f3e5f5
    style ADM fill:#ffebee
```

## 6. Security Architecture

```mermaid
graph TB
    subgraph "Authentication Layer"
        LOGIN[User Login]
        JWT[JWT Token Generation]
        REFRESH[Token Refresh]
    end
    
    subgraph "Authorization Layer"
        RBAC[Role-Based Access Control]
        PERM[Permission Validation]
        GUARD[Route Guards]
    end
    
    subgraph "Data Protection"
        ENC[Encryption at Rest]
        TLS[TLS/HTTPS in Transit]
        PII_DET[PII Detection]
        MASK[Data Masking]
    end
    
    subgraph "Audit & Compliance"
        AUDIT_LOG[Comprehensive Logging]
        COMP_REP[Compliance Reporting]
        ALERT[Security Alerts]
    end
    
    subgraph "API Security"
        RATE[Rate Limiting]
        CORS[CORS Policy]
        HELMET[Security Headers]
        VALID[Input Validation]
    end
    
    LOGIN --> JWT
    JWT --> RBAC
    RBAC --> PERM
    PERM --> GUARD
    
    GUARD --> ENC
    ENC --> PII_DET
    PII_DET --> MASK
    
    MASK --> AUDIT_LOG
    AUDIT_LOG --> COMP_REP
    COMP_REP --> ALERT
    
    GUARD --> RATE
    RATE --> CORS
    CORS --> HELMET
    HELMET --> VALID
    
    style LOGIN fill:#ffebee
    style RBAC fill:#e8f5e8
    style ENC fill:#e1f5fe
    style AUDIT_LOG fill:#fff3e0
    style RATE fill:#f3e5f5
```

## 7. Deployment Architecture

```mermaid
graph TB
    subgraph "Production Environment"
        subgraph "Load Balancer"
            LB[Nginx/HAProxy<br/>SSL Termination]
        end
        
        subgraph "Application Tier"
            APP1[Node.js Server 1<br/>Port 5000]
            APP2[Node.js Server 2<br/>Port 5001]
            APP3[Node.js Server N<br/>Port 500N]
        end
        
        subgraph "Database Tier"
            PG_MASTER[(PostgreSQL Master<br/>+ pgvector)]
            PG_REPLICA[(PostgreSQL Replica<br/>Read Only)]
        end
        
        subgraph "Storage Tier"
            FS_DOCS[Document Storage<br/>File System/S3]
            FS_BACKUP[Backup Storage<br/>Automated Backups]
        end
        
        subgraph "Monitoring"
            HEALTH[Health Checks]
            METRICS[Metrics Collection]
            ALERTS[Alert System]
            LOGS[Centralized Logging]
        end
    end
    
    subgraph "External Services"
        OPENAI[OpenAI API<br/>GPT-4 + Embeddings]
        CDN[CDN<br/>Static Assets]
    end
    
    USERS[Users] --> LB
    LB --> APP1
    LB --> APP2
    LB --> APP3
    
    APP1 --> PG_MASTER
    APP2 --> PG_MASTER
    APP3 --> PG_MASTER
    
    APP1 --> PG_REPLICA
    APP2 --> PG_REPLICA
    APP3 --> PG_REPLICA
    
    APP1 --> FS_DOCS
    APP2 --> FS_DOCS
    APP3 --> FS_DOCS
    
    PG_MASTER --> FS_BACKUP
    FS_DOCS --> FS_BACKUP
    
    APP1 --> OPENAI
    APP2 --> OPENAI
    APP3 --> OPENAI
    
    LB --> CDN
    
    APP1 --> HEALTH
    APP2 --> HEALTH
    APP3 --> HEALTH
    PG_MASTER --> METRICS
    PG_REPLICA --> METRICS
    
    HEALTH --> ALERTS
    METRICS --> ALERTS
    
    style LB fill:#e1f5fe
    style PG_MASTER fill:#f3e5f5
    style OPENAI fill:#ffebee
    style HEALTH fill:#e8f5e8
```

## 8. Knowledge Base Processing Flow

```mermaid
flowchart TD
    subgraph "Document Processing Pipeline"
        A[Document Upload] --> B{File Type?}
        
        B -->|PDF| C[PDF Parser<br/>pdf-parse]
        B -->|DOCX| D[DOCX Parser<br/>mammoth]
        B -->|TXT| E[Text Reader<br/>fs]
        
        C --> F[Text Extraction]
        D --> F
        E --> F
        
        F --> G[Content Preprocessing<br/>• Clean HTML<br/>• Remove artifacts<br/>• Normalize text]
        
        G --> H[Intelligent Chunking<br/>• Semantic boundaries<br/>• Overlap strategy<br/>• Size optimization]
        
        H --> I[Embedding Generation<br/>OpenAI text-embedding-ada-002]
        
        I --> J[Vector Storage<br/>pgvector database]
        
        J --> K[Indexing & Optimization<br/>• HNSW index<br/>• Search optimization]
        
        K --> L[Quality Validation<br/>• Embedding quality<br/>• Chunk coherence]
        
        L --> M[Ready for Retrieval]
    end
    
    subgraph "Retrieval Process"
        N[User Query] --> O[Query Embedding<br/>OpenAI API]
        
        O --> P[Similarity Search<br/>Cosine similarity]
        
        P --> Q[Context Ranking<br/>• Relevance score<br/>• Recency weight<br/>• Quality metrics]
        
        Q --> R[Context Selection<br/>• Top-k chunks<br/>• Diversity filter<br/>• Token budget]
        
        R --> S[Context Assembly<br/>• Chunk ordering<br/>• Citation preparation]
        
        S --> T[RAG Prompt<br/>• System prompt<br/>• Context injection<br/>• User query]
        
        T --> U[LLM Generation<br/>OpenAI GPT-4]
        
        U --> V[Response Processing<br/>• Citation addition<br/>• Quality check<br/>• Safety filter]
        
        V --> W[Final Response]
    end
    
    M --> P
    
    style A fill:#e3f2fd
    style N fill:#e8f5e8
    style J fill:#f3e5f5
    style U fill:#ffebee
```

These Mermaid charts provide a comprehensive visual representation of your fund management chatbot architecture, covering all major components, data flows, and system interactions.
