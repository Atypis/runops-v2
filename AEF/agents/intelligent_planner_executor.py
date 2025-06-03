"""
Intelligent Planner-Executor Architecture v1
Dynamic planning with feedback loops and active scratchpad memory

This implements the vision from agent-architecture-memo.md:
- Strategic planning agent that designs bulletproof workflows
- Dynamic task generation based on discoveries
- Active scratchpad memory for agent-curated insights
- Feedback loop between planner and executor
"""

import os
import asyncio
import json
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum
from dotenv import load_dotenv

load_dotenv()

from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from browser_use import Agent
from browser_use.browser import BrowserSession, BrowserProfile
from browser_use.agent.memory import MemoryConfig


class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"


@dataclass
class WorkflowTask:
    """Individual task in the workflow"""
    task_id: str
    title: str
    description: str
    success_criteria: List[str]
    dependencies: List[str]
    status: TaskStatus = TaskStatus.PENDING
    findings: Optional[str] = None
    challenges: Optional[str] = None
    adaptation_notes: Optional[str] = None


@dataclass
class WorkflowPhase:
    """Phase containing multiple related tasks"""
    phase_id: str
    title: str
    objective: str
    tasks: List[WorkflowTask]
    status: TaskStatus = TaskStatus.PENDING


@dataclass
class WorkflowStrategy:
    """Complete workflow strategy from the planner"""
    approach: str
    reasoning: str
    phases: List[WorkflowPhase]
    risk_factors: List[str]
    adaptation_points: List[str]


class ActiveScratchpad:
    """
    🧠 CENTRAL WORKING MEMORY FOR ALL AGENTS
    
    This is the ONE AND ONLY place where all agents store and retrieve critical information.
    Every discovery, insight, and piece of business data MUST be stored here.
    
    CRITICAL: All agents (Planner, Executor, Browser Agent) use this as their shared brain.
    """
    
    def __init__(self):
        self.insights: List[Dict[str, Any]] = []
        self.discoveries: List[Dict[str, Any]] = []
        self.challenges: List[Dict[str, Any]] = []
        self.patterns: List[Dict[str, Any]] = []
        
        # Enhanced structured storage for business data
        self.business_data: Dict[str, List[Dict[str, Any]]] = {
            "investors": [],           # Investor profiles and details
            "emails": [],             # Email content and metadata
            "airtable_schema": [],    # Airtable field mappings and structure
            "ui_patterns": [],        # UI navigation patterns discovered
            "authentication": [],     # Login states and session info
            "data_mappings": []       # Field-to-field mapping discoveries
        }
    
    def add_insight(self, insight: str, confidence: float, category: str = "general"):
        """Agent actively chooses to remember important insights"""
        self.insights.append({
            "timestamp": datetime.now().isoformat(),
            "insight": insight,
            "confidence": confidence,
            "category": category
        })
    
    def add_discovery(self, discovery: str, impact: str, task_id: str):
        """Record discoveries that might affect the workflow"""
        self.discoveries.append({
            "timestamp": datetime.now().isoformat(),
            "discovery": discovery,
            "impact": impact,
            "task_id": task_id
        })
    
    def add_challenge(self, challenge: str, attempted_solutions: List[str], task_id: str):
        """Record challenges and attempted solutions"""
        self.challenges.append({
            "timestamp": datetime.now().isoformat(),
            "challenge": challenge,
            "attempted_solutions": attempted_solutions,
            "task_id": task_id
        })
    
    def store_business_data(self, data_type: str, data: Dict[str, Any]):
        """Store structured business data by type"""
        if data_type in self.business_data:
            # Add timestamp and ensure uniqueness
            data["timestamp"] = datetime.now().isoformat()
            self.business_data[data_type].append(data)
        else:
            print(f"⚠️ Unknown data type: {data_type}. Available: {list(self.business_data.keys())}")
    
    def get_business_data(self, data_type: str) -> List[Dict[str, Any]]:
        """Retrieve all business data of a specific type"""
        return self.business_data.get(data_type, [])
    
    def get_insights_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Get insights filtered by category"""
        return [insight for insight in self.insights if insight["category"] == category]
    
    def get_relevant_context(self, task_id: str, category: Optional[str] = None) -> str:
        """Get relevant context for current task"""
        relevant_items = []
        
        # Get insights
        for insight in self.insights:
            if not category or insight["category"] == category:
                relevant_items.append(f"💡 INSIGHT: {insight['insight']} (confidence: {insight['confidence']})")
        
        # Get discoveries
        for discovery in self.discoveries:
            relevant_items.append(f"🔍 DISCOVERY: {discovery['discovery']} (impact: {discovery['impact']})")
        
        # Get challenges
        for challenge in self.challenges:
            relevant_items.append(f"⚠️ CHALLENGE: {challenge['challenge']}")
        
        return "\n".join(relevant_items) if relevant_items else "No relevant context yet."
    
    def get_complete_context(self) -> str:
        """Get complete scratchpad context for agent briefing"""
        context_parts = []
        
        # Business Data Summary
        context_parts.append("🏢 BUSINESS DATA DISCOVERED:")
        for data_type, data_list in self.business_data.items():
            if data_list:
                context_parts.append(f"  📊 {data_type.upper()}: {len(data_list)} items")
                for item in data_list[-3:]:  # Show last 3 items
                    context_parts.append(f"    • {str(item)[:100]}...")
        
        # Recent Insights
        if self.insights:
            context_parts.append("\n💡 KEY INSIGHTS:")
            for insight in self.insights[-5:]:  # Show last 5 insights
                context_parts.append(f"  • {insight['insight']} (confidence: {insight['confidence']})")
        
        # Recent Discoveries
        if self.discoveries:
            context_parts.append("\n🔍 RECENT DISCOVERIES:")
            for discovery in self.discoveries[-3:]:  # Show last 3 discoveries
                context_parts.append(f"  • {discovery['discovery']}")
        
        # Active Challenges
        if self.challenges:
            context_parts.append("\n⚠️ ACTIVE CHALLENGES:")
            for challenge in self.challenges[-2:]:  # Show last 2 challenges
                context_parts.append(f"  • {challenge['challenge']}")
        
        return "\n".join(context_parts) if context_parts else "🧠 SCRATCHPAD EMPTY - Start discovering and storing information!"
    
    def get_sample_usage_guide(self) -> str:
        """Provide sample usage guide for agents"""
        return """
🧠 SCRATCHPAD USAGE GUIDE - CRITICAL FOR ALL AGENTS:

📊 BUSINESS DATA STORAGE:
scratchpad.store_business_data("investors", {
    "name": "John Smith",
    "company": "Acme Ventures", 
    "email": "john@acme.com",
    "stage": "Series A",
    "amount": "$2M",
    "date": "2024-01-15"
})

scratchpad.store_business_data("airtable_schema", {
    "field_name": "Investor Name",
    "field_type": "Single line text",
    "position": 1,
    "required": True
})

💡 INSIGHTS STORAGE:
scratchpad.add_insight("Gmail uses new UI with conversation view", 0.9, "ui_patterns")
scratchpad.add_insight("Investor emails follow pattern: [Name] from [Company]", 0.8, "email_patterns")

🔍 DISCOVERIES:
scratchpad.add_discovery("Found 15 investor emails in inbox", "high", task_id)
scratchpad.add_discovery("Airtable has 10 fields exactly as specified", "critical", task_id)

⚠️ CHALLENGES:
scratchpad.add_challenge("Gmail 2FA required", ["tried password", "used backup codes"], task_id)

REMEMBER: The scratchpad is your SHARED BRAIN. Use it constantly!
"""


class StrategicPlanner:
    """Intelligent planning agent that designs and adapts workflows"""
    
    def __init__(self, llm, scratchpad: ActiveScratchpad, use_gemini: bool = True):
        self.llm = llm
        self.scratchpad = scratchpad
        self.use_gemini = use_gemini
        self.model_name = "Gemini 2.5 Flash" if use_gemini else "Claude Sonnet 4"
    
    async def create_initial_strategy(self, task: str, context: Dict[str, Any]) -> WorkflowStrategy:
        """Create initial high-level workflow strategy"""
        
        system_prompt = """You are an expert workflow strategist and consultant. Your role is to analyze complex business tasks and design bulletproof, efficient execution strategies.

🎯 PERFECTION MINDSET: Your goal is 100% success rate. Zero tolerance for failure. Design strategies that WILL work, not strategies that might work.

🧠 CRITICAL: You work with a SHARED SCRATCHPAD - the central working memory for all agents. This scratchpad contains:
- Business data discovered (investors, emails, schemas)
- Insights from previous tasks
- Challenges encountered and solutions
- UI patterns and navigation discoveries

ALWAYS consider scratchpad content when planning and adapting strategies. The scratchpad is your SHARED BRAIN with the executor agents.

Your core capabilities:
1. Strategic Analysis: Break down high-level tasks to understand the true end goal
2. Optimal Strategy Design: Reason about the most efficient approach
3. Dynamic Planning: Create adaptive task breakdowns that can evolve
4. Risk Assessment: Anticipate challenges and failure modes
5. Clear Communication: Provide transparent, actionable plans
6. PERFECTION FOCUS: Design for 100% success, not "good enough"
7. SCRATCHPAD INTEGRATION: Always leverage shared working memory

When given a task, follow this reasoning framework:

1. Goal Analysis: What is the ultimate objective and success criteria?
2. Scratchpad Review: What relevant information is already discovered?
3. Strategy Design: What are different approaches and which is optimal?
4. Execution Planning: Break strategy into logical phases and specific tasks
5. Risk Mitigation: What could go wrong and how to handle it?
6. PERFECTION CHECK: Will this strategy achieve 100% success? If not, redesign.

Output your plan as a JSON object with this exact structure:
{
  "task_analysis": {
    "objective": "Clear statement of the end goal",
    "success_criteria": ["Specific measurable outcomes"],
    "constraints": ["Key limitations or requirements"],
    "complexity_assessment": "Simple/Medium/Complex with reasoning",
    "scratchpad_relevance": "How existing scratchpad data affects this task"
  },
  "strategy": {
    "chosen_approach": "Name of selected strategy",
    "reasoning": "Why this approach is optimal",
    "alternatives_considered": ["Other approaches and why rejected"],
    "efficiency_factors": ["What makes this approach efficient"],
    "perfection_factors": ["What ensures 100% success rate"],
    "scratchpad_dependencies": ["What scratchpad data this strategy relies on"]
  },
  "execution_plan": {
    "phases": [
      {
        "phase_id": "unique_identifier",
        "title": "Human-readable phase name",
        "objective": "What this phase accomplishes",
        "scratchpad_usage": "How this phase will use/update the scratchpad",
        "tasks": [
          {
            "task_id": "unique_identifier",
            "title": "Human-readable task name", 
            "description": "What needs to be done",
            "success_criteria": ["Specific conditions for completion"],
            "dependencies": ["task_ids this depends on"],
            "scratchpad_actions": ["What data to store in scratchpad"],
            "adaptation_points": ["Where this might change based on discoveries"]
          }
        ]
      }
    ]
  },
  "risk_management": {
    "potential_failures": [
      {
        "failure_mode": "What could go wrong",
        "likelihood": "Low/Medium/High",
        "impact": "Low/Medium/High",
        "mitigation": "How to prevent or recover",
        "scratchpad_indicators": "What scratchpad data would indicate this risk"
      }
    ],
    "adaptation_points": ["When the plan might need to change"]
  }
}

Think like a consultant designing the strategy you would recommend to a client. Be adaptive, specific, efficient, transparent, and PERFECTIONIST. Accept nothing less than 100% success. ALWAYS leverage the shared scratchpad memory."""

        user_prompt = f"""Please analyze this task and create a comprehensive execution strategy:

TASK: {task}

CONTEXT:
{json.dumps(context, indent=2)}

🧠 CURRENT SCRATCHPAD STATE (SHARED WORKING MEMORY):
{self.scratchpad.get_complete_context()}

🎯 PERFECTION REQUIREMENT: This strategy MUST achieve 100% success rate. No compromises.

Focus on creating a strategy that:
1. Understands the business goal (not just technical steps)
2. LEVERAGES existing scratchpad discoveries and data
3. Designs an efficient approach (minimize context switching)
4. Creates specific tasks with clear success criteria
5. Anticipates where adaptation might be needed
6. Plans for data preservation and integrity
7. ENSURES all discoveries are stored in the scratchpad
8. GUARANTEES 100% success through bulletproof design

Remember: This is for a Gmail→Airtable CRM workflow where data preservation is critical and PERFECTION is required. The scratchpad is your SHARED BRAIN - use it wisely!"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        response = await self.llm.ainvoke(messages)
        
        try:
            # Handle markdown code blocks that some models return
            response_content = response.content.strip()
            if response_content.startswith("```json"):
                # Remove markdown code block formatting
                response_content = response_content[7:]  # Remove ```json
                if response_content.endswith("```"):
                    response_content = response_content[:-3]  # Remove closing ```
                response_content = response_content.strip()
            elif response_content.startswith("```"):
                # Handle generic code blocks
                lines = response_content.split('\n')
                if len(lines) > 1:
                    response_content = '\n'.join(lines[1:-1])  # Remove first and last line
                response_content = response_content.strip()
            
            strategy_json = json.loads(response_content)
            return self._parse_strategy_json(strategy_json)
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse strategy JSON: {e}")
            print(f"Raw response: {response.content}")
            raise
    
    async def adapt_strategy(self, current_strategy: WorkflowStrategy, task_findings: str, 
                           scratchpad: ActiveScratchpad, current_task_id: str) -> WorkflowStrategy:
        """Adapt strategy based on executor findings"""
        
        system_prompt = """You are a strategic workflow advisor. Your job is to adapt execution plans based on real-world discoveries and challenges.

You will receive:
1. Current workflow strategy
2. Findings from the executor about the current task
3. Accumulated insights from the scratchpad
4. Current task ID

Your job is to:
1. Analyze the findings and their impact on the overall strategy
2. Determine if the current plan needs adaptation
3. Update subsequent tasks based on new information
4. Maintain the overall strategic approach while adapting tactics

Output the updated strategy in the same JSON format as the original plan. Focus on:
- Updating task descriptions based on discoveries
- Adding new tasks if needed based on findings
- Modifying success criteria if the situation has changed
- Preserving completed work and maintaining strategic coherence

Be intelligent about adaptation - don't change everything, just what needs to change based on the findings."""

        current_strategy_json = self._strategy_to_json(current_strategy)
        scratchpad_context = scratchpad.get_relevant_context(current_task_id)
        
        user_prompt = f"""Please adapt the current strategy based on these executor findings:

CURRENT STRATEGY:
{json.dumps(current_strategy_json, indent=2)}

EXECUTOR FINDINGS FOR TASK {current_task_id}:
{task_findings}

SCRATCHPAD CONTEXT:
{scratchpad_context}

Please provide the updated strategy, focusing on adapting future tasks while preserving the overall approach and completed work."""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        response = await self.llm.ainvoke(messages)
        
        try:
            # Handle markdown code blocks that some models return
            response_content = response.content.strip()
            if response_content.startswith("```json"):
                # Remove markdown code block formatting
                response_content = response_content[7:]  # Remove ```json
                if response_content.endswith("```"):
                    response_content = response_content[:-3]  # Remove closing ```
                response_content = response_content.strip()
            elif response_content.startswith("```"):
                # Handle generic code blocks
                lines = response_content.split('\n')
                if len(lines) > 1:
                    response_content = '\n'.join(lines[1:-1])  # Remove first and last line
                response_content = response_content.strip()
            
            updated_strategy_json = json.loads(response_content)
            return self._parse_strategy_json(updated_strategy_json)
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse updated strategy JSON: {e}")
            print(f"Raw response: {response.content}")
            # Return current strategy if parsing fails
            return current_strategy
    
    def _parse_strategy_json(self, strategy_json: Dict[str, Any]) -> WorkflowStrategy:
        """Parse JSON strategy into WorkflowStrategy object"""
        phases = []
        
        for phase_data in strategy_json["execution_plan"]["phases"]:
            tasks = []
            for task_data in phase_data["tasks"]:
                task = WorkflowTask(
                    task_id=task_data["task_id"],
                    title=task_data["title"],
                    description=task_data["description"],
                    success_criteria=task_data["success_criteria"],
                    dependencies=task_data.get("dependencies", [])
                )
                tasks.append(task)
            
            phase = WorkflowPhase(
                phase_id=phase_data["phase_id"],
                title=phase_data["title"],
                objective=phase_data["objective"],
                tasks=tasks
            )
            phases.append(phase)
        
        return WorkflowStrategy(
            approach=strategy_json["strategy"]["chosen_approach"],
            reasoning=strategy_json["strategy"]["reasoning"],
            phases=phases,
            risk_factors=[rf["failure_mode"] for rf in strategy_json["risk_management"]["potential_failures"]],
            adaptation_points=strategy_json["risk_management"]["adaptation_points"]
        )
    
    def _strategy_to_json(self, strategy: WorkflowStrategy) -> Dict[str, Any]:
        """Convert WorkflowStrategy back to JSON format"""
        return {
            "strategy": {
                "chosen_approach": strategy.approach,
                "reasoning": strategy.reasoning
            },
            "execution_plan": {
                "phases": [
                    {
                        "phase_id": phase.phase_id,
                        "title": phase.title,
                        "objective": phase.objective,
                        "tasks": [
                            {
                                "task_id": task.task_id,
                                "title": task.title,
                                "description": task.description,
                                "success_criteria": task.success_criteria,
                                "dependencies": task.dependencies,
                                "status": task.status.value,
                                "findings": task.findings,
                                "challenges": task.challenges
                            }
                            for task in phase.tasks
                        ]
                    }
                    for phase in strategy.phases
                ]
            },
            "risk_management": {
                "potential_failures": strategy.risk_factors,
                "adaptation_points": strategy.adaptation_points
            }
        }


class TaskExecutor:
    """Executes individual tasks and reports findings back to planner"""
    
    def __init__(self, agent: Agent, scratchpad: ActiveScratchpad, max_steps_per_task: int = 500):
        self.agent = agent
        self.scratchpad = scratchpad
        self.max_steps_per_task = max_steps_per_task
    
    async def execute_task(self, task: WorkflowTask, strategy_context: str) -> Dict[str, Any]:
        """Execute a single task and return findings"""
        
        print(f"\n🎯 EXECUTING TASK: {task.title}")
        print(f"📝 Description: {task.description}")
        print(f"✅ Success Criteria: {', '.join(task.success_criteria)}")
        
        # Get relevant context from scratchpad
        relevant_context = self.scratchpad.get_relevant_context(task.task_id)
        
        # Create enhanced task prompt with context
        enhanced_task = f"""
🎯 CURRENT TASK: {task.title}

📝 TASK DESCRIPTION:
{task.description}

✅ SUCCESS CRITERIA:
{chr(10).join(f"- {criteria}" for criteria in task.success_criteria)}

🧠 COMPLETE SCRATCHPAD CONTEXT (YOUR SHARED WORKING MEMORY):
{self.scratchpad.get_complete_context()}

🎯 STRATEGIC CONTEXT:
{strategy_context}

🧠 SCRATCHPAD USAGE GUIDE:
{self.scratchpad.get_sample_usage_guide()}

🚨 CRITICAL INSTRUCTIONS:
1. Focus ONLY on this specific task - do not try to complete the entire workflow
2. CONSTANTLY use the scratchpad to store ANY discoveries, insights, or business data
3. When you find investor information, IMMEDIATELY store it using scratchpad.store_business_data("investors", data)
4. When you discover UI patterns or navigation, store them as insights
5. When you complete this task OR encounter significant challenges, STOP and report your findings
6. Pay attention to any discoveries that might affect subsequent tasks
7. If you find information that contradicts our assumptions, note it clearly
8. Preserve all existing data - never create new tables or delete existing information
9. The scratchpad is your SHARED BRAIN with other agents - use it religiously!

📊 BUSINESS DATA TO CAPTURE:
- Investor names, companies, emails, funding stages, amounts, dates
- Airtable field names, types, positions, requirements
- Email patterns, structures, and content insights
- UI navigation patterns and authentication states
- Any data mappings or relationships discovered

🔄 REPORTING REQUIREMENTS:
When you complete this task, provide a clear summary of:
- What you accomplished
- What data you stored in the scratchpad
- Any important discoveries
- Challenges encountered
- Recommendations for subsequent tasks
- Current state of the system

Execute this task now, focusing on quality, thoroughness, and CONSTANT scratchpad usage rather than speed.
"""
        
        print(f"\n📋 ENHANCED TASK BEING SENT TO BROWSER AGENT:")
        print("="*60)
        print(enhanced_task)
        print("="*60)
        
        task.status = TaskStatus.IN_PROGRESS
        
        try:
            # CRITICAL FIX: Update the MessageManager's task, not just the Agent's task
            # This ensures the LLM actually sees our dynamic task updates
            self.agent._message_manager.add_new_task(enhanced_task)
            
            # Execute the task with the agent
            history = await self.agent.run(max_steps=self.max_steps_per_task)
            
            # Analyze the execution results
            findings = self._analyze_execution_results(history, task)
            
            # Update task status based on results
            if self._task_completed_successfully(history, task):
                task.status = TaskStatus.COMPLETED
                task.findings = findings["summary"]
                
                # Add insights to scratchpad
                if findings.get("insights"):
                    for insight in findings["insights"]:
                        self.scratchpad.add_insight(
                            insight["text"], 
                            insight["confidence"], 
                            task.task_id
                        )
                
                # Add discoveries
                if findings.get("discoveries"):
                    for discovery in findings["discoveries"]:
                        self.scratchpad.add_discovery(
                            discovery["text"],
                            discovery["impact"],
                            task.task_id
                        )
                
                print(f"✅ TASK COMPLETED: {task.title}")
                
                # Show scratchpad data stored
                if findings.get("scratchpad_data_stored"):
                    print(f"🧠 Scratchpad data stored:")
                    for data_item in findings["scratchpad_data_stored"]:
                        print(f"   • {data_item}")
                
            else:
                task.status = TaskStatus.BLOCKED
                task.challenges = findings["challenges"]
                
                # Add challenges to scratchpad
                if findings.get("challenges"):
                    self.scratchpad.add_challenge(
                        findings["challenges"],
                        findings.get("attempted_solutions", []),
                        task.task_id
                    )
                
                print(f"⚠️ TASK BLOCKED: {task.title}")
            
            return {
                "task_id": task.task_id,
                "status": task.status.value,
                "findings": findings,
                "scratchpad_updates": {
                    "insights_added": len(findings.get("insights", [])),
                    "discoveries_added": len(findings.get("discoveries", [])),
                    "challenges_added": 1 if task.status == TaskStatus.BLOCKED else 0
                }
            }
            
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.challenges = f"Execution failed with error: {str(e)}"
            
            print(f"❌ TASK FAILED: {task.title} - {str(e)}")
            
            return {
                "task_id": task.task_id,
                "status": task.status.value,
                "error": str(e),
                "findings": {"summary": f"Task failed due to: {str(e)}"}
            }
    
    def _analyze_execution_results(self, history, task: WorkflowTask) -> Dict[str, Any]:
        """Analyze execution history to extract findings and store in scratchpad"""
        
        final_result = history.final_result()
        total_steps = len(history.history)
        success = history.is_done()
        
        findings = {
            "summary": f"Executed {total_steps} steps. Success: {success}",
            "insights": [],
            "discoveries": [],
            "challenges": "",
            "recommendations": [],
            "scratchpad_data_stored": []
        }
        
        # Enhanced analysis - extract business data from execution history
        self._extract_business_data_from_history(history, task, findings)
        
        # Extract insights from the execution
        if final_result:
            findings["insights"].append({
                "text": f"Task execution completed with result: {final_result}",
                "confidence": 0.9
            })
            
            # Store final result as discovery
            self.scratchpad.add_discovery(
                f"Task '{task.title}' completed: {final_result}",
                "high",
                task.task_id
            )
            findings["scratchpad_data_stored"].append("Final result stored as discovery")
        
        # Look for common patterns that indicate discoveries or challenges
        if total_steps > 80:  # High step count might indicate challenges
            findings["challenges"] = "Task required many steps, possibly due to UI complexity or unexpected challenges"
            self.scratchpad.add_challenge(
                "High step count execution",
                ["continued with persistence"],
                task.task_id
            )
            findings["scratchpad_data_stored"].append("High step count challenge recorded")
        
        if not success and total_steps < 20:  # Quick failure
            findings["challenges"] = "Task failed quickly, possibly due to navigation or authentication issues"
            self.scratchpad.add_challenge(
                "Quick task failure",
                ["attempted basic navigation"],
                task.task_id
            )
            findings["scratchpad_data_stored"].append("Quick failure challenge recorded")
        
        return findings
    
    def _extract_business_data_from_history(self, history, task: WorkflowTask, findings: Dict[str, Any]):
        """Extract business data from browser agent execution history"""
        
        # Analyze each step in the history for business data
        for step in history.history:
            if step.result:
                for result in step.result:
                    if result.extracted_content:
                        content = result.extracted_content.lower()
                        
                        # Look for investor-related information
                        if any(keyword in content for keyword in ['investor', 'funding', 'venture', 'capital', 'series', 'round']):
                            self._extract_investor_data(result.extracted_content, task.task_id, findings)
                        
                        # Look for email-related information
                        if any(keyword in content for keyword in ['email', 'inbox', 'message', 'from:', 'to:', 'subject']):
                            self._extract_email_data(result.extracted_content, task.task_id, findings)
                        
                        # Look for Airtable schema information
                        if any(keyword in content for keyword in ['airtable', 'field', 'column', 'table', 'base']):
                            self._extract_airtable_data(result.extracted_content, task.task_id, findings)
                        
                        # Look for UI patterns
                        if any(keyword in content for keyword in ['button', 'click', 'navigate', 'login', 'page']):
                            self._extract_ui_patterns(result.extracted_content, task.task_id, findings)
    
    def _extract_investor_data(self, content: str, task_id: str, findings: Dict[str, Any]):
        """Extract investor information from content"""
        # Simple pattern matching for investor data
        import re
        
        # Look for email patterns that might contain investor info
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, content)
        
        # Look for company names (basic heuristic)
        company_patterns = [
            r'([A-Z][a-z]+ (?:Ventures|Capital|Partners|Fund|Investment))',
            r'([A-Z][a-z]+ (?:LLC|Inc|Corp))'
        ]
        
        companies = []
        for pattern in company_patterns:
            companies.extend(re.findall(pattern, content))
        
        if emails or companies:
            investor_data = {
                "source": "email_extraction",
                "emails_found": emails,
                "companies_found": companies,
                "raw_content": content[:200] + "..." if len(content) > 200 else content
            }
            
            self.scratchpad.store_business_data("investors", investor_data)
            findings["scratchpad_data_stored"].append(f"Investor data: {len(emails)} emails, {len(companies)} companies")
            
            self.scratchpad.add_discovery(
                f"Found potential investor data: {len(emails)} emails, {len(companies)} companies",
                "high",
                task_id
            )
    
    def _extract_email_data(self, content: str, task_id: str, findings: Dict[str, Any]):
        """Extract email metadata and patterns"""
        email_data = {
            "content_length": len(content),
            "contains_subject": "subject:" in content.lower(),
            "contains_from": "from:" in content.lower(),
            "contains_to": "to:" in content.lower(),
            "sample_content": content[:150] + "..." if len(content) > 150 else content
        }
        
        self.scratchpad.store_business_data("emails", email_data)
        findings["scratchpad_data_stored"].append("Email metadata extracted")
        
        # Add insight about email patterns
        if "subject:" in content.lower():
            self.scratchpad.add_insight(
                "Email content includes subject line information",
                0.8,
                "email_patterns"
            )
    
    def _extract_airtable_data(self, content: str, task_id: str, findings: Dict[str, Any]):
        """Extract Airtable schema and field information"""
        airtable_data = {
            "content_type": "airtable_interface",
            "contains_fields": "field" in content.lower(),
            "contains_table": "table" in content.lower(),
            "sample_content": content[:150] + "..." if len(content) > 150 else content
        }
        
        self.scratchpad.store_business_data("airtable_schema", airtable_data)
        findings["scratchpad_data_stored"].append("Airtable schema data extracted")
        
        # Add insight about Airtable structure
        self.scratchpad.add_insight(
            "Accessed Airtable interface with field/table information",
            0.9,
            "airtable_structure"
        )
    
    def _extract_ui_patterns(self, content: str, task_id: str, findings: Dict[str, Any]):
        """Extract UI navigation patterns"""
        ui_data = {
            "interaction_type": "ui_navigation",
            "contains_buttons": "button" in content.lower(),
            "contains_links": "link" in content.lower(),
            "sample_content": content[:100] + "..." if len(content) > 100 else content
        }
        
        self.scratchpad.store_business_data("ui_patterns", ui_data)
        
        # Add insight about UI patterns
        if "login" in content.lower():
            self.scratchpad.add_insight(
                "Encountered login interface during navigation",
                0.9,
                "authentication"
            )
    
    def _task_completed_successfully(self, history, task: WorkflowTask) -> bool:
        """Determine if task was completed successfully"""
        # Simple heuristic - in practice, this could be more sophisticated
        return history.is_done() and len(history.history) > 5


class IntelligentPlannerExecutor:
    """Main orchestrator that coordinates planning and execution"""
    
    def __init__(self, 
                 task: str,
                 sensitive_data: Optional[Dict[str, str]] = None,
                 allowed_domains: Optional[List[str]] = None,
                 use_gemini: bool = True,
                 max_steps_per_task: int = 500,  # Increased for perfection
                 agent_id: str = "intelligent_planner_executor"):
        
        self.task = task
        self.sensitive_data = sensitive_data
        self.allowed_domains = allowed_domains
        self.use_gemini = use_gemini
        self.max_steps_per_task = max_steps_per_task
        self.agent_id = agent_id
        
        # Initialize LLM
        if use_gemini:
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash-preview-05-20",
                temperature=1.0,
                google_api_key=os.getenv("GOOGLE_API_KEY"),
                max_tokens=32768  # Max out Gemini's output capacity
            )
        else:
            self.llm = ChatAnthropic(
                model="claude-sonnet-4-20250514",
                temperature=1.0,
                anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
                max_tokens=8192  # Max out Claude's output capacity
            )
        
        # Initialize components
        self.scratchpad = ActiveScratchpad()
        self.planner = StrategicPlanner(self.llm, self.scratchpad, use_gemini)
        self.current_strategy: Optional[WorkflowStrategy] = None
        self.execution_log: List[Dict[str, Any]] = []
        
        # Browser agent will be created when needed
        self.browser_agent: Optional[Agent] = None
        self.task_executor: Optional[TaskExecutor] = None
    
    async def execute_workflow(self) -> Dict[str, Any]:
        """Execute the complete workflow with dynamic planning"""
        
        print(f"🚀 STARTING INTELLIGENT PLANNER-EXECUTOR")
        print(f"🧠 Model: {'Gemini 2.5 Flash' if self.use_gemini else 'Claude Sonnet 4'}")
        print(f"🎯 Task: {self.task}")
        print("="*80)
        
        try:
            # Phase 1: Initial Strategic Planning
            print("\n📋 PHASE 1: STRATEGIC PLANNING")
            context = {
                "sensitive_data_provided": bool(self.sensitive_data),
                "allowed_domains": self.allowed_domains,
                "agent_capabilities": ["browser_automation", "vision", "memory"],
                "constraints": ["data_preservation", "security", "efficiency"]
            }
            
            self.current_strategy = await self.planner.create_initial_strategy(self.task, context)
            
            print(f"✅ Strategy Created: {self.current_strategy.approach}")
            print(f"💭 Reasoning: {self.current_strategy.reasoning}")
            print(f"📊 Phases: {len(self.current_strategy.phases)}")
            print(f"🎯 Total Tasks: {sum(len(phase.tasks) for phase in self.current_strategy.phases)}")
            
            # DETAILED PLAN LOGGING
            print("\n" + "="*80)
            print("📋 DETAILED STRATEGIC PLAN")
            print("="*80)
            
            for phase_idx, phase in enumerate(self.current_strategy.phases, 1):
                print(f"\n🎯 PHASE {phase_idx}: {phase.title}")
                print(f"📝 Objective: {phase.objective}")
                print(f"📊 Tasks: {len(phase.tasks)}")
                
                for task_idx, task in enumerate(phase.tasks, 1):
                    print(f"\n   📌 Task {phase_idx}.{task_idx}: {task.title}")
                    print(f"      📝 Description: {task.description}")
                    print(f"      ✅ Success Criteria:")
                    for criteria in task.success_criteria:
                        print(f"         • {criteria}")
                    if task.dependencies:
                        print(f"      🔗 Dependencies: {', '.join(task.dependencies)}")
            
            print("\n" + "="*80)
            print("🎯 STRATEGIC PLAN COMPLETE - BEGINNING EXECUTION")
            print("="*80)
            
            # Phase 2: Initialize Browser Agent
            print("\n🌐 PHASE 2: BROWSER INITIALIZATION")
            await self._initialize_browser_agent()
            
            # Phase 3: Execute Tasks with Dynamic Replanning
            print("\n⚡ PHASE 3: DYNAMIC EXECUTION")
            
            total_tasks = 0
            completed_tasks = 0
            
            for phase in self.current_strategy.phases:
                print(f"\n🎯 STARTING PHASE: {phase.title}")
                print(f"📝 Objective: {phase.objective}")
                
                phase.status = TaskStatus.IN_PROGRESS
                
                for task in phase.tasks:
                    total_tasks += 1
                    
                    # Execute task
                    execution_result = await self.task_executor.execute_task(
                        task, 
                        f"Strategy: {self.current_strategy.approach}\nPhase: {phase.objective}"
                    )
                    
                    self.execution_log.append(execution_result)
                    
                    if task.status == TaskStatus.COMPLETED:
                        completed_tasks += 1
                        print(f"✅ Task completed: {task.title}")
                        
                        # Show scratchpad data stored
                        if execution_result.get("findings", {}).get("scratchpad_data_stored"):
                            print(f"🧠 Scratchpad data stored:")
                            for data_item in execution_result["findings"]["scratchpad_data_stored"]:
                                print(f"   • {data_item}")
                        
                        # Check if we need to replan based on findings
                        if task.findings and any(keyword in task.findings.lower() 
                                               for keyword in ["unexpected", "different", "discovered", "found"]):
                            print("🔄 REPLANNING based on new discoveries...")
                            
                            self.current_strategy = await self.planner.adapt_strategy(
                                self.current_strategy,
                                task.findings,
                                self.scratchpad,
                                task.task_id
                            )
                            
                            print("✅ Strategy adapted based on findings")
                    
                    elif task.status == TaskStatus.BLOCKED:
                        print(f"⚠️ Task blocked: {task.title}")
                        print(f"🔄 REPLANNING to handle challenges...")
                        
                        self.current_strategy = await self.planner.adapt_strategy(
                            self.current_strategy,
                            f"BLOCKED: {task.challenges}",
                            self.scratchpad,
                            task.task_id
                        )
                        
                        print("✅ Strategy adapted to handle challenges")
                        
                        # Try to continue with adapted strategy
                        continue
                    
                    elif task.status == TaskStatus.FAILED:
                        print(f"❌ Task failed: {task.title}")
                        # Could implement recovery logic here
                        break
                
                phase.status = TaskStatus.COMPLETED if all(
                    task.status == TaskStatus.COMPLETED for task in phase.tasks
                ) else TaskStatus.FAILED
            
            # Phase 4: Final Results
            print("\n📊 EXECUTION COMPLETE")
            
            success_rate = (completed_tasks / total_tasks) * 100 if total_tasks > 0 else 0
            
            results = {
                "success": success_rate == 100,  # AIM FOR PERFECTION - 100% success only
                "success_rate": success_rate,
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "strategy": self.current_strategy.approach,
                "insights_discovered": len(self.scratchpad.insights),
                "challenges_encountered": len(self.scratchpad.challenges),
                "discoveries_made": len(self.scratchpad.discoveries),
                "execution_log": self.execution_log,
                "final_scratchpad": {
                    "insights": self.scratchpad.insights,
                    "discoveries": self.scratchpad.discoveries,
                    "challenges": self.scratchpad.challenges
                }
            }
            
            print(f"✅ Success Rate: {success_rate:.1f}%")
            print(f"📊 Tasks: {completed_tasks}/{total_tasks}")
            print(f"💡 Insights: {len(self.scratchpad.insights)}")
            print(f"🔍 Discoveries: {len(self.scratchpad.discoveries)}")
            print(f"⚠️ Challenges: {len(self.scratchpad.challenges)}")
            
            # Show final scratchpad summary
            print("\n🧠 FINAL SCRATCHPAD SUMMARY:")
            print("="*60)
            print(self.scratchpad.get_complete_context())
            print("="*60)
            
            return results
            
        except Exception as e:
            print(f"❌ WORKFLOW EXECUTION FAILED: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "execution_log": self.execution_log
            }
        
        finally:
            # Cleanup
            if self.browser_agent:
                await self.browser_agent.browser_session.close()
    
    async def _initialize_browser_agent(self):
        """Initialize the browser agent for task execution"""
        
        # Configure browser profile
        browser_profile = BrowserProfile(
            user_data_dir=f"~/.config/browseruse/profiles/intelligent_agent_{self.agent_id}_{int(datetime.now().timestamp())}",
            headless=False,
            keep_alive=True,
            allowed_domains=self.allowed_domains or []
        )
        
        # Create browser session
        browser_session = BrowserSession(browser_profile=browser_profile)
        
        # Configure memory
        memory_config = MemoryConfig(
            agent_id=self.agent_id,
            memory_interval=10,
            llm_instance=self.llm
        )
        
        # Create browser agent with enhanced capabilities
        self.browser_agent = Agent(
            task="Intelligent task executor - task will be set dynamically",  # Generic placeholder
            llm=self.llm,
            browser_session=browser_session,
            
            # Core capabilities
            use_vision=True,
            
            # DISABLE INTERNAL PLANNER - We handle planning externally
            planner_llm=None,  # No internal planning
            planner_interval=999999,  # Effectively disable with very high interval
            use_vision_for_planner=False,  # No vision planning
            
            # Memory and learning
            enable_memory=True,
            memory_config=memory_config,
            
            # Execution settings
            max_actions_per_step=10,
            max_failures=5,
            retry_delay=3,
            
            # Security
            sensitive_data=self.sensitive_data,
            
            # Enhanced system prompt for task-focused execution
            extend_system_message="""
🎯 TASK-FOCUSED EXECUTION MODE - PERFECTION REQUIRED:

🏆 PERFECTION MINDSET: You MUST achieve 100% success on your assigned task. No compromises, no "good enough" - only perfection.

🧠 CRITICAL: You have access to a SHARED SCRATCHPAD - the central working memory for all agents. This is your SHARED BRAIN!

SCRATCHPAD FUNCTIONS YOU CAN USE:
- scratchpad.store_business_data(type, data) - Store structured business data
- scratchpad.add_insight(text, confidence, category) - Store important insights
- scratchpad.add_discovery(text, impact, task_id) - Record discoveries
- scratchpad.add_challenge(text, solutions, task_id) - Record challenges

BUSINESS DATA TYPES AVAILABLE:
- "investors" - Investor profiles and details
- "emails" - Email content and metadata  
- "airtable_schema" - Airtable field mappings
- "ui_patterns" - UI navigation patterns
- "authentication" - Login states and session info
- "data_mappings" - Field-to-field mappings

You are part of an intelligent planner-executor system. Your role is to:

1. **Focus on ONE task at a time** - You will receive specific, focused tasks
2. **Execute with perfection** - Complete each task with 100% accuracy and quality
3. **CONSTANTLY use the scratchpad** - Store EVERY discovery immediately
4. **Report discoveries** - Note anything unexpected or important
5. **Preserve data** - Never delete or overwrite existing information
6. **Stop when perfect** - Complete the specific task to perfection and stop

CRITICAL INSTRUCTIONS:
- You are NOT responsible for the entire workflow - just your current task
- Your task MUST be completed with 100% success - no partial completion
- When you complete your task perfectly OR encounter significant challenges, STOP
- Focus on perfection and accuracy over speed
- Pay attention to data preservation and integrity
- Report any discoveries that might affect subsequent tasks
- If you cannot achieve 100% success, report the challenge immediately
- USE THE SCRATCHPAD CONSTANTLY - it's your shared brain with other agents!

ZERO TOLERANCE FOR FAILURE: Your strategic planner expects perfection from you.

EXAMPLE SCRATCHPAD USAGE:
When you find an investor email:
scratchpad.store_business_data("investors", {
    "name": "John Smith",
    "company": "Acme Ventures",
    "email": "john@acme.com",
    "stage": "Series A"
})

When you discover UI patterns:
scratchpad.add_insight("Gmail uses conversation view by default", 0.9, "ui_patterns")

REMEMBER: The scratchpad is your SHARED BRAIN. Use it religiously!
""",
            
            # Logging
            save_conversation_path=f"AEF/agents/logs/intelligent_executor_{self.agent_id}.json",
            generate_gif=f"AEF/agents/intelligent_executor_{self.agent_id}.gif",
            
            # Context optimization
            max_input_tokens=200000,
            include_attributes=[
                'title', 'type', 'name', 'role', 'aria-label', 
                'placeholder', 'value', 'alt', 'aria-expanded',
                'data-testid', 'class', 'id'
            ]
        )
        
        # Initialize browser session
        await self.browser_agent.browser_session.start()
        
        # Create task executor
        self.task_executor = TaskExecutor(self.browser_agent, self.scratchpad, self.max_steps_per_task)
        
        print("✅ Browser agent initialized with intelligent execution capabilities")


# Example usage and testing
async def main():
    """Example of intelligent planner-executor in action"""
    
    task = """
    GMAIL TO AIRTABLE EMAIL PROCESSING WORKFLOW:
    
    I need to process emails from Gmail and update an Airtable CRM with investor information.
    
    WORKFLOW OBJECTIVE:
    1. Navigate to Gmail and authenticate
    2. Process ALL emails in the inbox (not just today's - process everything for testing)
    3. For each email, determine if it's investor-related
    4. If investor-related, extract key information for ALL 10 Airtable fields
    5. Navigate to Airtable CRM
    6. Update existing investor records or create new ones with COMPLETE data
    7. Ensure all 10 fields are populated accurately
    
    CRITICAL REQUIREMENTS:
    - PRESERVE all existing data in the CRM - never create new tables
    - Use existing field structure exactly as it appears
    - Process actual email content, not cached data
    - Maintain data integrity throughout
    - Focus on accuracy and completeness
    
    SUCCESS CRITERIA:
    - All investor emails correctly identified and processed
    - Airtable accurately reflects email information in ALL 10 fields
    - No data loss or corruption
    - Proper stage classification and date formatting
    - Complete historical context preserved
    """
    
    sensitive_data = {
        'gmail_email': 'michaelburner595@gmail.com',
        'gmail_password': 'dCdWqhgPzJev6Jz'
    }
    
    allowed_domains = [
        'https://*.google.com',
        'https://mail.google.com', 
        'https://*.airtable.com',
        'https://airtable.com'
    ]
    
    # Create and execute intelligent workflow
    intelligent_agent = IntelligentPlannerExecutor(
        task=task,
        sensitive_data=sensitive_data,
        allowed_domains=allowed_domains,
        use_gemini=True,  # Use Gemini 2.5 Flash
        agent_id="gmail_airtable_intelligent_v1"
    )
    
    results = await intelligent_agent.execute_workflow()
    
    print("\n" + "="*80)
    print("🎯 INTELLIGENT PLANNER-EXECUTOR RESULTS")
    print("="*80)
    print(f"✅ Success: {results['success']}")
    print(f"📊 Success Rate: {results.get('success_rate', 0):.1f}%")
    print(f"🎯 Tasks: {results.get('completed_tasks', 0)}/{results.get('total_tasks', 0)}")
    print(f"🧠 Strategy: {results.get('strategy', 'N/A')}")
    print(f"💡 Insights: {results.get('insights_discovered', 0)}")
    print(f"🔍 Discoveries: {results.get('discoveries_made', 0)}")
    print(f"⚠️ Challenges: {results.get('challenges_encountered', 0)}")
    
    if results.get('error'):
        print(f"❌ Error: {results['error']}")
    
    return results


if __name__ == "__main__":
    asyncio.run(main()) 