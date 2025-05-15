// SopListViewRedesign.tsx
// A refined, "Jony Ive-inspired" implementation with attention to subtle details:
// – Light, sophisticated color palette with subtle gradients
// – Precise typography with careful spacing
// – Considered visual hierarchy emphasizing content
// – Minimal, elegant UI with breathing room
// – Focus on readability and calming aesthetic

// Safelist for Tailwind JIT compiler to ensure these classes are generated:
// bg-rail-task
// bg-rail-decision
// bg-rail-loop
// bg-rail-end

// Tailwind config requirements:
//   theme.extend {
//      colors:{
//        rail:{ task:'#3A7AFE', decision:'#FDBA38', loop:'#7C3AED', end:'#9CA3AF' }
//      },
//      fontSize:{ xs:['0.688rem','1.2'], sm:['0.813rem','1.35'], base:['0.9375rem','1.5'], lg:['1.125rem','1.4'] },
//   }
//
import React, { Fragment } from 'react';
import clsx from 'clsx';

/** minimal types */
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
interface SopJson { meta:{ title:string; owner:string[]; version:string; goal:string; purpose:string }; public:{ triggers:any[]; nodes:Node[]; variables:Record<string,string>; clarification_requests:any[] } }

/** helper: map node → rail colour (more refined, desaturated palette) */
const railColor = (t:Node['type']) => ({
  task: 'rgba(90, 130, 253, 0.9)',      // Refined blue
  decision: 'rgba(251, 191, 90, 0.85)',  // Soft amber
  loop: 'rgba(150, 90, 240, 0.85)',      // Elegant violet
  end: 'rgba(180, 184, 192, 0.7)'        // Subtle grey
}[t]);

/** helper: map node → subtle background tint */
const sectionBgColor = (t:Node['type']) => ({
  task: 'rgba(90, 130, 253, 0.02)',     // Nearly imperceptible blue tint
  decision: 'rgba(251, 191, 90, 0.02)', // Nearly imperceptible amber tint
  loop: 'rgba(150, 90, 240, 0.02)',     // Nearly imperceptible violet tint
  end: 'rgba(180, 184, 192, 0.02)'      // Nearly imperceptible grey tint
}[t]);

/** Step item with refined styling */
const Step:React.FC<{n:Node; depth:number}> = ({ n, depth }) => (
  <li className={clsx(
       "relative py-8 pl-20 mb-6 border-0 rounded-lg",
       depth && 'ml-12 border-l border-gray-100'
     )}
     style={{
       counterIncrement: 'step',
       backgroundColor: sectionBgColor(n.type),
       transition: 'all 0.2s ease'
     }}>
    {/* Elegant rail indicator with gradient */}
    <div
      className="absolute left-7 inset-y-0 w-[3px] rounded-full overflow-hidden"
      style={{ opacity: 0.9 }}
    >
      <div 
        style={{ 
          backgroundColor: railColor(n.type),
          height: '100%',
          width: '100%',
          background: `linear-gradient(to right, ${railColor(n.type)}, ${railColor(n.type)} 70%, transparent 100%)`,
        }}
      />
    </div>
    
    {/* Refined step number */}
    <span className="step-num absolute left-0 w-16 text-right text-xs font-medium text-gray-400 select-none" 
          style={{ letterSpacing: '0.02em' }}>
      {depth ? `${depth}.` : ''}{/* CSS counter via ::before below */}
    </span>
    
    {/* Content with improved typography */}
    <div className="transition-all duration-200 ease-in-out">
      <h3 className="text-lg font-medium text-gray-800 leading-tight tracking-tight">
        {n.type !== 'task' && 
          <span className="text-gray-500 font-normal mr-1.5 capitalize tracking-tight">
            {n.type}:
          </span>
        }
        {n.label}
      </h3>
      
      {n.intent && 
        <p className="mt-3 text-base text-gray-600 max-w-2xl leading-relaxed">
          {n.intent}
        </p>
      }
      
      {n.type === 'loop' && (
        <p className="mt-3 text-sm text-gray-500 font-light">
          Iterating <span className="font-medium">{n.iterator}</span> 
          <span className="mx-1.5 opacity-50">•</span>
          exit when <span className="font-medium">{n.exit_condition}</span>
        </p>
      )}
    </div>
  </li>
);

/** Main component */
export default function SopListViewRedesign({ data }: {data:SopJson}) {
  const nodesTop = data.public.nodes.filter(n=> !data.public.nodes.some(p=>p.children?.includes(n.id)));
  
  return (
    <div className="flow-grid gap-[5vw]">
      {/* HEADER (sticky with refined styling) */}
      <header className="col-span-3 sticky top-0 bg-white/90 backdrop-blur-md border-b border-gray-50 pt-8 pb-6 mb-12 z-10 transition-all duration-300">
        <h1 className="text-2xl font-medium text-gray-800 tracking-tight">{data.meta.title}</h1>
        <p className="mt-4 text-base text-gray-600 max-w-2xl leading-relaxed">{data.meta.goal}</p>
        <p className="mt-3 text-base text-gray-600 max-w-2xl leading-relaxed">{data.meta.purpose}</p>
        <div className="mt-8 text-sm text-gray-400 flex items-center space-x-8">
          <div className="flex items-center">
            <span className="opacity-70 mr-2">Owner</span>
            <span className="text-gray-600">{data.meta.owner.join(', ')}</span>
          </div>
          <div className="flex items-center">
            <span className="opacity-70 mr-2">Version</span>
            <span className="text-gray-600">{data.meta.version}</span>
          </div>
        </div>
      </header>

      {/* FLOW */}
      <ol className="counter-reset step col-start-2 space-y-0 pb-24">
        {nodesTop.map((n,i)=> <Fragment key={n.id}>
          <Step n={n} depth={0} />
          {n.children && n.children.map((cid,idx)=>{
            const child = data.public.nodes.find(x=>x.id===cid)!;
            return <Step key={child.id} n={child} depth={i+1} />;
          })}
        </Fragment>)}
      </ol>

      {/* SIDEBAR - refined */}
      <aside className="col-start-3 space-y-16 pt-2">
        <section>
          <h4 className="text-xs font-medium tracking-wider text-gray-500 uppercase mb-5 opacity-80">Variables</h4>
          <div className="space-y-3 pl-1">
            {Object.entries(data.public.variables).map(([k,v])=>
              <p key={k} className="text-sm mb-2 flex">
                <span className="font-medium text-gray-700 mr-3 min-w-[120px]">{k}:</span>
                <span className="text-gray-600">{v}</span>
              </p>
            )}
          </div>
        </section>
        
        <section>
          <h4 className="text-xs font-medium tracking-wider text-gray-500 uppercase mb-5 opacity-80">Clarifications</h4>
          <div className="space-y-4">
            {data.public.clarification_requests.map((c:any)=>(
              <div key={c.id} className={clsx('pl-4 py-1 border-l-2 rounded-sm mb-4',{
                'border-orange-300 bg-orange-50/30': c.importance==='high',
                'border-blue-300 bg-blue-50/30': c.importance==='medium',
                'border-gray-200 bg-gray-50/30': c.importance==='low'})}>
                <p className="text-sm text-gray-700 leading-relaxed">
                  <span className="font-medium mr-2 opacity-70">{c.id}</span>
                  {c.question}
                </p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

/* ---------- Tailwind utilities added via @layer ---------- */
// @layer utilities {
//   .counter-reset { counter-reset:step }
//   .step-num::before { content:counter(step); }
// } 