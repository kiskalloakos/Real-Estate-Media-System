import { supabase } from './supabase';
import { readPageBlocks, type PageDraft, type PageRevision, type ProjectPage } from './project-pages';
import type { Json, ProjectPageRow } from '@/types/database';
const client = () => { if(!supabase) throw new Error('The workspace connection is unavailable.'); return supabase; };
export function projectPageFromRow(row: ProjectPageRow): ProjectPage {
  return {id:row.id,agencyId:row.agency_id,jobId:row.job_id,parentId:row.parent_page_id,title:row.title,kind:row.kind,
    blocks:readPageBlocks(row.blocks),clientVisible:row.client_visible,revision:row.revision,updatedAt:row.updated_at};
}
export async function listProjectPages(agencyId: string) {
  const {data,error}=await client().from('project_pages').select('*').eq('agency_id',agencyId).is('archived_at',null).order('created_at');
  if(error) throw new Error(`Could not load project pages: ${error.message}`);
  return (data??[]).map(projectPageFromRow);
}
export async function saveProjectPage(page: Pick<ProjectPage,'id'|'jobId'|'revision'>, draft: PageDraft) {
  const {data,error}=await client().rpc('save_project_page', {p_page_id:page.id,p_job_id:page.jobId,p_parent_id:draft.parentId,p_title:draft.title,
    p_blocks:draft.blocks as unknown as Json,p_client_visible:draft.clientVisible,p_expected_revision:page.revision,p_kind:draft.kind}).single();
  if(error) throw new Error(error.message);
  return projectPageFromRow(data);
}
export async function listPageRevisions(pageId: string): Promise<PageRevision[]> {
  const {data,error}=await client().from('project_page_revisions').select('id,revision,title,blocks,created_at').eq('page_id',pageId).order('revision',{ascending:false}).limit(50);
  if(error) throw new Error(`Could not load page history: ${error.message}`);
  return (data??[]).map(r=>({id:r.id,revision:r.revision,title:r.title,blocks:readPageBlocks(r.blocks),createdAt:r.created_at}));
}
