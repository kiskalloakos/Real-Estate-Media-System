import { useState, type ComponentProps } from 'react';
import { DocumentsScreen } from './DocumentsScreen';
import { ProjectPagesScreen } from './ProjectPagesScreen';
import { ScriptingScreen } from './ScriptingScreen';
import type { JobSummary, PropertySummary } from './types';
export function DocumentsWorkspace({agencyId,userId,role,clientId,jobs,properties,library,pageId,onSelectPage}: {
  agencyId?:string;userId?:string;role:'admin'|'team_member'|'client';clientId?:string;
  pageId?:string;onSelectPage?:(id:string|undefined)=>void;
  jobs:JobSummary[];properties?:PropertySummary[];library:ComponentProps<typeof DocumentsScreen>;
}) {
  const [tab,setTab]=useState<'pages'|'library'|'scripts'>('pages');
  return <div className="rm-page"><nav className="pp-hub-tabs" aria-label="Writing workspace"><button type="button" aria-pressed={tab==='pages'} onClick={()=>setTab('pages')}>Project pages</button>{role==='admin'&&<button type="button" aria-pressed={tab==='library'} onClick={()=>setTab('library')}>Company library</button>}{role!=='client'&&<button type="button" aria-pressed={tab==='scripts'} onClick={()=>setTab('scripts')}>Production scripts</button>}</nav>
    {tab==='pages'?<ProjectPagesScreen agencyId={agencyId} userId={userId} role={role} clientId={clientId} jobs={jobs} pageId={pageId} onSelectPage={onSelectPage}/>:tab==='library'&&role==='admin'?<DocumentsScreen {...library}/>:role!=='client'?<ScriptingScreen properties={properties}/>:null}
  </div>;
}
