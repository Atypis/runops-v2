# Intelligent Planner-Executor Architecture v1

## Overview

This implements the **Option 1** architecture from the agent-architecture-memo.md - an intelligent dynamic planning system that addresses the fundamental issues we've seen in previous test runs.

## Key Features

### 🧠 **Strategic Planning Agent**
- Analyzes complex tasks and designs bulletproof execution strategies
- Creates dynamic task breakdowns that can evolve based on discoveries
- Reasons about optimal approaches (e.g., "batch collection then processing")
- Anticipates challenges and plans for edge cases

### ⚡ **Dynamic Task Execution**
- Executes ONE task at a time with focused attention
- Reports findings back to planner after each task
- Triggers replanning when discoveries or challenges are encountered
- Maintains clear success criteria for each task

### 💡 **Active Scratchpad Memory**
- Agent actively chooses what insights to remember
- Curates discoveries that might affect subsequent tasks
- Tracks challenges and attempted solutions
- Provides relevant context for each new task

### 🔄 **Feedback Loop Architecture**
```
Strategic Planner → Task Generation → Executor → Findings → Replanning → Next Task
```

## Architecture Components

### 1. `StrategicPlanner`
- **Purpose**: High-level workflow design and adaptation
- **Input**: Task description, context, executor findings
- **Output**: Structured workflow strategy with phases and tasks
- **Key Feature**: Adapts strategy based on real-world discoveries

### 2. `TaskExecutor` 
- **Purpose**: Focused execution of individual tasks
- **Input**: Single task with clear success criteria
- **Output**: Execution results and findings
- **Key Feature**: Stops after each task to report back

### 3. `ActiveScratchpad`
- **Purpose**: Agent-curated memory and insights
- **Features**: Insights, discoveries, challenges, patterns
- **Key Feature**: Agent decides what's worth remembering

### 4. `IntelligentPlannerExecutor`
- **Purpose**: Main orchestrator coordinating all components
- **Features**: Dynamic replanning, progress tracking, results analysis
- **Key Feature**: Continuous adaptation based on feedback

## Expected Improvements

Based on previous test run failures, this architecture addresses:

### ❌ **Previous Issues** → ✅ **Solutions**

1. **Fundamental Task Misunderstanding** → Strategic planning with clear business goal analysis
2. **Data Preservation Failures** → Explicit data preservation in strategy design
3. **Poor Email Processing** → Task-focused execution with validation
4. **Schema Mapping Confusion** → Context-aware task generation
5. **Premature Termination** → Clear success criteria and progress tracking

### 📊 **Performance Expectations**
- **Previous**: 5-25% success rate
- **Target**: 70%+ success rate
- **Key Improvement**: Strategic intelligence + focused execution

## Usage

### Quick Test
```bash
cd AEF
python test_intelligent_planner_executor.py
# Choose option 1 for quick Gemini test
```

### Comprehensive Test
```bash
cd AEF
python test_intelligent_planner_executor.py
# Choose option 2 for both Gemini and Claude comparison
```

### Programmatic Usage
```python
from agents.intelligent_planner_executor import IntelligentPlannerExecutor

# Create intelligent agent
agent = IntelligentPlannerExecutor(
    task="Your complex workflow task",
    sensitive_data={"gmail_email": "...", "gmail_password": "..."},
    allowed_domains=["https://*.google.com", "https://*.airtable.com"],
    use_gemini=True,  # or False for Claude
    max_steps_per_task=100,
    agent_id="my_workflow"
)

# Execute with dynamic planning
results = await agent.execute_workflow()

# Analyze results
print(f"Success Rate: {results['success_rate']:.1f}%")
print(f"Insights Discovered: {results['insights_discovered']}")
print(f"Strategy Used: {results['strategy']}")
```

## Key Innovations

### 1. **Strategic Intelligence**
Instead of hardcoded steps, the planner reasons about optimal approaches:
```
"I need to process emails and update a CRM. Let me consider approaches:
- Option 1: Process each email individually (simple but inefficient)
- Option 2: Batch collection then processing (more efficient, better error recovery)
I'll choose Option 2 because Gmail is better for scanning and Airtable works better with batch operations."
```

### 2. **Dynamic Adaptation**
When the executor discovers something unexpected:
```
Executor: "Found 25 emails instead of expected 16"
Planner: "Adapting strategy - creating 25 individual email processing tasks"
```

### 3. **Active Learning**
Agent curates insights for future use:
```
💡 INSIGHT: "Airtable requires waiting for sync indicator before submitting" (confidence: 0.9)
🔍 DISCOVERY: "Gmail has anti-automation detection" (impact: "High - affects navigation strategy")
⚠️ CHALLENGE: "Field mapping differs from documentation"
```

## File Structure

```
AEF/agents/
├── intelligent_planner_executor.py    # Main architecture implementation
├── README_Intelligent_Planner_Executor.md  # This file
└── logs/                              # Execution logs and GIFs

AEF/
├── test_intelligent_planner_executor.py    # Test script
└── Evals/Test-Runs/Intelligent-Planner-Tests/  # Test results
```

## Comparison with Previous Approaches

| Feature | Previous (v3) | Intelligent Planner-Executor |
|---------|---------------|------------------------------|
| Planning | Static planner every 5 steps | Dynamic strategic planning with adaptation |
| Memory | Passive summarization | Active insight curation |
| Execution | Monolithic workflow | Task-by-task with feedback |
| Adaptation | Limited | Full replanning based on discoveries |
| Data Preservation | Implicit | Explicit strategic consideration |
| Success Rate | 5-25% | Target: 70%+ |

## Next Steps

1. **Run Initial Tests**: Use the test script to evaluate performance
2. **Analyze Results**: Review execution logs and scratchpad insights
3. **Iterate Based on Findings**: Refine planning prompts and task generation
4. **Add Validation Layer**: Implement the validation system from the original design
5. **Scale to More Workflows**: Apply architecture to additional use cases

## Expected Timeline

- **Day 1**: Initial testing and baseline establishment
- **Day 2-3**: Refinement based on test results
- **Day 4-5**: Optimization and validation system addition
- **Target**: 90% success rate by end of sprint

This architecture represents a fundamental shift from "smart scripts" to "intelligent consultants" that genuinely understand and optimize business workflows. 