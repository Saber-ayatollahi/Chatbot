/**
 * Encryption Manager
 * Comprehensive encryption service for data at rest and in transit
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { getConfig } = require('../config/environment');

class EncryptionManager {
  constructor() {
    this.config = getConfig();
    
    // Robust configuration handling for both runtime and test environments
    this.encryptionConfig = this.config?.encryption || {
      keyDirectory: path.join(process.cwd(), 'keys'),
      algorithm: 'aes-256-gcm',
      keyRotationDays: 90,
    };
    
    this.algorithms = {
      symmetric: 'aes-256-gcm',
      asymmetric: 'rsa',
      hash: 'sha256',
      keyDerivation: 'pbkdf2',
    };
    this.keyCache = new Map();
    this.initialized = false;
  }

  /**
   * Initialize encryption manager
   */
  async initialize() {
    try {
      await this.loadOrGenerateKeys();
      this.initialized = true;
      
      logger.info('Encryption Manager initialized successfully', {
        algorithms: this.algorithms,
        keysLoaded: this.keyCache.size,
      });

    } catch (error) {
      logger.error('Failed to initialize Encryption Manager:', error);
      throw error;
    }
  }

  /**
   * Load or generate encryption keys
   */
  async loadOrGenerateKeys() {
    const keyDir = this.encryptionConfig.keyDirectory;
    
    try {
      await fs.mkdir(keyDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }

    // Load or generate master key
    await this.loadOrGenerateMasterKey(keyDir);
    
    // Load or generate data encryption keys
    await this.loadOrGenerateDataKeys(keyDir);
    
    // Load or generate RSA key pair for asymmetric encryption
    await this.loadOrGenerateRSAKeys(keyDir);
  }

  /**
   * Load or generate master key
   */
  async loadOrGenerateMasterKey(keyDir) {
    const masterKeyPath = path.join(keyDir, 'master.key');
    
    try {
      const masterKeyData = await fs.readFile(masterKeyPath);
      const masterKey = JSON.parse(masterKeyData.toString());
      
      this.keyCache.set('master', {
        key: Buffer.from(masterKey.key, 'hex'),
        salt: Buffer.from(masterKey.salt, 'hex'),
        created: new Date(masterKey.created),
      });
      
      logger.info('Master key loaded from file');
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Generate new master key
        const masterKey = crypto.randomBytes(32);
        const salt = crypto.randomBytes(16);
        
        const keyData = {
          key: masterKey.toString('hex'),
          salt: salt.toString('hex'),
          created: new Date().toISOString(),
          algorithm: this.algorithms.symmetric,
        };
        
        await fs.writeFile(masterKeyPath, JSON.stringify(keyData, null, 2), { mode: 0o600 });
        
        this.keyCache.set('master', {
          key: masterKey,
          salt: salt,
          created: new Date(),
        });
        
        logger.info('New master key generated and saved');
        
      } else {
        throw error;
      }
    }
  }

  /**
   * Load or generate data encryption keys
   */
  async loadOrGenerateDataKeys(keyDir) {
    const dataKeyTypes = ['audit', 'pii', 'session', 'metadata'];
    
    for (const keyType of dataKeyTypes) {
      const keyPath = path.join(keyDir, `${keyType}.key`);
      
      try {
        const keyData = await fs.readFile(keyPath);
        const parsedKey = JSON.parse(keyData.toString());
        
        this.keyCache.set(keyType, {
          key: Buffer.from(parsedKey.key, 'hex'),
          created: new Date(parsedKey.created),
          rotatedAt: parsedKey.rotatedAt ? new Date(parsedKey.rotatedAt) : null,
        });
        
      } catch (error) {
        if (error.code === 'ENOENT') {
          // Generate new data key
          const dataKey = crypto.randomBytes(32);
          
          const keyData = {
            key: dataKey.toString('hex'),
            created: new Date().toISOString(),
            algorithm: this.algorithms.symmetric,
            keyType: keyType,
          };
          
          await fs.writeFile(keyPath, JSON.stringify(keyData, null, 2), { mode: 0o600 });
          
          this.keyCache.set(keyType, {
            key: dataKey,
            created: new Date(),
            rotatedAt: null,
          });
          
          logger.info(`New ${keyType} data key generated`);
          
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Load or generate RSA key pair
   */
  async loadOrGenerateRSAKeys(keyDir) {
    const publicKeyPath = path.join(keyDir, 'public.pem');
    const privateKeyPath = path.join(keyDir, 'private.pem');
    
    try {
      const publicKey = await fs.readFile(publicKeyPath, 'utf8');
      const privateKey = await fs.readFile(privateKeyPath, 'utf8');
      
      this.keyCache.set('rsa', {
        publicKey,
        privateKey,
        created: (await fs.stat(publicKeyPath)).birthtime,
      });
      
      logger.info('RSA key pair loaded from files');
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Generate new RSA key pair
        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: 'spki',
            format: 'pem',
          },
          privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem',
          },
        });
        
        await fs.writeFile(publicKeyPath, publicKey, { mode: 0o644 });
        await fs.writeFile(privateKeyPath, privateKey, { mode: 0o600 });
        
        this.keyCache.set('rsa', {
          publicKey,
          privateKey,
          created: new Date(),
        });
        
        logger.info('New RSA key pair generated and saved');
        
      } else {
        throw error;
      }
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(data, keyType = 'audit') {
    if (!this.initialized) {
      throw new Error('Encryption Manager not initialized');
    }

    if (!data) {
      return null;
    }

    try {
      const keyInfo = this.keyCache.get(keyType);
      if (!keyInfo) {
        throw new Error(`Encryption key not found: ${keyType}`);
      }

      const iv = crypto.randomBytes(12); // 96-bit IV for GCM
      const cipher = crypto.createCipheriv(this.algorithms.symmetric, keyInfo.key, iv);
      cipher.setAAD(Buffer.from(keyType)); // Additional authenticated data
      
      const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data), 'utf8');
      
      let encrypted = cipher.update(dataBuffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV, auth tag, and encrypted data
      const result = Buffer.concat([iv, authTag, encrypted]);
      
      return {
        data: result.toString('base64'),
        algorithm: this.algorithms.symmetric,
        keyType: keyType,
        encrypted: true,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(encryptedData, keyType = 'audit') {
    if (!this.initialized) {
      throw new Error('Encryption Manager not initialized');
    }

    if (!encryptedData || !encryptedData.encrypted) {
      return encryptedData;
    }

    try {
      const keyInfo = this.keyCache.get(keyType);
      if (!keyInfo) {
        throw new Error(`Encryption key not found: ${keyType}`);
      }

      const combinedBuffer = Buffer.from(encryptedData.data, 'base64');
      
      // Extract IV, auth tag, and encrypted data
      const iv = combinedBuffer.slice(0, 12);
      const authTag = combinedBuffer.slice(12, 28);
      const encrypted = combinedBuffer.slice(28);
      
      const decipher = crypto.createDecipheriv(this.algorithms.symmetric, keyInfo.key, iv);
      decipher.setAAD(Buffer.from(keyType));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      // Try to parse as JSON, fallback to string
      try {
        return JSON.parse(decrypted.toString('utf8'));
      } catch {
        return decrypted.toString('utf8');
      }

    } catch (error) {
      logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt using RSA public key
   */
  encryptRSA(data) {
    if (!this.initialized) {
      throw new Error('Encryption Manager not initialized');
    }

    try {
      const keyInfo = this.keyCache.get('rsa');
      if (!keyInfo) {
        throw new Error('RSA keys not found');
      }

      const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
      const encrypted = crypto.publicEncrypt(keyInfo.publicKey, dataBuffer);
      
      return {
        data: encrypted.toString('base64'),
        algorithm: 'rsa',
        encrypted: true,
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      logger.error('RSA encryption failed:', error);
      throw new Error('Failed to encrypt data with RSA');
    }
  }

  /**
   * Decrypt using RSA private key
   */
  decryptRSA(encryptedData) {
    if (!this.initialized) {
      throw new Error('Encryption Manager not initialized');
    }

    if (!encryptedData || !encryptedData.encrypted) {
      return encryptedData;
    }

    try {
      const keyInfo = this.keyCache.get('rsa');
      if (!keyInfo) {
        throw new Error('RSA keys not found');
      }

      const encryptedBuffer = Buffer.from(encryptedData.data, 'base64');
      const decrypted = crypto.privateDecrypt(keyInfo.privateKey, encryptedBuffer);
      
      return decrypted.toString('utf8');

    } catch (error) {
      logger.error('RSA decryption failed:', error);
      throw new Error('Failed to decrypt data with RSA');
    }
  }

  /**
   * Hash data using SHA-256
   */
  hash(data, salt = null) {
    try {
      const hash = crypto.createHash(this.algorithms.hash);
      
      if (salt) {
        hash.update(salt);
      }
      
      hash.update(data);
      return hash.digest('hex');

    } catch (error) {
      logger.error('Hashing failed:', error);
      throw new Error('Failed to hash data');
    }
  }

  /**
   * Generate secure hash with salt
   */
  hashWithSalt(data) {
    const salt = crypto.randomBytes(16);
    const hash = this.hash(data, salt);
    
    return {
      hash,
      salt: salt.toString('hex'),
      algorithm: this.algorithms.hash,
    };
  }

  /**
   * Verify hash with salt
   */
  verifyHash(data, hashData) {
    try {
      const salt = Buffer.from(hashData.salt, 'hex');
      const computedHash = this.hash(data, salt);
      
      return computedHash === hashData.hash;

    } catch (error) {
      logger.error('Hash verification failed:', error);
      return false;
    }
  }

  /**
   * Derive key from password using PBKDF2
   */
  deriveKey(password, salt = null, iterations = 100000) {
    try {
      const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(16);
      const derivedKey = crypto.pbkdf2Sync(password, saltBuffer, iterations, 32, this.algorithms.hash);
      
      return {
        key: derivedKey.toString('hex'),
        salt: saltBuffer.toString('hex'),
        iterations,
        algorithm: this.algorithms.keyDerivation,
      };

    } catch (error) {
      logger.error('Key derivation failed:', error);
      throw new Error('Failed to derive key');
    }
  }

  /**
   * Encrypt sensitive audit data
   */
  encryptAuditData(auditData) {
    const encryptedData = {
      ...auditData,
    };

    // Encrypt sensitive fields
    const sensitiveFields = ['user_query', 'final_response', 'metadata'];
    
    for (const field of sensitiveFields) {
      if (auditData[field]) {
        encryptedData[field] = this.encrypt(auditData[field], 'audit');
      }
    }

    return encryptedData;
  }

  /**
   * Decrypt sensitive audit data
   */
  decryptAuditData(encryptedAuditData) {
    const decryptedData = {
      ...encryptedAuditData,
    };

    // Decrypt sensitive fields
    const sensitiveFields = ['user_query', 'final_response', 'metadata'];
    
    for (const field of sensitiveFields) {
      if (encryptedAuditData[field] && encryptedAuditData[field].encrypted) {
        decryptedData[field] = this.decrypt(encryptedAuditData[field], 'audit');
      }
    }

    return decryptedData;
  }

  /**
   * Encrypt PII data
   */
  encryptPII(piiData) {
    return this.encrypt(piiData, 'pii');
  }

  /**
   * Decrypt PII data
   */
  decryptPII(encryptedPiiData) {
    return this.decrypt(encryptedPiiData, 'pii');
  }

  /**
   * Encrypt session data
   */
  encryptSessionData(sessionData) {
    return this.encrypt(sessionData, 'session');
  }

  /**
   * Decrypt session data
   */
  decryptSessionData(encryptedSessionData) {
    return this.decrypt(encryptedSessionData, 'session');
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate UUID v4
   */
  generateUUID() {
    return crypto.randomUUID();
  }

  /**
   * Create HMAC signature
   */
  createHMAC(data, secret = null) {
    try {
      const secretKey = secret || this.keyCache.get('master')?.key;
      if (!secretKey) {
        throw new Error('Secret key not available');
      }

      const hmac = crypto.createHmac(this.algorithms.hash, secretKey);
      hmac.update(data);
      
      return hmac.digest('hex');

    } catch (error) {
      logger.error('HMAC creation failed:', error);
      throw new Error('Failed to create HMAC');
    }
  }

  /**
   * Verify HMAC signature
   */
  verifyHMAC(data, signature, secret = null) {
    try {
      const computedSignature = this.createHMAC(data, secret);
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(computedSignature, 'hex')
      );

    } catch (error) {
      logger.error('HMAC verification failed:', error);
      return false;
    }
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(keyType) {
    if (!this.initialized) {
      throw new Error('Encryption Manager not initialized');
    }

    try {
      const keyDir = this.encryptionConfig.keyDirectory;
      const keyPath = path.join(keyDir, `${keyType}.key`);
      
      // Generate new key
      const newKey = crypto.randomBytes(32);
      
      // Backup old key
      const oldKeyData = await fs.readFile(keyPath);
      const backupPath = path.join(keyDir, `${keyType}.key.backup.${Date.now()}`);
      await fs.writeFile(backupPath, oldKeyData);
      
      // Save new key
      const keyData = {
        key: newKey.toString('hex'),
        created: new Date().toISOString(),
        rotatedAt: new Date().toISOString(),
        algorithm: this.algorithms.symmetric,
        keyType: keyType,
        previousBackup: backupPath,
      };
      
      await fs.writeFile(keyPath, JSON.stringify(keyData, null, 2), { mode: 0o600 });
      
      // Update cache
      this.keyCache.set(keyType, {
        key: newKey,
        created: new Date(),
        rotatedAt: new Date(),
      });
      
      logger.info(`Encryption key rotated successfully: ${keyType}`, {
        keyType,
        backupPath,
      });

      return {
        success: true,
        keyType,
        rotatedAt: new Date().toISOString(),
        backupPath,
      };

    } catch (error) {
      logger.error(`Key rotation failed for ${keyType}:`, error);
      throw new Error(`Failed to rotate ${keyType} key`);
    }
  }

  /**
   * Get encryption statistics
   */
  getEncryptionStats() {
    if (!this.initialized) {
      return { initialized: false };
    }

    const stats = {
      initialized: true,
      algorithms: this.algorithms,
      keys: {},
      timestamp: new Date().toISOString(),
    };

    for (const [keyType, keyInfo] of this.keyCache.entries()) {
      stats.keys[keyType] = {
        created: keyInfo.created,
        rotatedAt: keyInfo.rotatedAt || null,
        ageInDays: Math.floor((new Date() - keyInfo.created) / (1000 * 60 * 60 * 24)),
      };
    }

    return stats;
  }

  /**
   * Validate encryption integrity
   */
  async validateIntegrity() {
    const results = {
      valid: true,
      checks: [],
      errors: [],
    };

    try {
      // Test each encryption key
      for (const [keyType, keyInfo] of this.keyCache.entries()) {
        if (keyType === 'rsa') {
          // Test RSA encryption/decryption
          const testData = 'test-rsa-encryption';
          const encrypted = this.encryptRSA(testData);
          const decrypted = this.decryptRSA(encrypted);
          
          if (decrypted === testData) {
            results.checks.push(`${keyType}: RSA encryption/decryption OK`);
          } else {
            results.valid = false;
            results.errors.push(`${keyType}: RSA encryption/decryption failed`);
          }
        } else {
          // Test symmetric encryption/decryption
          const testData = { test: 'symmetric-encryption', timestamp: new Date().toISOString() };
          const encrypted = this.encrypt(testData, keyType);
          const decrypted = this.decrypt(encrypted, keyType);
          
          if (JSON.stringify(decrypted) === JSON.stringify(testData)) {
            results.checks.push(`${keyType}: Symmetric encryption/decryption OK`);
          } else {
            results.valid = false;
            results.errors.push(`${keyType}: Symmetric encryption/decryption failed`);
          }
        }
      }

      // Test HMAC
      const testData = 'test-hmac-data';
      const hmac = this.createHMAC(testData);
      const hmacValid = this.verifyHMAC(testData, hmac);
      
      if (hmacValid) {
        results.checks.push('HMAC: Creation/verification OK');
      } else {
        results.valid = false;
        results.errors.push('HMAC: Creation/verification failed');
      }

      // Test hashing
      const hashData = this.hashWithSalt('test-hash-data');
      const hashValid = this.verifyHash('test-hash-data', hashData);
      
      if (hashValid) {
        results.checks.push('Hash: Creation/verification OK');
      } else {
        results.valid = false;
        results.errors.push('Hash: Creation/verification failed');
      }

    } catch (error) {
      results.valid = false;
      results.errors.push(`Integrity validation error: ${error.message}`);
    }

    return results;
  }

  /**
   * Export public key for external use
   */
  getPublicKey() {
    if (!this.initialized) {
      throw new Error('Encryption Manager not initialized');
    }

    const rsaKeys = this.keyCache.get('rsa');
    if (!rsaKeys) {
      throw new Error('RSA keys not available');
    }

    return rsaKeys.publicKey;
  }

  /**
   * Secure data wipe
   */
  secureWipe(data) {
    if (Buffer.isBuffer(data)) {
      data.fill(0);
    } else if (typeof data === 'string') {
      // For strings, we can't directly overwrite memory,
      // but we can recommend using Buffer for sensitive data
      logger.warn('String data cannot be securely wiped from memory');
    }
  }

  /**
   * Close and cleanup
   */
  async close() {
    // Clear key cache
    for (const [keyType, keyInfo] of this.keyCache.entries()) {
      if (keyInfo.key && Buffer.isBuffer(keyInfo.key)) {
        this.secureWipe(keyInfo.key);
      }
    }
    
    this.keyCache.clear();
    this.initialized = false;
    
    logger.info('Encryption Manager closed and keys cleared from memory');
  }
}

module.exports = EncryptionManager;
