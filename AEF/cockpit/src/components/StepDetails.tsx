import React from 'react';
import { ExecutionStep } from '../types/execution';

interface StepDetailsProps {
  step: ExecutionStep;
  onClose: () => void;
}

const StepDetails: React.FC<StepDetailsProps> = ({ step, onClose }) => {
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-success-600 bg-success-50 border-success-200';
      case 'medium': return 'text-warning-600 bg-warning-50 border-warning-200';
      case 'low': return 'text-danger-600 bg-danger-50 border-danger-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-success-600 bg-success-50';
      case 'error': return 'text-danger-600 bg-danger-50';
      case 'warning': return 'text-warning-600 bg-warning-50';
      case 'running': return 'text-primary-600 bg-primary-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Step Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(step.status)}`}>
                  {step.status}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getConfidenceColor(step.confidence)}`}>
                  {step.confidence} confidence
                </span>
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                  {step.type}
                </span>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {step.description}
              </h3>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Step Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Step ID:</span>
                    <span className="font-mono text-gray-900">{step.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="capitalize">{step.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Confidence:</span>
                    <span className="capitalize">{step.confidence}</span>
                  </div>
                  {step.target && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Target:</span>
                      <span className="truncate max-w-xs">{step.target}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Execution Details</h4>
                <div className="space-y-2 text-sm">
                  {step.start_time && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Started:</span>
                      <span>{new Date(step.start_time).toLocaleTimeString()}</span>
                    </div>
                  )}
                  {step.end_time && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Completed:</span>
                      <span>{new Date(step.end_time).toLocaleTimeString()}</span>
                    </div>
                  )}
                  {step.execution_time && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration:</span>
                      <span>{step.execution_time.toFixed(2)}s</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Approval Required:</span>
                    <span>{step.requires_approval ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reasoning */}
            {step.reasoning && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">AI Reasoning</h4>
                <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700">
                  {step.reasoning}
                </div>
              </div>
            )}

            {/* Input Data */}
            {step.input_data && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Input Data</h4>
                <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 font-mono">
                  {step.input_data}
                </div>
              </div>
            )}

            {/* Error Message */}
            {step.error_message && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Error Details</h4>
                <div className="bg-danger-50 border border-danger-200 p-3 rounded-lg text-sm text-danger-700">
                  {step.error_message}
                </div>
              </div>
            )}

            {/* Fallback Options */}
            {step.fallback_options.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Fallback Options</h4>
                <ul className="space-y-2">
                  {step.fallback_options.map((option, index) => (
                    <li key={index} className="flex items-start text-sm text-gray-600">
                      <span className="text-gray-400 mr-2 mt-1">•</span>
                      <span>{option}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Screenshot */}
            {step.screenshot_url && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Screenshot</h4>
                <div className="bg-gray-100 rounded-lg p-4 text-center">
                  <div className="text-gray-500 text-sm">
                    Screenshot available: {step.screenshot_url}
                  </div>
                  <button className="mt-2 btn-secondary text-sm">
                    View Screenshot
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
            {step.status === 'error' && (
              <button className="btn-primary">
                Retry Step
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepDetails; 