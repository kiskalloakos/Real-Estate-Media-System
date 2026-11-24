import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { listPageRevisions, listProjectPages, saveProjectPage } from '@/lib/project-pages-service';
import { newPageBlock, type PageDraft, type PageRevision, type ProjectPage } from '@/lib/project-pages';
import type { JobSummary } from '@/screens/web/types';

interface SampleState { pages: ProjectPage[]; history: Record<string,PageRevision[]> }
const sampleKey='rm:project-pages:v1';
function readSample(jobs: JobSummary[]): SampleState {
  try { const value=window.localStorage.getItem(sampleKey); if(value) return JSON.parse(value); } catch { /* Use fixtures only in isolated preview. */ }
  const job=jobs.find(j=>j.clientId); if(!job) return {pages:[],history:{}};
  const base={agencyId:'preview-agency',jobId:job.id,revision:1,updatedAt:new Date().toISOString(),kind:'document' as const,clientVisible:false};
  const pages:ProjectPage[]=[{...base,id:'preview-brief',parentId:null,title:'Creative brief',clientVisible:true,blocks:[newPageBlock('heading1','Make the next stay memorable'),newPageBlock('paragraph','A quiet retreat, warm interiors and weekends worth sharing.'),newPageBlock('check','Confirm the shoot location')]},
    {...base,id:'preview-concepts',parentId:'preview-brief',title:'Content concepts',blocks:[newPageBlock('heading2','A weekend, told in moments'),newPageBlock('bullet','Arrival and first impressions'),newPageBlock('bullet','Morning light in the cabin')]},
    {...base,id:'preview-script',parentId:'preview-concepts',title:'The weekend story',kind:'script',blocks:[newPageBlock('scene','INT. CABIN — MORNING'),newPageBlock('action','Sunlight moves across the wooden floor. A kettle starts to steam.'),newPageBlock('character','NARRATOR (V.O.)'),newPageBlock('dialogue','Some weekends deserve a little more space.')]}];
  return {pages,history:Object.fromEntries(pages.map(p=>[p.id,[{id:crypto.randomUUID(),revision:1,title:p.title,blocks:p.blocks,createdAt:p.updatedAt}]]))};
}
export function useProjectPages(agencyId: string | undefined, jobs: JobSummary[], writable: boolean) {
  const [pages,setPages]=useState<ProjectPage[]>(); const [error,setError]=useState(''); const [refreshing,setRefreshing]=useState(false);
  const sample=useRef<SampleState | null>(null); const active=useRef(0);
  const refresh=useCallback(async()=>{
    const request=++active.current; setRefreshing(true); setError('');
    try {
      if(isSupabaseConfigured && !agencyId) throw new Error('Choose an agency workspace to load project pages.');
      const result=isSupabaseConfigured?await listProjectPages(agencyId!):(sample.current=readSample(jobs)).pages;
      if(request===active.current) setPages(result);
      return result;
    } catch(failure) { if(request===active.current) setError(failure instanceof Error?failure.message:'Could not load pages.'); throw failure; }
    finally { if(request===active.current) setRefreshing(false); }
  // Project summaries can refresh without discarding the current writing session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[agencyId]);
  useEffect(()=>{let disposed=false;void Promise.resolve().then(()=>{if(!disposed)return refresh();}).catch(()=>{});return ()=>{disposed=true;};},[refresh]);
  const save=async(page:Pick<ProjectPage,'id'|'jobId'|'revision'>,draft:PageDraft)=>{
    if(!writable) throw new Error('Only the agency team can edit project pages.');
    let saved:ProjectPage;
    if(isSupabaseConfigured) saved=await saveProjectPage(page,draft);
    else {
      if(!draft.title.trim()) throw new Error('Choose a page title before saving. Your draft has been kept.');
      const state=readSample(jobs); const old=state.pages.find(p=>p.id===page.id);
      if((old?.revision??0)!==page.revision) throw new Error('PAGE_CONFLICT: This page changed elsewhere. Your draft has been kept');
      saved={...page,...draft,agencyId:agencyId??'preview-agency',revision:page.revision+1,updatedAt:new Date().toISOString()};
      const revision={id:crypto.randomUUID(),revision:saved.revision,title:saved.title,blocks:saved.blocks,createdAt:saved.updatedAt};
      const next={pages:old?state.pages.map(p=>p.id===saved.id?saved:p):[...state.pages,saved],history:{...state.history,[saved.id]:[revision,...(state.history[saved.id]??[])]}};
      window.localStorage.setItem(sampleKey,JSON.stringify(next)); sample.current=next;
    }
    setPages(current=>current?.some(p=>p.id===saved.id)?current.map(p=>p.id===saved.id?saved:p):[...(current??[]),saved]);
    return saved;
  };
  const history=async(id:string)=>{
    if(!writable) throw new Error('Page history is available to the agency team.');
    return isSupabaseConfigured?listPageRevisions(id):(sample.current?.history[id]??[]);
  };
  return {pages,error,refreshing,refresh,save,history};
}
