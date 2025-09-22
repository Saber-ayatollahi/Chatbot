/**
 * Simple Admin Routes for RAG Configuration
 * Lightweight admin endpoints without complex dependencies
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const router = express.Router();

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Simple admin routes working!' });
});

// RAG configuration endpoints
router.get('/rag/config', async (req, res) => {
  try {
    const { getConfig } = require('../config/environment');
    const config = getConfig();
    
    const ragConfig = {
      confidenceThreshold: config.rag.response.confidenceThreshold,
      responseMaxTokens: config.rag.response.maxTokens,
      responseTemperature: config.rag.response.temperature,
      enableCitationValidation: config.rag.response.enableCitationValidation,
      retrievalMaxChunks: config.rag.retrieval.maxChunks,
      diversityThreshold: config.rag.retrieval.diversityThreshold,
      enableHybridSearch: config.rag.retrieval.enableHybridSearch,
    };

    res.json({ success: true, config: ragConfig });

  } catch (error) {
    logger.error('Failed to get RAG config:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get RAG configuration',
      details: error.message 
    });
  }
});

router.put('/rag/config',
  [
    body('confidenceThreshold').optional().isFloat({ min: 0.0, max: 1.0 }),
    body('responseMaxTokens').optional().isInt({ min: 100, max: 4000 }),
    body('responseTemperature').optional().isFloat({ min: 0.0, max: 2.0 }),
    body('enableCitationValidation').optional().isBoolean(),
    body('retrievalMaxChunks').optional().isInt({ min: 1, max: 50 }),
    body('diversityThreshold').optional().isFloat({ min: 0.0, max: 1.0 }),
    body('enableHybridSearch').optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      // Update environment variables dynamically
      const updates = {};
      if (req.body.confidenceThreshold !== undefined) {
        process.env.CONFIDENCE_THRESHOLD = req.body.confidenceThreshold.toString();
        updates.CONFIDENCE_THRESHOLD = req.body.confidenceThreshold;
      }
      if (req.body.responseMaxTokens !== undefined) {
        process.env.RESPONSE_MAX_TOKENS = req.body.responseMaxTokens.toString();
        updates.RESPONSE_MAX_TOKENS = req.body.responseMaxTokens;
      }
      if (req.body.responseTemperature !== undefined) {
        process.env.RESPONSE_TEMPERATURE = req.body.responseTemperature.toString();
        updates.RESPONSE_TEMPERATURE = req.body.responseTemperature;
      }
      if (req.body.enableCitationValidation !== undefined) {
        process.env.ENABLE_CITATION_VALIDATION = req.body.enableCitationValidation.toString();
        updates.ENABLE_CITATION_VALIDATION = req.body.enableCitationValidation;
      }
      if (req.body.retrievalMaxChunks !== undefined) {
        process.env.RETRIEVAL_MAX_CHUNKS = req.body.retrievalMaxChunks.toString();
        updates.RETRIEVAL_MAX_CHUNKS = req.body.retrievalMaxChunks;
      }
      if (req.body.diversityThreshold !== undefined) {
        process.env.RETRIEVAL_DIVERSITY_THRESHOLD = req.body.diversityThreshold.toString();
        updates.RETRIEVAL_DIVERSITY_THRESHOLD = req.body.diversityThreshold;
      }
      if (req.body.enableHybridSearch !== undefined) {
        process.env.ENABLE_HYBRID_SEARCH = req.body.enableHybridSearch.toString();
        updates.ENABLE_HYBRID_SEARCH = req.body.enableHybridSearch;
      }

      logger.info('RAG configuration updated', {
        updates: updates,
      });

      res.json({ 
        success: true, 
        message: 'RAG configuration updated successfully',
        updates: updates
      });

    } catch (error) {
      logger.error('Failed to update RAG config:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update RAG configuration',
        details: error.message 
      });
    }
  }
);

module.exports = router;
