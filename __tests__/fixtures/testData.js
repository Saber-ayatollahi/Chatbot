/**
 * Test Data Fixtures
 * Provides consistent test data for all test suites
 */

const testChunks = [
  {
    chunk_id: 'test-chunk-1',
    content: 'Fund creation requires establishing clear investment objectives and regulatory compliance. The process involves multiple steps including documentation, approval, and ongoing monitoring.',
    similarity_score: 0.85,
    quality_score: 0.9,
    citation: { 
      source: 'Fund Management Guide', 
      page: 12,
      section: 'Fund Creation Process'
    },
    content_type: 'text',
    token_count: 45,
    metadata: {
      section_path: ['Chapter 1', 'Fund Creation'],
      importance: 'high'
    }
  },
  {
    chunk_id: 'test-chunk-2', 
    content: 'Portfolio management involves strategic asset allocation, risk assessment, and performance monitoring to achieve investment objectives while maintaining regulatory compliance.',
    similarity_score: 0.78,
    quality_score: 0.85,
    citation: {
      source: 'Portfolio Management Manual',
      page: 25,
      section: 'Asset Allocation Strategies'
    },
    content_type: 'text',
    token_count: 38,
    metadata: {
      section_path: ['Chapter 2', 'Portfolio Management'],
      importance: 'medium'
    }
  },
  {
    chunk_id: 'test-chunk-3',
    content: 'Compliance requirements include maintaining detailed audit trails, regular reporting to regulatory bodies, and adherence to established risk management frameworks.',
    similarity_score: 0.72,
    quality_score: 0.88,
    citation: {
      source: 'Compliance Handbook',
      page: 8,
      section: 'Regulatory Requirements'
    },
    content_type: 'text',
    token_count: 42,
    metadata: {
      section_path: ['Chapter 3', 'Compliance'],
      importance: 'high'
    }
  }
];

const testSources = [
  {
    source_id: 'source-1',
    filename: 'fund_management_guide.pdf',
    title: 'Fund Management Guide',
    author: 'Financial Regulatory Authority',
    version: '1.0',
    processing_status: 'completed',
    total_chunks: 150,
    created_at: new Date('2024-01-01').toISOString()
  },
  {
    source_id: 'source-2',
    filename: 'portfolio_manual.pdf', 
    title: 'Portfolio Management Manual',
    author: 'Investment Management Institute',
    version: '2.1',
    processing_status: 'completed',
    total_chunks: 200,
    created_at: new Date('2024-02-01').toISOString()
  },
  {
    source_id: 'source-3',
    filename: 'compliance_handbook.pdf',
    title: 'Compliance Handbook',
    author: 'Regulatory Compliance Board',
    version: '1.5',
    processing_status: 'completed',
    total_chunks: 100,
    created_at: new Date('2024-03-01').toISOString()
  }
];

const testAuditLogs = [
  {
    id: 'audit-1',
    session_id: 'session-1',
    user_query: 'How do I create a new fund?',
    final_response: 'To create a fund, you need to follow these steps: 1) Define investment objectives, 2) Establish legal structure, 3) Register with regulators. (Fund Management Guide, p.12)',
    confidence_score: 0.85,
    response_time_ms: 1250,
    sources_used: ['source-1'],
    created_at: new Date().toISOString()
  },
  {
    id: 'audit-2',
    session_id: 'session-2', 
    user_query: 'What are portfolio management best practices?',
    final_response: 'Portfolio management best practices include strategic asset allocation, regular risk assessment, and performance monitoring according to established guidelines.',
    confidence_score: 0.78,
    response_time_ms: 980,
    sources_used: ['source-2'],
    created_at: new Date().toISOString()
  }
];

const testUserSessions = [
  {
    session_id: 'session-1',
    user_id: 'user-1',
    started_at: new Date().toISOString(),
    last_activity: new Date().toISOString(),
    query_count: 5,
    status: 'active'
  },
  {
    session_id: 'session-2',
    user_id: 'user-2', 
    started_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    last_activity: new Date().toISOString(),
    query_count: 3,
    status: 'active'
  }
];

const testFeedback = [
  {
    id: 'feedback-1',
    session_id: 'session-1',
    query: 'How do I create a new fund?',
    response_id: 'response-1',
    rating: 5,
    feedback_text: 'Very helpful and comprehensive answer',
    created_at: new Date().toISOString()
  },
  {
    id: 'feedback-2',
    session_id: 'session-2',
    query: 'What are portfolio management best practices?',
    response_id: 'response-2', 
    rating: 4,
    feedback_text: 'Good information but could use more examples',
    created_at: new Date().toISOString()
  }
];

// Mock database responses for different query types
const mockDatabaseResponses = {
  // Knowledge base queries
  'SELECT * FROM kb_chunks WHERE content = $1': { rows: [{ 
    id: 1, 
    content: 'test content', 
    embedding_text: '[0.1,0.1,0.1]', 
    token_count: 10, 
    character_count: 50, 
    word_count: 8 
  }] }, // Single row query - return one row for test content
  'SELECT * FROM kb_chunks': { rows: testChunks },
  'SELECT * FROM kb_sources': { rows: testSources },
  
  // Audit log queries
  'SELECT * FROM audit_logs': { rows: testAuditLogs },
  'INSERT INTO audit_logs': { rows: [{ id: 'new-audit-id' }], rowCount: 1 },
  
  // Ingestion job queries
  'INSERT INTO ingestion_jobs': { rows: [{ job_id: 'test-job-123' }], rowCount: 1 },
  'SELECT * FROM ingestion_jobs': { rows: [{ job_id: 'test-job-123', job_status: 'completed', source_id: 'test-source' }] },
  'UPDATE ingestion_jobs': { rows: [], rowCount: 1 },
  
  // Session queries
  'SELECT * FROM user_sessions': { rows: testUserSessions },
  
  // Feedback queries
  'SELECT * FROM feedback': { rows: testFeedback },
  
  // Count queries
  'SELECT COUNT(*)': { rows: [{ count: '42', total: '42' }] },
  
  // User management queries
  'SELECT COUNT(*) FROM users': { rows: [{ count: '0' }] },
  'INSERT INTO users': { rows: [{ user_id: 'admin-user-123' }], rowCount: 1 },
  'SELECT * FROM users': { rows: [{ user_id: 'admin-user-123', username: 'admin', role: 'admin' }] },
  
  // Health check queries
  'SELECT NOW()': { rows: [{ current_time: new Date(), postgres_version: 'PostgreSQL 14.0' }] },
  
  // pgvector extension queries
  'SELECT EXISTS': { rows: [{ has_pgvector: true, has_vector: true }] },
  'SELECT vector_dims': { rows: [{ dims: 3072 }] },
  
  // Schema queries
  'SELECT table_name': { 
    rows: [
      { table_name: 'kb_sources' },
      { table_name: 'kb_chunks' },
      { table_name: 'audit_logs' },
      { table_name: 'user_sessions' },
      { table_name: 'feedback' },
      { table_name: 'system_metrics' },
      { table_name: 'compliance_reports' }
    ] 
  },
  
  'SELECT column_name': {
    rows: [
      { column_name: 'id' },
      { column_name: 'chunk_id' },
      { column_name: 'embedding' },
      { column_name: 'embedding_json' },
      { column_name: 'token_count' },
      { column_name: 'character_count' },
      { column_name: 'word_count' },
      { column_name: 'quality_score' },
      { column_name: 'metadata' },
      { column_name: 'created_at' },
      { column_name: 'updated_at' }
    ]
  }
};

// Helper function to get mock response for a query
const getMockResponse = (query) => {
  const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Specific query patterns for more accurate matching
  const specificPatterns = {
    'select count(*) as count from users where role in': { rows: [{ count: '0' }] },
    'select count(*) from users where role': { rows: [{ count: '0' }] },
    'select exists(select 1 from': { rows: [{ has_pgvector: true, has_vector: true }] },
    'select vector_dims(': { rows: [{ dims: 3072 }] },
    'select 1 as test_value': { rows: [{ test_value: 1 }] }, // For query caching tests (must come first)
    'select 1 as test': { rows: [{ test: 1 }] }, // For database query option tests
  };
  
  // Check specific patterns first
  for (const [pattern, response] of Object.entries(specificPatterns)) {
    if (normalizedQuery.includes(pattern)) {
      return response;
    }
  }
  
  // Find matching response based on query content
  for (const [pattern, response] of Object.entries(mockDatabaseResponses)) {
    if (query.includes(pattern) || query.toLowerCase().includes(pattern.toLowerCase())) {
      return response;
    }
  }
  
  // Default empty response
  return { rows: [], rowCount: 0 };
};

module.exports = {
  testChunks,
  testSources,
  testAuditLogs,
  testUserSessions,
  testFeedback,
  mockDatabaseResponses,
  getMockResponse
};
