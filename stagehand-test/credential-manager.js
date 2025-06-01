import { createInterface } from 'readline';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Credential Manager - Handles secure credential input for SOP execution
 * 
 * Supports both environment variables and interactive prompts for maximum security
 */
class CredentialManager {
  constructor() {
    // Load credentials from environment files
    dotenv.config({ path: path.join(process.cwd(), 'sop-credentials.env') });
    dotenv.config({ path: path.join(process.cwd(), '../.env') });
    
    this.credentials = {};
    this.useInteractive = process.env.USE_INTERACTIVE_PROMPTS === 'true';
  }

  /**
   * Create readline interface for interactive input
   */
  createReadlineInterface() {
    return createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Prompt for a credential with optional masking
   */
  async promptCredential(name, description, mask = false) {
    return new Promise((resolve) => {
      const rl = this.createReadlineInterface();
      
      if (mask) {
        // For passwords, hide input
        process.stdout.write(`${description}: `);
        process.stdin.setRawMode(true);
        process.stdin.resume();
        
        let password = '';
        process.stdin.on('data', (char) => {
          char = char.toString();
          
          if (char === '\n' || char === '\r' || char === '\u0004') {
            // Enter pressed
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdout.write('\n');
            rl.close();
            resolve(password);
          } else if (char === '\u0003') {
            // Ctrl+C pressed
            process.stdout.write('\n');
            process.exit(1);
          } else if (char === '\u007f') {
            // Backspace pressed
            if (password.length > 0) {
              password = password.slice(0, -1);
              process.stdout.write('\b \b');
            }
          } else {
            // Regular character
            password += char;
            process.stdout.write('*');
          }
        });
      } else {
        // For non-sensitive data, show input
        rl.question(`${description}: `, (answer) => {
          rl.close();
          resolve(answer);
        });
      }
    });
  }

  /**
   * Get Gmail credentials
   */
  async getGmailCredentials() {
    console.log('\n📧 Gmail Credentials Required');
    console.log('='.repeat(40));
    
    let email = process.env.GMAIL_EMAIL;
    let password = process.env.GMAIL_PASSWORD;
    
    if (this.useInteractive || !email || !password) {
      console.log('🔐 Please provide your Gmail credentials:');
      console.log('💡 Tip: Use an App Password if you have 2FA enabled');
      console.log('   Generate one at: https://support.google.com/accounts/answer/185833\n');
      
      if (!email) {
        email = await this.promptCredential('gmail_email', 'Gmail Email Address');
      }
      
      if (!password) {
        password = await this.promptCredential('gmail_password', 'Gmail Password (or App Password)', true);
      }
    }
    
    this.credentials.gmail = { email, password };
    console.log(`✅ Gmail credentials set for: ${email}`);
    return this.credentials.gmail;
  }

  /**
   * Get Airtable credentials
   */
  async getAirtableCredentials() {
    console.log('\n🗃️  Airtable Credentials Required');
    console.log('='.repeat(40));
    
    let apiKey = process.env.AIRTABLE_API_KEY;
    let baseId = process.env.AIRTABLE_BASE_ID;
    let tableName = process.env.AIRTABLE_TABLE_NAME;
    
    if (this.useInteractive || !apiKey || !baseId || !tableName) {
      console.log('🔐 Please provide your Airtable credentials:');
      console.log('💡 Find your API key in Account settings');
      console.log('💡 Base ID is in the URL when viewing your base\n');
      
      if (!apiKey) {
        apiKey = await this.promptCredential('airtable_api_key', 'Airtable API Key', true);
      }
      
      if (!baseId) {
        baseId = await this.promptCredential('airtable_base_id', 'Airtable Base ID');
      }
      
      if (!tableName) {
        tableName = await this.promptCredential('airtable_table_name', 'Airtable Table Name');
      }
    }
    
    this.credentials.airtable = { apiKey, baseId, tableName };
    console.log(`✅ Airtable credentials set for base: ${baseId}`);
    return this.credentials.airtable;
  }

  /**
   * Get all required credentials for the SOP
   */
  async getAllCredentials() {
    console.log('\n🔑 Gathering Credentials for SOP Execution');
    console.log('='.repeat(50));
    
    const gmail = await this.getGmailCredentials();
    const airtable = await this.getAirtableCredentials();
    
    console.log('\n✅ All credentials gathered successfully!');
    console.log('🔒 Credentials are stored securely in memory only');
    
    return {
      gmail,
      airtable
    };
  }

  /**
   * Replace credential placeholders in SOP steps
   */
  replaceCredentials(instruction, credentials) {
    let result = instruction;
    
    // Gmail replacements
    if (credentials.gmail) {
      result = result.replace(/\{\{gmail_email\}\}/g, credentials.gmail.email);
      result = result.replace(/\{\{gmail_password\}\}/g, credentials.gmail.password);
    }
    
    // Airtable replacements
    if (credentials.airtable) {
      result = result.replace(/\{\{airtable_api_key\}\}/g, credentials.airtable.apiKey);
      result = result.replace(/\{\{airtable_base_id\}\}/g, credentials.airtable.baseId);
      result = result.replace(/\{\{airtable_table_name\}\}/g, credentials.airtable.tableName);
    }
    
    return result;
  }

  /**
   * Clear credentials from memory
   */
  clearCredentials() {
    this.credentials = {};
    console.log('🗑️  Credentials cleared from memory');
  }
}

export default CredentialManager; 