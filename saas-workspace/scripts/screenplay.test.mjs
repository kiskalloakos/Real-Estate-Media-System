import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import ts from 'typescript';

// Compile the two browser-independent modules with the project's TypeScript.
const output = mkdtempSync(path.join(tmpdir(), 'rm-screenplay-'));
for (const name of ['screenplay', 'screenplay-export']) {
  const source = readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  writeFileSync(path.join(output, `${name}.cjs`), compiled.replace('require("./screenplay")', 'require("./screenplay.cjs")'));
}
const require = createRequire(import.meta.url);
const { newProduction, newScene, newBlock, newId, productionFromText, screenplayText, readProduction, moveItem, removeShot, removeRoom } = require(path.join(output, 'screenplay.cjs'));
const { productionPrintHtml, floorPlanMarkup } = require(path.join(output, 'screenplay-export.cjs'));
after(() => rmSync(output, { recursive: true, force: true }));

function fixture() {
  const production = newProduction();
  const location = production.locations[0];
  location.name = 'Cabana de lângă pădure';
  const room = { id: newId(), name: 'Living', x: 40, y: 40, width: 350, height: 250 };
  location.rooms.push(room);
  production.scenes[0].roomId = room.id;
  production.scenes[0].heading = 'INT. CABANĂ – LIVING – ZI';
  const dialogue = newBlock('dialogue', 'Dimineața începe aici.');
  production.scenes[0].blocks = [newBlock('action', 'Ana deschide ușa.'), newBlock('character', 'ANA'), newBlock('parenthetical', 'încet'), dialogue];
  const shot = { id: newId(), label: 'A1', framing: 'Wide', movement: 'Push in', action: 'Follow Ana to the window.', dialogueBlockId: dialogue.id };
  production.scenes[0].shots.push(shot);
  production.scenes[0].markers.push({ id: newId(), type: 'camera', label: 'Camera A', x: 120, y: 240, endX: 120, endY: 240, angle: 30, shotId: shot.id });
  return production;
}

test('a three-scene production survives the JSON storage boundary with all links intact', () => {
  const production = fixture();
  production.scenes.push(newScene(production.locations[0].id, 'EXT. TERASĂ – ZI'), newScene(production.locations[0].id, 'INT. DORMITOR – NOAPTE'));
  const restored = readProduction(JSON.parse(JSON.stringify(production)));
  assert.deepEqual(restored, production);
  assert.equal(restored.scenes[0].markers[0].shotId, restored.scenes[0].shots[0].id);
  assert.equal(restored.scenes[0].shots[0].dialogueBlockId, restored.scenes[0].blocks[3].id);
});

test('scene reordering preserves room, shot, and dialogue identities', () => {
  const production = fixture();
  const original = production.scenes[0];
  production.scenes.push(newScene(production.locations[0].id));
  production.scenes = moveItem(production.scenes, original.id, 1);
  assert.equal(production.scenes[1], original);
  assert.ok(readProduction(production));
  assert.equal(moveItem(production.scenes, original.id, 1), production.scenes);
});

test('removing a shot clears marker links while keeping camera positions', () => {
  const production = fixture();
  const original = production.scenes[0];
  production.scenes[0] = removeShot(original, original.shots[0].id);
  assert.equal(production.scenes[0].shots.length, 0);
  assert.equal(production.scenes[0].markers[0].shotId, '');
  assert.equal(production.scenes[0].markers[0].x, original.markers[0].x);
  assert.ok(readProduction(production));
});

test('deleting a shared room unlinks every affected scene', () => {
  const production = fixture();
  production.scenes.push({ ...newScene(production.locations[0].id), roomId: production.scenes[0].roomId });
  const updated = removeRoom(production, production.locations[0].id, production.scenes[0].roomId);
  assert.ok(updated.scenes.every((scene) => scene.roomId === ''));
  assert.ok(readProduction(updated));
  assert.equal(production.locations[0].rooms.length, 1);
});

test('conversion preserves original text, including whitespace and Romanian diacritics', () => {
  const original = '  Șase camere.\n\nLiniște, pădure și o terasă.\n';
  const converted = productionFromText(original);
  assert.equal(converted.scenes[0].blocks[0].text, original);
  assert.ok(screenplayText(converted).includes(original));
});

test('unsupported data and broken links are rejected instead of silently rewritten', () => {
  for (const damage of [
    (production) => { production.version = 2; },
    (production) => { production.scenes[0].markers[0].shotId = 'missing'; },
    (production) => { production.scenes[0].shots[0].dialogueBlockId = 'missing'; },
    (production) => { production.scenes[0].locationId = 'missing'; },
    (production) => { production.scenes[0].roomId = 'missing'; },
    (production) => { production.scenes[0].blocks[0].type = 'html'; },
    (production) => { production.scenes[0].markers[0].x = NaN; },
    (production) => { production.locations[0].background = 'data:image/svg+xml,<svg onload=alert(1) />'; },
    (production) => { production.scenes[0].id = production.locations[0].id; },
  ]) {
    const production = fixture(); damage(production);
    assert.equal(readProduction(production), null);
  }
});

test('screenplay PDF markup groups dialogue and preserves searchable Romanian text', () => {
  const html = productionPrintHtml('Cabana – scenariu', fixture());
  assert.ok(html.includes('Dimineața începe aici.'));
  assert.ok(html.includes('<div class="speech"><p class="character">ANA</p><p class="parenthetical">(încet)</p><p class="dialogue">'));
  assert.ok(html.includes('break-inside:avoid'));
  assert.ok(!html.includes('<section class="plan-page">'));
});

test('production pack contains annotated plans and shots grouped by location', () => {
  const production = fixture();
  const html = productionPrintHtml('Test', production, true);
  assert.ok(html.includes('Cabana de lângă pădure · Scene 1'));
  assert.ok(html.includes('Camera A · A1'));
  assert.ok(html.includes('Wide / Push in'));
  assert.ok(html.includes('Follow Ana to the window.'));
});

test('script, room, and marker text cannot inject HTML into previews or exports', () => {
  const production = fixture();
  const payload = '<img src=x onerror="alert(1)">';
  production.scenes[0].blocks[0].text = payload;
  production.locations[0].rooms[0].name = payload;
  production.scenes[0].markers[0].label = payload;
  const html = productionPrintHtml(payload, production, true);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(!floorPlanMarkup(production.locations[0], production.scenes[0]).includes('<img src=x'));
});
