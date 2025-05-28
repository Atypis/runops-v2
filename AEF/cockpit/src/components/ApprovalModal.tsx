import React from 'react';
import { ApprovalRequest } from '../types/execution';

interface ApprovalModalProps {
  approval: ApprovalRequest;
  onApprove: (approved: boolean) => void;
  onClose: () => void;
}

const ApprovalModal: React.FC<ApprovalModalProps> = ({ approval, onApprove, onClose }) => {
  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-success-600 bg-success-50';
      case 'medium': return 'text-warning-600 bg-warning-50';
      case 'low': return 'text-danger-600 bg-danger-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Human Approval Required</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            {/* Step Info */}
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-sm font-medium text-gray-500">
                  Step {approval.step_index + 1}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(approval.confidence)}`}>
                  {approval.confidence} confidence
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {approval.description}
              </h3>
              <p className="text-gray-600">
                {approval.context}
              </p>
            </div>

            {/* Reasoning */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">AI Reasoning</h4>
              <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700">
                {approval.reasoning}
              </div>
            </div>

            {/* Fallback Options */}
            {approval.fallback_options.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Fallback Options</h4>
                <ul className="space-y-1">
                  {approval.fallback_options.map((option, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-start">
                      <span className="text-gray-400 mr-2">•</span>
                      {option}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-3 pt-4 border-t">
              <button
                onClick={() => onApprove(false)}
                className="btn-danger flex-1"
              >
                Reject & Stop
              </button>
              <button
                onClick={() => onApprove(true)}
                className="btn-success flex-1"
              >
                Approve & Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal; 