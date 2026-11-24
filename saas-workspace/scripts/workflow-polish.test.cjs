const assert=require('node:assert/strict');const {test}=require('node:test');const {readFileSync}=require('node:fs');const {resolve}=require('node:path');const ts=require('typescript');
const compiled={exports:{}};new Function('module','exports',ts.transpileModule(readFileSync(resolve(__dirname,'../src/lib/portal-workspace-data.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(compiled,compiled.exports);
const {clientMemberWorkspaceData,teamMemberWorkspaceData}=compiled.exports;
const property=(id,clientId,assigned=[])=>({id,clientId,name:'Same property name',assignedTeamUserIds:assigned});
const data={clients:[{id:'a'},{id:'b'}],properties:[property('pa','a',['editor']),property('pb','b')],jobs:[{id:'ja',clientId:'a',ownerUserId:'editor'},{id:'jb',clientId:'b'}],
 calendarEvents:[{id:'own-call',clientId:'a',visibility:'client',type:'call'},{id:'team-note',clientId:'a',visibility:'team'},{id:'foreign',clientId:'b',visibility:'client'},{id:'private',clientId:'a',visibility:'admin_only'}],
 reviews:[{id:'own',clientId:'a',jobId:'ja',clientVisible:true},{id:'private',clientId:'a',clientVisible:false},{id:'foreign',clientId:'b',clientVisible:true},{id:'legacy',propertyId:'pa',clientVisible:true},{id:'same-name',propertyName:'Same property name',clientVisible:true},{id:'creator',createdByUserId:'editor',clientVisible:false}],
 tasks:[{id:'shared',clientId:'a',visibility:'client'},{id:'team',clientId:'a',visibility:'team'},{id:'foreign',clientId:'b',visibility:'client'},{id:'assigned',jobId:'ja',assigneeUserId:'editor',visibility:'team'},{id:'secret',assigneeUserId:'editor',visibility:'admin_only'}],
 costs:[{id:'private-cost'}],companyDocuments:[{id:'private-doc'}],notes:[{id:'other-note',visibility:'client'}]};
test('a client preview contains only their explicitly shared records, never a same-named property or team-only work',()=>{
 const result=clientMemberWorkspaceData(data,{clientAccountId:'a'});
 assert.deepEqual(result.calendarEvents.map(e=>e.id),['own-call']);assert.deepEqual(result.reviews.map(r=>r.id),['own','legacy']);assert.deepEqual(result.tasks.map(t=>t.id),['shared']);
 assert.deepEqual(result.jobs.map(j=>j.id),['ja']);assert.deepEqual(result.costs,[]);assert.deepEqual(result.companyDocuments,[]);assert.deepEqual(result.notes,[]);
});
test('an empty client account stays empty instead of inheriting another client’s data',()=>{
 const result=clientMemberWorkspaceData(data,{clientAccountId:'unknown'});for(const key of ['clients','properties','jobs','calendarEvents','reviews','tasks'])assert.deepEqual(result[key],[]);
});
test('team review access follows existing creator, project owner and assigned-property context',()=>{
 const result=teamMemberWorkspaceData(data,{userId:'editor'});
 assert.deepEqual(result.reviews.map(r=>r.id),['own','legacy','creator']);assert.deepEqual(result.tasks.map(t=>t.id),['assigned']);
 assert.deepEqual(result.calendarEvents.map(e=>e.id),['team-note']);assert.deepEqual(result.properties.map(p=>p.id),['pa']);
});
test('scoping leaves the original records intact for the agency owner',()=>{
 const original=JSON.stringify(data);clientMemberWorkspaceData(data,{clientAccountId:'a'});teamMemberWorkspaceData(data,{userId:'editor'});
 assert.equal(JSON.stringify(data),original);assert.equal(teamMemberWorkspaceData(data,undefined),data);
});
