import { BasePrimitive } from './base-primitive.js';

/**
 * Route Primitive - Conditional branching
 * 
 * Purpose: Multi-way branching based on conditions
 * Features: Simple value matching, default paths, condition evaluation
 */
export class RoutePrimitive extends BasePrimitive {
  constructor(dependencies) {
    super(dependencies);
    this.primitiveExecutor = dependencies.primitiveExecutor; // Reference to main executor
  }

  async execute({ value, paths, conditions, default: defaultBranch }) {
    // Handle simple value-based routing
    if (value && paths) {
      return await this.executeValueRoute(value, paths);
    }
    
    // Handle condition-based routing (from operator prompt format)
    if (conditions) {
      return await this.executeConditionRoute(conditions, defaultBranch);
    }
    
    throw new Error('Route requires either value/paths or conditions');
  }

  async executeValueRoute(value, paths) {
    const checkValue = String(this.resolveVariable(value));
    console.log(`🚦 Routing based on ${value} = ${checkValue}`);
    
    const selectedPath = paths[checkValue] || paths['false'] || paths.default;
    if (!selectedPath) {
      throw new Error(`No route found for value: ${checkValue}`);
    }
    
    return await this.primitiveExecutor.execute(selectedPath);
  }

  async executeConditionRoute(conditions, defaultBranch) {
    console.log(`🚦 Evaluating ${conditions.length} conditions`);
    
    for (const condition of conditions) {
      const value = this.resolveVariable(condition.path);
      const match = this.evaluateCondition(value, condition.operator, condition.value);
      
      if (match) {
        console.log(`  ✓ Condition matched: ${condition.path} ${condition.operator} ${condition.value}`);
        return await this.primitiveExecutor.execute(condition.branch);
      }
    }
    
    // No conditions matched, use default if available
    if (defaultBranch) {
      console.log(`  → Using default branch`);
      return await this.primitiveExecutor.execute(defaultBranch);
    }
    
    throw new Error('No conditions matched and no default branch provided');
  }

  evaluateCondition(value, operator, expected) {
    switch (operator) {
      case 'equals':
        return value === expected;
      case 'contains':
        return String(value).includes(expected);
      case 'exists':
        return value !== null && value !== undefined && value !== '';
      case 'greater':
        return Number(value) > Number(expected);
      case 'less':
        return Number(value) < Number(expected);
      case 'greaterOrEqual':
        return Number(value) >= Number(expected);
      case 'lessOrEqual':
        return Number(value) <= Number(expected);
      case 'notEquals':
        return value !== expected;
      case 'matches':
        // Basic regex support
        try {
          const regex = new RegExp(expected);
          return regex.test(String(value));
        } catch (e) {
          console.error('Invalid regex:', expected);
          return false;
        }
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }
}