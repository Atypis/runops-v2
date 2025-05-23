import React from 'react';
import { SOPMeta } from '@/lib/types/sop'; // Assuming types are in @/lib/types/sop.ts

interface HeaderCardProps {
  meta: SOPMeta;
}

const HeaderCard: React.FC<HeaderCardProps> = ({ meta }) => {
  if (!meta) return null;

  return (
    <div className="px-8 py-8">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-3xl font-light text-neutral-900 leading-tight tracking-tight mb-2">
            {meta.title || 'SOP Title'}
          </h1>
          {meta.goal && (
            <p className="text-base text-neutral-600 max-w-3xl leading-relaxed">
              {meta.goal}
            </p>
          )}
        </div>
        {meta.version && (
          <div className="flex-shrink-0 ml-6">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-neutral-100 text-neutral-700">
              v{meta.version}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeaderCard; 