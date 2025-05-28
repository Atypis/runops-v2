import React, { useState } from 'react'
import ExecutionCockpit from './ExecutionCockpit'
import { ExecutionPlan } from '../types/execution'

interface ExecutionCockpitWrapperProps {
  executionPlan: ExecutionPlan
}

export const ExecutionCockpitWrapper: React.FC<ExecutionCockpitWrapperProps> = ({
  executionPlan
}) => {
  const [plan, setPlan] = useState<ExecutionPlan>(executionPlan)

  const handleStartExecution = () => {
    console.log('Starting execution for workflow:', plan.workflow_id)
    setPlan(prev => ({ ...prev, status: 'running', started_at: new Date().toISOString() }))
    // In real implementation, this would trigger the actual AEF execution
  }

  const handlePauseExecution = () => {
    console.log('Pausing execution...')
    setPlan(prev => ({ ...prev, status: 'paused' }))
    // In real implementation, this would pause the browser agent
  }

  const handleStopExecution = () => {
    console.log('Stopping execution...')
    setPlan(prev => ({ ...prev, status: 'cancelled' }))
    // In real implementation, this would stop and cleanup
  }

  const handleApproveStep = (stepId: string, approved: boolean) => {
    console.log(`Step ${stepId} ${approved ? 'approved' : 'rejected'}`)
    setPlan(prev => ({
      ...prev,
      steps: prev.steps.map(step => 
        step.id === stepId 
          ? { ...step, approved, status: approved ? 'success' : 'error' }
          : step
      )
    }))
    // In real implementation, this would update the step and continue execution
  }

  return (
    <ExecutionCockpit
      plan={plan}
      onStartExecution={handleStartExecution}
      onPauseExecution={handlePauseExecution}
      onStopExecution={handleStopExecution}
      onApproveStep={handleApproveStep}
    />
  )
} 