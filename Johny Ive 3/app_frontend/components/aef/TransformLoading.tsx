'use client';

import React, { useState, useEffect } from 'react';

interface TransformLoadingProps {
  onComplete?: () => void;
}

interface TransformStage {
  id: number;
  message: string;
  duration: number;
  emoji: string;
}

const transformStages: TransformStage[] = [
  { id: 0, message: 'Analyzing workflow structure...', duration: 800, emoji: '🧠' },
  { id: 1, message: 'Configuring checkpoints...', duration: 700, emoji: '🛡️' },
  { id: 2, message: 'Initializing AI agents...', duration: 900, emoji: '🤖' },
  { id: 3, message: 'Building execution environment...', duration: 800, emoji: '⚡' },
  { id: 4, message: 'AEF ready for deployment!', duration: 800, emoji: '🚀' }
];

const TransformLoading: React.FC<TransformLoadingProps> = ({ onComplete }) => {
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let interval: NodeJS.Timeout;

    const startStage = (stageIndex: number) => {
      if (stageIndex >= transformStages.length) {
        onComplete?.();
        return;
      }

      const stage = transformStages[stageIndex];
      setCurrentStage(stageIndex);
      
      // Animate progress for this stage
      const startTime = Date.now();
      const startProgress = (stageIndex / transformStages.length) * 100;
      const endProgress = ((stageIndex + 1) / transformStages.length) * 100;

      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const stageProgress = Math.min(elapsed / stage.duration, 1);
        const currentProgress = startProgress + (endProgress - startProgress) * stageProgress;
        setProgress(currentProgress);

        if (stageProgress >= 1) {
          clearInterval(interval);
        }
      }, 50);

      // Move to next stage after duration
      timeout = setTimeout(() => {
        clearInterval(interval);
        startStage(stageIndex + 1);
      }, stage.duration);
    };

    startStage(0);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [onComplete]);

  const currentStageData = transformStages[currentStage];

  return (
    <div className="h-full flex items-center justify-center bg-muted/30">
      <div className="text-center max-w-md mx-auto p-8">
        {/* Animated emoji */}
        <div className="w-20 h-20 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
          <span className="text-3xl animate-pulse">
            {currentStageData?.emoji || '🤖'}
          </span>
        </div>

        {/* Stage title */}
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Transforming to AEF
        </h3>

        {/* Current stage message */}
        <p className="text-gray-600 mb-6 min-h-[24px]">
          {currentStageData?.message || 'Processing...'}
        </p>

        {/* Progress bar */}
        <div className="w-full max-w-sm mx-auto space-y-2">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 text-center">
            {Math.round(progress)}% complete
          </p>
        </div>

        {/* Stage indicators */}
        <div className="flex justify-center mt-6 space-x-2">
          {transformStages.map((stage, index) => (
            <div
              key={stage.id}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                index <= currentStage 
                  ? 'bg-blue-500' 
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TransformLoading; 