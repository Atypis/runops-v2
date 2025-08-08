import fetch from 'node-fetch';

export class DirectorRPCClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async callDirectorMethod(method, params) {
    try {
      const response = await fetch(`${this.baseUrl}/api/director/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method,
          params,
          workflowId: this.workflowId,
          userId: this.userId
        })
      });

      if (!response.ok) {
        throw new Error(`RPC call failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[RPC] Error calling ${method}:`, error);
      throw error;
    }
  }

  // Proxy all Director methods through RPC
  async handleToolCall(toolName, args) {
    return this.callDirectorMethod('handleToolCall', { toolName, args });
  }

  async initialize(workflowId, userId) {
    this.workflowId = workflowId;
    this.userId = userId;
    return this.callDirectorMethod('initialize', { workflowId, userId });
  }
}