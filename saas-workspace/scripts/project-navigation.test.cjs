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
  new Function('module', 'exports', 'require', outputText)(compiled, compiled.exports, name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  });
  return compiled.exports;
}

const workflow = load('lib/project-workspace.ts');
const tasks = load('lib/task-workspace.ts');
const routes = load('lib/portal-location.ts', { './project-workspace': workflow, './task-workspace': tasks });
const modules = load('workspace/modules.ts');
const navigation = load('workspace/navigation.ts', { './modules': modules });
const project = { id: 'project-a', status: 'active' };
const today = '2026-11-24';
const stage = (reviews = [], events = [], property = project) => workflow.projectStage(property, reviews, events, today);

test('stages follow project activity and isolate other projects and script approvals', () => {
  assert.equal(stage(), 'pre-production');
  assert.equal(stage([{ propertyId: 'project-b', kind: 'video', status: 'in_review' }]), 'pre-production');
  assert.equal(stage([{ propertyId: project.id, kind: 'script', status: 'approved' }]), 'pre-production');
  assert.equal(stage([{ propertyId: project.id, kind: 'video', status: 'draft' }]), 'post-production');
  assert.equal(stage([{ propertyId: project.id, kind: 'video', status: 'needs_changes' }]), 'post-production');
  assert.equal(stage([{ propertyId: project.id, kind: 'video', status: 'approved' }]), 'delivery');
  assert.equal(stage([], [], { ...project, status: 'complete' }), 'completed');
  assert.equal(stage([], [], { ...project, status: 'in_review' }), 'post-production');
});

test('shoot boundaries use calendar dates and handle shoots spanning midnight', () => {
  const shoot = { propertyId: project.id, type: 'shoot', date: '2026-11-25' };
  assert.equal(stage([], [shoot]), 'pre-production');
  assert.equal(stage([], [{ ...shoot, date: today }]), 'production');
  assert.equal(stage([], [{ ...shoot, date: '2026-11-23', endDate: today }]), 'production');
  assert.equal(stage([], [{ ...shoot, date: '2026-11-23' }]), 'post-production');
  assert.equal(stage([], [{ ...shoot, propertyId: 'project-b', date: today }]), 'pre-production');
});

test('project deep links round-trip selection, stage, and tab while preserving unrelated URL state', () => {
  const location = { screen: 'projects', projectId: project.id, clientId: 'client-a', projectStage: 'pre-production', projectSection: 'Scripts' };
  const url = routes.portalLocationUrl('https://app.realtymedia.ro/?screen=tasks&task=task-a&q=old&setup=1#anchor', location);
  const parsed = new URL(url, 'https://app.realtymedia.ro');
  assert.deepEqual(routes.readPortalLocation(parsed.search, 'dashboard', ['dashboard', 'projects']), location);
  assert.equal(parsed.searchParams.has('task'), false);
  assert.equal(parsed.searchParams.has('q'), false);
  assert.equal(parsed.searchParams.get('setup'), '1');
  assert.equal(parsed.hash, '#anchor');
});

test('invalid project tabs and stages are ignored and restricted roles cannot enter Projects', () => {
  const query = '?screen=projects&project=project-a&stage=invalid&section=invalid';
  const result = routes.readPortalLocation(query, 'dashboard', ['dashboard', 'projects']);
  assert.equal(result.projectStage, undefined);
  assert.equal(result.projectSection, undefined);
  assert.deepEqual(routes.readPortalLocation(query, 'dashboard', ['dashboard', 'reviews']), { screen: 'dashboard' });
  const url = routes.portalLocationUrl(`https://app.realtymedia.ro/${query}`, { screen: 'calendar' });
  assert.equal(url, '/?screen=calendar');
});

test('enabled pages remain searchable once each and Projects follows the client module', () => {
  const config = { ...modules.defaultConfig, enabled: modules.modules.map(module => module.id) };
  const pages = navigation.workspacePages(config);
  assert.equal(new Set(pages.map(page => page.key)).size, pages.length);
  assert.ok(pages.some(page => page.key === 'projects'));
  assert.ok(pages.some(page => page.key === 'scripting'));
  assert.ok(pages.some(page => page.key === 'reviews'));
  assert.equal(navigation.workspacePages({ ...config, enabled: [] }).length, 1);
  assert.equal(navigation.workspacePages({ ...config, enabled: ['tasks'] }).some(page => page.key === 'projects'), false);
  const ordered = navigation.workspacePages({ ...config, order: [...config.order].reverse() });
  const agencyKeys = ordered.filter(page => navigation.agencyModuleIds.includes(page.key)).map(page => page.key);
  assert.deepEqual(agencyKeys, [...config.order].reverse().filter(id => navigation.agencyModuleIds.includes(id)));
});
