export type ScreenplayBlockType = 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition';
export interface ScreenplayBlock { id: string; type: ScreenplayBlockType; text: string }
export interface PlanRoom { id: string; name: string; x: number; y: number; width: number; height: number }
export interface PlanFixture {
  id: string; type: 'door' | 'window' | 'furniture'; label: string;
  x: number; y: number; width: number; height: number; angle: number;
}
export interface ShootLocation {
  id: string; name: string; rooms: PlanRoom[]; fixtures: PlanFixture[];
  background?: string;
}
export interface PlanMarker {
  id: string; type: 'camera' | 'actor' | 'movement'; label: string;
  x: number; y: number; endX: number; endY: number; angle: number; shotId: string;
}
export interface SceneShot {
  id: string; label: string; framing: string; movement: string; action: string; dialogueBlockId: string;
}
export interface ScreenplayScene {
  id: string; heading: string; locationId: string; roomId: string; cast: string; notes: string;
  blocks: ScreenplayBlock[]; shots: SceneShot[]; markers: PlanMarker[];
}
export interface ProductionDocument { version: 1; locations: ShootLocation[]; scenes: ScreenplayScene[] }

export const blockTypes: ScreenplayBlockType[] = ['action', 'character', 'dialogue', 'parenthetical', 'transition'];
export const planWidth = 1000;
export const planHeight = 700;
export const newId = () => crypto.randomUUID();
export const newBlock = (type: ScreenplayBlockType = 'action', text = ''): ScreenplayBlock => ({ id: newId(), type, text });
export const newLocation = (name = 'Location 1'): ShootLocation => ({ id: newId(), name, rooms: [], fixtures: [] });
export const newScene = (locationId: string, heading = 'INT. LOCATION – DAY'): ScreenplayScene => ({
  id: newId(), heading, locationId, roomId: '', cast: '', notes: '', blocks: [newBlock()], shots: [], markers: [],
});
export function newProduction(): ProductionDocument {
  const location = newLocation();
  return { version: 1, locations: [location], scenes: [newScene(location.id)] };
}

// Conversion is explicit: preserve every original character in an action block.
export function productionFromText(text: string): ProductionDocument {
  const production = newProduction();
  production.scenes[0].blocks = [newBlock('action', text)];
  return production;
}

export function productionFromDialogue(text: string, locationName: string): ProductionDocument {
  const production = newProduction();
  production.locations[0].name = locationName || 'Location 1';
  production.scenes[0].heading = `INT. ${(locationName || 'LOCATION').toUpperCase()} – DAY`;
  production.scenes[0].blocks = [newBlock('character', 'NARRATOR (V.O.)'), newBlock('dialogue', text)];
  return production;
}

export function screenplayText(production: ProductionDocument): string {
  return production.scenes.map((scene) => [scene.heading.toUpperCase(), ...scene.blocks.map((block) => {
    if (block.type === 'character' || block.type === 'transition') return block.text.toUpperCase();
    if (block.type === 'parenthetical') return `(${block.text.replace(/^\(|\)$/g, '')})`;
    return block.text;
  })].filter((text) => text.trim()).join('\n\n')).join('\n\n\n');
}

export function moveItem<T extends { id: string }>(items: T[], id: string, direction: -1 | 1): T[] {
  const index = items.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const reordered = [...items];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  return reordered;
}

export function removeShot(scene: ScreenplayScene, shotId: string): ScreenplayScene {
  return { ...scene, shots: scene.shots.filter((shot) => shot.id !== shotId),
    markers: scene.markers.map((marker) => marker.shotId === shotId ? { ...marker, shotId: '' } : marker) };
}

export function removeRoom(production: ProductionDocument, locationId: string, roomId: string): ProductionDocument {
  return { ...production,
    locations: production.locations.map((location) => location.id === locationId
      ? { ...location, rooms: location.rooms.filter((room) => room.id !== roomId) } : location),
    scenes: production.scenes.map((scene) => scene.locationId === locationId && scene.roomId === roomId
      ? { ...scene, roomId: '' } : scene),
  };
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const strings = (value: Record<string, unknown>, keys: string[]) => keys.every((key) => typeof value[key] === 'string');
const numbers = (value: Record<string, unknown>, keys: string[]) => keys.every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]));
const arrayOf = (value: unknown, check: (item: Record<string, unknown>) => boolean) =>
  Array.isArray(value) && value.every((item: unknown) => record(item) && check(item));
const rectangle = (value: Record<string, unknown>) => numbers(value, ['x', 'y', 'width', 'height'])
  && Number(value.x) >= 0 && Number(value.y) >= 0 && Number(value.width) >= 10 && Number(value.height) >= 10
  && Number(value.x) + Number(value.width) <= planWidth && Number(value.y) + Number(value.height) <= planHeight;
const markerPosition = (value: Record<string, unknown>) => numbers(value, ['x', 'y', 'endX', 'endY', 'angle'])
  && ['x', 'endX'].every((key) => Number(value[key]) >= 0 && Number(value[key]) <= planWidth)
  && ['y', 'endY'].every((key) => Number(value[key]) >= 0 && Number(value[key]) <= planHeight)
  && Number(value.angle) >= 0 && Number(value.angle) <= 360;

export function readProduction(value: unknown): ProductionDocument | null {
  if (!record(value) || value.version !== 1) return null;
  if (!arrayOf(value.locations, (location) => strings(location, ['id', 'name'])
    && (location.background === undefined || (typeof location.background === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(location.background)))
    && arrayOf(location.rooms, (room) => strings(room, ['id', 'name']) && rectangle(room))
    && arrayOf(location.fixtures, (fixture) => strings(fixture, ['id', 'label']) && ['door', 'window', 'furniture'].includes(String(fixture.type))
      && rectangle(fixture) && numbers(fixture, ['angle']) && Number(fixture.angle) >= 0 && Number(fixture.angle) <= 360))) return null;
  if (!arrayOf(value.scenes, (scene) => strings(scene, ['id', 'heading', 'locationId', 'roomId', 'cast', 'notes'])
    && arrayOf(scene.blocks, (block) => strings(block, ['id', 'text']) && blockTypes.includes(block.type as ScreenplayBlockType))
    && arrayOf(scene.shots, (shot) => strings(shot, ['id', 'label', 'framing', 'movement', 'action', 'dialogueBlockId']))
    && arrayOf(scene.markers, (marker) => strings(marker, ['id', 'label', 'shotId']) && ['camera', 'actor', 'movement'].includes(String(marker.type))
      && markerPosition(marker)))) return null;
  const production = value as unknown as ProductionDocument;
  if (!production.locations.length || !production.scenes.length) return null;
  // Reject damaged links instead of silently discarding a saved production plan.
  const ids = production.locations.flatMap((location) => [location.id, ...location.rooms.map((room) => room.id), ...location.fixtures.map((fixture) => fixture.id)])
    .concat(production.scenes.flatMap((scene) => [scene.id, ...scene.blocks.map((block) => block.id), ...scene.shots.map((shot) => shot.id), ...scene.markers.map((marker) => marker.id)]));
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) return null;
  if (production.scenes.some((scene) => {
    const location = production.locations.find((item) => item.id === scene.locationId);
    return !location || (scene.roomId && !location.rooms.some((room) => room.id === scene.roomId))
      || scene.shots.some((shot) => shot.dialogueBlockId && !scene.blocks.some((block) => block.id === shot.dialogueBlockId))
      || scene.markers.some((marker) => marker.shotId && !scene.shots.some((shot) => shot.id === marker.shotId));
  })) return null;
  return production;
}
