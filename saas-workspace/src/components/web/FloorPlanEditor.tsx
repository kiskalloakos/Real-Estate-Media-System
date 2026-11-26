import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from './ui';
import { Icon } from './Icon';
import { floorPlanMarkup } from '@/lib/screenplay-export';
import { newId, planHeight, planWidth, type PlanFixture, type PlanMarker, type PlanRoom, type ScreenplayScene, type ShootLocation } from '@/lib/screenplay';

type Tool = 'select' | 'room' | 'door' | 'window' | 'furniture' | 'camera' | 'actor' | 'movement';
type Selection = { id: string; kind: 'room' | 'fixture' | 'marker' };
type Drag = Selection & { startX: number; startY: number; x: number; y: number; endX?: number; endY?: number; drawing?: boolean; resizing?: boolean; width?: number; height?: number };
type ItemPatch = Partial<Omit<PlanRoom, 'id'> & Omit<PlanFixture, 'id' | 'type'> & Omit<PlanMarker, 'id' | 'type'>>;
interface Props {
  location: ShootLocation;
  scene: ScreenplayScene;
  selectedShotId?: string;
  onLocationChange: (location: ShootLocation) => void;
  onSceneChange: (scene: ScreenplayScene) => void;
  onRemoveRoom: (id: string) => void;
  onSelectShot: (id: string) => void;
  onError: (message: string) => void;
  onUploadingChange: (uploading: boolean) => void;
}
const tools: { value: Tool; label: string }[] = [
  { value: 'select', label: 'Select / move' }, { value: 'room', label: 'Room' },
  { value: 'door', label: 'Door' }, { value: 'window', label: 'Window' },
  { value: 'furniture', label: 'Furniture' }, { value: 'camera', label: 'Camera' },
  { value: 'actor', label: 'Talent' }, { value: 'movement', label: 'Movement' },
];
const clamp = (value: number, max: number) => Math.round(Math.max(0, Math.min(value, max)));

export function FloorPlanEditor({ location, scene, selectedShotId, onLocationChange, onSceneChange, onRemoveRoom, onSelectShot, onError, onUploadingChange }: Props) {
  const [tool, setTool] = useState<Tool>('select');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [zoom, setZoom] = useState(100);
  const [fitWidth, setFitWidth] = useState(planWidth);
  const [uploading, setUploading] = useState(false);
  const drag = useRef<Drag | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const canvasViewport = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const viewport = canvasViewport.current;
    if (!viewport) return;
    const fit = () => setFitWidth(Math.max(280, Math.min(viewport.clientWidth, viewport.clientHeight * planWidth / planHeight)));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  const selected = selection?.kind === 'room' ? location.rooms.find((item) => item.id === selection.id)
    : selection?.kind === 'fixture' ? location.fixtures.find((item) => item.id === selection.id)
    : scene.markers.find((item) => item.id === selection?.id);

  const patchItem = (target: Selection, patch: ItemPatch) => {
    const withinPlan = <T extends PlanRoom | PlanFixture>(item: T): T => {
      const next = { ...item, ...patch };
      next.width = Math.max(10, clamp(next.width, patch.width !== undefined ? planWidth - (patch.x ?? item.x) : planWidth)); next.height = Math.max(10, clamp(next.height, patch.height !== undefined ? planHeight - (patch.y ?? item.y) : planHeight));
      next.x = clamp(next.x, planWidth - next.width); next.y = clamp(next.y, planHeight - next.height);
      return next;
    };
    if (target.kind === 'room') onLocationChange({ ...location, rooms: location.rooms.map((item) => item.id === target.id ? withinPlan(item) : item) });
    else if (target.kind === 'fixture') onLocationChange({ ...location, fixtures: location.fixtures.map((item) => item.id === target.id ? withinPlan(item) : item) });
    else onSceneChange({ ...scene, markers: scene.markers.map((item) => item.id === target.id ? { ...item, ...patch } : item) });
  };
  const point = (event: PointerEvent<HTMLDivElement>) => {
    const rect = surface.current!.querySelector('svg')!.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width * planWidth, planWidth), y: clamp((event.clientY - rect.top) / rect.height * planHeight, planHeight) };
  };
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const { x, y } = point(event);
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === 'select') {
      const element = (event.target as Element).closest('[data-plan-id]');
      if (!element) { setSelection(null); return; }
      const target = { id: element.getAttribute('data-plan-id')!, kind: element.getAttribute('data-plan-kind')! } as Selection;
      const item = target.kind === 'room' ? location.rooms.find((entry) => entry.id === target.id)
        : target.kind === 'fixture' ? location.fixtures.find((entry) => entry.id === target.id) : scene.markers.find((entry) => entry.id === target.id);
      if (!item) return;
      setSelection(target);
      if (target.kind === 'room') onSceneChange({ ...scene, roomId: target.id });
      if (target.kind === 'marker' && 'shotId' in item && item.shotId) onSelectShot(item.shotId);
      drag.current = { ...target, startX: x, startY: y, x: item.x, y: item.y,
        ...('endX' in item ? { endX: item.endX, endY: item.endY } : {}),
        ...('width' in item && (event.target as Element).closest('[data-plan-resize]') ? { resizing: true, width: item.width, height: item.height } : {}) };
      return;
    }
    const id = newId();
    const kind = tool === 'room' ? 'room' : ['camera', 'actor', 'movement'].includes(tool) ? 'marker' : 'fixture';
    const target: Selection = { id, kind };
    setSelection(target);
    if (tool === 'room') {
      onLocationChange({ ...location, rooms: [...location.rooms, { id, name: `Room ${location.rooms.length + 1}`, x: Math.min(x, planWidth - 25), y: Math.min(y, planHeight - 25), width: Math.max(25, Math.min(180, planWidth - x)), height: Math.max(25, Math.min(130, planHeight - y)) }] });
      onSceneChange({ ...scene, roomId: id });
    } else if (kind === 'fixture') {
      const fixture: PlanFixture = { id, type: tool as PlanFixture['type'], label: tool === 'furniture' ? 'Furniture' : tool === 'door' ? 'Door' : 'Window', x, y, width: tool === 'furniture' ? 100 : 70, height: tool === 'furniture' ? 60 : 16, angle: 0 };
      fixture.x = Math.min(fixture.x, planWidth - fixture.width); fixture.y = Math.min(fixture.y, planHeight - fixture.height);
      onLocationChange({ ...location, fixtures: [...location.fixtures, fixture] });
    } else {
      const marker: PlanMarker = { id, type: tool as PlanMarker['type'], label: tool === 'camera' ? `Camera ${scene.markers.filter((item) => item.type === 'camera').length + 1}` : tool === 'actor' ? 'Talent' : 'Movement', x, y, endX: Math.min(x + 120, planWidth), endY: y, angle: 0, shotId: '' };
      onSceneChange({ ...scene, markers: [...scene.markers, marker] });
    }
    drag.current = { ...target, startX: x, startY: y, x, y, drawing: tool === 'room' || tool === 'movement' };
    if (!drag.current.drawing) setTool('select');
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const active = drag.current;
    const { x, y } = point(event);
    if (active.resizing) {
      patchItem(active, { width: Math.max(25, active.width! + x - active.startX), height: Math.max(25, active.height! + y - active.startY) });
    } else if (active.drawing) {
      if (active.kind === 'room') patchItem(active, { x: Math.min(active.x, x), y: Math.min(active.y, y), width: Math.max(25, Math.abs(x - active.x)), height: Math.max(25, Math.abs(y - active.y)) });
      else patchItem(active, { endX: x, endY: y });
    } else {
      const dx = x - active.startX;
      const dy = y - active.startY;
      const item = active.kind === 'room' ? location.rooms.find((entry) => entry.id === active.id) : active.kind === 'fixture' ? location.fixtures.find((entry) => entry.id === active.id) : scene.markers.find((entry) => entry.id === active.id);
      const maxX = item && 'width' in item ? planWidth - item.width : planWidth;
      const maxY = item && 'height' in item ? planHeight - item.height : planHeight;
      patchItem(active, { x: clamp(active.x + dx, maxX), y: clamp(active.y + dy, maxY),
        ...(active.endX !== undefined ? { endX: clamp(active.endX + dx, planWidth), endY: clamp(active.endY! + dy, planHeight) } : {}) });
    }
  };
  const endDrag = () => { if (drag.current?.drawing) setTool('select'); drag.current = null; };
  const removeSelected = () => {
    if (!selection) return;
    if (selection.kind === 'room') onRemoveRoom(selection.id);
    else if (selection.kind === 'fixture') onLocationChange({ ...location, fixtures: location.fixtures.filter((item) => item.id !== selection.id) });
    else onSceneChange({ ...scene, markers: scene.markers.filter((item) => item.id !== selection.id) });
    setSelection(null);
  };
  const canvasKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!selection || !selected) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeSelected(); return; }
    const delta = event.shiftKey ? 10 : 1;
    const directions: Record<string, [number, number]> = { ArrowLeft:[-delta,0], ArrowRight:[delta,0], ArrowUp:[0,-delta], ArrowDown:[0,delta] };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const x = clamp(selected.x + direction[0], 'width' in selected ? planWidth - selected.width : planWidth);
    const y = clamp(selected.y + direction[1], 'height' in selected ? planHeight - selected.height : planHeight);
    patchItem(selection, { x, y, ...('endX' in selected ? { endX:clamp(selected.endX + x - selected.x,planWidth), endY:clamp(selected.endY + y - selected.y,planHeight) } : {}) });
  };
  const uploadPlan = async (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
      onError('Choose a PNG, JPEG, or WebP floor plan under 8 MB.'); return;
    }
    setUploading(true);
    onUploadingChange(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not read this floor plan.');
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      onLocationChange({ ...location, background: canvas.toDataURL('image/jpeg', .8) });
    } catch { onError('Could not read this image. Try another PNG, JPEG, or WebP.'); }
    finally { URL.revokeObjectURL(url); setUploading(false); onUploadingChange(false); }
  };

  return <section className="sp-plan" aria-label="Floor plan editor">
    <header className="sp-panel-heading"><div><h3>Floor plan</h3><p>{location.name} · Scene-specific camera and talent positions</p></div></header>
    <div className="sp-plan-tools" aria-label="Drawing tools">{tools.map((item) => <button aria-pressed={tool === item.value} key={item.value} onClick={() => setTool(item.value)} type="button">{item.label}</button>)}</div>
    <div className="sp-plan-controls">
      <label className="sp-upload">{uploading ? 'Reading plan…' : 'Upload plan image'}<Icon name="upload" size={16}/><input aria-label="Upload plan image" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => { void uploadPlan(event.target.files?.[0]); event.target.value = ''; }} type="file" /></label>
      {location.background ? <button onClick={() => onLocationChange({ ...location, background: undefined })} type="button">Remove image</button> : null}
      <label>Zoom <input aria-label="Floor plan zoom" max="300" min="60" onChange={(event) => setZoom(Number(event.target.value))} type="range" value={zoom} /> {zoom}%</label><button onClick={() => setZoom(100)} type="button">Fit to view</button>
    </div>
    <p className="sp-hint" role="status">{tool === 'select' ? 'Select an item to edit. Drag to move.' : tool === 'room' || tool === 'movement' ? `Drag on the plan to draw a ${tool}.` : `Click on the plan to place ${tool === 'actor' ? 'talent' : `a ${tool}`}.`} <span className="sp-plan-keyboard-hint">Arrow keys: nudge · Shift: move faster · Room corner: resize · Schematic, not to scale.</span></p>
    <div className="sp-plan-stage"><div className="sp-plan-scroll" ref={canvasViewport}><div className="sp-plan-surface" aria-label="Floor plan canvas" role="region" tabIndex={0} onKeyDown={canvasKeys} onPointerCancel={endDrag} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={endDrag} ref={surface} style={{ width: Math.floor(fitWidth * zoom / 100) }} dangerouslySetInnerHTML={{ __html: floorPlanMarkup(location, scene, selection?.id, selectedShotId, 'dark') }} /></div>
    <div className="sp-plan-selection">
      <label className="sp-field">Selected item<select aria-label="Selected plan item" onChange={(event) => {
        const [kind, id] = event.target.value.split(':');
        setSelection(id ? { kind: kind as Selection['kind'], id } : null);
        const marker = kind === 'marker' ? scene.markers.find((item) => item.id === id) : null;
        if (marker?.shotId) onSelectShot(marker.shotId);
      }} value={selected && selection ? `${selection.kind}:${selection.id}` : ''}>
        <option value="">Select an item</option>
        {location.rooms.map((item) => <option key={item.id} value={`room:${item.id}`}>{item.name} · Room</option>)}
        {location.fixtures.map((item) => <option key={item.id} value={`fixture:${item.id}`}>{item.label} · {item.type}</option>)}
        {scene.markers.map((item) => <option key={item.id} value={`marker:${item.id}`}>{item.label} · {item.type}</option>)}
      </select></label>
      {!selected ? <p className="sp-hint">Choose Room to draw your space, then add doors, windows, cameras, and talent. Select an item on the canvas to edit it here.</p> : null}
      {selected && selection ? <>
        <label className="sp-field">Label<input onChange={(event) => patchItem(selection, selection.kind === 'room' ? { name: event.target.value } : { label: event.target.value })} value={'name' in selected ? selected.name : selected.label} /></label>
        {(['x', 'y', ...('width' in selected ? ['width', 'height'] : ['angle']), ...('endX' in selected && selected.type === 'movement' ? ['endX', 'endY'] : []), ...('angle' in selected && selection.kind === 'fixture' ? ['angle'] : [])] as const).map((key) => <label className="sp-field" key={key}>{key === 'angle' ? 'Facing (°)' : key}<input aria-label={`Plan item ${key}`} min={key === 'width' || key === 'height' ? 10 : 0} max={key === 'angle' ? 360 : key === 'y' || key === 'height' || key === 'endY' ? planHeight : planWidth} onChange={(event) => {
          const limit = key === 'angle' ? 360 : key === 'y' || key === 'height' || key === 'endY' ? planHeight : planWidth;
          const value = clamp(Number(event.target.value), limit);
          patchItem(selection, { [key]: key === 'width' || key === 'height' ? Math.max(10, value) : value });
        }} type="number" value={(selected as unknown as Record<string, number>)[key] ?? 0} /></label>)}
        {'shotId' in selected ? <label className="sp-field sp-plan-shot">Linked shot<select onChange={(event) => { patchItem(selection, { shotId: event.target.value }); if (event.target.value) onSelectShot(event.target.value); }} value={selected.shotId}><option value="">No linked shot</option>{scene.shots.map((shot, index) => <option key={shot.id} value={shot.id}>{shot.label || `Shot ${index + 1}`}</option>)}</select></label> : null}
        <Button icon="trash" onClick={removeSelected} variant="secondary">Remove item</Button>
      </> : null}
    </div></div>
  </section>;
}
