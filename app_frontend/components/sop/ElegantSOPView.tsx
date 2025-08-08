'use client'

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, CheckCircle, Settings, Eye, EyeOff, Clock, Key, Zap, Calendar, AlertCircle } from 'lucide-react'
import { SOPDocument, SOPNode } from '@/lib/types/sop'

interface ElegantSOPViewProps {
  sopData: SOPDocument
  rootNodes: SOPNode[]
}

interface StepCardProps {
  node: SOPNode
  index: number
  isCompleted: boolean
  completedSubSteps: Set<string>
  onToggleComplete: (stepId: string) => void
  onToggleSubStepComplete: (subStepId: string) => void
}

function StepCard({ node, index, isCompleted, completedSubSteps, onToggleComplete, onToggleSubStepComplete }: StepCardProps) {
  const [isExpanded, setIsExpanded] = useState(index === 0) // First step expanded by default
  
  // Calculate sub-step completion
  const totalSubSteps = node.childNodes?.length || 0
  const completedSubStepsCount = node.childNodes?.filter(child => completedSubSteps.has(child.id)).length || 0
  const subStepProgress = totalSubSteps > 0 ? (completedSubStepsCount / totalSubSteps) * 100 : 0
  
  // Check if node has expandable content
  const hasExpandableContent = node.context || (node.childNodes && node.childNodes.length > 0)
  
  return (
    <div className={`border border-gray-300 rounded overflow-hidden transition-all duration-200 hover:shadow-sm ${
      isCompleted ? 'bg-gray-50 border-gray-400' : 'bg-white hover:border-gray-400'
    }`}>
      {/* Step Header */}
      <div 
        className={`flex items-center justify-between p-4 ${hasExpandableContent ? 'cursor-pointer border-b border-gray-300' : ''}`}
        onClick={hasExpandableContent ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex items-center space-x-4">
          {/* Step Number */}
          <div className={`flex items-center justify-center w-8 h-8 rounded border border-gray-400 text-sm font-mono transition-colors ${
            isCompleted 
              ? 'bg-gray-100 border-gray-400 text-gray-500' 
              : 'bg-white border-gray-400 text-gray-700'
          }`}>
            {isCompleted ? '✓' : String(index + 1).padStart(2, '0')}
          </div>
          
          {/* Step Title */}
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">{node.label}</h3>
            {node.intent && (
              <p className="text-sm text-gray-600 mt-1">{node.intent}</p>
            )}
            
            {/* Sub-step progress indicator */}
            {totalSubSteps > 0 && (
              <div className="mt-2 flex items-center space-x-3">
                <div className="text-xs text-gray-500 font-mono">
                  {completedSubStepsCount}/{totalSubSteps} sub-steps
                </div>
                <div className="h-1 w-16 bg-gray-200 rounded overflow-hidden">
                  <div 
                    className="h-full bg-gray-400 transition-all duration-300"
                    style={{ width: `${subStepProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Complete Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onToggleComplete(node.id)
            }}
            className={isCompleted ? "text-gray-500" : ""}
          >
            {isCompleted ? "Completed" : "Complete"}
          </Button>
          
          {/* Expand Icon - only show if there's expandable content */}
          {hasExpandableContent && (
            isExpanded ? 
              <ChevronDown className="w-4 h-4 text-gray-400" /> : 
              <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>
      
      {/* Step Content */}
      {isExpanded && hasExpandableContent && (
        <div className="px-4 py-4 bg-gray-50">
          {node.context && (
            <div className="text-sm text-gray-700 mb-4 leading-relaxed" dangerouslySetInnerHTML={{ __html: node.context }} />
          )}
          
          {/* Sub-steps */}
          {node.childNodes && node.childNodes.length > 0 && (
            <div className="border border-gray-300 rounded overflow-hidden bg-white">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-300">
                <h4 className="font-medium text-gray-900 text-sm">Sub-steps</h4>
              </div>
              <div className="divide-y divide-gray-300">
                {node.childNodes.map((child, childIndex) => {
                  const isSubCompleted = completedSubSteps.has(child.id)
                  return (
                    <div key={child.id} className="flex items-center p-4">
                      <span className="text-xs font-mono text-gray-500 w-6 mr-3">
                        {String(childIndex + 1).padStart(2, '0')}
                      </span>
                      <div className="flex-1">
                        <h5 className={`font-medium ${isSubCompleted ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                          {child.label}
                        </h5>
                        {child.context && (
                          <div 
                            className={`text-sm mt-1 leading-relaxed ${isSubCompleted ? 'text-gray-400' : 'text-gray-600'}`}
                            dangerouslySetInnerHTML={{ __html: child.context }}
                          />
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={isSubCompleted}
                        onChange={() => onToggleSubStepComplete(child.id)}
                        className="w-4 h-4 text-green-600 bg-white border-gray-400 rounded focus:ring-green-500 focus:ring-2 ml-3"
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ElegantSOPView({ sopData, rootNodes }: ElegantSOPViewProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [completedSubSteps, setCompletedSubSteps] = useState<Set<string>>(new Set())
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
  const [sopCompletions, setSopCompletions] = useState<Array<{date: string, duration: string, completedAt: string}>>([])
  const [sessionStartTime] = useState<Date>(new Date())
  
  // Load completion history on mount
  useEffect(() => {
    const sopId = sopData.meta.id
    const storedCompletions = localStorage.getItem(`sop_completions_${sopId}`)
    if (storedCompletions) {
      setSopCompletions(JSON.parse(storedCompletions))
    }
  }, [sopData.meta.id])
  
  // Extract prerequisites from SOP skills
  const extractPrerequisites = () => {
    const appMap = new Map<string, { status: string; description: string }>()
    
    if (sopData.private?.skills) {
      sopData.private.skills.forEach(skill => {
        const appName = skill.app
        if (appName && !appMap.has(appName)) {
          // Determine status based on app type - you can make this more sophisticated
          let status = 'connected'
          let description = ''
          
          if (appName.includes('Gmail')) {
            status = 'connected'
            description = 'Email access and management'
          } else if (appName.includes('Airtable')) {
            status = 'connected'  
            description = 'Database and CRM operations'
          } else if (appName.includes('API')) {
            status = 'pending'
            description = 'API integration required'
          } else if (appName.includes('ZenDesk') || appName.includes('Enterprise')) {
            status = 'missing'
            description = 'Enterprise login required'
          } else {
            status = 'connected'
            description = `${skill.method_type === 'api' ? 'API access' : 'UI automation'} required`
          }
          
          appMap.set(appName, { status, description })
        }
      })
    }
    
    return Array.from(appMap.entries()).map(([name, info]) => ({
      name,
      status: info.status,
      description: info.description
    }))
  }
  
  const prerequisites = extractPrerequisites()
  
  const handleToggleComplete = (stepId: string) => {
    const newCompleted = new Set(completedSteps)
    if (newCompleted.has(stepId)) {
      newCompleted.delete(stepId)
    } else {
      newCompleted.add(stepId)
    }
    setCompletedSteps(newCompleted)
    
    // Check if this completes the SOP
    if (newCompleted.size === rootNodes.length && completedSubSteps.size === totalSubSteps) {
      logCompletion()
    }
  }
  
  const handleToggleSubStepComplete = (subStepId: string) => {
    const newCompleted = new Set(completedSubSteps)
    if (newCompleted.has(subStepId)) {
      newCompleted.delete(subStepId)
    } else {
      newCompleted.add(subStepId)
    }
    setCompletedSubSteps(newCompleted)
    
    // Check if this completes the SOP
    if (completedSteps.size === rootNodes.length && newCompleted.size === totalSubSteps) {
      logCompletion()
    }
  }
  
  const logCompletion = () => {
    const now = new Date()
    const duration = Math.round((now.getTime() - sessionStartTime.getTime()) / 1000 / 60) // minutes
    
    const completion = {
      date: now.toLocaleDateString(),
      duration: `${duration} min`,
      completedAt: now.toLocaleTimeString()
    }
    
    const sopId = sopData.meta.id
    const newCompletions = [completion, ...sopCompletions].slice(0, 10) // Keep last 10
    setSopCompletions(newCompletions)
    localStorage.setItem(`sop_completions_${sopId}`, JSON.stringify(newCompletions))
  }
  
  const completionProgress = (completedSteps.size / rootNodes.length) * 100
  
  // Calculate total progress including sub-steps
  const totalSubSteps = rootNodes.reduce((sum, node) => sum + (node.childNodes?.length || 0), 0)
  const totalSteps = rootNodes.length + totalSubSteps
  const totalCompleted = completedSteps.size + completedSubSteps.size
  const overallProgress = totalSteps > 0 ? (totalCompleted / totalSteps) * 100 : 0
  
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {sopData.meta.title}
          </h1>
          
          {sopData.meta.purpose && (
            <p className="text-gray-600 leading-relaxed">
              {sopData.meta.purpose}
            </p>
          )}
          
          {/* Overall Progress */}
          <div className="mt-6 p-4 border border-gray-300 rounded bg-white">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span className="font-medium">Overall Progress</span>
              <span className="font-mono">{totalCompleted}/{totalSteps}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>
        
        {/* When to Use & Prerequisites */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* When to Use (Trigger) */}
          {sopData.public.triggers && sopData.public.triggers.length > 0 && (
            <div className="border border-gray-300 rounded bg-white">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-300">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-600" />
                  <h3 className="font-medium text-gray-900">When to Use</h3>
                </div>
              </div>
              <div className="p-4">
                <p className="text-gray-700 text-sm leading-relaxed mb-2">
                  {sopData.public.triggers[0].description}
                </p>
                <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded font-mono">
                  {sopData.public.triggers[0].type}
                </span>
              </div>
            </div>
          )}
          
          {/* Prerequisites (Access) */}
          <div className="border border-gray-300 rounded bg-white">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-300">
              <div className="flex items-center space-x-2">
                <Key className="w-4 h-4 text-gray-600" />
                <h3 className="font-medium text-gray-900">Prerequisites</h3>
              </div>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {prerequisites.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 font-mono truncate">{item.name}</span>
                    <div className={`w-2 h-2 rounded-full ${
                      item.status === 'connected' ? 'bg-green-500' :
                      item.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Steps</h2>
            <span className="text-sm text-gray-500 font-mono">{rootNodes.length} total</span>
          </div>
          
          <div className="space-y-4">
            {rootNodes.map((node, index) => (
              <StepCard
                key={node.id}
                node={node}
                index={index}
                isCompleted={completedSteps.has(node.id)}
                completedSubSteps={completedSubSteps}
                onToggleComplete={handleToggleComplete}
                onToggleSubStepComplete={handleToggleSubStepComplete}
              />
            ))}
          </div>
        </div>
        
        {/* Completion State */}
        {completedSteps.size === rootNodes.length && completedSubSteps.size === totalSubSteps && (
          <div className="border border-gray-300 rounded p-6 mb-8 bg-gray-50">
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                SOP Completed
              </h3>
              <p className="text-gray-600 mb-4">
                All {totalSteps} steps completed in {Math.round((new Date().getTime() - sessionStartTime.getTime()) / 1000 / 60)} minutes
              </p>
              
              {sopCompletions.length > 0 && (
                <div className="text-sm text-gray-500 font-mono">
                  Completion #{sopCompletions.length + 1} • Avg: {Math.round(sopCompletions.reduce((sum, c) => sum + parseInt(c.duration), 0) / sopCompletions.length)} min
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Technical Details (Collapsible) */}
        <div className="border-t border-gray-300 pt-6">
          <button
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors mb-4"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm font-medium">Technical Details</span>
            {showTechnicalDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          
          {showTechnicalDetails && (
            <div className="border border-gray-300 rounded bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-300">
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-3">SOP Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex">
                      <span className="text-gray-500 w-16">ID:</span>
                      <span className="font-mono text-gray-700">{sopData.meta.id}</span>
                    </div>
                    <div className="flex">
                      <span className="text-gray-500 w-16">Version:</span>
                      <span className="font-mono text-gray-700">{sopData.meta.version}</span>
                    </div>
                    <div className="flex">
                      <span className="text-gray-500 w-16">Owner:</span>
                      <span className="text-gray-700">{sopData.meta.owner.join(', ')}</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Execution History</h4>
                  {sopCompletions.length > 0 ? (
                    <div className="space-y-1 text-sm max-h-20 overflow-y-auto">
                      {sopCompletions.map((completion, index) => (
                        <div key={index} className="flex justify-between font-mono text-gray-600">
                          <span>{completion.date}</span>
                          <span>{completion.duration}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No previous completions</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 