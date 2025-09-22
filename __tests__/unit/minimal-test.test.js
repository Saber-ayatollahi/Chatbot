/**
 * Minimal Test - Test only critical functionality without hanging
 */

describe('Minimal Critical Fixes Test', () => {
  
  test('should have correct vector dimensions', () => {
    const { getConfig } = require('../../config/environment');
    const config = getConfig();
    
    expect(config.get('vector.dimension')).toBe(3072);
    expect(config.get('openai.embeddingModel')).toBe('text-embedding-3-large');
  });

  test('should validate environment configuration', () => {
    // Test that validation method exists and works
    expect(() => {
      const { getConfig } = require('../../config/environment');
      getConfig(); // This should run validation
    }).not.toThrow();
  });

  test('should create database instance', () => {
    const { getDatabase } = require('../../config/database');
    const db = getDatabase();
    
    expect(db).toBeTruthy();
    expect(typeof db.initialize).toBe('function');
    expect(typeof db.query).toBe('function');
    expect(typeof db.healthCheck).toBe('function');
  });

  test('should have all critical files', () => {
    const fs = require('fs');
    
    const criticalFiles = [
      'config/environment.js',
      'config/database.js',
      'scripts/validateEnvironment.js',
      'database/migration_001_fix_vector_dimensions.sql'
    ];
    
    criticalFiles.forEach(file => {
      expect(fs.existsSync(file)).toBe(true);
    });
  });
  
});
