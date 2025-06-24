import { BrowserQueryPrimitive } from './workflows/executor/primitives/browser-query.js';

// Test the schema conversion directly
const browserQuery = new BrowserQueryPrimitive({
  state: {
    get: (key) => console.log(`Getting state: ${key}`),
    set: (key, value) => console.log(`Setting state: ${key} = ${value}`)
  }
});

// Test schema
const testSchema = {
  titles: "array",
  links: "array"
};

console.log('Testing schema conversion...');
console.log('Input schema:', testSchema);

try {
  // Access the conversion method directly
  const zodSchema = browserQuery.convertJsonSchemaToZod(testSchema);
  console.log('Conversion successful!');
  console.log('Zod schema:', zodSchema);
} catch (error) {
  console.error('Conversion failed:', error);
  console.error('Error stack:', error.stack);
}