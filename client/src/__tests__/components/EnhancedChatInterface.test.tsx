/**
 * Tests for EnhancedChatInterface component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import EnhancedChatInterface from '../../components/enhanced/EnhancedChatInterface';
import { ThemeProvider as CustomThemeProvider } from '../../contexts/ThemeContext';
import { ChatSettingsProvider } from '../../contexts/ChatSettingsContext';

// Mock dependencies
jest.mock('../../services/chatService', () => ({
  chatService: {
    sendMessage: jest.fn(),
    getHistory: jest.fn(),
    clearHistory: jest.fn(),
    checkHealth: jest.fn(),
    getSessionId: jest.fn(() => 'test-session-id'),
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
    addNotification: jest.fn(),
    recordRequestTime: jest.fn(),
    sendTypingStart: jest.fn(),
    sendTypingStop: jest.fn(),
    isSystemHealthy: true,
    hasUnreadNotifications: false,
  }));
});

jest.mock('../../hooks/useAccessibility', () => ({
  useAccessibility: () => ({
    announceToScreenReader: jest.fn(),
    focusElement: jest.fn(),
    setupKeyboardNavigation: jest.fn(),
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

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <CustomThemeProvider>
      <ChatSettingsProvider>
        {component}
      </ChatSettingsProvider>
    </CustomThemeProvider>
  );
};

describe('EnhancedChatInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    chatService.getHistory.mockResolvedValue({
      conversation: [],
      metadata: {},
    });
    
    chatService.checkHealth.mockResolvedValue({
      status: 'OK',
      components: {},
    });
  });

  it('renders the chat interface', async () => {
    renderWithProviders(<EnhancedChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByText('Fund Management Assistant')).toBeInTheDocument();
    });
  });

  it('displays welcome message initially', async () => {
    renderWithProviders(<EnhancedChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByText(/Hello! I'm your Fund Management Assistant/)).toBeInTheDocument();
    });
  });

  it('loads conversation history', async () => {
    const mockHistory = {
      conversation: [
        {
          id: '1',
          content: 'Hello',
          sender: 'user',
          timestamp: new Date().toISOString(),
        },
        {
          id: '2',
          content: 'Hi there!',
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          confidence: 0.9,
          citations: [],
          sources: [],
        },
      ],
      metadata: {},
    };

    chatService.getHistory.mockResolvedValue(mockHistory);

    renderWithProviders(<EnhancedChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
    });
  });

  it('sends messages when user submits input', async () => {
    const mockResponse = {
      message: 'This is a response',
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
      processingTime: 1500,
    };

    chatService.sendMessage.mockResolvedValue(mockResponse);

    renderWithProviders(<EnhancedChatInterface />);
    
    await waitFor(() => {
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox');
    
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      expect(chatService.sendMessage).toHaveBeenCalledWith('Test message', expect.any(Object));
    });

    await waitFor(() => {
      expect(screen.getByText('This is a response')).toBeInTheDocument();
    });
  });

  it('handles message sending errors gracefully', async () => {
    chatService.sendMessage.mockRejectedValue(new Error('Network error'));

    renderWithProviders(<EnhancedChatInterface />);
    
    await waitFor(() => {
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox');
    
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      expect(screen.getByText(/I apologize, but I encountered an error/)).toBeInTheDocument();
    });
  });

  it('opens settings panel when settings button is clicked', async () => {
    renderWithProviders(<EnhancedChatInterface />);
    
    await waitFor(() => {
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('clears chat history when clear button is clicked', async () => {
    chatService.clearHistory.mockResolvedValue({});

    renderWithProviders(<EnhancedChatInterface />);
    
    await waitFor(() => {
      const menuButton = screen.getByRole('button', { name: /more/i });
      fireEvent.click(menuButton);
    });

    await waitFor(() => {
      const clearButton = screen.getByText('Clear Chat');
      fireEvent.click(clearButton);
    });

    await waitFor(() => {
      expect(chatService.clearHistory).toHaveBeenCalled();
    });
  });

  it('exports chat data when export button is clicked', async () => {
    // Mock URL.createObjectURL
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    global.URL.revokeObjectURL = jest.fn();

    // Mock document methods
    const mockClick = jest.fn();
    const mockAppendChild = jest.fn();
    const mockRemoveChild = jest.fn();
    
    document.createElement = jest.fn().mockReturnValue({
      click: mockClick,
      href: '',
      download: '',
    });
    document.body.appendChild = mockAppendChild;
    document.body.removeChild = mockRemoveChild;

    renderWithProviders(<EnhancedChatInterface />);
    
    await waitFor(() => {
      const menuButton = screen.getByRole('button', { name: /more/i });
      fireEvent.click(menuButton);
    });

    await waitFor(() => {
      const exportButton = screen.getByText('Export Chat');
      fireEvent.click(exportButton);
    });

    expect(mockClick).toHaveBeenCalled();
  });

  it('displays system status in header', async () => {
    renderWithProviders(<EnhancedChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByText('Online')).toBeInTheDocument();
    });
  });

  it('shows RAG enabled indicator when knowledge base is active', async () => {
    renderWithProviders(<EnhancedChatInterface />);
    
    await waitFor(() => {
      expect(screen.getByText('RAG Enabled')).toBeInTheDocument();
    });
  });

  it('displays performance metrics when enabled', async () => {
    renderWithProviders(<EnhancedChatInterface />);
    
    await waitFor(() => {
      // Performance icon should be visible
      const performanceButton = screen.getByRole('button', { name: /performance/i });
      expect(performanceButton).toBeInTheDocument();
    });
  });

  it('toggles live updates panel', async () => {
    renderWithProviders(<EnhancedChatInterface />);
    
    await waitFor(() => {
      const liveUpdatesButton = screen.getByTitle('Toggle live updates');
      fireEvent.click(liveUpdatesButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Live Updates')).toBeInTheDocument();
    });
  });

  it('handles scroll to bottom functionality', async () => {
    const mockScrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = mockScrollIntoView;

    renderWithProviders(<EnhancedChatInterface />);
    
    // Add messages to trigger scroll button
    const mockResponse = {
      message: 'Response',
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

    await waitFor(() => {
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox');
    
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    // The scroll functionality should be called automatically
    await waitFor(() => {
      expect(mockScrollIntoView).toHaveBeenCalled();
    });
  });

  it('provides feedback functionality for messages', async () => {
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

    renderWithProviders(<EnhancedChatInterface />);
    
    await waitFor(() => {
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox');
    
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      expect(screen.getByText('Test response')).toBeInTheDocument();
    });

    // Feedback buttons should be available in the message bubble
    await waitFor(() => {
      const thumbsUpButtons = screen.getAllByRole('button', { name: /thumbs up|positive/i });
      expect(thumbsUpButtons.length).toBeGreaterThan(0);
    });
  });

  it('handles regenerate response functionality', async () => {
    const mockResponse = {
      message: 'Original response',
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

    const mockRegeneratedResponse = {
      ...mockResponse,
      message: 'Regenerated response',
    };

    chatService.sendMessage
      .mockResolvedValueOnce(mockResponse)
      .mockResolvedValueOnce(mockRegeneratedResponse);

    renderWithProviders(<EnhancedChatInterface />);
    
    const input = screen.getByRole('textbox');
    
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    });

    await waitFor(() => {
      expect(screen.getByText('Original response')).toBeInTheDocument();
    });

    // Find and click regenerate button
    await waitFor(() => {
      const regenerateButtons = screen.getAllByRole('button', { name: /regenerate/i });
      expect(regenerateButtons.length).toBeGreaterThan(0);
      fireEvent.click(regenerateButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('Regenerated response')).toBeInTheDocument();
    });
  });
});
