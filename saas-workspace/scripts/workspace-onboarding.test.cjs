const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

function load(path, dependencies = {}) {
  const { outputText } = ts.transpileModule(readFileSync(resolve(__dirname, '../src', path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const compiled = { exports: {} };
  new Function('module', 'exports', 'require', outputText)(compiled, compiled.exports, name => dependencies[name]);
  return compiled.exports;
}
const modules = load('workspace/modules.ts');
const settings = load('workspace/agency-settings.ts', { './modules': modules });
const agency = (extra = {}) => ({ id: 'agency-a', created_by: 'owner-a', name: 'North Studio', settings: {}, updated_at: '2026-11-24T09:00:00Z', ...extra });

test('only newly registered owners are automatically onboarded in their own agency', () => {
  assert.equal(settings.shouldOnboardAgency(agency(), 'owner-a', 'admin', true), true);
  for (const [row, user, role, requested] of [
    [agency(), 'owner-a', 'admin', false], // Existing agency: no forced setup.
    [agency(), 'owner-b', 'admin', true], // Another agency or invited admin.
    [agency(), 'owner-a', 'team_member', true],
    [agency(), 'owner-a', 'client', true],
    [null, 'owner-a', 'admin', true], // Not hydrated: no decision from empty data.
    [agency({ settings: { workspace: { onboarding: { completedAt: '2026-11-24T10:00:00Z' } } } }), 'owner-a', 'admin', true],
  ]) assert.equal(settings.shouldOnboardAgency(row, user, role, requested), false);
});

test('saved progress and preset resume independently of browser preferences', () => {
  const saved = settings.workspaceSettings({ workspace: {
    enabledModules: ['tasks', 'calendar', 'tasks', 'not-a-module'],
    onboarding: { step: 2, preset: 'essentials', checklistDismissed: true },
  } });
  assert.deepEqual(saved.enabled, ['tasks', 'calendar']);
  assert.equal(saved.onboarding.step, 2);
  assert.equal(saved.onboarding.preset, 'essentials');
  assert.equal(saved.onboarding.checklistDismissed, true);
  assert.equal(saved.onboarding.completedAt, null);
  assert.deepEqual(settings.workspaceSettings({ workspace: { enabledModules: [] } }).enabled, []);
  assert.equal(settings.workspaceSettings({}).enabled, undefined);
});

test('malformed legacy preferences fall back safely', () => {
  for (const value of [null, [], 'old-value', { workspace: [] }, { workspace: { onboarding: { preset: 'toString', step: 99 } } }]) {
    const result = settings.workspaceSettings(value);
    assert.equal(result.onboarding.step, 1);
    assert.equal(result.onboarding.preset, 'production');
  }
  const name = 'Studio '.repeat(16).trim();
  assert.equal(modules.normalizeConfig({ name }).name, name);
  assert.equal(modules.defaultConfig.name, 'Your workspace');
});

test('settings edits preserve onboarding, module choices, workflow settings, and future keys', () => {
  const original = {
    notificationWording: { reviewReady: 'Ready' }, servicePackages: [{ name: 'Launch' }],
    workspace: { enabledModules: ['tasks'], futureOption: true, onboarding: { step: 2, preset: 'content', completedAt: 'done' } },
  };
  const edited = settings.mergeAgencySettings(original, { notificationWording: { reviewReady: 'Please review' } });
  const dismissed = settings.mergeAgencySettings(edited, { workspace: { onboarding: { checklistDismissed: true } } });
  const toggled = settings.mergeAgencySettings(dismissed, settings.enabledModulesPatch(['tasks', 'clients']).settings);
  assert.deepEqual(original.workspace.enabledModules, ['tasks']);
  assert.deepEqual(toggled.servicePackages, original.servicePackages);
  assert.equal(toggled.notificationWording.reviewReady, 'Please review');
  assert.equal(toggled.workspace.futureOption, true);
  assert.deepEqual(toggled.workspace.enabledModules, ['tasks', 'clients']);
  assert.deepEqual(toggled.workspace.onboarding, { step: 2, preset: 'content', completedAt: 'done', checklistDismissed: true });
});

function clientFixture({ readError = null, writeError = null } = {}) {
  const row = agency({ settings: { unrelated: 'keep', workspace: { onboarding: { step: 2 } } } });
  const calls = [];
  const client = { from(table) {
    assert.equal(table, 'agencies');
    let patch;
    const filters = [];
    const query = {
      select() { return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      update(value) { patch = value; return query; },
      async single() {
        calls.push({ patch, filters });
        return { data: patch ? { ...row, ...patch } : row, error: patch ? writeError : readError };
      },
    };
    return query;
  } };
  return { client, calls };
}
const service = client => load('workspace/agency-service.ts', {
  '@/lib/supabase': { supabase: client }, './agency-settings': settings,
});

test('save reads current server settings and guards agency ID and concurrent updates', async () => {
  const fixture = clientFixture();
  const result = await service(fixture.client).saveWorkspaceAgency('agency-a', {
    name: 'North Studio Updated', settings: { workspace: { onboarding: { completedAt: 'done' } } },
  });
  assert.equal(result.name, 'North Studio Updated');
  assert.equal(result.settings.unrelated, 'keep');
  assert.deepEqual(result.settings.workspace.onboarding, { step: 2, completedAt: 'done' });
  assert.deepEqual(fixture.calls[1].filters, [['id', 'agency-a'], ['updated_at', '2026-11-24T09:00:00Z']]);
});

test('a failed read or save never reports completion, and the same draft can be retried', async () => {
  const failedRead = clientFixture({ readError: { message: 'offline' } });
  await assert.rejects(service(failedRead.client).saveWorkspaceAgency('agency-a', { name: 'Draft' }), /Could not load/);
  assert.equal(failedRead.calls.length, 1);
  const failedWrite = clientFixture({ writeError: { message: 'conflict' } });
  const patch = { settings: { workspace: { onboarding: { completedAt: 'done' } } } };
  await assert.rejects(service(failedWrite.client).saveWorkspaceAgency('agency-a', patch), /Could not save/);
  assert.equal(patch.settings.workspace.onboarding.completedAt, 'done');
  const result = await service(clientFixture().client).saveWorkspaceAgency('agency-a', patch);
  assert.equal(result.settings.workspace.onboarding.completedAt, 'done');
});

test('invalid logos are rejected before reaching storage', async () => {
  const api = service({});
  await assert.rejects(api.uploadAgencyLogo('agency-a', { type: 'text/html', size: 100 }), /PNG, JPG, or WebP/);
  await assert.rejects(api.uploadAgencyLogo('agency-a', { type: 'image/png', size: 6 * 1024 * 1024 }), /smaller than 5 MB/);
});

test('registration requests onboarding while preserving required email confirmation', async () => {
  let request;
  const signup = load('lib/agency-signup.ts', {
    '@/lib/supabase': { supabase: { auth: { async signUp(input) { request = input; return { data: { session: null }, error: null }; } } } },
    '@/lib/agency-signup-validation': { normalizeAgencySignup: value => value },
  });
  const result = await signup.signUpAgencyOwner({ agencyName: 'North Studio', fullName: 'Alex Owner', email: 'alex@example.invalid', password: 'test-password' });
  assert.equal(request.options.data.workspace_onboarding_version, 1);
  assert.equal(request.options.data.signup_role, 'agency_owner');
  assert.equal(request.options.data.agency_name, 'North Studio');
  assert.equal(result.needsEmailConfirmation, true);
});
