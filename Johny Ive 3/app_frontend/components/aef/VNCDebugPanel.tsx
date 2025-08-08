import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

interface VNCDebugPanelProps {
  vncUrl: string;
}

const VNCDebugPanel: React.FC<VNCDebugPanelProps> = ({ vncUrl }) => {
  const [useRawUrl, setUseRawUrl] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});

  // Generate enhanced URL
  const enhancedUrl = React.useMemo(() => {
    if (!vncUrl) return '';
    
    try {
      const url = new URL(vncUrl);
      url.searchParams.set('autoconnect', 'true');
      url.searchParams.set('resize', 'scale');
      return url.toString();
    } catch (error) {
      return vncUrl;
    }
  }, [vncUrl]);

  const currentUrl = useRawUrl ? vncUrl : enhancedUrl;

  const testVNCConnection = async () => {
    try {
      console.log('🔍 Testing VNC connection...');
      const response = await fetch(vncUrl.replace('/vnc_lite.html', '/'));
      setDebugInfo({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      console.log('VNC Server Response:', debugInfo);
    } catch (error) {
      console.error('VNC Connection Test Failed:', error);
      setDebugInfo({ error: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Debug Controls */}
      <div className="bg-gray-100 p-4 border-b">
        <div className="flex items-center gap-4 mb-2">
          <Button 
            onClick={() => setUseRawUrl(!useRawUrl)}
            variant={useRawUrl ? "default" : "outline"}
            size="sm"
          >
            {useRawUrl ? 'Using Raw URL' : 'Using Enhanced URL'}
          </Button>
          <Button onClick={testVNCConnection} variant="outline" size="sm">
            Test Connection
          </Button>
        </div>
        
        <div className="text-xs space-y-1">
          <div><strong>Raw URL:</strong> {vncUrl}</div>
          <div><strong>Enhanced URL:</strong> {enhancedUrl}</div>
          <div><strong>Current URL:</strong> {currentUrl}</div>
          {debugInfo.status && (
            <div><strong>Status:</strong> {debugInfo.status} {debugInfo.statusText}</div>
          )}
          {debugInfo.error && (
            <div className="text-red-600"><strong>Error:</strong> {debugInfo.error}</div>
          )}
        </div>
      </div>
      
      {/* VNC Frame */}
      <div className="flex-1 relative">
        <iframe
          src={currentUrl}
          className="w-full h-full border-0"
          title="VNC Debug Frame"
          allow="clipboard-read; clipboard-write; fullscreen"
          onLoad={() => {
            console.log('✅ VNC Debug iframe loaded:', currentUrl);
          }}
          onError={(e) => {
            console.error('❌ VNC Debug iframe failed:', currentUrl, e);
          }}
        />
      </div>
    </div>
  );
};

export default VNCDebugPanel; 