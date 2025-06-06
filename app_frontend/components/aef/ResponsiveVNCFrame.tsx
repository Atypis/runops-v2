import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Move } from 'lucide-react';

interface ResponsiveVNCFrameProps {
  vncUrl: string;
  currentUrl?: string;
  onDimensionsChange?: (dimensions: {width: number, height: number}) => void;
  onFullscreen?: () => void;
  showControls?: boolean;
  className?: string;
  nativeWidth?: number;
  nativeHeight?: number;
}

type FitMode = 'fit' | 'fill' | 'native';

const ResponsiveVNCFrame: React.FC<ResponsiveVNCFrameProps> = ({
  vncUrl,
  currentUrl,
  onDimensionsChange,
  onFullscreen,
  showControls = true,
  className = '',
  nativeWidth = 1280,
  nativeHeight = 720
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [fitMode, setFitMode] = useState<FitMode>('fit');
  const [scale, setScale] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // --- Dynamic Scaling Calculation ---
  const updateScale = useCallback(() => {
    if (!containerRef.current) return;

    const { width, height } = containerRef.current.getBoundingClientRect();
    setContainerSize({ width, height });

    if (width === 0 || height === 0) return;

    const scaleX = width / nativeWidth;
    const scaleY = height / nativeHeight;
    
    let newScale = 1;
    if (fitMode === 'fit') {
      newScale = Math.min(scaleX, scaleY); // Fit entirely inside
    } else if (fitMode === 'fill') {
      newScale = Math.max(scaleX, scaleY); // Fill the space, may crop
    } else { // 'native'
      newScale = 1; // No scaling
    }
    
    setScale(newScale);
    onDimensionsChange?.({ width, height });

  }, [fitMode, nativeWidth, nativeHeight, onDimensionsChange]);

  // --- Mouse Event Translation ---
  const translateMouseEvent = useCallback((event: MouseEvent) => {
    if (!iframeRef.current || !overlayRef.current || fitMode === 'native') return;

    // Get the overlay position relative to the page
    const overlayRect = overlayRef.current.getBoundingClientRect();
    
    // Calculate mouse position relative to the overlay
    const overlayX = event.clientX - overlayRect.left;
    const overlayY = event.clientY - overlayRect.top;

    // Translate to native VNC coordinates
    const nativeX = overlayX / scale;
    const nativeY = overlayY / scale;

    // Create a new mouse event with translated coordinates
    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    
    if (iframeDoc) {
      // Create and dispatch translated event to iframe
      const translatedEvent = new MouseEvent(event.type, {
        bubbles: true,
        cancelable: true,
        clientX: nativeX,
        clientY: nativeY,
        button: event.button,
        buttons: event.buttons,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey
      });

      // Send to VNC canvas inside iframe
      const vncCanvas = iframeDoc.querySelector('canvas');
      if (vncCanvas) {
        vncCanvas.dispatchEvent(translatedEvent);
      }
    }

    // Prevent the original event from reaching the iframe
    event.preventDefault();
    event.stopPropagation();
  }, [scale, fitMode]);

  // --- Setup mouse event interception ---
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || fitMode === 'native') return;

    const handleMouseEvent = (event: MouseEvent) => {
      translateMouseEvent(event);
    };

    // Intercept all mouse events
    overlay.addEventListener('mousedown', handleMouseEvent, true);
    overlay.addEventListener('mousemove', handleMouseEvent, true);
    overlay.addEventListener('mouseup', handleMouseEvent, true);
    overlay.addEventListener('click', handleMouseEvent, true);
    overlay.addEventListener('dblclick', handleMouseEvent, true);
    overlay.addEventListener('wheel', handleMouseEvent, true);

    return () => {
      overlay.removeEventListener('mousedown', handleMouseEvent, true);
      overlay.removeEventListener('mousemove', handleMouseEvent, true);
      overlay.removeEventListener('mouseup', handleMouseEvent, true);
      overlay.removeEventListener('click', handleMouseEvent, true);
      overlay.removeEventListener('dblclick', handleMouseEvent, true);
      overlay.removeEventListener('wheel', handleMouseEvent, true);
    };
  }, [translateMouseEvent, fitMode]);

  // --- Observe container size changes ---
  useEffect(() => {
    const observer = new ResizeObserver(updateScale);
    const container = containerRef.current;
    if (container) {
      observer.observe(container);
    }
    updateScale(); // Initial scale
    return () => {
      if (container) {
        observer.unobserve(container);
      }
    };
  }, [updateScale]);
  
  // Re-calculate scale when fit mode changes
  useEffect(() => {
    updateScale();
  }, [fitMode, updateScale]);

  // --- Optimized VNC URL ---
  const optimizedVncUrl = React.useMemo(() => {
    if (!vncUrl) return '';
    const url = new URL(vncUrl);
    url.searchParams.set('autoconnect', 'true');
    url.searchParams.set('resize', 'off'); // We handle scaling with CSS + mouse translation
    url.searchParams.set('quality', '6');
    return url.toString();
  }, [vncUrl]);

  return (
    <div 
      className={`relative w-full h-full overflow-hidden bg-gray-900 ${className}`}
      ref={containerRef}
    >
      {/* VNC Iframe with CSS Scaling + Mouse Translation */}
      <div
        style={{
          width: nativeWidth,
          height: nativeHeight,
          transformOrigin: 'top left',
          transform: fitMode === 'native' ? 'scale(1)' : `scale(${scale})`,
          // Center the content if it's smaller than the container
          marginLeft: Math.max(0, (containerSize.width - (nativeWidth * scale)) / 2),
          marginTop: Math.max(0, (containerSize.height - (nativeHeight * scale)) / 2),
        }}
      >
        <iframe
          ref={iframeRef}
          src={optimizedVncUrl}
          className="w-full h-full border-0"
          title="VNC Remote Desktop"
          allow="clipboard-read; clipboard-write; fullscreen"
          style={{
            pointerEvents: fitMode === 'native' ? 'auto' : 'none' // Disable when we handle mouse translation
          }}
        />
        
        {/* Mouse Event Overlay - Intercepts and translates mouse events */}
        {fitMode !== 'native' && (
          <div
            ref={overlayRef}
            className="absolute inset-0 w-full h-full cursor-auto"
            style={{
              zIndex: 10,
              pointerEvents: 'auto'
            }}
            title="Interactive VNC Surface (Mouse Translated)"
          />
        )}
      </div>
      
      {/* UI Controls Overlay */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <div className="flex bg-black/80 text-white rounded-lg p-1 backdrop-blur-sm border border-white/20">
          <Button
            onClick={() => setFitMode('fit')}
            variant={fitMode === 'fit' ? 'secondary' : 'ghost'}
            size="sm"
            className="text-xs px-2 py-1 h-auto"
            title="Fit to Container (Responsive)"
          >
            Fit
          </Button>
          <Button
            onClick={() => setFitMode('fill')}
            variant={fitMode === 'fill' ? 'secondary' : 'ghost'}
            size="sm"
            className="text-xs px-2 py-1 h-auto"
            title="Fill Container (Responsive)"
          >
            Fill
          </Button>
          <Button
            onClick={() => setFitMode('native')}
            variant={fitMode === 'native' ? 'secondary' : 'ghost'}
            size="sm"
            className="text-xs px-2 py-1 h-auto"
            title="Native Resolution (1:1)"
          >
            1:1
          </Button>
        </div>
        <Button
          onClick={onFullscreen}
          variant="ghost"
          size="icon"
          title="Open in New Window"
          className="bg-black/80 text-white hover:bg-white/20 backdrop-blur-sm h-8 w-8"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Info Overlay */}
      <div className="absolute bottom-4 left-4 z-20 bg-black/80 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm">
        {Math.round(scale * 100)}% • {fitMode.toUpperCase()} • Mouse: {fitMode === 'native' ? 'Direct' : 'Translated'}
      </div>
    </div>
  );
};

export default ResponsiveVNCFrame; 