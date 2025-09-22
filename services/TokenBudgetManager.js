/**
 * Token Budget Manager
 * Dynamic token allocation based on query complexity and context
 */

const logger = require('../utils/logger');

class TokenBudgetManager {
  constructor(options = {}) {
    this.options = {
      // Base budgets by complexity
      baseBudgets: {
        simple: 800,
        standard: 1500,
        complex: 2500,
        system: 0
      },
      
      // Budget allocation ratios
      allocation: {
        chunks: 0.60,      // 60% for chunk content
        prompt: 0.25,      // 25% for prompt template
        response: 0.15     // 15% reserved for response
      },
      
      // Dynamic adjustments
      adjustments: {
        highConfidence: 0.8,    // Reduce budget if high confidence expected
        lowConfidence: 1.3,     // Increase budget if low confidence expected
        multiTurn: 1.2,         // Increase for conversation context
        firstTurn: 0.9          // Reduce for first interaction
      },
      
      // Safety limits
      limits: {
        minimum: 200,
        maximum: 4000,
        emergencyReserve: 100
      },
      
      ...options
    };
    
    this.stats = {
      totalBudgets: 0,
      totalAllocated: 0,
      totalUsed: 0,
      averageUtilization: 0,
      budgetsByComplexity: {
        simple: { count: 0, total: 0, used: 0 },
        standard: { count: 0, total: 0, used: 0 },
        complex: { count: 0, total: 0, used: 0 },
        system: { count: 0, total: 0, used: 0 }
      }
    };
  }

  /**
   * Calculate optimal token budget for query
   * @param {Object} classification - Query classification result
   * @param {Object} context - Additional context
   * @returns {Object} Budget allocation
   */
  calculateBudget(classification, context = {}) {
    const startTime = Date.now();
    
    try {
      // Handle system queries (no tokens needed)
      if (classification.type === 'SYSTEM') {
        return this.createBudgetResult(0, 'system', 'System query - no tokens needed', startTime);
      }
      
      // Get base budget
      const complexity = classification.complexity || 'standard';
      let baseBudget = this.options.baseBudgets[complexity] || this.options.baseBudgets.standard;
      
      // Apply dynamic adjustments
      const adjustedBudget = this.applyDynamicAdjustments(baseBudget, classification, context);
      
      // Apply safety limits
      const finalBudget = this.applySafetyLimits(adjustedBudget);
      
      // Calculate allocation breakdown
      const allocation = this.calculateAllocation(finalBudget);
      
      // Update statistics
      this.updateBudgetStats(complexity, finalBudget);
      
      const result = {
        totalBudget: finalBudget,
        allocation: allocation,
        complexity: complexity,
        adjustments: this.getAppliedAdjustments(baseBudget, adjustedBudget, context),
        reasoning: this.generateBudgetReasoning(classification, context, baseBudget, finalBudget),
        calculationTime: Date.now() - startTime,
        metadata: {
          baseBudget: baseBudget,
          adjustedBudget: adjustedBudget,
          safetyLimited: adjustedBudget !== finalBudget
        }
      };
      
      logger.debug(`💰 Token budget calculated: ${finalBudget} tokens (${complexity})`);
      
      return result;
      
    } catch (error) {
      logger.error('❌ Token budget calculation failed:', error);
      
      // Fallback budget
      const fallbackBudget = this.options.baseBudgets.standard;
      return this.createBudgetResult(
        fallbackBudget, 
        'standard', 
        `Fallback budget due to error: ${error.message}`, 
        startTime,
        { error: error.message }
      );
    }
  }

  /**
   * Apply dynamic adjustments based on context
   * @param {number} baseBudget - Base budget amount
   * @param {Object} classification - Query classification
   * @param {Object} context - Additional context
   * @returns {number} Adjusted budget
   */
  applyDynamicAdjustments(baseBudget, classification, context) {
    let adjustedBudget = baseBudget;
    const adjustments = [];
    
    // Confidence-based adjustment
    if (context.expectedConfidence) {
      if (context.expectedConfidence > 0.8) {
        adjustedBudget *= this.options.adjustments.highConfidence;
        adjustments.push('high_confidence_reduction');
      } else if (context.expectedConfidence < 0.4) {
        adjustedBudget *= this.options.adjustments.lowConfidence;
        adjustments.push('low_confidence_increase');
      }
    }
    
    // Conversation context adjustment
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      adjustedBudget *= this.options.adjustments.multiTurn;
      adjustments.push('multi_turn_increase');
    } else {
      adjustedBudget *= this.options.adjustments.firstTurn;
      adjustments.push('first_turn_reduction');
    }
    
    // Query length adjustment
    if (context.queryLength) {
      if (context.queryLength > 100) {
        adjustedBudget *= 1.2; // Long queries need more context
        adjustments.push('long_query_increase');
      } else if (context.queryLength < 20) {
        adjustedBudget *= 0.8; // Short queries need less context
        adjustments.push('short_query_reduction');
      }
    }
    
    // Domain-specific adjustments
    if (context.domain) {
      switch (context.domain) {
        case 'technical':
          adjustedBudget *= 1.3;
          adjustments.push('technical_domain_increase');
          break;
        case 'simple_faq':
          adjustedBudget *= 0.7;
          adjustments.push('faq_domain_reduction');
          break;
      }
    }
    
    // Time-based adjustments (peak hours might need more budget)
    if (context.timestamp) {
      const hour = new Date(context.timestamp).getHours();
      if (hour >= 9 && hour <= 17) { // Business hours
        adjustedBudget *= 1.1;
        adjustments.push('business_hours_increase');
      }
    }
    
    // User type adjustments
    if (context.userType) {
      switch (context.userType) {
        case 'premium':
          adjustedBudget *= 1.2;
          adjustments.push('premium_user_increase');
          break;
        case 'trial':
          adjustedBudget *= 0.8;
          adjustments.push('trial_user_reduction');
          break;
      }
    }
    
    return Math.round(adjustedBudget);
  }

  /**
   * Apply safety limits to budget
   * @param {number} budget - Calculated budget
   * @returns {number} Safe budget
   */
  applySafetyLimits(budget) {
    return Math.max(
      this.options.limits.minimum,
      Math.min(this.options.limits.maximum, budget)
    );
  }

  /**
   * Calculate budget allocation breakdown
   * @param {number} totalBudget - Total available budget
   * @returns {Object} Allocation breakdown
   */
  calculateAllocation(totalBudget) {
    const chunkBudget = Math.floor(totalBudget * this.options.allocation.chunks);
    const promptBudget = Math.floor(totalBudget * this.options.allocation.prompt);
    const responseBudget = Math.floor(totalBudget * this.options.allocation.response);
    
    // Ensure we don't exceed total budget due to rounding
    const allocatedTotal = chunkBudget + promptBudget + responseBudget;
    const reserve = totalBudget - allocatedTotal;
    
    return {
      chunks: chunkBudget,
      prompt: promptBudget,
      response: responseBudget,
      reserve: Math.max(0, reserve),
      total: totalBudget,
      utilization: {
        chunks: (chunkBudget / totalBudget * 100).toFixed(1) + '%',
        prompt: (promptBudget / totalBudget * 100).toFixed(1) + '%',
        response: (responseBudget / totalBudget * 100).toFixed(1) + '%'
      }
    };
  }

  /**
   * Get applied adjustments summary
   * @param {number} baseBudget - Original base budget
   * @param {number} adjustedBudget - Final adjusted budget
   * @param {Object} context - Context used for adjustments
   * @returns {Object} Adjustments summary
   */
  getAppliedAdjustments(baseBudget, adjustedBudget, context) {
    const totalAdjustment = adjustedBudget - baseBudget;
    const adjustmentRatio = adjustedBudget / baseBudget;
    
    return {
      baseBudget: baseBudget,
      adjustedBudget: adjustedBudget,
      totalAdjustment: totalAdjustment,
      adjustmentRatio: adjustmentRatio,
      adjustmentPercentage: ((adjustmentRatio - 1) * 100).toFixed(1) + '%',
      direction: totalAdjustment > 0 ? 'increase' : totalAdjustment < 0 ? 'decrease' : 'none'
    };
  }

  /**
   * Generate reasoning for budget decision
   * @param {Object} classification - Query classification
   * @param {Object} context - Context information
   * @param {number} baseBudget - Base budget
   * @param {number} finalBudget - Final budget
   * @returns {string} Budget reasoning
   */
  generateBudgetReasoning(classification, context, baseBudget, finalBudget) {
    const reasons = [];
    
    reasons.push(`Base budget for ${classification.complexity || 'standard'} query: ${baseBudget} tokens`);
    
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      reasons.push('Increased for multi-turn conversation context');
    }
    
    if (context.expectedConfidence) {
      if (context.expectedConfidence > 0.8) {
        reasons.push('Reduced for high expected confidence');
      } else if (context.expectedConfidence < 0.4) {
        reasons.push('Increased for low expected confidence');
      }
    }
    
    if (finalBudget !== baseBudget) {
      const change = finalBudget - baseBudget;
      const direction = change > 0 ? 'increased' : 'decreased';
      reasons.push(`Final budget ${direction} by ${Math.abs(change)} tokens`);
    }
    
    return reasons.join('. ');
  }

  /**
   * Create standardized budget result
   * @param {number} budget - Budget amount
   * @param {string} complexity - Complexity level
   * @param {string} reasoning - Budget reasoning
   * @param {number} startTime - Calculation start time
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Budget result
   */
  createBudgetResult(budget, complexity, reasoning, startTime, metadata = {}) {
    return {
      totalBudget: budget,
      allocation: this.calculateAllocation(budget),
      complexity: complexity,
      reasoning: reasoning,
      calculationTime: Date.now() - startTime,
      metadata: metadata
    };
  }

  /**
   * Update budget statistics
   * @param {string} complexity - Query complexity
   * @param {number} budget - Allocated budget
   */
  updateBudgetStats(complexity, budget) {
    this.stats.totalBudgets++;
    this.stats.totalAllocated += budget;
    
    if (this.stats.budgetsByComplexity[complexity]) {
      this.stats.budgetsByComplexity[complexity].count++;
      this.stats.budgetsByComplexity[complexity].total += budget;
    }
  }

  /**
   * Record actual token usage for budget optimization
   * @param {string} complexity - Query complexity
   * @param {number} budgetAllocated - Budget that was allocated
   * @param {number} tokensUsed - Actual tokens used
   */
  recordUsage(complexity, budgetAllocated, tokensUsed) {
    this.stats.totalUsed += tokensUsed;
    
    if (this.stats.budgetsByComplexity[complexity]) {
      this.stats.budgetsByComplexity[complexity].used += tokensUsed;
    }
    
    // Update average utilization
    const utilization = tokensUsed / budgetAllocated;
    this.stats.averageUtilization = (this.stats.averageUtilization + utilization) / 2;
  }

  /**
   * Get optimization recommendations based on usage patterns
   * @returns {Object} Optimization recommendations
   */
  getOptimizationRecommendations() {
    const recommendations = [];
    
    // Check utilization by complexity
    Object.entries(this.stats.budgetsByComplexity).forEach(([complexity, stats]) => {
      if (stats.count > 10) { // Enough data points
        const avgBudget = stats.total / stats.count;
        const avgUsage = stats.used / stats.count;
        const utilization = avgUsage / avgBudget;
        
        if (utilization < 0.6) {
          recommendations.push({
            type: 'reduce_budget',
            complexity: complexity,
            currentAvg: avgBudget,
            suggestedAvg: Math.round(avgBudget * 0.8),
            reason: `Low utilization (${(utilization * 100).toFixed(1)}%) for ${complexity} queries`
          });
        } else if (utilization > 0.9) {
          recommendations.push({
            type: 'increase_budget',
            complexity: complexity,
            currentAvg: avgBudget,
            suggestedAvg: Math.round(avgBudget * 1.2),
            reason: `High utilization (${(utilization * 100).toFixed(1)}%) for ${complexity} queries`
          });
        }
      }
    });
    
    return {
      recommendations: recommendations,
      overallUtilization: (this.stats.averageUtilization * 100).toFixed(1) + '%',
      totalQueries: this.stats.totalBudgets,
      totalTokensSaved: Math.max(0, this.stats.totalAllocated - this.stats.totalUsed)
    };
  }

  /**
   * Get budget statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      averageUtilizationPercentage: (this.stats.averageUtilization * 100).toFixed(1) + '%',
      totalTokensSaved: Math.max(0, this.stats.totalAllocated - this.stats.totalUsed),
      efficiencyRatio: this.stats.totalAllocated > 0 ? 
        (this.stats.totalUsed / this.stats.totalAllocated).toFixed(3) : 0
    };
  }

  /**
   * Reset statistics (for testing or periodic resets)
   */
  resetStats() {
    this.stats = {
      totalBudgets: 0,
      totalAllocated: 0,
      totalUsed: 0,
      averageUtilization: 0,
      budgetsByComplexity: {
        simple: { count: 0, total: 0, used: 0 },
        standard: { count: 0, total: 0, used: 0 },
        complex: { count: 0, total: 0, used: 0 },
        system: { count: 0, total: 0, used: 0 }
      }
    };
  }
}

module.exports = TokenBudgetManager;
