/**
 * Advanced PII Detection and Redaction System
 * Comprehensive detection of personally identifiable information
 */

const logger = require('../utils/logger');

class PIIDetector {
  constructor() {
    this.patterns = this.initializePatterns();
    this.entityTypes = [
      'EMAIL',
      'PHONE',
      'SSN',
      'CREDIT_CARD',
      'ACCOUNT_NUMBER',
      'NAME',
      'ADDRESS',
      'DATE_OF_BIRTH',
      'IP_ADDRESS',
      'URL',
      'FINANCIAL_ACCOUNT',
    ];
  }

  /**
   * Initialize PII detection patterns
   */
  initializePatterns() {
    return {
      email: {
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
        replacement: '[EMAIL_REDACTED]',
        confidence: 0.95,
      },
      phone: {
        pattern: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
        replacement: '[PHONE_REDACTED]',
        confidence: 0.90,
      },
      ssn: {
        pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
        replacement: '[SSN_REDACTED]',
        confidence: 0.98,
      },
      creditCard: {
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        replacement: '[CARD_REDACTED]',
        confidence: 0.85,
        validator: this.validateCreditCard.bind(this),
      },
      accountNumber: {
        pattern: /\b\d{8,17}\b/g,
        replacement: '[ACCOUNT_REDACTED]',
        confidence: 0.70,
        validator: this.validateAccountNumber.bind(this),
      },
      ipAddress: {
        pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        replacement: '[IP_REDACTED]',
        confidence: 0.80,
        validator: this.validateIPAddress.bind(this),
      },
      url: {
        pattern: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
        replacement: '[URL_REDACTED]',
        confidence: 0.75,
      },
      dateOfBirth: {
        pattern: /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](19|20)\d{2}\b/g,
        replacement: '[DOB_REDACTED]',
        confidence: 0.80,
      },
      financialAccount: {
        pattern: /\b(account|acct)[\s#:]*\d{6,}\b/gi,
        replacement: '[FINANCIAL_ACCOUNT_REDACTED]',
        confidence: 0.75,
      },
      // Name patterns (more complex, requires context)
      name: {
        pattern: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g,
        replacement: '[NAME_REDACTED]',
        confidence: 0.60,
        validator: this.validateName.bind(this),
      },
      // Address patterns
      address: {
        pattern: /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Place|Pl)\b/gi,
        replacement: '[ADDRESS_REDACTED]',
        confidence: 0.85,
      },
    };
  }

  /**
   * Detect and redact PII in text
   */
  async detectAndRedact(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return {
        originalText: text,
        redactedText: text,
        detections: [],
        hasRedactions: false,
      };
    }

    const {
      enabledTypes = this.entityTypes,
      redactionMode = 'replace', // 'replace', 'mask', 'remove'
      preserveLength = false,
    } = options;

    let redactedText = text;
    const detections = [];

    // Process each PII type
    for (const [type, config] of Object.entries(this.patterns)) {
      const entityType = type.toUpperCase();
      
      if (!enabledTypes.includes(entityType)) {
        continue;
      }

      const matches = this.findMatches(text, config);
      
      for (const match of matches) {
        // Validate match if validator exists
        if (config.validator && !config.validator(match.value)) {
          continue;
        }

        // Apply redaction
        const redaction = this.applyRedaction(
          match.value,
          config.replacement,
          redactionMode,
          preserveLength
        );

        redactedText = redactedText.replace(match.value, redaction);

        // Record detection
        detections.push({
          type: entityType,
          value: match.value,
          redaction: redaction,
          position: match.index,
          length: match.value.length,
          confidence: config.confidence,
          context: this.extractContext(text, match.index, match.value.length),
        });
      }
    }

    // Additional context-based detection
    const contextualDetections = await this.detectContextualPII(text, redactedText);
    detections.push(...contextualDetections);

    // Apply contextual redactions
    for (const detection of contextualDetections) {
      redactedText = redactedText.replace(detection.value, detection.redaction);
    }

    return {
      originalText: text,
      redactedText,
      detections,
      hasRedactions: detections.length > 0,
      summary: this.generateDetectionSummary(detections),
    };
  }

  /**
   * Detect PII without redaction
   */
  async detect(text, options = {}) {
    const result = await this.detectAndRedact(text, {
      ...options,
      redactionMode: 'none',
    });

    return {
      detections: result.detections,
      hasDetections: result.hasRedactions,
      summary: result.summary,
    };
  }

  /**
   * Find pattern matches in text
   */
  findMatches(text, config) {
    const matches = [];
    let match;

    // Reset regex lastIndex
    config.pattern.lastIndex = 0;

    while ((match = config.pattern.exec(text)) !== null) {
      matches.push({
        value: match[0],
        index: match.index,
        groups: match.slice(1),
      });

      // Prevent infinite loop for global regexes
      if (!config.pattern.global) {
        break;
      }
    }

    return matches;
  }

  /**
   * Apply redaction based on mode
   */
  applyRedaction(value, replacement, mode, preserveLength) {
    switch (mode) {
      case 'replace':
        return replacement;
      
      case 'mask':
        if (preserveLength) {
          return '*'.repeat(value.length);
        }
        return '***';
      
      case 'remove':
        return '';
      
      case 'partial':
        return this.partialRedaction(value);
      
      default:
        return replacement;
    }
  }

  /**
   * Partial redaction (show first/last few characters)
   */
  partialRedaction(value) {
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }

    if (value.length <= 8) {
      return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
    }

    return value.substring(0, 3) + '*'.repeat(value.length - 6) + value.substring(value.length - 3);
  }

  /**
   * Extract context around detected PII
   */
  extractContext(text, index, length, contextSize = 50) {
    const start = Math.max(0, index - contextSize);
    const end = Math.min(text.length, index + length + contextSize);
    
    return {
      before: text.substring(start, index),
      match: text.substring(index, index + length),
      after: text.substring(index + length, end),
    };
  }

  /**
   * Detect contextual PII using patterns and keywords
   */
  async detectContextualPII(originalText, currentText) {
    const detections = [];
    const contextPatterns = [
      {
        type: 'NAME',
        pattern: /(?:my name is|i am|i'm|called)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
        confidence: 0.85,
      },
      {
        type: 'FINANCIAL_ACCOUNT',
        pattern: /(?:account|policy|fund)\s*(?:number|#|id)\s*:?\s*([A-Z0-9]{6,})/gi,
        confidence: 0.90,
      },
      {
        type: 'EMPLOYEE_ID',
        pattern: /(?:employee|emp|staff)\s*(?:id|number|#)\s*:?\s*([A-Z0-9]{4,})/gi,
        confidence: 0.85,
      },
      {
        type: 'CUSTOMER_ID',
        pattern: /(?:customer|client)\s*(?:id|number|#)\s*:?\s*([A-Z0-9]{4,})/gi,
        confidence: 0.85,
      },
    ];

    for (const contextPattern of contextPatterns) {
      const matches = this.findMatches(originalText, contextPattern);
      
      for (const match of matches) {
        const detectedValue = match.groups[0]; // First capture group
        
        detections.push({
          type: contextPattern.type,
          value: detectedValue,
          redaction: `[${contextPattern.type}_REDACTED]`,
          position: originalText.indexOf(detectedValue),
          length: detectedValue.length,
          confidence: contextPattern.confidence,
          context: this.extractContext(originalText, match.index, match.value.length),
          method: 'contextual',
        });
      }
    }

    return detections;
  }

  /**
   * Validate credit card using Luhn algorithm
   */
  validateCreditCard(cardNumber) {
    const digits = cardNumber.replace(/\D/g, '');
    
    if (digits.length < 13 || digits.length > 19) {
      return false;
    }

    // Luhn algorithm
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Validate account number (basic checks)
   */
  validateAccountNumber(accountNumber) {
    const digits = accountNumber.replace(/\D/g, '');
    
    // Basic validation: reasonable length and not all same digits
    if (digits.length < 8 || digits.length > 17) {
      return false;
    }

    // Check if all digits are the same (likely not a real account)
    const firstDigit = digits[0];
    if (digits.split('').every(digit => digit === firstDigit)) {
      return false;
    }

    return true;
  }

  /**
   * Validate IP address
   */
  validateIPAddress(ip) {
    const parts = ip.split('.');
    
    if (parts.length !== 4) {
      return false;
    }

    return parts.every(part => {
      const num = parseInt(part);
      return num >= 0 && num <= 255 && part === num.toString();
    });
  }

  /**
   * Validate name (context-based)
   */
  validateName(name) {
    // Common words that are not names
    const commonWords = [
      'fund', 'account', 'balance', 'total', 'amount', 'value',
      'report', 'statement', 'summary', 'details', 'information',
      'system', 'process', 'method', 'service', 'product',
      'company', 'business', 'market', 'price', 'rate',
    ];

    const nameLower = name.toLowerCase();
    
    // Check if it's a common word
    if (commonWords.some(word => nameLower.includes(word))) {
      return false;
    }

    // Check if it looks like a proper name (starts with capitals)
    const words = name.split(' ');
    if (words.length < 2 || words.length > 4) {
      return false;
    }

    return words.every(word => /^[A-Z][a-z]+$/.test(word));
  }

  /**
   * Generate detection summary
   */
  generateDetectionSummary(detections) {
    const summary = {
      totalDetections: detections.length,
      typeBreakdown: {},
      confidenceLevels: {
        high: 0,
        medium: 0,
        low: 0,
      },
      riskLevel: 'low',
    };

    detections.forEach(detection => {
      // Count by type
      summary.typeBreakdown[detection.type] = 
        (summary.typeBreakdown[detection.type] || 0) + 1;

      // Count by confidence level
      if (detection.confidence >= 0.8) {
        summary.confidenceLevels.high++;
      } else if (detection.confidence >= 0.6) {
        summary.confidenceLevels.medium++;
      } else {
        summary.confidenceLevels.low++;
      }
    });

    // Determine risk level
    if (detections.length === 0) {
      summary.riskLevel = 'none';
    } else if (summary.confidenceLevels.high > 0) {
      summary.riskLevel = 'high';
    } else if (summary.confidenceLevels.medium > 0) {
      summary.riskLevel = 'medium';
    } else {
      summary.riskLevel = 'low';
    }

    return summary;
  }

  /**
   * Batch process multiple texts
   */
  async batchDetectAndRedact(texts, options = {}) {
    const results = [];
    
    for (let i = 0; i < texts.length; i++) {
      try {
        const result = await this.detectAndRedact(texts[i], options);
        results.push({
          index: i,
          success: true,
          result,
        });
      } catch (error) {
        logger.error(`PII detection failed for text ${i}:`, error);
        results.push({
          index: i,
          success: false,
          error: error.message,
          result: {
            originalText: texts[i],
            redactedText: texts[i],
            detections: [],
            hasRedactions: false,
          },
        });
      }
    }

    return results;
  }

  /**
   * Get detection statistics
   */
  getDetectionStats(detections) {
    return {
      total: detections.length,
      byType: detections.reduce((acc, detection) => {
        acc[detection.type] = (acc[detection.type] || 0) + 1;
        return acc;
      }, {}),
      averageConfidence: detections.length > 0 
        ? detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length
        : 0,
      highConfidenceCount: detections.filter(d => d.confidence >= 0.8).length,
    };
  }

  /**
   * Export detection patterns for analysis
   */
  exportPatterns() {
    return Object.entries(this.patterns).map(([type, config]) => ({
      type: type.toUpperCase(),
      pattern: config.pattern.toString(),
      replacement: config.replacement,
      confidence: config.confidence,
      hasValidator: !!config.validator,
    }));
  }

  /**
   * Test patterns against sample data
   */
  testPatterns(sampleTexts) {
    const results = {};
    
    Object.entries(this.patterns).forEach(([type, config]) => {
      results[type] = {
        pattern: config.pattern.toString(),
        matches: [],
      };

      sampleTexts.forEach((text, index) => {
        const matches = this.findMatches(text, config);
        if (matches.length > 0) {
          results[type].matches.push({
            textIndex: index,
            matches: matches.map(m => ({
              value: m.value,
              position: m.index,
            })),
          });
        }
      });
    });

    return results;
  }

  /**
   * Simple redact method for backward compatibility
   */
  async redact(text) {
    if (!text) return text;
    
    const result = await this.detectAndRedact(text, {
      enabledTypes: ['EMAIL', 'PHONE', 'SSN', 'CREDIT_CARD'],
      redactionMode: 'replace',
    });
    
    return result.redactedText;
  }

  /**
   * Check if text contains PII
   */
  async containsPII(text) {
    if (!text) return false;
    
    const result = await this.detectAndRedact(text, {
      enabledTypes: ['EMAIL', 'PHONE', 'SSN', 'CREDIT_CARD'],
    });
    
    return result.detections.length > 0;
  }

  /**
   * Identify PII instances in text
   */
  async identifyPII(text) {
    if (!text) return [];
    
    const result = await this.detectAndRedact(text, {
      enabledTypes: ['EMAIL', 'PHONE', 'SSN', 'CREDIT_CARD'],
    });
    
    return result.detections.map(detection => ({
      type: detection.type,
      value: detection.value,
      index: detection.index,
      length: detection.length,
      confidence: detection.confidence,
    }));
  }
}

module.exports = PIIDetector;
