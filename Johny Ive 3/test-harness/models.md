# AI Models Used in test-harness

This document outlines all AI models referenced in the test-harness folder, their locations, primary usage, and purpose.

## Primary Models

### 1. **o4-mini** (PRIMARY MODEL)
The primary AI model used throughout the test-harness system.

#### Locations and Usage:
- **`operator/backend/services/directorService.js`** (Line 183)
  - Default model for the Director service
  - Used for workflow orchestration and automation
  - Can be overridden via `DIRECTOR_MODEL` environment variable
  - Utilizes OpenAI's Responses API for reasoning capabilities

- **`operator/backend/services/scoutService.js`** (Line 41)
  - Default model for the Scout service
  - Used for lightweight UI reconnaissance and exploration
  - Can be overridden via `SCOUT_MODEL` environment variable
  - Provides detailed analysis of UI patterns and selectors

- **`workflows/executor/primitives/cognition.js`** (Line 10)
  - Default model for the Cognition primitive
  - Handles AI-powered data processing without side effects
  - Processes information and returns structured JSON insights
  - Features schema validation and automatic retries

- **`workflows/interfaces/server.js`** (Line 36)
  - Used in StageHand configuration for browser automation
  - Powers the workflow execution server interface
  - Enables AI-driven browser interactions

- **`workflows/interfaces/cli.js`** (Line 45)
  - Used in StageHand configuration for browser automation
  - Powers the workflow execution CLI interface
  - Enables AI-driven browser interactions

- **`operator/scouts/examples/run_scout_o4mini.py`** (Line 34)
  - Example implementation of Scout using o4-mini
  - Demonstrates scout deployment patterns

- **`operator/backend/test-tokens.js`**
  - Used for testing OpenAI's Responses API
  - Validates token usage and response structures

## Alternative Models

### 2. **o3**
- **`operator/backend/services/directorService.js`**
  - Alternative reasoning model for Director
  - Can be selected via environment variable
  - Supported variants: `o3`, `o3-2025-04-16`

### 3. **o4-mini-2025-04-16**
- **`operator/backend/services/directorService.js`**
  - Specific dated version of o4-mini
  - Ensures consistency for production deployments

### 4. **gpt-4o**
- **`operator/backend/services/directorService.js`**
  - Fallback model via Chat Completions API
  - Used when reasoning models are unavailable

- **`operator/scouts/core/scout_config.py`**
  - Configured for model benchmarking in Python scouts
  - Part of multi-model testing suite

- **`operator/backend/test-tokens.js`**
  - Used for testing Chat Completions API

### 5. **gpt-4o-mini**
- **`operator/backend/services/directorService.js`**
  - Fallback model via Chat Completions API
  - More cost-effective alternative to gpt-4o

- **`operator/scouts/core/scout_config.py`**
  - Configured for lightweight scout operations
  - Part of multi-model testing suite

- **`operator/backend/test-tokens.js`**
  - Used for testing Chat Completions API

### 6. **gemini-2.0-flash** (Google)
- **`operator/scouts/core/scout_config.py`**
  - Google's model for scout operations
  - Used for model comparison and benchmarking
  - Note: Contains hardcoded API key (security concern)

### 7. **gemini-2.5-pro** (Google)
- **`operator/scouts/core/scout_engine.py`** (Line 46)
  - Used in zero-configuration scout deployment
  - Python-based scout implementation
  - Note: Contains hardcoded API key (security concern)

### 8. **o1-mini-2025-01-16**
- **`operator/scouts/core/scout_config.py`**
  - OpenAI's o1 model variant
  - Used for specialized scout operations

## Model Selection Strategy

1. **Primary Choice**: `o4-mini` is the default across all services
2. **Environment Override**: Models can be changed via environment variables:
   - `DIRECTOR_MODEL` for Director service
   - `SCOUT_MODEL` for Scout service
3. **API Selection**:
   - Reasoning models (o4-mini, o3) use OpenAI's Responses API
   - Traditional models (gpt-4o, gpt-4o-mini) use Chat Completions API
4. **Language Differences**:
   - JavaScript implementation focuses on OpenAI models
   - Python implementation supports multi-provider testing (OpenAI + Google)

## Security Notes

⚠️ **Important**: The Python scout configuration files contain hardcoded API keys for Google services. These should be moved to environment variables for security.

## Performance Considerations

- `o4-mini`: Best balance of performance and cost for reasoning tasks
- `gpt-4o-mini`: More cost-effective for simple completions
- `gemini-2.5-pro`: Alternative provider option for redundancy
- Model selection can significantly impact workflow execution speed and accuracy