# Ingestion Management System - Deployment Guide

## 🚀 **Production Deployment Guide**

This guide provides comprehensive instructions for deploying the Ingestion Management System to production environments with enterprise-grade configuration, monitoring, and security.

## 📋 **Pre-Deployment Checklist**

### **System Requirements**
- [ ] **Server**: Linux/Windows Server with 8GB+ RAM, 4+ CPU cores
- [ ] **Node.js**: Version 18+ with npm/yarn package manager
- [ ] **Database**: PostgreSQL 14+ with pgVector extension
- [ ] **Storage**: 100GB+ available disk space for documents and backups
- [ ] **Network**: HTTPS/SSL certificate for secure connections
- [ ] **Monitoring**: Log aggregation and monitoring system (optional)

### **Security Requirements**
- [ ] **API Keys**: OpenAI API key with sufficient quota
- [ ] **Database**: Secure database credentials and connection string
- [ ] **SSL/TLS**: Valid SSL certificate for HTTPS
- [ ] **Firewall**: Proper firewall configuration and port access
- [ ] **Backup**: Automated backup strategy and recovery procedures

### **Environment Preparation**
- [ ] **Environment Variables**: All required environment variables configured
- [ ] **Dependencies**: All system dependencies installed and updated
- [ ] **Permissions**: Proper file and directory permissions set
- [ ] **Network**: DNS configuration and load balancer setup (if applicable)
- [ ] **Monitoring**: Logging and monitoring systems configured

## 🔧 **Environment Configuration**

### **Production Environment Variables**

Create a `.env.production` file with the following configuration:

```bash
# Application Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
APP_NAME="Ingestion Management System"
APP_VERSION="1.0.0"

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/chatbot_production
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20
DATABASE_SSL=true

# OpenAI API Configuration
OPENAI_API_KEY=your_production_openai_api_key
OPENAI_MODEL=text-embedding-3-large
OPENAI_MAX_TOKENS=8000
OPENAI_TIMEOUT=30000

# File Upload Configuration
UPLOAD_PATH=/var/app/uploads
MAX_FILE_SIZE=52428800
ALLOWED_FILE_TYPES=pdf,docx,txt,md,html
ENABLE_VIRUS_SCAN=true
VIRUS_SCAN_ENDPOINT=http://clamav:3310

# Security Configuration
JWT_SECRET=your_super_secure_jwt_secret_key_here
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# Redis Configuration (Optional - for caching and sessions)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
ENABLE_REDIS=true

# Monitoring Configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE=/var/log/ingestion-system/app.log
ENABLE_METRICS=true
METRICS_PORT=9090

# Email Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@company.com
SMTP_PASS=your_email_password
FROM_EMAIL=noreply@company.com

# Backup Configuration
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_STORAGE=s3://your-backup-bucket
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1

# Performance Configuration
CLUSTER_WORKERS=0
ENABLE_COMPRESSION=true
ENABLE_CORS=true
CORS_ORIGIN=https://your-domain.com
TRUST_PROXY=true

# Feature Flags
ENABLE_ADVANCED_PROCESSING=true
ENABLE_REAL_TIME_MONITORING=true
ENABLE_INTEGRATION_TESTING=true
ENABLE_PERFORMANCE_OPTIMIZATION=true
```

### **Database Configuration**

#### **PostgreSQL Setup with pgVector**

1. **Install PostgreSQL 14+:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql-14 postgresql-contrib-14

# CentOS/RHEL
sudo yum install postgresql14-server postgresql14-contrib
```

2. **Install pgVector extension:**
```bash
# Clone and build pgVector
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# Enable extension in PostgreSQL
sudo -u postgres psql -c "CREATE EXTENSION vector;"
```

3. **Create production database:**
```sql
-- Connect as postgres user
sudo -u postgres psql

-- Create database and user
CREATE DATABASE chatbot_production;
CREATE USER ingestion_user WITH ENCRYPTED PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE chatbot_production TO ingestion_user;

-- Connect to the database
\c chatbot_production

-- Enable pgVector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create tables (run your migration scripts here)
```

4. **Configure PostgreSQL for production:**
```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf

# Key settings for production:
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
max_connections = 100

# Edit pg_hba.conf for security
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Add secure connection rules:
host    chatbot_production    ingestion_user    127.0.0.1/32    md5
hostssl chatbot_production    ingestion_user    0.0.0.0/0       md5
```

## 🐳 **Docker Deployment**

### **Production Dockerfile**

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY admin/package*.json ./admin/

# Install dependencies
RUN npm ci --only=production
RUN cd admin && npm ci --only=production

# Copy source code
COPY . .

# Build admin frontend
RUN cd admin && npm run build

# Build backend
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install system dependencies
RUN apk add --no-cache \
    postgresql-client \
    curl \
    dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/admin/dist ./admin/dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

# Create directories
RUN mkdir -p /app/uploads /app/logs /app/backups
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

### **Docker Compose for Production**

```yaml
version: '3.8'

services:
  # Main application
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: ingestion-system
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://ingestion_user:${DB_PASSWORD}@db:5432/chatbot_production
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - uploads:/app/uploads
      - logs:/app/logs
      - backups:/app/backups
    depends_on:
      - db
      - redis
    networks:
      - ingestion-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # PostgreSQL database with pgVector
  db:
    image: pgvector/pgvector:pg15
    container_name: ingestion-db
    restart: unless-stopped
    environment:
      - POSTGRES_DB=chatbot_production
      - POSTGRES_USER=ingestion_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_INITDB_ARGS=--auth-host=md5
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    networks:
      - ingestion-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ingestion_user -d chatbot_production"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s

  # Redis for caching and sessions
  redis:
    image: redis:7-alpine
    container_name: ingestion-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - ingestion-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 3s
      retries: 5

  # Nginx reverse proxy
  nginx:
    image: nginx:alpine
    container_name: ingestion-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - logs:/var/log/nginx
    depends_on:
      - app
    networks:
      - ingestion-network

  # Monitoring with Prometheus
  prometheus:
    image: prom/prometheus:latest
    container_name: ingestion-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    networks:
      - ingestion-network

  # Grafana for visualization
  grafana:
    image: grafana/grafana:latest
    container_name: ingestion-grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    networks:
      - ingestion-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  uploads:
    driver: local
  logs:
    driver: local
  backups:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local

networks:
  ingestion-network:
    driver: bridge
```

### **Nginx Configuration**

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=2r/s;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        client_max_body_size 50M;

        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }

        # Upload endpoints with special rate limiting
        location /api/ingestion/upload {
            limit_req zone=upload burst=5 nodelay;
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 600s;
            proxy_connect_timeout 75s;
        }

        # Static files
        location / {
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            proxy_pass http://app;
            access_log off;
        }
    }
}
```

## ☸️ **Kubernetes Deployment**

### **Kubernetes Manifests**

#### **Namespace**
```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ingestion-system
```

#### **ConfigMap**
```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ingestion-config
  namespace: ingestion-system
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  ENABLE_METRICS: "true"
  ENABLE_COMPRESSION: "true"
  TRUST_PROXY: "true"
```

#### **Secret**
```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: ingestion-secrets
  namespace: ingestion-system
type: Opaque
data:
  DATABASE_URL: <base64-encoded-database-url>
  OPENAI_API_KEY: <base64-encoded-openai-key>
  JWT_SECRET: <base64-encoded-jwt-secret>
  REDIS_PASSWORD: <base64-encoded-redis-password>
```

#### **Deployment**
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ingestion-system
  namespace: ingestion-system
  labels:
    app: ingestion-system
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ingestion-system
  template:
    metadata:
      labels:
        app: ingestion-system
    spec:
      containers:
      - name: app
        image: your-registry/ingestion-system:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: ingestion-config
              key: NODE_ENV
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: ingestion-secrets
              key: DATABASE_URL
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: ingestion-secrets
              key: OPENAI_API_KEY
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: ingestion-secrets
              key: JWT_SECRET
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: uploads
          mountPath: /app/uploads
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: uploads
        persistentVolumeClaim:
          claimName: uploads-pvc
      - name: logs
        persistentVolumeClaim:
          claimName: logs-pvc
```

#### **Service**
```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: ingestion-system-service
  namespace: ingestion-system
spec:
  selector:
    app: ingestion-system
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
```

#### **Ingress**
```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingestion-system-ingress
  namespace: ingestion-system
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - your-domain.com
    secretName: ingestion-tls
  rules:
  - host: your-domain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ingestion-system-service
            port:
              number: 80
```

#### **Persistent Volume Claims**
```yaml
# pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: uploads-pvc
  namespace: ingestion-system
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 100Gi
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: logs-pvc
  namespace: ingestion-system
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 10Gi
```

### **Deployment Commands**

```bash
# Apply all Kubernetes manifests
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
kubectl apply -f pvc.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml

# Check deployment status
kubectl get pods -n ingestion-system
kubectl get services -n ingestion-system
kubectl get ingress -n ingestion-system

# View logs
kubectl logs -f deployment/ingestion-system -n ingestion-system

# Scale deployment
kubectl scale deployment ingestion-system --replicas=5 -n ingestion-system
```

## 📊 **Monitoring & Logging**

### **Prometheus Configuration**

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

scrape_configs:
  - job_name: 'ingestion-system'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'postgresql'
    static_configs:
      - targets: ['db:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### **Grafana Dashboard Configuration**

```json
{
  "dashboard": {
    "title": "Ingestion System Monitoring",
    "panels": [
      {
        "title": "System Health",
        "type": "stat",
        "targets": [
          {
            "expr": "up{job=\"ingestion-system\"}",
            "legendFormat": "System Status"
          }
        ]
      },
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "Requests/sec"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "process_resident_memory_bytes",
            "legendFormat": "Memory Usage"
          }
        ]
      }
    ]
  }
}
```

### **Log Aggregation with ELK Stack**

#### **Filebeat Configuration**
```yaml
# filebeat.yml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /app/logs/*.log
  fields:
    service: ingestion-system
  fields_under_root: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "ingestion-system-%{+yyyy.MM.dd}"

setup.template.name: "ingestion-system"
setup.template.pattern: "ingestion-system-*"
```

#### **Logstash Configuration**
```ruby
# logstash.conf
input {
  beats {
    port => 5044
  }
}

filter {
  if [service] == "ingestion-system" {
    json {
      source => "message"
    }
    
    date {
      match => [ "timestamp", "ISO8601" ]
    }
    
    mutate {
      remove_field => [ "message" ]
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "%{[@metadata][beat]}-%{[@metadata][version]}-%{+YYYY.MM.dd}"
  }
}
```

## 🔒 **Security Hardening**

### **Application Security**

#### **Environment Security**
```bash
# Set secure file permissions
chmod 600 .env.production
chown app:app .env.production

# Secure upload directory
chmod 755 /app/uploads
chown app:app /app/uploads

# Secure log directory
chmod 755 /app/logs
chown app:app /app/logs
```

#### **Database Security**
```sql
-- Create read-only user for monitoring
CREATE USER monitoring_user WITH PASSWORD 'secure_monitoring_password';
GRANT CONNECT ON DATABASE chatbot_production TO monitoring_user;
GRANT USAGE ON SCHEMA public TO monitoring_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO monitoring_user;

-- Revoke unnecessary permissions
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ingestion_user;
```

#### **Network Security**
```bash
# Configure firewall (UFW example)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Configure fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### **SSL/TLS Configuration**

#### **Let's Encrypt with Certbot**
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### **Manual SSL Certificate**
```bash
# Generate private key
openssl genrsa -out private.key 2048

# Generate certificate signing request
openssl req -new -key private.key -out certificate.csr

# Install certificate (after receiving from CA)
cp certificate.crt /etc/ssl/certs/
cp private.key /etc/ssl/private/
chmod 644 /etc/ssl/certs/certificate.crt
chmod 600 /etc/ssl/private/private.key
```

## 🔄 **Backup & Recovery**

### **Automated Backup Script**

```bash
#!/bin/bash
# backup.sh - Automated backup script

set -e

# Configuration
BACKUP_DIR="/var/backups/ingestion-system"
DB_NAME="chatbot_production"
DB_USER="ingestion_user"
RETENTION_DAYS=30
S3_BUCKET="your-backup-bucket"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Database backup
echo "Starting database backup..."
pg_dump -h localhost -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

# File uploads backup
echo "Starting uploads backup..."
tar -czf "$BACKUP_DIR/uploads_backup_$TIMESTAMP.tar.gz" /app/uploads/

# Application logs backup
echo "Starting logs backup..."
tar -czf "$BACKUP_DIR/logs_backup_$TIMESTAMP.tar.gz" /app/logs/

# Upload to S3 (if configured)
if [ -n "$S3_BUCKET" ]; then
    echo "Uploading backups to S3..."
    aws s3 sync "$BACKUP_DIR" "s3://$S3_BUCKET/backups/"
fi

# Clean old backups
echo "Cleaning old backups..."
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed successfully!"
```

### **Recovery Procedures**

#### **Database Recovery**
```bash
# Stop application
docker-compose stop app

# Restore database
gunzip -c db_backup_20240101_120000.sql.gz | psql -h localhost -U ingestion_user -d chatbot_production

# Restart application
docker-compose start app
```

#### **File Recovery**
```bash
# Stop application
docker-compose stop app

# Restore uploads
tar -xzf uploads_backup_20240101_120000.tar.gz -C /

# Restore logs
tar -xzf logs_backup_20240101_120000.tar.gz -C /

# Restart application
docker-compose start app
```

## 📈 **Performance Tuning**

### **Application Performance**

#### **Node.js Optimization**
```javascript
// server.js optimizations
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster && process.env.NODE_ENV === 'production') {
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });
} else {
  // Worker process
  require('./app');
}
```

#### **Database Optimization**
```sql
-- Create indexes for better performance
CREATE INDEX CONCURRENTLY idx_sources_created_at ON kb_sources(created_at);
CREATE INDEX CONCURRENTLY idx_chunks_source_id ON kb_chunks(source_id);
CREATE INDEX CONCURRENTLY idx_chunks_embedding ON kb_chunks USING ivfflat (embedding vector_cosine_ops);

-- Analyze tables for query optimization
ANALYZE kb_sources;
ANALYZE kb_chunks;
ANALYZE ingestion_jobs;
```

#### **Redis Caching Strategy**
```javascript
// Cache configuration
const redis = require('redis');
const client = redis.createClient({
  url: process.env.REDIS_URL,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('Redis server connection refused');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

// Cache middleware
const cacheMiddleware = (duration = 300) => {
  return async (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    const cached = await client.get(key);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    res.sendResponse = res.json;
    res.json = (body) => {
      client.setex(key, duration, JSON.stringify(body));
      res.sendResponse(body);
    };
    
    next();
  };
};
```

### **Infrastructure Scaling**

#### **Horizontal Pod Autoscaler (HPA)**
```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ingestion-system-hpa
  namespace: ingestion-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ingestion-system
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### **Vertical Pod Autoscaler (VPA)**
```yaml
# vpa.yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: ingestion-system-vpa
  namespace: ingestion-system
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ingestion-system
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: app
      maxAllowed:
        cpu: 1
        memory: 2Gi
      minAllowed:
        cpu: 100m
        memory: 128Mi
```

## 🚨 **Troubleshooting Guide**

### **Common Issues**

#### **Application Won't Start**
```bash
# Check logs
docker-compose logs app

# Common solutions:
# 1. Check environment variables
# 2. Verify database connection
# 3. Check file permissions
# 4. Verify port availability
```

#### **Database Connection Issues**
```bash
# Test database connection
psql -h localhost -U ingestion_user -d chatbot_production

# Check PostgreSQL status
sudo systemctl status postgresql

# Check network connectivity
telnet localhost 5432
```

#### **High Memory Usage**
```bash
# Monitor memory usage
docker stats

# Check for memory leaks
node --inspect app.js

# Optimize garbage collection
node --max-old-space-size=4096 app.js
```

#### **Performance Issues**
```bash
# Check system resources
htop
iostat -x 1
netstat -i

# Profile application
node --prof app.js
node --prof-process isolate-*.log > processed.txt
```

### **Health Checks**

#### **Application Health Check**
```bash
#!/bin/bash
# health-check.sh

# Check application endpoint
curl -f http://localhost:3000/health || exit 1

# Check database connection
pg_isready -h localhost -U ingestion_user || exit 1

# Check Redis connection
redis-cli ping || exit 1

echo "All health checks passed!"
```

#### **Monitoring Alerts**
```yaml
# alerting-rules.yml
groups:
- name: ingestion-system
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      
  - alert: HighMemoryUsage
    expr: process_resident_memory_bytes / 1024 / 1024 > 1000
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage detected"
      
  - alert: DatabaseDown
    expr: up{job="postgresql"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Database is down"
```

## 📋 **Deployment Checklist**

### **Pre-Deployment**
- [ ] Environment variables configured
- [ ] Database setup and migrations run
- [ ] SSL certificates installed
- [ ] Firewall rules configured
- [ ] Backup strategy implemented
- [ ] Monitoring setup completed
- [ ] Load testing performed
- [ ] Security audit completed

### **Deployment**
- [ ] Application deployed successfully
- [ ] Health checks passing
- [ ] Database connectivity verified
- [ ] File uploads working
- [ ] API endpoints responding
- [ ] SSL/HTTPS working
- [ ] Monitoring data flowing
- [ ] Logs being collected

### **Post-Deployment**
- [ ] Performance monitoring active
- [ ] Backup jobs scheduled
- [ ] Alert rules configured
- [ ] Documentation updated
- [ ] Team trained on operations
- [ ] Incident response plan ready
- [ ] Rollback procedure tested
- [ ] Capacity planning reviewed

## 🎯 **Success Metrics**

### **Performance Targets**
- **Response Time**: < 200ms for API endpoints
- **Uptime**: > 99.9% availability
- **Throughput**: > 1000 requests/minute
- **Error Rate**: < 0.1% of total requests

### **Operational Targets**
- **Deployment Time**: < 10 minutes
- **Recovery Time**: < 30 minutes
- **Backup Success**: 100% successful backups
- **Security Incidents**: Zero security breaches

---

**The Ingestion Management System is now ready for enterprise production deployment with comprehensive monitoring, security, and scalability features!** 🚀
