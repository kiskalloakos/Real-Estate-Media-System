const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Exercise the actual shared TypeScript modules without introducing a test runtime.
function load(file, imports = {}) {
  const source = readFileSync(resolve(__dirname, '..', file), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)((id) => {
    if (id in imports) return imports[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, module, module.exports);
  return module.exports;
}

const { calendarColors, calendarColor } = load('src/lib/calendar-colors.ts');

test('legacy and unknown values resolve safely; explicit colors override event type', () => {
  assert.equal(calendarColor(null, 'shoot').id, 'blue');
  assert.equal(calendarColor(undefined, 'deadline').id, 'red');
  assert.equal(calendarColor('unknown', 'review').id, 'purple');
  assert.equal(calendarColor(null, 'internal').id, calendarColor(null, 'meeting').id);
  assert.equal(calendarColor('pink', 'deadline').id, 'pink');
  assert.equal(calendarColor(null, 'unknown').id, 'blue');
});

function luminance(hex) {
  const values = hex.slice(1).match(/../g).map((pair) => {
    const channel = parseInt(pair, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

test('every palette option has readable text on web and iOS', () => {
  for (const option of calendarColors) {
    assert.ok(1.05 / (luminance(option.color) + 0.05) >= 4.5, `${option.label}: white text`);
    assert.ok((luminance(option.background) + 0.05) / (luminance(option.color) + 0.05) >= 4.5, `${option.label}: native text`);
  }
});

test('database constraint accepts exactly the shared palette', () => {
  const sql = readFileSync(resolve(__dirname, '../supabase/migrations/202609040001_calendar_event_colors.sql'), 'utf8');
  const values = [...sql.match(/check \(color in \(([^)]+)\)/)[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(values.sort(), calendarColors.map((option) => option.id).sort());
});

test('saving, rescheduling and resetting colors preserve the persistence contract', async () => {
  const writes = [];
  const query = {
    insert(value) { writes.push(value); return this; },
    update(value) { writes.push(value); return this; },
    select() { return this; }, eq() { return this; }, is() { return this; },
    async single() { return { data: { id: 'event', agency_id: 'agency' }, error: null }; },
  };
  const actions = load('src/lib/portal-action-service.ts', {
    '@/lib/supabase': { supabase: { from(table) { assert.equal(table, 'calendar_events'); return query; } } },
  });
  const event = { title: 'Color test', description: 'Notes', date: '2026-09-04', endDate: '2026-09-06', start: '09:00', end: '10:00', location: 'Studio', type: 'shoot', workScope: 'internal', visibility: 'team' };
  await actions.createCalendarEvent({ ...event, color: 'green' }, { agencyId: 'agency', userId: 'owner' });
  assert.equal(writes.at(-1).color, 'green');
  await actions.updateCalendarEvent({ ...event, eventId: 'event', color: 'green', date: '2026-09-05', allDay: true });
  assert.equal(writes.at(-1).color, 'green');
  assert.equal(writes.at(-1).all_day, true);
  assert.ok(new Date(writes.at(-1).ends_at) > new Date(writes.at(-1).starts_at));
  await actions.updateCalendarEvent({ ...event, eventId: 'event', color: null });
  assert.equal(writes.at(-1).color, null);
  await actions.updateCalendarEvent({ ...event, eventId: 'event' });
  assert.equal(Object.hasOwn(writes.at(-1), 'color'), false, 'older callers must not erase a saved color');
});
