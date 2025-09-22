/**
 * Tests for useRealTimeFeatures hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import useRealTimeFeatures from '../../hooks/useRealTimeFeatures';

// Mock dependencies
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 100);
  }

  send(data: string) {
    // Mock send functionality
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
}

(global as any).WebSocket = MockWebSocket;

// Mock Notification API
const mockNotification = {
  permission: 'granted',
  requestPermission: jest.fn().mockResolvedValue('granted'),
};
(global as any).Notification = jest.fn().mockImplementation((title, options) => ({
  title,
  ...options,
}));
(global as any).Notification.permission = 'granted';
(global as any).Notification.requestPermission = mockNotification.requestPermission;

describe('useRealTimeFeatures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useRealTimeFeatures());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.systemStatus).toBe('online');
      expect(result.current.notifications).toEqual([]);
      expect(result.current.typingUsers).toEqual([]);
    });

    it('should initialize with custom options', () => {
      const { result } = renderHook(() =>
        useRealTimeFeatures({
          enableWebSocket: true,
          enableNotifications: false,
          enableTypingIndicators: false,
        })
      );

      expect(result.current.connectionStatus).toBe('connecting');
    });
  });

  describe('notifications', () => {
    it('should add notifications', () => {
      const { result } = renderHook(() => useRealTimeFeatures());

      act(() => {
        result.current.addNotification({
          type: 'info',
          title: 'Test Notification',
          message: 'This is a test',
        });
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0]).toMatchObject({
        type: 'info',
        title: 'Test Notification',
        message: 'This is a test',
        read: false,
      });
    });

    it('should mark notifications as read', () => {
      const { result } = renderHook(() => useRealTimeFeatures());

      act(() => {
        result.current.addNotification({
          type: 'info',
          title: 'Test Notification',
          message: 'This is a test',
        });
      });

      const notificationId = result.current.notifications[0].id;

      act(() => {
        result.current.markNotificationAsRead(notificationId);
      });

      expect(result.current.notifications[0].read).toBe(true);
    });

    it('should remove notifications', () => {
      const { result } = renderHook(() => useRealTimeFeatures());

      act(() => {
        result.current.addNotification({
          type: 'info',
          title: 'Test Notification',
          message: 'This is a test',
        });
      });

      const notificationId = result.current.notifications[0].id;

      act(() => {
        result.current.removeNotification(notificationId);
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    it('should clear all notifications', () => {
      const { result } = renderHook(() => useRealTimeFeatures());

      act(() => {
        result.current.addNotification({
          type: 'info',
          title: 'Test 1',
          message: 'Message 1',
        });
        result.current.addNotification({
          type: 'warning',
          title: 'Test 2',
          message: 'Message 2',
        });
      });

      expect(result.current.notifications).toHaveLength(2);

      act(() => {
        result.current.clearAllNotifications();
      });

      expect(result.current.notifications).toHaveLength(0);
    });

    it('should limit notifications to max count', () => {
      const { result } = renderHook(() => useRealTimeFeatures());

      act(() => {
        // Add 60 notifications (more than the 50 limit)
        for (let i = 0; i < 60; i++) {
          result.current.addNotification({
            type: 'info',
            title: `Test ${i}`,
            message: `Message ${i}`,
          });
        }
      });

      expect(result.current.notifications).toHaveLength(50);
    });
  });

  describe('performance monitoring', () => {
    it('should record request times', () => {
      const { result } = renderHook(() =>
        useRealTimeFeatures({ enablePerformanceMonitoring: true })
      );

      const startTime = Date.now() - 1000; // 1 second ago

      act(() => {
        result.current.recordRequestTime(startTime, true);
      });

      expect(result.current.performanceMetrics.responseTime).toBeGreaterThan(0);
      expect(result.current.performanceMetrics.errorRate).toBe(0);
    });

    it('should track error rates', () => {
      const { result } = renderHook(() =>
        useRealTimeFeatures({ enablePerformanceMonitoring: true })
      );

      const startTime = Date.now() - 1000;

      act(() => {
        result.current.recordRequestTime(startTime, false); // Failed request
      });

      expect(result.current.performanceMetrics.errorRate).toBeGreaterThan(0);
    });

    it('should alert on performance issues', () => {
      const { result } = renderHook(() =>
        useRealTimeFeatures({ enablePerformanceMonitoring: true })
      );

      const startTime = Date.now() - 6000; // 6 seconds ago (slow)

      act(() => {
        result.current.recordRequestTime(startTime, true);
      });

      // Should have added a warning notification
      expect(result.current.notifications.some(n => n.type === 'warning')).toBe(true);
    });
  });

  describe('system health', () => {
    it('should check system health', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'OK', components: {} }),
      });

      const { result } = renderHook(() => useRealTimeFeatures());

      await act(async () => {
        await result.current.checkSystemHealth();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/chat/health');
      expect(result.current.systemStatus).toBe('online');
    });

    it('should handle degraded system status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'DEGRADED', components: {} }),
      });

      const { result } = renderHook(() => useRealTimeFeatures());

      await act(async () => {
        await result.current.checkSystemHealth();
      });

      expect(result.current.systemStatus).toBe('degraded');
    });

    it('should handle offline system status', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useRealTimeFeatures());

      await act(async () => {
        await result.current.checkSystemHealth();
      });

      expect(result.current.systemStatus).toBe('offline');
    });
  });

  describe('WebSocket connection', () => {
    it('should connect to WebSocket when enabled', async () => {
      const { result } = renderHook(() =>
        useRealTimeFeatures({ enableWebSocket: true })
      );

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connecting');
      });

      // Wait for connection to open
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.connectionStatus).toBe('connected');
      });
    });

    it('should not connect to WebSocket when disabled', () => {
      const { result } = renderHook(() =>
        useRealTimeFeatures({ enableWebSocket: false })
      );

      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('utility methods', () => {
    it('should identify unread notifications', () => {
      const { result } = renderHook(() => useRealTimeFeatures());

      act(() => {
        result.current.addNotification({
          type: 'info',
          title: 'Unread',
          message: 'This is unread',
        });
        result.current.addNotification({
          type: 'info',
          title: 'Read',
          message: 'This will be read',
        });
      });

      // Mark one as read
      act(() => {
        result.current.markNotificationAsRead(result.current.notifications[1].id);
      });

      expect(result.current.unreadNotifications).toHaveLength(1);
      expect(result.current.hasUnreadNotifications).toBe(true);
    });

    it('should provide performance status', () => {
      const { result } = renderHook(() =>
        useRealTimeFeatures({ enablePerformanceMonitoring: true })
      );

      // Good performance
      act(() => {
        result.current.recordRequestTime(Date.now() - 500, true);
      });

      expect(result.current.getPerformanceStatus()).toBe('good');

      // Poor performance
      act(() => {
        result.current.recordRequestTime(Date.now() - 6000, false);
      });

      expect(result.current.getPerformanceStatus()).toBe('poor');
    });

    it('should identify system health', () => {
      const { result } = renderHook(() => useRealTimeFeatures());

      expect(result.current.isSystemHealthy).toBe(true);

      act(() => {
        // Simulate system health check that returns degraded status
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'DEGRADED' }),
        });
      });
    });
  });
});
