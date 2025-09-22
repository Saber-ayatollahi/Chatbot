/**
 * Health Check Script
 * Comprehensive system health check for all Phase 1 components
 * Phase 1: Foundation & Infrastructure Setup
 */

const { initializeConfig } = require('../config/environment');
const { initializeDatabase } = require('../config/database');
const EmbeddingGenerator = require('../knowledge/embeddings/EmbeddingGenerator');
const logger = require('../utils/logger');

async function main() {
  const results = {
    timestamp: new Date().toISOString(),
    overall: 'unknown',
    components: {}
  };
  
  try {
    console.log('🏥 Starting comprehensive health check...');
    
    // 1. Configuration Health Check
    console.log('\n🔧 Checking configuration...');
    try {
      const config = initializeConfig();
      results.components.configuration = {
        status: 'healthy',
        environment: config.get('app.environment'),
        version: config.get('app.version'),
        database: {
          host: config.get('database.host'),
          port: config.get('database.port'),
          name: config.get('database.name')
        },
        openai: {
          configured: !!config.get('openai.apiKey'),
          model: config.get('openai.chatModel'),
          embeddingModel: config.get('openai.embeddingModel')
        }
      };
      console.log('✅ Configuration: Healthy');
    } catch (error) {
      results.components.configuration = {
        status: 'unhealthy',
        error: error.message
      };
      console.log('❌ Configuration: Failed -', error.message);
    }
    
    // 2. Database Health Check
    console.log('\n🗄️ Checking database connection...');
    try {
      const db = await initializeDatabase();
      const healthCheck = await db.healthCheck();
      
      results.components.database = {
        status: healthCheck.status,
        responseTime: healthCheck.responseTime,
        poolStats: healthCheck.poolStats
      };
      
      if (healthCheck.status === 'healthy') {
        console.log('✅ Database: Healthy');
        console.log(`  Response time: ${healthCheck.responseTime}`);
        console.log(`  Pool: ${healthCheck.poolStats.totalCount} total, ${healthCheck.poolStats.idleCount} idle`);
        
        // Check schema tables
        const tableCheck = await db.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name IN ('kb_sources', 'kb_chunks', 'conversations', 'feedback', 'audit_logs')
        `);
        
        results.components.database.tables = tableCheck.rows.map(row => row.table_name);
        console.log(`  Tables: ${results.components.database.tables.join(', ')}`);
        
        // Check pgvector extension
        const vectorCheck = await db.query(`
          SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') as has_vector
        `);
        
        results.components.database.pgvector = vectorCheck.rows[0].has_vector;
        console.log(`  pgvector: ${results.components.database.pgvector ? 'Available' : 'Missing'}`);
      } else {
        console.log('❌ Database: Unhealthy -', healthCheck.message);
      }
    } catch (error) {
      results.components.database = {
        status: 'unhealthy',
        error: error.message
      };
      console.log('❌ Database: Failed -', error.message);
    }
    
    // 3. OpenAI API Health Check
    console.log('\n🤖 Checking OpenAI API...');
    try {
      const embeddingGenerator = new EmbeddingGenerator();
      const testResult = await embeddingGenerator.testEmbeddingGeneration();
      
      results.components.openai = {
        status: testResult.success ? 'healthy' : 'unhealthy',
        responseTime: testResult.responseTime,
        model: testResult.model,
        embeddingDimension: testResult.embeddingDimension,
        expectedDimension: testResult.expectedDimension,
        tokensUsed: testResult.tokensUsed,
        error: testResult.error
      };
      
      if (testResult.success) {
        console.log('✅ OpenAI API: Healthy');
        console.log(`  Model: ${testResult.model}`);
        console.log(`  Response time: ${testResult.responseTime}ms`);
        console.log(`  Embedding dimension: ${testResult.embeddingDimension}`);
        console.log(`  Tokens used: ${testResult.tokensUsed}`);
      } else {
        console.log('❌ OpenAI API: Failed -', testResult.error);
      }
    } catch (error) {
      results.components.openai = {
        status: 'unhealthy',
        error: error.message
      };
      console.log('❌ OpenAI API: Failed -', error.message);
    }
    
    // 4. Knowledge Base Statistics
    console.log('\n📚 Checking knowledge base...');
    try {
      if (results.components.database?.status === 'healthy') {
        const db = await initializeDatabase();
        
        const [sourceStats, chunkStats, embeddingStats] = await Promise.all([
          db.query('SELECT COUNT(*) as count, processing_status FROM kb_sources GROUP BY processing_status'),
          db.query('SELECT COUNT(*) as count, AVG(quality_score) as avg_quality FROM kb_chunks'),
          db.query('SELECT COUNT(*) as count FROM embedding_cache')
        ]);
        
        results.components.knowledgeBase = {
          status: 'healthy',
          sources: sourceStats.rows.reduce((acc, row) => {
            acc[row.processing_status] = parseInt(row.count);
            return acc;
          }, {}),
          chunks: {
            total: parseInt(chunkStats.rows[0]?.count || 0),
            averageQuality: parseFloat(chunkStats.rows[0]?.avg_quality || 0)
          },
          embeddingCache: {
            total: parseInt(embeddingStats.rows[0]?.count || 0)
          }
        };
        
        console.log('✅ Knowledge Base: Available');
        console.log(`  Sources:`, results.components.knowledgeBase.sources);
        console.log(`  Chunks: ${results.components.knowledgeBase.chunks.total} (avg quality: ${results.components.knowledgeBase.chunks.averageQuality.toFixed(3)})`);
        console.log(`  Cached embeddings: ${results.components.knowledgeBase.embeddingCache.total}`);
      } else {
        results.components.knowledgeBase = {
          status: 'unavailable',
          reason: 'Database not available'
        };
        console.log('⚠️ Knowledge Base: Unavailable (database not healthy)');
      }
    } catch (error) {
      results.components.knowledgeBase = {
        status: 'unhealthy',
        error: error.message
      };
      console.log('❌ Knowledge Base: Failed -', error.message);
    }
    
    // 5. File System Health Check
    console.log('\n📁 Checking file system...');
    try {
      const fs = require('fs-extra');
      const path = require('path');
      
      // Check if User Guide files exist
      const userGuides = [
        './Fund_Manager_User_Guide_1.9.pdf',
        './Fund_Manager_User_Guide_v_1.9_MA_format.pdf'
      ];
      
      const fileStatus = {};
      for (const filePath of userGuides) {
        const exists = await fs.pathExists(filePath);
        if (exists) {
          const stats = await fs.stat(filePath);
          fileStatus[path.basename(filePath)] = {
            exists: true,
            size: stats.size,
            modified: stats.mtime
          };
        } else {
          fileStatus[path.basename(filePath)] = {
            exists: false
          };
        }
      }
      
      // Check log directory
      const logDir = './logs';
      const logDirExists = await fs.pathExists(logDir);
      
      results.components.fileSystem = {
        status: 'healthy',
        userGuides: fileStatus,
        logDirectory: {
          exists: logDirExists,
          path: logDir
        }
      };
      
      console.log('✅ File System: Healthy');
      console.log('  User Guides:');
      Object.entries(fileStatus).forEach(([file, status]) => {
        if (status.exists) {
          console.log(`    ✅ ${file}: ${(status.size / 1024 / 1024).toFixed(2)} MB`);
        } else {
          console.log(`    ❌ ${file}: Missing`);
        }
      });
      console.log(`  Log directory: ${logDirExists ? 'Available' : 'Missing'}`);
    } catch (error) {
      results.components.fileSystem = {
        status: 'unhealthy',
        error: error.message
      };
      console.log('❌ File System: Failed -', error.message);
    }
    
    // 6. Logger Health Check
    console.log('\n📝 Checking logger...');
    try {
      const loggerStats = logger.getStats();
      results.components.logger = {
        status: loggerStats.initialized ? 'healthy' : 'degraded',
        ...loggerStats
      };
      
      if (loggerStats.initialized) {
        console.log('✅ Logger: Healthy');
        console.log(`  Level: ${loggerStats.level}`);
        console.log(`  Transports: ${loggerStats.transportCount}`);
      } else {
        console.log('⚠️ Logger: Degraded (using console fallback)');
      }
    } catch (error) {
      results.components.logger = {
        status: 'unhealthy',
        error: error.message
      };
      console.log('❌ Logger: Failed -', error.message);
    }
    
    // Calculate overall health
    const componentStatuses = Object.values(results.components).map(c => c.status);
    const healthyCount = componentStatuses.filter(s => s === 'healthy').length;
    const totalCount = componentStatuses.length;
    
    if (healthyCount === totalCount) {
      results.overall = 'healthy';
    } else if (healthyCount >= totalCount * 0.7) {
      results.overall = 'degraded';
    } else {
      results.overall = 'unhealthy';
    }
    
    // Final summary
    console.log('\n🏥 Health Check Summary:');
    console.log(`Overall Status: ${results.overall.toUpperCase()}`);
    console.log(`Healthy Components: ${healthyCount}/${totalCount}`);
    
    // Component status summary
    Object.entries(results.components).forEach(([component, status]) => {
      const icon = status.status === 'healthy' ? '✅' : 
                   status.status === 'degraded' ? '⚠️' : '❌';
      console.log(`  ${icon} ${component}: ${status.status}`);
    });
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    const unhealthyComponents = Object.entries(results.components)
      .filter(([, status]) => status.status !== 'healthy');
    
    if (unhealthyComponents.length === 0) {
      console.log('  🎉 All systems are healthy! Ready for production use.');
    } else {
      unhealthyComponents.forEach(([component, status]) => {
        console.log(`  🔧 Fix ${component}: ${status.error || 'Check component configuration'}`);
      });
    }
    
    // Save results to file
    const fs = require('fs-extra');
    await fs.ensureDir('./logs');
    await fs.writeJSON('./logs/health-check-results.json', results, { spaces: 2 });
    console.log('\n📄 Results saved to: ./logs/health-check-results.json');
    
    // Close database connection if opened
    if (results.components.database?.status === 'healthy') {
      const db = await initializeDatabase();
      await db.close();
    }
    
    // Exit with appropriate code
    process.exit(results.overall === 'healthy' ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    results.overall = 'failed';
    results.error = error.message;
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = main;
