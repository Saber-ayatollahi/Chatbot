/**
 * Performance Optimization Utilities - Full Implementation
 * Phase 3, Day 14: Comprehensive performance monitoring and optimization system
 * Advanced performance utilities for monitoring, optimization, and system tuning
 */

import React, { useCallback, useMemo, useRef, useEffect } from 'react';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  category: 'render' | 'network' | 'memory' | 'cpu' | 'storage' | 'user';
  threshold?: {
    warning: number;
    critical: number;
  };
}

export interface PerformanceProfile {
  id: string;
  name: string;
  description: string;
  metrics: PerformanceMetric[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tags: string[];
}

export interface OptimizationRecommendation {
  id: string;
  type: 'component' | 'network' | 'memory' | 'rendering' | 'bundle' | 'caching';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  implementation: string[];
  estimatedImprovement: string;
  relatedMetrics: string[];
}

export interface PerformanceConfig {
  enableProfiling: boolean;
  enableMemoryMonitoring: boolean;
  enableNetworkMonitoring: boolean;
  enableRenderMonitoring: boolean;
  samplingRate: number;
  maxProfileDuration: number;
  alertThresholds: {
    renderTime: number;
    memoryUsage: number;
    networkLatency: number;
    bundleSize: number;
  };
}

// Performance monitoring service
export class PerformanceMonitoringService {
  private static instance: PerformanceMonitoringService;
  private profiles: PerformanceProfile[] = [];
  private activeProfile: PerformanceProfile | null = null;
  private config: PerformanceConfig;
  private observers: PerformanceObserver[] = [];
  private intervalId: NodeJS.Timeout | null = null;

  static getInstance(): PerformanceMonitoringService {
    if (!PerformanceMonitoringService.instance) {
      PerformanceMonitoringService.instance = new PerformanceMonitoringService();
    }
    return PerformanceMonitoringService.instance;
  }

  constructor() {
    this.config = {
      enableProfiling: true,
      enableMemoryMonitoring: true,
      enableNetworkMonitoring: true,
      enableRenderMonitoring: true,
      samplingRate: 1000, // 1 second
      maxProfileDuration: 300000, // 5 minutes
      alertThresholds: {
        renderTime: 16, // 60fps = 16.67ms per frame
        memoryUsage: 100 * 1024 * 1024, // 100MB
        networkLatency: 1000, // 1 second
        bundleSize: 5 * 1024 * 1024, // 5MB
      },
    };

    this.initializeMonitoring();
  }

  private initializeMonitoring() {
    if (typeof window === 'undefined') return;

    // Initialize Performance Observer for navigation timing
    if ('PerformanceObserver' in window) {
      try {
        const navObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'navigation') {
              this.recordMetric({
                name: 'page_load_time',
                value: entry.loadEventEnd - entry.loadEventStart,
                unit: 'ms',
                timestamp: new Date(),
                category: 'render',
                threshold: {
                  warning: 2000,
                  critical: 5000,
                },
              });
            }
          });
        });
        navObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navObserver);
      } catch (error) {
        console.warn('Navigation timing observer not supported:', error);
      }

      // Initialize Performance Observer for resource timing
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'resource') {
              this.recordMetric({
                name: `resource_load_${entry.name.split('/').pop()}`,
                value: entry.responseEnd - entry.requestStart,
                unit: 'ms',
                timestamp: new Date(),
                category: 'network',
                threshold: {
                  warning: 500,
                  critical: 2000,
                },
              });
            }
          });
        });
        resourceObserver.observe({ entryTypes: ['resource'] });
        this.observers.push(resourceObserver);
      } catch (error) {
        console.warn('Resource timing observer not supported:', error);
      }

      // Initialize Performance Observer for long tasks
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === 'longtask') {
              this.recordMetric({
                name: 'long_task',
                value: entry.duration,
                unit: 'ms',
                timestamp: new Date(),
                category: 'cpu',
                threshold: {
                  warning: 50,
                  critical: 100,
                },
              });
            }
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (error) {
        console.warn('Long task observer not supported:', error);
      }
    }

    // Start memory monitoring
    if (this.config.enableMemoryMonitoring) {
      this.startMemoryMonitoring();
    }
  }

  private startMemoryMonitoring() {
    if (typeof window === 'undefined' || !('performance' in window)) return;

    this.intervalId = setInterval(() => {
      // @ts-ignore - memory API is experimental
      if (performance.memory) {
        // @ts-ignore
        const memory = performance.memory;
        this.recordMetric({
          name: 'heap_used',
          value: memory.usedJSHeapSize,
          unit: 'bytes',
          timestamp: new Date(),
          category: 'memory',
          threshold: {
            warning: this.config.alertThresholds.memoryUsage * 0.8,
            critical: this.config.alertThresholds.memoryUsage,
          },
        });

        this.recordMetric({
          name: 'heap_total',
          value: memory.totalJSHeapSize,
          unit: 'bytes',
          timestamp: new Date(),
          category: 'memory',
        });

        this.recordMetric({
          name: 'heap_limit',
          value: memory.jsHeapSizeLimit,
          unit: 'bytes',
          timestamp: new Date(),
          category: 'memory',
        });
      }
    }, this.config.samplingRate);
  }

  startProfiling(name: string, description: string = '', tags: string[] = []): string {
    const profile: PerformanceProfile = {
      id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      metrics: [],
      startTime: new Date(),
      tags,
    };

    this.activeProfile = profile;
    this.profiles.push(profile);

    // Auto-stop profiling after max duration
    setTimeout(() => {
      if (this.activeProfile?.id === profile.id) {
        this.stopProfiling();
      }
    }, this.config.maxProfileDuration);

    return profile.id;
  }

  stopProfiling(): PerformanceProfile | null {
    if (!this.activeProfile) return null;

    this.activeProfile.endTime = new Date();
    this.activeProfile.duration = this.activeProfile.endTime.getTime() - this.activeProfile.startTime.getTime();

    const profile = this.activeProfile;
    this.activeProfile = null;

    return profile;
  }

  recordMetric(metric: PerformanceMetric) {
    if (this.activeProfile) {
      this.activeProfile.metrics.push(metric);
    }

    // Check thresholds and generate alerts
    if (metric.threshold) {
      if (metric.value >= metric.threshold.critical) {
        this.generateAlert('critical', metric);
      } else if (metric.value >= metric.threshold.warning) {
        this.generateAlert('warning', metric);
      }
    }
  }

  private generateAlert(level: 'warning' | 'critical', metric: PerformanceMetric) {
    console.warn(`Performance Alert [${level.toUpperCase()}]: ${metric.name} = ${metric.value}${metric.unit}`);
    
    // In a real implementation, this would send alerts to monitoring service
    // or display notifications to users
  }

  measureComponentRender<T extends React.ComponentType<any>>(
    Component: T,
    displayName?: string
  ): T {
    const MeasuredComponent = React.forwardRef<any, React.ComponentProps<T>>((props, ref) => {
      const renderStart = useRef<number>(0);
      const componentName = displayName || Component.displayName || Component.name || 'Unknown';

      useEffect(() => {
        renderStart.current = performance.now();
      });

      useEffect(() => {
        const renderTime = performance.now() - renderStart.current;
        this.recordMetric({
          name: `component_render_${componentName}`,
          value: renderTime,
          unit: 'ms',
          timestamp: new Date(),
          category: 'render',
          threshold: {
            warning: this.config.alertThresholds.renderTime,
            critical: this.config.alertThresholds.renderTime * 2,
          },
        });
      });

      return React.createElement(Component, { ...props, ref });
    });

    MeasuredComponent.displayName = `Measured(${displayName || Component.displayName || Component.name})`;
    
    return MeasuredComponent as T;
  }

  measureAsyncOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): () => Promise<T> {
    return async () => {
      const startTime = performance.now();
      
      try {
        const result = await operation();
        const duration = performance.now() - startTime;
        
        this.recordMetric({
          name: `async_operation_${operationName}`,
          value: duration,
          unit: 'ms',
          timestamp: new Date(),
          category: 'network',
        });
        
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        this.recordMetric({
          name: `async_operation_error_${operationName}`,
          value: duration,
          unit: 'ms',
          timestamp: new Date(),
          category: 'network',
        });
        
        throw error;
      }
    };
  }

  getProfiles(): PerformanceProfile[] {
    return this.profiles;
  }

  getActiveProfile(): PerformanceProfile | null {
    return this.activeProfile;
  }

  getMetricsByCategory(category: PerformanceMetric['category']): PerformanceMetric[] {
    const allMetrics = this.profiles.flatMap(profile => profile.metrics);
    return allMetrics.filter(metric => metric.category === category);
  }

  getPerformanceStatistics() {
    const allMetrics = this.profiles.flatMap(profile => profile.metrics);
    
    const categories = ['render', 'network', 'memory', 'cpu', 'storage', 'user'] as const;
    const statistics: Record<string, any> = {};
    
    categories.forEach(category => {
      const categoryMetrics = allMetrics.filter(m => m.category === category);
      if (categoryMetrics.length > 0) {
        const values = categoryMetrics.map(m => m.value);
        statistics[category] = {
          count: categoryMetrics.length,
          average: values.reduce((sum, val) => sum + val, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          latest: categoryMetrics[categoryMetrics.length - 1]?.value || 0,
        };
      }
    });
    
    return statistics;
  }

  generateOptimizationRecommendations(): OptimizationRecommendation[] {
    const statistics = this.getPerformanceStatistics();
    const recommendations: OptimizationRecommendation[] = [];

    // Render performance recommendations
    if (statistics.render && statistics.render.average > this.config.alertThresholds.renderTime) {
      recommendations.push({
        id: 'optimize_render_performance',
        type: 'rendering',
        priority: 'high',
        title: 'Optimize Component Rendering',
        description: 'Components are taking longer than optimal to render, affecting user experience.',
        impact: 'high',
        effort: 'medium',
        implementation: [
          'Use React.memo for expensive components',
          'Implement useMemo for expensive calculations',
          'Use useCallback for event handlers',
          'Consider code splitting for large components',
          'Optimize re-render triggers',
        ],
        estimatedImprovement: '30-50% reduction in render time',
        relatedMetrics: ['component_render_time', 'long_task'],
      });
    }

    // Memory performance recommendations
    if (statistics.memory && statistics.memory.average > this.config.alertThresholds.memoryUsage * 0.7) {
      recommendations.push({
        id: 'optimize_memory_usage',
        type: 'memory',
        priority: 'medium',
        title: 'Reduce Memory Usage',
        description: 'Application is using more memory than recommended, which may cause performance issues.',
        impact: 'medium',
        effort: 'medium',
        implementation: [
          'Implement virtual scrolling for large lists',
          'Clean up event listeners and subscriptions',
          'Use lazy loading for images and components',
          'Optimize data structures and caching',
          'Remove unused dependencies',
        ],
        estimatedImprovement: '20-40% reduction in memory usage',
        relatedMetrics: ['heap_used', 'heap_total'],
      });
    }

    // Network performance recommendations
    if (statistics.network && statistics.network.average > this.config.alertThresholds.networkLatency) {
      recommendations.push({
        id: 'optimize_network_requests',
        type: 'network',
        priority: 'high',
        title: 'Optimize Network Requests',
        description: 'Network requests are taking longer than expected, impacting application responsiveness.',
        impact: 'high',
        effort: 'low',
        implementation: [
          'Implement request caching',
          'Use request batching where possible',
          'Optimize API response sizes',
          'Implement request deduplication',
          'Use CDN for static assets',
        ],
        estimatedImprovement: '40-60% reduction in network latency',
        relatedMetrics: ['resource_load_time', 'api_response_time'],
      });
    }

    // Bundle size recommendations
    recommendations.push({
      id: 'optimize_bundle_size',
      type: 'bundle',
      priority: 'medium',
      title: 'Reduce Bundle Size',
      description: 'Application bundle size can be optimized to improve initial load times.',
      impact: 'medium',
      effort: 'high',
      implementation: [
        'Implement code splitting',
        'Remove unused dependencies',
        'Use tree shaking',
        'Optimize images and assets',
        'Use dynamic imports for non-critical code',
      ],
      estimatedImprovement: '25-35% reduction in bundle size',
      relatedMetrics: ['page_load_time', 'resource_load_time'],
    });

    return recommendations;
  }

  clearProfiles() {
    this.profiles = [];
    this.activeProfile = null;
  }

  updateConfig(newConfig: Partial<PerformanceConfig>) {
    this.config = { ...this.config, ...newConfig };
    
    // Restart monitoring with new config
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.config.enableMemoryMonitoring) {
      this.startMemoryMonitoring();
    }
  }

  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  destroy() {
    // Clean up observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    
    // Clear interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    // Clear profiles
    this.clearProfiles();
  }
}

// React hooks for performance monitoring
export function usePerformanceMonitoring() {
  const service = PerformanceMonitoringService.getInstance();
  
  const startProfiling = useCallback((name: string, description?: string, tags?: string[]) => {
    return service.startProfiling(name, description, tags);
  }, [service]);
  
  const stopProfiling = useCallback(() => {
    return service.stopProfiling();
  }, [service]);
  
  const recordMetric = useCallback((metric: PerformanceMetric) => {
    service.recordMetric(metric);
  }, [service]);
  
  return {
    startProfiling,
    stopProfiling,
    recordMetric,
    getProfiles: () => service.getProfiles(),
    getStatistics: () => service.getPerformanceStatistics(),
    getRecommendations: () => service.generateOptimizationRecommendations(),
  };
}

export function useRenderPerformance(componentName: string) {
  const service = PerformanceMonitoringService.getInstance();
  const renderStart = useRef<number>(0);
  
  useEffect(() => {
    renderStart.current = performance.now();
  });
  
  useEffect(() => {
    const renderTime = performance.now() - renderStart.current;
    service.recordMetric({
      name: `component_render_${componentName}`,
      value: renderTime,
      unit: 'ms',
      timestamp: new Date(),
      category: 'render',
    });
  });
}

export function useMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps);
}

export function useMemoizedValue<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  return useMemo(factory, deps);
}

// Higher-order component for performance monitoring
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const WrappedComponent = React.forwardRef<any, P>((props, ref) => {
    const name = componentName || Component.displayName || Component.name || 'Unknown';
    useRenderPerformance(name);
    
    return React.createElement(Component, { ...props, ref });
  });
  
  WrappedComponent.displayName = `withPerformanceMonitoring(${componentName || Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Utility functions
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function measureExecutionTime<T>(
  func: () => T,
  label?: string
): T {
  const start = performance.now();
  const result = func();
  const end = performance.now();
  
  console.log(`${label || 'Execution'} time: ${end - start}ms`);
  
  return result;
}

export async function measureAsyncExecutionTime<T>(
  func: () => Promise<T>,
  label?: string
): Promise<T> {
  const start = performance.now();
  const result = await func();
  const end = performance.now();
  
  console.log(`${label || 'Async execution'} time: ${end - start}ms`);
  
  return result;
}

// Export singleton instance
export const performanceMonitoringService = PerformanceMonitoringService.getInstance();
