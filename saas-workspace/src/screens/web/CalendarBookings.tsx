import {useEffect,useState} from 'react';
import {Button,Modal} from '@/components/web';
import {isSupabaseConfigured,supabase} from '@/lib/supabase';
import type {CalendarBookingRow} from '@/types/database';
import type {PortalActionHandlers,ClientSummary} from './types';

const sampleKey='rm:calendar-requests:v1';
function sampleRequests():CalendarBookingRow[]{try{return JSON.parse(localStorage.getItem(sampleKey)??'[]');}catch{return [];}}
export function CalendarBookings({agencyId,clientId,userId,role,actions,clients=[]}:{agencyId?:string|null;clientId?:string|null;userId?:string;role:string;actions?:PortalActionHandlers;clients?:ClientSummary[]}) {
  const [requests,setRequests]=useState<CalendarBookingRow[]>();const [showHistory,setShowHistory]=useState(false);const [error,setError]=useState('');const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);
  const [form,setForm]=useState({title:'',category:'call' as 'call'|'shoot',start:'',end:'',location:'',note:''});
  const load=async()=>{
    if(!isSupabaseConfigured){setRequests(sampleRequests());return;}
    if(!supabase||!agencyId)throw new Error('Choose an agency workspace.');
    const {data,error}=await supabase.from('calendar_booking_requests').select('*').eq('agency_id',agencyId).order('created_at',{ascending:false}).limit(100);
    if(error)throw new Error(`Could not load booking requests: ${error.message}`);setRequests(data??[]);
  };
  useEffect(()=>{void Promise.resolve().then(load).catch(f=>setError(f.message));
  // Workspace identity remounts this panel; calendar refreshes need not discard a request draft.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[agencyId,userId]);
  if(role==='team_member')return null;
  const visible=(requests??[]).filter(r=>role==='admin'||(r.client_account_id===clientId&&r.requested_by===(isSupabaseConfigured?userId:'preview-client'))).filter(r=>role!=='admin'||showHistory||r.status==='pending');
  return <section className="rm-card" style={{padding:20,marginBottom:20}} aria-label="Booking requests"><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><h2 style={{margin:0,fontSize:18}}>Booking requests</h2><p>{role==='admin'?'Review incoming call and shoot requests.':'Propose a call or shoot. Your agency will confirm the time.'}</p></div>{role==='admin'&&Boolean(requests?.some(r=>r.status!=='pending'))&&<Button variant="secondary" onClick={()=>setShowHistory(!showHistory)}>{showHistory?'Pending requests':'Request history'}</Button>}{role==='client'&&<Button disabled={!clientId||(isSupabaseConfigured&&!actions?.requestCalendarBooking)} onClick={()=>{setError('');setOpen(true);}}>Request a booking</Button>}</div>
    {error&&<div role="alert"><p>{error}</p><Button variant="secondary" disabled={busy} onClick={()=>{setError('');void load().catch(f=>setError(f.message));}}>Retry loading requests</Button></div>}{requests===undefined?(error?null:<p>Loading booking requests…</p>):!visible.length?<p>{role==='admin'&&!showHistory?'No requests awaiting confirmation.':'No booking requests yet.'}</p>:visible.map(r=><article key={r.id} style={{borderTop:'1px solid var(--aw-line)',padding:'14px 0'}}><strong>{r.category==='call'?'Call':'Shoot'} · {r.title}</strong><p>{new Date(r.starts_at).toLocaleString()} — {new Date(r.ends_at).toLocaleTimeString()} · {r.status==='pending'?'Awaiting agency confirmation':r.status}{role==='admin'?` · ${clients.find(c=>c.id===r.client_account_id)?.name??'Client'}`:''}</p>{r.location&&<p>{r.location}</p>}{r.note&&<p>{r.note}</p>}{role==='admin'&&r.status==='pending'&&<div style={{display:'flex',gap:10}}>{[true,false].map(confirm=><Button key={String(confirm)} disabled={busy} variant={confirm?'primary':'secondary'} onClick={async()=>{
      setBusy(true);setError('');try{if(isSupabaseConfigured){if(!actions?.decideCalendarBooking)throw new Error('Booking management unavailable.');await actions.decideCalendarBooking(r.id,confirm);}else{if(confirm){if(!actions?.createEvent)throw new Error('Calendar preview unavailable.');const start=new Date(r.starts_at),end=new Date(r.ends_at);const date=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;await actions.createEvent({title:r.title,type:r.category,clientId:r.client_account_id,date:date(start),endDate:date(end),start:start.toTimeString().slice(0,5),end:end.toTimeString().slice(0,5),allDay:false,color:null,assigneeUserIds:[],location:r.location,description:r.note,workScope:'client',visibility:'client'});}localStorage.setItem(sampleKey,JSON.stringify(sampleRequests().map(item=>item.id===r.id?{...item,status:confirm?'confirmed':'declined'}:item)));}await load();}catch(f){setError(f instanceof Error?f.message:'Could not decide request.');}finally{setBusy(false);}
    }}>{confirm?'Confirm booking':'Decline'}</Button>)}</div>}</article>)}
    <Modal open={open} title="Request a booking" onClose={()=>{if(!busy)setOpen(false);}}><form className="rm-action-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{
      const start=new Date(form.start),end=new Date(form.end);if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start<=new Date()||end<=start)throw new Error('Choose a future time, with the end after the start.');
      const input={clientId:clientId!,category:form.category,title:form.title,startsAt:start.toISOString(),endsAt:end.toISOString(),location:form.location,note:form.note};
      if(isSupabaseConfigured){if(!actions?.requestCalendarBooking)throw new Error('Booking requests unavailable.');await actions.requestCalendarBooking(input);}else{
        const rows=sampleRequests();rows.unshift({id:crypto.randomUUID(),agency_id:'preview',client_account_id:clientId!,requested_by:'preview-client',category:form.category,title:form.title,starts_at:input.startsAt,ends_at:input.endsAt,location:form.location,note:form.note,status:'pending',calendar_event_id:null,created_at:new Date().toISOString()});localStorage.setItem(sampleKey,JSON.stringify(rows));
      }await load();setOpen(false);setForm({title:'',category:'call',start:'',end:'',location:'',note:''});
    }catch(f){setError(f instanceof Error?f.message:'Could not request booking.');}finally{setBusy(false);}}}>
      <p>Your agency will confirm the time. Times use {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
      <label className="rm-field"><span>Category</span><select disabled={busy} value={form.category} onChange={e=>setForm({...form,category:e.target.value as 'call'|'shoot'})}><option value="call">Call</option><option value="shoot">Shoot</option></select></label>
      <label className="rm-field"><span>Title</span><input required maxLength={200} disabled={busy} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
      <label className="rm-field"><span>Starts</span><input required type="datetime-local" disabled={busy} value={form.start} onChange={e=>setForm({...form,start:e.target.value})}/></label>
      <label className="rm-field"><span>Ends</span><input required type="datetime-local" disabled={busy} value={form.end} onChange={e=>setForm({...form,end:e.target.value})}/></label>
      <label className="rm-field"><span>Location or call link</span><input maxLength={500} disabled={busy} value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></label>
      <label className="rm-field"><span>Notes</span><textarea maxLength={4000} disabled={busy} value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></label>{error&&<p role="alert">{error}</p>}
      <footer className="rm-dialog-actions"><Button disabled={busy} variant="secondary" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={busy} type="submit">{busy?'Sending…':'Send request'}</Button></footer>
    </form></Modal>
  </section>;
}
