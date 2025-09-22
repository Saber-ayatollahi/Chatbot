#!/usr/bin/env node

const fs = require('fs');

// Fix ProcessingIndicator.tsx
const processingFile = 'client/src/components/indicators/ProcessingIndicator.tsx';
if (fs.existsSync(processingFile)) {
  let content = fs.readFileSync(processingFile, 'utf8');
  content = content.replace(/MemoryIcon,?\s*/g, '');
  fs.writeFileSync(processingFile, content);
  console.log('✅ Fixed ProcessingIndicator.tsx');
}

// Fix SettingsPanel.tsx
const settingsFile = 'client/src/components/interactive/SettingsPanel.tsx';
if (fs.existsSync(settingsFile)) {
  let content = fs.readFileSync(settingsFile, 'utf8');
  content = content.replace(/motion,?\s*/g, '');
  content = content.replace(/AnimatePresence,?\s*/g, '');
  content = content.replace(/InputLabel,?\s*/g, '');
  content = content.replace(/Chip,?\s*/g, '');
  content = content.replace(/Card,?\s*/g, '');
  content = content.replace(/CardContent,?\s*/g, '');
  fs.writeFileSync(settingsFile, content);
  console.log('✅ Fixed SettingsPanel.tsx');
}

// Fix NotificationCenter.tsx
const notificationFile = 'client/src/components/notifications/NotificationCenter.tsx';
if (fs.existsSync(notificationFile)) {
  let content = fs.readFileSync(notificationFile, 'utf8');
  content = content.replace(/const getNotificationColor[^;]*;/g, '');
  fs.writeFileSync(notificationFile, content);
  console.log('✅ Fixed NotificationCenter.tsx');
}

// Fix ConnectionStatus.tsx
const connectionFile = 'client/src/components/realtime/ConnectionStatus.tsx';
if (fs.existsSync(connectionFile)) {
  let content = fs.readFileSync(connectionFile, 'utf8');
  content = content.replace(/SignalWifi3Bar,?\s*/g, '');
  content = content.replace(/AnimatePresence,?\s*/g, '');
  content = content.replace(/const\s+{\s*isConnected[^}]*}\s*=\s*[^;]*;/g, 'const { } = ');
  fs.writeFileSync(connectionFile, content);
  console.log('✅ Fixed ConnectionStatus.tsx');
}

// Fix TypingIndicator.tsx
const typingFile = 'client/src/components/realtime/TypingIndicator.tsx';
if (fs.existsSync(typingFile)) {
  let content = fs.readFileSync(typingFile, 'utf8');
  content = content.replace(/const theme[^;]*;/g, '');
  fs.writeFileSync(typingFile, content);
  console.log('✅ Fixed TypingIndicator.tsx');
}

// Fix theme/index.ts
const themeFile = 'client/src/theme/index.ts';
if (fs.existsSync(themeFile)) {
  let content = fs.readFileSync(themeFile, 'utf8');
  content = content.replace(/createTheme,?\s*/g, '');
  fs.writeFileSync(themeFile, content);
  console.log('✅ Fixed theme/index.ts');
}

// Fix useRealTimeFeatures.ts hook dependency
const hookFile = 'client/src/hooks/useRealTimeFeatures.ts';
if (fs.existsSync(hookFile)) {
  let content = fs.readFileSync(hookFile, 'utf8');
  content = content.replace(
    /}, \[enableWebSocket, heartbeatInterval, reconnectInterval\]\);/g,
    '}, [enableWebSocket, heartbeatInterval, reconnectInterval, addNotification, handleWebSocketMessage]);'
  );
  fs.writeFileSync(hookFile, content);
  console.log('✅ Fixed useRealTimeFeatures.ts');
}

console.log('🎉 All unused imports fixed!');
