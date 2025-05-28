import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  EyeIcon,
  ChartBarIcon,
  CogIcon,
  BoltIcon,
  ShieldCheckIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { ExecutionPlan, ExecutionStep, ExecutionMetrics, ApprovalRequest } from '../types/execution';
import ExecutionTimeline from './ExecutionTimeline';
import StepDetails from './StepDetails';
import MetricsPanel from './MetricsPanel';
import ApprovalModal from './ApprovalModal';
import BrowserPreview from './BrowserPreview';
import ExecutionLogs from './ExecutionLogs';

interface ExecutionCockpitProps {
  plan: ExecutionPlan;
  onStartExecution: () => void;
  onPauseExecution: () => void;
  onStopExecution: () => void;
  onApproveStep: (stepId: string, approved: boolean) => void;
}

const ExecutionCockpit: React.FC<ExecutionCockpitProps> = ({
  plan,
  onStartExecution,
  onPauseExecution,
  onStopExecution,
  onApproveStep,
}) => {
  const [selectedStep, setSelectedStep] = useState<ExecutionStep | null>(null);
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'browser' | 'logs' | 'metrics'>('timeline');

  // Calculate metrics
  const metrics: ExecutionMetrics = {
    total_steps: plan.steps.length,
    completed_steps: plan.steps.filter(s => s.status === 'success').length,
    successful_steps: plan.steps.filter(s => s.status === 'success').length,
    failed_steps: plan.steps.filter(s => s.status === 'error').length,
    pending_approvals: plan.steps.filter(s => s.requires_approval && !s.approved).length,
    average_confidence: plan.steps.reduce((acc, step) => {
      const confidenceValue = step.confidence === 'high' ? 0.9 : step.confidence === 'medium' ? 0.7 : 0.5;
      return acc + confidenceValue;
    }, 0) / plan.steps.length,
    estimated_remaining_time: plan.estimated_duration - plan.total_execution_time,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-primary-600 bg-primary-50';
      case 'success': return 'text-success-600 bg-success-50';
      case 'error': return 'text-danger-600 bg-danger-50';
      case 'warning': return 'text-warning-600 bg-warning-50';
      case 'paused': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <BoltIcon className="w-5 h-5 animate-pulse" />;
      case 'success': return <CheckCircleIcon className="w-5 h-5" />;
      case 'error': return <ExclamationTriangleIcon className="w-5 h-5" />;
      case 'paused': return <PauseIcon className="w-5 h-5" />;
      default: return <ClockIcon className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Title and Status */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <BoltIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{plan.title}</h1>
                  <p className="text-sm text-gray-500">Workflow ID: {plan.workflow_id}</p>
                </div>
              </div>
              
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${getStatusColor(plan.status)}`}>
                {getStatusIcon(plan.status)}
                <span className="text-sm font-medium capitalize">{plan.status}</span>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center space-x-3">
              {plan.status === 'pending' && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onStartExecution}
                  className="btn-primary flex items-center space-x-2"
                >
                  <PlayIcon className="w-4 h-4" />
                  <span>Start Execution</span>
                </motion.button>
              )}
              
              {plan.status === 'running' && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onPauseExecution}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <PauseIcon className="w-4 h-4" />
                    <span>Pause</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onStopExecution}
                    className="btn-danger flex items-center space-x-2"
                  >
                    <StopIcon className="w-4 h-4" />
                    <span>Stop</span>
                  </motion.button>
                </>
              )}
              
              <button className="btn-secondary">
                <CogIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Metrics */}
          <div className="lg:col-span-1">
            <MetricsPanel metrics={metrics} plan={plan} />
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {/* Tab Navigation */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'timeline', label: 'Execution Timeline', icon: ChartBarIcon },
                    { id: 'browser', label: 'Browser Preview', icon: EyeIcon },
                    { id: 'logs', label: 'Execution Logs', icon: ClockIcon },
                    { id: 'metrics', label: 'Analytics', icon: ChartBarIcon },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'border-primary-500 text-primary-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                <AnimatePresence mode="wait">
                  {activeTab === 'timeline' && (
                    <motion.div
                      key="timeline"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ExecutionTimeline
                        steps={plan.steps}
                        currentStepIndex={plan.current_step_index}
                        onStepSelect={setSelectedStep}
                      />
                    </motion.div>
                  )}

                  {activeTab === 'browser' && (
                    <motion.div
                      key="browser"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <BrowserPreview />
                    </motion.div>
                  )}

                  {activeTab === 'logs' && (
                    <motion.div
                      key="logs"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ExecutionLogs workflowId={plan.workflow_id} />
                    </motion.div>
                  )}

                  {activeTab === 'metrics' && (
                    <motion.div
                      key="metrics"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="text-center py-12">
                        <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Advanced Analytics</h3>
                        <p className="text-gray-500">Detailed execution analytics coming soon</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step Details Modal */}
      <AnimatePresence>
        {selectedStep && (
          <StepDetails
            step={selectedStep}
            onClose={() => setSelectedStep(null)}
          />
        )}
      </AnimatePresence>

      {/* Approval Modal */}
      <AnimatePresence>
        {pendingApproval && (
          <ApprovalModal
            approval={pendingApproval}
            onApprove={(approved) => {
              onApproveStep(pendingApproval.step_id, approved);
              setPendingApproval(null);
            }}
            onClose={() => setPendingApproval(null)}
          />
        )}
      </AnimatePresence>

      {/* Floating Action Button for Pending Approvals */}
      {metrics.pending_approvals > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <button
            onClick={() => {
              // Find first pending approval
              const pendingStep = plan.steps.find(s => s.requires_approval && !s.approved);
              if (pendingStep) {
                setPendingApproval({
                  step_id: pendingStep.id,
                  step_index: plan.steps.indexOf(pendingStep),
                  description: pendingStep.description,
                  confidence: pendingStep.confidence,
                  reasoning: pendingStep.reasoning,
                  fallback_options: pendingStep.fallback_options,
                  context: 'Execution requires human approval to proceed',
                  timestamp: new Date().toISOString(),
                  requires_immediate_attention: true,
                });
              }
            }}
            className="bg-warning-500 hover:bg-warning-600 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center space-x-2"
          >
            <UserIcon className="w-6 h-6" />
            <span className="bg-white text-warning-600 rounded-full px-2 py-1 text-sm font-bold">
              {metrics.pending_approvals}
            </span>
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default ExecutionCockpit; 