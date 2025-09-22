/**
 * Accessibility Hook
 * Comprehensive accessibility features and utilities
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface AccessibilityState {
  announcements: string[];
  focusTrapActive: boolean;
  keyboardNavigationActive: boolean;
  screenReaderActive: boolean;
  highContrastMode: boolean;
  reducedMotion: boolean;
  fontSize: 'normal' | 'large' | 'larger';
}

interface AccessibilityOptions {
  enableAnnouncements?: boolean;
  enableFocusTrap?: boolean;
  enableKeyboardNavigation?: boolean;
  autoDetectPreferences?: boolean;
}

export const useAccessibility = (options: AccessibilityOptions = {}) => {
  const {
    enableAnnouncements = true,
    enableFocusTrap = false,
    enableKeyboardNavigation: keyboardNavigationEnabled = true,
    autoDetectPreferences = true,
  } = options;

  const [state, setState] = useState<AccessibilityState>({
    announcements: [],
    focusTrapActive: false,
    keyboardNavigationActive: false,
    screenReaderActive: false,
    highContrastMode: false,
    reducedMotion: false,
    fontSize: 'normal',
  });

  const announcementTimeouts = useRef<NodeJS.Timeout[]>([]);
  const focusTrapRef = useRef<HTMLElement | null>(null);

  // Detect accessibility preferences
  useEffect(() => {
    if (!autoDetectPreferences) return;

    const detectPreferences = () => {
      setState(prev => ({
        ...prev,
        highContrastMode: window.matchMedia('(prefers-contrast: high)').matches,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        screenReaderActive: 
          window.navigator.userAgent.includes('NVDA') ||
          window.navigator.userAgent.includes('JAWS') ||
          window.navigator.userAgent.includes('VoiceOver') ||
          // Detect screen reader via DOM manipulation
          (() => {
            const testElement = document.createElement('div');
            testElement.setAttribute('aria-hidden', 'true');
            testElement.style.position = 'absolute';
            testElement.style.left = '-10000px';
            testElement.textContent = 'Screen reader test';
            document.body.appendChild(testElement);
            const isScreenReader = testElement.offsetHeight === 0;
            document.body.removeChild(testElement);
            return isScreenReader;
          })(),
      }));
    };

    detectPreferences();

    // Listen for preference changes
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleContrastChange = (e: MediaQueryListEvent) => {
      setState(prev => ({ ...prev, highContrastMode: e.matches }));
    };

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setState(prev => ({ ...prev, reducedMotion: e.matches }));
    };

    contrastQuery.addEventListener('change', handleContrastChange);
    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      contrastQuery.removeEventListener('change', handleContrastChange);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, [autoDetectPreferences]);

  // Screen reader announcements
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!enableAnnouncements) return;

    // Create announcement element
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.position = 'absolute';
    announcement.style.left = '-10000px';
    announcement.style.width = '1px';
    announcement.style.height = '1px';
    announcement.style.overflow = 'hidden';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Add to state for tracking
    setState(prev => ({
      ...prev,
      announcements: [...prev.announcements, message].slice(-5) // Keep last 5
    }));

    // Clean up after announcement
    const timeout = setTimeout(() => {
      if (document.body.contains(announcement)) {
        document.body.removeChild(announcement);
      }
    }, 1000);

    announcementTimeouts.current.push(timeout);
  }, [enableAnnouncements]);

  // Focus management
  const trapFocus = useCallback((container: HTMLElement) => {
    if (!enableFocusTrap) return () => {};

    focusTrapRef.current = container;
    setState(prev => ({ ...prev, focusTrapActive: true }));

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        releaseFocus();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscapeKey);

    // Focus first element
    if (firstElement) {
      firstElement.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscapeKey);
      releaseFocus();
    };
  }, [enableFocusTrap]);

  const releaseFocus = useCallback(() => {
    setState(prev => ({ ...prev, focusTrapActive: false }));
    focusTrapRef.current = null;
  }, []);

  // Keyboard navigation
  const enableKeyboardNavigation = useCallback(() => {
    if (!keyboardNavigationEnabled) return;

    setState(prev => ({ ...prev, keyboardNavigationActive: true }));

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip links (Alt + S)
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        const skipLink = document.querySelector('[data-skip-link]') as HTMLElement;
        if (skipLink) {
          skipLink.focus();
          skipLink.click();
        }
      }

      // Main content (Alt + M)
      if (e.altKey && e.key === 'm') {
        e.preventDefault();
        const mainContent = document.querySelector('main, [role="main"]') as HTMLElement;
        if (mainContent) {
          mainContent.focus();
        }
      }

      // Search (Alt + /)
      if (e.altKey && e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('[role="searchbox"], input[type="search"]') as HTMLElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      setState(prev => ({ ...prev, keyboardNavigationActive: false }));
    };
  }, [keyboardNavigationEnabled]);

  // Font size management
  const setFontSize = useCallback((size: 'normal' | 'large' | 'larger') => {
    setState(prev => ({ ...prev, fontSize: size }));
    
    const root = document.documentElement;
    switch (size) {
      case 'large':
        root.style.fontSize = '18px';
        break;
      case 'larger':
        root.style.fontSize = '20px';
        break;
      default:
        root.style.fontSize = '16px';
    }

    // Save preference
    localStorage.setItem('accessibility-font-size', size);
  }, []);

  // High contrast mode
  const toggleHighContrast = useCallback(() => {
    setState(prev => {
      const newValue = !prev.highContrastMode;
      
      // Apply high contrast styles
      if (newValue) {
        document.body.classList.add('high-contrast');
      } else {
        document.body.classList.remove('high-contrast');
      }
      
      localStorage.setItem('accessibility-high-contrast', newValue.toString());
      return { ...prev, highContrastMode: newValue };
    });
  }, []);

  // Focus indicators
  const enhanceFocusIndicators = useCallback(() => {
    const style = document.createElement('style');
    style.textContent = `
      .enhanced-focus *:focus {
        outline: 3px solid #0066cc !important;
        outline-offset: 2px !important;
        border-radius: 2px;
      }
      
      .enhanced-focus button:focus,
      .enhanced-focus input:focus,
      .enhanced-focus select:focus,
      .enhanced-focus textarea:focus {
        box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.3) !important;
      }
    `;
    
    document.head.appendChild(style);
    document.body.classList.add('enhanced-focus');
    
    return () => {
      document.head.removeChild(style);
      document.body.classList.remove('enhanced-focus');
    };
  }, []);

  // ARIA live region manager
  const createLiveRegion = useCallback((id: string, priority: 'polite' | 'assertive' = 'polite') => {
    let region = document.getElementById(id);
    
    if (!region) {
      region = document.createElement('div');
      region.id = id;
      region.setAttribute('aria-live', priority);
      region.setAttribute('aria-atomic', 'true');
      region.style.position = 'absolute';
      region.style.left = '-10000px';
      region.style.width = '1px';
      region.style.height = '1px';
      region.style.overflow = 'hidden';
      document.body.appendChild(region);
    }
    
    return {
      announce: (message: string) => {
        if (region) {
          region.textContent = message;
        }
      },
      remove: () => {
        if (region && document.body.contains(region)) {
          document.body.removeChild(region);
        }
      }
    };
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      announcementTimeouts.current.forEach(clearTimeout);
      announcementTimeouts.current = [];
    };
  }, []);

  // Load saved preferences
  useEffect(() => {
    const savedFontSize = localStorage.getItem('accessibility-font-size') as any;
    if (savedFontSize) {
      setFontSize(savedFontSize);
    }

    const savedHighContrast = localStorage.getItem('accessibility-high-contrast');
    if (savedHighContrast === 'true') {
      toggleHighContrast();
    }
  }, [setFontSize, toggleHighContrast]);

  return {
    // State
    ...state,
    
    // Methods
    announce,
    trapFocus,
    releaseFocus,
    enableKeyboardNavigation,
    setFontSize,
    toggleHighContrast,
    enhanceFocusIndicators,
    createLiveRegion,
    
    // Utilities
    isAccessibilityEnabled: state.screenReaderActive || state.keyboardNavigationActive,
    shouldReduceMotion: state.reducedMotion,
    shouldUseHighContrast: state.highContrastMode,
  };
};

export default useAccessibility;
