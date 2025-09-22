/**
 * Prompt Assembler Module
 * Advanced citation-aware prompt assembly system for RAG
 * Phase 2: Retrieval & Prompting System
 */

const { getConfig } = require('../../config/environment');
const logger = require('../../utils/logger');

class PromptAssembler {
  constructor() {
    this.config = getConfig();
    
    // Prompt templates for different scenarios
    this.templates = {
      'standard': this.getStandardTemplate(),
      'definition': this.getDefinitionTemplate(),
      'procedure': this.getProcedureTemplate(),
      'comparison': this.getComparisonTemplate(),
      'troubleshooting': this.getTroubleshootingTemplate(),
      'list': this.getListTemplate(),
      'contextual': this.getContextualTemplate()
    };
    
    // Citation formats
    this.citationFormats = {
      'inline': '(Guide {source}, p.{page})',
      'detailed': '(Source: {source}, Page: {page}, Section: {section})',
      'academic': '[{source}, p.{page}]',
      'numbered': '[{number}]'
    };
    
    // Context window management
    this.maxContextTokens = this.config.get('rag.prompt.contextWindowSize') || 8000;
    this.maxSystemPromptTokens = this.config.get('rag.prompt.systemPromptMaxLength') || 4000;
    this.reservedTokensForResponse = 1000;
  }

  /**
   * Assemble complete RAG prompt with retrieved context
   * @param {string} userQuery - User's question
   * @param {Array} retrievedChunks - Retrieved context chunks
   * @param {Object} conversationHistory - Previous conversation
   * @param {Object} options - Assembly options
   * @returns {Object} Assembled prompt with metadata
   */
  async assembleRAGPrompt(userQuery, retrievedChunks, conversationHistory = [], options = {}) {
    try {
      logger.info(`🔧 Assembling RAG prompt for query: "${userQuery.substring(0, 100)}..."`);
      logger.info(`📄 Retrieved chunks: ${retrievedChunks.length}`);
      
      const startTime = Date.now();
      
      // Determine optimal template based on query analysis
      const templateType = options.templateType || this.selectTemplate(userQuery, retrievedChunks);
      logger.info(`📋 Selected template: ${templateType}`);
      
      // Process and format retrieved chunks
      const processedChunks = await this.processRetrievedChunks(retrievedChunks, options);
      
      // Generate citations
      const citations = this.generateCitations(processedChunks, options.citationFormat || 'inline');
      
      // Assemble context section
      const contextSection = this.assembleContextSection(processedChunks, citations, options);
      
      // Prepare conversation history
      const conversationContext = this.prepareConversationContext(conversationHistory, options);
      
      // Select and customize template
      const template = this.templates[templateType];
      const customizedTemplate = this.customizeTemplate(template, {
        userQuery,
        queryAnalysis: options.queryAnalysis,
        chunkCount: processedChunks.length,
        hasConversationHistory: conversationHistory.length > 0
      });
      
      // Assemble final prompt
      const assembledPrompt = this.assembleFinalPrompt(
        customizedTemplate,
        contextSection,
        conversationContext,
        userQuery,
        options
      );
      
      // Validate token limits
      const tokenValidation = this.validateTokenLimits(assembledPrompt);
      
      // Adjust if necessary
      let finalPrompt = assembledPrompt;
      if (!tokenValidation.isValid) {
        logger.warn(`⚠️ Prompt exceeds token limit, adjusting...`);
        finalPrompt = await this.adjustPromptForTokenLimits(
          assembledPrompt,
          processedChunks,
          conversationContext,
          tokenValidation
        );
      }
      
      const assemblyTime = Date.now() - startTime;
      
      const result = {
        prompt: finalPrompt,
        metadata: {
          templateType,
          citationFormat: options.citationFormat || 'inline',
          chunksUsed: processedChunks.length,
          citationsGenerated: citations.length,
          conversationTurns: conversationHistory.length,
          estimatedTokens: this.estimateTokens(finalPrompt.system + finalPrompt.user),
          assemblyTime,
          timestamp: new Date().toISOString(),
          tokenValidation
        },
        citations,
        processedChunks: processedChunks.map(chunk => ({
          chunk_id: chunk.chunk_id,
          source: chunk.citation?.source || 'Unknown source',
          page: chunk.citation?.page || null,
          relevance_score: chunk.relevance_score || 0,
          content_preview: (chunk.content || '').substring(0, 100) + (chunk.content?.length > 100 ? '...' : '')
        }))
      };
      
      logger.info(`✅ Prompt assembled in ${assemblyTime}ms`);
      logger.info(`📊 Final prompt: ~${result.metadata.estimatedTokens} tokens, ${citations.length} citations`);
      
      return result;
    } catch (error) {
      logger.error('❌ Prompt assembly failed:', error);
      throw new Error(`Prompt assembly failed: ${error.message}`);
    }
  }

  /**
   * Select optimal template based on query and context
   * @param {string} userQuery - User query
   * @param {Array} retrievedChunks - Retrieved chunks
   * @returns {string} Template type
   */
  selectTemplate(userQuery, retrievedChunks) {
    const query = userQuery.toLowerCase();
    
    // Pattern matching for template selection
    if (/(?:what is|define|definition of|meaning of)/i.test(query)) {
      return 'definition';
    }
    
    if (/(?:how to|steps to|process for|procedure)/i.test(query)) {
      return 'procedure';
    }
    
    if (/(?:difference between|compare|versus|vs)/i.test(query)) {
      return 'comparison';
    }
    
    if (/(?:list|enumerate|what are)/i.test(query)) {
      return 'list';
    }
    
    if (/(?:error|problem|issue|fix|solve)/i.test(query)) {
      return 'troubleshooting';
    }
    
    // Check if we have conversation context
    if (retrievedChunks.some(chunk => chunk.context?.conversational)) {
      return 'contextual';
    }
    
    return 'standard';
  }

  /**
   * Process retrieved chunks for prompt inclusion
   * @param {Array} retrievedChunks - Raw retrieved chunks
   * @param {Object} options - Processing options
   * @returns {Array} Processed chunks
   */
  async processRetrievedChunks(retrievedChunks, options = {}) {
    logger.info(`🔄 Processing ${retrievedChunks.length} retrieved chunks`);
    
    let processedChunks = retrievedChunks.map((chunk, index) => {
      // Use condensed content if available from preprocessing, otherwise use original
      const contentToUse = chunk.condensedContent || chunk.content;
      
      return {
        ...chunk,
        processedIndex: index + 1,
        content: contentToUse, // Use optimized content
        originalContent: chunk.originalContent || chunk.content, // Preserve original
        contentPreview: this.createContentPreview(contentToUse),
        citationKey: this.generateCitationKey(chunk, index + 1),
        isOptimized: !!chunk.condensedContent // Flag to indicate if content was optimized
      };
    });
    
    // Sort by relevance score
    processedChunks.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
    
    // Apply content filtering
    if (options.filterContent) {
      processedChunks = this.filterChunkContent(processedChunks, options);
    }
    
    // Ensure token limits per chunk
    processedChunks = processedChunks.map(chunk => ({
      ...chunk,
      content: this.truncateChunkContent(chunk.content, options.maxTokensPerChunk || 500)
    }));
    
    logger.info(`✅ Processed ${processedChunks.length} chunks for prompt inclusion`);
    
    return processedChunks;
  }

  /**
   * Generate citations for chunks
   * @param {Array} processedChunks - Processed chunks
   * @param {string} format - Citation format
   * @returns {Array} Generated citations
   */
  generateCitations(processedChunks, format = 'inline') {
    logger.info(`📝 Generating citations in ${format} format`);
    
    const citations = processedChunks.map((chunk, index) => {
      const citationData = {
        number: index + 1,
        source: this.formatSourceName(chunk.citation?.source || chunk.filename),
        page: chunk.citation?.page || chunk.page_number || 'N/A',
        section: chunk.citation?.section || chunk.heading || chunk.subheading || '',
        chunk_id: chunk.chunk_id
      };
      
      const formattedCitation = this.formatCitation(citationData, format);
      
      return {
        ...citationData,
        formatted: formattedCitation,
        chunk_id: chunk.chunk_id,
        relevance_score: chunk.relevance_score
      };
    });
    
    logger.info(`✅ Generated ${citations.length} citations`);
    
    return citations;
  }

  /**
   * Format a single citation
   * @param {Object} citationData - Citation data
   * @param {string} format - Format type
   * @returns {string} Formatted citation
   */
  formatCitation(citationData, format) {
    const template = this.citationFormats[format] || this.citationFormats.inline;
    
    return template
      .replace('{number}', citationData.number)
      .replace('{source}', citationData.source)
      .replace('{page}', citationData.page)
      .replace('{section}', citationData.section);
  }

  /**
   * Format source name for citations
   * @param {string} rawSource - Raw source name
   * @returns {string} Formatted source name
   */
  formatSourceName(rawSource) {
    if (!rawSource) return 'Unknown Source';
    
    // Clean up source name
    let formatted = rawSource
      .replace(/\.pdf$/i, '')
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // Standardize common patterns
    formatted = formatted
      .replace(/user guide/i, 'User Guide')
      .replace(/fund manager/i, 'Fund Manager')
      .replace(/v\s*(\d+\.?\d*)/i, 'v$1');
    
    return formatted;
  }

  /**
   * Assemble context section with citations
   * @param {Array} processedChunks - Processed chunks
   * @param {Array} citations - Generated citations
   * @param {Object} options - Assembly options
   * @returns {string} Context section
   */
  assembleContextSection(processedChunks, citations, options = {}) {
    logger.info('📋 Assembling context section');
    
    const contextParts = [];
    
    // Add context header
    contextParts.push('RETRIEVED CONTEXT FROM FUND MANAGEMENT GUIDES:');
    contextParts.push('');
    
    // Add each chunk with citation
    processedChunks.forEach((chunk, index) => {
      const citation = citations[index];
      const chunkHeader = `[Context ${index + 1}] ${citation.formatted}`;
      
      contextParts.push(chunkHeader);
      contextParts.push(chunk.content);
      contextParts.push('');
    });
    
    // Add citation summary if requested
    if (options.includeCitationSummary && citations.length > 0) {
      contextParts.push('SOURCES REFERENCED:');
      const uniqueSources = [...new Set(citations.map(c => c.source))];
      uniqueSources.forEach((source, index) => {
        contextParts.push(`${index + 1}. ${source}`);
      });
      contextParts.push('');
    }
    
    return contextParts.join('\n');
  }

  /**
   * Prepare conversation context
   * @param {Array} conversationHistory - Conversation history
   * @param {Object} options - Preparation options
   * @returns {string} Formatted conversation context
   */
  prepareConversationContext(conversationHistory, options = {}) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return '';
    }
    
    logger.info(`💬 Preparing conversation context: ${conversationHistory.length} messages`);
    
    const contextParts = ['CONVERSATION HISTORY:'];
    
    // Limit conversation history to recent messages
    const maxMessages = options.maxConversationMessages || 6;
    const recentMessages = conversationHistory.slice(-maxMessages);
    
    recentMessages.forEach((message, index) => {
      const role = message.role === 'user' ? 'User' : 'Assistant';
      const content = this.truncateContent(message.content, 200);
      contextParts.push(`${role}: ${content}`);
    });
    
    contextParts.push('');
    
    return contextParts.join('\n');
  }

  /**
   * Customize template based on context
   * @param {string} template - Base template
   * @param {Object} context - Customization context
   * @returns {string} Customized template
   */
  customizeTemplate(template, context) {
    let customized = template;
    
    // Replace placeholders
    customized = customized
      .replace('{query_type}', this.getQueryTypeDescription(context.queryAnalysis?.queryType))
      .replace('{chunk_count}', context.chunkCount)
      .replace('{has_context}', context.hasConversationHistory ? 'with conversation context' : 'without prior context');
    
    // Add specific instructions based on query type
    if (context.queryAnalysis?.queryType === 'procedure') {
      customized += '\n\nProvide step-by-step instructions when appropriate.';
    } else if (context.queryAnalysis?.queryType === 'definition') {
      customized += '\n\nProvide clear, comprehensive definitions with examples when helpful.';
    } else if (context.queryAnalysis?.queryType === 'comparison') {
      customized += '\n\nStructure your response to clearly highlight similarities and differences.';
    }
    
    return customized;
  }

  /**
   * Assemble final prompt structure
   * @param {string} template - Customized template
   * @param {string} contextSection - Context section
   * @param {string} conversationContext - Conversation context
   * @param {string} userQuery - User query
   * @param {Object} options - Assembly options
   * @returns {Object} Final prompt structure
   */
  assembleFinalPrompt(template, contextSection, conversationContext, userQuery, options = {}) {
    const systemPrompt = [
      template,
      '',
      contextSection,
      conversationContext
    ].filter(Boolean).join('\n');
    
    const userPrompt = `USER QUERY: ${userQuery}

Please provide a comprehensive answer based on the retrieved context above. Remember to:
1. Base your answer ONLY on the provided context from the Fund Management Guides
2. Include proper citations for all information using the format shown in the context
3. If the context doesn't contain sufficient information to answer the question, clearly state this limitation
4. Provide practical, actionable guidance when appropriate
5. Use professional language suitable for fund management professionals

Your response:`;
    
    return {
      system: systemPrompt,
      user: userPrompt,
      combined: systemPrompt + '\n\n' + userPrompt
    };
  }

  /**
   * Validate token limits for the prompt
   * @param {Object} prompt - Assembled prompt
   * @returns {Object} Validation result
   */
  validateTokenLimits(prompt) {
    const systemTokens = this.estimateTokens(prompt.system);
    const userTokens = this.estimateTokens(prompt.user);
    const totalTokens = systemTokens + userTokens;
    
    const validation = {
      isValid: totalTokens <= (this.maxContextTokens - this.reservedTokensForResponse),
      systemTokens,
      userTokens,
      totalTokens,
      maxAllowed: this.maxContextTokens - this.reservedTokensForResponse,
      reservedForResponse: this.reservedTokensForResponse,
      exceedsBy: Math.max(0, totalTokens - (this.maxContextTokens - this.reservedTokensForResponse))
    };
    
    return validation;
  }

  /**
   * Adjust prompt to fit within token limits
   * @param {Object} prompt - Original prompt
   * @param {Array} processedChunks - Processed chunks
   * @param {string} conversationContext - Conversation context
   * @param {Object} tokenValidation - Token validation result
   * @returns {Object} Adjusted prompt
   */
  async adjustPromptForTokenLimits(prompt, processedChunks, conversationContext, tokenValidation) {
    logger.info(`🔧 Adjusting prompt to fit token limits (exceeds by ${tokenValidation.exceedsBy} tokens)`);
    
    let adjustedChunks = [...processedChunks];
    let adjustedConversation = conversationContext;
    
    // Strategy 1: Reduce number of chunks
    if (tokenValidation.exceedsBy > 1000 && adjustedChunks.length > 3) {
      const targetChunks = Math.max(3, adjustedChunks.length - Math.ceil(tokenValidation.exceedsBy / 500));
      adjustedChunks = adjustedChunks.slice(0, targetChunks);
      logger.info(`📉 Reduced chunks: ${processedChunks.length} → ${adjustedChunks.length}`);
    }
    
    // Strategy 2: Truncate chunk content
    if (tokenValidation.exceedsBy > 500) {
      const maxTokensPerChunk = Math.max(200, 400 - Math.floor(tokenValidation.exceedsBy / adjustedChunks.length));
      adjustedChunks = adjustedChunks.map(chunk => ({
        ...chunk,
        content: this.truncateChunkContent(chunk.content, maxTokensPerChunk)
      }));
      logger.info(`✂️ Truncated chunk content to ~${maxTokensPerChunk} tokens each`);
    }
    
    // Strategy 3: Reduce conversation context
    if (tokenValidation.exceedsBy > 200 && conversationContext.length > 0) {
      adjustedConversation = this.truncateContent(conversationContext, 
        Math.max(100, conversationContext.length - tokenValidation.exceedsBy));
      logger.info(`📉 Reduced conversation context`);
    }
    
    // Reassemble with adjusted content
    const citations = this.generateCitations(adjustedChunks, 'inline');
    const contextSection = this.assembleContextSection(adjustedChunks, citations);
    const template = this.templates.standard; // Use standard template for adjusted prompts
    
    const adjustedPrompt = this.assembleFinalPrompt(
      template,
      contextSection,
      adjustedConversation,
      prompt.user.match(/USER QUERY: (.+?)(?:\n|$)/)?.[1] || 'User query',
      {}
    );
    
    // Validate adjusted prompt
    const newValidation = this.validateTokenLimits(adjustedPrompt);
    logger.info(`✅ Adjusted prompt: ${newValidation.totalTokens} tokens (${newValidation.isValid ? 'valid' : 'still exceeds'})`);
    
    return adjustedPrompt;
  }

  /**
   * Estimate token count for text
   * @param {string} text - Text to count
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    if (!text) return 0;
    // Rough estimation: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate content to fit token limit
   * @param {string} content - Content to truncate
   * @param {number} maxTokens - Maximum tokens
   * @returns {string} Truncated content
   */
  truncateContent(content, maxTokens) {
    if (!content) return '';
    
    const maxChars = maxTokens * 4; // Rough conversion
    if (content.length <= maxChars) return content;
    
    // Try to truncate at sentence boundary
    const truncated = content.substring(0, maxChars);
    const lastSentence = truncated.lastIndexOf('.');
    
    if (lastSentence > maxChars * 0.7) {
      return truncated.substring(0, lastSentence + 1);
    }
    
    return truncated + '...';
  }

  /**
   * Truncate chunk content specifically
   * @param {string} content - Chunk content
   * @param {number} maxTokens - Maximum tokens
   * @returns {string} Truncated content
   */
  truncateChunkContent(content, maxTokens) {
    const truncated = this.truncateContent(content, maxTokens);
    
    // Ensure we don't cut off mid-sentence abruptly
    if (truncated !== content && !truncated.endsWith('.') && !truncated.endsWith('...')) {
      return truncated + '...';
    }
    
    return truncated;
  }

  /**
   * Create content preview for chunks
   * @param {string} content - Full content
   * @returns {string} Content preview
   */
  createContentPreview(content) {
    return this.truncateContent(content, 50); // ~200 characters
  }

  /**
   * Generate citation key for chunk
   * @param {Object} chunk - Chunk object
   * @param {number} index - Chunk index
   * @returns {string} Citation key
   */
  generateCitationKey(chunk, index) {
    const source = chunk.citation?.source || chunk.filename || 'Unknown';
    const page = chunk.citation?.page || chunk.page_number || 'N/A';
    return `${source}_p${page}_${index}`;
  }

  /**
   * Filter chunk content based on options
   * @param {Array} chunks - Chunks to filter
   * @param {Object} options - Filter options
   * @returns {Array} Filtered chunks
   */
  filterChunkContent(chunks, options) {
    let filtered = [...chunks];
    
    // Remove very short chunks
    if (options.minContentLength) {
      filtered = filtered.filter(chunk => chunk.content.length >= options.minContentLength);
    }
    
    // Remove low-quality chunks
    if (options.minQualityScore) {
      filtered = filtered.filter(chunk => chunk.quality_score >= options.minQualityScore);
    }
    
    // Prefer certain content types
    if (options.preferredContentTypes) {
      const preferred = filtered.filter(chunk => 
        options.preferredContentTypes.includes(chunk.content_type)
      );
      const others = filtered.filter(chunk => 
        !options.preferredContentTypes.includes(chunk.content_type)
      );
      filtered = [...preferred, ...others];
    }
    
    return filtered;
  }

  /**
   * Get query type description
   * @param {string} queryType - Query type
   * @returns {string} Description
   */
  getQueryTypeDescription(queryType) {
    const descriptions = {
      'definition': 'definition or explanation',
      'procedure': 'step-by-step procedure',
      'comparison': 'comparison or analysis',
      'list': 'list or enumeration',
      'troubleshooting': 'troubleshooting or problem-solving',
      'general': 'general information'
    };
    
    return descriptions[queryType] || 'general information';
  }

  // Template definitions
  getStandardTemplate() {
    return `You are an expert Fund Management Assistant with access to authoritative User Guides. Your role is to provide accurate, helpful guidance based solely on the retrieved context from official fund management documentation.

INSTRUCTIONS:
1. Answer based ONLY on the provided context from the Fund Management User Guides
2. Always include proper citations in the format shown in the context sections
3. If the context doesn't contain sufficient information to fully answer the question, clearly state this limitation
4. Provide practical, actionable guidance when appropriate
5. Use professional language suitable for fund management professionals
6. Structure your response clearly with headings or bullet points when helpful
7. Never hallucinate or invent information not present in the provided context

RESPONSE REQUIREMENTS:
- Direct answer to the user's query
- Proper citations for each piece of information
- Clear indication if information is incomplete or unavailable
- Professional tone appropriate for financial services
- Actionable next steps when relevant`;
  }

  getDefinitionTemplate() {
    return `You are an expert Fund Management Assistant specializing in providing clear, comprehensive definitions based on authoritative User Guides.

INSTRUCTIONS:
1. Provide a clear, accurate definition based ONLY on the retrieved context
2. Include proper citations for all definitional information
3. Explain the concept in practical terms relevant to fund management
4. Provide examples from the context when available
5. If the term has multiple meanings or contexts, explain the distinctions
6. Never provide definitions not supported by the retrieved context

RESPONSE FORMAT:
- Clear, concise definition
- Practical explanation and context
- Examples when available in the source material
- Proper citations for all information
- Related concepts when mentioned in the context`;
  }

  getProcedureTemplate() {
    return `You are an expert Fund Management Assistant specializing in providing step-by-step procedures based on authoritative User Guides.

INSTRUCTIONS:
1. Provide clear, sequential steps based ONLY on the retrieved context
2. Include proper citations for each procedural step
3. Organize information in a logical, easy-to-follow sequence
4. Highlight any prerequisites or requirements mentioned in the context
5. Include warnings or important notes from the source material
6. If steps are missing from the context, clearly indicate this limitation

RESPONSE FORMAT:
- Prerequisites (if mentioned in context)
- Numbered step-by-step instructions
- Important notes or warnings from the source
- Proper citations for each step or section
- Next steps or follow-up actions when mentioned`;
  }

  getComparisonTemplate() {
    return `You are an expert Fund Management Assistant specializing in providing clear comparisons based on authoritative User Guides.

INSTRUCTIONS:
1. Compare items based ONLY on information in the retrieved context
2. Structure the comparison to highlight key similarities and differences
3. Include proper citations for all comparative information
4. Use tables or structured formats when helpful for clarity
5. If comparison data is incomplete in the context, clearly state limitations
6. Focus on practical implications of the differences

RESPONSE FORMAT:
- Brief overview of items being compared
- Structured comparison (similarities and differences)
- Practical implications when mentioned in context
- Proper citations for all comparative points
- Summary or recommendation if provided in source material`;
  }

  getTroubleshootingTemplate() {
    return `You are an expert Fund Management Assistant specializing in troubleshooting and problem-solving based on authoritative User Guides.

INSTRUCTIONS:
1. Provide troubleshooting guidance based ONLY on the retrieved context
2. Structure the response to help diagnose and resolve the issue
3. Include proper citations for all troubleshooting steps
4. Highlight any diagnostic questions or checks mentioned in the context
5. Provide step-by-step resolution when available in the source material
6. If troubleshooting information is incomplete, suggest appropriate next steps

RESPONSE FORMAT:
- Problem identification and diagnosis
- Step-by-step troubleshooting procedure
- Common causes and solutions from the context
- Proper citations for all troubleshooting information
- When to escalate or seek additional help (if mentioned in context)`;
  }

  getListTemplate() {
    return `You are an expert Fund Management Assistant specializing in providing comprehensive lists and enumerations based on authoritative User Guides.

INSTRUCTIONS:
1. Provide complete lists based ONLY on the retrieved context
2. Organize information in clear, logical categories
3. Include proper citations for list items
4. Use bullet points or numbered lists for clarity
5. If the list appears incomplete in the context, clearly indicate this
6. Provide brief explanations for list items when available in the source

RESPONSE FORMAT:
- Introduction to the list topic
- Well-organized list with clear categories
- Brief explanations when provided in context
- Proper citations for list sections
- Summary or additional notes when mentioned in source material`;
  }

  getContextualTemplate() {
    return `You are an expert Fund Management Assistant with access to authoritative User Guides and awareness of the ongoing conversation context.

INSTRUCTIONS:
1. Consider the conversation history while answering based on the retrieved context
2. Build upon previous responses when relevant and supported by new context
3. Include proper citations for all new information
4. Clarify or expand on previous answers when the new context provides additional detail
5. Maintain consistency with previous responses while incorporating new information
6. If new context contradicts previous information, acknowledge and explain the discrepancy

RESPONSE REQUIREMENTS:
- Contextually aware response that builds on the conversation
- Integration of new information with previous discussion
- Proper citations for all information
- Clear indication of how new information relates to previous responses
- Professional continuity in the conversation flow`;
  }
}

module.exports = PromptAssembler;
