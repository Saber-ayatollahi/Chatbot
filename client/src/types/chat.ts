export interface Citation {
  id?: number;
  text: string;
  source: string;
  page?: number | string;
  section?: string;
  chunk_id?: string;
  position?: number;
  isValid?: boolean;
}

export interface Source {
  title: string;
  page?: number | string;
  section?: string;
  relevance_score?: number;
  content_type?: string;
  chunk_id?: string;
}

export interface QualityIndicators {
  hasRelevantSources: boolean;
  citationsPresent: boolean;
  confidenceAboveThreshold: boolean;
  responseComplete: boolean;
}

export interface RetrievalMetadata {
  strategy?: string;
  rerankingModel?: string;
  chunksRetrieved?: number;
  retrievalConfidence?: number;
  retrievalTime?: number;
  queryAnalysis?: {
    queryType?: string;
    complexity?: string;
    entities?: string[];
    keywords?: string[];
  };
}

export interface GenerationMetadata {
  model?: string;
  tokensUsed?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  generationTime?: number;
  temperature?: number;
}

export interface ProcessingMetadata {
  totalTime: number;
  useRAG: boolean;
  processingSteps: Array<{
    step: string;
    startTime?: number;
    endTime?: number;
    success?: boolean;
    error?: string;
    strategy?: string;
  }>;
  endTime: number;
}

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  isError?: boolean;
  
  // RAG-enhanced properties for assistant messages
  useKnowledgeBase?: boolean;
  confidence?: number;
  confidenceLevel?: 'very_low' | 'low' | 'medium' | 'high';
  citations?: Citation[];
  sources?: Source[];
  qualityIndicators?: QualityIndicators;
  retrievalMetadata?: RetrievalMetadata;
  generationMetadata?: GenerationMetadata;
  processingMetadata?: ProcessingMetadata;
  warnings?: string[];
  suggestions?: string[];
  fallbackApplied?: boolean;
  
  // Feedback properties
  feedbackSubmitted?: 'positive' | 'negative';
  feedbackId?: string;
  
  // UI-specific properties
  isExpanded?: boolean;
  showSources?: boolean;
  showMetadata?: boolean;
}

export interface EnhancedChatResponse {
  message: string;
  sessionId: string;
  timestamp: string;
  
  // RAG-specific data
  useKnowledgeBase: boolean;
  confidence: number;
  confidenceLevel: 'very_low' | 'low' | 'medium' | 'high';
  citations: Citation[];
  sources: Source[];
  qualityIndicators: QualityIndicators;
  retrievalMetadata?: RetrievalMetadata;
  generationMetadata?: GenerationMetadata;
  processingMetadata?: ProcessingMetadata;
  
  // Additional response data
  processingTime: number;
  warnings?: string[];
  suggestions?: string[];
  fallbackApplied?: boolean;
  error?: {
    occurred: boolean;
    type: string;
    message: string;
  };
}

export interface ChatResponse {
  message: string;
  sessionId: string;
  timestamp: string;
}

export interface ChatError {
  error: string;
  details?: string;
  code?: string;
  fallbackResponse?: {
    message: string;
    useKnowledgeBase: boolean;
    confidence: number;
    confidenceLevel: string;
    citations: Citation[];
    sources: Source[];
    fallbackApplied: boolean;
    error: {
      occurred: boolean;
      type: string;
      message: string;
    };
  };
}

export interface ChatSettings {
  useKnowledgeBase: boolean;
  maxChunks: number;
  retrievalStrategy: 'vector_only' | 'hybrid' | 'contextual' | 'multi_scale' | 'advanced_multi_feature';
  citationFormat: 'inline' | 'detailed' | 'academic' | 'numbered';
  templateType?: 'standard' | 'definition' | 'procedure' | 'comparison' | 'troubleshooting' | 'list' | 'contextual';
  confidenceThreshold?: number;
  showConfidence: boolean;
  showSources: boolean;
  showProcessingTime: boolean;
}

export interface UITheme {
  mode: 'light' | 'dark';
  primaryColor: string;
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
}
