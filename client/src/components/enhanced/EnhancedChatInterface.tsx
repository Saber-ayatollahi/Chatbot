/**
 * Enhanced Chat Interface Component
 * Complete RAG-powered chat interface with all Phase 3 features
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast, ToastContainer } from 'react-toastify';
import debounce from 'lodash.debounce';
import useRealTimeFeatures from '../../hooks/useRealTimeFeatures';
import {
  Box,
  Typography,
  IconButton,
  Fab,
  Tooltip,
  Alert,
  AppBar,
  Toolbar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  MoreVert as MoreIcon,
  Download as ExportIcon,
  Delete as ClearIcon,
  Share as ShareIcon,
  BugReport as DebugIcon,
  Speed as PerformanceIcon,
  Psychology as RAGIcon,
  KeyboardArrowUp as ScrollUpIcon,
} from '@mui/icons-material';
import { Message, EnhancedChatResponse } from '../../types/chat';
import { useTheme } from '../../contexts/ThemeContext';
import { useChatSettings } from '../../contexts/ChatSettingsContext';
import { chatService } from '../../services/chatService';
import EnhancedMessageBubble from './EnhancedMessageBubble';
import MessageInput from '../MessageInput';
import TypingIndicator from '../TypingIndicator';
import SettingsPanel from '../interactive/SettingsPanel';
import NotificationCenter from '../notifications/NotificationCenter';
import ConnectionStatus from '../realtime/ConnectionStatus';
import LiveUpdates from '../realtime/LiveUpdates';
import TypingIndicatorReal from '../realtime/TypingIndicator';
import { animationVariants } from '../../theme';

interface EnhancedChatInterfaceProps {
  className?: string;
}

const ChatContainer = styled(motion.div)<{ $isDark: boolean; $compactMode: boolean }>`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: ${props => props.$isDark ? '#121212' : '#fafafa'};
  position: relative;
  
  .chat-header {
    position: sticky;
    top: 0;
    z-index: 100;
    background: ${props => props.$isDark ? '#1e1e1e' : '#ffffff'};
    border-bottom: 1px solid ${props => props.$isDark ? '#404040' : '#e0e0e0'};
    
    .MuiToolbar-root {
      padding: ${props => props.$compactMode ? '8px 16px' : '12px 24px'};
      min-height: ${props => props.$compactMode ? '56px' : '64px'};
    }
    
    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      
      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
        
        .chat-title {
          display: flex;
          flex-direction: column;
          
          .title-main {
            font-weight: 600;
            font-size: ${props => props.$compactMode ? '1.1rem' : '1.25rem'};
          }
          
          .title-subtitle {
            font-size: 0.875rem;
            opacity: 0.7;
            display: flex;
            align-items: center;
            gap: 4px;
          }
        }
      }
      
      .header-right {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }
  }
  
  .chat-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    
    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: ${props => props.$compactMode ? '8px 12px' : '16px 24px'};
      scroll-behavior: smooth;
      
      &::-webkit-scrollbar {
        width: 6px;
      }
      
      &::-webkit-scrollbar-track {
        background: ${props => props.$isDark ? '#2d2d2d' : '#f1f1f1'};
      }
      
      &::-webkit-scrollbar-thumb {
        background: ${props => props.$isDark ? '#555' : '#c1c1c1'};
        border-radius: 3px;
        
        &:hover {
          background: ${props => props.$isDark ? '#777' : '#a1a1a1'};
        }
      }
      
      .messages-list {
        max-width: 1000px;
        margin: 0 auto;
        padding-bottom: 20px;
      }
      
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        text-align: center;
        opacity: 0.6;
        
        .empty-icon {
          font-size: 4rem;
          margin-bottom: 16px;
          color: #2196f3;
        }
        
        .empty-title {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 8px;
        }
        
        .empty-description {
          font-size: 1rem;
          max-width: 400px;
          line-height: 1.5;
        }
      }
    }
    
    .scroll-to-bottom {
      position: absolute;
      bottom: 80px;
      right: 24px;
      z-index: 10;
    }
  }
  
  .chat-footer {
    position: sticky;
    bottom: 0;
    background: ${props => props.$isDark ? '#1e1e1e' : '#ffffff'};
    border-top: 1px solid ${props => props.$isDark ? '#404040' : '#e0e0e0'};
    padding: ${props => props.$compactMode ? '12px 16px' : '16px 24px'};
    
    .footer-content {
      max-width: 1000px;
      margin: 0 auto;
      position: relative;
    }
  }
  
  .system-alerts {
    position: absolute;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    width: 90%;
    max-width: 600px;
  }
  
  .performance-indicator {
    position: fixed;
    top: 100px;
    right: 24px;
    z-index: 1000;
    background: ${props => props.$isDark ? '#2d2d2d' : '#ffffff'};
    border-radius: 8px;
    padding: 8px 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border: 1px solid ${props => props.$isDark ? '#404040' : '#e0e0e0'};
    font-size: 0.75rem;
    opacity: 0.8;
  }
`;

const SystemStatus = styled(motion.div)<{ $isDark: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  
  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    
    &.online {
      background: #4caf50;
    }
    
    &.degraded {
      background: #ff9800;
    }
    
    &.offline {
      background: #f44336;
    }
  }
  
  .status-text {
    opacity: 0.8;
  }
`;

export const EnhancedChatInterface: React.FC<EnhancedChatInterfaceProps> = ({
  className,
}) => {
  const { uiTheme } = useTheme();
  const { settings, updateSettings } = useChatSettings();
  
  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showLiveUpdates, setShowLiveUpdates] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<{
    avgResponseTime: number;
    successRate: number;
  }>({ avgResponseTime: 0, successRate: 100 });

  // Real-time features
  const {
    performanceMetrics: realTimeMetrics,
    addNotification,
    recordRequestTime,
    sendTypingStart,
    sendTypingStop,
  } = useRealTimeFeatures({
    enableWebSocket: true, // Now enabled with WebSocket server implementation
    enableNotifications: true,
    enablePerformanceMonitoring: true,
  });

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<Message | null>(null);

  const isDark = uiTheme.mode === 'dark';
  const isCompact = uiTheme.compactMode;

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Handle scroll detection
  const handleScroll = useCallback(() => {
    const debouncedScroll = debounce(() => {
      if (!messagesContainerRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom && messages.length > 0);
    }, 100);
    
    return debouncedScroll();
  }, [messages.length]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load conversation history
        const history = await chatService.getHistory();
        if (history.conversation && history.conversation.length > 0) {
          const formattedMessages = history.conversation.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
          setMessages(formattedMessages);
        } else {
          // Set welcome message
          setMessages([{
            id: '1',
            content: "Hello! I'm your Fund Management Assistant powered by advanced AI and comprehensive knowledge base. I can help you with fund creation, compliance requirements, NAV calculations, and more. What would you like to know?",
            sender: 'assistant',
            timestamp: new Date(),
            useKnowledgeBase: true,
            confidence: 0.95,
            confidenceLevel: 'high',
            citations: [],
            sources: [],
            qualityIndicators: {
              hasRelevantSources: true,
              citationsPresent: false,
              confidenceAboveThreshold: true,
              responseComplete: true,
            },
          }]);
        }

        // Load system health
        const health = await chatService.checkHealth();
        setSystemHealth(health);
      } catch (error) {
        console.error('Failed to load initial data:', error);
        toast.error('Failed to initialize chat interface');
      }
    };

    loadInitialData();
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage !== lastMessageRef.current) {
        scrollToBottom();
        lastMessageRef.current = latestMessage;
      }
    }
  }, [messages, scrollToBottom]);

  // Clear chat function
  const handleClearChat = async () => {
    try {
      await chatService.clearHistory();
      setMessages([{
        id: '1',
        content: "Chat cleared! I'm ready to help you with your fund management questions.",
        sender: 'assistant',
        timestamp: new Date(),
        useKnowledgeBase: true,
        confidence: 0.95,
        confidenceLevel: 'high',
        citations: [],
        sources: [],
      }]);
      
      addNotification({
        type: 'success',
        title: 'Chat Cleared',
        message: 'Chat history has been cleared successfully',
      });
    } catch (error) {
      console.error('Failed to clear chat:', error);
      addNotification({
        type: 'error',
        title: 'Clear Failed',
        message: 'Failed to clear chat history',
      });
    }
  };

  // Keyboard shortcuts
  useHotkeys('ctrl+k, cmd+k', () => setSettingsOpen(true), { preventDefault: true });
  useHotkeys('ctrl+shift+c, cmd+shift+c', handleClearChat, { preventDefault: true });
  useHotkeys('escape', () => {
    setSettingsOpen(false);
    setMenuAnchor(null);
  });

  // Message handling
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const startTime = Date.now();
      
      // Show typing indicator for real-time experience
      sendTypingStart();
      
      const response: EnhancedChatResponse = await chatService.sendMessage(content, settings);
      const responseTime = Date.now() - startTime;

      // Record performance metrics for real-time monitoring
      recordRequestTime(startTime, true);

      // Update local performance metrics
      setPerformanceMetrics(prev => ({
        avgResponseTime: (prev.avgResponseTime + responseTime) / 2,
        successRate: Math.min(prev.successRate + 1, 100),
      }));

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.message,
        sender: 'assistant',
        timestamp: new Date(response.timestamp),
        useKnowledgeBase: response.useKnowledgeBase,
        confidence: response.confidence,
        confidenceLevel: response.confidenceLevel,
        citations: response.citations,
        sources: response.sources,
        qualityIndicators: response.qualityIndicators,
        retrievalMetadata: response.retrievalMetadata,
        generationMetadata: response.generationMetadata,
        processingMetadata: response.processingMetadata,
        warnings: response.warnings,
        suggestions: response.suggestions,
        fallbackApplied: response.fallbackApplied,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Show notifications for warnings or low confidence
      if (response.warnings && response.warnings.length > 0) {
        addNotification({
          type: 'warning',
          title: 'Response Warning',
          message: response.warnings[0],
        });
      }

      if (response.confidence < 0.6) {
        addNotification({
          type: 'info',
          title: 'Low Confidence',
          message: 'Response confidence is lower than usual. Consider rephrasing your question.',
        });
      }

      // Stop typing indicator
      sendTypingStop();

    } catch (err: any) {
      console.error('Chat error:', err);
      setError('Failed to send message. Please try again.');
      
      // Record failed request
      recordRequestTime(Date.now(), false);
      
      // Update performance metrics for failure
      setPerformanceMetrics(prev => ({
        ...prev,
        successRate: Math.max(prev.successRate - 5, 0),
      }));

      // Stop typing indicator
      sendTypingStop();

      // Show error notification
      addNotification({
        type: 'error',
        title: 'Message Failed',
        message: 'Failed to send message. Please try again.',
      });

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'I apologize, but I encountered an error processing your request. Please try again, or rephrase your question.',
        sender: 'assistant',
        timestamp: new Date(),
        isError: true,
      };

      setMessages(prev => [...prev, errorMessage]);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };


  const handleExportChat = () => {
    const chatData = {
      messages,
      settings,
      exportDate: new Date().toISOString(),
      sessionId: chatService.getSessionId(),
    };

    const blob = new Blob([JSON.stringify(chatData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Chat exported successfully');
  };

  const handleShareChat = () => {
    const shareData = {
      title: 'Fund Management Chat',
      text: 'Check out this conversation with the Fund Management Assistant',
      url: window.location.href,
    };

    if (navigator.share) {
      navigator.share(shareData);
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    }
  };

  const handleFeedback = async (messageId: string, feedback: 'positive' | 'negative') => {
    try {
      // Find the message to get context
      const message = messages.find(m => m.id === messageId);
      const messageIndex = messages.findIndex(m => m.id === messageId);
      const userMessage = messageIndex > 0 ? messages[messageIndex - 1] : null;
      
      const rating = feedback === 'positive' ? 1 : -1;
      
      // Prepare feedback data with context
      const feedbackOptions = {
        userQuery: userMessage?.content || '',
        assistantResponse: message?.content || '',
        retrievedChunks: (message as any)?.sources || [],
        citations: (message as any)?.citations || [],
        responseQualityScore: (message as any)?.confidence || undefined,
        responseTimeMs: (message as any)?.processingTime || undefined,
        confidenceScore: (message as any)?.confidence || undefined,
        metadata: {
          feedbackSource: 'chat_interface',
          messageType: message?.sender || 'assistant',
          timestamp: new Date().toISOString()
        }
      };

      // Submit feedback to server
      const result = await chatService.submitFeedback(messageId, rating, feedbackOptions);
      
      // Update UI to show feedback was submitted
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, feedbackSubmitted: feedback, feedbackId: result.feedbackId }
          : msg
      ));
      
      toast.success(`Thank you for your ${feedback} feedback! Your input helps improve our responses.`);
      
      // Log the successful feedback submission
      console.log('Feedback submitted successfully:', {
        messageId,
        feedbackId: result.feedbackId,
        rating: feedback,
        processingTime: result.processingTime
      });
      
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error(`Failed to submit feedback. Please try again.`);
    }
  };

  const handleRegenerateResponse = async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const userMessage = messages[messageIndex - 1];
    if (!userMessage || userMessage.sender !== 'user') return;

    // Remove the assistant message and regenerate
    setMessages(prev => prev.slice(0, messageIndex));
    await handleSendMessage(userMessage.content);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const getSystemStatusInfo = () => {
    if (!systemHealth) return { status: 'offline', text: 'Connecting...' };
    
    if (systemHealth.status === 'OK') {
      return { status: 'online', text: 'Online' };
    } else if (systemHealth.status === 'DEGRADED') {
      return { status: 'degraded', text: 'Degraded' };
    } else {
      return { status: 'offline', text: 'Offline' };
    }
  };

  const statusInfo = getSystemStatusInfo();

  return (
    <ChatContainer
      $isDark={isDark}
      $compactMode={isCompact}
      className={className}
      variants={animationVariants.fadeIn}
      initial="initial"
      animate="animate"
    >
      {/* Header */}
      <AppBar position="static" elevation={0} className="chat-header">
        <Toolbar>
          <div className="header-content">
            <div className="header-left">
              <div className="chat-title">
                <Typography className="title-main">
                  Fund Management Assistant
                </Typography>
                <div className="title-subtitle">
                  <SystemStatus $isDark={isDark}>
                    <div className={`status-indicator ${statusInfo.status}`} />
                    <span className="status-text">{statusInfo.text}</span>
                  </SystemStatus>
                  {settings.useKnowledgeBase && (
                    <>
                      <span>•</span>
                      <RAGIcon fontSize="small" />
                      <span>RAG Enabled</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="header-right">
              {/* Connection Status */}
              <ConnectionStatus 
                showDetails
                enableRealTime={false}
                compact
              />
              
              {/* Performance Metrics */}
              {(performanceMetrics.avgResponseTime > 0 || realTimeMetrics.responseTime > 0) && settings.showProcessingTime && (
                <Tooltip title={`Avg: ${(realTimeMetrics.responseTime || performanceMetrics.avgResponseTime).toFixed(0)}ms, Success: ${performanceMetrics.successRate}%`}>
                  <IconButton size="small">
                    <PerformanceIcon />
                  </IconButton>
                </Tooltip>
              )}
              
              {/* Live Updates Toggle */}
              <Tooltip title="Toggle live updates">
                <IconButton 
                  size="small" 
                  onClick={() => setShowLiveUpdates(!showLiveUpdates)}
                  color={showLiveUpdates ? 'primary' : 'default'}
                >
                  <DebugIcon />
                </IconButton>
              </Tooltip>
              
              {/* Notification Center */}
              <NotificationCenter 
                enableRealTime
                showSystemNotifications
                onSettingsClick={() => setSettingsOpen(true)}
              />
              
              <IconButton onClick={() => setSettingsOpen(true)} size="small">
                <SettingsIcon />
              </IconButton>
              
              <IconButton onClick={handleMenuOpen} size="small">
                <MoreIcon />
              </IconButton>
            </div>
          </div>
        </Toolbar>
      </AppBar>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { handleClearChat(); handleMenuClose(); }}>
          <ListItemIcon><ClearIcon /></ListItemIcon>
          <ListItemText>Clear Chat</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleExportChat(); handleMenuClose(); }}>
          <ListItemIcon><ExportIcon /></ListItemIcon>
          <ListItemText>Export Chat</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleShareChat(); handleMenuClose(); }}>
          <ListItemIcon><ShareIcon /></ListItemIcon>
          <ListItemText>Share</ListItemText>
        </MenuItem>
      </Menu>

      {/* System Alerts */}
      <div className="system-alerts">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Alert 
                severity="error" 
                onClose={() => setError(null)}
                sx={{ marginBottom: 1 }}
              >
                {error}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Live Updates Panel */}
      <AnimatePresence>
        {showLiveUpdates && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              position: 'fixed',
              top: '80px',
              right: '20px',
              zIndex: 1000,
              width: '350px',
            }}
          >
            <LiveUpdates
              maxUpdates={10}
              autoRefresh
              refreshInterval={15000}
              showMetrics
              showEvents
              collapsible
              defaultExpanded
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Body */}
      <div className="chat-body">
        <div 
          className="messages-container"
          ref={messagesContainerRef}
          onScroll={handleScroll}
        >
          <div className="messages-list">
            {messages.length === 0 ? (
              <div className="empty-state">
                <RAGIcon className="empty-icon" />
                <Typography className="empty-title">
                  Welcome to Fund Management Assistant
                </Typography>
                <Typography className="empty-description">
                  I'm powered by advanced AI and comprehensive knowledge base to help you with fund creation, compliance, NAV calculations, and more. Ask me anything!
                </Typography>
              </div>
            ) : (
              <AnimatePresence>
                {messages.map((message, index) => (
                  <EnhancedMessageBubble
                    key={message.id}
                    message={message}
                    isLatest={index === messages.length - 1}
                    showTimestamp
                    onFeedback={handleFeedback}
                    onRegenerateResponse={handleRegenerateResponse}
                  />
                ))}
              </AnimatePresence>
            )}
            
            {/* Real-time typing indicator */}
            {isLoading && (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                <TypingIndicator />
                <TypingIndicatorReal 
                  isTyping={isLoading}
                  showAssistantTyping
                  assistantName="Fund Assistant"
                />
              </Box>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Scroll to Bottom Button */}
        <AnimatePresence>
          {showScrollButton && (
            <motion.div
              className="scroll-to-bottom"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Fab
                size="small"
                color="primary"
                onClick={scrollToBottom}
              >
                <ScrollUpIcon />
              </Fab>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="chat-footer">
        <div className="footer-content">
          <MessageInput
            onSendMessage={handleSendMessage}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSettingsChange={(newSettings) => {
          updateSettings(newSettings);
          toast.success('Settings updated');
        }}
      />

      {/* Toast Notifications */}
      <ToastContainer
        position="bottom-left"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={isDark ? 'dark' : 'light'}
      />
    </ChatContainer>
  );
};

export default EnhancedChatInterface;
