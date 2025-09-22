/**
 * OpenAI API Mock System
 * Provides comprehensive OpenAI API mocking for all tests
 */

class MockOpenAI {
  constructor(config = {}) {
    this.apiKey = config.apiKey || 'test-key';
    this.chat = new MockChatCompletions();
    this.embeddings = new MockEmbeddings();
  }
}

class MockChatCompletions {
  constructor() {
    this.completions = {
      create: jest.fn().mockImplementation(async (params) => {
        const messages = params.messages || [];
        const lastMessage = messages[messages.length - 1];
        const userQuery = lastMessage?.content || 'test query';
        
        // Generate contextual responses based on query content
        let responseContent = 'I apologize, but I don\'t have specific information about that topic.';
        
        if (userQuery.toLowerCase().includes('fund')) {
          responseContent = 'To create a fund, you need to follow these steps: 1) Define investment objectives, 2) Establish legal structure, 3) Register with regulators. (Guide 1, p.12)';
        } else if (userQuery.toLowerCase().includes('portfolio')) {
          responseContent = 'Portfolio management involves asset allocation, risk assessment, and performance monitoring according to regulatory guidelines.';
        } else if (userQuery.toLowerCase().includes('compliance')) {
          responseContent = 'Compliance requirements include regular reporting, audit trails, and adherence to regulatory frameworks.';
        }
        
        return {
          choices: [{
            message: { 
              content: responseContent,
              role: 'assistant'
            },
            finish_reason: 'stop'
          }],
          model: params.model || 'gpt-4',
          usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150
          },
          created: Math.floor(Date.now() / 1000),
          id: `chatcmpl-${Math.random().toString(36).substr(2, 9)}`
        };
      })
    };
  }
}

class MockEmbeddings {
  constructor() {
    this.create = jest.fn().mockImplementation(async (params) => {
      const input = params.input;
      const inputArray = Array.isArray(input) ? input : [input];
      
      // Generate deterministic embeddings based on input
      const embeddings = inputArray.map((text, index) => {
        const embedding = new Array(3072).fill(0).map((_, i) => {
          // Create pseudo-random but deterministic embeddings
          const seed = text.length + i + index;
          return (Math.sin(seed) * 0.5);
        });
        
        return {
          object: 'embedding',
          embedding: embedding,
          index: index
        };
      });
      
      return {
        object: 'list',
        data: embeddings,
        model: params.model || 'text-embedding-3-large',
        usage: {
          prompt_tokens: inputArray.join(' ').split(' ').length,
          total_tokens: inputArray.join(' ').split(' ').length
        }
      };
    });
  }
}

// Mock OpenAI module for tests
const mockOpenAI = () => {
  // Mock the OpenAI constructor
  const MockedOpenAI = jest.fn().mockImplementation((config) => new MockOpenAI(config));
  
  // Add static properties that some code might expect
  MockedOpenAI.OpenAI = MockedOpenAI;
  
  jest.doMock('openai', () => MockedOpenAI);
  
  return MockedOpenAI;
};

// Error simulation for testing error handling
const mockOpenAIWithError = (errorType = 'rate_limit') => {
  const errorMap = {
    'rate_limit': {
      code: 'rate_limit_exceeded',
      status: 429,
      message: 'Rate limit exceeded'
    },
    'invalid_api_key': {
      code: 'invalid_api_key',
      status: 401,
      message: 'Incorrect API key provided'
    },
    'insufficient_quota': {
      code: 'insufficient_quota',
      status: 429,
      message: 'You exceeded your current quota'
    }
  };
  
  const error = errorMap[errorType] || errorMap['rate_limit'];
  
  const MockedOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockRejectedValue(error)
      }
    },
    embeddings: {
      create: jest.fn().mockRejectedValue(error)
    }
  }));
  
  jest.doMock('openai', () => MockedOpenAI);
  
  return MockedOpenAI;
};

module.exports = {
  MockOpenAI,
  MockChatCompletions,
  MockEmbeddings,
  mockOpenAI,
  mockOpenAIWithError
};
