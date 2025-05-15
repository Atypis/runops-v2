'use client'; // Required for dynamic import and potentially for hooks if SopView uses them

import dynamic from 'next/dynamic';
import sopJsonData from '@/lib/mockSop.json'; // Import the JSON data directly

// Dynamically import the SopListViewRedesign component with SSR turned off
const SopView = dynamic(() => import('@/components/SopListViewRedesign'), { ssr: false });

// Define the type for our SOP JSON based on the structure in SopListViewRedesign.tsx
// This helps with type safety when using sopJsonData.
interface Node {
  id: string;
  label: string;
  type: 'task'|'decision'|'loop'|'end';
  intent?: string;
  iterator?: string;
  exit_condition?: string;
  context?: string;
  children?: string[];
}
interface SopJson { 
  meta: { 
    title:string; 
    owner:string[]; 
    version:string; 
    goal:string; 
    purpose:string 
  }; 
  public: { 
    triggers:any[]; 
    nodes:Node[]; 
    variables:Record<string,string>; 
    clarification_requests:any[] 
  }
}

export default function SopPlaygroundPage() {
  // Use the imported JSON data. Explicitly cast to SopJson for type safety.
  const sopJson = sopJsonData as SopJson;

  if (!sopJson) {
    // This case should ideally not be hit if the import is successful.
    return <div>Error: SOP data could not be loaded.</div>;
  }

  return <SopView data={sopJson} />;
} 