/**
 * Enhanced App Component
 * Phase 3: Complete UI Enhancement with RAG-powered features
 */

import React, { useState } from 'react';
import { CssBaseline, GlobalStyles, Tabs, Tab, Box, AppBar } from '@mui/material';
import { ThemeProvider } from './contexts/ThemeContext';
import { ChatSettingsProvider } from './contexts/ChatSettingsContext';
import EnhancedChatInterface from './components/enhanced/EnhancedChatInterface';
import DocumentIngestionManager from './components/ingestion/DocumentIngestionManager';
import DocumentManagementDashboard from './components/management/DocumentManagementDashboard';
import 'react-toastify/dist/ReactToastify.css';

// Global styles for enhanced UI
const globalStyles = (
  <GlobalStyles
    styles={{
      '*': {
        boxSizing: 'border-box',
      },
      html: {
        height: '100%',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      },
      body: {
        height: '100%',
        margin: 0,
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        fontSize: 'var(--font-size-base, 15px)',
        lineHeight: 1.5,
        backgroundColor: 'var(--background-color)',
        color: 'var(--text-color)',
      },
      '#root': {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      },
      '.App': {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      },
      // Custom scrollbar styles
      '::-webkit-scrollbar': {
        width: '6px',
        height: '6px',
      },
      '::-webkit-scrollbar-track': {
        background: 'transparent',
      },
      '::-webkit-scrollbar-thumb': {
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '3px',
        '&:hover': {
          background: 'rgba(0, 0, 0, 0.3)',
        },
      },
      // Focus styles for accessibility
      '*:focus-visible': {
        outline: '2px solid #2196f3',
        outlineOffset: '2px',
      },
      // Selection styles
      '::selection': {
        backgroundColor: '#2196f3',
        color: '#ffffff',
      },
      // Print styles
      '@media print': {
        '*': {
          colorAdjust: 'exact',
        },
      },
      // High contrast mode support
      '@media (prefers-contrast: high)': {
        '*': {
          borderColor: 'currentColor !important',
        },
      },
      // Reduced motion support
      '@media (prefers-reduced-motion: reduce)': {
        '*': {
          animationDuration: '0.01ms !important',
          animationIterationCount: '1 !important',
          transitionDuration: '0.01ms !important',
        },
      },
    }}
  />
);

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
      style={{ height: '100%', overflow: 'auto' }}
    >
      {value === index && children}
    </div>
  );
}

function App() {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <div className="App">
      <ThemeProvider>
        <ChatSettingsProvider>
          <CssBaseline />
          {globalStyles}
          
          <AppBar position="static" color="default" elevation={1}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              aria-label="application tabs"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="💬 Chat Interface" />
              <Tab label="📄 Document Management" />
              <Tab label="📤 Document Upload" />
            </Tabs>
          </AppBar>
          
          <Box sx={{ flexGrow: 1, height: 'calc(100vh - 48px)' }}>
            <TabPanel value={tabValue} index={0}>
              <EnhancedChatInterface />
            </TabPanel>
            <TabPanel value={tabValue} index={1}>
              <DocumentManagementDashboard />
            </TabPanel>
            <TabPanel value={tabValue} index={2}>
              <DocumentIngestionManager />
            </TabPanel>
          </Box>
          
        </ChatSettingsProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;