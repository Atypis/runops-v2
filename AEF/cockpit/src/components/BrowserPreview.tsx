import React from 'react';

const BrowserPreview: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Live Browser Preview</h3>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-success-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Connected</span>
        </div>
      </div>

      {/* Browser Frame */}
      <div className="bg-gray-100 rounded-lg overflow-hidden">
        {/* Browser Header */}
        <div className="bg-gray-200 px-4 py-2 flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <div className="flex-1 bg-white rounded px-3 py-1 text-sm text-gray-600">
            https://mail.google.com/mail/u/0/#inbox
          </div>
        </div>

        {/* Browser Content */}
        <div className="bg-white p-6 min-h-[400px] flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl">🌐</span>
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">Browser Preview</h4>
            <p className="text-gray-500 mb-4">
              Real-time browser state will be displayed here during execution
            </p>
            <div className="text-sm text-gray-400">
              Current URL: Gmail Inbox<br/>
              Last Action: Navigate to Gmail<br/>
              Page Load Time: 2.3s
            </div>
          </div>
        </div>
      </div>

      {/* Browser State Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Page Info</h4>
          <div className="space-y-1 text-sm text-gray-600">
            <div>Title: Gmail - Inbox</div>
            <div>Load Time: 2.3s</div>
            <div>Elements: 247</div>
          </div>
        </div>

        <div className="card p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Last Action</h4>
          <div className="space-y-1 text-sm text-gray-600">
            <div>Type: Navigate</div>
            <div>Target: Gmail Inbox</div>
            <div>Time: 00:00:03</div>
          </div>
        </div>

        <div className="card p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Status</h4>
          <div className="space-y-1 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-success-500 rounded-full"></div>
              <span>Page Loaded</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-success-500 rounded-full"></div>
              <span>Ready for Action</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrowserPreview; 