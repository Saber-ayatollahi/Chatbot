import React from 'react';
import './TypingIndicator.css';

const TypingIndicator: React.FC = () => {
  return (
    <div className="typing-indicator">
      <div className="typing-avatar">🤖</div>
      <div className="typing-content">
        <div className="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="typing-text">Assistant is typing...</div>
      </div>
    </div>
  );
};

export default TypingIndicator;
