/**
 * Tests for NotificationCenter component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import NotificationCenter from '../../components/notifications/NotificationCenter';

// Mock the real-time features hook
const mockUseRealTimeFeatures = {
  notifications: [],
  unreadNotifications: [],
  hasUnreadNotifications: false,
  markNotificationAsRead: jest.fn(),
  removeNotification: jest.fn(),
  clearAllNotifications: jest.fn(),
  systemStatus: 'online' as const,
};

jest.mock('../../hooks/useRealTimeFeatures', () => {
  return jest.fn(() => mockUseRealTimeFeatures);
});

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => '2 minutes ago'),
}));

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('NotificationCenter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock data
    mockUseRealTimeFeatures.notifications = [];
    mockUseRealTimeFeatures.unreadNotifications = [];
    mockUseRealTimeFeatures.hasUnreadNotifications = false;
  });

  it('renders notification button', () => {
    renderWithTheme(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    expect(button).toBeInTheDocument();
  });

  it('shows notification badge when there are unread notifications', () => {
    mockUseRealTimeFeatures.unreadNotifications = [
      {
        id: '1',
        type: 'info',
        title: 'Test',
        message: 'Test message',
        timestamp: new Date(),
        read: false,
      },
    ];
    mockUseRealTimeFeatures.hasUnreadNotifications = true;

    renderWithTheme(<NotificationCenter />);
    
    const badge = screen.getByText('1');
    expect(badge).toBeInTheDocument();
  });

  it('opens notification popover when clicked', async () => {
    renderWithTheme(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
  });

  it('displays empty state when no notifications', async () => {
    renderWithTheme(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  it('displays notifications when present', async () => {
    const testNotification = {
      id: '1',
      type: 'info' as const,
      title: 'Test Notification',
      message: 'This is a test notification',
      timestamp: new Date(),
      read: false,
    };

    mockUseRealTimeFeatures.notifications = [testNotification];
    mockUseRealTimeFeatures.unreadNotifications = [testNotification];

    renderWithTheme(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Test Notification')).toBeInTheDocument();
      expect(screen.getByText('This is a test notification')).toBeInTheDocument();
    });
  });

  it('marks notification as read when clicked', async () => {
    const testNotification = {
      id: '1',
      type: 'info' as const,
      title: 'Test Notification',
      message: 'This is a test notification',
      timestamp: new Date(),
      read: false,
    };

    mockUseRealTimeFeatures.notifications = [testNotification];

    renderWithTheme(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      const notificationItem = screen.getByText('Test Notification');
      fireEvent.click(notificationItem);
    });

    expect(mockUseRealTimeFeatures.markNotificationAsRead).toHaveBeenCalledWith('1');
  });

  it('removes notification when remove button is clicked', async () => {
    const testNotification = {
      id: '1',
      type: 'info' as const,
      title: 'Test Notification',
      message: 'This is a test notification',
      timestamp: new Date(),
      read: false,
    };

    mockUseRealTimeFeatures.notifications = [testNotification];

    renderWithTheme(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      const removeButton = screen.getByTitle('Remove');
      fireEvent.click(removeButton);
    });

    expect(mockUseRealTimeFeatures.removeNotification).toHaveBeenCalledWith('1');
  });

  it('clears all notifications when clear all is clicked', async () => {
    const testNotification = {
      id: '1',
      type: 'info' as const,
      title: 'Test Notification',
      message: 'This is a test notification',
      timestamp: new Date(),
      read: false,
    };

    mockUseRealTimeFeatures.notifications = [testNotification];

    renderWithTheme(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      const clearAllButton = screen.getByText('Clear all');
      fireEvent.click(clearAllButton);
    });

    expect(mockUseRealTimeFeatures.clearAllNotifications).toHaveBeenCalled();
  });

  it('filters notifications by unread when filter is selected', async () => {
    const readNotification = {
      id: '1',
      type: 'info' as const,
      title: 'Read Notification',
      message: 'This is read',
      timestamp: new Date(),
      read: true,
    };

    const unreadNotification = {
      id: '2',
      type: 'info' as const,
      title: 'Unread Notification',
      message: 'This is unread',
      timestamp: new Date(),
      read: false,
    };

    mockUseRealTimeFeatures.notifications = [readNotification, unreadNotification];
    mockUseRealTimeFeatures.unreadNotifications = [unreadNotification];

    renderWithTheme(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      const unreadFilterButton = screen.getByText(/Unread \(1\)/);
      fireEvent.click(unreadFilterButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Unread Notification')).toBeInTheDocument();
      expect(screen.queryByText('Read Notification')).not.toBeInTheDocument();
    });
  });

  it('shows system status chip when enabled', async () => {
    mockUseRealTimeFeatures.systemStatus = 'degraded';

    renderWithTheme(<NotificationCenter showSystemNotifications />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('degraded')).toBeInTheDocument();
    });
  });

  it('calls onSettingsClick when settings button is clicked', async () => {
    const onSettingsClick = jest.fn();

    renderWithTheme(<NotificationCenter onSettingsClick={onSettingsClick} />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);
    });

    expect(onSettingsClick).toHaveBeenCalled();
  });

  it('displays notification actions when present', async () => {
    const testNotification = {
      id: '1',
      type: 'info' as const,
      title: 'Test Notification',
      message: 'This has actions',
      timestamp: new Date(),
      read: false,
      actions: [
        {
          label: 'Action 1',
          action: jest.fn(),
        },
        {
          label: 'Action 2',
          action: jest.fn(),
        },
      ],
    };

    mockUseRealTimeFeatures.notifications = [testNotification];

    renderWithTheme(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Action 1')).toBeInTheDocument();
      expect(screen.getByText('Action 2')).toBeInTheDocument();
    });
  });

  it('executes notification action when clicked', async () => {
    const actionMock = jest.fn();
    const testNotification = {
      id: '1',
      type: 'info' as const,
      title: 'Test Notification',
      message: 'This has actions',
      timestamp: new Date(),
      read: false,
      actions: [
        {
          label: 'Test Action',
          action: actionMock,
        },
      ],
    };

    mockUseRealTimeFeatures.notifications = [testNotification];

    renderWithTheme(<NotificationCenter />);
    
    const button = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      const actionButton = screen.getByText('Test Action');
      fireEvent.click(actionButton);
    });

    expect(actionMock).toHaveBeenCalled();
  });
});
