import React, { useState, useRef, useEffect } from 'react';
import './ChatInterface.css';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { Message } from '../types/chat';
import { chatService } from '../services/chatService';

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: "Hello! I'm your Fund Management Assistant. I'll help you create a new investment fund by gathering all the necessary information through our conversation. Let's start with the basics - what would you like to name your new fund?",
      sender: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await chatService.sendMessage(content);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.message,
        sender: 'assistant',
        timestamp: new Date(response.timestamp)
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      setError('Failed to send message. Please try again.');
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'I apologize, but I encountered an error. Please try sending your message again.',
        sender: 'assistant',
        timestamp: new Date(),
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: '1',
        content: "Hello! I'm your Fund Management Assistant. I'll help you create a new investment fund by gathering all the necessary information through our conversation. Let's start with the basics - what would you like to name your new fund?",
        sender: 'assistant',
        timestamp: new Date()
      }
    ]);
    setError(null);
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div className="chat-title">
          <h2>Fund Creation Assistant</h2>
          <span className="chat-status">
            {isLoading ? 'Typing...' : 'Online'}
          </span>
        </div>
        <button 
          className="clear-chat-btn"
          onClick={handleClearChat}
          title="Start new conversation"
        >
          🔄 New Chat
        </button>
      </div>

      <div className="chat-body">
        <MessageList 
          messages={messages} 
          isLoading={isLoading}
        />
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-footer">
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}
        <MessageInput 
          onSendMessage={handleSendMessage}
          disabled={isLoading}
        />
      </div>
    </div>
  );
};

export default ChatInterface;
