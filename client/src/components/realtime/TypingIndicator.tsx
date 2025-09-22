/**
 * Typing Indicator Component
 * Shows when users or the assistant is typing
 */

import React from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

const bounce = keyframes`
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-10px);
  }
`;

const TypingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  borderRadius: theme.spacing(3),
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
  maxWidth: 200,
}));

const TypingDots = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(0.5),
  '& > div': {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: theme.palette.primary.main,
    animation: `${bounce} 1.4s infinite ease-in-out`,
    '&:nth-of-type(1)': {
      animationDelay: '-0.32s',
    },
    '&:nth-of-type(2)': {
      animationDelay: '-0.16s',
    },
    '&:nth-of-type(3)': {
      animationDelay: '0s',
    },
  },
}));

const TypingText = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
  fontStyle: 'italic',
}));

interface TypingIndicatorProps {
  isTyping: boolean;
  typingUsers?: string[];
  showAssistantTyping?: boolean;
  assistantName?: string;
  className?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  isTyping,
  typingUsers = [],
  showAssistantTyping = true,
  assistantName = 'Assistant',
  className,
}) => {
  

  const getTypingMessage = () => {
    if (showAssistantTyping && isTyping) {
      return `${assistantName} is thinking...`;
    }

    if (typingUsers.length === 0) {
      return '';
    }

    if (typingUsers.length === 1) {
      return `${typingUsers[0]} is typing...`;
    }

    if (typingUsers.length === 2) {
      return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    }

    return `${typingUsers.length} people are typing...`;
  };

  const shouldShow = isTyping || typingUsers.length > 0;
  const message = getTypingMessage();

  if (!shouldShow || !message) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.9 }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30,
        }}
        className={className}
      >
        <TypingContainer>
          <TypingDots>
            <div />
            <div />
            <div />
          </TypingDots>
          <TypingText>{message}</TypingText>
        </TypingContainer>
      </motion.div>
    </AnimatePresence>
  );
};

export default TypingIndicator;
