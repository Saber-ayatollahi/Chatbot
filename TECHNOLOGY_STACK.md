# Fund Management Chatbot - Technology Stack

## Overview
This document provides a comprehensive overview of all technologies, frameworks, libraries, and tools used in the Fund Management Chatbot project.

## Backend Technology Stack

### Core Runtime & Framework
- **Node.js**: `>=18.0.0` - JavaScript runtime environment
- **Express.js**: `^4.18.2` - Web application framework
- **npm**: `>=8.0.0` - Package manager

### Database & Data Storage
- **PostgreSQL**: `13+` - Primary relational database
- **pgvector**: Vector extension for PostgreSQL (embeddings storage)
- **pg**: `^8.11.3` - PostgreSQL client for Node.js

### AI & Machine Learning
- **OpenAI**: `^4.20.1` - GPT-4 and embedding models
- **tiktoken**: `^1.0.10` - Token counting for OpenAI models
- **natural**: `^6.5.0` - Natural language processing utilities

### Document Processing
- **pdf-parse**: `^1.1.1` - PDF text extraction
- **mammoth**: `^1.11.0` - DOCX document processing
- **pdf2pic**: `^2.1.4` - PDF to image conversion
- **tesseract.js**: `^5.0.2` - OCR (Optical Character Recognition)
- **sharp**: `^0.32.6` - Image processing
- **html-to-text**: `^9.0.5` - HTML to plain text conversion
- **marked**: `^16.3.0` - Markdown processing

### Security & Authentication
- **jsonwebtoken**: `^9.0.2` - JWT token handling
- **bcryptjs**: `^2.4.3` - Password hashing
- **helmet**: `^7.1.0` - Security headers
- **express-rate-limit**: `^7.1.5` - Rate limiting
- **express-validator**: `^7.0.1` - Input validation
- **crypto**: `^1.0.1` - Cryptographic functionality

### File Handling & Utilities
- **multer**: `^2.0.2` - File upload middleware
- **fs-extra**: `^11.1.1` - Enhanced file system operations
- **mime-types**: `^2.1.35` - MIME type detection
- **uuid**: `^9.0.1` - UUID generation
- **exceljs**: `^4.4.0` - Excel file processing
- **pdfkit**: `^0.17.2` - PDF generation

### Real-time Communication
- **ws**: `^8.18.3` - WebSocket server implementation

### Logging & Monitoring
- **winston**: `^3.17.0` - Logging framework
- **winston-daily-rotate-file**: `^4.7.1` - Log rotation
- **morgan**: `^1.10.0` - HTTP request logging

### Utilities & Helpers
- **cors**: `^2.8.5` - Cross-Origin Resource Sharing
- **compression**: `^1.7.4` - Response compression
- **body-parser**: `^1.20.2` - Request body parsing
- **dotenv**: `^16.3.1` - Environment variable loading
- **date-fns**: `^2.30.0` - Date manipulation
- **lodash.debounce**: `^4.0.8` - Function debouncing
- **node-cron**: `^3.0.3` - Cron job scheduling
- **node-fetch**: `^3.3.2` - HTTP client

## Frontend Technology Stack

### Main Client Application (`client/`)

#### Core Framework
- **React**: `^18.2.0` - Frontend framework
- **React DOM**: `^18.2.0` - React DOM rendering
- **TypeScript**: `^4.9.5` - Type-safe JavaScript

#### UI Framework & Styling
- **Material-UI (MUI)**: `^5.15.0` - React component library
  - `@mui/material`: Core components
  - `@mui/icons-material`: Icon components
- **Emotion**: `^11.11.0` - CSS-in-JS library
  - `@emotion/react`: React integration
  - `@emotion/styled`: Styled components
- **Styled Components**: `^6.1.6` - CSS-in-JS styling
- **Framer Motion**: `^10.16.16` - Animation library

#### State Management & Utilities
- **React Hooks**: Built-in state management
- **lodash.debounce**: `^4.0.8` - Function debouncing
- **date-fns**: `^2.30.0` - Date utilities

#### Enhanced Features
- **React Markdown**: `^9.0.1` - Markdown rendering
- **React Syntax Highlighter**: `^15.5.0` - Code syntax highlighting
- **React Virtualized**: `^9.22.5` - Virtual scrolling
- **React Intersection Observer**: `^9.5.3` - Intersection observer hook
- **React Hotkeys Hook**: `^4.4.1` - Keyboard shortcuts
- **React Toastify**: `^9.1.3` - Toast notifications

#### Development Tools
- **React Scripts**: `5.0.1` - Build tooling
- **Web Vitals**: `^2.1.4` - Performance metrics

### Admin Dashboard (`admin/`)

#### Core Framework (Same as Client)
- **React**: `^18.2.0`
- **React DOM**: `^18.2.0`
- **TypeScript**: `^4.9.5`

#### UI & Data Visualization
- **Material-UI (MUI)**: `^5.15.0` - Complete MUI ecosystem
  - `@mui/x-date-pickers`: Date picker components
  - `@mui/x-data-grid`: Data grid components
- **Recharts**: `^2.8.0` - Chart and visualization library

#### Routing & HTTP
- **React Router DOM**: `^6.20.0` - Client-side routing
- **Axios**: `^1.6.0` - HTTP client

#### Form Management
- **React Hook Form**: `^7.47.0` - Form state management
- **React Query**: `^3.39.3` - Server state management

#### Enhanced Components
- **React Dropzone**: `^14.2.3` - File drag & drop
- **React Beautiful DnD**: `^13.1.1` - Drag and drop lists
- **React Virtualized**: `^9.22.5` - Virtual scrolling
- **React Window**: `^1.8.8` - Windowing for large lists
- **React JSON View**: `^1.21.3` - JSON viewer component

#### Real-time & Utilities
- **Socket.IO Client**: `^4.7.4` - Real-time communication
- **File Saver**: `^2.0.5` - File download utility
- **Fuse.js**: `^7.0.0` - Fuzzy search
- **Lodash**: `^4.17.21` - utility library

## Development & Testing Stack

### Testing Framework
- **Jest**: `^29.0.0` - JavaScript testing framework
- **Supertest**: `^6.3.3` - HTTP assertion library
- **@testing-library/jest-dom**: `^5.17.0` - Custom Jest matchers
- **@testing-library/react**: `^13.4.0` - React testing utilities
- **@testing-library/user-event**: `^13.5.0` - User interaction testing

### Performance & Load Testing
- **Artillery**: `^2.0.0` - Load testing toolkit
- **Benchmark**: `^2.1.4` - Performance benchmarking

### Code Quality & Formatting
- **ESLint**: `^8.0.0` - JavaScript linting
- **Prettier**: `^2.0.0` - Code formatting
- **Concurrently**: `^8.2.2` - Run multiple commands

### Development Tools
- **Nodemon**: `^3.0.2` - Development server auto-restart

## Database & Extensions

### Primary Database
- **PostgreSQL**: `13+` - Main database system
- **pgvector**: Vector similarity search extension

### Database Features Used
- **JSONB**: JSON data storage
- **UUID**: Unique identifier generation
- **Full-text Search**: Built-in search capabilities
- **Triggers**: Automated database operations
- **Indexes**: Performance optimization (B-tree, HNSW for vectors)

## External Services & APIs

### AI Services
- **OpenAI API**: 
  - GPT-4 for text generation
  - text-embedding-ada-002 for embeddings
  - Moderation API for content safety

### Potential Cloud Services
- **File Storage**: Local filesystem (production could use S3/Azure Blob)
- **CDN**: Static asset delivery (configurable)
- **Monitoring**: Custom monitoring (could integrate with DataDog/New Relic)

## Development Environment

### Required Software
- **Node.js**: `>=18.0.0`
- **npm**: `>=8.0.0`
- **PostgreSQL**: `13+` with pgvector extension
- **Git**: Version control

### Environment Configuration
- **dotenv**: Environment variable management
- **Cross-platform**: Windows, macOS, Linux support

## Production Deployment Stack

### Process Management
- **PM2**: Process manager (recommended)
- **Docker**: Containerization (optional)

### Web Server
- **Nginx**: Reverse proxy and static file serving (recommended)
- **SSL/TLS**: HTTPS encryption

### Monitoring & Logging
- **Winston**: Application logging
- **Custom Health Checks**: System monitoring
- **Log Rotation**: Automated log management

### Security
- **Helmet**: Security headers
- **Rate Limiting**: DDoS protection
- **CORS**: Cross-origin security
- **JWT**: Stateless authentication

## Package Management

### Main Dependencies Summary
```json
{
  "backend_dependencies": 45,
  "frontend_client_dependencies": 20,
  "frontend_admin_dependencies": 35,
  "dev_dependencies": 12,
  "total_packages": 112
}
```

### Key Dependency Categories
1. **Core Framework**: Express.js, React, TypeScript
2. **Database**: PostgreSQL, pgvector
3. **AI/ML**: OpenAI, natural language processing
4. **Security**: JWT, bcrypt, helmet
5. **UI/UX**: Material-UI, styled-components
6. **Testing**: Jest, testing libraries
7. **Development**: ESLint, Prettier, Nodemon

## Version Compatibility

### Node.js Ecosystem
- **Minimum Node.js**: 18.0.0
- **Recommended Node.js**: 18.x LTS or 20.x LTS
- **npm Version**: 8.0.0+

### Database Compatibility
- **PostgreSQL**: 13+ (for pgvector support)
- **pgvector**: Latest stable version

### Browser Support
- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile**: iOS Safari 14+, Chrome Mobile 90+

## Performance Considerations

### Backend Optimizations
- **Connection Pooling**: PostgreSQL connection management
- **Caching**: Query result caching
- **Compression**: Response compression
- **Rate Limiting**: API protection

### Frontend Optimizations
- **Code Splitting**: React lazy loading
- **Virtual Scrolling**: Large list performance
- **Memoization**: React performance optimization
- **Bundle Optimization**: Webpack optimizations

## Security Stack

### Authentication & Authorization
- **JWT**: Stateless authentication
- **bcryptjs**: Password hashing
- **RBAC**: Role-based access control

### Data Protection
- **Encryption**: Data at rest and in transit
- **Input Validation**: Request sanitization
- **PII Detection**: Privacy protection
- **Audit Logging**: Comprehensive tracking

### API Security
- **Helmet**: Security headers
- **CORS**: Cross-origin protection
- **Rate Limiting**: DDoS mitigation
- **Input Validation**: SQL injection prevention

This technology stack provides a robust, scalable, and secure foundation for the fund management chatbot with enterprise-grade capabilities.
