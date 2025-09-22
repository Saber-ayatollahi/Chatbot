/**
 * Live Updates Component
 * Handles real-time updates and live data streaming
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Update,
  ExpandMore,
  ExpandLess,
  Refresh,
  Pause,
  PlayArrow,
  TrendingUp,
  TrendingDown,
  ShowChart,
  DataUsage,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import useRealTimeFeatures from '../../hooks/useRealTimeFeatures';

const UpdatesContainer = styled(Paper)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  overflow: 'hidden',
  backgroundColor: theme.palette.mode === 'dark' 
    ? alpha(theme.palette.background.paper, 0.8)
    : alpha(theme.palette.background.paper, 0.95),
  backdropFilter: 'blur(10px)',
  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
}));

const UpdatesHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: theme.palette.mode === 'dark' 
    ? alpha(theme.palette.primary.main, 0.1)
    : alpha(theme.palette.primary.main, 0.05),
}));

const UpdatesList = styled(List)(({ theme }) => ({
  maxHeight: 300,
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

const UpdateItem = styled(ListItem)(({ theme }) => ({
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
  transition: theme.transitions.create(['background-color']),
  '&:hover': {
    backgroundColor: alpha(theme.palette.action.hover, 0.5),
  },
  '&:last-child': {
    borderBottom: 'none',
  },
}));

const MetricChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'trend',
})<{ trend?: 'up' | 'down' | 'stable' }>(({ theme, trend }) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return theme.palette.success.main;
      case 'down':
        return theme.palette.error.main;
      case 'stable':
        return theme.palette.warning.main;
      default:
        return theme.palette.grey[500];
    }
  };

  return {
    backgroundColor: alpha(getTrendColor(), 0.1),
    color: getTrendColor(),
    border: `1px solid ${alpha(getTrendColor(), 0.3)}`,
    '& .MuiChip-icon': {
      color: getTrendColor(),
    },
  };
});

interface LiveUpdate {
  id: string;
  type: 'metric' | 'event' | 'status' | 'error';
  title: string;
  description: string;
  value?: string | number;
  trend?: 'up' | 'down' | 'stable';
  timestamp: Date;
  severity?: 'low' | 'medium' | 'high';
}

interface LiveUpdatesProps {
  maxUpdates?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  showMetrics?: boolean;
  showEvents?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

const LiveUpdates: React.FC<LiveUpdatesProps> = ({
  maxUpdates = 20,
  autoRefresh = true,
  refreshInterval = 30000,
  showMetrics = true,
  showEvents = true,
  collapsible = true,
  defaultExpanded = false,
}) => {
  const theme = useTheme();
  const [updates, setUpdates] = useState<LiveUpdate[]>([]);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isPaused, setIsPaused] = useState(false);

  const {
    performanceMetrics,
    systemStatus,
    notifications,
    checkSystemHealth,
    addNotification,
  } = useRealTimeFeatures({
    enablePerformanceMonitoring: showMetrics,
    enableNotifications: showEvents,
  });

  // Generate mock live updates (in a real app, these would come from WebSocket or API)
  const generateMockUpdates = useCallback(() => {
    const mockUpdates: LiveUpdate[] = [];

    if (showMetrics) {
      // Performance metrics updates
      mockUpdates.push({
        id: `perf-${Date.now()}`,
        type: 'metric',
        title: 'Response Time',
        description: 'Average API response time',
        value: `${performanceMetrics.responseTime.toFixed(0)}ms`,
        trend: performanceMetrics.responseTime > 2000 ? 'down' : 
               performanceMetrics.responseTime < 1000 ? 'up' : 'stable',
        timestamp: new Date(),
        severity: performanceMetrics.responseTime > 3000 ? 'high' : 
                 performanceMetrics.responseTime > 1500 ? 'medium' : 'low',
      });

      mockUpdates.push({
        id: `error-${Date.now()}`,
        type: 'metric',
        title: 'Error Rate',
        description: 'System error rate',
        value: `${performanceMetrics.errorRate.toFixed(1)}%`,
        trend: performanceMetrics.errorRate > 5 ? 'down' : 
               performanceMetrics.errorRate < 2 ? 'up' : 'stable',
        timestamp: new Date(),
        severity: performanceMetrics.errorRate > 10 ? 'high' : 
                 performanceMetrics.errorRate > 5 ? 'medium' : 'low',
      });
    }

    if (showEvents) {
      // System status updates
      mockUpdates.push({
        id: `status-${Date.now()}`,
        type: 'status',
        title: 'System Status',
        description: `System is currently ${systemStatus}`,
        value: systemStatus.toUpperCase(),
        trend: systemStatus === 'online' ? 'up' : 
               systemStatus === 'degraded' ? 'stable' : 'down',
        timestamp: new Date(),
        severity: systemStatus === 'offline' ? 'high' : 
                 systemStatus === 'degraded' ? 'medium' : 'low',
      });

      // Knowledge base updates (mock)
      if (Math.random() > 0.7) {
        mockUpdates.push({
          id: `kb-${Date.now()}`,
          type: 'event',
          title: 'Knowledge Base',
          description: 'New documents processed',
          value: Math.floor(Math.random() * 10) + 1,
          trend: 'up',
          timestamp: new Date(),
          severity: 'low',
        });
      }

      // User activity (mock)
      if (Math.random() > 0.8) {
        mockUpdates.push({
          id: `activity-${Date.now()}`,
          type: 'event',
          title: 'User Activity',
          description: 'Active chat sessions',
          value: Math.floor(Math.random() * 50) + 10,
          trend: Math.random() > 0.5 ? 'up' : 'down',
          timestamp: new Date(),
          severity: 'low',
        });
      }
    }

    return mockUpdates;
  }, [performanceMetrics, systemStatus, showMetrics, showEvents]);

  // Update live data
  const updateLiveData = useCallback(() => {
    if (isPaused) return;

    const newUpdates = generateMockUpdates();
    
    setUpdates(prevUpdates => {
      const combined = [...newUpdates, ...prevUpdates];
      return combined.slice(0, maxUpdates);
    });

    // Trigger system health check
    checkSystemHealth();
  }, [generateMockUpdates, maxUpdates, isPaused, checkSystemHealth]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(updateLiveData, refreshInterval);
    
    // Initial update
    updateLiveData();

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, updateLiveData]);

  // Handle notification updates
  useEffect(() => {
    const recentNotifications = notifications.filter(
      n => Date.now() - n.timestamp.getTime() < 60000 // Last minute
    );

    if (recentNotifications.length > 0 && showEvents) {
      const notificationUpdates: LiveUpdate[] = recentNotifications.map(n => ({
        id: `notif-${n.id}`,
        type: 'event',
        title: n.title,
        description: n.message,
        timestamp: n.timestamp,
        severity: n.type === 'error' ? 'high' : n.type === 'warning' ? 'medium' : 'low',
        trend: n.type === 'success' ? 'up' : n.type === 'error' ? 'down' : 'stable',
      }));

      setUpdates(prevUpdates => {
        const combined = [...notificationUpdates, ...prevUpdates];
        return combined.slice(0, maxUpdates);
      });
    }
  }, [notifications, showEvents, maxUpdates]);

  const getUpdateIcon = (type: string, trend?: string) => {
    switch (type) {
      case 'metric':
        return trend === 'up' ? <TrendingUp /> : 
               trend === 'down' ? <TrendingDown /> : <ShowChart />;
      case 'event':
        return <Update />;
      case 'status':
        return <DataUsage />;
      default:
        return <Update />;
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'high':
        return theme.palette.error.main;
      case 'medium':
        return theme.palette.warning.main;
      case 'low':
        return theme.palette.success.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
    if (isPaused) {
      addNotification({
        type: 'info',
        title: 'Live Updates',
        message: 'Live updates resumed',
      });
    } else {
      addNotification({
        type: 'info',
        title: 'Live Updates',
        message: 'Live updates paused',
      });
    }
  };

  return (
    <UpdatesContainer elevation={2}>
      <UpdatesHeader>
        <Box display="flex" alignItems="center" gap={1}>
          <Update color="primary" />
          <Typography variant="h6">
            Live Updates
          </Typography>
          <Chip
            label={updates.length}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>

        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip title={isPaused ? "Resume updates" : "Pause updates"}>
            <IconButton size="small" onClick={handleTogglePause}>
              {isPaused ? <PlayArrow /> : <Pause />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Refresh now">
            <IconButton size="small" onClick={updateLiveData}>
              <Refresh />
            </IconButton>
          </Tooltip>

          {collapsible && (
            <IconButton size="small" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        </Box>
      </UpdatesHeader>

      <Collapse in={isExpanded || !collapsible}>
        <UpdatesList>
          <AnimatePresence>
            {updates.map((update, index) => (
              <motion.div
                key={update.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
              >
                <UpdateItem>
                  <ListItemIcon>
                    <Box sx={{ color: getSeverityColor(update.severity) }}>
                      {getUpdateIcon(update.type, update.trend)}
                    </Box>
                  </ListItemIcon>

                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="subtitle2">
                          {update.title}
                        </Typography>
                        {update.value && (
                          <MetricChip
                            label={update.value}
                            size="small"
                            trend={update.trend}
                            icon={update.trend === 'up' ? <TrendingUp /> : 
                                  update.trend === 'down' ? <TrendingDown /> : undefined}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {update.description}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {formatDistanceToNow(update.timestamp, { addSuffix: true })}
                        </Typography>
                      </Box>
                    }
                  />
                </UpdateItem>
              </motion.div>
            ))}
          </AnimatePresence>

          {updates.length === 0 && (
            <Box p={4} textAlign="center">
              <Update sx={{ fontSize: 48, opacity: 0.3, mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                {isPaused ? 'Updates paused' : 'No updates yet'}
              </Typography>
            </Box>
          )}
        </UpdatesList>
      </Collapse>

      {isPaused && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: alpha(theme.palette.background.paper, 0.8),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(2px)',
          }}
        >
          <Box textAlign="center">
            <Pause sx={{ fontSize: 48, opacity: 0.5, mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Updates Paused
            </Typography>
          </Box>
        </Box>
      )}
    </UpdatesContainer>
  );
};

export default LiveUpdates;
