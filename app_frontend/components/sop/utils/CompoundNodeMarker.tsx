import React from 'react';
import { ConnectionType } from './edgeUtils';
import { Position } from 'reactflow';

interface CompoundNodeMarkerProps {
  cx: number;
  cy: number;
  connectionType: ConnectionType;
  isSource: boolean;
  isChildNode: boolean;
  position?: Position;
  color?: string;
}

const CompoundNodeMarker: React.FC<CompoundNodeMarkerProps> = ({
  cx,
  cy,
  connectionType,
  isSource,
  isChildNode,
  position,
  color = isChildNode ? "#ef4444" : "#555"
}) => {
  // Determine sizes based on node type and connection
  const outerRadius = isChildNode ? 8 : 6;
  const innerRadius = isChildNode ? 4 : 3;
  
  // Adjust marker position based on port position
  let adjustedCx = cx;
  let adjustedCy = cy;
  
  if (isChildNode) {
    if (position === Position.Top) {
      adjustedCy -= 2; // Slightly offset for better visibility
    } else if (position === Position.Bottom) {
      adjustedCy += 2;
    }
  }
  
  // Adjust opacity based on connection type
  const backgroundOpacity = (() => {
    switch (connectionType) {
      case ConnectionType.PARENT_TO_CHILD:
      case ConnectionType.CHILD_TO_PARENT:
        return 0.8;
      case ConnectionType.CHILD_TO_CHILD_SAME:
        return 0.7;
      default:
        return 0.6;
    }
  })();
  
  return (
    <g>
      {/* Background circle for better visibility */}
      <circle
        cx={adjustedCx}
        cy={adjustedCy}
        r={outerRadius}
        fill="white"
        opacity={backgroundOpacity}
        style={{ pointerEvents: 'none' }}
      />
      
      {/* Connection point */}
      <circle
        cx={adjustedCx}
        cy={adjustedCy}
        r={innerRadius}
        fill={color}
        strokeWidth={2}
        stroke="white"
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
};

export default CompoundNodeMarker; 