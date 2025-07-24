import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Visual Observation Service
 * Takes screenshots after node execution and uses Gemini 2.5 Flash to describe the page state
 */
export class VisualObservationService {
  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY || 'AIzaSyCHFtX09QsZnUVLYbv0E3EqVmfPiCImLTs';
    this.geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${this.geminiApiKey}`;
    
    // Cache directory for screenshots
    this.screenshotDir = path.join(__dirname, '../../temp/screenshots');
    this.ensureScreenshotDir();
  }

  async ensureScreenshotDir() {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
    } catch (error) {
      console.error('[VISUAL_OBSERVATION] Failed to create screenshot directory:', error);
    }
  }

  /**
   * Capture and analyze the current page state
   * @param {Page} page - The Playwright/Stagehand page object
   * @param {string} nodeType - The type of node that was just executed
   * @param {string} nodeDescription - Description of what the node was supposed to do
   * @param {Object} nodeResult - The result from node execution
   * @returns {Object} Visual observation data
   */
  async captureAndAnalyze(page, nodeType, nodeDescription, nodeResult) {
    try {
      console.log('[VISUAL_OBSERVATION] Starting visual observation capture');
      
      // Generate unique filename
      const timestamp = Date.now();
      const screenshotPath = path.join(this.screenshotDir, `observation_${timestamp}.png`);
      
      // Take screenshot
      const screenshotBuffer = await page.screenshot({
        fullPage: false, // Just viewport for efficiency
        type: 'png'
      });
      
      // Save screenshot temporarily
      await fs.writeFile(screenshotPath, screenshotBuffer);
      console.log(`[VISUAL_OBSERVATION] Screenshot saved to ${screenshotPath}`);
      
      // Convert to base64 for Gemini API
      const base64Image = screenshotBuffer.toString('base64');
      
      // Prepare the observation prompt
      const observationPrompt = this.buildObservationPrompt(nodeType, nodeDescription, nodeResult);
      
      // Call Gemini API
      const observation = await this.analyzeWithGemini(base64Image, observationPrompt);
      
      // Clean up screenshot file
      try {
        await fs.unlink(screenshotPath);
      } catch (err) {
        console.warn('[VISUAL_OBSERVATION] Failed to clean up screenshot:', err);
      }
      
      return {
        success: true,
        observation,
        timestamp: new Date().toISOString(),
        metadata: {
          nodeType,
          nodeDescription,
          screenshotSize: screenshotBuffer.length
        }
      };
      
    } catch (error) {
      console.error('[VISUAL_OBSERVATION] Failed to capture/analyze:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Build the observation prompt based on node context
   */
  buildObservationPrompt(nodeType, nodeDescription, nodeResult) {
    return `You are observing a web page after a ${nodeType} action: "${nodeDescription}"

Please provide a concise observation (3-5 sentences) describing:
1. What page/section are you on?
2. What components are visible?
3. What values are visible?

Focus on facts, not interpretation. Be specific about any errors or unexpected states.
If values are very long (>50 chars), you may truncate them with "..." but preserve the beginning and end for identification.

Examples of truncation:
- Email: "user@example.com" → keep full (short)
- Error: "Please enter a valid email address" → keep full (important)
- Long text: "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua" → "Lorem ipsum dolor sit amet...magna aliqua"`;
  }

  /**
   * Call Gemini API to analyze the screenshot
   */
  async analyzeWithGemini(base64Image, prompt) {
    try {
      const requestBody = {
        contents: [{
          parts: [
            {
              text: prompt
            },
            {
              inline_data: {
                mime_type: 'image/png',
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 1,
          maxOutputTokens: 500  // Increased for higher fidelity observations
        }
      };

      console.log('[VISUAL_OBSERVATION] Calling Gemini API...');
      
      const response = await fetch(this.geminiApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      
      if (result.error) {
        console.error('[VISUAL_OBSERVATION] Gemini API Error:', result.error);
        throw new Error(`Gemini API error: ${result.error.message || 'Unknown error'}`);
      }

      // Extract the observation text
      if (result.candidates && result.candidates[0]) {
        const observation = result.candidates[0].content.parts[0].text;
        console.log('[VISUAL_OBSERVATION] Gemini observation:', observation);
        
        // Log token usage if available
        if (result.usageMetadata) {
          console.log('[VISUAL_OBSERVATION] Token usage:', {
            prompt: result.usageMetadata.promptTokenCount,
            output: result.usageMetadata.candidatesTokenCount,
            total: result.usageMetadata.totalTokenCount
          });
        }
        
        return observation;
      }
      
      throw new Error('No observation generated from Gemini');
      
    } catch (error) {
      console.error('[VISUAL_OBSERVATION] Gemini API call failed:', error);
      throw error;
    }
  }

  /**
   * Check if visual observation is enabled
   */
  isEnabled() {
    // Can be controlled via environment variable
    // Default to false unless explicitly enabled
    return process.env.ENABLE_VISUAL_OBSERVATION === 'true';
  }

  /**
   * Check if we should observe this node type
   */
  shouldObserveNode(nodeType, nodeDescription) {
    // Skip certain node types that don't change the UI
    const skipTypes = ['memory', 'context', 'transform', 'cognition'];
    if (skipTypes.includes(nodeType)) {
      return false;
    }
    
    // Skip wait actions
    if (nodeType === 'browser_action' && nodeDescription?.includes('wait')) {
      return false;
    }
    
    return true;
  }
}

// Export singleton instance
export default new VisualObservationService();