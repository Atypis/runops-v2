import { chromium } from 'playwright';
import { Stagehand } from '@browserbasehq/stagehand';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// Test the new 9 primitives
class PrimitiveExecutor {
  constructor(stagehand, openai) {
    this.stagehand = stagehand;
    this.openai = openai;
    this.state = {}; // Workflow state
  }

  // EXECUTION PRIMITIVES

  async browserAction({ method, target, data }) {
    console.log(`🎯 browser_action: ${method} on ${target}`);
    
    switch(method) {
      case 'goto':
        await this.stagehand.page.goto(target);
        break;
      case 'click':
        await this.stagehand.act({ action: `click on ${target}` });
        break;
      case 'type':
        await this.stagehand.act({ 
          action: `type into ${target}`,
          data: { text: data }
        });
        break;
    }
  }

  async browserQuery({ method, instruction, schema }) {
    console.log(`🔍 browser_query: ${method}`);
    
    switch(method) {
      case 'extract':
        return await this.stagehand.extract({ instruction, schema });
      case 'observe':
        return await this.stagehand.observe({ instruction });
    }
  }

  transform({ input, function: fn, output }) {
    console.log(`🔄 transform: ${input} → ${output}`);
    
    // Get input from state
    const inputData = this.getFromState(input);
    
    // Apply transformation (using eval for demo - use safe parser in production!)
    const transformed = eval(`(${fn})`)(inputData);
    
    // Store in state
    this.setInState(output, transformed);
    return transformed;
  }

  async cognition({ prompt, input, output, model = 'gpt-4o-mini' }) {
    console.log(`🧠 cognition: ${prompt.substring(0, 50)}...`);
    
    const inputData = this.getFromState(input);
    
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a data processing assistant. Return only JSON.' },
        { role: 'user', content: `${prompt}\n\nInput: ${JSON.stringify(inputData)}` }
      ],
      temperature: 1
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    this.setInState(output, result);
    return result;
  }

  // CONTROL PRIMITIVES

  async sequence(nodes) {
    console.log(`📋 sequence: ${nodes.length} nodes`);
    const results = [];
    for (const node of nodes) {
      results.push(await this.execute(node));
    }
    return results;
  }

  async iterate({ over, as, body }) {
    console.log(`🔁 iterate: over ${over}`);
    const items = this.getFromState(over);
    const results = [];
    
    for (let i = 0; i < items.length; i++) {
      // Set iteration variables
      this.setInState(as, items[i]);
      this.setInState(`${as}Index`, i);
      
      results.push(await this.execute(body));
    }
    return results;
  }

  route({ value, paths }) {
    console.log(`🚦 route: checking ${value}`);
    const checkValue = this.getFromState(value);
    const selectedPath = paths[checkValue] || paths.default;
    
    if (!selectedPath) {
      throw new Error(`No route found for value: ${checkValue}`);
    }
    
    return this.execute(selectedPath);
  }

  async handle({ try: tryNode, catch: catchNode, finally: finallyNode }) {
    console.log(`🛡️ handle: error boundary`);
    try {
      return await this.execute(tryNode);
    } catch (error) {
      console.error('Error caught:', error);
      if (catchNode) {
        return await this.execute(catchNode);
      }
      throw error;
    } finally {
      if (finallyNode) {
        await this.execute(finallyNode);
      }
    }
  }

  // STATE PRIMITIVE

  memory({ operation, scope, data }) {
    console.log(`💾 memory: ${operation} in ${scope} scope`);
    
    switch(operation) {
      case 'set':
        Object.entries(data).forEach(([key, value]) => {
          this.setInState(key, value);
        });
        break;
      case 'get':
        return data.map(key => this.getFromState(key));
      case 'clear':
        if (scope === 'global') {
          this.state = {};
        }
        break;
      case 'merge':
        this.state = { ...this.state, ...data };
        break;
    }
  }

  // Helper methods
  getFromState(path) {
    if (!path.startsWith('state.')) return path;
    const key = path.replace('state.', '');
    return this.state[key];
  }

  setInState(path, value) {
    const key = path.replace('state.', '');
    this.state[key] = value;
  }

  async execute(node) {
    switch(node.type) {
      case 'browser_action': return this.browserAction(node);
      case 'browser_query': return this.browserQuery(node);
      case 'transform': return this.transform(node);
      case 'cognition': return this.cognition(node);
      case 'sequence': return this.sequence(node.nodes);
      case 'iterate': return this.iterate(node);
      case 'route': return this.route(node);
      case 'handle': return this.handle(node);
      case 'memory': return this.memory(node);
      default: throw new Error(`Unknown node type: ${node.type}`);
    }
  }
}

// Test the primitives
async function testPrimitives() {
  console.log('🚀 Testing new primitive system...');
  
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();
  
  const stagehand = new Stagehand({ page });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const executor = new PrimitiveExecutor(stagehand, openai);
  
  // Example: Extract and filter emails
  const workflow = {
    type: 'sequence',
    nodes: [
      // Extract emails
      {
        type: 'browser_query',
        method: 'extract',
        instruction: 'Extract all email subjects and senders',
        schema: {
          emails: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                subject: { type: 'string' },
                sender: { type: 'string' }
              }
            }
          }
        }
      },
      // Store in state
      {
        type: 'memory',
        operation: 'set',
        scope: 'global',
        data: { emails: '{{result}}' }
      },
      // Use AI to classify
      {
        type: 'cognition',
        prompt: 'Which of these emails are from investors? Return boolean array.',
        input: 'state.emails',
        output: 'state.investorMask'
      },
      // Filter the emails
      {
        type: 'transform',
        input: 'state.emails',
        function: '(emails) => emails.filter((e, i) => state.investorMask[i])',
        output: 'state.investorEmails'
      }
    ]
  };
  
  await executor.execute(workflow);
  console.log('Final state:', executor.state);
}

testPrimitives();