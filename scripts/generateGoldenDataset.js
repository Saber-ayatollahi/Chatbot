#!/usr/bin/env node

/**
 * Generate Golden Dataset Script
 * Creates comprehensive Q&A pairs from User Guides for evaluation
 */

const path = require('path');
const logger = require('../utils/logger');
const GoldenDatasetGenerator = require('../evaluation/GoldenDatasetGenerator');

async function main() {
  try {
    console.log('🎯 Starting Golden Dataset Generation...');
    console.log('=====================================\n');

    // Configuration
    const userGuidePaths = [
      path.join(__dirname, '..', 'Fund_Manager_User_Guide_1.9.pdf'),
      path.join(__dirname, '..', 'Fund_Manager_User_Guide_v_1.9_MA_format.pdf'),
    ];

    const outputPath = path.join(__dirname, '..', 'evaluation', 'golden_dataset.jsonl');

    // Initialize generator
    const generator = new GoldenDatasetGenerator();

    // Generate dataset
    const startTime = Date.now();
    const dataset = await generator.generateGoldenDataset(userGuidePaths, outputPath);
    const duration = Date.now() - startTime;

    // Summary
    console.log('\n🎉 Golden Dataset Generation Complete!');
    console.log('=====================================');
    console.log(`📊 Total Q&A pairs generated: ${dataset.length}`);
    console.log(`⏱️ Generation time: ${(duration / 1000).toFixed(2)} seconds`);
    console.log(`📁 Dataset saved to: ${outputPath}`);

    // Category breakdown
    const categories = {};
    const difficulties = {};
    const testTypes = {};

    dataset.forEach(pair => {
      categories[pair.category] = (categories[pair.category] || 0) + 1;
      difficulties[pair.difficulty] = (difficulties[pair.difficulty] || 0) + 1;
      const testType = pair.test_type || 'standard';
      testTypes[testType] = (testTypes[testType] || 0) + 1;
    });

    console.log('\n📋 Dataset Breakdown:');
    console.log('Categories:', categories);
    console.log('Difficulties:', difficulties);
    console.log('Test Types:', testTypes);

    // Quality metrics
    const qualityScores = dataset
      .filter(pair => pair.quality_score)
      .map(pair => pair.quality_score);

    if (qualityScores.length > 0) {
      const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
      console.log(`\n⭐ Average Quality Score: ${(avgQuality * 100).toFixed(1)}%`);
    }

    console.log('\n✅ Golden dataset ready for evaluation!');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Golden dataset generation failed:', error);
    console.error('\n💥 Generation failed:', error.message);
    process.exit(1);
  }
}

// Handle script interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️ Generation interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️ Generation terminated');
  process.exit(1);
});

// Run the script
main();
