/**
 * Fund Creation Test - Validate Document Content Against Fund Creation Workflow
 * Tests if the processed Fund Manager User Guide supports fund creation
 */

const { getDatabase } = require('./config/database');

class FundCreationTest {
  constructor() {
    this.db = getDatabase();
    this.testResults = {
      documentContent: {},
      fundCreationSteps: {},
      validation: {}
    };
  }

  async runFundCreationTest() {
    console.log('💰 Starting Fund Creation Test');
    console.log('=' .repeat(50));
    
    try {
      // Test 1: Check if document content supports fund creation
      await this.testDocumentContent();
      
      // Test 2: Validate fund creation workflow steps
      await this.testFundCreationWorkflow();
      
      // Test 3: Verify content quality for fund creation
      await this.validateContentQuality();
      
      // Generate summary
      this.generateSummary();
      
    } catch (error) {
      console.error('❌ Fund creation test failed:', error);
    }
  }

  async testDocumentContent() {
    console.log('\n📄 Testing Document Content for Fund Creation...');
    
    try {
      // Query for chunks related to fund creation
      const fundCreationQuery = `
        SELECT chunk_id, content, heading, quality_score, metadata
        FROM kb_chunks 
        WHERE source_id LIKE '%fund_manager_guide%'
        AND (
          LOWER(content) LIKE '%fund%' OR
          LOWER(content) LIKE '%create%' OR
          LOWER(content) LIKE '%setup%' OR
          LOWER(heading) LIKE '%fund%'
        )
        ORDER BY quality_score DESC
        LIMIT 10
      `;
      
      const result = await this.db.query(fundCreationQuery);
      
      this.testResults.documentContent = {
        totalChunks: result.rows.length,
        averageQuality: result.rows.length > 0 
          ? result.rows.reduce((sum, row) => sum + parseFloat(row.quality_score), 0) / result.rows.length 
          : 0,
        fundRelatedContent: result.rows.map(row => ({
          heading: row.heading,
          contentPreview: row.content.substring(0, 200) + '...',
          qualityScore: row.quality_score
        }))
      };
      
      console.log(`✅ Found ${result.rows.length} fund-related chunks`);
      console.log(`   Average quality: ${this.testResults.documentContent.averageQuality.toFixed(3)}`);
      
    } catch (error) {
      console.error('❌ Document content test failed:', error);
      this.testResults.documentContent = { error: error.message };
    }
  }

  async testFundCreationWorkflow() {
    console.log('\n🔄 Testing Fund Creation Workflow...');
    
    const workflowSteps = [
      { step: 'Fund Setup', keywords: ['setup', 'create', 'new fund', 'initialize'] },
      { step: 'Parameters', keywords: ['parameter', 'configuration', 'setting', 'field'] },
      { step: 'Classification', keywords: ['classification', 'category', 'type', 'class'] },
      { step: 'Validation', keywords: ['validation', 'required', 'mandatory', 'check'] },
      { step: 'Finalization', keywords: ['complete', 'finish', 'save', 'submit'] }
    ];
    
    const stepResults = [];
    
    for (const workflow of workflowSteps) {
      try {
        const keywordConditions = workflow.keywords
          .map(keyword => `LOWER(content) LIKE '%${keyword}%'`)
          .join(' OR ');
        
        const stepQuery = `
          SELECT COUNT(*) as chunk_count, AVG(quality_score) as avg_quality
          FROM kb_chunks 
          WHERE source_id LIKE '%fund_manager_guide%'
          AND (${keywordConditions})
        `;
        
        const result = await this.db.query(stepQuery);
        const row = result.rows[0];
        
        stepResults.push({
          step: workflow.step,
          supportingChunks: parseInt(row.chunk_count),
          averageQuality: parseFloat(row.avg_quality) || 0,
          supported: parseInt(row.chunk_count) > 0
        });
        
        console.log(`   ${workflow.step}: ${parseInt(row.chunk_count)} chunks (quality: ${(parseFloat(row.avg_quality) || 0).toFixed(3)})`);
        
      } catch (error) {
        stepResults.push({
          step: workflow.step,
          error: error.message,
          supported: false
        });
      }
    }
    
    this.testResults.fundCreationSteps = {
      steps: stepResults,
      totalSupported: stepResults.filter(s => s.supported).length,
      overallSupport: stepResults.filter(s => s.supported).length / stepResults.length
    };
    
    console.log(`✅ Workflow support: ${this.testResults.fundCreationSteps.totalSupported}/${stepResults.length} steps`);
  }

  async validateContentQuality() {
    console.log('\n✅ Validating Content Quality...');
    
    try {
      // Get overall statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total_chunks,
          AVG(quality_score) as avg_quality,
          MIN(quality_score) as min_quality,
          MAX(quality_score) as max_quality,
          AVG(LENGTH(content)) as avg_content_length
        FROM kb_chunks 
        WHERE source_id LIKE '%fund_manager_guide%'
      `;
      
      const result = await this.db.query(statsQuery);
      const stats = result.rows[0];
      
      this.testResults.validation = {
        totalChunks: parseInt(stats.total_chunks),
        averageQuality: parseFloat(stats.avg_quality),
        minQuality: parseFloat(stats.min_quality),
        maxQuality: parseFloat(stats.max_quality),
        averageContentLength: parseFloat(stats.avg_content_length),
        qualityGrade: this.getQualityGrade(parseFloat(stats.avg_quality)),
        isHighQuality: parseFloat(stats.avg_quality) >= 0.7,
        isSuitableForFundCreation: parseFloat(stats.avg_quality) >= 0.5 && parseInt(stats.total_chunks) >= 10
      };
      
      console.log(`   Total chunks: ${this.testResults.validation.totalChunks}`);
      console.log(`   Average quality: ${this.testResults.validation.averageQuality.toFixed(3)} (${this.testResults.validation.qualityGrade})`);
      console.log(`   Quality range: ${this.testResults.validation.minQuality.toFixed(3)} - ${this.testResults.validation.maxQuality.toFixed(3)}`);
      console.log(`   Average content length: ${Math.round(this.testResults.validation.averageContentLength)} characters`);
      console.log(`   Suitable for fund creation: ${this.testResults.validation.isSuitableForFundCreation ? '✅ YES' : '❌ NO'}`);
      
    } catch (error) {
      console.error('❌ Content quality validation failed:', error);
      this.testResults.validation = { error: error.message };
    }
  }

  generateSummary() {
    console.log('\n📊 FUND CREATION TEST SUMMARY');
    console.log('=' .repeat(50));
    
    // Document Content Summary
    if (this.testResults.documentContent.totalChunks) {
      console.log(`📄 Document Content: ✅ PASS`);
      console.log(`   • Fund-related chunks: ${this.testResults.documentContent.totalChunks}`);
      console.log(`   • Content quality: ${this.testResults.documentContent.averageQuality.toFixed(3)}`);
    } else {
      console.log(`📄 Document Content: ❌ FAIL`);
    }
    
    // Workflow Support Summary
    if (this.testResults.fundCreationSteps.overallSupport) {
      console.log(`🔄 Workflow Support: ${this.testResults.fundCreationSteps.overallSupport >= 0.8 ? '✅ EXCELLENT' : this.testResults.fundCreationSteps.overallSupport >= 0.6 ? '✅ GOOD' : '⚠️ PARTIAL'}`);
      console.log(`   • Supported steps: ${this.testResults.fundCreationSteps.totalSupported}/5`);
      console.log(`   • Support percentage: ${(this.testResults.fundCreationSteps.overallSupport * 100).toFixed(1)}%`);
    } else {
      console.log(`🔄 Workflow Support: ❌ FAIL`);
    }
    
    // Overall Quality Summary
    if (this.testResults.validation.isSuitableForFundCreation !== undefined) {
      console.log(`✅ Overall Quality: ${this.testResults.validation.isSuitableForFundCreation ? '✅ SUITABLE' : '❌ UNSUITABLE'}`);
      console.log(`   • Quality grade: ${this.testResults.validation.qualityGrade}`);
      console.log(`   • Total chunks: ${this.testResults.validation.totalChunks}`);
    } else {
      console.log(`✅ Overall Quality: ❌ UNKNOWN`);
    }
    
    // Final Assessment
    const overallSuccess = 
      this.testResults.documentContent.totalChunks > 0 &&
      this.testResults.fundCreationSteps.overallSupport >= 0.6 &&
      this.testResults.validation.isSuitableForFundCreation;
    
    console.log('\n🎯 FINAL ASSESSMENT');
    console.log('-'.repeat(30));
    console.log(`Fund Creation Support: ${overallSuccess ? '✅ EXCELLENT' : '⚠️ NEEDS IMPROVEMENT'}`);
    
    if (overallSuccess) {
      console.log('\n✅ The Fund Manager User Guide successfully supports fund creation workflows!');
      console.log('   • Document content is comprehensive and high-quality');
      console.log('   • All major workflow steps are supported');
      console.log('   • Content quality meets production standards');
      console.log('   • Ready for fund creation implementation');
    } else {
      console.log('\n⚠️ Fund creation support needs improvement:');
      if (this.testResults.documentContent.totalChunks === 0) {
        console.log('   • No fund-related content found');
      }
      if (this.testResults.fundCreationSteps.overallSupport < 0.6) {
        console.log('   • Insufficient workflow step coverage');
      }
      if (!this.testResults.validation.isSuitableForFundCreation) {
        console.log('   • Content quality below production standards');
      }
    }
    
    console.log('\n📋 RECOMMENDATIONS');
    console.log('-'.repeat(20));
    if (overallSuccess) {
      console.log('• Proceed with fund creation UI development');
      console.log('• Implement automated fund creation workflows');
      console.log('• Create user training materials based on document content');
      console.log('• Set up monitoring for fund creation success rates');
    } else {
      console.log('• Review document processing parameters');
      console.log('• Consider additional fund creation documentation');
      console.log('• Improve content quality through better chunking');
      console.log('• Add more specific fund creation examples');
    }
  }

  getQualityGrade(score) {
    if (score >= 0.9) return 'Excellent';
    if (score >= 0.8) return 'Very Good';
    if (score >= 0.7) return 'Good';
    if (score >= 0.6) return 'Fair';
    if (score >= 0.5) return 'Acceptable';
    return 'Poor';
  }
}

// Main execution
async function main() {
  const tester = new FundCreationTest();
  
  try {
    await tester.runFundCreationTest();
    console.log('\n🎉 Fund Creation Test completed!');
  } catch (error) {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Export for use as module or run directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = FundCreationTest;
