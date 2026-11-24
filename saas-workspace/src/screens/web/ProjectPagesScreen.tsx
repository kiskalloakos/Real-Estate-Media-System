import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { Button, Modal } from '@/components/web';
import { useProjectPages } from '@/hooks/use-project-pages';
import { blockLabels, newPageBlock, pageBlockTypes, pageListNumber, pageDescendants, pageDraft, pagePath, pageText, type PageBlock, type PageBlockType, type PageDraft, type PageRevision, type ProjectPage } from '@/lib/project-pages';
import type { JobSummary } from './types';
import './ProjectPagesScreen.css';

interface Props {
  agencyId?: string; userId?: string; projectId?: string; jobs: JobSummary[];
  role: 'admin' | 'team_member' | 'client'; clientId?: string;
  pageId?:string; onSelectPage?:(id:string|undefined)=>void;
}
interface EditorHandle { flush: () => Promise<void> }
function BlockInput({block,index,total,ordinal,onChange,onMove,onRemove,onInsert}: {
  block:PageBlock; index:number; total:number; ordinal:number; onChange:(b:PageBlock)=>void; onMove:(direction:number)=>void; onRemove:()=>void; onInsert:()=>void;
}) {
  const input=useRef<HTMLTextAreaElement>(null);
  const [menu,setMenu]=useState(false);
  useLayoutEffect(()=>{
    const element=input.current; if(!element) return;
    const resize=()=>{element.style.height='0px'; element.style.height=`${element.scrollHeight}px`;};
    resize(); let width=element.clientWidth; const observer=new ResizeObserver(()=>{if(element.clientWidth!==width){width=element.clientWidth;resize();}}); observer.observe(element); return ()=>observer.disconnect();
  },[block.text,block.type]);
  return <div className={`pp-block pp-block--${block.type}`}>
    <div className="pp-block-tools"><select aria-label={`Block ${index+1} type`} value={block.type} onChange={e=>onChange({...block,type:e.target.value as PageBlockType})}>{pageBlockTypes.map(type=><option key={type} value={type}>{blockLabels[type]}</option>)}</select><button type="button" aria-label={`Move block ${index+1} up`} disabled={index===0} onClick={()=>onMove(-1)}>↑</button><button type="button" aria-label={`Move block ${index+1} down`} disabled={index===total-1} onClick={()=>onMove(1)}>↓</button><button type="button" aria-label={`Remove block ${index+1}`} onClick={onRemove}>×</button></div>
    <div className="pp-block-body">{block.type==='divider'?<hr/>:<>
      {block.type==='check'&&<input aria-label={`Complete checklist item ${index+1}`} type="checkbox" checked={block.checked??false} onChange={e=>onChange({...block,checked:e.target.checked})}/>}
      {block.type==='bullet'&&<span aria-hidden>•</span>}{block.type==='number'&&<span aria-hidden>{ordinal}.</span>}
      <textarea ref={input} rows={1} aria-label={`Block ${index+1} ${blockLabels[block.type]}`} value={block.text} placeholder={block.type==='paragraph'?'Write something, or type / for blocks…':`${blockLabels[block.type]}…`} onChange={e=>{onChange({...block,text:e.target.value});setMenu(e.target.value==='/');}} onKeyDown={e=>{
        if(e.key==='Escape') setMenu(false);
        if((e.metaKey||e.ctrlKey)&&e.key==='Enter') {e.preventDefault();onInsert();}
        if(e.key==='Enter' && !e.shiftKey && block.type!=='code' && block.type!=='paragraph') {e.preventDefault();onInsert();}
      }}/>
    </>}</div>
    {menu&&<div className="pp-slash-menu" role="menu" aria-label="Insert writing block">{pageBlockTypes.map(type=><button type="button" role="menuitem" key={type} onClick={()=>{onChange({...block,type,text:''});setMenu(false);input.current?.focus();}}>{blockLabels[type]}</button>)}</div>}
  </div>;
}
function BlockReader({blocks}: {blocks:PageBlock[]}) {
  return <div className="pp-reading">{blocks.map((b,i)=><div key={b.id} className={`pp-read-block pp-block--${b.type}`}>{b.type==='divider'?<hr/>:b.type==='check'?<label><input type="checkbox" checked={b.checked??false} readOnly disabled/>{b.text}</label>:b.type==='heading1'?<h2>{b.text}</h2>:b.type==='heading2'?<h3>{b.text}</h3>:b.type==='code'?<pre>{b.text}</pre>:<p>{b.type==='bullet'?'• ':b.type==='number'?`${pageListNumber(blocks,i)}. `:''}{b.text}</p>}</div>)}</div>;
}
function PageEditor({page,pages,userKey,canShare,save,history,reload,ref}: {
  page:ProjectPage; pages:ProjectPage[]; userKey:string; canShare:boolean;
  save:(page:ProjectPage,draft:PageDraft)=>Promise<ProjectPage>; history:(id:string)=>Promise<PageRevision[]>;
  reload:()=>Promise<ProjectPage[]>; ref:Ref<EditorHandle>;
}) {
  const storageKey=`rm:page-draft:${userKey}:${page.id}`;
  const [initial]=useState(()=>{
    try { const stored=JSON.parse(window.localStorage.getItem(storageKey)??'null'); if(stored?.draft && Array.isArray(stored.draft.blocks) && typeof stored.revision==='number') return stored as {draft:PageDraft;revision:number}; } catch { /* Keep server content if local recovery is unavailable. */ }
    return {draft:pageDraft(page),revision:page.revision};
  });
  const [draft,setDraft]=useState<PageDraft>(initial.draft); const latest=useRef(initial.draft);
  const [savedSignature,setSavedSignature]=useState(()=>JSON.stringify(pageDraft(page)));
  const base=useRef({...page,revision:initial.revision}); const savedDraft=useRef(savedSignature);
  const [status,setStatus]=useState(initial.revision!==page.revision?'Draft recovered — saved page changed':JSON.stringify(initial.draft)===savedSignature?'Saved':'Unsaved draft recovered');
  const [error,setError]=useState(''); const pending=useRef<Promise<void>|null>(null);
  const [saving,setSaving]=useState(false); const [historyOpen,setHistoryOpen]=useState(false);
  const [revisions,setRevisions]=useState<PageRevision[]>(); const [historyError,setHistoryError]=useState('');
  const [selectedRevision,setSelectedRevision]=useState<PageRevision>();
  const dirty=JSON.stringify(draft)!==savedSignature;
  const change=(next:PageDraft)=>{
    latest.current=next; setDraft(next);
    const matchesSaved=!pending.current&&JSON.stringify(next)===savedDraft.current;
    setStatus(matchesSaved?'Saved':'Unsaved changes');if(matchesSaved)setError('');
    try {if(matchesSaved)window.localStorage.removeItem(storageKey);else window.localStorage.setItem(storageKey,JSON.stringify({revision:base.current.revision,draft:next}));}
    catch {setError('Browser draft recovery is unavailable. Keep this page open until saved.');}
  };
  const flush=async():Promise<void>=>{
    if(pending.current) {await pending.current; return flush();}
    const snapshot=latest.current; const signature=JSON.stringify(snapshot);
    if(signature===savedDraft.current) return;
    const operation=(async()=>{
      setSaving(true);setStatus('Saving…');setError('');
      try {
        const result=await save(base.current,snapshot); base.current=result; savedDraft.current=signature;setSavedSignature(signature);
        try {
          if(JSON.stringify(latest.current)===signature) window.localStorage.removeItem(storageKey);
          else window.localStorage.setItem(storageKey,JSON.stringify({revision:result.revision,draft:latest.current}));
        } catch {setError('Page saved online. Browser draft recovery could not be updated.');}
        setStatus(JSON.stringify(latest.current)===signature?'Saved':'Unsaved changes');
      } catch(failure) {const message=failure instanceof Error?failure.message:'Could not save the page.';setError(message);setStatus('Not saved — draft kept');throw failure;}
      finally {setSaving(false);pending.current=null;}
    })();
    pending.current=operation; await operation;
    if(JSON.stringify(latest.current)!==savedDraft.current) return flush();
  };
  useImperativeHandle(ref,()=>({flush}));
  const flushRef=useRef(flush); useEffect(()=>{flushRef.current=flush;});
  useEffect(()=>{
    if(!dirty) return; const timer=window.setTimeout(()=>{void flushRef.current().catch(()=>{});},900);
    return ()=>window.clearTimeout(timer);
  },[draft,dirty]);
  useEffect(()=>{
    const beforeUnload=(e:BeforeUnloadEvent)=>{if(JSON.stringify(latest.current)!==savedDraft.current){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',beforeUnload);return ()=>{window.removeEventListener('beforeunload',beforeUnload);void flushRef.current().catch(()=>{});};
  },[]);
  const updateBlock=(block:PageBlock)=>change({...latest.current,blocks:latest.current.blocks.map(b=>b.id===block.id?block:b)});
  const insertBlock=(after:number,type:PageBlockType='paragraph')=>{
    const blocks=[...latest.current.blocks];blocks.splice(after+1,0,newPageBlock(type));change({...latest.current,blocks});
  };
  const descendants=pageDescendants(pages,page.id);
  return <>
    <div className="pp-editor-bar"><span role="status" aria-live="polite">{status}</span><div><Button variant="secondary" onClick={()=>downloadDraft(latest.current)}>Export text</Button><Button variant="secondary" disabled={saving} onClick={async()=>{setHistoryOpen(true);setHistoryError('');setRevisions(undefined);try{await flush();setRevisions(await history(page.id));}catch(f){setHistoryError(f instanceof Error?f.message:'History unavailable.');}}}>History</Button><Button disabled={saving||!dirty} onClick={()=>{void flush().catch(()=>{});}}>{saving?'Saving…':'Save now'}</Button></div></div>
    {error&&<div className="pp-error" role="alert"><p>{error}</p><Button variant="secondary" onClick={()=>{void flush().catch(()=>{});}} disabled={saving}>Retry save</Button><Button variant="secondary" disabled={saving} onClick={async()=>{
      if(!window.confirm('Replace this browser draft with the latest saved page? Download your draft first if you want to keep it.'))return;
      try{const result=(await reload()).find(p=>p.id===page.id);if(!result)throw new Error('Page is unavailable. Your draft has been kept.');base.current=result;savedDraft.current=JSON.stringify(pageDraft(result));setSavedSignature(savedDraft.current);latest.current=pageDraft(result);setDraft(latest.current);window.localStorage.removeItem(storageKey);setError('');setStatus('Saved');}catch(f){setError(f instanceof Error?f.message:'Could not load saved page.');}
    }}>Use saved page</Button><Button variant="secondary" onClick={()=>downloadDraft(draft)}>Download my draft</Button></div>}
    <div className="pp-page-settings"><label>Page location<select aria-label="Parent page" value={draft.parentId??''} onChange={e=>change({...latest.current,parentId:e.target.value||null})}><option value="">Top level in project</option>{pages.filter(p=>p.jobId===page.jobId&&!descendants.has(p.id)).map(p=><option key={p.id} value={p.id}>{pagePath(pages,p).map(p=>p.title).join(' / ')}</option>)}</select></label><label className="pp-share"><input type="checkbox" disabled={!canShare} checked={draft.clientVisible} onChange={e=>change({...latest.current,clientVisible:e.target.checked})}/>Share with client</label></div>
    <p className="pp-privacy">{draft.clientVisible?'Visible to this project’s signed-in client. Child pages keep their own sharing settings.':canShare?'Team only. This page is hidden from the client.':'Team only. Internal projects have no client to share with.'}</p>
    <input className="pp-title" aria-label="Page title" value={draft.title} maxLength={300} onChange={e=>change({...latest.current,title:e.target.value})}/>
    <div className="pp-blocks">{draft.blocks.map((block,index)=><BlockInput key={block.id} block={block} index={index} total={draft.blocks.length} ordinal={pageListNumber(draft.blocks,index)} onChange={updateBlock} onInsert={()=>insertBlock(index,block.type==='character'?'dialogue':block.type==='scene'?'action':block.type==='check'?'check':'paragraph')} onRemove={()=>change({...latest.current,blocks:latest.current.blocks.filter(b=>b.id!==block.id)})} onMove={direction=>{const blocks=[...latest.current.blocks];[blocks[index],blocks[index+direction]]=[blocks[index+direction],blocks[index]];change({...latest.current,blocks});}}/>)}</div>
    <div className="pp-add"><Button variant="secondary" icon="plus" onClick={()=>insertBlock(draft.blocks.length-1)}>Add block</Button><span>Type / for blocks · ⌘/Ctrl + Enter adds a block</span></div>
    <Modal open={historyOpen} title="Page history" onClose={()=>setHistoryOpen(false)}><p>Restore text as a new revision. Sharing and page location stay as they are.</p>{historyError?<p role="alert">{historyError}</p>:!revisions?<p>Loading history…</p>:<div className="pp-history"><div>{revisions.map(r=><button type="button" key={r.id} aria-pressed={selectedRevision?.id===r.id} onClick={()=>setSelectedRevision(r)}>Revision {r.revision}<small>{new Date(r.createdAt).toLocaleString()}</small></button>)}</div>{selectedRevision&&<section><h3>{selectedRevision.title}</h3><BlockReader blocks={selectedRevision.blocks}/><Button disabled={saving} onClick={async()=>{change({...latest.current,title:selectedRevision.title,blocks:selectedRevision.blocks});try{await flush();setHistoryOpen(false);}catch{/* Inline save error retains the restored draft. */}}}>Restore this revision</Button></section>}</div>}</Modal>
  </>;
}
function downloadDraft(draft:PageDraft) {
  const url=URL.createObjectURL(new Blob([pageText(draft)],{type:'text/plain;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`${draft.title.replace(/[^a-z0-9-]/gi,'-')||'page'}.txt`;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function ProjectPagesScreen({agencyId,userId,projectId,jobs,role,clientId,pageId,onSelectPage}:Props) {
  const writable=role!=='client'; const store=useProjectPages(agencyId,jobs,writable);
  const [selected,setSelected]=useState<string>(); const [query,setQuery]=useState(''); const [jobFilter,setJobFilter]=useState(projectId??'');
  const [create,setCreate]=useState<{title:string;jobId:string;parentId:string;kind:'document'|'script'}>();
  const [creating,setCreating]=useState(false);const [actionError,setActionError]=useState(''); const editor=useRef<EditorHandle>(null);
  const permittedJobs=role==='client'?jobs.filter(j=>j.clientId===clientId):jobs;
  const permittedJobIds=new Set(permittedJobs.map(j=>j.id));
  const allPages=(store.pages??[]).filter(p=>(role!=='client'||(p.clientVisible&&permittedJobIds.has(p.jobId)))&&(!projectId||p.jobId===projectId));
  const pages=allPages.filter(p=>!jobFilter||p.jobId===jobFilter);
  const matches=pages.filter(p=>!query.trim()||`${p.title} ${p.blocks.map(b=>b.text).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
  const page=allPages.find(p=>p.id===(pageId??selected))??matches[0];
  const navigate=async(id:string)=>{setActionError('');try{await editor.current?.flush();setSelected(id);onSelectPage?.(id);}catch(f){setActionError(f instanceof Error?f.message:'Save your draft before switching pages.');}};
  const showCreate=async(parent?:ProjectPage)=>{try{await editor.current?.flush();setActionError('');setCreate({title:'',jobId:parent?.jobId??projectId??jobFilter??'',parentId:parent?.id??'',kind:'document'});}catch(f){setActionError(f instanceof Error?f.message:'Save the current page first.');}};
  const tree=(parent:string|null,depth=0):React.ReactNode=>pages.filter(p=>(p.parentId&&pages.some(a=>a.id===p.parentId)?p.parentId:null)===parent).map(p=><div key={p.id}><button type="button" className="pp-tree-page" style={{paddingLeft:12+depth*16}} aria-current={page?.id===p.id?'page':undefined} onClick={()=>{void navigate(p.id);}}><span>{p.kind==='script'?'S':'▤'}</span><span>{p.title}</span>{writable&&<small>{p.clientVisible?'Shared':'Team'}</small>}</button>{tree(p.id,depth+1)}</div>);
  return <section className="pp-workspace" aria-label="Project writing pages">
    <header className="pp-header"><div><h2>{projectId?'Pages':'Project pages'}</h2><p>{writable?'Briefs, ideas and scripts, together in the project.':'Pages shared by your agency.'}</p></div>{writable&&<Button icon="plus" disabled={!permittedJobs.length||store.pages===undefined} onClick={()=>{void showCreate();}}>New page</Button>}</header>
    {!projectId&&<label className="pp-project-filter">Project<select aria-label="Filter pages by project" value={jobFilter} onChange={async e=>{const next=e.target.value;try{await editor.current?.flush();setJobFilter(next);setSelected(undefined);onSelectPage?.(undefined);}catch(f){setActionError(f instanceof Error?f.message:'Save your page first.');}}}><option value="">All projects</option>{permittedJobs.map(j=><option key={j.id} value={j.id}>{j.name}</option>)}</select></label>}
    {store.error&&<div className="pp-error" role="alert"><p>{store.error}</p><Button onClick={()=>{void store.refresh().catch(()=>{});}}>Retry loading</Button></div>}{actionError&&<p className="pp-error" role="alert">{actionError}</p>}
    {store.pages===undefined?<p role="status">{store.error?'Project pages are unavailable.':'Loading project pages…'}</p>:<div className="pp-layout"><aside className="pp-sidebar"><input aria-label="Search project pages" placeholder="Find a page…" value={query} onChange={async e=>{const next=e.target.value;try{await editor.current?.flush();setQuery(next);setSelected(undefined);onSelectPage?.(undefined);}catch(f){setActionError(f instanceof Error?f.message:'Save your page first.');}}}/><nav aria-label="Page tree">{query?matches.map(p=><button className="pp-tree-page" type="button" key={p.id} aria-current={page?.id===p.id?'page':undefined} onClick={()=>{void navigate(p.id);}}>{p.title}</button>):tree(null)}</nav>{!matches.length&&<p className="pp-muted">{query?'No matching pages.':'No pages here yet.'}</p>}</aside>
      <article className="pp-paper">{page?<><div className="pp-breadcrumb"><span>{permittedJobs.find(j=>j.id===page.jobId)?.name??'Project'}</span>{pagePath(allPages,page).map(p=><button type="button" key={p.id} onClick={()=>{void navigate(p.id);}}>{p.title}</button>)}</div>{writable?<><div className="pp-page-actions"><span>{page.kind==='script'?'Script':'Document'}</span><Button variant="secondary" onClick={()=>{void showCreate(page);}}>Add child page</Button></div><PageEditor key={page.id} ref={editor} canShare={Boolean(jobs.find(j=>j.id===page.jobId)?.clientId)} page={page} pages={allPages} userKey={`${agencyId??'sample'}:${userId??'preview'}`} save={store.save} history={store.history} reload={store.refresh}/></>:<><h1 className="pp-title">{page.title}</h1><BlockReader blocks={page.blocks}/></>}</>:<div className="pp-empty"><h3>{query?'No matching pages':'A home for your project’s writing'}</h3><p>{writable?permittedJobs.length?'Create a brief, add ideas underneath it, then write the script. Pages start team-only.':'Create a project first, then add its pages here.':'Your agency hasn’t shared any pages in this view yet.'}</p></div>}</article></div>}
    <Modal open={Boolean(create)} title="New project page" onClose={()=>{if(!creating)setCreate(undefined);}}>{create&&<form className="rm-action-form" onSubmit={async e=>{e.preventDefault();setCreating(true);setActionError('');try{const saved=await store.save({id:crypto.randomUUID(),jobId:create.jobId,revision:0},{title:create.title,parentId:create.parentId||null,kind:create.kind,clientVisible:false,blocks:[newPageBlock(create.kind==='script'?'scene':'paragraph')]});setSelected(saved.id);onSelectPage?.(saved.id);setJobFilter(saved.jobId);setQuery('');setCreate(undefined);}catch(f){setActionError(f instanceof Error?f.message:'Could not create page.');}finally{setCreating(false);}}}>
      <label className="rm-field"><span>Page title</span><input autoFocus required maxLength={300} disabled={creating} value={create.title} onChange={e=>setCreate({...create,title:e.target.value})}/></label>
      <label className="rm-field"><span>Project</span><select required disabled={creating||Boolean(projectId)||Boolean(create.parentId)} value={create.jobId} onChange={e=>setCreate({...create,jobId:e.target.value,parentId:''})}><option value="">Choose a project</option>{permittedJobs.map(j=><option key={j.id} value={j.id}>{j.name}</option>)}</select></label>
      <label className="rm-field"><span>Page type</span><select disabled={creating} value={create.kind} onChange={e=>setCreate({...create,kind:e.target.value as 'document'|'script'})}><option value="document">Document</option><option value="script">Script</option></select></label><p>{create.parentId?`Inside ${allPages.find(p=>p.id===create.parentId)?.title??'parent page'}. `:''}Team only by default. You can share this page after creating it.</p>{actionError&&<p role="alert">{actionError}</p>}<footer className="rm-dialog-actions"><Button variant="secondary" disabled={creating} onClick={()=>setCreate(undefined)}>Cancel</Button><Button type="submit" disabled={creating||!create.title.trim()||!create.jobId}>{creating?'Creating…':'Create page'}</Button></footer></form>}</Modal>
  </section>;
}
