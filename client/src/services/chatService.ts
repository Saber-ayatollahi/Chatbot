import { ChatResponse, ChatError, EnhancedChatResponse, ChatSettings } from '../types/chat';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

class ChatService {
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async sendMessage(message: string, settings?: Partial<ChatSettings>): Promise<EnhancedChatResponse> {
    try {
      const requestBody = {
        message,
        sessionId: this.sessionId,
        useKnowledgeBase: settings?.useKnowledgeBase ?? true,
        options: {
          maxChunks: settings?.maxChunks || 5,
          retrievalStrategy: settings?.retrievalStrategy || 'hybrid',
          citationFormat: settings?.citationFormat || 'inline',
          templateType: settings?.templateType || 'standard',
        }
      };

      const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData: ChatError = await response.json();
        
        // Check if there's a fallback response
        if (errorData.fallbackResponse) {
          return {
            message: errorData.fallbackResponse.message,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            useKnowledgeBase: errorData.fallbackResponse.useKnowledgeBase,
            confidence: errorData.fallbackResponse.confidence,
            confidenceLevel: errorData.fallbackResponse.confidenceLevel as any,
            citations: errorData.fallbackResponse.citations,
            sources: errorData.fallbackResponse.sources,
            qualityIndicators: {
              hasRelevantSources: false,
              citationsPresent: false,
              confidenceAboveThreshold: false,
              responseComplete: true
            },
            processingTime: 0,
            fallbackApplied: true,
            error: errorData.fallbackResponse.error
          };
        }
        
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data: EnhancedChatResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Chat service error:', error);
      throw error;
    }
  }

  async sendBasicMessage(message: string): Promise<ChatResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          sessionId: this.sessionId,
          useKnowledgeBase: false,
        }),
      });

      if (!response.ok) {
        const errorData: ChatError = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data: ChatResponse = await response.json();
      return data;
    } catch (error) {
      console.error('Chat service error:', error);
      throw error;
    }
  }

  async getHistory(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/history/${this.sessionId}?includeMetadata=true`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get history error:', error);
      throw error;
    }
  }

  async clearHistory(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/history/${this.sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Generate new session ID after clearing
      this.sessionId = this.generateSessionId();
    } catch (error) {
      console.error('Clear history error:', error);
      throw error;
    }
  }

  async checkHealth(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/health`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Health check error:', error);
      throw error;
    }
  }

  async getSystemStats(): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/stats`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get system stats:', error);
      return null;
    }
  }

  async testSystem(testType: string = 'rag', testQuery?: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testType,
          testQuery: testQuery || 'How do I create a new fund?',
          sessionId: `test-${Date.now()}`
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to test system:', error);
      return null;
    }
  }

  getSessionId(): string {
    return this.sessionId;
  }

  generateNewSession(): void {
    this.sessionId = this.generateSessionId();
  }

  async submitFeedback(
    messageId: string, 
    rating: 1 | -1, 
    options?: {
      feedbackText?: string;
      feedbackCategories?: string[];
      suggestions?: string;
      userQuery?: string;
      assistantResponse?: string;
      retrievedChunks?: any[];
      citations?: any[];
      responseQualityScore?: number;
      responseTimeMs?: number;
      confidenceScore?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<{ success: boolean; feedbackId: string; message: string; processingTime: number }> {
    try {
      const requestBody = {
        messageId,
        sessionId: this.sessionId,
        rating,
        ...options
      };

      const response = await fetch(`${API_BASE_URL}/api/chat/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Feedback submission error:', error);
      throw error;
    }
  }

  // Utility methods for handling responses
  isEnhancedResponse(response: any): response is EnhancedChatResponse {
    return response && typeof response.confidence === 'number' && Array.isArray(response.citations);
  }

  getResponseConfidenceLevel(confidence: number): string {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    if (confidence >= 0.4) return 'low';
    return 'very_low';
  }

  formatProcessingTime(timeMs: number): string {
    if (timeMs < 1000) {
      return `${timeMs}ms`;
    } else if (timeMs < 60000) {
      return `${(timeMs / 1000).toFixed(1)}s`;
    } else {
      return `${(timeMs / 60000).toFixed(1)}m`;
    }
  }
}

export const chatService = new ChatService();
