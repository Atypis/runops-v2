/**
 * Secure Encryption for Credential Storage
 * 
 * Provides encrypted storage for sensitive credential data in Supabase.
 * Uses modern AES-256-CBC encryption with secure key derivation.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;  // 128 bits

/**
 * Derive encryption key from environment variable or default
 * Uses PBKDF2 for secure key derivation
 */
function getEncryptionKey(): Buffer {
  const keySource = process.env.CREDENTIAL_ENCRYPTION_KEY || 'aef-default-credential-key-2025-mvp-secure';
  const salt = 'aef-credential-salt-2025'; // In production, use random salt per credential
  
  return crypto.pbkdf2Sync(keySource, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt credential data using AES-256-CBC
 */
export function encrypt(data: Record<string, any>): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    const plaintext = JSON.stringify(data);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine iv + encrypted data
    const result = iv.toString('hex') + ':' + encrypted;
    return Buffer.from(result).toString('base64');
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt credential data');
  }
}

/**
 * Decrypt credential data using AES-256-CBC
 */
export function decrypt(encryptedData: string | Record<string, any>): Record<string, any> {
  try {
    // Handle case where data is already decrypted (for compatibility)
    if (typeof encryptedData === 'object' && encryptedData !== null) {
      return encryptedData;
    }
    
    if (typeof encryptedData !== 'string') {
      return {};
    }
    
    const key = getEncryptionKey();
    const decoded = Buffer.from(encryptedData, 'base64').toString('utf8');
    const [ivHex, encrypted] = decoded.split(':');
    
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    // Return empty object if decryption fails (for development)
    return {};
  }
}

/**
 * Enhanced encryption for single values (used by SimpleEncryption compatibility)
 */
function encryptValue(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Value encryption failed:', error);
    return text;
  }
}

/**
 * Enhanced decryption for single values
 */
function decryptValue(encryptedText: string): string {
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted) {
      // Fallback to original simple decryption for backward compatibility
      return SimpleEncryption.legacyDecrypt(encryptedText);
    }
    
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Value decryption failed:', error);
    // Fallback to legacy decryption for backward compatibility
    return SimpleEncryption.legacyDecrypt(encryptedText);
  }
}

/**
 * Simple encryption class for compatibility with existing browser storage
 * Now uses secure encryption methods but maintains API compatibility
 */
export class SimpleEncryption {
  
  static encrypt(text: string): string {
    return encryptValue(text);
  }
  
  static decrypt(encoded: string): string {
    return decryptValue(encoded);
  }
  
  /**
   * Legacy XOR-based decryption for backward compatibility
   * Only used as fallback for existing stored data
   */
  static legacyDecrypt(encoded: string): string {
    try {
      const key = 'aef-cred-key-2025';
      const text = atob(encoded);
      let result = '';
      for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return result;
    } catch (error) {
      console.error('Legacy decryption failed:', error);
      return encoded;
    }
  }
} 