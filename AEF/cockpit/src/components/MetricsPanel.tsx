import React from 'react';
import { ExecutionMetrics, ExecutionPlan } from '../types/execution';

interface MetricsPanelProps {
  metrics: ExecutionMetrics;
  plan: ExecutionPlan;
}

const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics, plan }) => {
  const progressPercentage = (metrics.completed_steps / metrics.total_steps) * 100;
  const successRate = metrics.total_steps > 0 ? (metrics.successful_steps / metrics.total_steps) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Progress</h3>
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Completion</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Success Rate</span>
              <span>{Math.round(successRate)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-success-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${successRate}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Confidence</span>
              <span>{Math.round(metrics.average_confidence * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-warning-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${metrics.average_confidence * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Metrics</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{metrics.total_steps}</div>
            <div className="text-xs text-gray-500">Total Steps</div>
          </div>
          
          <div className="text-center p-3 bg-success-50 rounded-lg">
            <div className="text-2xl font-bold text-success-600">{metrics.successful_steps}</div>
            <div className="text-xs text-gray-500">Successful</div>
          </div>
          
          <div className="text-center p-3 bg-danger-50 rounded-lg">
            <div className="text-2xl font-bold text-danger-600">{metrics.failed_steps}</div>
            <div className="text-xs text-gray-500">Failed</div>
          </div>
          
          <div className="text-center p-3 bg-warning-50 rounded-lg">
            <div className="text-2xl font-bold text-warning-600">{metrics.pending_approvals}</div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
        </div>
      </div>

      {/* Timing */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Timing</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Estimated Duration</span>
            <span className="text-sm font-medium">{plan.estimated_duration}s</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Elapsed Time</span>
            <span className="text-sm font-medium">{plan.total_execution_time}s</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Remaining</span>
            <span className="text-sm font-medium">{Math.max(0, metrics.estimated_remaining_time)}s</span>
          </div>
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Assessment</h3>
        
        <div className={`p-3 rounded-lg text-sm ${
          plan.risk_assessment.includes('HIGH') 
            ? 'bg-danger-50 text-danger-700 border border-danger-200'
            : plan.risk_assessment.includes('MEDIUM')
            ? 'bg-warning-50 text-warning-700 border border-warning-200'
            : 'bg-success-50 text-success-700 border border-success-200'
        }`}>
          {plan.risk_assessment}
        </div>
      </div>
    </div>
  );
};

export default MetricsPanel; 