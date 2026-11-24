import { useMemo } from 'react';
import { useBrowserPersistedState } from './use-browser-persisted-state';
import type { PortalRole } from '@/components/web';
import { reviewSelectionError, reviewVersions, reviewVersionStatus } from '@/lib/review-workspace';
import type { PortalActionHandlers, ReviewItem, ReviewVersion } from '@/screens/web/types';

const initial: ReviewItem[] = ['Hero image','Social cover','Website image'].map((title,index) => {
  const version: ReviewVersion = { id:`preview-review-version-${index}`,number:1,fileUrl:'/realty-media-brandmark-black.png',filename:'brandmark.png',mimeType:'image/png',createdAt:'2026-11-24T10:00:00Z',comments:[],decisions:[] };
  return { id:`preview-review-${index}`,jobId:index===2?'preview-website':'preview-social',clientId:'client-cabana',clientVisible:true,
    assignee:'Alex Morgan',clientName:'Cabana The One',comments:[],dueLabel:'Open review',kind:'image',propertyName:index===2?'Cabana The One website':'Cabana The One social media',
    title,status:'in_review',version:'v1',currentVersionId:version.id,versions:[version],fileUrl:version.fileUrl,mimeType:version.mimeType };
});
function sampleFile(file: File) {
  if (file.size>2*1024*1024) throw new Error('Use a file under 2 MB in this local sample preview.');
  return new Promise<string>((resolve,reject) => { const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result)); reader.onerror=()=>reject(new Error('Could not read the sample file.')); reader.readAsDataURL(file); });
}
export function useReviewPreview(enabled: boolean, role: PortalRole) {
  const [state,setState]=useBrowserPersistedState<ReviewItem[]>('rm:review-preview:v1',initial);
  const actorId=role==='client'?'preview-client':'preview-producer';
  const actor=role==='client'?'Andrei Pop':'Alex Morgan';
  const requirePreview=()=>{ if(!enabled) throw new Error('Sample review actions are unavailable in a live workspace.'); };
  const requireManager=()=>{ requirePreview(); if(role==='client') throw new Error('Only the agency can upload or manage review files.'); };
  const actions: Pick<PortalActionHandlers,'reviewComment'|'reviewDecision'|'resolveReviewComment'|'uploadReviewVersion'|'uploadDeliverable'|'updateDeliverable'|'archiveDeliverable'>={
    reviewComment: async input => {
      requirePreview(); const review=state.find(item=>item.id===input.mediaAssetId); const version=review && reviewVersions(review).find(item=>item.id===input.versionId);
      if(!version || (role==='client' && review?.clientVisible===false)) throw new Error('This review version is unavailable.');
      const parent=version.comments.find(item=>item.id===input.parentId);
      if(input.parentId && (!parent || parent.visibility!==input.visibility)) throw new Error('Reply in the same version and conversation visibility.');
      if(role==='client' && input.visibility==='internal') throw new Error('Internal notes are for the agency.');
      const comment={id:crypto.randomUUID(),versionId:version.id,parentId:input.parentId,authorId:actorId,author:actor,body:input.body,timestamp:input.timestamp,visibility:input.visibility,resolved:false,createdAt:new Date().toISOString()};
      setState(current=>current.map(item=>item.id===input.mediaAssetId?{...item,versions:reviewVersions(item).map(v=>v.id===input.versionId?{...v,comments:[...v.comments,comment]}:v)}:item));
    },
    reviewDecision: async input => {
      requirePreview(); const error=reviewSelectionError(state,input.targets); if(error) throw new Error(error);
      const batchId=input.targets.length>1?crypto.randomUUID():undefined;
      if(input.targets.some(target=>role==='client' && state.find(item=>item.id===target.assetId)?.clientVisible===false)) throw new Error('This review is unavailable.');
      if(role==='client' && input.decision==='approval_revoked') throw new Error('Only the agency can reopen approval.');
      setState(current=>current.map(item=>{ const target=input.targets.find(target=>target.assetId===item.id); return !target?item:{...item,status:input.decision==='approved'?'approved':input.decision==='changes_requested'?'needs_changes':'in_review',versions:reviewVersions(item).map(version=>version.id===target.versionId?{...version,decisions:[{id:crypto.randomUUID(),decision:input.decision,actor,createdAt:new Date().toISOString(),note:input.note,batchId},...version.decisions]}:version)}; }));
    },
    resolveReviewComment: async (id,resolved)=>{
      requirePreview(); const comment=state.flatMap(item=>reviewVersions(item)).flatMap(version=>version.comments).find(item=>item.id===id);
      if(!comment || (role==='client' && comment.authorId!==actorId)) throw new Error('You cannot resolve this comment.');
      setState(current=>current.map(item=>({...item,versions:reviewVersions(item).map(version=>({...version,comments:version.comments.map(comment=>comment.id===id?{...comment,resolved}:comment)}))})));
    },
    uploadReviewVersion: async input=>{
      requireManager(); const fileUrl=await sampleFile(input.file); const review=state.find(item=>item.id===input.mediaAssetId); if(!review) throw new Error('Review unavailable.');
      const version:ReviewVersion={id:crypto.randomUUID(),number:(reviewVersions(review)[0]?.number??0)+1,fileUrl,mimeType:input.file.type,filename:input.file.name,contentHtml:input.contentHtml,createdAt:new Date().toISOString(),comments:[],decisions:[]};
      setState(current=>current.map(item=>item.id===review.id?{...item,status:'in_review',currentVersionId:version.id,version:`v${version.number}`,fileUrl,mimeType:version.mimeType,versions:[version,...reviewVersions(item)]}:item));
    },
    uploadDeliverable: async input=>{
      requireManager(); if(!input.file) throw new Error('Choose a sample file.'); const fileUrl=await sampleFile(input.file);
      const version:ReviewVersion={id:crypto.randomUUID(),number:1,fileUrl,mimeType:input.file.type,filename:input.file.name,createdAt:new Date().toISOString(),comments:[],decisions:[]};
      const item:ReviewItem={id:crypto.randomUUID(),jobId:input.jobId,propertyId:input.propertyId,clientId:input.jobId==='preview-internal'?undefined:'client-cabana',clientVisible:input.jobId==='preview-internal'?false:input.clientVisible??true,
        title:input.title,kind:input.kind,clientName:'Cabana The One',assignee:actor,propertyName:input.jobId==='preview-internal'?'Agency brand refresh':'Cabana The One social media',status:'in_review',comments:[],versions:[version],currentVersionId:version.id,version:'v1',fileUrl,mimeType:version.mimeType,dueLabel:'Open review'};
      setState(current=>[...current,item]);
    },
    updateDeliverable: async input=>{ requireManager(); setState(current=>current.map(item=>item.id===input.mediaAssetId?{...item,title:input.title,clientVisible:input.clientVisible}:item)); },
    archiveDeliverable: async id=>{ requireManager(); setState(current=>current.filter(item=>item.id!==id)); },
  };
  const reviews=useMemo(()=>enabled?state.filter(item=>role!=='client'||(item.clientId==='client-cabana'&&item.clientVisible!==false)).map(item=>{
    const versions=reviewVersions(item).map(version=>({...version,comments:version.comments.filter(comment=>role!=='client'||comment.visibility!=='internal')}));
    const latest=versions[0]; return {...item,versions,comments:latest?.comments??[],status:latest?reviewVersionStatus(item,latest):item.status};
  }):undefined,[enabled,state,role]);
  return { reviews,actions,currentUserId:actorId };
}
