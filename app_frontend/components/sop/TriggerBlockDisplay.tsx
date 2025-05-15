import React from 'react';
import { SOPTrigger } from '@/lib/types/sop';

interface TriggerBlockDisplayProps {
  trigger: SOPTrigger; // Assuming a single trigger for display in this component for now
}

const TriggerBlockDisplay: React.FC<TriggerBlockDisplayProps> = ({ trigger }) => {
  if (!trigger) return null;

  return (
    <div className="bg-brand-indigo/5 p-4 rounded-card-radius mb-6 border-l-4 border-brand-indigo shadow-sm">
      <div className="flex items-center">
        <span className="text-2xl mr-3 text-brand-indigo">▶︎</span> {/* Start-arrow circle icon - using simple arrow for now */}
        <div>
          <h3 className="text-lg font-semibold text-brand-indigo">
            Trigger: <span className="font-normal text-foreground">{trigger.description || 'Trigger condition not specified'}</span>
          </h3>
          {trigger.type === 'cron' && trigger.config && (
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium">Schedule:</span> <code>{trigger.config}</code> (Cron)
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TriggerBlockDisplay; 