/**
 * Simple Admin Routes for RAG Configuration
 * Lightweight admin endpoints without complex dependencies
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');
const router = express.Router();

const normalizeBoolean = (value) => {
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return Boolean(value);
};

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Simple admin routes working!' });
});

// RAG configuration endpoints
router.get('/rag/config', async (req, res) => {
  try {
    const configManager = getConfig();
    const configuredMaxChunks = configManager.get('rag.retrieval.maxChunks');

    const ragConfig = {
      confidenceThreshold: configManager.get('rag.response.confidenceThreshold'),
      responseMaxTokens: configManager.get('rag.response.maxTokens'),
      responseTemperature: configManager.get('rag.response.temperature'),
      enableCitationValidation: configManager.get('rag.response.enableCitationValidation'),
      retrievalMaxChunks: configuredMaxChunks !== undefined
        ? configuredMaxChunks
        : configManager.get('vector.maxRetrievedChunks'),
      diversityThreshold: configManager.get('rag.retrieval.diversityThreshold'),
      enableHybridSearch: configManager.get('rag.retrieval.enableHybridSearch'),
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

      const configManager = getConfig();
      const updates = {};

      if (req.body.confidenceThreshold !== undefined) {
        const thresholdValue = Number(req.body.confidenceThreshold);
        configManager.set('rag.response.confidenceThreshold', thresholdValue);
        configManager.set('rag.confidence.minimumThreshold', thresholdValue);
        updates.confidenceThreshold = thresholdValue;
      }

      if (req.body.responseMaxTokens !== undefined) {
        configManager.set('rag.response.maxTokens', Number(req.body.responseMaxTokens));
        updates.responseMaxTokens = Number(req.body.responseMaxTokens);
      }

      if (req.body.responseTemperature !== undefined) {
        configManager.set('rag.response.temperature', Number(req.body.responseTemperature));
        updates.responseTemperature = Number(req.body.responseTemperature);
      }

      if (req.body.enableCitationValidation !== undefined) {
        const value = normalizeBoolean(req.body.enableCitationValidation);
        configManager.set('rag.response.enableCitationValidation', value);
        updates.enableCitationValidation = value;
      }

      if (req.body.retrievalMaxChunks !== undefined) {
        const maxChunks = Number(req.body.retrievalMaxChunks);
        configManager.set('rag.retrieval.maxChunks', maxChunks);
        configManager.set('vector.maxRetrievedChunks', maxChunks);
        updates.retrievalMaxChunks = maxChunks;
      }

      if (req.body.diversityThreshold !== undefined) {
        const diversityThreshold = Number(req.body.diversityThreshold);
        configManager.set('rag.retrieval.diversityThreshold', diversityThreshold);
        updates.diversityThreshold = diversityThreshold;
      }

      if (req.body.enableHybridSearch !== undefined) {
        const value = normalizeBoolean(req.body.enableHybridSearch);
        configManager.set('rag.retrieval.enableHybridSearch', value);
        updates.enableHybridSearch = value;
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
