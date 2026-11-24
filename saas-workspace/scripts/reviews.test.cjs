const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {test}=require('node:test');
const ts=require('typescript');
function load(file,dependencies={}) {
 const source=readFileSync(resolve(__dirname,'../src/lib',file),'utf8');
 const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const module={exports:{}};new Function('module','exports','require',outputText)(module,module.exports,name=>dependencies[name]);return module.exports;
}
const rules=load('review-workspace.ts');
const version=(id,number,extra={})=>({id,number,createdAt:'2026-11-24',comments:[],decisions:[],...extra});
const review=(extra={})=>({id:'reel',jobId:'social',version:'v2',status:'in_review',comments:[],versions:[version('v2',2),version('v1',1,{comments:[{id:'c1',body:'V1 only'}],decisions:[{id:'a1',decision:'approved',createdAt:'2026-11-23'}]})],...extra});
test('version selection pins the displayed revision and keeps old feedback and approval in history',()=>{
 const item=review();const old=rules.reviewVersion(item,'v1');
 assert.equal(old.id,'v1');assert.equal(old.comments[0].body,'V1 only');
 assert.equal(rules.reviewVersionStatus(item,old),'approved');
 assert.equal(rules.reviewVersionStatus(item,rules.reviewVersion(item)),'in_review');
 assert.equal(rules.reviewVersion(item).comments.length,0);
 assert.equal(rules.reviewVersions(review({versions:[version('v1',1),version('v3',3),version('v2',2)]}))[0].id,'v3');
});
test('batch selection is a version snapshot and fails when one file changes or disappears',()=>{
 const selected=[{assetId:'reel',versionId:'v2'}];
 assert.equal(rules.reviewSelectionError([review()],selected),'');
 assert.match(rules.reviewSelectionError([review({versions:[version('v3',3),version('v2',2)]})],selected),/changed/);
 assert.match(rules.reviewSelectionError([],selected),/changed/);
 assert.match(rules.reviewSelectionError([review({versions:[]})],selected),/changed/);
});
test('a batch stays in one engagement and can span its optional locations',()=>{
 const a=review({id:'a',propertyId:'one'}),b=review({id:'b',propertyId:'two'});
 const targets=[{assetId:'a',versionId:'v2'},{assetId:'b',versionId:'v2'}];
 assert.equal(rules.reviewSelectionError([a,b],targets),'');
 assert.match(rules.reviewSelectionError([a,{...b,jobId:'website'}],targets),/one project/);
 assert.match(rules.reviewSelectionError([{...a,jobId:undefined},{...b,jobId:undefined}],targets),/one project/);
});
test('comments and decisions send the displayed version instead of looking up latest',async()=>{
 const writes=[];const supabase={from:table=>({insert:async row=>{writes.push({table,row});return {error:null};}}),rpc:async(name,args)=>{writes.push({name,args});return {error:null};}};
 const service=load('portal-action-service.ts',{'@/lib/supabase':{supabase}});
 await service.addReviewComment({mediaAssetId:'reel',versionId:'v1',body:'Old cut note',timestamp:'0:18',visibility:'client'},{agencyId:'agency',userId:'client'});
 assert.equal(writes[0].row.media_version_id,'v1');assert.equal(writes[0].row.timestamp_seconds,18);
 const input={targets:[{assetId:'reel',versionId:'v2'},{assetId:'cover',versionId:'cover-v1'}],decision:'approved'};
 await service.recordReviewDecision(input,{agencyId:'agency',userId:'client'});
 assert.equal(writes[1].name,'decide_review_versions');assert.deepEqual(writes[1].args.p_targets,input.targets);
});
test('failed revision registration cleans up only its new upload and preserves existing versions',async()=>{
 const uploaded=[],removed=[];
 const query={select(){return this},eq(){return this},is(){return this},single:async()=>({data:{id:'reel',agency_id:'agency',client_account_id:'client',property_id:null,job_id:'social'},error:null})};
 const supabase={from:table=>table==='media_assets'?query:{insert:async()=>({error:{message:'Version registration failed'}})},storage:{from:()=>({upload:async path=>{uploaded.push(path);return {error:null};},remove:async paths=>{removed.push(...paths);return {error:null};}})}};
 const service=load('portal-action-service.ts',{'@/lib/supabase':{supabase}});
 await assert.rejects(()=>service.uploadReviewVersion({mediaAssetId:'reel',file:new File(['new'],'revision.png',{type:'image/png'})},{agencyId:'agency',userId:'owner'}),/register this revision/);
 assert.equal(uploaded.length,1);assert.deepEqual(removed,uploaded);assert.match(uploaded[0],/^agency\/client\/social\/reel\//);
});
test('backend release history preserves PostgreSQL dollar quoting exactly',async()=>{
 const {buildMigrationRelease}=await import('./build-migration-release.mjs');
 const source="begin;\ncreate function example() returns text language sql as $$select '$&'::text$$;\ncommit;\n";
 const sql=buildMigrationRelease('202611240003_versioned_reviews.sql',source);
 const stored=sql.split('$codex_migration_source$')[1];
 assert.equal(stored,source);assert.match(sql,/ARRAY\[\$codex_migration_source\$/);
});
test('new review uploads allocate an ID before insertion without an RLS-blocked RETURNING read',async()=>{
 const inserted=[],paths=[];
 const contextQuery={select(){return this},eq(){return this},is(){return this},single:async()=>({data:{client_account_id:'client'},error:null})};
 const supabase={from:table=>table==='jobs'?contextQuery:{insert:async row=>{inserted.push({table,row});return {error:null};}},storage:{from:()=>({upload:async path=>{paths.push(path);return {error:null};}})}};
 const service=load('portal-action-service.ts',{'@/lib/supabase':{supabase}});
 await service.uploadDeliverable({jobId:'social',title:'Hero reel',kind:'video',file:new File(['video'],'hero.mp4',{type:'video/mp4'})},{agencyId:'agency',userId:'owner'});
 assert.equal(inserted[0].table,'media_assets');assert.match(inserted[0].row.id,/^[0-9a-f-]{36}$/);
 assert.equal(inserted[0].row.client_account_id,'client');assert.equal(inserted[1].row.media_asset_id,inserted[0].row.id);
 assert.ok(paths[0].includes(`/social/${inserted[0].row.id}/`));
});
