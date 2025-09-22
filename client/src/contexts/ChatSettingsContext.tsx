/**
 * Chat Settings Context Provider
 * Manages chat configuration and RAG settings
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ChatSettings } from '../types/chat';

interface ChatSettingsContextValue {
  settings: ChatSettings;
  updateSettings: (updates: Partial<ChatSettings>) => Promise<void>;
  resetSettings: () => void;
  isAdvancedMode: boolean;
  toggleAdvancedMode: () => void;
}

const ChatSettingsContext = createContext<ChatSettingsContextValue | undefined>(undefined);

interface ChatSettingsProviderProps {
  children: ReactNode;
}

const SETTINGS_STORAGE_KEY = 'fund-management-chatbot-settings';

const defaultSettings: ChatSettings = {
  useKnowledgeBase: true,
  maxChunks: 5,
  retrievalStrategy: 'advanced_multi_feature',
  citationFormat: 'inline',
  templateType: 'standard',
  confidenceThreshold: 0.6,
  showConfidence: true,
  showSources: true,
  showProcessingTime: false,
};

export const ChatSettingsProvider: React.FC<ChatSettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<ChatSettings>(() => {
    // Load settings from localStorage
    try {
      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        return { ...defaultSettings, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error);
    }
    return defaultSettings;
  });

  const [isAdvancedMode, setIsAdvancedMode] = useState(() => {
    try {
      const savedMode = localStorage.getItem('advanced-mode');
      return savedMode === 'true';
    } catch (error) {
      return false;
    }
  });

  // Save settings to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save settings to localStorage:', error);
    }
  }, [settings]);

  // Save advanced mode preference
  useEffect(() => {
    try {
      localStorage.setItem('advanced-mode', isAdvancedMode.toString());
    } catch (error) {
      console.warn('Failed to save advanced mode preference:', error);
    }
  }, [isAdvancedMode]);

  const updateSettings = async (updates: Partial<ChatSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
    
    // If confidence threshold is being updated, sync with server
    if (updates.confidenceThreshold !== undefined) {
      try {
        const response = await fetch('/api/admin/rag/config', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            confidenceThreshold: updates.confidenceThreshold
          }),
        });
        
        if (!response.ok) {
          console.warn('Failed to update confidence threshold on server');
        } else {
          console.log(`Confidence threshold updated to ${updates.confidenceThreshold}`);
        }
      } catch (error) {
        console.warn('Error updating confidence threshold:', error);
      }
    }
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  };

  const toggleAdvancedMode = () => {
    setIsAdvancedMode(prev => !prev);
  };

  const contextValue: ChatSettingsContextValue = {
    settings,
    updateSettings,
    resetSettings,
    isAdvancedMode,
    toggleAdvancedMode,
  };

  return (
    <ChatSettingsContext.Provider value={contextValue}>
      {children}
    </ChatSettingsContext.Provider>
  );
};

export const useChatSettings = (): ChatSettingsContextValue => {
  const context = useContext(ChatSettingsContext);
  if (context === undefined) {
    throw new Error('useChatSettings must be used within a ChatSettingsProvider');
  }
  return context;
};

// Helper hooks for specific settings
export const useRAGSettings = () => {
  const { settings, updateSettings } = useChatSettings();
  
  return {
    useKnowledgeBase: settings.useKnowledgeBase,
    maxChunks: settings.maxChunks,
    retrievalStrategy: settings.retrievalStrategy,
    citationFormat: settings.citationFormat,
    templateType: settings.templateType,
    setUseKnowledgeBase: (value: boolean) => updateSettings({ useKnowledgeBase: value }),
    setMaxChunks: (value: number) => updateSettings({ maxChunks: value }),
    setRetrievalStrategy: (value: ChatSettings['retrievalStrategy']) => 
      updateSettings({ retrievalStrategy: value }),
    setCitationFormat: (value: ChatSettings['citationFormat']) => 
      updateSettings({ citationFormat: value }),
    setTemplateType: (value: ChatSettings['templateType']) => 
      updateSettings({ templateType: value }),
  };
};

export const useDisplaySettings = () => {
  const { settings, updateSettings } = useChatSettings();
  
  return {
    showConfidence: settings.showConfidence,
    showSources: settings.showSources,
    showProcessingTime: settings.showProcessingTime,
    setShowConfidence: (value: boolean) => updateSettings({ showConfidence: value }),
    setShowSources: (value: boolean) => updateSettings({ showSources: value }),
    setShowProcessingTime: (value: boolean) => updateSettings({ showProcessingTime: value }),
  };
};
