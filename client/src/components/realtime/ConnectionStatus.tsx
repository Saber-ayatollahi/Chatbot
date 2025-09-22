/**
 * Connection Status Component
 * Shows real-time connection status and system health
 */

import React, { useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Popover,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  LinearProgress,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Wifi,
  WifiOff,
  SignalWifi4Bar,
  SignalWifi2Bar,
  SignalWifi1Bar,
  SignalWifiOff,
  Speed,
  Error as ErrorIcon,
  CheckCircle,
  Warning,
  Refresh,
  Info,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { motion, } from 'framer-motion';
import useRealTimeFeatures from '../../hooks/useRealTimeFeatures';

const StatusChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'status',
})<{ status: 'connected' | 'connecting' | 'disconnected' | 'error' }>(({ theme, status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return theme.palette.success.main;
      case 'connecting':
        return theme.palette.warning.main;
      case 'disconnected':
        return theme.palette.grey[500];
      case 'error':
        return theme.palette.error.main;
      default:
        return theme.palette.grey[500];
    }
  };

  return {
    backgroundColor: getStatusColor(),
    color: theme.palette.getContrastText(getStatusColor()),
    '& .MuiChip-icon': {
      color: 'inherit',
    },
  };
});

const StatusPopover = styled(Paper)(({ theme }) => ({
  width: 320,
  maxWidth: '90vw',
  padding: theme.spacing(2),
  borderRadius: theme.spacing(2),
}));

const MetricItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1, 0),
}));

const PulsingDot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ theme, color }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: color,
  position: 'relative',
  '&::after': {
    content: '""',
    position: 'absolute',
    top: -2,
    left: -2,
    width: 12,
    height: 12,
    borderRadius: '50%',
    border: `2px solid ${color}`,
    opacity: 0,
    animation: 'pulse 2s infinite',
  },
  '@keyframes pulse': {
    '0%': {
      transform: 'scale(0.8)',
      opacity: 1,
    },
    '100%': {
      transform: 'scale(2.5)',
      opacity: 0,
    },
  },
}));

interface ConnectionStatusProps {
  showDetails?: boolean;
  compact?: boolean;
  enableRealTime?: boolean;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  showDetails = true,
  compact = false,
  enableRealTime = true,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const {
    connectionStatus,
    systemStatus,
    performanceMetrics,
    lastActivity,
    checkSystemHealth,
    connectWebSocket,
    getPerformanceStatus,
  } = useRealTimeFeatures({
    enableWebSocket: enableRealTime,
    enableNotifications: false,
    enablePerformanceMonitoring: false,
  });

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (showDetails) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleRefresh = async () => {
    await checkSystemHealth();
    if (enableRealTime && connectionStatus === 'disconnected') {
      connectWebSocket();
    }
  };

  const open = Boolean(anchorEl);

  const getConnectionIcon = () => {
    if (!enableRealTime) {
      return <Wifi />;
    }

    switch (connectionStatus) {
      case 'connected':
        return <SignalWifi4Bar />;
      case 'connecting':
        return <SignalWifi2Bar />;
      case 'disconnected':
        return <SignalWifiOff />;
      case 'error':
        return <WifiOff />;
      default:
        return <SignalWifi1Bar />;
    }
  };

  const getSystemStatusIcon = () => {
    switch (systemStatus) {
      case 'online':
        return <CheckCircle color="success" />;
      case 'degraded':
        return <Warning color="warning" />;
      case 'offline':
        return <ErrorIcon color="error" />;
      default:
        return <Info />;
    }
  };

  const getPerformanceIcon = () => {
    const status = getPerformanceStatus();
    switch (status) {
      case 'good':
        return <Speed color="success" />;
      case 'fair':
        return <Speed color="warning" />;
      case 'poor':
        return <Speed color="error" />;
      default:
        return <Speed />;
    }
  };

  const getStatusText = () => {
    if (compact) {
      return systemStatus.charAt(0).toUpperCase() + systemStatus.slice(1);
    }
    
    if (enableRealTime) {
      return `${connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)} • ${systemStatus.charAt(0).toUpperCase() + systemStatus.slice(1)}`;
    }
    
    return systemStatus.charAt(0).toUpperCase() + systemStatus.slice(1);
  };

  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getLatencyColor = (ms: number) => {
    if (ms < 500) return theme.palette.success.main;
    if (ms < 1000) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  return (
    <>
      <Tooltip title={showDetails ? "Click for connection details" : getStatusText()}>
        <StatusChip
          status={connectionStatus}
          icon={getConnectionIcon()}
          label={getStatusText()}
          size={compact ? "small" : "medium"}
          onClick={showDetails ? handleClick : undefined}
          clickable={showDetails}
          sx={{ cursor: showDetails ? 'pointer' : 'default' }}
        />
      </Tooltip>

      {showDetails && (
        <Popover
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
          <StatusPopover>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6">Connection Status</Typography>
              <IconButton size="small" onClick={handleRefresh} title="Refresh">
                <Refresh />
              </IconButton>
            </Box>

            <List dense>
              <ListItem>
                <ListItemIcon>
                  {getConnectionIcon()}
                </ListItemIcon>
                <ListItemText
                  primary="WebSocket Connection"
                  secondary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <PulsingDot
                        color={
                          connectionStatus === 'connected'
                            ? theme.palette.success.main
                            : connectionStatus === 'connecting'
                            ? theme.palette.warning.main
                            : theme.palette.error.main
                        }
                      />
                      {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
                      {lastActivity && (
                        <Typography variant="caption" color="text.disabled">
                          • Last activity: {new Date(lastActivity).toLocaleTimeString()}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  {getSystemStatusIcon()}
                </ListItemIcon>
                <ListItemText
                  primary="System Health"
                  secondary={systemStatus.charAt(0).toUpperCase() + systemStatus.slice(1)}
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  {getPerformanceIcon()}
                </ListItemIcon>
                <ListItemText
                  primary="Performance"
                  secondary={`${getPerformanceStatus().toUpperCase()} • ${formatLatency(performanceMetrics.responseTime)} avg`}
                />
              </ListItem>
            </List>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              Performance Metrics
            </Typography>

            <MetricItem>
              <Typography variant="body2">Response Time</Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography 
                  variant="body2" 
                  color={getLatencyColor(performanceMetrics.responseTime)}
                  fontWeight="medium"
                >
                  {formatLatency(performanceMetrics.responseTime)}
                </Typography>
              </Box>
            </MetricItem>

            <MetricItem>
              <Typography variant="body2">Error Rate</Typography>
              <Typography 
                variant="body2" 
                color={performanceMetrics.errorRate > 5 ? 'error' : 'text.primary'}
                fontWeight="medium"
              >
                {performanceMetrics.errorRate.toFixed(1)}%
              </Typography>
            </MetricItem>

            {performanceMetrics.latency > 0 && (
              <MetricItem>
                <Typography variant="body2">Network Latency</Typography>
                <Typography 
                  variant="body2" 
                  color={getLatencyColor(performanceMetrics.latency)}
                  fontWeight="medium"
                >
                  {formatLatency(performanceMetrics.latency)}
                </Typography>
              </MetricItem>
            )}

            {/* Performance Status Bar */}
            <Box mt={2}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="caption">Overall Performance</Typography>
                <Typography variant="caption" fontWeight="medium">
                  {getPerformanceStatus().toUpperCase()}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={
                  getPerformanceStatus() === 'good' ? 100 :
                  getPerformanceStatus() === 'fair' ? 60 : 30
                }
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: theme.palette.grey[200],
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    backgroundColor:
                      getPerformanceStatus() === 'good'
                        ? theme.palette.success.main
                        : getPerformanceStatus() === 'fair'
                        ? theme.palette.warning.main
                        : theme.palette.error.main,
                  },
                }}
              />
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Real-time monitoring {enableRealTime ? 'enabled' : 'disabled'}
            </Typography>
          </StatusPopover>
        </Popover>
      )}
    </>
  );
};

export default ConnectionStatus;
