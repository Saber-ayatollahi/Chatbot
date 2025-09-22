/**
 * Real-Time Features Hook
 * WebSocket connections, live updates, and real-time notifications
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';

interface RealTimeState {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastActivity: Date | null;
  notifications: Notification[];
  typingUsers: string[];
  systemStatus: 'online' | 'degraded' | 'offline';
  performanceMetrics: {
    latency: number;
    responseTime: number;
    errorRate: number;
  };
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  persistent?: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

interface RealTimeOptions {
  enableWebSocket?: boolean;
  enableNotifications?: boolean;
  enableTypingIndicators?: boolean;
  enablePerformanceMonitoring?: boolean;
  reconnectInterval?: number;
  heartbeatInterval?: number;
}

export const useRealTimeFeatures = (options: RealTimeOptions = {}) => {
  const {
    enableWebSocket = true, // Now enabled by default with WebSocket server
    enableNotifications = true,
    enableTypingIndicators = true,
    enablePerformanceMonitoring = true,
    reconnectInterval = 5000,
    heartbeatInterval = 30000,
  } = options;

  const [state, setState] = useState<RealTimeState>({
    isConnected: false,
    connectionStatus: 'disconnected',
    lastActivity: null,
    notifications: [],
    typingUsers: [],
    systemStatus: 'online',
    performanceMetrics: {
      latency: 0,
      responseTime: 0,
      errorRate: 0,
    },
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const performanceRef = useRef({
    requestTimes: [] as number[],
    errorCount: 0,
    totalRequests: 0,
  });

  // WebSocket connection management
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const connectWebSocket = useCallback(() => {
    if (!enableWebSocket) return;

    try {
      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3000/ws';
      wsRef.current = new WebSocket(wsUrl);

      setState(prev => ({ ...prev, connectionStatus: 'connecting' }));

      wsRef.current.onopen = () => {
        setState(prev => ({
          ...prev,
          isConnected: true,
          connectionStatus: 'connected',
          lastActivity: new Date(),
        }));

        // Start heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }

        heartbeatIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'heartbeat' }));
          }
        }, heartbeatInterval);

        addNotification({
          type: 'success',
          title: 'Connected',
          message: 'Real-time features are now active',
        });
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
          setState(prev => ({ ...prev, lastActivity: new Date() }));
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({ ...prev, connectionStatus: 'error' }));
        
        addNotification({
          type: 'error',
          title: 'Connection Error',
          message: 'Real-time connection failed',
        });
      };

      wsRef.current.onclose = () => {
        setState(prev => ({
          ...prev,
          isConnected: false,
          connectionStatus: 'disconnected',
        }));

        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }

        // Attempt reconnection
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, reconnectInterval);
      };

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setState(prev => ({ ...prev, connectionStatus: 'error' }));
    }
  }, [enableWebSocket, heartbeatInterval, reconnectInterval]);

  // Notification management
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    if (!enableNotifications) return;

    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    };

    setState(prev => ({
      ...prev,
      notifications: [newNotification, ...prev.notifications].slice(0, 50), // Keep last 50
    }));

    // Show toast notification
    const toastOptions = {
      position: 'bottom-right' as const,
      autoClose: (notification.persistent ? false : 5000) as number | false,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    };

    switch (notification.type) {
      case 'success':
        toast.success(notification.message, toastOptions);
        break;
      case 'error':
        toast.error(notification.message, toastOptions);
        break;
      case 'warning':
        toast.warning(notification.message, toastOptions);
        break;
      case 'info':
      default:
        toast.info(notification.message, toastOptions);
        break;
    }
  }, [enableNotifications]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'notification':
        addNotification(data.notification);
        break;
      
      case 'typing_start':
        setState(prev => ({
          ...prev,
          typingUsers: [...prev.typingUsers.filter(u => u !== data.user), data.user],
        }));
        break;
      
      case 'typing_stop':
        setState(prev => ({
          ...prev,
          typingUsers: prev.typingUsers.filter(u => u !== data.user),
        }));
        break;
      
      case 'system_status':
        setState(prev => ({
          ...prev,
          systemStatus: data.status,
        }));
        break;
      
      case 'performance_update':
        setState(prev => ({
          ...prev,
          performanceMetrics: data.metrics,
        }));
        break;
      
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }, [addNotification]);


  const markNotificationAsRead = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  }, []);

  const removeNotification = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(n => n.id !== id),
    }));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setState(prev => ({
      ...prev,
      notifications: [],
    }));
  }, []);

  // Typing indicators
  const sendTypingStart = useCallback((user: string = 'user') => {
    if (!enableTypingIndicators || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'typing_start',
      user,
    }));
  }, [enableTypingIndicators]);

  const sendTypingStop = useCallback((user: string = 'user') => {
    if (!enableTypingIndicators || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'typing_stop',
      user,
    }));
  }, [enableTypingIndicators]);

  // Performance monitoring
  const recordRequestTime = useCallback((startTime: number, success: boolean = true) => {
    if (!enablePerformanceMonitoring) return;

    const responseTime = Date.now() - startTime;
    performanceRef.current.requestTimes.push(responseTime);
    performanceRef.current.totalRequests++;
    
    if (!success) {
      performanceRef.current.errorCount++;
    }

    // Keep only last 100 request times
    if (performanceRef.current.requestTimes.length > 100) {
      performanceRef.current.requestTimes = performanceRef.current.requestTimes.slice(-100);
    }

    // Calculate metrics
    const avgResponseTime = performanceRef.current.requestTimes.reduce((a, b) => a + b, 0) / 
                            performanceRef.current.requestTimes.length;
    const errorRate = (performanceRef.current.errorCount / performanceRef.current.totalRequests) * 100;

    setState(prev => ({
      ...prev,
      performanceMetrics: {
        ...prev.performanceMetrics,
        responseTime: avgResponseTime,
        errorRate,
      },
    }));

    // Alert on performance issues
    if (avgResponseTime > 5000) {
      addNotification({
        type: 'warning',
        title: 'Slow Response',
        message: `Average response time is ${(avgResponseTime / 1000).toFixed(1)}s`,
      });
    }

    if (errorRate > 10) {
      addNotification({
        type: 'error',
        title: 'High Error Rate',
        message: `Error rate is ${errorRate.toFixed(1)}%`,
      });
    }
  }, [enablePerformanceMonitoring, addNotification]);

  // System status monitoring
  const checkSystemHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/chat/health');
      const health = await response.json();
      
      let status: 'online' | 'degraded' | 'offline' = 'online';
      
      if (health.status === 'DEGRADED') {
        status = 'degraded';
      } else if (health.status === 'ERROR' || !response.ok) {
        status = 'offline';
      }

      setState(prev => {
        if (prev.systemStatus !== status) {
          // Status changed, show notification
          addNotification({
            type: status === 'online' ? 'success' : status === 'degraded' ? 'warning' : 'error',
            title: 'System Status',
            message: `System is now ${status}`,
          });
        }
        
        return { ...prev, systemStatus: status };
      });

      return health;
    } catch (error) {
      setState(prev => ({ ...prev, systemStatus: 'offline' }));
      return null;
    }
  }, [addNotification]);

  // Initialize and cleanup
  useEffect(() => {
    if (enableWebSocket) {
      connectWebSocket();
    }

    // Check system health periodically
    const healthCheckInterval = setInterval(checkSystemHealth, 60000); // Every minute

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      
      clearInterval(healthCheckInterval);
    };
  }, [enableWebSocket, connectWebSocket, checkSystemHealth]);

  // Page visibility handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, reduce activity
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
      } else {
        // Page is visible, resume activity
        if (enableWebSocket && wsRef.current?.readyState === WebSocket.OPEN) {
          heartbeatIntervalRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'heartbeat' }));
            }
          }, heartbeatInterval);
        }
        
        // Check for missed notifications or status changes
        checkSystemHealth();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enableWebSocket, heartbeatInterval, checkSystemHealth]);

  return {
    // State
    ...state,
    
    // Computed values
    unreadNotifications: state.notifications.filter(n => !n.read),
    hasUnreadNotifications: state.notifications.some(n => !n.read),
    
    // Methods
    addNotification,
    markNotificationAsRead,
    removeNotification,
    clearAllNotifications,
    sendTypingStart,
    sendTypingStop,
    recordRequestTime,
    checkSystemHealth,
    
    // WebSocket methods
    connectWebSocket,
    disconnectWebSocket: () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    },
    
    // Utilities
    isSystemHealthy: state.systemStatus === 'online',
    getPerformanceStatus: () => {
      const { responseTime, errorRate } = state.performanceMetrics;
      if (errorRate > 10 || responseTime > 5000) return 'poor';
      if (errorRate > 5 || responseTime > 3000) return 'fair';
      return 'good';
    },
  };
};

export default useRealTimeFeatures;
