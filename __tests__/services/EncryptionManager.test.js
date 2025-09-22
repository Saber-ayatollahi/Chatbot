/**
 * Unit Tests for EncryptionManager Service
 */

const EncryptionManager = require('../../services/EncryptionManager');
const fs = require('fs').promises;
const crypto = require('crypto');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn(),
  },
}));

jest.mock('../../utils/logger');
jest.mock('../../config/environment');

describe('EncryptionManager', () => {
  let encryptionManager;

  beforeEach(() => {
    // Mock config
    require('../../config/environment').getConfig = jest.fn().mockReturnValue({
      encryption: {
        keyDirectory: './test-keys',
      },
    });

    encryptionManager = new EncryptionManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully with new keys', async () => {
      // Mock directory creation
      fs.mkdir.mockResolvedValue();

      // Mock key file not existing (ENOENT)
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });

      // Mock successful key file writing
      fs.writeFile.mockResolvedValue();

      // Mock stat for RSA key creation time
      fs.stat.mockResolvedValue({ birthtime: new Date() });

      await encryptionManager.initialize();

      expect(encryptionManager.initialized).toBe(true);
      expect(fs.writeFile).toHaveBeenCalled(); // Keys should be generated and saved
    });

    it('should initialize with existing keys', async () => {
      // Mock directory creation
      fs.mkdir.mockResolvedValue();

      // Mock existing master key
      const mockMasterKey = {
        key: crypto.randomBytes(32).toString('hex'),
        salt: crypto.randomBytes(16).toString('hex'),
        created: new Date().toISOString(),
        algorithm: 'aes-256-gcm',
      };

      // Mock existing data keys
      const mockDataKey = {
        key: crypto.randomBytes(32).toString('hex'),
        created: new Date().toISOString(),
        algorithm: 'aes-256-gcm',
        keyType: 'audit',
      };

      // Mock existing RSA keys
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      fs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockMasterKey)) // master key
        .mockResolvedValueOnce(JSON.stringify(mockDataKey)) // audit key
        .mockResolvedValueOnce(JSON.stringify(mockDataKey)) // pii key
        .mockResolvedValueOnce(JSON.stringify(mockDataKey)) // session key
        .mockResolvedValueOnce(JSON.stringify(mockDataKey)) // metadata key
        .mockResolvedValueOnce(publicKey) // RSA public key
        .mockResolvedValueOnce(privateKey); // RSA private key

      fs.stat.mockResolvedValue({ birthtime: new Date() });

      await encryptionManager.initialize();

      expect(encryptionManager.initialized).toBe(true);
      expect(fs.writeFile).not.toHaveBeenCalled(); // Should not generate new keys
    });
  });

  describe('encrypt and decrypt', () => {
    beforeEach(async () => {
      // Setup encryption manager with mock keys
      fs.mkdir.mockResolvedValue();
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      fs.writeFile.mockResolvedValue();
      fs.stat.mockResolvedValue({ birthtime: new Date() });

      await encryptionManager.initialize();
    });

    it('should encrypt and decrypt data correctly', () => {
      const testData = { message: 'Hello, World!', timestamp: new Date().toISOString() };

      const encrypted = encryptionManager.encrypt(testData, 'audit');
      expect(encrypted).toBeDefined();
      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.algorithm).toBe('aes-256-gcm');
      expect(encrypted.keyType).toBe('audit');
      expect(encrypted.data).toBeDefined();

      const decrypted = encryptionManager.decrypt(encrypted, 'audit');
      expect(decrypted).toEqual(testData);
    });

    it('should handle string data', () => {
      const testString = 'This is a test string';

      const encrypted = encryptionManager.encrypt(testString, 'session');
      const decrypted = encryptionManager.decrypt(encrypted, 'session');

      expect(decrypted).toBe(testString);
    });

    it('should return null for null input', () => {
      const encrypted = encryptionManager.encrypt(null, 'audit');
      expect(encrypted).toBeNull();
    });

    it('should return unencrypted data if not encrypted', () => {
      const testData = { message: 'Not encrypted' };
      const result = encryptionManager.decrypt(testData, 'audit');
      expect(result).toBe(testData);
    });

    it('should throw error for invalid key type', () => {
      const testData = { message: 'Test' };
      expect(() => encryptionManager.encrypt(testData, 'invalid-key')).toThrow();
    });

    it('should throw error when not initialized', () => {
      const uninitializedManager = new EncryptionManager();
      expect(() => uninitializedManager.encrypt('test', 'audit')).toThrow('Encryption Manager not initialized');
    });
  });

  describe('RSA encryption', () => {
    beforeEach(async () => {
      fs.mkdir.mockResolvedValue();
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      fs.writeFile.mockResolvedValue();
      fs.stat.mockResolvedValue({ birthtime: new Date() });

      await encryptionManager.initialize();
    });

    it('should encrypt and decrypt with RSA', () => {
      const testData = 'RSA test data';

      const encrypted = encryptionManager.encryptRSA(testData);
      expect(encrypted).toBeDefined();
      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.algorithm).toBe('rsa');

      const decrypted = encryptionManager.decryptRSA(encrypted);
      expect(decrypted).toBe(testData);
    });

    it('should handle buffer input', () => {
      const testBuffer = Buffer.from('Buffer test data');

      const encrypted = encryptionManager.encryptRSA(testBuffer);
      const decrypted = encryptionManager.decryptRSA(encrypted);

      expect(decrypted).toBe(testBuffer.toString('utf8'));
    });
  });

  describe('hashing', () => {
    it('should hash data correctly', () => {
      const testData = 'test data for hashing';
      const hash = encryptionManager.hash(testData);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 hex length
    });

    it('should hash with salt', () => {
      const testData = 'test data';
      const salt = 'test salt';
      
      const hash1 = encryptionManager.hash(testData, salt);
      const hash2 = encryptionManager.hash(testData, salt);
      const hash3 = encryptionManager.hash(testData, 'different salt');

      expect(hash1).toBe(hash2); // Same salt should produce same hash
      expect(hash1).not.toBe(hash3); // Different salt should produce different hash
    });

    it('should generate and verify hash with salt', () => {
      const testData = 'password123';
      const hashData = encryptionManager.hashWithSalt(testData);

      expect(hashData).toHaveProperty('hash');
      expect(hashData).toHaveProperty('salt');
      expect(hashData).toHaveProperty('algorithm');

      const isValid = encryptionManager.verifyHash(testData, hashData);
      expect(isValid).toBe(true);

      const isInvalid = encryptionManager.verifyHash('wrongpassword', hashData);
      expect(isInvalid).toBe(false);
    });
  });

  describe('HMAC', () => {
    beforeEach(async () => {
      fs.mkdir.mockResolvedValue();
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      fs.writeFile.mockResolvedValue();
      fs.stat.mockResolvedValue({ birthtime: new Date() });

      await encryptionManager.initialize();
    });

    it('should create and verify HMAC', () => {
      const testData = 'data to sign';
      const hmac = encryptionManager.createHMAC(testData);

      expect(hmac).toBeDefined();
      expect(typeof hmac).toBe('string');

      const isValid = encryptionManager.verifyHMAC(testData, hmac);
      expect(isValid).toBe(true);

      const isInvalid = encryptionManager.verifyHMAC('tampered data', hmac);
      expect(isInvalid).toBe(false);
    });

    it('should use custom secret', () => {
      const testData = 'data to sign';
      const customSecret = 'custom-secret-key';
      
      const hmac = encryptionManager.createHMAC(testData, customSecret);
      const isValid = encryptionManager.verifyHMAC(testData, hmac, customSecret);
      
      expect(isValid).toBe(true);
    });
  });

  describe('key derivation', () => {
    it('should derive key from password', () => {
      const password = 'user-password';
      const keyData = encryptionManager.deriveKey(password);

      expect(keyData).toHaveProperty('key');
      expect(keyData).toHaveProperty('salt');
      expect(keyData).toHaveProperty('iterations');
      expect(keyData).toHaveProperty('algorithm');

      expect(keyData.key).toBeDefined();
      expect(keyData.salt).toBeDefined();
      expect(keyData.iterations).toBe(100000);
    });

    it('should derive same key with same password and salt', () => {
      const password = 'user-password';
      const keyData1 = encryptionManager.deriveKey(password);
      const keyData2 = encryptionManager.deriveKey(password, keyData1.salt, keyData1.iterations);

      expect(keyData1.key).toBe(keyData2.key);
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      fs.mkdir.mockResolvedValue();
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      fs.writeFile.mockResolvedValue();
      fs.stat.mockResolvedValue({ birthtime: new Date() });

      await encryptionManager.initialize();
    });

    it('should generate secure token', () => {
      const token = encryptionManager.generateSecureToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes * 2 (hex)

      const customLengthToken = encryptionManager.generateSecureToken(16);
      expect(customLengthToken.length).toBe(32); // 16 bytes * 2 (hex)
    });

    it('should generate UUID', () => {
      const uuid = encryptionManager.generateUUID();
      expect(uuid).toBeDefined();
      expect(typeof uuid).toBe('string');
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should get encryption stats', () => {
      const stats = encryptionManager.getEncryptionStats();
      expect(stats).toHaveProperty('initialized', true);
      expect(stats).toHaveProperty('algorithms');
      expect(stats).toHaveProperty('keys');
      expect(stats).toHaveProperty('timestamp');
    });

    it('should get public key', () => {
      const publicKey = encryptionManager.getPublicKey();
      expect(publicKey).toBeDefined();
      expect(typeof publicKey).toBe('string');
      expect(publicKey).toContain('BEGIN PUBLIC KEY');
    });
  });

  describe('validateIntegrity', () => {
    beforeEach(async () => {
      fs.mkdir.mockResolvedValue();
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      fs.writeFile.mockResolvedValue();
      fs.stat.mockResolvedValue({ birthtime: new Date() });

      await encryptionManager.initialize();
    });

    it('should validate integrity successfully', async () => {
      const results = await encryptionManager.validateIntegrity();

      expect(results).toHaveProperty('valid', true);
      expect(results).toHaveProperty('checks');
      expect(results).toHaveProperty('errors');
      expect(results.checks.length).toBeGreaterThan(0);
      expect(results.errors.length).toBe(0);
    });
  });

  describe('specialized encryption methods', () => {
    beforeEach(async () => {
      fs.mkdir.mockResolvedValue();
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      fs.writeFile.mockResolvedValue();
      fs.stat.mockResolvedValue({ birthtime: new Date() });

      await encryptionManager.initialize();
    });

    it('should encrypt and decrypt audit data', () => {
      const auditData = {
        user_query: 'Test query',
        final_response: 'Test response',
        metadata: { test: true },
      };

      const encrypted = encryptionManager.encryptAuditData(auditData);
      expect(encrypted.user_query.encrypted).toBe(true);
      expect(encrypted.final_response.encrypted).toBe(true);
      expect(encrypted.metadata.encrypted).toBe(true);

      const decrypted = encryptionManager.decryptAuditData(encrypted);
      expect(decrypted).toEqual(auditData);
    });

    it('should encrypt and decrypt PII data', () => {
      const piiData = 'Sensitive PII information';

      const encrypted = encryptionManager.encryptPII(piiData);
      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.keyType).toBe('pii');

      const decrypted = encryptionManager.decryptPII(encrypted);
      expect(decrypted).toBe(piiData);
    });

    it('should encrypt and decrypt session data', () => {
      const sessionData = { userId: '123', sessionId: 'abc', preferences: {} };

      const encrypted = encryptionManager.encryptSessionData(sessionData);
      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.keyType).toBe('session');

      const decrypted = encryptionManager.decryptSessionData(encrypted);
      expect(decrypted).toEqual(sessionData);
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      fs.mkdir.mockResolvedValue();
      fs.readFile.mockRejectedValue({ code: 'ENOENT' });
      fs.writeFile.mockResolvedValue();
      fs.stat.mockResolvedValue({ birthtime: new Date() });

      await encryptionManager.initialize();
    });

    it('should close and cleanup', async () => {
      expect(encryptionManager.initialized).toBe(true);

      await encryptionManager.close();

      expect(encryptionManager.initialized).toBe(false);
    });
  });
});
