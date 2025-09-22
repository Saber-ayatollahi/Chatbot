/**
 * Hierarchical Semantic Chunker
 * Advanced multi-scale document chunking with semantic boundary detection
 * Part of Advanced Document Processing Implementation
 */

const natural = require('natural');
const { v4: uuidv4 } = require('uuid');

class HierarchicalSemanticChunker {
  constructor(options = {}) {
    this.options = {
      scales: {
        document: { maxTokens: 8000, minTokens: 4000 },
        section: { maxTokens: 2000, minTokens: 500 },
        paragraph: { maxTokens: 500, minTokens: 100 },
        sentence: { maxTokens: 150, minTokens: 20 }
      },
      semanticCoherence: {
        enableSemanticBoundaryDetection: true,
        sentenceSimilarityThreshold: 0.7
      },
      contextPreservation: {
        hierarchicalOverlap: true,
        parentChildRelationships: true,
        narrativeFlowPreservation: true
      },
      qualityThresholds: {
        minChunkQuality: 0.4,
        minTokenCount: 20,
        maxTokenCount: 1000
      },
      ...options
    };

    this.tokenizer = natural.WordTokenizer;
    this.sentenceTokenizer = new natural.SentenceTokenizer();
  }

  /**
   * Main entry point for hierarchical document chunking
   */
  async chunkDocumentHierarchically(document, options = {}) {
    const config = { ...this.options, ...options };
    
    console.log('🏗️ Starting hierarchical semantic chunking...');
    const startTime = Date.now();

    try {
      // Step 1: Parse document structure
      const documentStructure = await this.parseDocumentStructure(document);
      
      // Step 2: Generate hierarchical chunks at multiple scales
      const hierarchicalChunks = await this.generateMultiScaleChunks(documentStructure, config);
      
      // Step 3: Establish parent-child relationships
      const linkedChunks = await this.establishHierarchicalRelationships(hierarchicalChunks);
      
      // Step 4: Apply semantic boundary detection
      const semanticChunks = await this.applySemanticBoundaryDetection(linkedChunks, config);
      
      // Step 5: Validate and optimize chunk quality
      const optimizedChunks = await this.validateAndOptimizeChunks(semanticChunks, config);

      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Hierarchical chunking completed in ${processingTime}ms`);
      console.log(`📊 Generated ${optimizedChunks.length} hierarchical chunks`);

      return {
        chunks: optimizedChunks,
        metadata: {
          processingTime,
          totalChunks: optimizedChunks.length,
          scales: Object.keys(config.scales),
          qualityScore: this.calculateOverallQuality(optimizedChunks)
        }
      };

    } catch (error) {
      console.error('❌ Hierarchical chunking failed:', error);
      throw error;
    }
  }

  /**
   * Parse document structure and identify hierarchical elements
   */
  async parseDocumentStructure(document) {
    console.log('📖 Parsing document structure...');
    
    const structure = {
      title: document.title || 'Untitled Document',
      sections: [],
      metadata: document.metadata || {}
    };

    // Split document into sections based on headings
    const sections = this.identifySections(document.content);
    
    for (const section of sections) {
      const sectionStructure = {
        heading: section.heading,
        level: section.level,
        content: section.content,
        paragraphs: this.identifyParagraphs(section.content),
        subsections: section.subsections || []
      };
      
      structure.sections.push(sectionStructure);
    }

    console.log(`📋 Identified ${structure.sections.length} sections`);
    return structure;
  }

  /**
   * Generate chunks at multiple scales
   */
  async generateMultiScaleChunks(documentStructure, config) {
    console.log('🔄 Generating multi-scale chunks...');
    
    const allChunks = [];
    let chunkIndex = 0;

    // Document-level chunks
    const documentChunks = await this.generateDocumentLevelChunks(
      documentStructure, 
      config.scales.document,
      chunkIndex
    );
    allChunks.push(...documentChunks);
    chunkIndex += documentChunks.length;

    // Section-level chunks
    for (const section of documentStructure.sections) {
      const sectionChunks = await this.generateSectionLevelChunks(
        section,
        config.scales.section,
        chunkIndex
      );
      allChunks.push(...sectionChunks);
      chunkIndex += sectionChunks.length;
    }

    // Paragraph-level chunks
    for (const section of documentStructure.sections) {
      for (const paragraph of section.paragraphs) {
        const paragraphChunks = await this.generateParagraphLevelChunks(
          paragraph,
          section,
          config.scales.paragraph,
          chunkIndex
        );
        allChunks.push(...paragraphChunks);
        chunkIndex += paragraphChunks.length;
      }
    }

    console.log(`📦 Generated ${allChunks.length} multi-scale chunks`);
    return allChunks;
  }

  /**
   * Generate document-level chunks
   */
  async generateDocumentLevelChunks(documentStructure, scaleConfig, startIndex) {
    const chunks = [];
    const fullContent = documentStructure.sections.map(s => s.content).join('\n\n');
    
    if (this.getTokenCount(fullContent) <= scaleConfig.maxTokens) {
      // Single document chunk
      chunks.push({
        id: uuidv4(),
        scale: 'document',
        content: fullContent,
        heading: documentStructure.title,
        tokenCount: this.getTokenCount(fullContent),
        hierarchyPath: [documentStructure.title],
        nodeId: 'root',
        metadata: {
          type: 'document',
          title: documentStructure.title
        }
      });
    } else {
      // Split into multiple document-level chunks
      const contentChunks = this.splitContentByTokens(fullContent, scaleConfig);
      contentChunks.forEach((chunk, index) => {
        chunks.push({
          id: uuidv4(),
          scale: 'document',
          content: chunk,
          heading: `${documentStructure.title} (Part ${index + 1})`,
          tokenCount: this.getTokenCount(chunk),
          hierarchyPath: [documentStructure.title, `Part ${index + 1}`],
          nodeId: `root_${index}`,
          metadata: {
            type: 'document_part',
            title: documentStructure.title,
            part: index + 1
          }
        });
      });
    }

    return chunks;
  }

  /**
   * Generate section-level chunks
   */
  async generateSectionLevelChunks(section, scaleConfig, startIndex) {
    const chunks = [];
    const tokenCount = this.getTokenCount(section.content);

    if (tokenCount >= scaleConfig.minTokens && tokenCount <= scaleConfig.maxTokens) {
      // Single section chunk
      chunks.push({
        id: uuidv4(),
        scale: 'section',
        content: section.content,
        heading: section.heading,
        tokenCount: tokenCount,
        hierarchyPath: [section.heading],
        nodeId: `section_${startIndex}`,
        metadata: {
          type: 'section',
          level: section.level,
          heading: section.heading
        }
      });
    } else if (tokenCount > scaleConfig.maxTokens) {
      // Split large section
      const contentChunks = this.splitContentByTokens(section.content, scaleConfig);
      contentChunks.forEach((chunk, index) => {
        chunks.push({
          id: uuidv4(),
          scale: 'section',
          content: chunk,
          heading: `${section.heading} (${index + 1})`,
          tokenCount: this.getTokenCount(chunk),
          hierarchyPath: [section.heading, `Part ${index + 1}`],
          nodeId: `section_${startIndex + index}`,
          metadata: {
            type: 'section_part',
            level: section.level,
            heading: section.heading,
            part: index + 1
          }
        });
      });
    }

    return chunks;
  }

  /**
   * Generate paragraph-level chunks
   */
  async generateParagraphLevelChunks(paragraph, section, scaleConfig, startIndex) {
    const chunks = [];
    const tokenCount = this.getTokenCount(paragraph.content);

    if (tokenCount >= scaleConfig.minTokens) {
      if (tokenCount <= scaleConfig.maxTokens) {
        // Single paragraph chunk
        chunks.push({
          id: uuidv4(),
          scale: 'paragraph',
          content: paragraph.content,
          heading: paragraph.firstSentence || section.heading,
          tokenCount: tokenCount,
          hierarchyPath: [section.heading, paragraph.firstSentence || 'Paragraph'],
          nodeId: `para_${startIndex}`,
          metadata: {
            type: 'paragraph',
            sectionHeading: section.heading,
            paragraphIndex: paragraph.index
          }
        });
      } else {
        // Split large paragraph
        const sentences = this.sentenceTokenizer.tokenize(paragraph.content);
        const sentenceChunks = this.groupSentencesByTokens(sentences, scaleConfig);
        
        sentenceChunks.forEach((chunk, index) => {
          chunks.push({
            id: uuidv4(),
            scale: 'paragraph',
            content: chunk,
            heading: paragraph.firstSentence || section.heading,
            tokenCount: this.getTokenCount(chunk),
            hierarchyPath: [section.heading, paragraph.firstSentence || 'Paragraph', `Part ${index + 1}`],
            nodeId: `para_${startIndex + index}`,
            metadata: {
              type: 'paragraph_part',
              sectionHeading: section.heading,
              paragraphIndex: paragraph.index,
              part: index + 1
            }
          });
        });
      }
    }

    return chunks;
  }

  /**
   * Establish hierarchical relationships between chunks
   */
  async establishHierarchicalRelationships(chunks) {
    console.log('🔗 Establishing hierarchical relationships...');
    
    const linkedChunks = chunks.map(chunk => ({
      ...chunk,
      parentChunkId: null,
      childChunkIds: [],
      siblingChunkIds: []
    }));

    // Establish parent-child relationships
    for (let i = 0; i < linkedChunks.length; i++) {
      const chunk = linkedChunks[i];
      
      // Find parent (higher scale, overlapping content)
      const parent = this.findParentChunk(chunk, linkedChunks);
      if (parent) {
        chunk.parentChunkId = parent.id;
        if (!parent.childChunkIds.includes(chunk.id)) {
          parent.childChunkIds.push(chunk.id);
        }
      }

      // Find siblings (same scale, adjacent content)
      const siblings = this.findSiblingChunks(chunk, linkedChunks);
      chunk.siblingChunkIds = siblings.map(s => s.id);
    }

    console.log(`🔗 Established relationships for ${linkedChunks.length} chunks`);
    return linkedChunks;
  }

  /**
   * Apply semantic boundary detection
   */
  async applySemanticBoundaryDetection(chunks, config) {
    if (!config.semanticCoherence.enableSemanticBoundaryDetection) {
      return chunks;
    }

    console.log('🧠 Applying semantic boundary detection...');
    
    const optimizedChunks = [];
    
    for (const chunk of chunks) {
      if (chunk.scale === 'paragraph' || chunk.scale === 'sentence') {
        const semanticChunks = await this.detectSemanticBoundaries(chunk, config);
        optimizedChunks.push(...semanticChunks);
      } else {
        optimizedChunks.push(chunk);
      }
    }

    console.log(`🧠 Semantic optimization complete: ${optimizedChunks.length} chunks`);
    return optimizedChunks;
  }

  /**
   * Validate and optimize chunk quality
   */
  async validateAndOptimizeChunks(chunks, config) {
    console.log('✅ Validating and optimizing chunk quality...');
    
    const validatedChunks = [];
    
    for (const chunk of chunks) {
      const quality = this.calculateChunkQuality(chunk);
      
      if (quality >= config.qualityThresholds.minChunkQuality) {
        chunk.qualityScore = quality;
        validatedChunks.push(chunk);
      } else {
        console.log(`⚠️ Skipping low-quality chunk: ${chunk.id} (quality: ${quality})`);
      }
    }

    console.log(`✅ Quality validation complete: ${validatedChunks.length} valid chunks`);
    return validatedChunks;
  }

  // Helper methods
  identifySections(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if line is a heading (simple heuristic)
      if (this.isHeading(trimmedLine)) {
        if (currentSection) {
          sections.push(currentSection);
        }
        
        currentSection = {
          heading: trimmedLine,
          level: this.getHeadingLevel(trimmedLine),
          content: '',
          subsections: []
        };
      } else if (currentSection && trimmedLine) {
        currentSection.content += line + '\n';
      }
    }
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections.length > 0 ? sections : [{ heading: 'Content', level: 1, content: content, subsections: [] }];
  }

  identifyParagraphs(content) {
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    return paragraphs.map((paragraph, index) => ({
      index,
      content: paragraph.trim(),
      firstSentence: this.sentenceTokenizer.tokenize(paragraph.trim())[0] || ''
    }));
  }

  isHeading(line) {
    // Simple heuristics for heading detection
    return line.match(/^#{1,6}\s/) || // Markdown headings
           line.match(/^[A-Z][A-Z\s]+$/) || // ALL CAPS
           line.match(/^\d+\.?\s+[A-Z]/) || // Numbered headings
           (line.length < 100 && line.match(/^[A-Z]/)); // Short lines starting with capital
  }

  getHeadingLevel(line) {
    const hashMatch = line.match(/^#{1,6}/);
    if (hashMatch) return hashMatch[0].length;
    
    if (line.match(/^\d+\.?\s/)) return 2;
    if (line.match(/^[A-Z][A-Z\s]+$/)) return 1;
    
    return 3;
  }

  getTokenCount(text) {
    // Use word count approximation (more reliable)
    // Approximate: 1 token ≈ 0.75 words for English text
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    return Math.ceil(wordCount * 1.33);
  }

  splitContentByTokens(content, scaleConfig) {
    const sentences = this.sentenceTokenizer.tokenize(content);
    return this.groupSentencesByTokens(sentences, scaleConfig);
  }

  groupSentencesByTokens(sentences, scaleConfig) {
    const chunks = [];
    let currentChunk = '';
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.getTokenCount(sentence);
      
      if (currentTokens + sentenceTokens > scaleConfig.maxTokens && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
        currentTokens = sentenceTokens;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentTokens += sentenceTokens;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  findParentChunk(chunk, allChunks) {
    const scaleHierarchy = ['sentence', 'paragraph', 'section', 'document'];
    const currentScaleIndex = scaleHierarchy.indexOf(chunk.scale);
    
    if (currentScaleIndex <= 0) return null;
    
    const parentScale = scaleHierarchy[currentScaleIndex + 1];
    const potentialParents = allChunks.filter(parent => parent.scale === parentScale);
    
    if (potentialParents.length === 0) return null;
    
    // Find best parent using multiple criteria
    let bestParent = null;
    let bestScore = 0;
    
    for (const parent of potentialParents) {
      const score = this.calculateParentChildScore(chunk, parent);
      if (score > bestScore && score > 0.3) { // Minimum threshold
        bestScore = score;
        bestParent = parent;
      }
    }
    
    return bestParent;
  }

  /**
   * Calculate parent-child relationship score using multiple factors
   */
  calculateParentChildScore(child, parent) {
    let score = 0;
    
    // 1. Content containment (40% weight)
    const containmentScore = this.calculateContentContainment(child.content, parent.content);
    score += containmentScore * 0.4;
    
    // 2. Hierarchical path similarity (30% weight)
    const pathScore = this.calculateHierarchyPathSimilarity(child.hierarchyPath, parent.hierarchyPath);
    score += pathScore * 0.3;
    
    // 3. Position proximity (20% weight)
    const positionScore = this.calculatePositionProximity(child, parent);
    score += positionScore * 0.2;
    
    // 4. Semantic similarity (10% weight)
    const semanticScore = this.calculateSemanticSimilarity(child.content, parent.content);
    score += semanticScore * 0.1;
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate how much child content is contained in parent
   */
  calculateContentContainment(childContent, parentContent) {
    // Check for exact substring match first
    if (parentContent.includes(childContent)) {
      return 1.0;
    }
    
    // Check for partial word overlap
    const childWords = new Set(childContent.toLowerCase().split(/\s+/));
    const parentWords = new Set(parentContent.toLowerCase().split(/\s+/));
    
    const overlap = new Set([...childWords].filter(word => parentWords.has(word)));
    return overlap.size / childWords.size;
  }

  /**
   * Calculate similarity between hierarchy paths
   */
  calculateHierarchyPathSimilarity(childPath, parentPath) {
    if (!childPath || !parentPath) return 0;
    if (childPath.length <= parentPath.length) return 0;
    
    // Check if parent path is a prefix of child path
    for (let i = 0; i < parentPath.length; i++) {
      if (childPath[i] !== parentPath[i]) {
        return 0;
      }
    }
    
    return 1.0; // Parent path is a proper prefix
  }

  /**
   * Calculate position proximity between chunks
   */
  calculatePositionProximity(child, parent) {
    // If both have node IDs, use them for proximity calculation
    if (child.nodeId && parent.nodeId) {
      // Simple heuristic: closer node IDs suggest proximity
      const childNum = parseInt(child.nodeId.match(/\d+/)?.[0] || '0');
      const parentNum = parseInt(parent.nodeId.match(/\d+/)?.[0] || '0');
      const distance = Math.abs(childNum - parentNum);
      return Math.max(0, 1 - distance / 10); // Normalize distance
    }
    
    return 0.5; // Default neutral score
  }

  /**
   * Calculate semantic similarity between contents
   */
  calculateSemanticSimilarity(content1, content2) {
    // Use the same method as sentence similarity but for larger content
    const words1 = new Set(content1.toLowerCase().split(/\s+/).filter(word => word.length > 3));
    const words2 = new Set(content2.toLowerCase().split(/\s+/).filter(word => word.length > 3));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  findSiblingChunks(chunk, allChunks) {
    return allChunks.filter(sibling =>
      sibling.scale === chunk.scale &&
      sibling.id !== chunk.id &&
      sibling.hierarchyPath[0] === chunk.hierarchyPath[0]
    );
  }

  async detectSemanticBoundaries(chunk, config) {
    try {
      const sentences = this.sentenceTokenizer.tokenize(chunk.content);
      if (sentences.length <= 2) {
        return [chunk]; // Too short to split further
      }

      // Calculate sentence similarity scores
      const similarities = [];
      for (let i = 0; i < sentences.length - 1; i++) {
        const similarity = this.calculateSentenceSimilarity(sentences[i], sentences[i + 1]);
        similarities.push(similarity);
      }

      // Find semantic boundaries where similarity drops below threshold
      const boundaries = [0]; // Always start with first sentence
      const threshold = config.semanticCoherence.sentenceSimilarityThreshold;
      
      for (let i = 0; i < similarities.length; i++) {
        if (similarities[i] < threshold) {
          // Check if this creates a meaningful boundary
          const potentialBoundary = i + 1;
          if (potentialBoundary < sentences.length - 1) { // Don't create boundary at last sentence
            boundaries.push(potentialBoundary);
          }
        }
      }
      boundaries.push(sentences.length); // Always end with last sentence

      // Create chunks based on boundaries
      const semanticChunks = [];
      for (let i = 0; i < boundaries.length - 1; i++) {
        const startIdx = boundaries[i];
        const endIdx = boundaries[i + 1];
        const chunkSentences = sentences.slice(startIdx, endIdx);
        const chunkContent = chunkSentences.join(' ');
        
        // Only create chunk if it meets minimum requirements
        if (chunkContent.trim().length > 50) {
          semanticChunks.push({
            ...chunk,
            id: uuidv4(),
            content: chunkContent,
            tokenCount: this.getTokenCount(chunkContent),
            metadata: {
              ...chunk.metadata,
              semanticBoundary: true,
              boundaryIndex: i,
              sentenceRange: [startIdx, endIdx - 1]
            }
          });
        }
      }

      return semanticChunks.length > 0 ? semanticChunks : [chunk];
    } catch (error) {
      console.warn('⚠️ Semantic boundary detection failed, returning original chunk:', error.message);
      return [chunk];
    }
  }

  /**
   * Calculate similarity between two sentences using word overlap
   */
  calculateSentenceSimilarity(sentence1, sentence2) {
    const words1 = new Set(sentence1.toLowerCase().split(/\s+/).filter(word => word.length > 2));
    const words2 = new Set(sentence2.toLowerCase().split(/\s+/).filter(word => word.length > 2));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  calculateChunkQuality(chunk) {
    let quality = 0.5; // Base quality
    
    // Token count quality
    if (chunk.tokenCount >= 50 && chunk.tokenCount <= 500) {
      quality += 0.2;
    }
    
    // Content structure quality
    if (chunk.heading && chunk.heading.length > 0) {
      quality += 0.1;
    }
    
    // Hierarchy quality
    if (chunk.hierarchyPath && chunk.hierarchyPath.length > 1) {
      quality += 0.1;
    }
    
    // Content coherence (simple heuristic)
    const sentences = this.sentenceTokenizer.tokenize(chunk.content);
    if (sentences.length >= 2 && sentences.length <= 10) {
      quality += 0.1;
    }
    
    return Math.min(quality, 1.0);
  }

  calculateOverallQuality(chunks) {
    if (chunks.length === 0) return 0;
    
    const totalQuality = chunks.reduce((sum, chunk) => sum + (chunk.qualityScore || 0), 0);
    return totalQuality / chunks.length;
  }
}

module.exports = HierarchicalSemanticChunker;