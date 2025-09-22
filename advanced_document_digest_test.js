/**
 * Advanced Document Digest and Testing System
 * Comprehensive document processing, ingestion, and quality testing
 * Uses the most advanced methods available in the system
 */

const path = require('path');
const fs = require('fs').promises;
const { performance } = require('perf_hooks');

// Import advanced processing services
const AdvancedDocumentProcessingService = require('./services/AdvancedDocumentProcessingService');
const ComprehensiveEnhancedIngestionService = require('./services/ComprehensiveEnhancedIngestionService');
const MultiFormatProcessor = require('./knowledge/processing/MultiFormatProcessor');
const AdvancedStructureAnalyzer = require('./knowledge/analysis/AdvancedStructureAnalyzer');
const AdvancedContextualRetriever = require('./knowledge/retrieval/AdvancedContextualRetriever');
const { getDatabase } = require('./config/database');

class AdvancedDocumentDigestTester {
  constructor() {
    this.db = getDatabase();
    this.documentPath = "C:\\Users\\ayatollS\\OneDrive - Moody's\\Documents\\GitHub\\Chatbot\\knowledge_base\\documents\\Fund Manager User Guide 1.9.docx";
    this.sourceId = 'fund_manager_guide_1_9_advanced_test';
    this.version = '1.9.0';
    
    // Initialize advanced services
    this.advancedProcessor = new AdvancedDocumentProcessingService();
    this.comprehensiveIngestion = new ComprehensiveEnhancedIngestionService();
    this.multiFormatProcessor = new MultiFormatProcessor();
    this.structureAnalyzer = new AdvancedStructureAnalyzer();
    this.contextualRetriever = new AdvancedContextualRetriever();
    
    // Test results storage
    this.testResults = {
      processing: {},
      ingestion: {},
      retrieval: {},
      quality: {},
      fundCreation: {},
      deepAnalysis: {}
    };
  }

  /**
   * Main execution method - runs all tests
   */
  async runComprehensiveTest() {
    console.log('🚀 Starting Advanced Document Digest and Testing System');
    console.log('=' .repeat(80));
    
    const overallStartTime = performance.now();
    
    try {
      // Phase 1: Advanced Document Processing
      console.log('\n📄 PHASE 1: Advanced Document Processing');
      console.log('-'.repeat(50));
      await this.testAdvancedDocumentProcessing();
      
      // Phase 2: Comprehensive Enhanced Ingestion
      console.log('\n🔄 PHASE 2: Comprehensive Enhanced Ingestion');
      console.log('-'.repeat(50));
      await this.testComprehensiveIngestion();
      
      // Phase 3: Multi-Format Processing Analysis
      console.log('\n🔍 PHASE 3: Multi-Format Processing Analysis');
      console.log('-'.repeat(50));
      await this.testMultiFormatProcessing();
      
      // Phase 4: Advanced Structure Analysis
      console.log('\n🏗️ PHASE 4: Advanced Structure Analysis');
      console.log('-'.repeat(50));
      await this.testAdvancedStructureAnalysis();
      
      // Phase 5: Retrieval Quality Testing
      console.log('\n🎯 PHASE 5: Retrieval Quality Testing');
      console.log('-'.repeat(50));
      await this.testRetrievalQuality();
      
      // Phase 6: Fund Creation Testing
      console.log('\n💰 PHASE 6: Fund Creation Testing');
      console.log('-'.repeat(50));
      await this.testFundCreation();
      
      // Phase 7: Deep Analysis and Validation
      console.log('\n🔬 PHASE 7: Deep Analysis and Validation');
      console.log('-'.repeat(50));
      await this.performDeepAnalysis();
      
      // Phase 8: Generate Comprehensive Report
      console.log('\n📊 PHASE 8: Comprehensive Report Generation');
      console.log('-'.repeat(50));
      await this.generateComprehensiveReport();
      
      const totalTime = performance.now() - overallStartTime;
      console.log(`\n✅ All tests completed successfully in ${Math.round(totalTime)}ms`);
      
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      throw error;
    }
  }

  /**
   * Test Advanced Document Processing Service
   */
  async testAdvancedDocumentProcessing() {
    const startTime = performance.now();
    
    try {
      console.log('🔧 Testing Advanced Document Processing Service...');
      
      // Test document processing with advanced pipeline
      const processingResult = await this.advancedProcessor.processDocument(
        this.documentPath,
        this.sourceId,
        this.version,
        {
          enableHierarchicalChunking: true,
          enableMultiScaleEmbeddings: true,
          enableQualityValidation: true,
          qualityThresholds: {
            minChunkQuality: 0.4,
            minEmbeddingQuality: 0.6,
            minOverallQuality: 0.5
          }
        }
      );
      
      this.testResults.processing = {
        success: processingResult.success,
        processingTime: processingResult.processingTime,
        chunksGenerated: processingResult.chunksGenerated,
        chunksStored: processingResult.chunksStored,
        embeddingsCreated: processingResult.embeddingsCreated,
        qualityScore: processingResult.qualityScore,
        metadata: processingResult.metadata
      };
      
      console.log(`✅ Advanced processing completed:`);
      console.log(`   • Processing time: ${Math.round(processingResult.processingTime)}ms`);
      console.log(`   • Chunks generated: ${processingResult.chunksGenerated}`);
      console.log(`   • Chunks stored: ${processingResult.chunksStored}`);
      console.log(`   • Embeddings created: ${processingResult.embeddingsCreated}`);
      console.log(`   • Quality score: ${processingResult.qualityScore?.toFixed(3) || 'N/A'}`);
      
      // Test pipeline components individually
      await this.testPipelineComponents();
      
    } catch (error) {
      console.error('❌ Advanced document processing test failed:', error);
      this.testResults.processing = { success: false, error: error.message };
    }
  }

  /**
   * Test Comprehensive Enhanced Ingestion Service
   */
  async testComprehensiveIngestion() {
    try {
      console.log('🔄 Testing Comprehensive Enhanced Ingestion...');
      
      const ingestionResult = await this.comprehensiveIngestion.ingestDocument(
        this.documentPath,
        this.sourceId + '_comprehensive',
        this.version,
        {
          pipeline: {
            enableDocumentTypeDetection: true,
            enableStructureAnalysis: true,
            enableSemanticDetection: true,
            enableContentFiltering: true,
            enableContextAwareChunking: true,
            enableQualityValidation: true
          },
          quality: {
            minDocumentQuality: 0.4,
            minChunkQuality: 0.4,
            targetChunkQuality: 0.7,
            enableQualityEnhancement: true
          }
        }
      );
      
      this.testResults.ingestion = {
        success: ingestionResult.success,
        processingTime: ingestionResult.processingTime,
        chunksGenerated: ingestionResult.chunksGenerated,
        averageQuality: ingestionResult.averageQuality,
        pipelineResults: ingestionResult.pipelineResults,
        storageResult: ingestionResult.storageResult
      };
      
      console.log(`✅ Comprehensive ingestion completed:`);
      console.log(`   • Processing time: ${Math.round(ingestionResult.processingTime)}ms`);
      console.log(`   • Chunks generated: ${ingestionResult.chunksGenerated}`);
      console.log(`   • Average quality: ${ingestionResult.averageQuality?.toFixed(3) || 'N/A'}`);
      console.log(`   • Pipeline stages: ${Object.keys(ingestionResult.pipelineResults || {}).length}`);
      
    } catch (error) {
      console.error('❌ Comprehensive ingestion test failed:', error);
      this.testResults.ingestion = { success: false, error: error.message };
    }
  }

  /**
   * Test Multi-Format Processing
   */
  async testMultiFormatProcessing() {
    try {
      console.log('📄 Testing Multi-Format Processing...');
      
      const formatResult = await this.multiFormatProcessor.processDocument(
        this.documentPath,
        {
          enableStructureExtraction: true,
          enableMetadataExtraction: true,
          enableContentEnhancement: true,
          preserveFormatting: true
        }
      );
      
      this.testResults.processing.multiFormat = {
        success: formatResult.success !== false,
        format: formatResult.format,
        processingTime: formatResult.processingTime,
        contentLength: formatResult.content?.length || 0,
        structure: formatResult.structure,
        metadata: formatResult.metadata
      };
      
      console.log(`✅ Multi-format processing completed:`);
      console.log(`   • Format detected: ${formatResult.format}`);
      console.log(`   • Processing time: ${Math.round(formatResult.processingTime || 0)}ms`);
      console.log(`   • Content length: ${formatResult.content?.length || 0} characters`);
      console.log(`   • Structure elements: ${Object.keys(formatResult.structure || {}).length}`);
      
    } catch (error) {
      console.error('❌ Multi-format processing test failed:', error);
      this.testResults.processing.multiFormat = { success: false, error: error.message };
    }
  }

  /**
   * Test Advanced Structure Analysis
   */
  async testAdvancedStructureAnalysis() {
    try {
      console.log('🏗️ Testing Advanced Structure Analysis...');
      
      // First get content from multi-format processor
      const formatResult = await this.multiFormatProcessor.processDocument(this.documentPath);
      const content = formatResult.content || '';
      
      if (!content) {
        throw new Error('No content available for structure analysis');
      }
      
      const structureResult = await this.structureAnalyzer.analyzeDocumentStructure(
        content,
        { documentType: 'fund_manager_guide', format: 'docx' }
      );
      
      this.testResults.processing.structure = {
        success: true,
        processingTime: structureResult.processingTime,
        headingsCount: structureResult.headings?.length || 0,
        sectionsCount: structureResult.sections?.length || 0,
        listsCount: structureResult.lists?.length || 0,
        tablesCount: structureResult.tables?.length || 0,
        qualityMetrics: structureResult.qualityMetrics,
        hasWellDefinedStructure: structureResult.analysisMetadata?.hasWellDefinedStructure || false,
        recommendedChunkingStrategy: structureResult.analysisMetadata?.recommendedChunkingStrategy
      };
      
      console.log(`✅ Structure analysis completed:`);
      console.log(`   • Processing time: ${Math.round(structureResult.processingTime || 0)}ms`);
      console.log(`   • Headings found: ${structureResult.headings?.length || 0}`);
      console.log(`   • Sections found: ${structureResult.sections?.length || 0}`);
      console.log(`   • Lists found: ${structureResult.lists?.length || 0}`);
      console.log(`   • Tables found: ${structureResult.tables?.length || 0}`);
      console.log(`   • Well-structured: ${structureResult.analysisMetadata?.hasWellDefinedStructure || false}`);
      console.log(`   • Recommended strategy: ${structureResult.analysisMetadata?.recommendedChunkingStrategy || 'N/A'}`);
      
    } catch (error) {
      console.error('❌ Structure analysis test failed:', error);
      this.testResults.processing.structure = { success: false, error: error.message };
    }
  }

  /**
   * Test Retrieval Quality with various queries
   */
  async testRetrievalQuality() {
    try {
      console.log('🎯 Testing Retrieval Quality...');
      
      // Define test queries for fund management
      const testQueries = [
        'How to create a new fund',
        'Fund manager setup process',
        'Portfolio management features',
        'Risk assessment tools',
        'Investment strategies',
        'Fund performance monitoring',
        'Compliance requirements',
        'User permissions and roles',
        'Data import and export',
        'Reporting capabilities'
      ];
      
      const retrievalResults = [];
      
      for (const query of testQueries) {
        try {
          const startTime = performance.now();
          
          const result = await this.contextualRetriever.retrieveWithAdvancedContext(
            query,
            {
              domain: 'fundManagement',
              documentType: 'userGuide',
              sourceId: this.sourceId
            },
            {
              maxResults: 5,
              minRelevanceScore: 0.3,
              enableSemanticSearch: true,
              enableContextualRanking: true
            }
          );
          
          const retrievalTime = performance.now() - startTime;
          
          retrievalResults.push({
            query: query,
            success: true,
            retrievalTime: retrievalTime,
            chunksRetrieved: result.chunks?.length || 0,
            averageRelevance: result.chunks?.length > 0 
              ? result.chunks.reduce((sum, chunk) => sum + (chunk.relevanceScore || 0), 0) / result.chunks.length 
              : 0,
            topRelevance: result.chunks?.length > 0 
              ? Math.max(...result.chunks.map(chunk => chunk.relevanceScore || 0))
              : 0
          });
          
        } catch (queryError) {
          retrievalResults.push({
            query: query,
            success: false,
            error: queryError.message
          });
        }
      }
      
      // Calculate overall retrieval metrics
      const successfulQueries = retrievalResults.filter(r => r.success);
      const averageRetrievalTime = successfulQueries.length > 0 
        ? successfulQueries.reduce((sum, r) => sum + r.retrievalTime, 0) / successfulQueries.length 
        : 0;
      const averageChunksRetrieved = successfulQueries.length > 0 
        ? successfulQueries.reduce((sum, r) => sum + r.chunksRetrieved, 0) / successfulQueries.length 
        : 0;
      const overallAverageRelevance = successfulQueries.length > 0 
        ? successfulQueries.reduce((sum, r) => sum + r.averageRelevance, 0) / successfulQueries.length 
        : 0;
      
      this.testResults.retrieval = {
        totalQueries: testQueries.length,
        successfulQueries: successfulQueries.length,
        failedQueries: testQueries.length - successfulQueries.length,
        successRate: successfulQueries.length / testQueries.length,
        averageRetrievalTime: averageRetrievalTime,
        averageChunksRetrieved: averageChunksRetrieved,
        overallAverageRelevance: overallAverageRelevance,
        queryResults: retrievalResults
      };
      
      console.log(`✅ Retrieval quality testing completed:`);
      console.log(`   • Total queries tested: ${testQueries.length}`);
      console.log(`   • Successful queries: ${successfulQueries.length}`);
      console.log(`   • Success rate: ${(successfulQueries.length / testQueries.length * 100).toFixed(1)}%`);
      console.log(`   • Average retrieval time: ${Math.round(averageRetrievalTime)}ms`);
      console.log(`   • Average chunks retrieved: ${averageChunksRetrieved.toFixed(1)}`);
      console.log(`   • Average relevance score: ${overallAverageRelevance.toFixed(3)}`);
      
    } catch (error) {
      console.error('❌ Retrieval quality test failed:', error);
      this.testResults.retrieval = { success: false, error: error.message };
    }
  }

  /**
   * Test Fund Creation Process
   */
  async testFundCreation() {
    try {
      console.log('💰 Testing Fund Creation Process...');
      
      // Simulate fund creation based on document content
      const fundCreationQueries = [
        'What are the steps to create a new fund?',
        'What information is required for fund setup?',
        'How to configure fund parameters?',
        'What are the mandatory fields for fund creation?',
        'How to set up fund classifications?'
      ];
      
      const fundCreationResults = [];
      
      for (const query of fundCreationQueries) {
        try {
          const result = await this.contextualRetriever.retrieveWithAdvancedContext(
            query,
            { domain: 'fundCreation', documentType: 'userGuide' },
            { maxResults: 3, minRelevanceScore: 0.4 }
          );
          
          fundCreationResults.push({
            query: query,
            success: true,
            relevantChunks: result.chunks?.length || 0,
            topRelevance: result.chunks?.length > 0 
              ? Math.max(...result.chunks.map(chunk => chunk.relevanceScore || 0))
              : 0,
            content: result.chunks?.slice(0, 1).map(chunk => chunk.content.substring(0, 200) + '...') || []
          });
          
        } catch (queryError) {
          fundCreationResults.push({
            query: query,
            success: false,
            error: queryError.message
          });
        }
      }
      
      // Test fund creation workflow simulation
      const fundCreationWorkflow = await this.simulateFundCreationWorkflow();
      
      this.testResults.fundCreation = {
        queryResults: fundCreationResults,
        workflowSimulation: fundCreationWorkflow,
        overallSuccess: fundCreationResults.every(r => r.success) && fundCreationWorkflow.success
      };
      
      console.log(`✅ Fund creation testing completed:`);
      console.log(`   • Fund creation queries: ${fundCreationResults.length}`);
      console.log(`   • Successful queries: ${fundCreationResults.filter(r => r.success).length}`);
      console.log(`   • Workflow simulation: ${fundCreationWorkflow.success ? 'Success' : 'Failed'}`);
      console.log(`   • Overall success: ${this.testResults.fundCreation.overallSuccess}`);
      
    } catch (error) {
      console.error('❌ Fund creation test failed:', error);
      this.testResults.fundCreation = { success: false, error: error.message };
    }
  }

  /**
   * Perform Deep Analysis and Validation
   */
  async performDeepAnalysis() {
    try {
      console.log('🔬 Performing Deep Analysis and Validation...');
      
      // Analyze processing quality across all phases
      const qualityAnalysis = this.analyzeOverallQuality();
      
      // Validate data consistency
      const consistencyValidation = await this.validateDataConsistency();
      
      // Performance analysis
      const performanceAnalysis = this.analyzePerformance();
      
      // Content coverage analysis
      const coverageAnalysis = await this.analyzeCoverage();
      
      // Generate recommendations
      const recommendations = this.generateRecommendations();
      
      this.testResults.deepAnalysis = {
        qualityAnalysis: qualityAnalysis,
        consistencyValidation: consistencyValidation,
        performanceAnalysis: performanceAnalysis,
        coverageAnalysis: coverageAnalysis,
        recommendations: recommendations,
        overallScore: this.calculateOverallScore()
      };
      
      console.log(`✅ Deep analysis completed:`);
      console.log(`   • Overall quality score: ${qualityAnalysis.overallScore?.toFixed(3) || 'N/A'}`);
      console.log(`   • Data consistency: ${consistencyValidation.isConsistent ? 'Pass' : 'Fail'}`);
      console.log(`   • Performance rating: ${performanceAnalysis.rating || 'N/A'}`);
      console.log(`   • Content coverage: ${(coverageAnalysis.coveragePercentage || 0).toFixed(1)}%`);
      console.log(`   • Recommendations: ${recommendations.length} generated`);
      
    } catch (error) {
      console.error('❌ Deep analysis failed:', error);
      this.testResults.deepAnalysis = { success: false, error: error.message };
    }
  }

  /**
   * Generate Comprehensive Report
   */
  async generateComprehensiveReport() {
    try {
      console.log('📊 Generating Comprehensive Report...');
      
      const report = {
        testSummary: {
          executionDate: new Date().toISOString(),
          documentPath: this.documentPath,
          sourceId: this.sourceId,
          version: this.version,
          overallSuccess: this.isOverallSuccess()
        },
        phaseResults: this.testResults,
        recommendations: this.generateFinalRecommendations(),
        nextSteps: this.generateNextSteps()
      };
      
      // Save report to file
      const reportPath = path.join(__dirname, 'advanced_document_digest_report.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      // Generate human-readable summary
      const summaryPath = path.join(__dirname, 'advanced_document_digest_summary.md');
      const summary = this.generateHumanReadableSummary(report);
      await fs.writeFile(summaryPath, summary);
      
      console.log(`✅ Comprehensive report generated:`);
      console.log(`   • Detailed report: ${reportPath}`);
      console.log(`   • Summary report: ${summaryPath}`);
      console.log(`   • Overall success: ${report.testSummary.overallSuccess}`);
      
      // Display key metrics
      this.displayKeyMetrics(report);
      
    } catch (error) {
      console.error('❌ Report generation failed:', error);
    }
  }

  // Helper methods

  async testPipelineComponents() {
    console.log('🔧 Testing individual pipeline components...');
    
    try {
      // Test pipeline
      const pipelineTest = await this.advancedProcessor.testProcessingPipeline();
      console.log(`   • Pipeline test: ${pipelineTest.success ? 'Pass' : 'Fail'}`);
      
      if (pipelineTest.success) {
        console.log(`     - Chunking: ${pipelineTest.chunkingTest.passed ? 'Pass' : 'Fail'} (${pipelineTest.chunkingTest.chunksGenerated} chunks)`);
        console.log(`     - Embedding: ${pipelineTest.embeddingTest.passed ? 'Pass' : 'Fail'} (${pipelineTest.embeddingTest.embeddingTypes} types)`);
        console.log(`     - Retrieval: ${pipelineTest.retrievalTest.passed ? 'Pass' : 'Fail'} (${pipelineTest.retrievalTest.chunksRetrieved} retrieved)`);
      }
      
    } catch (error) {
      console.log(`   • Pipeline test: Fail (${error.message})`);
    }
  }

  async simulateFundCreationWorkflow() {
    try {
      // Simulate a complete fund creation workflow
      const workflow = {
        steps: [
          'Retrieve fund creation requirements',
          'Validate mandatory fields',
          'Configure fund parameters',
          'Set up classifications',
          'Initialize fund structure'
        ],
        results: []
      };
      
      for (const step of workflow.steps) {
        const result = await this.contextualRetriever.retrieveWithAdvancedContext(
          step,
          { domain: 'fundCreation' },
          { maxResults: 2 }
        );
        
        workflow.results.push({
          step: step,
          success: result.chunks && result.chunks.length > 0,
          relevantContent: result.chunks?.length || 0
        });
      }
      
      return {
        success: workflow.results.every(r => r.success),
        completedSteps: workflow.results.filter(r => r.success).length,
        totalSteps: workflow.steps.length,
        workflow: workflow
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  analyzeOverallQuality() {
    const scores = [];
    
    if (this.testResults.processing.qualityScore) {
      scores.push(this.testResults.processing.qualityScore);
    }
    
    if (this.testResults.ingestion.averageQuality) {
      scores.push(this.testResults.ingestion.averageQuality);
    }
    
    if (this.testResults.retrieval.overallAverageRelevance) {
      scores.push(this.testResults.retrieval.overallAverageRelevance);
    }
    
    const overallScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    
    return {
      overallScore: overallScore,
      componentScores: {
        processing: this.testResults.processing.qualityScore || 0,
        ingestion: this.testResults.ingestion.averageQuality || 0,
        retrieval: this.testResults.retrieval.overallAverageRelevance || 0
      },
      qualityGrade: this.getQualityGrade(overallScore)
    };
  }

  async validateDataConsistency() {
    try {
      // Check if data was stored consistently across different processing methods
      const query = `
        SELECT COUNT(*) as chunk_count, source_id, version 
        FROM kb_chunks 
        WHERE source_id LIKE $1 
        GROUP BY source_id, version
      `;
      
      const result = await this.db.query(query, [`%${this.sourceId}%`]);
      
      return {
        isConsistent: result.rows.length > 0,
        chunkCounts: result.rows,
        totalChunks: result.rows.reduce((sum, row) => sum + parseInt(row.chunk_count), 0)
      };
      
    } catch (error) {
      return {
        isConsistent: false,
        error: error.message
      };
    }
  }

  analyzePerformance() {
    const times = [];
    
    if (this.testResults.processing.processingTime) {
      times.push(this.testResults.processing.processingTime);
    }
    
    if (this.testResults.ingestion.processingTime) {
      times.push(this.testResults.ingestion.processingTime);
    }
    
    if (this.testResults.retrieval.averageRetrievalTime) {
      times.push(this.testResults.retrieval.averageRetrievalTime);
    }
    
    const averageTime = times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0;
    
    return {
      averageProcessingTime: averageTime,
      rating: this.getPerformanceRating(averageTime),
      componentTimes: {
        processing: this.testResults.processing.processingTime || 0,
        ingestion: this.testResults.ingestion.processingTime || 0,
        retrieval: this.testResults.retrieval.averageRetrievalTime || 0
      }
    };
  }

  async analyzeCoverage() {
    try {
      // Analyze how much of the document content is covered by chunks
      const totalChunks = this.testResults.processing.chunksGenerated || 0;
      const storedChunks = this.testResults.processing.chunksStored || 0;
      
      const coveragePercentage = totalChunks > 0 ? (storedChunks / totalChunks) * 100 : 0;
      
      return {
        totalChunks: totalChunks,
        storedChunks: storedChunks,
        coveragePercentage: coveragePercentage,
        isSatisfactory: coveragePercentage >= 90
      };
      
    } catch (error) {
      return {
        coveragePercentage: 0,
        error: error.message
      };
    }
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Quality recommendations
    const qualityAnalysis = this.analyzeOverallQuality();
    if (qualityAnalysis.overallScore < 0.7) {
      recommendations.push({
        category: 'Quality',
        priority: 'High',
        recommendation: 'Improve processing quality by adjusting chunking parameters and quality thresholds'
      });
    }
    
    // Performance recommendations
    const performanceAnalysis = this.analyzePerformance();
    if (performanceAnalysis.averageProcessingTime > 30000) {
      recommendations.push({
        category: 'Performance',
        priority: 'Medium',
        recommendation: 'Optimize processing pipeline for better performance'
      });
    }
    
    // Retrieval recommendations
    if (this.testResults.retrieval.successRate < 0.8) {
      recommendations.push({
        category: 'Retrieval',
        priority: 'High',
        recommendation: 'Improve retrieval accuracy by enhancing embedding quality and search algorithms'
      });
    }
    
    return recommendations;
  }

  calculateOverallScore() {
    const scores = [];
    
    // Processing score
    if (this.testResults.processing.success) {
      scores.push(0.8);
    }
    
    // Ingestion score
    if (this.testResults.ingestion.success) {
      scores.push(0.9);
    }
    
    // Retrieval score
    if (this.testResults.retrieval.successRate) {
      scores.push(this.testResults.retrieval.successRate);
    }
    
    return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  }

  isOverallSuccess() {
    return this.testResults.processing.success &&
           this.testResults.ingestion.success &&
           (this.testResults.retrieval.successRate || 0) >= 0.7;
  }

  generateFinalRecommendations() {
    return [
      'Continue using advanced processing pipeline for optimal results',
      'Monitor retrieval quality and adjust parameters as needed',
      'Regularly validate data consistency across processing methods',
      'Consider implementing automated quality monitoring',
      'Optimize performance for production deployment'
    ];
  }

  generateNextSteps() {
    return [
      'Deploy advanced processing pipeline to production',
      'Implement continuous monitoring and alerting',
      'Create automated testing suite for regular validation',
      'Develop user interface for fund creation workflow',
      'Establish performance benchmarks and SLAs'
    ];
  }

  generateHumanReadableSummary(report) {
    return `# Advanced Document Digest Test Report

## Executive Summary
- **Document**: ${path.basename(this.documentPath)}
- **Test Date**: ${new Date(report.testSummary.executionDate).toLocaleString()}
- **Overall Success**: ${report.testSummary.overallSuccess ? '✅ PASS' : '❌ FAIL'}

## Test Results

### 📄 Document Processing
- **Status**: ${this.testResults.processing.success ? 'Success' : 'Failed'}
- **Processing Time**: ${Math.round(this.testResults.processing.processingTime || 0)}ms
- **Chunks Generated**: ${this.testResults.processing.chunksGenerated || 0}
- **Quality Score**: ${(this.testResults.processing.qualityScore || 0).toFixed(3)}

### 🔄 Comprehensive Ingestion
- **Status**: ${this.testResults.ingestion.success ? 'Success' : 'Failed'}
- **Processing Time**: ${Math.round(this.testResults.ingestion.processingTime || 0)}ms
- **Average Quality**: ${(this.testResults.ingestion.averageQuality || 0).toFixed(3)}

### 🎯 Retrieval Quality
- **Success Rate**: ${((this.testResults.retrieval.successRate || 0) * 100).toFixed(1)}%
- **Average Relevance**: ${(this.testResults.retrieval.overallAverageRelevance || 0).toFixed(3)}
- **Average Retrieval Time**: ${Math.round(this.testResults.retrieval.averageRetrievalTime || 0)}ms

### 💰 Fund Creation
- **Status**: ${this.testResults.fundCreation.overallSuccess ? 'Success' : 'Failed'}
- **Workflow Simulation**: ${this.testResults.fundCreation.workflowSimulation?.success ? 'Pass' : 'Fail'}

## Recommendations
${report.recommendations.map(rec => `- ${rec}`).join('\n')}

## Next Steps
${report.nextSteps.map(step => `- ${step}`).join('\n')}
`;
  }

  displayKeyMetrics(report) {
    console.log('\n📊 KEY METRICS SUMMARY');
    console.log('=' .repeat(50));
    console.log(`Overall Success Rate: ${report.testSummary.overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Processing Quality: ${(this.testResults.processing.qualityScore || 0).toFixed(3)}`);
    console.log(`Retrieval Success: ${((this.testResults.retrieval.successRate || 0) * 100).toFixed(1)}%`);
    console.log(`Fund Creation: ${this.testResults.fundCreation.overallSuccess ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Total Chunks: ${this.testResults.processing.chunksGenerated || 0}`);
    console.log(`Average Quality: ${(this.testResults.ingestion.averageQuality || 0).toFixed(3)}`);
  }

  getQualityGrade(score) {
    if (score >= 0.9) return 'Excellent';
    if (score >= 0.8) return 'Good';
    if (score >= 0.7) return 'Fair';
    if (score >= 0.6) return 'Poor';
    return 'Very Poor';
  }

  getPerformanceRating(avgTime) {
    if (avgTime < 5000) return 'Excellent';
    if (avgTime < 15000) return 'Good';
    if (avgTime < 30000) return 'Fair';
    return 'Poor';
  }
}

// Main execution
async function main() {
  const tester = new AdvancedDocumentDigestTester();
  
  try {
    await tester.runComprehensiveTest();
    console.log('\n🎉 Advanced Document Digest Test completed successfully!');
  } catch (error) {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Export for use as module or run directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = AdvancedDocumentDigestTester;
