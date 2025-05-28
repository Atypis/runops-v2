import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChevronDownIcon, PlayIcon, ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { fetchCompletedWorkflows, WorkflowData } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'

interface WorkflowSelectorProps {
  onWorkflowSelect: (workflow: WorkflowData) => void
  selectedWorkflow: WorkflowData | null
}

export const WorkflowSelector: React.FC<WorkflowSelectorProps> = ({
  onWorkflowSelect,
  selectedWorkflow
}) => {
  const { user, loading: authLoading } = useAuth()
  const [workflows, setWorkflows] = useState<WorkflowData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (user && !authLoading) {
      loadWorkflows()
    } else if (!authLoading && !user) {
      // Clear workflows if user is not authenticated
      setWorkflows([])
      setError(null)
    }
  }, [user, authLoading])

  const loadWorkflows = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await fetchCompletedWorkflows()
      setWorkflows(data)
      
      if (data.length === 0) {
        setError('No completed workflows found. Please ensure you have completed workflows in your account.')
      }
    } catch (err: any) {
      console.error('Error loading workflows:', err)
      setError('Failed to load workflows. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getWorkflowTitle = (workflow: WorkflowData) => {
    if (workflow.metadata?.title) return workflow.metadata.title
    if (workflow.sop_data?.title) return workflow.sop_data.title
    return `Workflow ${workflow.job_id.slice(0, 8)}`
  }

  const getWorkflowDescription = (workflow: WorkflowData) => {
    if (workflow.metadata?.description) return workflow.metadata.description
    if (workflow.sop_data?.description) return workflow.sop_data.description
    return 'No description available'
  }

  const handleWorkflowChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const workflowId = e.target.value
    if (workflowId) {
      const workflow = workflows.find(w => w.job_id === workflowId)
      if (workflow) {
        onWorkflowSelect(workflow)
      }
    }
  }

  // Show authentication required message
  if (!authLoading && !user) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-medium text-blue-900">Authentication Required</h3>
          </div>
          <p className="mt-2 text-sm text-blue-700">
            Please sign in to access your completed workflows and execution data.
          </p>
        </div>
      </div>
    )
  }

  // Show loading state
  if (authLoading || loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
        <p className="text-sm text-gray-500">
          {authLoading ? 'Checking authentication...' : 'Loading workflows...'}
        </p>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-medium text-red-900">Error Loading Workflows</h3>
          </div>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <button
            onClick={loadWorkflows}
            className="mt-3 text-sm text-red-600 hover:text-red-500 underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="workflow-select" className="block text-sm font-medium text-gray-700 mb-2">
          Select Workflow
        </label>
        <select
          id="workflow-select"
          value={selectedWorkflow?.job_id || ''}
          onChange={handleWorkflowChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Choose a completed workflow...</option>
          {workflows.map((workflow) => (
            <option key={workflow.job_id} value={workflow.job_id}>
              {workflow.job_id} - {new Date(workflow.created_at).toLocaleDateString()}
              {workflow.metadata?.title && ` - ${workflow.metadata.title}`}
            </option>
          ))}
        </select>
      </div>

      {workflows.length > 0 && (
        <div className="text-sm text-gray-600">
          <p>Found {workflows.length} completed workflow{workflows.length !== 1 ? 's' : ''}</p>
          {user && (
            <p className="mt-1">
              Signed in as: <span className="font-medium">{user.email}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
} 