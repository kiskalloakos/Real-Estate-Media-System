const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const source = readFileSync(resolve(__dirname, '../src/lib/', file), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const compiled = { exports: {} };
  new Function('module', 'exports', 'require', outputText)(compiled, compiled.exports, name => dependencies[name]);
  return compiled.exports;
}
const tasks = load('task-workspace.ts');
const navigation = load('portal-location.ts', { './task-workspace': tasks });
const task = (extra = {}) => ({ id:'one', title:'Photo selects', description:'Review sunrise shots', status:'todo', priority:'normal', assigneeUserId:'alice', assigneeName:'Alice', clientName:'Chalet', propertyName:'Mountain cabin', createdAt:'2026-10-01', visibility:'team', ...extra });
test('saved views exclude closed tasks from deadlines and handle missing identity', () => {
 const now = new Date(2026,9,31,12);
 const old = task({ dueAt:new Date(2026,9,30,17).toISOString() });
 assert.equal(tasks.matchesTaskView(old,'overdue','alice',now),true);
 for (const status of ['done','cancelled']) assert.equal(tasks.matchesTaskView({...old,status},'overdue','alice',now),false);
 assert.equal(tasks.matchesTaskView(old,'mine',undefined,now),false);
 assert.equal(tasks.matchesTaskView(old,'mine','alice',now),true);
 assert.equal(tasks.matchesTaskView(old,'blocked','alice',now),false);
 assert.equal(tasks.matchesTaskView({...old,status:'blocked'},'blocked','alice',now),true);
});
test('this week uses local Monday–Sunday boundaries across DST', () => {
 const now = new Date(2026,9,24,12);
 for (const [date, expected] of [[18,false],[19,true],[23,true],[24,true],[25,true],[26,false]]) {
  assert.equal(tasks.matchesTaskView(task({dueAt:new Date(2026,9,date,17).toISOString()}),'week',undefined,now),expected);
 }
 assert.equal(tasks.matchesTaskView(task(),'week',undefined,now),false);
});
test('search combines words across record context and description, ignoring case and extra space', () => {
 assert.equal(tasks.matchesTaskSearch(task(),' CHALEt   Sunrise '),true);
 assert.equal(tasks.matchesTaskSearch(task(),'Alice mountain'),true);
 assert.equal(tasks.matchesTaskSearch(task(),'missing'),false);
 assert.equal(tasks.taskContext(task({clientName:'Chalet',propertyName:'Chalet'})),'Chalet');
 assert.equal(tasks.taskContext(task({clientName:'',propertyName:''})),'Internal work');
});
test('attention prioritizes overdue then blocked then urgency without mutating source', () => {
 const input=[task({id:'normal'}),task({id:'urgent',priority:'urgent'}),task({id:'blocked',status:'blocked'}),task({id:'late',dueAt:'2026-01-01'}),task({id:'closed',status:'done',dueAt:'2026-01-01'})];
 assert.deepEqual(tasks.attentionTasks(input,new Date(2026,9,31)).map(item=>item.id),['late','blocked','urgent','normal']);
 assert.equal(input[0].id,'normal');
});
test('quick edits preserve task metadata and round-trip local deadlines', () => {
 const original=task({dueAt:new Date(2026,9,25,17,30).toISOString(),clientId:'client',propertyId:'property',priority:'high'});
 const input=tasks.taskUpdateInput(original);
 assert.equal(input.dueDate,'2026-10-25'); assert.equal(input.dueTime,'17:30');
 assert.equal(input.propertyId,'property'); assert.equal(input.description,original.description); assert.equal(input.priority,'high');
 assert.equal(tasks.taskUpdateInput(task()).dueDate,'');
});
test('record URLs round-trip safely, retain integration parameters, and enforce screen permissions', () => {
 const route={screen:'tasks',taskId:'task/a b',taskView:'overdue',taskQuery:'photo & cabin',taskAssignee:'alice'};
 const path=navigation.portalLocationUrl('http://localhost/?instagram=connected&screen=clients&client=old',route);
 const params=new URL(path,'http://localhost').searchParams;
 assert.equal(params.get('instagram'),'connected'); assert.equal(params.has('client'),false);
 assert.deepEqual(navigation.readPortalLocation(params.toString(),'dashboard',['dashboard','tasks']),route);
 assert.equal(navigation.readPortalLocation('?screen=finances&task=secret','dashboard',['dashboard','tasks']).screen,'dashboard');
 assert.equal(navigation.readPortalLocation('?screen=tasks&view=invalid','dashboard',['tasks']).taskView,'all');
 assert.deepEqual(navigation.readPortalLocation('?screen=clients&client=client-a','dashboard',['clients']),{screen:'clients',clientId:'client-a'});
});
