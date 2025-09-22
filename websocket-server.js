/**
 * WebSocket Server for Real-time Features
 * Provides real-time connectivity for the Fund Management Assistant
 */

const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const logger = require('./utils/logger');

class WebSocketServer {
  constructor(server, options = {}) {
    this.server = server;
    this.options = {
      port: options.port || 5001,
      path: options.path || '/ws',
      heartbeatInterval: options.heartbeatInterval || 30000,
      maxConnections: options.maxConnections || 1000,
      ...options
    };
    
    this.clients = new Map();
    this.connectionCount = 0;
    this.messageStats = {
      sent: 0,
      received: 0,
      errors: 0
    };
    
    this.initializeWebSocketServer();
  }

  initializeWebSocketServer() {
    try {
      // Create WebSocket server
      this.wss = new WebSocket.Server({
        server: this.server,
        path: this.options.path,
        maxPayload: 16 * 1024, // 16KB max message size
        perMessageDeflate: {
          zlibDeflateOptions: {
            threshold: 1024,
            concurrencyLimit: 10,
          },
        }
      });

      this.wss.on('connection', this.handleConnection.bind(this));
      this.wss.on('error', this.handleServerError.bind(this));

      // Start heartbeat interval
      this.startHeartbeat();

      logger.info(`🔌 WebSocket server initialized on path ${this.options.path}`);
      
    } catch (error) {
      logger.error('❌ Failed to initialize WebSocket server:', error);
      throw error;
    }
  }

  handleConnection(ws, request) {
    try {
      const clientId = this.generateClientId();
      const clientInfo = {
        id: clientId,
        ws: ws,
        isAlive: true,
        connectedAt: new Date(),
        lastActivity: new Date(),
        messageCount: 0,
        userAgent: request.headers['user-agent'] || 'Unknown',
        ip: request.connection.remoteAddress || 'Unknown'
      };

      this.clients.set(clientId, clientInfo);
      this.connectionCount++;

      logger.info(`🔗 WebSocket client connected: ${clientId} (Total: ${this.connectionCount})`);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection',
        status: 'connected',
        clientId: clientId,
        serverTime: new Date().toISOString(),
        features: ['heartbeat', 'notifications', 'typing-indicators', 'system-health']
      });

      // Set up client event handlers
      ws.on('message', (data) => this.handleMessage(clientId, data));
      ws.on('close', () => this.handleDisconnection(clientId));
      ws.on('error', (error) => this.handleClientError(clientId, error));
      ws.on('pong', () => this.handlePong(clientId));

    } catch (error) {
      logger.error('❌ Error handling WebSocket connection:', error);
      ws.close(1011, 'Server error');
    }
  }

  handleMessage(clientId, data) {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      client.lastActivity = new Date();
      client.messageCount++;
      this.messageStats.received++;

      let message;
      try {
        message = JSON.parse(data.toString());
      } catch (parseError) {
        logger.warn(`⚠️ Invalid JSON from client ${clientId}:`, parseError.message);
        this.sendToClient(clientId, {
          type: 'error',
          message: 'Invalid JSON format'
        });
        return;
      }

      // Handle different message types
      switch (message.type) {
        case 'heartbeat':
          this.handleHeartbeat(clientId);
          break;
          
        case 'typing-start':
          this.handleTypingStart(clientId, message);
          break;
          
        case 'typing-stop':
          this.handleTypingStop(clientId, message);
          break;
          
        case 'system-health-request':
          this.handleSystemHealthRequest(clientId);
          break;
          
        case 'notification-ack':
          this.handleNotificationAck(clientId, message);
          break;
          
        default:
          logger.debug(`📨 Unknown message type from ${clientId}:`, message.type);
          this.sendToClient(clientId, {
            type: 'error',
            message: `Unknown message type: ${message.type}`
          });
      }

    } catch (error) {
      logger.error(`❌ Error handling message from ${clientId}:`, error);
      this.messageStats.errors++;
    }
  }

  handleHeartbeat(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = true;
      this.sendToClient(clientId, {
        type: 'heartbeat-ack',
        serverTime: new Date().toISOString()
      });
    }
  }

  handleTypingStart(clientId, message) {
    // Broadcast typing indicator to other clients (if needed)
    this.broadcastToOthers(clientId, {
      type: 'typing-indicator',
      action: 'start',
      user: message.user || 'user',
      timestamp: new Date().toISOString()
    });
  }

  handleTypingStop(clientId, message) {
    // Broadcast typing stop to other clients (if needed)
    this.broadcastToOthers(clientId, {
      type: 'typing-indicator',
      action: 'stop',
      user: message.user || 'user',
      timestamp: new Date().toISOString()
    });
  }

  handleSystemHealthRequest(clientId) {
    const healthData = {
      type: 'system-health',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: {
        connectedClients: this.connectionCount,
        messagesReceived: this.messageStats.received,
        messagesSent: this.messageStats.sent,
        errors: this.messageStats.errors,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    };
    
    this.sendToClient(clientId, healthData);
  }

  handleNotificationAck(clientId, message) {
    logger.debug(`📬 Notification acknowledged by ${clientId}:`, message.notificationId);
  }

  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      const connectionDuration = Date.now() - client.connectedAt.getTime();
      logger.info(`🔌 WebSocket client disconnected: ${clientId} (Duration: ${Math.round(connectionDuration/1000)}s, Messages: ${client.messageCount})`);
      
      this.clients.delete(clientId);
      this.connectionCount--;
    }
  }

  handleClientError(clientId, error) {
    // Only log significant errors, not normal connection cleanup
    if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE' && error.message !== 'WebSocket is not open: readyState 3 (CLOSED)') {
      logger.error(`❌ WebSocket client error ${clientId}:`, error.message);
    } else {
      logger.debug(`🔌 WebSocket client ${clientId} disconnected: ${error.message}`);
    }
    this.messageStats.errors++;
  }

  handleServerError(error) {
    logger.error('❌ WebSocket server error:', error);
  }

  handlePong(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = true;
    }
  }

  sendToClient(clientId, message) {
    try {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
        this.messageStats.sent++;
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`❌ Failed to send message to client ${clientId}:`, error);
      this.messageStats.errors++;
      return false;
    }
  }

  broadcastToAll(message) {
    let sentCount = 0;
    this.clients.forEach((client, clientId) => {
      if (this.sendToClient(clientId, message)) {
        sentCount++;
      }
    });
    return sentCount;
  }

  broadcastToOthers(excludeClientId, message) {
    let sentCount = 0;
    this.clients.forEach((client, clientId) => {
      if (clientId !== excludeClientId && this.sendToClient(clientId, message)) {
        sentCount++;
      }
    });
    return sentCount;
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          logger.debug(`💔 Terminating inactive client: ${clientId}`);
          client.ws.terminate();
          this.clients.delete(clientId);
          this.connectionCount--;
          return;
        }
        
        client.isAlive = false;
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, this.options.heartbeatInterval);
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Send system notifications
  sendSystemNotification(notification) {
    const message = {
      type: 'notification',
      id: `notif_${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...notification
    };
    
    return this.broadcastToAll(message);
  }

  // Get server statistics
  getStats() {
    return {
      connections: {
        current: this.connectionCount,
        total: this.clients.size
      },
      messages: { ...this.messageStats },
      uptime: process.uptime(),
      clients: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        connectedAt: client.connectedAt,
        lastActivity: client.lastActivity,
        messageCount: client.messageCount,
        userAgent: client.userAgent,
        ip: client.ip
      }))
    };
  }

  // Graceful shutdown
  shutdown() {
    return new Promise((resolve) => {
      logger.info('🔌 Shutting down WebSocket server...');
      
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }

      // Notify all clients of shutdown
      this.broadcastToAll({
        type: 'server-shutdown',
        message: 'Server is shutting down',
        timestamp: new Date().toISOString()
      });

      // Close all connections
      this.clients.forEach((client, clientId) => {
        client.ws.close(1001, 'Server shutdown');
      });

      // Close the WebSocket server
      this.wss.close(() => {
        logger.info('✅ WebSocket server shut down gracefully');
        resolve();
      });
    });
  }
}

module.exports = WebSocketServer;
