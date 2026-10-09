const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const source = readFileSync(resolve(__dirname, '../src/lib/calendar-event-index.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const compiled = { exports: {} };
new Function('module', 'exports', outputText)(compiled, compiled.exports);
const { indexCalendarEvents } = compiled.exports;
const event = (id, date, extra = {}) => ({id, date, start:'10:00', title:id, ...extra});
const days = ['2026-10-24','2026-10-25','2026-10-26'].map(date => ({date}));
test('clips cross-month events and includes every day across the DST change', () => {
 const long = event('long', '2026-09-01', {endDate:'2026-11-30',allDay:true});
 const result = indexCalendarEvents(days, [long, event('outside','2026-11-01'), event('ends','2026-10-23',{endDate:'2026-10-24'})]);
 assert.deepEqual(result.get('2026-10-24').map(e=>e.id), ['long','ends']);
 assert.deepEqual(result.get('2026-10-25').map(e=>e.id), ['long']);
 assert.deepEqual(result.get('2026-10-26').map(e=>e.id), ['long']);
 assert.equal(result.size,3);
});
test('orders all-day events first, then time and title without changing source order', () => {
 const input = [event('late',days[0].date,{start:'15:00'}),event('B',days[0].date),event('A',days[0].date),event('all',days[0].date,{allDay:true})];
 const result = indexCalendarEvents(days,input);
 assert.deepEqual(result.get(days[0].date).map(e=>e.id), ['all','A','B','late']);
 assert.equal(input[0].id,'late');
 assert.equal(result.get(days[1].date).length,0);
});
test('keeps all busy-day events available for overflow and handles an empty period', () => {
 const input = Array.from({length:20},(_,i)=>event(String(i),days[0].date));
 assert.equal(indexCalendarEvents(days,input).get(days[0].date).length,20);
 assert.equal(indexCalendarEvents([],input).size,0);
});
