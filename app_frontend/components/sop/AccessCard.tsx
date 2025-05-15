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
        return <span role="img" aria-label="OK">🟢</span>;
      case 'missing':
        return <span role="img" aria-label="Missing">⚠️</span>;
      case 'pending':
        return <span role="img" aria-label="Pending">🔒</span>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-neutral-surface-3/50 p-4 rounded-card-radius shadow-sm border border-neutral-surface-3 max-w-xs mb-4">
      <h3 className="text-md font-semibold text-foreground mb-3">
        <span role="img" aria-label="Key">🔑</span> Required Access
      </h3>
      <ul className="space-y-2">
        {accessItems.map((item) => (
          <li key={item.id} className="flex items-start text-sm">
            <span className="mr-2 pt-0.5">{getStatusIcon(item.status)}</span>
            <div className="flex-1">
                <span className="text-foreground">{item.name}</span>
                {item.details && <p className="text-xs text-muted-foreground">{item.details}</p>}
            </div>
          </li>
        ))}
      </ul>
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