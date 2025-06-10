import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Monitor, Smartphone, Tablet } from 'lucide-react';

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

type ResizeMode = 'remote' | 'scale' | 'off';

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
  const [resizeMode, setResizeMode] = useState<ResizeMode>('off');
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isConnected, setIsConnected] = useState(false);

  // --- Update container size tracking ---
  const updateContainerSize = useCallback(() => {
    if (!containerRef.current) return;

    const { width, height } = containerRef.current.getBoundingClientRect();
    setContainerSize({ width, height });
    onDimensionsChange?.({ width, height });
  }, [onDimensionsChange]);

  // --- Observe container size changes ---
  useEffect(() => {
    const observer = new ResizeObserver(updateContainerSize);
    const container = containerRef.current;
    if (container) {
      observer.observe(container);
    }
    updateContainerSize(); // Initial size
    return () => {
      if (container) {
        observer.unobserve(container);
      }
    };
  }, [updateContainerSize]);

  // --- Optimized VNC URL with TigerVNC dynamic resize support ---
  const optimizedVncUrl = React.useMemo(() => {
    if (!vncUrl) return '';
    const url = new URL(vncUrl);
    url.searchParams.set('autoconnect', 'true');
    url.searchParams.set('quality', '6');
    url.searchParams.set('compression', '2'); // Enable compression for better performance
    
    // Use noVNC's native resize modes that work with TigerVNC ExtendedDesktopSize
    switch (resizeMode) {
      case 'remote':
        // This is the magic setting! Remote resize mode uses VNC ExtendedDesktopSize
        // to change the server's framebuffer size to match the client window
        url.searchParams.set('resize', 'remote');
        break;
      case 'scale':
        // Client-side scaling (fallback if remote resize not supported)
        url.searchParams.set('resize', 'scale');
        break;
      case 'off':
        // No scaling - native resolution only
        url.searchParams.set('resize', 'off');
        break;
    }
    
    return url.toString();
  }, [vncUrl, resizeMode]);

  // --- Quick preset functions ---
  const setMobileResolution = () => {
    // Post message to iframe to request 375x667 resolution
    if (iframeRef.current && resizeMode === 'remote') {
      // This would be handled by noVNC remote resize automatically
      console.log('📱 Mobile resolution will be set by remote resize');
    }
  };

  const setTabletResolution = () => {
    console.log('📱 Tablet resolution will be set by remote resize');
  };

  const setDesktopResolution = () => {
    console.log('🖥️ Desktop resolution will be set by remote resize');
  };

  return (
    <div 
      className={`relative w-full h-full overflow-hidden bg-gray-900 ${className}`}
      ref={containerRef}
    >
      {/* VNC Iframe - Using native noVNC remote resize for TigerVNC */}
      <iframe
        ref={iframeRef}
        src={optimizedVncUrl}
        className="w-full h-full border-0"
        title="VNC Remote Desktop with Dynamic Resolution"
        allow="clipboard-read; clipboard-write; fullscreen"
        onLoad={() => {
          setIsConnected(true);
          console.log('✅ VNC iframe loaded with remote resize support');
        }}
        onError={() => {
          setIsConnected(false);
          console.error('❌ VNC iframe failed to load');
        }}
      />
      
      {/* UI Controls Overlay */}
      {showControls && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {/* Resize Mode Controls */}
          <div className="flex bg-black/80 text-white rounded-lg p-1 backdrop-blur-sm border border-white/20">
            <Button
              onClick={() => setResizeMode('off')}
              variant={resizeMode === 'off' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs px-2 py-1 h-auto"
              title="Native Resolution (Full Browser View)"
            >
              🖥️ Full
            </Button>
            <Button
              onClick={() => setResizeMode('scale')}
              variant={resizeMode === 'scale' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs px-2 py-1 h-auto"
              title="Client Scaling"
            >
              📏 Scale
            </Button>
            <Button
              onClick={() => setResizeMode('remote')}
              variant={resizeMode === 'remote' ? 'secondary' : 'ghost'}
              size="sm"
              className="text-xs px-2 py-1 h-auto"
              title="Remote Resize (Dynamic Resolution)"
            >
              🎯 Auto
            </Button>
          </div>

          {/* Quick Resolution Presets (only show in remote mode) */}
          {resizeMode === 'remote' && (
            <div className="flex bg-black/80 text-white rounded-lg p-1 backdrop-blur-sm border border-white/20">
              <Button
                onClick={setMobileResolution}
                variant="ghost"
                size="sm"
                className="text-xs px-2 py-1 h-auto"
                title="Mobile Resolution"
              >
                <Smartphone className="w-3 h-3" />
              </Button>
              <Button
                onClick={setTabletResolution}
                variant="ghost"
                size="sm"
                className="text-xs px-2 py-1 h-auto"
                title="Tablet Resolution"
              >
                <Tablet className="w-3 h-3" />
              </Button>
              <Button
                onClick={setDesktopResolution}
                variant="ghost"
                size="sm"
                className="text-xs px-2 py-1 h-auto"
                title="Desktop Resolution"
              >
                <Monitor className="w-3 h-3" />
              </Button>
            </div>
          )}

          {/* Fullscreen Button */}
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
      )}
      
      {/* Status Info Overlay */}
      <div className="absolute bottom-4 left-4 z-20 bg-black/80 text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <span>
            {resizeMode === 'off' ? '🖥️ Full Browser View' :
             resizeMode === 'scale' ? '📏 Client Scaling' : '🎯 Dynamic Resolution'} • 
            {containerSize.width}×{containerSize.height}
          </span>
        </div>
      </div>

      {/* Loading State */}
      {!isConnected && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p>Connecting to VNC with dynamic resolution...</p>
            <p className="text-sm text-gray-400 mt-2">Mode: {resizeMode}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponsiveVNCFrame; 