const fs = require('fs');
const Ajv = require('ajv');

// Load schema and workflow
const schema = JSON.parse(fs.readFileSync('aef/workflows/schemas/workflow-schema.json', 'utf-8'));
const workflow = JSON.parse(fs.readFileSync('aef/workflows/gmail-investor-crm-v2.json', 'utf-8'));

// Validate
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);
const isValid = validate(workflow);

if (isValid) {
  console.log('✅ gmail-investor-crm-v2.json is valid');
} else {
  console.log('❌ Validation errors:');
  validate.errors.forEach((err, i) => {
    console.log(`${i+1}. ${err.instancePath || 'root'}: ${err.message}`);
    if (err.data !== undefined) {
      console.log(`   Data: ${JSON.stringify(err.data)}`);
    }
  });
  process.exit(1);
} 