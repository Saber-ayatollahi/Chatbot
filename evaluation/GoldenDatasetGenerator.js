/**
 * Golden Dataset Generator
 * Automatically generates Q&A pairs from User Guides for evaluation
 */

const fs = require('fs').promises;
const path = require('path');
const OpenAI = require('openai');
const { getConfig } = require('../config/environment');
const logger = require('../utils/logger');
const DocumentLoader = require('../knowledge/loaders/DocumentLoader');
const SemanticChunker = require('../knowledge/chunking/SemanticChunker');

class GoldenDatasetGenerator {
  constructor() {
    this.config = getConfig();
    
    // Robust configuration handling for both runtime and test environments
    this.evaluationConfig = {
      apiKey: this.config?.get?.('openai.apiKey') || this.config?.openai?.apiKey || process.env.OPENAI_API_KEY || 'test-key-12345-development',
      chatModel: this.config?.get?.('openai.chatModel') || this.config?.openai?.chatModel || 'gpt-4',
      embeddingModel: this.config?.get?.('openai.embeddingModel') || this.config?.openai?.embeddingModel || 'text-embedding-3-large',
      maxTokens: this.config?.get?.('openai.maxTokens') || this.config?.openai?.maxTokens || 4000,
      temperature: this.config?.get?.('openai.temperature') || this.config?.openai?.temperature || 0.3,
    };
    
    this.openai = new OpenAI({
      apiKey: this.evaluationConfig.apiKey,
    });
    this.documentLoader = new DocumentLoader();
    this.semanticChunker = new SemanticChunker();
    this.generatedPairs = [];
  }

  /**
   * Generate golden dataset from User Guides
   */
  async generateGoldenDataset(userGuidePaths, outputPath) {
    logger.info('🎯 Starting golden dataset generation...');

    try {
      // Load and process documents
      const documents = await this.loadDocuments(userGuidePaths);
      logger.info(`📄 Loaded ${documents.length} documents`);

      // Extract key sections and chunks
      const keyChunks = await this.extractKeyChunks(documents);
      logger.info(`📋 Extracted ${keyChunks.length} key chunks`);

      // Generate Q&A pairs from chunks
      const qaPairs = await this.generateQAPairs(keyChunks);
      logger.info(`❓ Generated ${qaPairs.length} Q&A pairs`);

      // Validate and enhance pairs
      const validatedPairs = await this.validateQAPairs(qaPairs);
      logger.info(`✅ Validated ${validatedPairs.length} Q&A pairs`);

      // Create edge cases and error scenarios
      const edgeCases = await this.createEdgeCases(validatedPairs);
      logger.info(`⚠️ Created ${edgeCases.length} edge case scenarios`);

      // Combine all pairs
      const finalDataset = [...validatedPairs, ...edgeCases];

      // Save dataset
      await this.saveDataset(finalDataset, outputPath);
      logger.info(`💾 Saved golden dataset to ${outputPath}`);

      return finalDataset;
    } catch (error) {
      logger.error('❌ Error generating golden dataset:', error);
      throw error;
    }
  }

  /**
   * Load and process User Guide documents
   */
  async loadDocuments(filePaths) {
    const documents = [];

    for (const filePath of filePaths) {
      try {
        logger.info(`📖 Loading document: ${filePath}`);
        
        const document = await this.documentLoader.loadPDF(
          filePath,
          path.basename(filePath, '.pdf'),
          '1.9'
        );

        documents.push(document);
      } catch (error) {
        logger.error(`❌ Failed to load ${filePath}:`, error);
        throw error;
      }
    }

    return documents;
  }

  /**
   * Extract key chunks suitable for Q&A generation
   */
  async extractKeyChunks(documents) {
    const keyChunks = [];

    for (const document of documents) {
      // Chunk the document
      const chunks = await this.semanticChunker.chunkText(
        document.content,
        {
          maxTokens: 500,
          overlapTokens: 50,
          preserveStructure: true,
        }
      );

      // Filter for high-quality chunks
      const qualityChunks = chunks.filter(chunk => this.isHighQualityChunk(chunk, document));
      
      // Add metadata
      qualityChunks.forEach(chunk => {
        keyChunks.push({
          ...chunk,
          sourceDocument: document.sourceId,
          version: document.version,
          heading: this.extractHeading(chunk, document),
          pageNumber: this.extractPageNumber(chunk, document),
          category: this.categorizeChunk(chunk),
          difficulty: this.assessDifficulty(chunk),
        });
      });
    }

    // Sort by importance and diversity
    return this.prioritizeChunks(keyChunks);
  }

  /**
   * Check if chunk is suitable for Q&A generation
   */
  isHighQualityChunk(chunk, document) {
    const content = chunk.content.trim();
    
    // Must have minimum length
    if (content.length < 100) return false;
    
    // Should contain actionable information
    const actionWords = ['step', 'process', 'procedure', 'method', 'how to', 'required', 'mandatory'];
    const hasActionableContent = actionWords.some(word => 
      content.toLowerCase().includes(word)
    );
    
    // Should contain specific information
    const specificityIndicators = ['field', 'button', 'screen', 'tab', 'section', 'value'];
    const hasSpecificInfo = specificityIndicators.some(word => 
      content.toLowerCase().includes(word)
    );
    
    // Avoid generic or navigation content
    const genericPhrases = ['see section', 'refer to', 'as shown in', 'figure', 'table of contents'];
    const isGeneric = genericPhrases.some(phrase => 
      content.toLowerCase().includes(phrase)
    );
    
    return (hasActionableContent || hasSpecificInfo) && !isGeneric;
  }

  /**
   * Generate Q&A pairs from chunks using OpenAI
   */
  async generateQAPairs(chunks) {
    const qaPairs = [];
    const batchSize = 5;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      try {
        const batchPairs = await this.generateBatchQAPairs(batch);
        qaPairs.push(...batchPairs);
        
        // Rate limiting
        await this.delay(1000);
        
        logger.info(`📝 Generated Q&A pairs: ${qaPairs.length}/${chunks.length * 2} (estimated)`);
      } catch (error) {
        logger.error(`❌ Error generating batch ${i}-${i + batchSize}:`, error);
        continue;
      }
    }

    return qaPairs;
  }

  /**
   * Generate Q&A pairs for a batch of chunks
   */
  async generateBatchQAPairs(chunks) {
    const prompt = this.buildQAGenerationPrompt(chunks);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert in fund management systems. Generate high-quality question-answer pairs from the provided content. Each pair should:
            1. Be based on specific information in the content
            2. Include the exact answer with proper citations
            3. Cover different question types (factual, procedural, comparative)
            4. Be clear and unambiguous
            5. Include expected citations from the source material

            Return the response as a JSON array of objects with this structure:
            {
              "question": "Clear, specific question",
              "expected_answer": "Complete answer with details",
              "expected_citations": ["Source reference"],
              "category": "fund_creation|nav_calculation|compliance|reporting|general",
              "difficulty": "easy|medium|hard",
              "question_type": "factual|procedural|comparative|troubleshooting"
            }`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 3000,
      });

      const content = response.choices[0].message.content.trim();
      
      // Parse JSON response
      let parsedPairs;
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
        const jsonContent = jsonMatch ? jsonMatch[1] : content;
        parsedPairs = JSON.parse(jsonContent);
      } catch (parseError) {
        logger.error('❌ Failed to parse Q&A generation response:', parseError);
        return [];
      }

      // Validate and enhance pairs
      return parsedPairs.map(pair => ({
        id: `qa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...pair,
        source_chunks: chunks.map(chunk => chunk.id || `chunk_${chunk.index}`),
        generated_at: new Date().toISOString(),
        validation_status: 'pending',
      }));

    } catch (error) {
      logger.error('❌ Error calling OpenAI for Q&A generation:', error);
      return [];
    }
  }

  /**
   * Build prompt for Q&A generation
   */
  buildQAGenerationPrompt(chunks) {
    let prompt = 'Generate 2-3 high-quality question-answer pairs from the following content:\n\n';
    
    chunks.forEach((chunk, index) => {
      prompt += `--- Chunk ${index + 1} ---\n`;
      prompt += `Source: ${chunk.sourceDocument}, Page: ${chunk.pageNumber || 'N/A'}\n`;
      prompt += `Heading: ${chunk.heading || 'N/A'}\n`;
      prompt += `Content: ${chunk.content}\n\n`;
    });

    prompt += `
Generate diverse questions covering:
- Factual questions about specific requirements or fields
- Procedural questions about how to perform tasks
- Comparative questions about different options or approaches
- Troubleshooting questions about common issues

Ensure each answer includes specific details and proper source citations.`;

    return prompt;
  }

  /**
   * Validate and enhance generated Q&A pairs
   */
  async validateQAPairs(qaPairs) {
    const validatedPairs = [];

    for (const pair of qaPairs) {
      try {
        // Basic validation
        if (!this.isValidQAPair(pair)) {
          logger.warn(`⚠️ Skipping invalid Q&A pair: ${pair.id}`);
          continue;
        }

        // Enhance with additional metadata
        const enhancedPair = await this.enhanceQAPair(pair);
        
        validatedPairs.push(enhancedPair);
      } catch (error) {
        logger.error(`❌ Error validating Q&A pair ${pair.id}:`, error);
      }
    }

    return validatedPairs;
  }

  /**
   * Validate Q&A pair structure and content
   */
  isValidQAPair(pair) {
    const required = ['question', 'expected_answer', 'category'];
    
    // Check required fields
    for (const field of required) {
      if (!pair[field] || pair[field].trim().length === 0) {
        return false;
      }
    }

    // Check question quality
    const question = pair.question.trim();
    if (question.length < 10 || !question.endsWith('?')) {
      return false;
    }

    // Check answer quality
    const answer = pair.expected_answer.trim();
    if (answer.length < 20) {
      return false;
    }

    return true;
  }

  /**
   * Enhance Q&A pair with additional metadata
   */
  async enhanceQAPair(pair) {
    return {
      ...pair,
      // Add quality scores
      quality_score: this.calculateQualityScore(pair),
      
      // Add keywords for search
      keywords: this.extractKeywords(pair),
      
      // Add complexity assessment
      complexity_indicators: this.assessComplexity(pair),
      
      // Add validation metadata
      validation_metadata: {
        validated_at: new Date().toISOString(),
        validator: 'automated',
        confidence: this.calculateValidationConfidence(pair),
      }
    };
  }

  /**
   * Create edge cases and error scenarios
   */
  async createEdgeCases(validatedPairs) {
    const edgeCases = [];

    // Ambiguous questions
    const ambiguousCases = await this.createAmbiguousQuestions(validatedPairs);
    edgeCases.push(...ambiguousCases);

    // Out-of-scope questions
    const outOfScopeCases = this.createOutOfScopeQuestions();
    edgeCases.push(...outOfScopeCases);

    // Multi-step complex queries
    const complexCases = await this.createComplexQueries(validatedPairs);
    edgeCases.push(...complexCases);

    // Adversarial examples
    const adversarialCases = this.createAdversarialExamples(validatedPairs);
    edgeCases.push(...adversarialCases);

    return edgeCases;
  }

  /**
   * Create ambiguous question scenarios
   */
  async createAmbiguousQuestions(pairs) {
    const ambiguousCases = [];
    
    // Sample some pairs to create ambiguous versions
    const samplePairs = this.sampleArray(pairs, Math.min(20, pairs.length / 10));
    
    for (const pair of samplePairs) {
      try {
        const ambiguousVersion = await this.makeQuestionAmbiguous(pair);
        if (ambiguousVersion) {
          ambiguousCases.push({
            ...ambiguousVersion,
            id: `edge_ambiguous_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            test_type: 'ambiguous',
            original_pair_id: pair.id,
            expected_behavior: 'request_clarification',
          });
        }
      } catch (error) {
        logger.error(`❌ Error creating ambiguous question for ${pair.id}:`, error);
      }
    }

    return ambiguousCases;
  }

  /**
   * Make a question ambiguous for testing
   */
  async makeQuestionAmbiguous(pair) {
    const prompt = `Take this clear question and make it ambiguous or unclear while keeping it related to fund management:

Original Question: ${pair.question}
Original Answer: ${pair.expected_answer}

Create an ambiguous version that could have multiple interpretations or is missing key context. The system should ideally ask for clarification.

Return JSON: {"question": "ambiguous question", "expected_answer": "explanation of why clarification is needed", "ambiguity_type": "missing_context|multiple_interpretations|vague_terms"}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an expert at creating test cases for AI systems.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 500,
      });

      const content = response.choices[0].message.content.trim();
      return JSON.parse(content);
    } catch (error) {
      logger.error('❌ Error creating ambiguous question:', error);
      return null;
    }
  }

  /**
   * Create out-of-scope questions
   */
  createOutOfScopeQuestions() {
    const outOfScopeQuestions = [
      {
        id: `edge_oos_${Date.now()}_1`,
        question: "What's the weather like today?",
        expected_answer: "I can only help with fund management questions. Please ask about fund creation, NAV calculations, or compliance requirements.",
        category: "out_of_scope",
        test_type: "out_of_scope",
        expected_behavior: "polite_decline",
        difficulty: "easy",
      },
      {
        id: `edge_oos_${Date.now()}_2`,
        question: "How do I cook pasta?",
        expected_answer: "I'm specialized in fund management assistance. Please ask questions related to fund operations, compliance, or reporting.",
        category: "out_of_scope",
        test_type: "out_of_scope",
        expected_behavior: "polite_decline",
        difficulty: "easy",
      },
      {
        id: `edge_oos_${Date.now()}_3`,
        question: "Can you help me with my personal taxes?",
        expected_answer: "I focus on fund management operations. For personal tax questions, please consult a tax professional. I can help with fund-related tax compliance matters.",
        category: "out_of_scope",
        test_type: "out_of_scope",
        expected_behavior: "redirect_to_scope",
        difficulty: "medium",
      },
    ];

    return outOfScopeQuestions;
  }

  /**
   * Create complex multi-step queries
   */
  async createComplexQueries(pairs) {
    const complexCases = [];
    
    // Combine multiple concepts
    const samplePairs = this.sampleArray(pairs, Math.min(10, pairs.length / 20));
    
    for (let i = 0; i < samplePairs.length - 1; i += 2) {
      try {
        const complexQuery = await this.combineQuestionsIntoComplex(
          samplePairs[i],
          samplePairs[i + 1]
        );
        
        if (complexQuery) {
          complexCases.push({
            ...complexQuery,
            id: `edge_complex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            test_type: 'complex_multi_step',
            difficulty: 'hard',
          });
        }
      } catch (error) {
        logger.error(`❌ Error creating complex query:`, error);
      }
    }

    return complexCases;
  }

  /**
   * Create adversarial examples
   */
  createAdversarialExamples(pairs) {
    const adversarialCases = [];
    const samplePairs = this.sampleArray(pairs, Math.min(15, pairs.length / 15));

    samplePairs.forEach(pair => {
      // Create variations that might confuse the system
      adversarialCases.push({
        id: `edge_adv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        question: this.createAdversarialVariation(pair.question),
        expected_answer: pair.expected_answer,
        category: pair.category,
        test_type: 'adversarial',
        original_pair_id: pair.id,
        adversarial_type: 'typos_and_variations',
        difficulty: 'medium',
      });
    });

    return adversarialCases;
  }

  /**
   * Create adversarial variation of a question
   */
  createAdversarialVariation(question) {
    // Add common typos and variations
    let variation = question;
    
    // Common typos
    variation = variation.replace(/create/gi, 'creat');
    variation = variation.replace(/field/gi, 'feild');
    variation = variation.replace(/required/gi, 'requried');
    
    // Case variations
    if (Math.random() > 0.5) {
      variation = variation.toLowerCase();
    }
    
    // Add extra spaces
    variation = variation.replace(/\s+/g, '  ');
    
    return variation;
  }

  /**
   * Save dataset to file
   */
  async saveDataset(dataset, outputPath) {
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    // Save as JSONL format
    const jsonlContent = dataset.map(pair => JSON.stringify(pair)).join('\n');
    await fs.writeFile(outputPath, jsonlContent, 'utf8');

    // Also save as regular JSON for easier reading
    const jsonPath = outputPath.replace('.jsonl', '.json');
    await fs.writeFile(jsonPath, JSON.stringify(dataset, null, 2), 'utf8');

    // Generate summary statistics
    const summary = this.generateDatasetSummary(dataset);
    const summaryPath = outputPath.replace('.jsonl', '_summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

    logger.info(`📊 Dataset summary saved to ${summaryPath}`);
  }

  /**
   * Generate dataset summary statistics
   */
  generateDatasetSummary(dataset) {
    const summary = {
      total_pairs: dataset.length,
      generation_date: new Date().toISOString(),
      categories: {},
      difficulties: {},
      test_types: {},
      quality_distribution: {
        high: 0,
        medium: 0,
        low: 0,
      },
    };

    dataset.forEach(pair => {
      // Count categories
      summary.categories[pair.category] = (summary.categories[pair.category] || 0) + 1;
      
      // Count difficulties
      summary.difficulties[pair.difficulty] = (summary.difficulties[pair.difficulty] || 0) + 1;
      
      // Count test types
      const testType = pair.test_type || 'standard';
      summary.test_types[testType] = (summary.test_types[testType] || 0) + 1;
      
      // Quality distribution
      const qualityScore = pair.quality_score || 0.5;
      if (qualityScore >= 0.8) {
        summary.quality_distribution.high++;
      } else if (qualityScore >= 0.6) {
        summary.quality_distribution.medium++;
      } else {
        summary.quality_distribution.low++;
      }
    });

    return summary;
  }

  // Helper methods
  extractHeading(chunk, document) {
    // Extract heading from context or metadata
    return chunk.heading || 'General Information';
  }

  extractPageNumber(chunk, document) {
    // Extract page number from chunk metadata
    return chunk.pageNumber || null;
  }

  categorizeChunk(chunk) {
    const content = chunk.content.toLowerCase();
    
    if (content.includes('fund creation') || content.includes('create fund')) {
      return 'fund_creation';
    } else if (content.includes('nav') || content.includes('net asset value')) {
      return 'nav_calculation';
    } else if (content.includes('compliance') || content.includes('comply') || content.includes('regulation') || content.includes('regulatory')) {
      return 'compliance';
    } else if (content.includes('report') || content.includes('reporting')) {
      return 'reporting';
    } else {
      return 'general';
    }
  }

  assessDifficulty(chunk) {
    const content = chunk.content;
    const complexity = content.split(' ').length;
    
    if (complexity < 25) return 'easy';
    if (complexity < 100) return 'medium';
    return 'hard';
  }

  prioritizeChunks(chunks) {
    // Sort by importance and diversity
    return chunks.sort((a, b) => {
      // Prioritize by category diversity
      const categoryWeight = { 'fund_creation': 3, 'nav_calculation': 3, 'compliance': 2, 'reporting': 2, 'general': 1 };
      const aWeight = categoryWeight[a.category] || 1;
      const bWeight = categoryWeight[b.category] || 1;
      
      if (aWeight !== bWeight) return bWeight - aWeight;
      
      // Then by content length (prefer substantial content)
      return b.content.length - a.content.length;
    });
  }

  calculateQualityScore(pair) {
    let score = 0.5; // Base score
    
    // Question quality
    if (pair.question.length > 20) score += 0.1;
    if (pair.question.includes('how') || pair.question.includes('what') || pair.question.includes('when')) score += 0.1;
    
    // Answer quality
    if (pair.expected_answer.length > 50) score += 0.1;
    if (pair.expected_citations && pair.expected_citations.length > 0) score += 0.2;
    
    return Math.min(1.0, score);
  }

  extractKeywords(pair) {
    const text = `${pair.question} ${pair.expected_answer}`.toLowerCase();
    const words = text.match(/\b\w{4,}\b/g) || [];
    const uniqueWords = [...new Set(words)];
    return uniqueWords.slice(0, 10); // Top 10 keywords
  }

  assessComplexity(pair) {
    const indicators = [];
    
    if (pair.question.includes('and') || pair.question.includes('or')) {
      indicators.push('multiple_concepts');
    }
    
    if (pair.expected_answer.length > 200) {
      indicators.push('detailed_answer');
    }
    
    if (pair.category === 'compliance') {
      indicators.push('regulatory_complexity');
    }
    
    return indicators;
  }

  calculateValidationConfidence(pair) {
    let confidence = 0.7; // Base confidence
    
    if (pair.expected_citations && pair.expected_citations.length > 0) confidence += 0.2;
    if (pair.quality_score > 0.8) confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  sampleArray(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  async combineQuestionsIntoComplex(pair1, pair2) {
    const prompt = `Combine these two fund management questions into one complex, multi-step question:

Question 1: ${pair1.question}
Answer 1: ${pair1.expected_answer}

Question 2: ${pair2.question}  
Answer 2: ${pair2.expected_answer}

Create a complex question that requires understanding both concepts. Return JSON with:
{"question": "complex combined question", "expected_answer": "comprehensive answer covering both aspects", "category": "most relevant category"}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an expert at creating complex test scenarios.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 800,
      });

      const content = response.choices[0].message.content.trim();
      return JSON.parse(content);
    } catch (error) {
      logger.error('❌ Error creating complex query:', error);
      return null;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = GoldenDatasetGenerator;
