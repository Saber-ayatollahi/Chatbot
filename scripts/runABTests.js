#!/usr/bin/env node

/**
 * Run A/B Tests Script
 * Executes A/B testing framework for different prompting strategies
 */

const path = require('path');
const logger = require('../utils/logger');
const ABTestingFramework = require('../evaluation/ABTestingFramework');

async function main() {
  try {
    console.log('🧪 Starting A/B Testing Framework...');
    console.log('===================================\n');
    console.log(`⏱️ Start Time: ${new Date().toISOString()}\n`);

    // Initialize A/B testing framework
    const abFramework = new ABTestingFramework();

    // Define experiment configurations
    const experiments = [
      {
        id: 'prompt_strategies',
        name: 'Prompt Strategy Comparison',
        description: 'Compare different prompt templates and strategies',
        variants: [
          {
            id: 'control',
            name: 'Control (Standard)',
            description: 'Current standard prompt template',
            config: {
              retrievalStrategy: 'hybrid',
              maxChunks: 5,
              citationFormat: 'inline',
              templateType: 'standard',
            }
          },
          {
            id: 'detailed',
            name: 'Detailed Instructions',
            description: 'More detailed prompt with explicit instructions',
            config: {
              retrievalStrategy: 'hybrid',
              maxChunks: 5,
              citationFormat: 'inline',
              templateType: 'detailed',
              promptTemplates: {
                standard: `You are a fund management expert assistant. Based on the provided context from official user guides, provide accurate and detailed answers.

CONTEXT:
{context}

INSTRUCTIONS:
1. Answer the question using ONLY the information from the provided context
2. Be specific and include all relevant details
3. Include proper citations in the format [Source: Document Name, Page X]
4. If the context doesn't contain enough information, clearly state what's missing
5. Use professional fund management terminology
6. Structure your response clearly with bullet points or numbered lists when appropriate

QUESTION: {question}

ANSWER:`
              }
            }
          },
          {
            id: 'concise',
            name: 'Concise Format',
            description: 'Shorter, more concise responses',
            config: {
              retrievalStrategy: 'hybrid',
              maxChunks: 3,
              citationFormat: 'numbered',
              templateType: 'concise',
              promptTemplates: {
                standard: `You are a fund management assistant. Provide concise, accurate answers based on the context.

CONTEXT: {context}

Provide a brief, direct answer to: {question}

Include citations as [1], [2], etc.`
              }
            }
          },
          {
            id: 'step_by_step',
            name: 'Step-by-Step',
            description: 'Structured step-by-step responses',
            config: {
              retrievalStrategy: 'hybrid',
              maxChunks: 5,
              citationFormat: 'inline',
              templateType: 'structured',
              promptTemplates: {
                standard: `You are a fund management expert. Provide structured, step-by-step answers.

CONTEXT:
{context}

QUESTION: {question}

Provide your answer in this format:
1. Brief overview
2. Step-by-step process (if applicable)
3. Key requirements or considerations
4. References to source documents

Use citations in format [Source: Document, Page X].`
              }
            }
          }
        ],
        testDataset: path.join(__dirname, '..', 'evaluation', 'golden_dataset.jsonl'),
        sampleSize: 50, // Reduced for CI/CD
        significanceLevel: 0.05,
        metrics: ['accuracy', 'citationPrecision', 'responseTime']
      },
      {
        id: 'retrieval_strategies',
        name: 'Retrieval Strategy Comparison',
        description: 'Compare different retrieval approaches',
        variants: [
          {
            id: 'semantic_only',
            name: 'Semantic Only',
            description: 'Pure semantic similarity search',
            config: {
              retrievalStrategy: 'semantic',
              maxChunks: 5,
              citationFormat: 'inline',
              templateType: 'standard',
            }
          },
          {
            id: 'keyword_only',
            name: 'Keyword Only',
            description: 'Pure keyword-based search',
            config: {
              retrievalStrategy: 'keyword',
              maxChunks: 5,
              citationFormat: 'inline',
              templateType: 'standard',
            }
          },
          {
            id: 'hybrid',
            name: 'Hybrid Approach',
            description: 'Combined semantic and keyword search',
            config: {
              retrievalStrategy: 'hybrid',
              maxChunks: 5,
              citationFormat: 'inline',
              templateType: 'standard',
            }
          }
        ],
        testDataset: path.join(__dirname, '..', 'evaluation', 'golden_dataset.jsonl'),
        sampleSize: 30,
        significanceLevel: 0.05,
        metrics: ['accuracy', 'citationPrecision', 'citationRecall', 'responseTime']
      }
    ];

    // Run experiments
    const experimentResults = [];

    for (const experimentConfig of experiments) {
      console.log(`\n🔬 Running experiment: ${experimentConfig.name}`);
      console.log(`📝 Description: ${experimentConfig.description}`);
      console.log(`🎯 Sample size: ${experimentConfig.sampleSize} per variant`);
      console.log(`📊 Variants: ${experimentConfig.variants.map(v => v.name).join(', ')}`);

      // Define and run experiment
      const experiment = abFramework.defineExperiment(experimentConfig.id, experimentConfig);
      const result = await abFramework.runExperiment(experimentConfig.id, {
        batchSize: 5,
      });

      experimentResults.push(result);

      // Display experiment results
      console.log(`\n✅ Experiment "${experimentConfig.name}" completed!`);
      console.log(`⏱️ Execution time: ${(result.executionTime / 1000).toFixed(2)}s`);
      
      // Show variant performance
      console.log('\n📊 Variant Performance:');
      result.variantResults.forEach(variantResult => {
        const metrics = variantResult.metrics;
        console.log(`  ${variantResult.variant.name}:`);
        console.log(`    Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
        console.log(`    Citation Precision: ${(metrics.citationPrecision * 100).toFixed(1)}%`);
        console.log(`    Pass Rate: ${(metrics.passRate * 100).toFixed(1)}%`);
        console.log(`    Avg Response Time: ${metrics.averageResponseTime.toFixed(0)}ms`);
      });

      // Show winner
      if (result.analysis.summary.bestVariant) {
        console.log(`\n🏆 Best Variant: ${result.analysis.summary.bestVariant.name}`);
        console.log(`   Accuracy: ${(result.analysis.summary.bestVariant.accuracy * 100).toFixed(1)}%`);
      }

      // Statistical significance
      const significantTests = result.analysis.statisticalSignificance.tests.filter(test => test.isSignificant);
      console.log(`\n📈 Statistically Significant Differences: ${significantTests.length}`);
      
      significantTests.forEach(test => {
        console.log(`  ${test.variantA} vs ${test.variantB}: ${test.winner} wins (p=${test.pValue.toFixed(4)})`);
      });

      // Save experiment results
      const outputDir = path.join(__dirname, '..', 'evaluation', 'ab_test_results');
      await abFramework.saveExperimentResults(experimentConfig.id, outputDir);
      console.log(`💾 Results saved to: ${outputDir}/${experimentConfig.id}_*`);
    }

    // Overall summary
    console.log('\n🎉 All A/B Tests Complete!');
    console.log('==========================');
    console.log(`📊 Total Experiments: ${experimentResults.length}`);
    
    const totalVariants = experimentResults.reduce((sum, result) => sum + result.variantResults.length, 0);
    console.log(`🧪 Total Variants Tested: ${totalVariants}`);

    const totalExecutionTime = experimentResults.reduce((sum, result) => sum + result.executionTime, 0);
    console.log(`⏱️ Total Execution Time: ${(totalExecutionTime / 1000).toFixed(2)}s`);

    // Best performers across all experiments
    console.log('\n🏆 Best Performers:');
    experimentResults.forEach(result => {
      const bestVariant = result.analysis.summary.bestVariant;
      if (bestVariant) {
        console.log(`  ${result.experiment.name}: ${bestVariant.name} (${(bestVariant.accuracy * 100).toFixed(1)}% accuracy)`);
      }
    });

    // Recommendations summary
    console.log('\n💡 Key Recommendations:');
    experimentResults.forEach(result => {
      const topRecommendation = result.analysis.recommendations.find(rec => rec.priority === 'high');
      if (topRecommendation) {
        console.log(`  ${result.experiment.name}: ${topRecommendation.recommendation}`);
      }
    });

    // Output JSON for CI/CD
    const ciOutput = {
      summary: {
        totalExperiments: experimentResults.length,
        totalVariants,
        totalExecutionTime,
        bestPerformers: experimentResults.map(result => ({
          experiment: result.experiment.name,
          bestVariant: result.analysis.summary.bestVariant?.name || 'N/A',
          bestAccuracy: result.analysis.summary.bestVariant?.accuracy || 0,
        })),
        significantResults: experimentResults.reduce((sum, result) => {
          return sum + result.analysis.statisticalSignificance.tests.filter(test => test.isSignificant).length;
        }, 0),
      },
      experiments: experimentResults.map(result => ({
        id: result.experimentId,
        name: result.experiment.name,
        bestVariant: result.analysis.summary.bestVariant,
        significantTests: result.analysis.statisticalSignificance.tests.filter(test => test.isSignificant).length,
        executionTime: result.executionTime,
      })),
      timestamp: new Date().toISOString(),
    };

    console.log('\n' + JSON.stringify(ciOutput, null, 2));

    console.log('\n✅ A/B testing completed successfully!');
    process.exit(0);

  } catch (error) {
    logger.error('❌ A/B testing failed:', error);
    console.error('\n💥 A/B testing failed:', error.message);
    process.exit(1);
  }
}

// Handle script interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️ A/B testing interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️ A/B testing terminated');
  process.exit(1);
});

// Run the script
main();
