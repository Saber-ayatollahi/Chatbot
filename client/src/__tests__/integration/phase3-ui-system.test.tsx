/**
 * Integration Tests for Phase 3 UI System
 * Tests the complete UI enhancement system including real-time features
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ThemeProvider as CustomThemeProvider } from '../../contexts/ThemeContext';
import { ChatSettingsProvider } from '../../contexts/ChatSettingsContext';
import App from '../../App';

// Mock all external dependencies
jest.mock('../../services/chatService', () => ({
  chatService: {
    sendMessage: jest.fn(),
    getHistory: jest.fn(),
    clearHistory: jest.fn(),
    checkHealth: jest.fn(),
    getSessionId: jest.fn(() => 'test-session-id'),
    getSystemStats: jest.fn(),
    testSystem: jest.fn(),
  },
}));

jest.mock('../../hooks/useRealTimeFeatures', () => {
  return jest.fn(() => ({
    isConnected: false,
    connectionStatus: 'disconnected',
    systemStatus: 'online',
    performanceMetrics: {
      responseTime: 1000,
      errorRate: 0,
      latency: 50,
    },
    notifications: [],
    unreadNotifications: [],
    hasUnreadNotifications: false,
    addNotification: jest.fn(),
    markNotificationAsRead: jest.fn(),
    removeNotification: jest.fn(),
    clearAllNotifications: jest.fn(),
    recordRequestTime: jest.fn(),
    sendTypingStart: jest.fn(),
    sendTypingStop: jest.fn(),
    isSystemHealthy: true,
    checkSystemHealth: jest.fn(),
  }));
});

jest.mock('../../hooks/useAccessibility', () => ({
  useAccessibility: () => ({
    announceToScreenReader: jest.fn(),
    focusElement: jest.fn(),
    setupKeyboardNavigation: jest.fn(),
    isHighContrast: false,
    isReducedMotion: false,
    fontSize: 'medium',
    keyboardNavigation: true,
  }),
}));

jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
  ToastContainer: () => <div data-testid="toast-container" />,
}));

jest.mock('react-hotkeys-hook', () => ({
  useHotkeys: jest.fn(),
}));

jest.mock('lodash.debounce', () => jest.fn((fn) => fn));

const { chatService } = require('../../services/chatService');

describe('Phase 3 UI System Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    chatService.getHistory.mockResolvedValue({
      conversation: [],
      metadata: {},
    });
    
    chatService.checkHealth.mockResolvedValue({
      status: 'OK',
      components: {
        database: { status: 'healthy' },
        openai: { status: 'healthy' },
        vectorstore: { status: 'healthy' },
      },
    });

    chatService.getSystemStats.mockResolvedValue({
      totalChunks: 1000,
      totalSources: 50,
      avgConfidence: 0.85,
      totalQueries: 500,
    });
  });

  describe('Complete Application Flow', () => {
    it('renders the complete application with all providers', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('Fund Management Assistant')).toBeInTheDocument();
      });
    });

    it('initializes with proper theme and settings contexts', async () => {
      render(<App />);
      
      await waitFor(() => {
        // Theme should be applied
        const app = document.querySelector('.App');
        expect(app).toBeInTheDocument();
        
        // Settings should be available
        expect(screen.getByText('RAG Enabled')).toBeInTheDocument();
      });
    });

    it('handles complete message flow with RAG features', async () => {
      const mockResponse = {
        message: 'Here is information about fund creation based on our knowledge base.',
        sessionId: 'test-session',
        timestamp: new Date().toISOString(),
        useKnowledgeBase: true,
        confidence: 0.92,
        confidenceLevel: 'high',
        citations: [
          {
            id: 'cite-1',
            text: 'Fund creation requires proper documentation',
            source: 'Fund Management Guide',
            page: 15,
            relevanceScore: 0.95,
          },
        ],
        sources: [
          {
            id: 'source-1',
            title: 'Fund Management Guide',
            type: 'document',
            relevanceScore: 0.95,
            chunkCount: 3,
          },
        ],
        qualityIndicators: {
          hasRelevantSources: true,
          citationsPresent: true,
          confidenceAboveThreshold: true,
          responseComplete: true,
        },
        retrievalMetadata: {
          queryEmbeddingTime: 50,
          vectorSearchTime: 120,
          rerankingTime: 80,
          totalChunksRetrieved: 5,
          chunksAfterFiltering: 3,
        },
        generationMetadata: {
          promptTokens: 1500,
          completionTokens: 300,
          totalTokens: 1800,
          model: 'gpt-4',
          temperature: 0.7,
        },
        processingTime: 2500,
      };

      chatService.sendMessage.mockResolvedValue(mockResponse);

      render(<App />);
      
      await waitFor(() => {
        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
      });

      const input = screen.getByRole('textbox');
      
      await act(async () => {
        fireEvent.change(input, { target: { value: 'How do I create a new fund?' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
      });

      await waitFor(() => {
        expect(screen.getByText(/Here is information about fund creation/)).toBeInTheDocument();
      });

      // Check that citations are displayed
      await waitFor(() => {
        expect(screen.getByText('Fund Management Guide')).toBeInTheDocument();
      });

      // Check confidence indicator
      await waitFor(() => {
        expect(screen.getByText(/high/i)).toBeInTheDocument();
      });
    });
  });

  describe('Theme System Integration', () => {
    it('supports theme switching', async () => {
      render(<App />);
      
      await waitFor(() => {
        const settingsButton = screen.getByRole('button', { name: /settings/i });
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        // Settings panel should open
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Look for theme controls (these would be in the settings panel)
      await waitFor(() => {
        const themeControls = screen.getByText(/theme/i);
        expect(themeControls).toBeInTheDocument();
      });
    });

    it('applies responsive design correctly', async () => {
      // Mock window resize
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      render(<App />);
      
      await waitFor(() => {
        const chatContainer = document.querySelector('.chat-header');
        expect(chatContainer).toBeInTheDocument();
      });

      // Test mobile breakpoint
      act(() => {
        window.innerWidth = 480;
        window.dispatchEvent(new Event('resize'));
      });

      await waitFor(() => {
        // Interface should still be functional
        expect(screen.getByText('Fund Management Assistant')).toBeInTheDocument();
      });
    });
  });

  describe('Real-Time Features Integration', () => {
    it('displays connection status', async () => {
      render(<App />);
      
      await waitFor(() => {
        // Connection status should be visible
        expect(screen.getByText(/online|offline|disconnected/i)).toBeInTheDocument();
      });
    });

    it('shows notification center', async () => {
      render(<App />);
      
      await waitFor(() => {
        const notificationButton = screen.getByRole('button', { name: /notifications/i });
        expect(notificationButton).toBeInTheDocument();
        
        fireEvent.click(notificationButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Notifications')).toBeInTheDocument();
      });
    });

    it('toggles live updates panel', async () => {
      render(<App />);
      
      await waitFor(() => {
        const liveUpdatesButton = screen.getByTitle('Toggle live updates');
        fireEvent.click(liveUpdatesButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Live Updates')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Integration', () => {
    it('provides keyboard navigation', async () => {
      render(<App />);
      
      await waitFor(() => {
        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
        
        // Test keyboard focus
        input.focus();
        expect(document.activeElement).toBe(input);
      });
    });

    it('supports screen reader announcements', async () => {
      const mockResponse = {
        message: 'Test response',
        sessionId: 'test-session',
        timestamp: new Date().toISOString(),
        useKnowledgeBase: true,
        confidence: 0.85,
        confidenceLevel: 'high',
        citations: [],
        sources: [],
        qualityIndicators: {
          hasRelevantSources: true,
          citationsPresent: false,
          confidenceAboveThreshold: true,
          responseComplete: true,
        },
      };

      chatService.sendMessage.mockResolvedValue(mockResponse);

      render(<App />);
      
      const input = screen.getByRole('textbox');
      
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test message' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
      });

      await waitFor(() => {
        expect(screen.getByText('Test response')).toBeInTheDocument();
      });

      // Response should be accessible
      const responseElement = screen.getByText('Test response');
      expect(responseElement).toHaveAttribute('role', 'article');
    });

    it('provides proper ARIA labels and descriptions', async () => {
      render(<App />);
      
      await waitFor(() => {
        const input = screen.getByRole('textbox');
        expect(input).toHaveAttribute('aria-label');
        
        const settingsButton = screen.getByRole('button', { name: /settings/i });
        expect(settingsButton).toHaveAttribute('aria-label');
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('handles API errors gracefully', async () => {
      chatService.sendMessage.mockRejectedValue(new Error('API Error'));

      render(<App />);
      
      const input = screen.getByRole('textbox');
      
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test message' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
      });

      await waitFor(() => {
        expect(screen.getByText(/I apologize, but I encountered an error/)).toBeInTheDocument();
      });
    });

    it('handles system health degradation', async () => {
      chatService.checkHealth.mockResolvedValue({
        status: 'DEGRADED',
        components: {
          database: { status: 'healthy' },
          openai: { status: 'degraded' },
          vectorstore: { status: 'healthy' },
        },
      });

      render(<App />);
      
      await waitFor(() => {
        // System status should reflect degraded state
        expect(screen.getByText(/degraded/i)).toBeInTheDocument();
      });
    });

    it('provides fallback functionality', async () => {
      const mockFallbackResponse = {
        message: 'I apologize, but I\'m experiencing some issues. Here\'s a basic response.',
        sessionId: 'test-session',
        timestamp: new Date().toISOString(),
        useKnowledgeBase: false,
        confidence: 0.3,
        confidenceLevel: 'low',
        citations: [],
        sources: [],
        qualityIndicators: {
          hasRelevantSources: false,
          citationsPresent: false,
          confidenceAboveThreshold: false,
          responseComplete: true,
        },
        fallbackApplied: true,
        error: 'Knowledge base temporarily unavailable',
      };

      chatService.sendMessage.mockResolvedValue(mockFallbackResponse);

      render(<App />);
      
      const input = screen.getByRole('textbox');
      
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test message' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
      });

      await waitFor(() => {
        expect(screen.getByText(/I apologize, but I'm experiencing some issues/)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Integration', () => {
    it('displays performance metrics', async () => {
      render(<App />);
      
      await waitFor(() => {
        const performanceButton = screen.getByRole('button', { name: /performance/i });
        expect(performanceButton).toBeInTheDocument();
      });
    });

    it('handles large conversation histories efficiently', async () => {
      const largeHistory = {
        conversation: Array.from({ length: 100 }, (_, i) => ({
          id: i.toString(),
          content: `Message ${i}`,
          sender: i % 2 === 0 ? 'user' : 'assistant',
          timestamp: new Date().toISOString(),
        })),
        metadata: {},
      };

      chatService.getHistory.mockResolvedValue(largeHistory);

      render(<App />);
      
      await waitFor(() => {
        // Should handle large history without performance issues
        expect(screen.getByText('Message 99')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Settings Integration', () => {
    it('persists and applies user settings', async () => {
      render(<App />);
      
      await waitFor(() => {
        const settingsButton = screen.getByRole('button', { name: /settings/i });
        fireEvent.click(settingsButton);
      });

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Settings should be available and functional
      await waitFor(() => {
        const settingsContent = screen.getByText(/settings/i);
        expect(settingsContent).toBeInTheDocument();
      });
    });

    it('updates chat behavior based on settings', async () => {
      render(<App />);
      
      // RAG should be enabled by default
      await waitFor(() => {
        expect(screen.getByText('RAG Enabled')).toBeInTheDocument();
      });

      // Settings changes should affect chat behavior
      const mockResponse = {
        message: 'Response with RAG',
        sessionId: 'test-session',
        timestamp: new Date().toISOString(),
        useKnowledgeBase: true,
        confidence: 0.85,
        confidenceLevel: 'high',
        citations: [],
        sources: [],
        qualityIndicators: {
          hasRelevantSources: true,
          citationsPresent: false,
          confidenceAboveThreshold: true,
          responseComplete: true,
        },
      };

      chatService.sendMessage.mockResolvedValue(mockResponse);

      const input = screen.getByRole('textbox');
      
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Test with RAG' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
      });

      await waitFor(() => {
        expect(chatService.sendMessage).toHaveBeenCalledWith(
          'Test with RAG',
          expect.objectContaining({
            useKnowledgeBase: true,
          })
        );
      });
    });
  });
});
