const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const { initializeDatabase } = require('./config/database');
const WebSocketServer = require('./websocket-server');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from React build
app.use(express.static('client/build'));

// Import routes
const chatRoutes = require('./routes/chat');
const documentManagementRoutes = require('./routes/documentManagement');
const { getRouter: getIngestionRouter, initialize: initializeIngestionRoutes } = require('./routes/ingestion');
const { getRouter: getRAGAnalyticsRouter, initialize: initializeRAGAnalyticsRoutes } = require('./routes/rag-analytics');
const createSimpleAdminRouter = require('./routes/simple-admin');
const RBACManager = require('./services/RBACManager');

// Use routes
app.use('/api/chat', chatRoutes);
app.use('/api/document-management', documentManagementRoutes);
app.use('/api/ingestion', getIngestionRouter());
app.use('/api/rag-analytics', getRAGAnalyticsRouter());

// Admin routes will be mounted after initialization

// Catch all handler for React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connection
    console.log('🔌 Initializing database connection...');
    const database = await initializeDatabase();
    console.log('✅ Database initialized successfully');
    
    // Initialize ingestion routes
    console.log('📥 Initializing ingestion routes...');
    await initializeIngestionRoutes(database);
    console.log('✅ Ingestion routes initialized successfully');

    // Initialize RAG analytics routes
    console.log('📊 Initializing RAG analytics routes...');
    await initializeRAGAnalyticsRoutes(database);
    console.log('✅ RAG Analytics routes initialized successfully');

    // Mount simple admin routes with RBAC protection
    console.log('🔐 Configuring admin authentication middleware...');
    const rbacManager = new RBACManager();
    const simpleAdminRoutes = createSimpleAdminRouter({ rbacManager });
    app.locals.rbacManager = rbacManager;
    app.use('/api/admin', simpleAdminRoutes);
    console.log('✅ Admin routes secured and mounted successfully');
    
    // Initialize WebSocket server
    console.log('🔌 Initializing WebSocket server...');
    const wsServer = new WebSocketServer(server, {
      path: '/ws',
      heartbeatInterval: 30000
    });
    console.log('✅ WebSocket server initialized successfully');

    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Access the application at http://localhost:${PORT}`);
      console.log('📄 Document Management API available at /api/document-management');
      console.log('📥 Advanced Ingestion API available at /api/ingestion');
      console.log('📊 RAG Analytics API available at /api/rag-analytics');
      console.log('🔧 Admin Configuration API available at /api/admin');
      console.log(`🔌 WebSocket server available at ws://localhost:${PORT}/ws`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('🛑 SIGTERM received, shutting down gracefully...');
      await wsServer.shutdown();
      server.close(() => {
        console.log('✅ Server shut down gracefully');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
