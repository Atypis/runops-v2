import React from 'react';
import { SOPMeta } from '@/lib/types/sop'; // Assuming types are in @/lib/types/sop.ts

interface HeaderCardProps {
  meta: SOPMeta;
}

const HeaderCard: React.FC<HeaderCardProps> = ({ meta }) => {
  if (!meta) return null;

  return (
    <div className="bg-neutral-surface-1 p-6 rounded-t-card-radius mb-4 shadow-card-default">
      <div className="flex justify-between items-start mb-2">
        <h1 className="text-3xl font-semibold text-primary leading-tight">{meta.title || 'SOP Title'}</h1>
        {meta.version && (
          <span className="text-sm bg-brand-indigo text-white px-3 py-1 rounded-pill-radius font-medium">
            v{meta.version}
          </span>
        )}
      </div>
      {meta.goal && (
        <p className="text-base text-muted-foreground max-w-3xl">
          <span className="font-medium text-foreground">Goal:</span> {meta.goal}
        </p>
      )}
      {/* 
        // Optional: Display purpose if needed, though goal is usually primary for header
        meta.purpose && (
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            <strong>Purpose:</strong> {meta.purpose}
          </p>
        ) 
      */}
      {/* 
        // Optional: Display owner if needed
        meta.owner && meta.owner.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Owner: {meta.owner.join(", ")}
          </p>
        )
      */}
    </div>
  );
};

export default HeaderCard; 