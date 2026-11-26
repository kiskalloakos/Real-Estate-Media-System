const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');const {resolve}=require('node:path');const {test}=require('node:test');const ts=require('typescript');
const source=readFileSync(resolve(__dirname,'../src/lib/project-pages.ts'),'utf8');
const moduleUnderTest={exports:{}};
new Function('module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(moduleUnderTest,moduleUnderTest.exports);
const rules=moduleUnderTest.exports;
const pages=[{id:'brief',parentId:null,title:'Brief'},{id:'concept',parentId:'brief',title:'Concept'},{id:'script',parentId:'concept',title:'Script'},{id:'other',parentId:null,title:'Other'}];
test('nested page moves exclude every descendant and keep unrelated pages available',()=>{
 assert.deepEqual([...rules.pageDescendants(pages,'brief')],['brief','concept','script']);
 assert.deepEqual(rules.pagePath(pages,pages[2]).map(p=>p.title),['Brief','Concept','Script']);
});
test('client breadcrumbs cannot expose a parent missing from the permitted page set',()=>{
 assert.deepEqual(rules.pagePath([pages[2]],pages[2]).map(p=>p.title),['Script']);
});
test('plain text export preserves script text and checklist states without HTML execution',()=>{
 const blocks=[{id:'one',type:'scene',text:'INT. CABIN — DAY'},{id:'two',type:'check',text:'Confirm location',checked:true},{id:'three',type:'paragraph',text:'<script>literal text</script>'}];
 assert.match(rules.pageText({title:'Shoot',blocks}),/INT\. CABIN — DAY/);
 assert.match(rules.pageText({title:'Shoot',blocks}),/\[x\] Confirm location/);
 assert.equal(rules.readPageBlocks([...blocks,{id:'bad',type:'html',text:'hidden'}]).length,3);
});
test('page saves request a singular RPC response and preserve failure details for draft recovery',async()=>{
 const {createClient}=require('@supabase/supabase-js');let responseError=false;let request;
 const row={id:'page',agency_id:'agency',job_id:'project',parent_page_id:null,title:'Brief',kind:'document',blocks:[],client_visible:false,revision:2,updated_at:'2026-11-24'};
 const supabase=createClient('https://example.invalid','test-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,options)=>{
   request={url,headers:new Headers(options.headers),body:JSON.parse(options.body)};
   return new Response(JSON.stringify(responseError?{message:'PAGE_CONFLICT: Your draft has been kept',code:'P0001'}:row),{status:responseError?400:200,headers:{'content-type':'application/json'}});
 }}});
 const serviceModule={exports:{}};const serviceSource=readFileSync(resolve(__dirname,'../src/lib/project-pages-service.ts'),'utf8');
 new Function('module','exports','require',ts.transpileModule(serviceSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(serviceModule,serviceModule.exports,name=>name==='./supabase'?{supabase}:name==='./project-pages'?rules:{});
 const draft={title:'Brief',parentId:null,blocks:[],clientVisible:false,kind:'document'};
 const result=await serviceModule.exports.saveProjectPage({id:'page',jobId:'project',revision:1},draft);
 assert.equal(result.revision,2);assert.equal(request.headers.get('accept'),'application/vnd.pgrst.object+json');
 assert.equal(request.body.p_expected_revision,1);assert.equal(request.body.p_client_visible,false);
 responseError=true;
 await assert.rejects(()=>serviceModule.exports.saveProjectPage({id:'page',jobId:'project',revision:1},draft),/PAGE_CONFLICT/);
});

test('numbered lists restart after headings and other block types',()=>{
 const blocks=[{type:'heading1'},{type:'number'},{type:'number'},{type:'paragraph'},{type:'number'}];
 assert.equal(rules.pageListNumber(blocks,1),1);assert.equal(rules.pageListNumber(blocks,2),2);assert.equal(rules.pageListNumber(blocks,4),1);
});

test('folder markers and rich text remain compatible with existing page records', () => {
 const folder = rules.newPageFolder();
 const rich = { id:'rich', type:'paragraph', text:'Project notes', html:'<h2>Project notes</h2>' };
 const [storedFolder, storedText] = rules.readPageBlocks(JSON.parse(JSON.stringify([folder, rich])));
 assert.equal(rules.isPageFolder({blocks:[storedFolder]}), true);
 assert.equal(rules.isPageFolder({blocks:[storedText]}), false);
 assert.equal(storedText.html, rich.html);
 assert.equal(rules.pageText({title:'Brief',blocks:[storedText]}), 'Brief\n\n\n\nProject notes');
});
