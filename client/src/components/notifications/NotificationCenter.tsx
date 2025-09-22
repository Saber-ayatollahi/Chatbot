/**
 * Notification Center Component
 * Displays and manages real-time notifications
 */

import React, { useState } from 'react';
import {
  Badge,
  IconButton,
  Popover,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Typography,
  Box,
  Button,
  Chip,
  Divider,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsActive,
  Info,
  CheckCircle,
  Warning,
  Error,
  Close,
  MarkAsUnread,
  Clear,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import useRealTimeFeatures from '../../hooks/useRealTimeFeatures';

const StyledPaper = styled(Paper)(({ theme }) => ({
  width: 400,
  maxWidth: '90vw',
  maxHeight: 600,
  overflow: 'hidden',
  borderRadius: theme.spacing(2),
  boxShadow: theme.shadows[8],
}));

const NotificationHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: theme.palette.mode === 'dark' 
    ? theme.palette.grey[900] 
    : theme.palette.grey[50],
}));

const NotificationList = styled(List)(({ theme }) => ({
  maxHeight: 400,
  overflow: 'auto',
  padding: 0,
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.divider,
    borderRadius: 3,
  },
}));

const StyledListItem = styled(ListItem, {
  shouldForwardProp: (prop) => prop !== 'isUnread',
})<{ isUnread?: boolean }>(({ theme, isUnread }) => ({
  borderLeft: isUnread ? `4px solid ${theme.palette.primary.main}` : '4px solid transparent',
  backgroundColor: isUnread 
    ? theme.palette.mode === 'dark' 
      ? 'rgba(144, 202, 249, 0.08)' 
      : 'rgba(25, 118, 210, 0.08)'
    : 'transparent',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  transition: theme.transitions.create(['background-color', 'border-color']),
}));

const NotificationActions = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  borderTop: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  gap: theme.spacing(1),
  justifyContent: 'space-between',
  alignItems: 'center',
}));

const EmptyState = styled(Box)(({ theme }) => ({
  padding: theme.spacing(4),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

interface NotificationCenterProps {
  enableRealTime?: boolean;
  maxNotifications?: number;
  showSystemNotifications?: boolean;
  onSettingsClick?: () => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  enableRealTime = true,
  maxNotifications = 50,
  showSystemNotifications = true,
  onSettingsClick,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const {
    notifications,
    unreadNotifications,
    hasUnreadNotifications,
    markNotificationAsRead,
    removeNotification,
    clearAllNotifications,
    systemStatus,
  } = useRealTimeFeatures({
    enableNotifications: enableRealTime,
    enablePerformanceMonitoring: showSystemNotifications,
  });

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'notification-popover' : undefined;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'error':
        return <Error color="error" />;
      default:
        return <Info color="info" />;
    }
  };

  const filteredNotifications = filter === 'unread' 
    ? unreadNotifications 
    : notifications.slice(0, maxNotifications);

  const handleNotificationClick = (notificationId: string) => {
    markNotificationAsRead(notificationId);
  };

  const getSystemStatusColor = () => {
    switch (systemStatus) {
      case 'online':
        return theme.palette.success.main;
      case 'degraded':
        return theme.palette.warning.main;
      case 'offline':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          onClick={handleClick}
          color="inherit"
          aria-label="notifications"
          aria-describedby={id}
        >
          <Badge 
            badgeContent={unreadNotifications.length} 
            color="error"
            max={99}
          >
            {hasUnreadNotifications ? (
              <NotificationsActive />
            ) : (
              <NotificationsIcon />
            )}
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          component: motion.div,
          initial: { opacity: 0, scale: 0.9, y: -10 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.9, y: -10 },
          transition: { duration: 0.2 },
        }}
      >
        <StyledPaper>
          <NotificationHeader>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="h6" component="h2">
                Notifications
              </Typography>
              {showSystemNotifications && (
                <Chip
                  label={systemStatus}
                  size="small"
                  sx={{
                    backgroundColor: getSystemStatusColor(),
                    color: 'white',
                    fontSize: '0.75rem',
                    height: 20,
                  }}
                />
              )}
            </Box>
            
            <Box display="flex" alignItems="center" gap={1}>
              <Button
                size="small"
                variant={filter === 'all' ? 'contained' : 'text'}
                onClick={() => setFilter('all')}
                sx={{ minWidth: 'auto', px: 1 }}
              >
                All
              </Button>
              <Button
                size="small"
                variant={filter === 'unread' ? 'contained' : 'text'}
                onClick={() => setFilter('unread')}
                sx={{ minWidth: 'auto', px: 1 }}
                disabled={unreadNotifications.length === 0}
              >
                Unread ({unreadNotifications.length})
              </Button>
              
              {onSettingsClick && (
                <IconButton size="small" onClick={onSettingsClick}>
                  <SettingsIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          </NotificationHeader>

          {filteredNotifications.length === 0 ? (
            <EmptyState>
              <NotificationsIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
              <Typography variant="body2">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
              </Typography>
            </EmptyState>
          ) : (
            <NotificationList>
              <AnimatePresence>
                {filteredNotifications.map((notification, index) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <StyledListItem
                      isUnread={!notification.read}
                      onClick={() => handleNotificationClick(notification.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <ListItemIcon>
                        {getNotificationIcon(notification.type)}
                      </ListItemIcon>
                      
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle2" component="span">
                              {notification.title}
                            </Typography>
                            {!notification.read && (
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor: theme.palette.primary.main,
                                }}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {notification.message}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                            </Typography>
                          </Box>
                        }
                      />
                      
                      <ListItemSecondaryAction>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          {!notification.read && (
                            <Tooltip title="Mark as unread">
                              <IconButton
                                edge="end"
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Toggle read status
                                  markNotificationAsRead(notification.id);
                                }}
                              >
                                <MarkAsUnread fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          <Tooltip title="Remove">
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeNotification(notification.id);
                              }}
                            >
                              <Close fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </ListItemSecondaryAction>
                    </StyledListItem>
                    
                    {notification.actions && notification.actions.length > 0 && (
                      <Box sx={{ px: 2, pb: 1 }}>
                        {notification.actions.map((action, actionIndex) => (
                          <Button
                            key={actionIndex}
                            size="small"
                            variant="outlined"
                            onClick={action.action}
                            sx={{ mr: 1, mb: 0.5 }}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </Box>
                    )}
                    
                    {index < filteredNotifications.length - 1 && <Divider />}
                  </motion.div>
                ))}
              </AnimatePresence>
            </NotificationList>
          )}

          {filteredNotifications.length > 0 && (
            <NotificationActions>
              <Typography variant="caption" color="text.secondary">
                {filteredNotifications.length} of {notifications.length} notifications
              </Typography>
              
              <Box display="flex" gap={1}>
                {unreadNotifications.length > 0 && (
                  <Button
                    size="small"
                    startIcon={<CheckCircle />}
                    onClick={() => {
                      unreadNotifications.forEach(n => markNotificationAsRead(n.id));
                    }}
                  >
                    Mark all read
                  </Button>
                )}
                
                <Button
                  size="small"
                  startIcon={<Clear />}
                  onClick={clearAllNotifications}
                  color="error"
                  disabled={notifications.length === 0}
                >
                  Clear all
                </Button>
              </Box>
            </NotificationActions>
          )}
        </StyledPaper>
      </Popover>
    </>
  );
};

export default NotificationCenter;
