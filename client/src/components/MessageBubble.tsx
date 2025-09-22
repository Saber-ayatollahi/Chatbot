import React from 'react';
import './MessageBubble.css';
import { Message } from '../types/chat';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const formatTime = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(timestamp);
  };

  return (
    <div className={`message-bubble ${message.sender} ${message.isError ? 'error' : ''}`}>
      <div className="message-avatar">
        {message.sender === 'user' ? '👤' : '🤖'}
      </div>
      <div className="message-content">
        <div className="message-text">
          {message.content}
        </div>
        <div className="message-time">
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
