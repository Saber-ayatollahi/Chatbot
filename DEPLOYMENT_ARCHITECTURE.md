# Fund Management Chatbot - Deployment Architecture

## Production Deployment Overview

This document outlines the production deployment architecture for the Fund Management Chatbot, including infrastructure components, scaling strategies, and operational considerations.

## Deployment Architecture Diagram

```mermaid
graph TB
    subgraph "External Users"
        WEB_USERS[Web Users<br/>Browsers]
        ADMIN_USERS[Admin Users<br/>Dashboard]
        API_CLIENTS[API Clients<br/>External Systems]
    end
    
    subgraph "CDN & Edge"
        CDN[Content Delivery Network<br/>Static Assets, Images]
        EDGE[Edge Locations<br/>Global Distribution]
    end
    
    subgraph "Load Balancer Tier"
        LB[Load Balancer<br/>Nginx/HAProxy<br/>SSL Termination]
        SSL[SSL Certificates<br/>Let's Encrypt/Commercial]
    end
    
    subgraph "Application Tier"
        subgraph "Node.js Cluster"
            APP1[Node.js Server 1<br/>Port 5000<br/>Main App + WebSocket]
            APP2[Node.js Server 2<br/>Port 5001<br/>Main App + WebSocket]
            APP3[Node.js Server N<br/>Port 500N<br/>Main App + WebSocket]
        end
        
        subgraph "Static File Serving"
            STATIC[Static File Server<br/>React Build Files<br/>Nginx/Express Static]
        end
    end
    
    subgraph "Database Tier"
        subgraph "PostgreSQL Cluster"
            PG_MASTER[(PostgreSQL Master<br/>Read/Write<br/>+ pgvector)]
            PG_REPLICA1[(PostgreSQL Replica 1<br/>Read Only<br/>+ pgvector)]
            PG_REPLICA2[(PostgreSQL Replica 2<br/>Read Only<br/>+ pgvector)]
        end
        
        subgraph "Connection Pooling"
            PGPOOL[PgBouncer/PgPool<br/>Connection Management]
        end
    end
    
    subgraph "Storage Tier"
        subgraph "File Storage"
            FS_PRIMARY[Primary Document Storage<br/>Local FS/NFS/S3]
            FS_BACKUP[Backup Storage<br/>Automated Backups<br/>S3/Azure Blob]
        end
        
        subgraph "Cache Layer"
            REDIS[Redis Cluster<br/>Session Store<br/>Query Cache]
        end
    end
    
    subgraph "External Services"
        OPENAI[OpenAI API<br/>GPT-4 + Embeddings<br/>Rate Limited]
        EMAIL[Email Service<br/>SMTP/SendGrid<br/>Notifications]
        SMS[SMS Service<br/>Twilio<br/>Alerts]
    end
    
    subgraph "Monitoring & Observability"
        subgraph "Application Monitoring"
            APM[Application Performance<br/>New Relic/DataDog]
            LOGS[Centralized Logging<br/>ELK Stack/Splunk]
        end
        
        subgraph "Infrastructure Monitoring"
            INFRA[Infrastructure Metrics<br/>Prometheus/Grafana]
            HEALTH[Health Checks<br/>Custom Endpoints]
        end
        
        subgraph "Alerting"
            ALERTS[Alert Manager<br/>PagerDuty/Slack]
            DASHBOARDS[Monitoring Dashboards<br/>Grafana/Custom]
        end
    end
    
    subgraph "Security & Compliance"
        WAF[Web Application Firewall<br/>CloudFlare/AWS WAF]
        VAULT[Secrets Management<br/>HashiCorp Vault/AWS Secrets]
        AUDIT[Audit Logging<br/>Compliance Tracking]
    end
    
    %% User Connections
    WEB_USERS --> CDN
    ADMIN_USERS --> CDN
    API_CLIENTS --> WAF
    
    %% CDN and Edge
    CDN --> EDGE
    EDGE --> WAF
    
    %% Security Layer
    WAF --> LB
    
    %% Load Balancer
    LB --> SSL
    LB --> APP1
    LB --> APP2
    LB --> APP3
    LB --> STATIC
    
    %% Application Connections
    APP1 --> PGPOOL
    APP2 --> PGPOOL
    APP3 --> PGPOOL
    
    APP1 --> REDIS
    APP2 --> REDIS
    APP3 --> REDIS
    
    APP1 --> FS_PRIMARY
    APP2 --> FS_PRIMARY
    APP3 --> FS_PRIMARY
    
    %% Database Connections
    PGPOOL --> PG_MASTER
    PGPOOL --> PG_REPLICA1
    PGPOOL --> PG_REPLICA2
    
    %% Replication
    PG_MASTER -.-> PG_REPLICA1
    PG_MASTER -.-> PG_REPLICA2
    
    %% Storage
    FS_PRIMARY --> FS_BACKUP
    PG_MASTER --> FS_BACKUP
    
    %% External Services
    APP1 --> OPENAI
    APP2 --> OPENAI
    APP3 --> OPENAI
    
    APP1 --> EMAIL
    APP2 --> SMS
    
    %% Monitoring Connections
    APP1 --> APM
    APP2 --> APM
    APP3 --> APM
    
    APP1 --> LOGS
    APP2 --> LOGS
    APP3 --> LOGS
    
    PG_MASTER --> INFRA
    PG_REPLICA1 --> INFRA
    PG_REPLICA2 --> INFRA
    
    HEALTH --> ALERTS
    APM --> ALERTS
    INFRA --> ALERTS
    
    APM --> DASHBOARDS
    INFRA --> DASHBOARDS
    
    %% Security
    APP1 --> VAULT
    APP2 --> VAULT
    APP3 --> VAULT
    
    APP1 --> AUDIT
    APP2 --> AUDIT
    APP3 --> AUDIT
    
    %% Styling
    style WEB_USERS fill:#e1f5fe
    style ADMIN_USERS fill:#e8f5e8
    style LB fill:#fff3e0
    style PG_MASTER fill:#f3e5f5
    style OPENAI fill:#ffebee
    style APM fill:#f9fbe7
    style WAF fill:#fce4ec
```

## Deployment Environments

### Development Environment
```mermaid
graph LR
    subgraph "Local Development"
        DEV[Developer Machine<br/>Node.js + PostgreSQL<br/>Port 5000]
        DEV_DB[(Local PostgreSQL<br/>+ pgvector)]
        DEV_FILES[Local File System<br/>Documents]
    end
    
    DEV --> DEV_DB
    DEV --> DEV_FILES
    DEV --> OPENAI_DEV[OpenAI API<br/>Development Keys]
    
    style DEV fill:#e3f2fd
    style DEV_DB fill:#f3e5f5
```

### Staging Environment
```mermaid
graph TB
    subgraph "Staging Environment"
        STAGE_LB[Staging Load Balancer<br/>Nginx]
        STAGE_APP[Node.js Application<br/>Staging Build]
        STAGE_DB[(PostgreSQL Staging<br/>+ pgvector)]
        STAGE_FILES[Staging File Storage]
    end
    
    STAGE_LB --> STAGE_APP
    STAGE_APP --> STAGE_DB
    STAGE_APP --> STAGE_FILES
    STAGE_APP --> OPENAI_STAGE[OpenAI API<br/>Staging Keys]
    
    style STAGE_LB fill:#fff3e0
    style STAGE_APP fill:#e8f5e8
    style STAGE_DB fill:#f3e5f5
```

### Production Environment (Detailed)
```mermaid
graph TB
    subgraph "Production Infrastructure"
        subgraph "Frontend Tier"
            PROD_CDN[Production CDN<br/>Global Edge Locations]
            PROD_LB[Production Load Balancer<br/>High Availability<br/>Auto-scaling]
        end
        
        subgraph "Application Tier"
            PROD_APP1[Production App 1<br/>Auto-scaling Group]
            PROD_APP2[Production App 2<br/>Auto-scaling Group]
            PROD_APP3[Production App N<br/>Auto-scaling Group]
        end
        
        subgraph "Data Tier"
            PROD_DB_MASTER[(Production DB Master<br/>High Performance<br/>Automated Backups)]
            PROD_DB_REPLICA[(Production DB Replica<br/>Read Scaling<br/>Disaster Recovery)]
        end
        
        subgraph "Storage & Cache"
            PROD_STORAGE[Production Storage<br/>Redundant<br/>Encrypted]
            PROD_CACHE[Production Cache<br/>Redis Cluster<br/>High Availability]
        end
    end
    
    PROD_CDN --> PROD_LB
    PROD_LB --> PROD_APP1
    PROD_LB --> PROD_APP2
    PROD_LB --> PROD_APP3
    
    PROD_APP1 --> PROD_DB_MASTER
    PROD_APP2 --> PROD_DB_MASTER
    PROD_APP3 --> PROD_DB_MASTER
    
    PROD_APP1 --> PROD_DB_REPLICA
    PROD_APP2 --> PROD_DB_REPLICA
    PROD_APP3 --> PROD_DB_REPLICA
    
    PROD_APP1 --> PROD_STORAGE
    PROD_APP2 --> PROD_STORAGE
    PROD_APP3 --> PROD_STORAGE
    
    PROD_APP1 --> PROD_CACHE
    PROD_APP2 --> PROD_CACHE
    PROD_APP3 --> PROD_CACHE
    
    style PROD_CDN fill:#e1f5fe
    style PROD_LB fill:#fff3e0
    style PROD_DB_MASTER fill:#f3e5f5
    style PROD_STORAGE fill:#e8f5e8
```

## Infrastructure Components

### Load Balancer Configuration
```nginx
# Nginx Configuration Example
upstream chatbot_backend {
    least_conn;
    server 127.0.0.1:5000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:5001 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:5002 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name chatbot.company.com;
    
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Static files
    location /static/ {
        root /var/www/chatbot/client/build;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API routes
    location /api/ {
        proxy_pass http://chatbot_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket
    location /ws {
        proxy_pass http://chatbot_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
    
    # React app
    location / {
        try_files $uri $uri/ /index.html;
        root /var/www/chatbot/client/build;
    }
}
```

### Database Configuration
```sql
-- PostgreSQL Configuration for Production
-- postgresql.conf settings

# Connection Settings
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200

# pgvector specific settings
shared_preload_libraries = 'vector'

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = 'pg_log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_statement = 'mod'
log_min_duration_statement = 1000

# Replication (for read replicas)
wal_level = replica
max_wal_senders = 3
wal_keep_segments = 32
```

### Application Process Management
```javascript
// PM2 Ecosystem Configuration
module.exports = {
  apps: [{
    name: 'chatbot-app-1',
    script: 'server.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      DB_POOL_SIZE: 20
    },
    error_file: './logs/app-1-err.log',
    out_file: './logs/app-1-out.log',
    log_file: './logs/app-1-combined.log',
    time: true
  }, {
    name: 'chatbot-app-2',
    script: 'server.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5001,
      DB_POOL_SIZE: 20
    },
    error_file: './logs/app-2-err.log',
    out_file: './logs/app-2-out.log',
    log_file: './logs/app-2-combined.log',
    time: true
  }]
};
```

## Scaling Strategies

### Horizontal Scaling
```mermaid
graph LR
    subgraph "Auto-scaling Group"
        APP1[App Instance 1<br/>CPU: 70%]
        APP2[App Instance 2<br/>CPU: 65%]
        APP3[App Instance 3<br/>CPU: 80%]
        APP4[App Instance 4<br/>CPU: 45%]
    end
    
    subgraph "Scaling Triggers"
        CPU_ALARM[CPU > 75%<br/>Scale Up]
        MEM_ALARM[Memory > 80%<br/>Scale Up]
        CONN_ALARM[Connections > 90%<br/>Scale Up]
    end
    
    subgraph "Database Scaling"
        READ_REPLICA1[(Read Replica 1)]
        READ_REPLICA2[(Read Replica 2)]
        READ_REPLICA3[(Read Replica 3)]
    end
    
    CPU_ALARM -.-> APP4
    MEM_ALARM -.-> APP4
    CONN_ALARM -.-> APP4
    
    APP1 --> READ_REPLICA1
    APP2 --> READ_REPLICA2
    APP3 --> READ_REPLICA3
    
    style APP4 fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
```

### Vertical Scaling
- **CPU**: Scale up during peak hours
- **Memory**: Increase for large document processing
- **Storage**: Expand as knowledge base grows
- **Network**: Upgrade bandwidth for high traffic

## Security Architecture

### Network Security
```mermaid
graph TB
    subgraph "Security Layers"
        INTERNET[Internet]
        WAF[Web Application Firewall<br/>DDoS Protection<br/>SQL Injection Prevention]
        LB[Load Balancer<br/>SSL Termination<br/>Rate Limiting]
        
        subgraph "DMZ"
            APP[Application Servers<br/>Private Network]
        end
        
        subgraph "Private Network"
            DB[(Database<br/>No Internet Access)]
            STORAGE[File Storage<br/>Encrypted]
        end
        
        subgraph "Management Network"
            BASTION[Bastion Host<br/>SSH Access Only]
            MONITOR[Monitoring<br/>Internal Only]
        end
    end
    
    INTERNET --> WAF
    WAF --> LB
    LB --> APP
    APP --> DB
    APP --> STORAGE
    
    BASTION -.-> APP
    BASTION -.-> DB
    MONITOR -.-> APP
    MONITOR -.-> DB
    
    style WAF fill:#ffebee
    style DB fill:#f3e5f5
    style BASTION fill:#fff3e0
```

### Data Encryption
- **At Rest**: Database encryption, file system encryption
- **In Transit**: TLS 1.3, encrypted API communications
- **Application Level**: Sensitive data encryption in services

## Monitoring & Observability

### Application Metrics
```mermaid
graph LR
    subgraph "Application Metrics"
        REQ_RATE[Request Rate<br/>req/sec]
        RESP_TIME[Response Time<br/>95th percentile]
        ERROR_RATE[Error Rate<br/>4xx/5xx errors]
        THROUGHPUT[Throughput<br/>concurrent users]
    end
    
    subgraph "Business Metrics"
        CHAT_SESSIONS[Active Chat Sessions]
        DOC_PROCESSED[Documents Processed/hour]
        USER_SATISFACTION[User Satisfaction Score]
        RAG_QUALITY[RAG Response Quality]
    end
    
    subgraph "Infrastructure Metrics"
        CPU_USAGE[CPU Usage %]
        MEMORY_USAGE[Memory Usage %]
        DISK_IO[Disk I/O]
        NETWORK_IO[Network I/O]
    end
    
    subgraph "Database Metrics"
        DB_CONNECTIONS[Active Connections]
        QUERY_TIME[Query Response Time]
        SLOW_QUERIES[Slow Queries/min]
        REPLICATION_LAG[Replication Lag]
    end
    
    style REQ_RATE fill:#e1f5fe
    style CHAT_SESSIONS fill:#e8f5e8
    style CPU_USAGE fill:#fff3e0
    style DB_CONNECTIONS fill:#f3e5f5
```

### Health Check Endpoints
```javascript
// Health Check Implementation
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      openai: await checkOpenAI(),
      fileSystem: await checkFileSystem(),
      memory: checkMemoryUsage(),
      cpu: checkCPUUsage()
    }
  };
  
  const isHealthy = Object.values(health.checks)
    .every(check => check.status === 'healthy');
  
  res.status(isHealthy ? 200 : 503).json(health);
});
```

## Disaster Recovery

### Backup Strategy
```mermaid
graph TB
    subgraph "Backup Types"
        FULL[Full Backup<br/>Weekly<br/>Complete System]
        INCREMENTAL[Incremental Backup<br/>Daily<br/>Changes Only]
        CONTINUOUS[Continuous Backup<br/>Real-time<br/>Transaction Log]
    end
    
    subgraph "Backup Locations"
        LOCAL[Local Storage<br/>Fast Recovery]
        REMOTE[Remote Storage<br/>Disaster Recovery]
        CLOUD[Cloud Storage<br/>Long-term Retention]
    end
    
    subgraph "Recovery Scenarios"
        RTO[Recovery Time Objective<br/>< 4 hours]
        RPO[Recovery Point Objective<br/>< 1 hour]
        DR[Disaster Recovery<br/>< 24 hours]
    end
    
    FULL --> LOCAL
    INCREMENTAL --> LOCAL
    CONTINUOUS --> REMOTE
    
    LOCAL --> RTO
    REMOTE --> RPO
    CLOUD --> DR
    
    style FULL fill:#e1f5fe
    style LOCAL fill:#e8f5e8
    style RTO fill:#fff3e0
```

### Failover Strategy
- **Database**: Automatic failover to read replica
- **Application**: Load balancer health checks
- **Storage**: Redundant storage with automatic failover
- **Network**: Multiple availability zones

## Deployment Process

### CI/CD Pipeline
```mermaid
graph LR
    subgraph "Development"
        CODE[Code Commit<br/>Git Repository]
        PR[Pull Request<br/>Code Review]
    end
    
    subgraph "CI Pipeline"
        BUILD[Build<br/>npm install<br/>TypeScript compile]
        TEST[Test<br/>Unit + Integration<br/>Security Scan]
        PACKAGE[Package<br/>Docker Image<br/>Artifacts]
    end
    
    subgraph "CD Pipeline"
        STAGE[Deploy to Staging<br/>Automated Testing]
        PROD_APPROVAL[Production Approval<br/>Manual Gate]
        PROD_DEPLOY[Production Deployment<br/>Blue-Green/Rolling]
    end
    
    subgraph "Post-Deployment"
        MONITOR[Monitoring<br/>Health Checks]
        ROLLBACK[Rollback<br/>If Issues Detected]
    end
    
    CODE --> PR
    PR --> BUILD
    BUILD --> TEST
    TEST --> PACKAGE
    PACKAGE --> STAGE
    STAGE --> PROD_APPROVAL
    PROD_APPROVAL --> PROD_DEPLOY
    PROD_DEPLOY --> MONITOR
    MONITOR --> ROLLBACK
    
    style BUILD fill:#e1f5fe
    style TEST fill:#e8f5e8
    style PROD_DEPLOY fill:#fff3e0
    style MONITOR fill:#f3e5f5
```

## Performance Optimization

### Caching Strategy
- **Application Cache**: Redis for session data and query results
- **Database Cache**: Query result caching and connection pooling
- **CDN Cache**: Static assets with long TTL
- **Browser Cache**: Client-side caching for UI components

### Database Optimization
- **Indexing**: Optimized indexes for vector search and queries
- **Partitioning**: Table partitioning for large datasets
- **Connection Pooling**: Efficient connection management
- **Read Replicas**: Distribute read load across replicas

This deployment architecture provides a robust, scalable, and secure foundation for production deployment of the Fund Management Chatbot system.
