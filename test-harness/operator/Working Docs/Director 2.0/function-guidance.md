Defining Functions

Functions can be defined in the tools parameter of each API request.

A function is described by its schema, which tells the model what the function does and what input it expects. The schema includes the following fields:

Field	Description
type	This should always be "function"
name	The function’s name (e.g., get_weather)
description	A short explanation of when and how to use the function
parameters	JSON schema defining the function’s input arguments
strict	Whether to enforce strict mode for the function call

Example

{
  "type": "function",
  "name": "get_weather",
  "description": "Retrieves current weather for the given location.",
  "parameters": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "City and country e.g. Bogotá, Colombia"
      },
      "units": {
        "type": "string",
        "enum": [
          "celsius",
          "fahrenheit"
        ],
        "description": "Units the temperature will be returned in."
      }
    },
    "required": [
      "location",
      "units"
    ],
    "additionalProperties": false
  },
  "strict": true
}

Since function parameters are defined using a JSON Schema, you can take advantage of features like:
	•	Property types
	•	Enums
	•	Descriptions
	•	Nested and recursive objects

⸻

Best Practices for Defining Functions
	•	✅ Write clear and detailed function names, parameter descriptions, and usage instructions.
	•	✅ Explicitly describe the purpose of the function and each parameter (including format), and what the function returns.
	•	✅ Use the system prompt to define when (and when not) to use each function.
	•	✅ Include examples and edge cases to handle common failure points.
(Note: examples may reduce performance for reasoning models.)
	•	✅ Apply software engineering best practices.
	•	✅ Make functions obvious and intuitive — follow the Principle of Least Surprise.
	•	✅ Use enums and object structure to make invalid states unrepresentable.
(e.g., toggle_light(on: bool, off: bool) allows invalid combinations — avoid this!)
	•	✅ Pass the intern test:
Can a new developer understand and use the function with only your schema? If not, improve it.
	•	✅ Offload known arguments to your code — don’t make the model guess them.
(e.g., if you already have order_id, don’t ask the model to supply it again.)
	•	✅ Combine sequential calls into a single function when possible.
(e.g., if query_location() is always followed by mark_location(), merge them.)
	•	✅ Keep your function set small — fewer than 20 is ideal for higher accuracy.
	•	✅ Test performance with different numbers of functions.

⸻

Additional Tips
	•	Use the Playground to generate and refine function schemas.
	•	Consider fine-tuning to boost performance on complex or large-scale function sets.
(See OpenAI Cookbook for examples.)

⸻