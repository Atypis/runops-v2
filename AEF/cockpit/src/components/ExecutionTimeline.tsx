import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
  BoltIcon,
  UserIcon,
  CogIcon,
  EyeIcon,
  PencilIcon,
  DocumentTextIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { ExecutionStep, TaskType, ConfidenceLevel } from '../types/execution';

interface ExecutionTimelineProps {
  steps: ExecutionStep[];
  currentStepIndex: number;
  onStepSelect: (step: ExecutionStep) => void;
}

const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({
  steps,
  currentStepIndex,
  onStepSelect,
}) => {
  const getTaskIcon = (type: TaskType) => {
    switch (type) {
      case 'navigate': return <ArrowPathIcon className="w-4 h-4" />;
      case 'click': return <CogIcon className="w-4 h-4" />;
      case 'type': return <PencilIcon className="w-4 h-4" />;
      case 'read': return <EyeIcon className="w-4 h-4" />;
      case 'decision': return <UserIcon className="w-4 h-4" />;
      case 'wait': return <ClockIcon className="w-4 h-4" />;
      case 'loop': return <ArrowPathIcon className="w-4 h-4" />;
      default: return <CogIcon className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status: string, isActive: boolean) => {
    if (isActive) {
      return <BoltIcon className="w-5 h-5 text-primary-600 animate-pulse" />;
    }
    
    switch (status) {
      case 'success': return <CheckCircleIcon className="w-5 h-5 text-success-600" />;
      case 'error': return <ExclamationTriangleIcon className="w-5 h-5 text-danger-600" />;
      case 'warning': return <ExclamationTriangleIcon className="w-5 h-5 text-warning-600" />;
      case 'paused': return <PauseIcon className="w-5 h-5 text-gray-600" />;
      case 'running': return <PlayIcon className="w-5 h-5 text-primary-600" />;
      default: return <ClockIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  const getConfidenceColor = (confidence: ConfidenceLevel) => {
    switch (confidence) {
      case 'high': return 'bg-success-100 text-success-800 border-success-200';
      case 'medium': return 'bg-warning-100 text-warning-800 border-warning-200';
      case 'low': return 'bg-danger-100 text-danger-800 border-danger-200';
    }
  };

  const getStepBorderColor = (step: ExecutionStep, index: number) => {
    if (index === currentStepIndex) return 'border-primary-300 shadow-glow';
    if (step.status === 'success') return 'border-success-200';
    if (step.status === 'error') return 'border-danger-200';
    if (step.status === 'warning') return 'border-warning-200';
    return 'border-gray-200';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Execution Timeline</h3>
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-success-500 rounded-full"></div>
            <span>Completed</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-primary-500 rounded-full animate-pulse"></div>
            <span>Active</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
            <span>Pending</span>
          </div>
        </div>
      </div>

      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        
        {/* Progress Line */}
        <motion.div
          className="absolute left-6 top-0 w-0.5 bg-primary-500"
          initial={{ height: 0 }}
          animate={{ 
            height: `${(currentStepIndex / Math.max(steps.length - 1, 1)) * 100}%` 
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step, index) => {
            const isActive = index === currentStepIndex;
            const isCompleted = step.status === 'success';
            const hasFailed = step.status === 'error';
            const needsApproval = step.requires_approval && !step.approved;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`relative flex items-start space-x-4 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${getStepBorderColor(step, index)}`}
                onClick={() => onStepSelect(step)}
              >
                {/* Step Number/Status */}
                <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 ${
                  isActive 
                    ? 'bg-primary-50 border-primary-300' 
                    : isCompleted 
                    ? 'bg-success-50 border-success-300'
                    : hasFailed
                    ? 'bg-danger-50 border-danger-300'
                    : 'bg-gray-50 border-gray-300'
                }`}>
                  {getStatusIcon(step.status, isActive)}
                </div>

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-gray-500">
                          Step {index + 1}
                        </span>
                        <div className="flex items-center space-x-1 text-gray-400">
                          {getTaskIcon(step.type)}
                          <span className="text-xs capitalize">{step.type}</span>
                        </div>
                        {needsApproval && (
                          <div className="flex items-center space-x-1 text-warning-600">
                            <UserIcon className="w-4 h-4" />
                            <span className="text-xs">Approval Required</span>
                          </div>
                        )}
                      </div>
                      
                      <h4 className="text-base font-medium text-gray-900 mb-2">
                        {step.description}
                      </h4>
                      
                      {step.reasoning && (
                        <p className="text-sm text-gray-600 mb-2">
                          {step.reasoning}
                        </p>
                      )}

                      <div className="flex items-center space-x-3">
                        {/* Confidence Badge */}
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getConfidenceColor(step.confidence)}`}>
                          {step.confidence} confidence
                        </span>

                        {/* Execution Time */}
                        {step.execution_time && (
                          <span className="text-xs text-gray-500">
                            {step.execution_time.toFixed(1)}s
                          </span>
                        )}

                        {/* Target */}
                        {step.target && (
                          <span className="text-xs text-gray-500 truncate max-w-xs">
                            Target: {step.target}
                          </span>
                        )}
                      </div>

                      {/* Error Message */}
                      {step.error_message && (
                        <div className="mt-2 p-2 bg-danger-50 border border-danger-200 rounded text-sm text-danger-700">
                          {step.error_message}
                        </div>
                      )}

                      {/* Fallback Options */}
                      {step.fallback_options.length > 0 && (
                        <div className="mt-2">
                          <details className="text-sm">
                            <summary className="text-gray-500 cursor-pointer hover:text-gray-700">
                              Fallback options ({step.fallback_options.length})
                            </summary>
                            <ul className="mt-1 ml-4 space-y-1 text-gray-600">
                              {step.fallback_options.map((option, i) => (
                                <li key={i} className="text-xs">• {option}</li>
                              ))}
                            </ul>
                          </details>
                        </div>
                      )}
                    </div>

                    {/* Step Actions */}
                    <div className="flex items-center space-x-2 ml-4">
                      {step.screenshot_url && (
                        <button className="p-1 text-gray-400 hover:text-gray-600">
                          <EyeIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <DocumentTextIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {steps.filter(s => s.status === 'success').length}
            </div>
            <div className="text-sm text-gray-500">Completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary-600">
              {currentStepIndex + 1}
            </div>
            <div className="text-sm text-gray-500">Current</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {steps.length - currentStepIndex - 1}
            </div>
            <div className="text-sm text-gray-500">Remaining</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-warning-600">
              {steps.filter(s => s.requires_approval && !s.approved).length}
            </div>
            <div className="text-sm text-gray-500">Need Approval</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionTimeline; 