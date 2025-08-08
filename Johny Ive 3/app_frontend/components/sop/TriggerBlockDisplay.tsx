import React from 'react';
import { SOPTrigger } from '@/lib/types/sop';

interface TriggerBlockDisplayProps {
  trigger: SOPTrigger; // Assuming a single trigger for display in this component for now
}

const TriggerBlockDisplay: React.FC<TriggerBlockDisplayProps> = ({ trigger }) => {
  if (!trigger) return null;

  return (
    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-6">
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-4">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-lg">▶</span>
          </div>
        </div>
        <div className="flex-grow">
          <h3 className="text-lg font-medium text-neutral-900 mb-1">
            Trigger Condition
          </h3>
          <p className="text-neutral-700 mb-3">
            {trigger.description || 'Trigger condition not specified'}
          </p>
          {trigger.type === 'cron' && trigger.config && (
            <div className="mt-3">
              <div className="inline-flex items-center px-3 py-1.5 bg-white border border-blue-200 rounded-md">
                <code className="text-sm font-mono text-neutral-800">
                  {trigger.config}
                </code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TriggerBlockDisplay; 