export const pageBlockTypes = ['paragraph','heading1','heading2','bullet','number','check','quote','callout','code','divider','scene','action','character','dialogue'] as const;
export type PageBlockType = typeof pageBlockTypes[number];
export interface PageBlock {
  id: string;
  type: PageBlockType;
  text: string;
  checked?: boolean;
  html?: string;
  folder?: true;
}
export interface ProjectPage {
  id: string; agencyId: string; jobId: string; parentId: string | null;
  title: string; kind: 'document' | 'script'; blocks: PageBlock[];
  clientVisible: boolean; revision: number; updatedAt: string;
}
export interface PageRevision { id: string; revision: number; title: string; blocks: PageBlock[]; createdAt: string }
export type PageDraft = Pick<ProjectPage,'title'|'parentId'|'blocks'|'clientVisible'|'kind'>;
export const blockLabels: Record<PageBlockType,string> = {
  paragraph:'Text',heading1:'Heading 1',heading2:'Heading 2',bullet:'Bullet list',number:'Numbered list',check:'Checklist',quote:'Quote',callout:'Callout',code:'Code',divider:'Divider',scene:'Scene heading',action:'Action',character:'Character',dialogue:'Dialogue',
};
export function newPageId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  // Crypto.randomUUID is unavailable on the HTTP preview opened by phones on the LAN.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const id = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return [id.slice(0, 8), id.slice(8, 12), id.slice(12, 16), id.slice(16, 20), id.slice(20)].join('-');
}
export const newPageBlock = (type: PageBlockType = 'paragraph', text = ''): PageBlock => ({id:newPageId(),type,text});
export const newPageFolder = (): PageBlock => ({ ...newPageBlock(), folder: true });
export const isPageFolder = (page: Pick<ProjectPage, 'blocks'>) =>
  page.blocks.length === 1 && page.blocks[0].folder === true;
export function pageListNumber(blocks: PageBlock[], index: number) {
  let number=1;
  for(let i=index-1;i>=0&&blocks[i].type==='number';i--) number++;
  return number;
}
export function readPageBlocks(value: unknown): PageBlock[] {
  if (!Array.isArray(value)) return [];
  return value.filter((b): b is PageBlock => b && typeof b.id==='string' && typeof b.text==='string' && pageBlockTypes.includes(b.type));
}
export function pageDraft(page: ProjectPage): PageDraft {
  return {title:page.title,parentId:page.parentId,blocks:page.blocks,clientVisible:page.clientVisible,kind:page.kind};
}
export function pageDescendants(pages: ProjectPage[], id: string): Set<string> {
  const ids=new Set([id]); let changed=true;
  while(changed) { changed=false; for(const page of pages) if(page.parentId && ids.has(page.parentId) && !ids.has(page.id)) { ids.add(page.id); changed=true; } }
  return ids;
}
export function pagePath(pages: ProjectPage[], page: ProjectPage): ProjectPage[] {
  const path=[page]; const seen=new Set([page.id]); let parent=pages.find(p=>p.id===page.parentId);
  while(parent && !seen.has(parent.id)) { path.unshift(parent); seen.add(parent.id); parent=pages.find(p=>p.id===parent?.parentId); }
  return path;
}
export function pageText(draft: PageDraft) {
  return [draft.title,'',...draft.blocks.map(b=>b.type==='divider'?'---':b.type==='check'?`[${b.checked?'x':' '}] ${b.text}`:b.text)].join('\n\n');
}
