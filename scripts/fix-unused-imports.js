#!/usr/bin/env node

/**
 * Fix Unused Imports Script
 * Removes unused imports from TypeScript/JavaScript files
 */

const fs = require('fs');
const path = require('path');

const fixes = [
  // ConfidenceIndicator.tsx
  {
    file: 'client/src/components/indicators/ConfidenceIndicator.tsx',
    removals: [
      { from: 'Card,', to: '' },
      { from: 'CardContent,', to: '' },
      { from: 'List,', to: '' },
      { from: 'ListItem,', to: '' },
      { from: 'ListItemIcon,', to: '' },
      { from: 'ListItemText,', to: '' },
      { from: 'TrendingDownIcon,', to: '' }
    ]
  },
  // ProcessingIndicator.tsx
  {
    file: 'client/src/components/indicators/ProcessingIndicator.tsx',
    removals: [
      { from: 'MemoryIcon,', to: '' }
    ]
  },
  // SettingsPanel.tsx
  {
    file: 'client/src/components/interactive/SettingsPanel.tsx',
    removals: [
      { from: 'motion,', to: '' },
      { from: 'AnimatePresence,', to: '' },
      { from: 'InputLabel,', to: '' },
      { from: 'Chip,', to: '' },
      { from: 'Card,', to: '' },
      { from: 'CardContent,', to: '' }
    ]
  },
  // NotificationCenter.tsx
  {
    file: 'client/src/components/notifications/NotificationCenter.tsx',
    removals: [
      { from: 'getNotificationColor', to: '' }
    ]
  },
  // ConnectionStatus.tsx
  {
    file: 'client/src/components/realtime/ConnectionStatus.tsx',
    removals: [
      { from: 'SignalWifi3Bar,', to: '' },
      { from: 'AnimatePresence,', to: '' },
      { from: 'isConnected', to: '' }
    ]
  },
  // TypingIndicator.tsx
  {
    file: 'client/src/components/realtime/TypingIndicator.tsx',
    removals: [
      { from: 'theme', to: '' }
    ]
  },
  // theme/index.ts
  {
    file: 'client/src/theme/index.ts',
    removals: [
      { from: 'createTheme,', to: '' }
    ]
  }
];

function fixFile(filePath, removals) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    removals.forEach(({ from, to }) => {
      if (content.includes(from)) {
        content = content.replace(new RegExp(from, 'g'), to);
        modified = true;
        console.log(`  ✅ Removed: ${from}`);
      }
    });

    // Clean up extra commas and spaces
    content = content.replace(/,\s*,/g, ',');
    content = content.replace(/,\s*}/g, '}');
    content = content.replace(/,\s*]/g, ']');
    content = content.replace(/{\s*,/g, '{');
    content = content.replace(/\[\s*,/g, '[');

    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed: ${filePath}`);
      return true;
    } else {
      console.log(`⚠️ No changes needed: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🔧 Fixing unused imports...\n');

  let totalFixed = 0;

  fixes.forEach(({ file, removals }) => {
    console.log(`\n📁 Processing: ${file}`);
    if (fixFile(file, removals)) {
      totalFixed++;
    }
  });

  console.log(`\n📊 Summary: Fixed ${totalFixed} files`);
}

if (require.main === module) {
  main();
}

module.exports = { fixFile, fixes };
