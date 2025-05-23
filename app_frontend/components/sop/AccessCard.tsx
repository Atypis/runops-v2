import React from 'react';

// Placeholder type, replace with actual data structure if available
interface AccessItem {
  id: string;
  name: string;
  status: 'ok' | 'missing' | 'pending'; // From Design Brief
  details?: string; // Optional additional details
}

interface AccessCardProps {
  accessItems: AccessItem[];
}

const AccessCard: React.FC<AccessCardProps> = ({ accessItems }) => {
  if (!accessItems || accessItems.length === 0) {
    // Optionally render nothing or a message indicating no specific access requirements
    // return <p className="text-sm text-muted-foreground">No specific access requirements listed.</p>;
    return null;
  }

  const getStatusIcon = (status: AccessItem['status']) => {
    switch (status) {
      case 'ok':
        return <div className="w-2 h-2 bg-green-500 rounded-full"></div>;
      case 'missing':
        return <div className="w-2 h-2 bg-red-500 rounded-full"></div>;
      case 'pending':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>;
      default:
        return <div className="w-2 h-2 bg-neutral-300 rounded-full"></div>;
    }
  };

  const getStatusText = (status: AccessItem['status']) => {
    switch (status) {
      case 'ok':
        return 'OK';
      case 'missing':
        return 'Missing';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-md p-3">
      <h3 className="text-sm font-medium text-neutral-900 mb-2 flex items-center">
        <span className="mr-2 text-xs">🔑</span>
        Access
      </h3>
      <div className="space-y-1.5">
        {accessItems.map((item) => (
          <div key={item.id} className="flex items-start text-xs">
            <div className="flex-shrink-0 mr-2 mt-0.5">
              {getStatusIcon(item.status)}
            </div>
            <div className="flex-grow min-w-0">
              <div className="flex items-start justify-between">
                <span className="font-medium text-neutral-800 leading-tight text-xs">
                  {item.name.replace(' (investor-relations@example.com)', '')}
                </span>
                <span className={`text-xs px-1 py-0.5 rounded font-medium ml-2 flex-shrink-0 ${
                  item.status === 'ok' ? 'bg-green-100 text-green-700' :
                  item.status === 'missing' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {getStatusText(item.status)}
                </span>
              </div>
              {item.details && (
                <p className="text-xs text-neutral-500 mt-0.5 leading-tight">{item.details}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Mock data for demonstration - to be replaced with actual data source
export const mockAccessItems: AccessItem[] = [
  {
    id: '1',
    name: 'Gmail Account (investor-relations@example.com)',
    status: 'ok',
    details: 'Primary inbox for communications'
  },
  {
    id: '2',
    name: 'Airtable Investor CRM Base',
    status: 'ok',
    details: 'Investor Relationship Management App'
  },
  {
    id: '3',
    name: 'ZenDesk Enterprise Login',
    status: 'missing',
    details: 'For Q3 financial report access'
  },
  {
    id: '4',
    name: 'Shared Drive - \'Fundraising Docs\'',
    status: 'pending',
    details: 'Approval requested from Finance team'
  },
];

export default AccessCard; 