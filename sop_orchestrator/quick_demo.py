#!/usr/bin/env python3
"""
Quick demo to show agents in action
"""

import asyncio
import sys
from pathlib import Path

# Add current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from core.orchestrator import SOPOrchestrator

async def quick_demo():
    """Quick demo showing agents working"""
    
    sop = {
        'meta': {
            'title': 'Quick Agent Demo', 
            'goal': 'Show specialized agents working in sequence'
        },
        'steps': [
            {'text': 'authenticate with gmail account'},
            {'text': 'process investor emails from inbox'}, 
            {'text': 'update airtable crm with new contacts'}
        ]
    }
    
    orchestrator = SOPOrchestrator()
    
    print('🚀 Quick Demo: Agents in Action')
    print('=' * 40)
    print(f'📋 SOP: {sop["meta"]["title"]}')
    print('🤖 Watch the specialized agents work...')
    print('')
    
    result = await orchestrator.execute_mission(
        sop_definition=sop,
        human_oversight=False,  # No approval needed - agents work automatically
        max_retries=1
    )
    
    print('')
    print('✅ Demo completed successfully!')
    print(f'📊 Mission ID: {result["mission_id"]}')
    print('')
    print('📋 What happened:')
    for phase_name, phase_result in result['results'].items():
        agent_type = phase_name.split('_')[2] if len(phase_name.split('_')) > 2 else 'general'
        print(f'   🤖 {agent_type.upper()} Agent: {phase_result.get("message", "Completed")}')
    
    await orchestrator.cleanup()

if __name__ == "__main__":
    asyncio.run(quick_demo()) 