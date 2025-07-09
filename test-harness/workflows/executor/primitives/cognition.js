import { BasePrimitive } from './base-primitive.js';

/**
 * Cognition Primitive - Handles AI-powered data processing
 * 
 * Purpose: AI reasoning without side effects. Processes information and returns insights.
 * Features: Schema validation, automatic retries, robust JSON parsing
 */
export class CognitionPrimitive extends BasePrimitive {
  async execute({ prompt, input, output, model = 'o4-mini', schema }) {
    const inputData = this.resolveVariable(input);
    
    // Build system prompt with schema if provided
    let systemPrompt = `You are a data processing assistant. You MUST return ONLY valid JSON without any markdown formatting, code blocks, or explanations. 
Do not wrap the response in \`\`\`json\`\`\` tags.
Do not include any text before or after the JSON.
The response must be parseable by JSON.parse().`;

    // Add schema constraints to prompt if provided
    if (schema) {
      systemPrompt += `\n\nThe response MUST conform to this exact structure:\n${JSON.stringify(schema, null, 2)}`;
      systemPrompt += `\n\nWhere:`;
      
      // Add type descriptions for clarity
      Object.entries(schema).forEach(([key, type]) => {
        if (typeof type === 'string') {
          systemPrompt += `\n- "${key}" must be a ${type}`;
        } else if (typeof type === 'object') {
          systemPrompt += `\n- "${key}" must be an object matching: ${JSON.stringify(type)}`;
        }
      });
    }

    systemPrompt += `\n\nExamples of correct responses:
{"summary": "Investor interested in Series A, requesting runway details."}
{"stage": "In Diligence"}
[true, false, true, false]
{"investorName": "John Smith", "company": "Accel Partners"}`;
    
    // Initial attempt
    let attempts = 0;
    const maxAttempts = schema ? 2 : 1; // Retry once if schema validation fails
    
    while (attempts < maxAttempts) {
      attempts++;
      
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${prompt}\n\nInput: ${JSON.stringify(inputData)}` }
        ],
        temperature: 0.3  // Lower temperature for more consistent JSON output
      });
      
      let content = response.choices[0].message.content;
      console.log(`Raw cognition response (attempt ${attempts}):`, content);
      
      // Clean up common formatting issues
      // Remove markdown code blocks if present
      content = content.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      content = content.replace(/^```\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      // Remove any leading/trailing whitespace and newlines
      content = content.trim();
      
      // Try to parse the cleaned content
      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse cognition response:', content);
        // Try to extract JSON from the response if it's embedded in text
        const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
            console.log('Successfully extracted JSON from response');
          } catch (e) {
            if (attempts === maxAttempts) {
              throw new Error(`Invalid JSON response from cognition: ${parseError.message}`);
            }
            continue; // Retry
          }
        } else {
          if (attempts === maxAttempts) {
            throw new Error(`Invalid JSON response from cognition: ${parseError.message}`);
          }
          continue; // Retry
        }
      }
      
      // Validate against schema if provided
      if (schema) {
        const validationError = this.validateSchema(result, schema);
        if (validationError) {
          console.error(`Schema validation failed: ${validationError}`);
          if (attempts === maxAttempts) {
            throw new Error(`Response does not match required schema: ${validationError}`);
          }
          // Add error feedback to prompt for retry
          systemPrompt += `\n\nPREVIOUS ATTEMPT FAILED: ${validationError}. Please ensure the response exactly matches the required schema.`;
          continue; // Retry
        }
      }
      
      // Success - store result and return
      if (output) {
        this.setStateValue(output, result);
      }
      
      return result;
    }
  }

  /**
   * Simple schema validator
   */
  validateSchema(data, schema) {
    // Handle null/undefined
    if (data === null || data === undefined) {
      return 'Response is null or undefined';
    }

    // For simple type schemas like {"emails": "array"}
    if (typeof schema === 'object' && !Array.isArray(schema)) {
      for (const [key, expectedType] of Object.entries(schema)) {
        if (!(key in data)) {
          return `Missing required field: "${key}"`;
        }
        
        const actualType = Array.isArray(data[key]) ? 'array' : typeof data[key];
        
        if (typeof expectedType === 'string') {
          // Simple type check
          if (actualType !== expectedType) {
            return `Field "${key}" should be ${expectedType} but got ${actualType}`;
          }
        } else if (typeof expectedType === 'object') {
          // Nested schema validation
          const nestedError = this.validateSchema(data[key], expectedType);
          if (nestedError) {
            return `In field "${key}": ${nestedError}`;
          }
        }
      }
    }
    
    return null; // No validation errors
  }
}