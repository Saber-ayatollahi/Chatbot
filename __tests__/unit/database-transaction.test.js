/**
 * Database Transaction Pattern Tests
 * Critical Issue #1 - Verify transaction wrapper works correctly
 */

// Unmock the database module for this test to use the real DatabaseConfig
jest.unmock('../../config/database');
const { DatabaseConfig } = require('../../config/database');

// Mock PostgreSQL pool
const mockPool = {
  connect: jest.fn(),
  end: jest.fn(),
  totalCount: 0,
  idleCount: 0,
  waitingCount: 0
};

const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

jest.mock('pg', () => ({
  Pool: jest.fn(() => mockPool)
}));

describe('Database Transaction Pattern', () => {
  let db;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock client connection
    mockPool.connect.mockResolvedValue(mockClient);
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
    
    // Create database instance with mock config
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'test_db';
    process.env.DB_USER = 'test_user';
    process.env.DB_PASSWORD = 'test_pass';
    
    db = new DatabaseConfig();
    db.pool = mockPool;
    db.isConnected = true;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('CRITICAL: Transaction Wrapper Interface', () => {
    test('should provide db.query interface to transaction callback', async () => {
      // Arrange
      const testQuery = 'INSERT INTO test_table VALUES ($1, $2)';
      const testParams = ['value1', 'value2'];
      let capturedDb;

      // Act
      await db.transaction(async (transactionDb) => {
        capturedDb = transactionDb;
        await transactionDb.query(testQuery, testParams);
      });

      // Assert
      expect(capturedDb).toBeDefined();
      expect(typeof capturedDb.query).toBe('function');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(testQuery, testParams);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('should rollback transaction on error', async () => {
      // Arrange
      const testError = new Error('Test transaction error');
      mockClient.query.mockImplementation((query) => {
        if (query === 'BEGIN') return Promise.resolve();
        if (query === 'ROLLBACK') return Promise.resolve();
        throw testError;
      });

      // Act & Assert
      await expect(
        db.transaction(async (transactionDb) => {
          await transactionDb.query('FAILING QUERY');
        })
      ).rejects.toThrow('Test transaction error');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('should prevent nested transactions', async () => {
      // Act & Assert
      await db.transaction(async (transactionDb) => {
        expect(() => {
          transactionDb.transaction(() => {});
        }).toThrow('Nested transactions not supported');
      });
    });

    test('should handle multiple queries in single transaction', async () => {
      // Arrange
      const queries = [
        'INSERT INTO table1 VALUES ($1)',
        'UPDATE table2 SET col = $1 WHERE id = $2',
        'DELETE FROM table3 WHERE id = $1'
      ];

      // Act
      await db.transaction(async (transactionDb) => {
        for (const query of queries) {
          await transactionDb.query(query, ['test']);
        }
      });

      // Assert
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      queries.forEach(query => {
        expect(mockClient.query).toHaveBeenCalledWith(query, ['test']);
      });
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('CRITICAL: Real-world Usage Patterns', () => {
    test('should work with IngestionPipeline pattern', async () => {
      // Simulate IngestionPipeline.storeSourceMetadata usage
      const sourceMetadata = {
        sourceId: 'test-source',
        filename: 'test.pdf',
        filePath: '/path/to/test.pdf',
        fileSize: 1024,
        fileHash: 'abc123',
        version: '1.0'
      };

      await db.transaction(async (transactionDb) => {
        // This pattern should work now
        await transactionDb.query(`
          INSERT INTO kb_sources (
            source_id, filename, file_path, file_size, file_hash, version
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          sourceMetadata.sourceId,
          sourceMetadata.filename,
          sourceMetadata.filePath,
          sourceMetadata.fileSize,
          sourceMetadata.fileHash,
          sourceMetadata.version
        ]);
      });

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    test('should work with schema initialization pattern', async () => {
      // Simulate database.initializeSchema usage
      const mockStatements = [
        'CREATE TABLE test1 (id SERIAL PRIMARY KEY)',
        'CREATE TABLE test2 (id SERIAL PRIMARY KEY)',
        'CREATE INDEX idx_test1 ON test1 (id)'
      ];

      await db.transaction(async (transactionDb) => {
        for (const statement of mockStatements) {
          await transactionDb.query(statement);
        }
      });

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      mockStatements.forEach(statement => {
        expect(mockClient.query).toHaveBeenCalledWith(statement);
      });
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('Error Handling', () => {
    test('should handle connection errors gracefully', async () => {
      // Arrange
      mockPool.connect.mockRejectedValue(new Error('Connection failed'));

      // Act & Assert
      await expect(
        db.transaction(async (transactionDb) => {
          await transactionDb.query('SELECT 1');
        })
      ).rejects.toThrow('Connection failed');
    });

    test('should handle rollback errors', async () => {
      // Arrange
      mockClient.query.mockImplementation((query) => {
        if (query === 'BEGIN') return Promise.resolve();
        if (query === 'ROLLBACK') throw new Error('Rollback failed');
        throw new Error('Query failed');
      });

      // Act & Assert
      await expect(
        db.transaction(async (transactionDb) => {
          await transactionDb.query('FAILING QUERY');
        })
      ).rejects.toThrow('Query failed'); // Original error should be thrown
    });
  });
});
