# Enhanced Logging System for AEF Agents

A smart, organized logging system that creates dedicated folders for each agent execution with timestamps, comprehensive metadata, and easy analysis tools.

## 📁 **File Organization**

The enhanced logging system is now organized in the `AEF/agents/logging/` folder:

```
AEF/agents/logging/
├── enhanced_logging_system.py    # Core logging system
├── log_analyzer.py              # CLI analysis tool  
├── ENHANCED_LOGGING_README.md   # This documentation
└── __init__.py                  # Package initialization
```

## 🚀 Features

### **Organized Structure**
- **Timestamped Folders**: Each execution gets its own folder with format `YYYYMMDD_HHMMSS_agent_id_unique_id`
- **Structured Organization**: Separate folders for logs, screenshots, artifacts, and analysis
- **Metadata Tracking**: Complete execution metadata in JSON format
- **Human-Readable Reports**: Automatic generation of markdown execution reports

### **Smart Logging**
- **Real-time Tracking**: Logs are updated throughout execution
- **Artifact Management**: Automatic organization of GIFs, screenshots, and conversation logs
- **Error Handling**: Comprehensive error logging and recovery information
- **Performance Metrics**: Token usage, duration, step counts, and efficiency metrics

### **Analysis Tools**
- **CLI Interface**: Command-line tools for browsing and analyzing executions
- **Comparison Tools**: Side-by-side comparison of different executions
- **Cleanup Utilities**: Automated cleanup of old logs with configurable retention
- **Search and Filter**: Easy discovery of specific executions

## 📁 Folder Structure

```
AEF/agents/execution_logs/
├── 20241215_143022_gmail_airtable_processor_a1b2c3d4/
│   ├── execution_metadata.json          # Complete execution metadata
│   ├── EXECUTION_REPORT.md              # Human-readable summary
│   ├── conversation_logs/               # Browser-use conversation logs
│   │   ├── gmail_airtable_processor_conversation.json
│   │   ├── step_001.json
│   │   ├── step_002.json
│   │   └── ...
│   ├── screenshots/                     # Step-by-step screenshots
│   │   ├── step_001_login.png
│   │   ├── step_002_navigate.png
│   │   └── ...
│   ├── artifacts/                       # Generated artifacts
│   │   ├── gmail_airtable_processor_history.gif
│   │   └── execution_summary.txt
│   └── analysis/                        # Analysis results (future use)
└── 20241215_150145_gmail_airtable_processor_b2c3d4e5/
    └── ...
```

## 🛠️ Usage

### **Basic Usage with Enhanced Logging**

```python
from AEF.agents.optimal_agent_config_v2 import OptimalAgentConfigV2

# Define your task
task = """
Process emails from Gmail and transfer relevant data to Airtable:
1. Access Gmail and identify emails from Elena Rios
2. Extract key information (name, email, message content)
3. Open Airtable and navigate to the appropriate base
4. Create new records with the extracted information
5. Verify the data was correctly transferred
"""

# Run with enhanced logging
result, logger = OptimalAgentConfigV2.run_agent_with_enhanced_logging(
    task=task,
    sensitive_data={
        "gmail_email": "your-email@gmail.com",
        "gmail_password": "your-app-password",
        "airtable_api_key": "your-airtable-api-key"
    },
    allowed_domains=["gmail.com", "airtable.com"],
    model_name="gpt-4o",
    temperature=0.1,
    generate_gif=True
)

print(f"Execution completed! Logs saved to: {logger.execution_folder}")
```

### **Manual Logger Control**

```python
from AEF.agents.logging.enhanced_logging_system import EnhancedLogger
from AEF.agents.optimal_agent_config import OptimalAgentConfig

# Initialize logger
logger = EnhancedLogger(agent_id="my_custom_agent")
execution_id = logger.start_execution(
    task_description="Custom task description",
    execution_config={"custom_param": "value"}
)

# Create agent with custom logging paths
agent = OptimalAgentConfig.create_agent(
    task="Your task here",
    save_conversation_path=logger.get_conversation_log_path(),
    generate_gif=logger.get_gif_path()
)

try:
    # Run your agent
    result = agent.run()
    
    # Complete logging
    logger.complete_execution(
        success=True,
        final_summary="Task completed successfully!",
        total_tokens=12500
    )
except Exception as e:
    # Handle errors
    logger.complete_execution(
        success=False,
        error=str(e),
        final_summary="Execution failed"
    )
```

## 📊 Analysis Tools

### **Command Line Interface**

```bash
# List recent executions
python AEF/agents/logging/log_analyzer.py --list

# Show detailed information about a specific execution
python AEF/agents/logging/log_analyzer.py --details 20241215_143022_gmail_airtable_processor_a1b2c3d4

# Compare two executions
python AEF/agents/logging/log_analyzer.py --compare EXEC_ID_1 EXEC_ID_2

# Clean up old logs (dry run)
python AEF/agents/logging/log_analyzer.py --cleanup --days 30

# Actually delete old logs
python AEF/agents/logging/log_analyzer.py --cleanup --days 30 --no-dry-run

# List with verbose details
python AEF/agents/logging/log_analyzer.py --list --verbose --limit 20
```

### **Programmatic Analysis**

```python
from AEF.agents.logging.enhanced_logging_system import EnhancedLogger

# List all executions
executions = EnhancedLogger.list_executions()
for exec_data in executions[:5]:  # Show last 5
    metadata = exec_data['metadata']
    print(f"ID: {exec_data['folder']}")
    print(f"Success: {metadata['success']}")
    print(f"Duration: {metadata['duration_seconds']:.1f}s")
    print(f"Steps: {metadata['steps_completed']}")
    print()

# Get detailed summary
summary = EnhancedLogger.get_execution_summary("path/to/execution/folder")
print(f"Execution took {summary['duration']:.1f}s with {summary['steps']} steps")
```

## 📈 Metadata Structure

Each execution generates comprehensive metadata:

```json
{
  "execution_id": "20241215_143022_gmail_airtable_processor_a1b2c3d4",
  "agent_id": "gmail_airtable_processor",
  "start_time": "2024-12-15T14:30:22.123456",
  "end_time": "2024-12-15T14:32:15.654321",
  "duration_seconds": 113.5,
  "status": "completed",
  "success": true,
  "steps_completed": 68,
  "total_tokens": 2186602,
  "task_description": "Process emails from Gmail...",
  "execution_config": {
    "model_name": "gpt-4o",
    "temperature": 0.1,
    "max_actions_per_step": 10,
    "use_vision": true,
    "generate_gif": true
  },
  "artifacts": {
    "conversation_logs": ["step_001.json", "step_002.json", "..."],
    "screenshots": [
      {"step": 1, "path": "screenshots/step_001_login.png", "description": "login"},
      {"step": 2, "path": "screenshots/step_002_navigate.png", "description": "navigate"}
    ],
    "gif_file": "artifacts/gmail_airtable_processor_history.gif",
    "final_summary": "EXECUTION RESULTS:\n==================\n..."
  },
  "error": null
}
```

## 🔧 Configuration

### **Environment Variables**

```bash
# Optional: Custom base directory for logs
export AEF_LOG_DIR="custom/log/directory"

# Required: OpenAI API key
export OPENAI_API_KEY="your-openai-api-key"
```

### **Customization**

```python
# Custom logger configuration
logger = EnhancedLogger(
    base_log_dir="custom/log/directory",
    agent_id="my_custom_agent"
)

# Custom execution configuration
result, logger = OptimalAgentConfigV2.run_agent_with_enhanced_logging(
    task="Your task",
    model_name="gpt-4o-mini",  # Use different model
    temperature=0.2,           # Adjust creativity
    max_actions_per_step=15,   # More actions per step
    generate_gif=False,        # Disable GIF generation
    custom_param="value"       # Custom parameters
)
```

## 🔍 Migration from Old System

### **Differences from Old Logging**

| Old System | Enhanced System |
|------------|-----------------|
| Single `logs/` folder | Timestamped execution folders |
| Numbered files (`_1.txt`, `_2.txt`) | Organized by type and step |
| No metadata tracking | Comprehensive metadata |
| Manual log analysis | Automated analysis tools |
| No cleanup tools | Built-in cleanup utilities |

### **Backward Compatibility**

The enhanced system is designed to work alongside the existing system:

- Old logs in `AEF/agents/logs/` remain untouched
- New executions use the enhanced system by default
- You can still use `optimal_agent_config.py` for the old system
- Use `optimal_agent_config_v2.py` for the enhanced system

## 🚨 Troubleshooting

### **Common Issues**

1. **Import Errors**
   ```bash
   # Make sure you're in the right directory
   cd /path/to/your/project
   python -c "from AEF.agents.logging.enhanced_logging_system import EnhancedLogger"
   ```

2. **Permission Errors**
   ```bash
   # Check directory permissions
   ls -la AEF/agents/
   chmod 755 AEF/agents/execution_logs/
   ```

3. **Disk Space**
   ```bash
   # Check available space
   df -h
   
   # Clean up old logs
   python AEF/agents/logging/log_analyzer.py --cleanup --days 7 --no-dry-run
   ```

### **Debug Mode**

```python
# Enable verbose logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Run with error handling
try:
    result, logger = OptimalAgentConfigV2.run_agent_with_enhanced_logging(task="...")
except Exception as e:
    print(f"Error: {e}")
    # Check the execution folder for partial logs
    print(f"Partial logs may be in: {logger.execution_folder}")
```

## 📚 Examples

### **Example 1: Gmail to Airtable Workflow**

```python
from AEF.agents.optimal_agent_config_v2 import OptimalAgentConfigV2

task = "Extract emails from Elena Rios and add to Airtable customer database"

result, logger = OptimalAgentConfigV2.run_agent_with_enhanced_logging(
    task=task,
    sensitive_data={
        "gmail_email": "user@company.com",
        "gmail_password": "app-specific-password",
        "airtable_api_key": "keyXXXXXXXXXXXXXX",
        "airtable_base_id": "appXXXXXXXXXXXXXX"
    },
    allowed_domains=["gmail.com", "airtable.com", "google.com"],
    generate_gif=True
)

print(f"✅ Completed in {logger.metadata['duration_seconds']:.1f}s")
print(f"📊 Used {logger.metadata['total_tokens']:,} tokens")
print(f"📁 Logs: {logger.execution_folder}")
```

### **Example 2: Batch Processing with Analysis**

```python
from AEF.agents.logging.enhanced_logging_system import EnhancedLogger
from AEF.agents.optimal_agent_config_v2 import OptimalAgentConfigV2

# Run multiple tasks
tasks = [
    "Process morning emails",
    "Update customer database", 
    "Generate daily report"
]

execution_ids = []
for task in tasks:
    result, logger = OptimalAgentConfigV2.run_agent_with_enhanced_logging(task=task)
    execution_ids.append(logger.execution_id)

# Analyze results
executions = EnhancedLogger.list_executions()
total_duration = sum(e['metadata']['duration_seconds'] for e in executions[:3])
total_tokens = sum(e['metadata']['total_tokens'] for e in executions[:3])

print(f"📊 Batch Summary:")
print(f"   Total Duration: {total_duration:.1f}s")
print(f"   Total Tokens: {total_tokens:,}")
print(f"   Average per Task: {total_duration/len(tasks):.1f}s")
```

## 🤝 Contributing

To extend the enhanced logging system:

1. **Add New Metrics**: Extend the `metadata` structure in `EnhancedLogger`
2. **Custom Analyzers**: Create new analysis functions in `LogAnalyzer`
3. **Export Formats**: Add new export formats (CSV, Excel, etc.)
4. **Visualization**: Add plotting and visualization capabilities

## 📄 License

This enhanced logging system is part of the AEF project and follows the same license terms.

---

**Happy Logging! 🎉**

For questions or issues, check the execution logs first - they contain detailed information about what happened during your agent runs! 