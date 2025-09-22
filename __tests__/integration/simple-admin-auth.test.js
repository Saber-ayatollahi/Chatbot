const request = require('supertest');
const express = require('express');

const initialConfigStore = {
  rag: {
    response: {
      confidenceThreshold: 0.6,
      maxTokens: 1000,
      temperature: 0.3,
      enableCitationValidation: true,
    },
    retrieval: {
      maxChunks: 5,
      diversityThreshold: 0.8,
      enableHybridSearch: false,
    },
    confidence: {
      minimumThreshold: 0.6,
    },
  },
  vector: {
    maxRetrievedChunks: 5,
  },
};

let configStore = JSON.parse(JSON.stringify(initialConfigStore));

const syncTopLevelReferences = (config) => {
  config.rag = configStore.rag;
  config.vector = configStore.vector;
};

const configStub = {
  get(path) {
    return path.split('.').reduce((acc, key) => (acc !== undefined ? acc[key] : undefined), configStore);
  },
  set(path, value) {
    const keys = path.split('.');
    let current = configStore;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
    syncTopLevelReferences(configStub);
    return value;
  },
  reset() {
    configStore = JSON.parse(JSON.stringify(initialConfigStore));
    syncTopLevelReferences(configStub);
  },
};

syncTopLevelReferences(configStub);

jest.mock('../../config/environment', () => {
  const actual = jest.requireActual('../../config/environment');
  return {
    ...actual,
    getConfig: jest.fn(() => configStub),
  };
});

const createSimpleAdminRouter = require('../../routes/simple-admin');
const { getConfig } = require('../../config/environment');

class MockRBACManager {
  constructor(tokensByValue) {
    this.tokensByValue = tokensByValue;
  }

  createAuthMiddleware(requiredPermission) {
    return (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization token required' });
      }

      const tokenValue = authHeader.substring(7);
      const user = this.tokensByValue[tokenValue];

      if (!user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      if (requiredPermission && !user.permissions.includes(requiredPermission)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: requiredPermission,
        });
      }

      req.user = user;
      req.token = tokenValue;
      next();
    };
  }
}

describe('Simple Admin RAG configuration authorization', () => {
  let app;
  let configManager;
  const TOKENS = {
    admin: 'admin-token',
    compliance: 'compliance-token',
    analyst: 'analyst-token',
  };

  beforeAll(() => {
    configManager = getConfig();
    configManager.reset();
  });

  beforeEach(() => {
    const mockRBACManager = new MockRBACManager({
      [TOKENS.admin]: {
        id: 1,
        username: 'admin-user',
        role: 'admin',
        permissions: ['system:monitor', 'system:configure'],
      },
      [TOKENS.compliance]: {
        id: 2,
        username: 'compliance-user',
        role: 'compliance_officer',
        permissions: ['system:monitor'],
      },
      [TOKENS.analyst]: {
        id: 3,
        username: 'analyst-user',
        role: 'analyst',
        permissions: ['data:read'],
      },
    });

    app = express();
    app.use(express.json());
    app.use('/api/admin', createSimpleAdminRouter({ rbacManager: mockRBACManager }));
  });

  afterEach(() => {
    configManager.reset();
  });

  describe('GET /api/admin/rag/config', () => {
    it('rejects requests without authentication', async () => {
      const response = await request(app).get('/api/admin/rag/config');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Authorization token required' });
    });

    it('allows roles with monitor permission to view the configuration', async () => {
      const response = await request(app)
        .get('/api/admin/rag/config')
        .set('Authorization', `Bearer ${TOKENS.compliance}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.config).toMatchObject({
        confidenceThreshold: expect.any(Number),
        responseMaxTokens: expect.any(Number),
        responseTemperature: expect.any(Number),
      });
    });

    it('rejects roles without the required permission', async () => {
      const response = await request(app)
        .get('/api/admin/rag/config')
        .set('Authorization', `Bearer ${TOKENS.analyst}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'Insufficient permissions',
        required: 'system:monitor',
      });
    });
  });

  describe('PUT /api/admin/rag/config', () => {
    it('rejects updates without authentication', async () => {
      const response = await request(app)
        .put('/api/admin/rag/config')
        .send({ responseMaxTokens: 1200 });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Authorization token required' });
    });

    it('rejects updates for roles without configure permission', async () => {
      const response = await request(app)
        .put('/api/admin/rag/config')
        .set('Authorization', `Bearer ${TOKENS.compliance}`)
        .send({ responseMaxTokens: 1500 });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'Insufficient permissions',
        required: 'system:configure',
      });
    });

    it('allows administrator roles to update configuration and persists changes', async () => {
      const payload = {
        confidenceThreshold: 0.7,
        responseMaxTokens: 1600,
        responseTemperature: 0.45,
        enableCitationValidation: false,
        retrievalMaxChunks: 7,
        diversityThreshold: 0.85,
        enableHybridSearch: true,
      };

      const response = await request(app)
        .put('/api/admin/rag/config')
        .set('Authorization', `Bearer ${TOKENS.admin}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.updates).toMatchObject(payload);

      expect(configManager.get('rag.response.confidenceThreshold')).toBe(payload.confidenceThreshold);
      expect(configManager.get('rag.response.maxTokens')).toBe(payload.responseMaxTokens);
      expect(configManager.get('rag.response.temperature')).toBe(payload.responseTemperature);
      expect(configManager.get('rag.response.enableCitationValidation')).toBe(payload.enableCitationValidation);
      expect(configManager.get('rag.retrieval.maxChunks')).toBe(payload.retrievalMaxChunks);
      expect(configManager.get('vector.maxRetrievedChunks')).toBe(payload.retrievalMaxChunks);
      expect(configManager.get('rag.retrieval.diversityThreshold')).toBe(payload.diversityThreshold);
      expect(configManager.get('rag.retrieval.enableHybridSearch')).toBe(payload.enableHybridSearch);
    });
  });
});
