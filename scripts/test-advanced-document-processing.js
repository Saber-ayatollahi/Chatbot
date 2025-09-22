/**
 * Test Script for Advanced Document Processing System
 * Validates the improved document digestion pipeline with comprehensive testing
 */

const path = require('path');
const fs = require('fs-extra');
const AdvancedDocumentProcessingService = require('../services/AdvancedDocumentProcessingService');
const AdvancedContextualRetriever = require('../knowledge/retrieval/AdvancedContextualRetriever');
const { getDatabase } = require('../config/database');
const logger = require('../utils/logger');

class AdvancedDocumentProcessingTester {
  constructor() {
    this.processingService = new AdvancedDocumentProcessingService();
    this.contextualRetriever = new AdvancedContextualRetriever();
    this.db = null;
    
    this.testResults = {
      documentProcessing: {},
      chunkingQuality: {},
      embeddingQuality: {},
      retrievalPerformance: {},
      contextQuality: {},
      overallScore: 0
    };
  }

  /**
   * Initialize database connection
   */
  async initializeDatabase() {
    if (!this.db) {
      this.db = getDatabase();
      if (!this.db.isReady()) {
        await this.db.initialize();
      }
    }
  }

  /**
   * Run comprehensive test suite
   */
  async runComprehensiveTests() {
    try {
      logger.info('🧪 Starting comprehensive advanced document processing tests');
      
      await this.initializeDatabase();
      
      // Test 1: Document Processing Pipeline
      await this.testDocumentProcessingPipeline();
      
      // Test 2: Chunking Quality Assessment
      await this.testChunkingQuality();
      
      // Test 3: Embedding Quality Validation
      await this.testEmbeddingQuality();
      
      // Test 4: Retrieval Performance Testing
      await this.testRetrievalPerformance();
      
      // Test 5: Context Quality Evaluation
      await this.testContextQuality();
      
      // Test 6: End-to-End Integration Test
      await this.testEndToEndIntegration();
      
      // Calculate overall score
      this.calculateOverallScore();
      
      // Generate test report
      const report = this.generateTestReport();
      
      logger.info('✅ Comprehensive testing completed');
      logger.info(`📊 Overall Score: ${this.testResults.overallScore.toFixed(2)}/100`);
      
      return report;
    } catch (error) {
      logger.error('❌ Comprehensive testing failed:', error);
      throw error;
    }
  }

  /**
   * Test document processing pipeline
   */
  async testDocumentProcessingPipeline() {
    logger.info('📄 Testing document processing pipeline...');
    
    const testStartTime = Date.now();
    
    // Create a test document
    const testDocument = await this.createTestDocument();
    
    try {
      // Process the test document
      const processingResult = await this.processingService.processDocument(
        testDocument.filePath,
        testDocument.sourceId,
        testDocument.version
      );
      
      // Evaluate processing results
      const evaluation = this.evaluateProcessingResults(processingResult);
      
      this.testResults.documentProcessing = {
        success: true,
        processingTime: processingResult.processing.totalTime,
        chunksGenerated: processingResult.processing.chunksGenerated,
        embeddingsCreated: processingResult.processing.embeddingsCreated,
        qualityScore: processingResult.quality.overallScore,
        evaluation: evaluation,
        testTime: Date.now() - testStartTime
      };
      
      logger.info(`✅ Document processing test completed: ${evaluation.score}/100`);
      
    } catch (error) {
      this.testResults.documentProcessing = {
        success: false,
        error: error.message,
        testTime: Date.now() - testStartTime
      };
      logger.error('❌ Document processing test failed:', error);
    } finally {
      // Clean up test document
      await this.cleanupTestDocument(testDocument);
    }
  }

  /**
   * Test chunking quality
   */
  async testChunkingQuality() {
    logger.info('🔪 Testing chunking quality...');
    
    const testStartTime = Date.now();
    
    try {
      // Test different chunking scenarios
      const scenarios = [
        { name: 'Simple Text', content: this.generateSimpleText() },
        { name: 'Complex Structure', content: this.generateComplexStructuredText() },
        { name: 'Technical Content', content: this.generateTechnicalContent() },
        { name: 'Mixed Content', content: this.generateMixedContent() }
      ];
      
      const chunkingResults = [];
      
      for (const scenario of scenarios) {
        const testDoc = this.createMockDocument(scenario.content, scenario.name);
        const chunkingResult = await this.processingService.hierarchicalChunker
          .chunkDocumentHierarchically(testDoc);
        
        const qualityAssessment = this.assessChunkingQuality(chunkingResult, scenario);
        chunkingResults.push({
          scenario: scenario.name,
          chunksGenerated: chunkingResult.chunks.length,
          averageQuality: qualityAssessment.averageQuality,
          hierarchyDepth: chunkingResult.metadata.hierarchyDepth,
          qualityAssessment
        });
      }
      
      this.testResults.chunkingQuality = {
        success: true,
        scenarios: chunkingResults,
        overallScore: this.calculateChunkingScore(chunkingResults),
        testTime: Date.now() - testStartTime
      };
      
      logger.info(`✅ Chunking quality test completed: ${this.testResults.chunkingQuality.overallScore}/100`);
      
    } catch (error) {
      this.testResults.chunkingQuality = {
        success: false,
        error: error.message,
        testTime: Date.now() - testStartTime
      };
      logger.error('❌ Chunking quality test failed:', error);
    }
  }

  /**
   * Test embedding quality
   */
  async testEmbeddingQuality() {
    logger.info('🎯 Testing embedding quality...');
    
    const testStartTime = Date.now();
    
    try {
      // Create test chunks for embedding
      const testChunks = this.createTestChunks();
      
      // Generate embeddings
      const embeddingResults = await this.processingService.embeddingGenerator
        .batchGenerateEmbeddings(testChunks);
      
      // Evaluate embedding quality
      const qualityEvaluation = this.evaluateEmbeddingQuality(embeddingResults);
      
      this.testResults.embeddingQuality = {
        success: true,
        chunksProcessed: embeddingResults.length,
        embeddingTypes: this.countEmbeddingTypes(embeddingResults),
        averageQuality: qualityEvaluation.averageQuality,
        qualityDistribution: qualityEvaluation.qualityDistribution,
        evaluation: qualityEvaluation,
        testTime: Date.now() - testStartTime
      };
      
      logger.info(`✅ Embedding quality test completed: ${qualityEvaluation.score}/100`);
      
    } catch (error) {
      this.testResults.embeddingQuality = {
        success: false,
        error: error.message,
        testTime: Date.now() - testStartTime
      };
      logger.error('❌ Embedding quality test failed:', error);
    }
  }

  /**
   * Test retrieval performance
   */
  async testRetrievalPerformance() {
    logger.info('🔍 Testing retrieval performance...');
    
    const testStartTime = Date.now();
    
    try {
      // Test queries with different characteristics
      const testQueries = [
        { query: 'What is NAV calculation?', type: 'definition', expectedRelevance: 0.8 },
        { query: 'How to create a new fund?', type: 'procedure', expectedRelevance: 0.7 },
        { query: 'Fund compliance requirements', type: 'list', expectedRelevance: 0.75 },
        { query: 'Portfolio valuation methods comparison', type: 'comparison', expectedRelevance: 0.7 }
      ];
      
      const retrievalResults = [];
      
      for (const testQuery of testQueries) {
        const startTime = Date.now();
        
        const retrievalResult = await this.contextualRetriever.retrieveWithAdvancedContext(
          testQuery.query,
          {},
          { maxResults: 5 }
        );
        
        const retrievalTime = Date.now() - startTime;
        const performance = this.evaluateRetrievalPerformance(retrievalResult, testQuery);
        
        retrievalResults.push({
          query: testQuery.query,
          type: testQuery.type,
          retrievalTime,
          chunksRetrieved: retrievalResult.chunks.length,
          confidence: retrievalResult.confidence,
          performance
        });
      }
      
      this.testResults.retrievalPerformance = {
        success: true,
        queries: retrievalResults,
        averageRetrievalTime: retrievalResults.reduce((sum, r) => sum + r.retrievalTime, 0) / retrievalResults.length,
        averageConfidence: retrievalResults.reduce((sum, r) => sum + r.confidence, 0) / retrievalResults.length,
        overallScore: this.calculateRetrievalScore(retrievalResults),
        testTime: Date.now() - testStartTime
      };
      
      logger.info(`✅ Retrieval performance test completed: ${this.testResults.retrievalPerformance.overallScore}/100`);
      
    } catch (error) {
      this.testResults.retrievalPerformance = {
        success: false,
        error: error.message,
        testTime: Date.now() - testStartTime
      };
      logger.error('❌ Retrieval performance test failed:', error);
    }
  }

  /**
   * Test context quality
   */
  async testContextQuality() {
    logger.info('📋 Testing context quality...');
    
    const testStartTime = Date.now();
    
    try {
      // Test context scenarios
      const contextScenarios = [
        {
          name: 'Single Query',
          query: 'What is fund creation process?',
          context: {}
        },
        {
          name: 'Conversational Context',
          query: 'What about compliance requirements?',
          context: {
            messageHistory: [
              { role: 'user', content: 'Tell me about fund creation' },
              { role: 'assistant', content: 'Fund creation involves several steps...' }
            ],
            currentTopic: 'fund creation'
          }
        },
        {
          name: 'Multi-turn Context',
          query: 'How does this affect portfolio management?',
          context: {
            messageHistory: [
              { role: 'user', content: 'What is NAV calculation?' },
              { role: 'assistant', content: 'NAV is calculated by...' },
              { role: 'user', content: 'What about fund valuation?' },
              { role: 'assistant', content: 'Fund valuation considers...' }
            ],
            recentTopics: ['NAV', 'valuation', 'portfolio']
          }
        }
      ];
      
      const contextResults = [];
      
      for (const scenario of contextScenarios) {
        const contextResult = await this.contextualRetriever.retrieveWithAdvancedContext(
          scenario.query,
          scenario.context,
          { maxResults: 5 }
        );
        
        const qualityAssessment = this.assessContextQuality(contextResult, scenario);
        
        contextResults.push({
          scenario: scenario.name,
          query: scenario.query,
          chunksRetrieved: contextResult.chunks.length,
          confidence: contextResult.confidence,
          qualityAssessment
        });
      }
      
      this.testResults.contextQuality = {
        success: true,
        scenarios: contextResults,
        overallScore: this.calculateContextScore(contextResults),
        testTime: Date.now() - testStartTime
      };
      
      logger.info(`✅ Context quality test completed: ${this.testResults.contextQuality.overallScore}/100`);
      
    } catch (error) {
      this.testResults.contextQuality = {
        success: false,
        error: error.message,
        testTime: Date.now() - testStartTime
      };
      logger.error('❌ Context quality test failed:', error);
    }
  }

  /**
   * Test end-to-end integration
   */
  async testEndToEndIntegration() {
    logger.info('🔄 Testing end-to-end integration...');
    
    const testStartTime = Date.now();
    
    try {
      // Create a comprehensive test document
      const testDoc = await this.createComprehensiveTestDocument();
      
      // Process document through entire pipeline
      const processingResult = await this.processingService.processDocument(
        testDoc.filePath,
        testDoc.sourceId,
        testDoc.version
      );
      
      // Test retrieval on processed document
      const testQuery = 'What are the key fund management processes?';
      const retrievalResult = await this.contextualRetriever.retrieveWithAdvancedContext(
        testQuery,
        {},
        { maxResults: 5 }
      );
      
      // Evaluate end-to-end performance
      const integrationEvaluation = this.evaluateEndToEndIntegration(
        processingResult,
        retrievalResult,
        testQuery
      );
      
      this.testResults.endToEndIntegration = {
        success: true,
        processingTime: processingResult.processing.totalTime,
        retrievalTime: retrievalResult.metadata.totalRetrievalTime,
        totalChunks: processingResult.processing.chunksGenerated,
        retrievedChunks: retrievalResult.chunks.length,
        overallQuality: integrationEvaluation.overallQuality,
        evaluation: integrationEvaluation,
        testTime: Date.now() - testStartTime
      };
      
      logger.info(`✅ End-to-end integration test completed: ${integrationEvaluation.score}/100`);
      
      // Clean up
      await this.cleanupTestDocument(testDoc);
      
    } catch (error) {
      this.testResults.endToEndIntegration = {
        success: false,
        error: error.message,
        testTime: Date.now() - testStartTime
      };
      logger.error('❌ End-to-end integration test failed:', error);
    }
  }

  // Helper methods for test data generation and evaluation

  /**
   * Create test document
   */
  async createTestDocument() {
    const testContent = `
# Fund Management Guide

## Introduction
This document provides comprehensive guidance on fund management processes and procedures.

## Fund Creation Process
Creating a new fund involves several key steps:

1. **Initial Planning**: Define fund objectives and strategy
2. **Regulatory Compliance**: Ensure all regulatory requirements are met
3. **Documentation**: Prepare necessary legal documents
4. **Launch**: Execute the fund launch process

### NAV Calculation
Net Asset Value (NAV) is calculated using the following formula:
NAV = (Total Assets - Total Liabilities) / Number of Outstanding Shares

### Portfolio Management
Portfolio management involves:
- Asset allocation
- Risk management
- Performance monitoring
- Rebalancing strategies

## Compliance Requirements
All funds must comply with:
- SEC regulations
- Internal policies
- Audit requirements
- Reporting standards

## Conclusion
Effective fund management requires attention to all these processes.
    `;
    
    const testDoc = {
      filePath: path.join(__dirname, '../temp/test-document.md'),
      sourceId: 'test-doc-001',
      version: '1.0',
      content: testContent
    };
    
    // Ensure temp directory exists
    await fs.ensureDir(path.dirname(testDoc.filePath));
    
    // Write test document
    await fs.writeFile(testDoc.filePath, testContent);
    
    return testDoc;
  }

  /**
   * Create comprehensive test document
   */
  async createComprehensiveTestDocument() {
    const comprehensiveContent = `
# Advanced Fund Management Handbook

## Table of Contents
1. Fund Structure and Organization
2. Investment Processes
3. Risk Management Framework
4. Compliance and Regulatory Requirements
5. Performance Measurement and Reporting

## 1. Fund Structure and Organization

### 1.1 Fund Types
Investment funds can be categorized into several types:
- **Mutual Funds**: Open-end investment companies
- **Hedge Funds**: Alternative investment vehicles
- **Private Equity Funds**: Long-term investment partnerships
- **Exchange-Traded Funds (ETFs)**: Tradeable index funds

### 1.2 Organizational Structure
The typical fund organization includes:
- Investment Manager
- Board of Directors
- Custodian Bank
- Transfer Agent
- Independent Auditor

## 2. Investment Processes

### 2.1 Investment Strategy Development
Developing an investment strategy involves:
1. Market analysis and research
2. Risk-return objectives definition
3. Asset allocation framework
4. Security selection criteria

### 2.2 Portfolio Construction
Portfolio construction follows these principles:
- Diversification across asset classes
- Risk budgeting and allocation
- Liquidity management
- Cost optimization

### 2.3 NAV Calculation Process
The Net Asset Value calculation is performed daily:

**Formula**: NAV = (Market Value of Assets - Liabilities) / Outstanding Shares

**Components**:
- Market value of securities
- Accrued income and expenses
- Cash and cash equivalents
- Outstanding liabilities

## 3. Risk Management Framework

### 3.1 Risk Identification
Key risk categories include:
- Market Risk: Price volatility and market movements
- Credit Risk: Counterparty default risk
- Liquidity Risk: Ability to meet redemption requests
- Operational Risk: Process and system failures

### 3.2 Risk Measurement
Risk is measured using various metrics:
- Value at Risk (VaR)
- Expected Shortfall (ES)
- Beta and correlation analysis
- Stress testing scenarios

### 3.3 Risk Monitoring and Control
Continuous monitoring involves:
- Daily risk reporting
- Limit monitoring and alerts
- Scenario analysis
- Regular risk committee meetings

## 4. Compliance and Regulatory Requirements

### 4.1 Regulatory Framework
Funds must comply with:
- Investment Company Act of 1940
- Securities Act of 1933
- Securities Exchange Act of 1934
- Sarbanes-Oxley Act

### 4.2 Compliance Monitoring
Key compliance activities:
- Investment restriction monitoring
- Disclosure requirements
- Shareholder reporting
- Regulatory filings

### 4.3 Audit and Examination
Regular audits cover:
- Financial statement audits
- Compliance examinations
- Internal control assessments
- Operational reviews

## 5. Performance Measurement and Reporting

### 5.1 Performance Calculation
Performance metrics include:
- Total return calculation
- Risk-adjusted returns (Sharpe ratio, Alpha, Beta)
- Benchmark comparison
- Attribution analysis

### 5.2 Reporting Requirements
Regular reports include:
- Daily NAV reports
- Monthly performance summaries
- Quarterly investor reports
- Annual audited financial statements

### 5.3 Performance Attribution
Attribution analysis breaks down returns by:
- Asset allocation effects
- Security selection effects
- Interaction effects
- Currency effects (for international funds)

## Appendices

### Appendix A: Regulatory References
- SEC Rule 2a-7 (Money Market Funds)
- SEC Rule 12b-1 (Distribution Fees)
- SEC Rule 22c-1 (Pricing of Redeemable Securities)

### Appendix B: Industry Best Practices
- CFA Institute standards
- GIPS compliance guidelines
- AIMR performance presentation standards

### Appendix C: Glossary of Terms
- **Alpha**: Excess return over benchmark
- **Beta**: Systematic risk measure
- **Duration**: Interest rate sensitivity measure
- **Sharpe Ratio**: Risk-adjusted return metric
    `;
    
    const testDoc = {
      filePath: path.join(__dirname, '../temp/comprehensive-test-document.md'),
      sourceId: 'comprehensive-test-001',
      version: '1.0',
      content: comprehensiveContent
    };
    
    await fs.ensureDir(path.dirname(testDoc.filePath));
    await fs.writeFile(testDoc.filePath, comprehensiveContent);
    
    return testDoc;
  }

  /**
   * Generate simple text for testing
   */
  generateSimpleText() {
    return `
This is a simple text document for testing basic chunking functionality.
It contains several paragraphs with straightforward content.

The first paragraph introduces the topic and provides basic information.
This helps test how the chunker handles simple, linear text structure.

The second paragraph continues the discussion with additional details.
It maintains the same simple structure and writing style.

The final paragraph concludes the document with summary information.
This tests the chunker's ability to identify document boundaries.
    `;
  }

  /**
   * Generate complex structured text
   */
  generateComplexStructuredText() {
    return `
# Complex Document Structure

## Section 1: Introduction
This section provides an overview of the complex document structure.

### 1.1 Subsection A
Detailed information about subsection A.

#### 1.1.1 Sub-subsection
Even more detailed information at the third level.

### 1.2 Subsection B
Information about subsection B with different content.

## Section 2: Main Content

### 2.1 Lists and Tables
Here is a list:
- Item 1
- Item 2
- Item 3

And here is a table:
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value A  | Value B  | Value C  |
| Value D  | Value E  | Value F  |

### 2.2 Code Blocks
\`\`\`javascript
function example() {
    return "This is code";
}
\`\`\`

## Section 3: Conclusion
Final thoughts and summary of the complex structure.
    `;
  }

  /**
   * Generate technical content
   */
  generateTechnicalContent() {
    return `
# Technical Fund Management Specifications

## NAV Calculation Algorithm
The Net Asset Value (NAV) calculation follows this algorithm:

1. Calculate total market value of securities
2. Add accrued income and cash equivalents
3. Subtract total liabilities and accrued expenses
4. Divide by number of outstanding shares

Formula: NAV = (TMV + AI + CE - TL - AE) / OS

Where:
- TMV = Total Market Value
- AI = Accrued Income
- CE = Cash Equivalents
- TL = Total Liabilities
- AE = Accrued Expenses
- OS = Outstanding Shares

## Risk Metrics
Key risk metrics include:
- VaR (Value at Risk): 95% confidence level
- Expected Shortfall: Conditional VaR
- Beta: Systematic risk relative to benchmark
- Tracking Error: Standard deviation of excess returns

## Compliance Rules
Investment restrictions:
- Maximum 5% in any single security
- Maximum 25% in any single sector
- Minimum 80% in fund's stated asset class
- Liquidity requirement: 15% in liquid assets
    `;
  }

  /**
   * Generate mixed content
   */
  generateMixedContent() {
    return `
# Mixed Content Document

This document contains various types of content to test chunking versatility.

## Text Section
Regular paragraph text with standard formatting and structure.
This section tests basic text processing capabilities.

## List Section
Key points to remember:
1. First important point
2. Second critical item
3. Third essential element

## Table Section
| Metric | Value | Threshold |
|--------|-------|-----------|
| NAV    | $10.50| $10.00    |
| AUM    | $100M | $50M      |

## Code Section
\`\`\`python
def calculate_nav(assets, liabilities, shares):
    return (assets - liabilities) / shares
\`\`\`

## Definition Section
**Net Asset Value (NAV)**: The per-share value of a mutual fund or ETF, calculated by dividing the total value of assets minus liabilities by the number of outstanding shares.

## Conclusion
This mixed content tests the chunker's ability to handle diverse content types within a single document.
    `;
  }

  /**
   * Create mock document object
   */
  createMockDocument(content, title) {
    return {
      sourceId: `mock-${Date.now()}`,
      version: '1.0',
      fileName: `${title.toLowerCase().replace(/\s+/g, '-')}.md`,
      content: content,
      title: title,
      characterCount: content.length,
      wordCount: content.split(/\s+/).length,
      language: 'en',
      qualityScore: 0.8
    };
  }

  /**
   * Create test chunks for embedding testing
   */
  createTestChunks() {
    return [
      {
        chunkIndex: 0,
        content: 'Net Asset Value (NAV) is calculated by dividing the total value of fund assets minus liabilities by the number of outstanding shares.',
        scale: 'paragraph',
        tokenCount: 25,
        qualityScore: 0.8,
        topicKeywords: ['NAV', 'assets', 'liabilities', 'shares'],
        metadata: { semanticType: 'definition' }
      },
      {
        chunkIndex: 1,
        content: 'Fund creation process involves initial planning, regulatory compliance, documentation preparation, and launch execution.',
        scale: 'paragraph',
        tokenCount: 18,
        qualityScore: 0.75,
        topicKeywords: ['fund', 'creation', 'planning', 'compliance'],
        metadata: { semanticType: 'procedure' }
      },
      {
        chunkIndex: 2,
        content: 'Portfolio management includes asset allocation, risk management, performance monitoring, and rebalancing strategies.',
        scale: 'paragraph',
        tokenCount: 16,
        qualityScore: 0.85,
        topicKeywords: ['portfolio', 'management', 'allocation', 'risk'],
        metadata: { semanticType: 'list' }
      }
    ];
  }

  // Evaluation methods

  /**
   * Evaluate processing results
   */
  evaluateProcessingResults(result) {
    let score = 0;
    const evaluation = {};
    
    // Processing success (20 points)
    if (result.success) {
      score += 20;
      evaluation.processingSuccess = true;
    }
    
    // Processing time (20 points)
    const processingTime = result.processing.totalTime;
    if (processingTime < 5000) score += 20;
    else if (processingTime < 10000) score += 15;
    else if (processingTime < 20000) score += 10;
    else score += 5;
    evaluation.processingTimeScore = Math.min(20, Math.max(5, 25 - processingTime / 1000));
    
    // Chunks generated (20 points)
    const chunksGenerated = result.processing.chunksGenerated;
    if (chunksGenerated > 10) score += 20;
    else if (chunksGenerated > 5) score += 15;
    else if (chunksGenerated > 2) score += 10;
    else score += 5;
    evaluation.chunksScore = Math.min(20, chunksGenerated * 2);
    
    // Quality score (20 points)
    const qualityScore = result.quality.overallScore;
    score += qualityScore * 20;
    evaluation.qualityScore = qualityScore * 20;
    
    // Embeddings created (20 points)
    const embeddingsCreated = result.processing.embeddingsCreated;
    if (embeddingsCreated > 20) score += 20;
    else if (embeddingsCreated > 10) score += 15;
    else if (embeddingsCreated > 5) score += 10;
    else score += 5;
    evaluation.embeddingsScore = Math.min(20, embeddingsCreated);
    
    evaluation.score = Math.min(100, score);
    return evaluation;
  }

  /**
   * Assess chunking quality
   */
  assessChunkingQuality(chunkingResult, scenario) {
    const chunks = chunkingResult.chunks;
    let totalQuality = 0;
    let validChunks = 0;
    
    chunks.forEach(chunk => {
      if (chunk.qualityScore > 0.3) {
        totalQuality += chunk.qualityScore;
        validChunks++;
      }
    });
    
    const averageQuality = validChunks > 0 ? totalQuality / validChunks : 0;
    
    return {
      averageQuality,
      validChunks,
      totalChunks: chunks.length,
      hierarchyDepth: chunkingResult.metadata.hierarchyDepth,
      score: averageQuality * 100
    };
  }

  /**
   * Evaluate embedding quality
   */
  evaluateEmbeddingQuality(embeddingResults) {
    let totalQuality = 0;
    let qualityCount = 0;
    const qualityDistribution = { high: 0, medium: 0, low: 0 };
    
    embeddingResults.forEach(chunk => {
      if (chunk.embeddings && chunk.embeddings.qualityScore) {
        totalQuality += chunk.embeddings.qualityScore;
        qualityCount++;
        
        if (chunk.embeddings.qualityScore >= 0.8) qualityDistribution.high++;
        else if (chunk.embeddings.qualityScore >= 0.6) qualityDistribution.medium++;
        else qualityDistribution.low++;
      }
    });
    
    const averageQuality = qualityCount > 0 ? totalQuality / qualityCount : 0;
    
    return {
      averageQuality,
      qualityDistribution,
      score: averageQuality * 100
    };
  }

  /**
   * Evaluate retrieval performance
   */
  evaluateRetrievalPerformance(retrievalResult, testQuery) {
    let score = 0;
    
    // Retrieval success (25 points)
    if (retrievalResult.chunks.length > 0) {
      score += 25;
    }
    
    // Confidence score (25 points)
    score += retrievalResult.confidence * 25;
    
    // Retrieval time (25 points)
    const retrievalTime = retrievalResult.metadata.totalRetrievalTime;
    if (retrievalTime < 1000) score += 25;
    else if (retrievalTime < 2000) score += 20;
    else if (retrievalTime < 5000) score += 15;
    else score += 10;
    
    // Relevance assessment (25 points)
    const relevanceScore = this.assessRelevance(retrievalResult.chunks, testQuery.query);
    score += relevanceScore * 25;
    
    return {
      score: Math.min(100, score),
      confidence: retrievalResult.confidence,
      retrievalTime,
      relevanceScore
    };
  }

  /**
   * Assess context quality
   */
  assessContextQuality(contextResult, scenario) {
    let score = 0;
    
    // Context utilization (40 points)
    if (scenario.context && Object.keys(scenario.context).length > 0) {
      if (contextResult.chunks.length > 0) score += 40;
    } else {
      score += 20; // Partial credit for no context scenarios
    }
    
    // Confidence score (30 points)
    score += contextResult.confidence * 30;
    
    // Chunk diversity (30 points)
    const diversity = this.calculateChunkDiversity(contextResult.chunks);
    score += diversity * 30;
    
    return {
      score: Math.min(100, score),
      confidence: contextResult.confidence,
      diversity
    };
  }

  /**
   * Evaluate end-to-end integration
   */
  evaluateEndToEndIntegration(processingResult, retrievalResult, testQuery) {
    let score = 0;
    
    // Processing success (30 points)
    if (processingResult.success) score += 30;
    
    // Retrieval success (30 points)
    if (retrievalResult.chunks.length > 0) score += 30;
    
    // Overall quality (40 points)
    const overallQuality = (processingResult.quality.overallScore + retrievalResult.confidence) / 2;
    score += overallQuality * 40;
    
    return {
      score: Math.min(100, score),
      overallQuality,
      processingSuccess: processingResult.success,
      retrievalSuccess: retrievalResult.chunks.length > 0
    };
  }

  // Utility methods

  /**
   * Calculate chunking score
   */
  calculateChunkingScore(chunkingResults) {
    const totalScore = chunkingResults.reduce((sum, result) => sum + result.qualityAssessment.score, 0);
    return totalScore / chunkingResults.length;
  }

  /**
   * Calculate retrieval score
   */
  calculateRetrievalScore(retrievalResults) {
    const totalScore = retrievalResults.reduce((sum, result) => sum + result.performance.score, 0);
    return totalScore / retrievalResults.length;
  }

  /**
   * Calculate context score
   */
  calculateContextScore(contextResults) {
    const totalScore = contextResults.reduce((sum, result) => sum + result.qualityAssessment.score, 0);
    return totalScore / contextResults.length;
  }

  /**
   * Count embedding types
   */
  countEmbeddingTypes(embeddingResults) {
    const types = {};
    embeddingResults.forEach(chunk => {
      if (chunk.embeddings) {
        Object.keys(chunk.embeddings).forEach(type => {
          if (type !== 'qualityScore' && chunk.embeddings[type]?.vector) {
            types[type] = (types[type] || 0) + 1;
          }
        });
      }
    });
    return types;
  }

  /**
   * Assess relevance of chunks to query
   */
  assessRelevance(chunks, query) {
    if (chunks.length === 0) return 0;
    
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    let totalRelevance = 0;
    
    chunks.forEach(chunk => {
      const chunkWords = new Set(chunk.content.toLowerCase().split(/\s+/));
      const intersection = new Set([...queryWords].filter(word => chunkWords.has(word)));
      const relevance = intersection.size / queryWords.size;
      totalRelevance += relevance;
    });
    
    return totalRelevance / chunks.length;
  }

  /**
   * Calculate chunk diversity
   */
  calculateChunkDiversity(chunks) {
    if (chunks.length === 0) return 0;
    
    const sources = new Set(chunks.map(chunk => chunk.source_id));
    const contentTypes = new Set(chunks.map(chunk => chunk.content_type));
    
    const sourceDiversity = sources.size / chunks.length;
    const typeDiversity = contentTypes.size / Math.min(chunks.length, 4); // Max 4 content types
    
    return (sourceDiversity + typeDiversity) / 2;
  }

  /**
   * Calculate overall score
   */
  calculateOverallScore() {
    const scores = [];
    
    if (this.testResults.documentProcessing.success) {
      scores.push(this.testResults.documentProcessing.evaluation.score);
    }
    
    if (this.testResults.chunkingQuality.success) {
      scores.push(this.testResults.chunkingQuality.overallScore);
    }
    
    if (this.testResults.embeddingQuality.success) {
      scores.push(this.testResults.embeddingQuality.evaluation.score);
    }
    
    if (this.testResults.retrievalPerformance.success) {
      scores.push(this.testResults.retrievalPerformance.overallScore);
    }
    
    if (this.testResults.contextQuality.success) {
      scores.push(this.testResults.contextQuality.overallScore);
    }
    
    if (this.testResults.endToEndIntegration && this.testResults.endToEndIntegration.success) {
      scores.push(this.testResults.endToEndIntegration.evaluation.score);
    }
    
    this.testResults.overallScore = scores.length > 0 
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
      : 0;
  }

  /**
   * Generate test report
   */
  generateTestReport() {
    return {
      timestamp: new Date().toISOString(),
      overallScore: this.testResults.overallScore,
      testResults: this.testResults,
      summary: {
        testsRun: Object.keys(this.testResults).length - 1, // Exclude overallScore
        testsSuccessful: Object.values(this.testResults)
          .filter(result => typeof result === 'object' && result.success).length,
        averageScore: this.testResults.overallScore,
        recommendations: this.generateRecommendations()
      }
    };
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations() {
    const recommendations = [];
    
    if (this.testResults.overallScore < 70) {
      recommendations.push('Overall system performance needs improvement');
    }
    
    if (this.testResults.chunkingQuality.success && this.testResults.chunkingQuality.overallScore < 70) {
      recommendations.push('Chunking quality could be improved with better semantic boundary detection');
    }
    
    if (this.testResults.embeddingQuality.success && this.testResults.embeddingQuality.evaluation.score < 70) {
      recommendations.push('Embedding quality needs enhancement through better model selection or fine-tuning');
    }
    
    if (this.testResults.retrievalPerformance.success && this.testResults.retrievalPerformance.overallScore < 70) {
      recommendations.push('Retrieval performance can be improved with better indexing and query optimization');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('System performance is satisfactory. Consider minor optimizations for better efficiency.');
    }
    
    return recommendations;
  }

  /**
   * Clean up test document
   */
  async cleanupTestDocument(testDoc) {
    try {
      if (await fs.pathExists(testDoc.filePath)) {
        await fs.remove(testDoc.filePath);
      }
      
      // Also clean up from database if it was stored
      if (this.db) {
        await this.db.query('DELETE FROM kb_chunks WHERE source_id = $1', [testDoc.sourceId]);
        await this.db.query('DELETE FROM kb_sources WHERE source_id = $1', [testDoc.sourceId]);
      }
    } catch (error) {
      logger.warn('⚠️ Failed to cleanup test document:', error.message);
    }
  }
}

// Main execution
async function runTests() {
  const tester = new AdvancedDocumentProcessingTester();
  
  try {
    const report = await tester.runComprehensiveTests();
    
    console.log('\n📊 ADVANCED DOCUMENT PROCESSING TEST REPORT');
    console.log('='.repeat(50));
    console.log(`Overall Score: ${report.overallScore.toFixed(2)}/100`);
    console.log(`Tests Run: ${report.summary.testsRun}`);
    console.log(`Tests Successful: ${report.summary.testsSuccessful}`);
    console.log('\nRecommendations:');
    report.summary.recommendations.forEach(rec => console.log(`- ${rec}`));
    
    // Save detailed report
    const reportPath = path.join(__dirname, '../temp/test-report.json');
    await fs.ensureDir(path.dirname(reportPath));
    await fs.writeJson(reportPath, report, { spaces: 2 });
    console.log(`\nDetailed report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Export for use as module or run directly
if (require.main === module) {
  runTests();
}

module.exports = AdvancedDocumentProcessingTester;
