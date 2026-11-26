import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type KeyboardEvent } from 'react';
import { useTabTransition } from '@/hooks/use-tab-transition';
import { Button, Modal } from './ui';
import { Icon } from './Icon';
import { cycleBlockType, splitBlock, productionHistory, reduceProductionHistory } from '@/lib/screenplay-editing';
import { FloorPlanEditor } from './FloorPlanEditor';
import {
  blockTypes, moveItem, newBlock, newId, newLocation, newProduction, newScene,
  productionFromText, removeRoom, removeShot, screenplayText,
  type ProductionDocument, type SceneShot, type ScreenplayBlock, type ScreenplayBlockType, type ScreenplayScene, type ShootLocation,
} from '@/lib/screenplay';
import { openProductionDocument } from '@/lib/screenplay-export';
import { writeCabanaScript, type CabanaScriptBrief, type GeneratedCabanaScriptDocument } from '@/lib/scripting-service';
import './ScreenplayWorkspace.css';

export interface ScreenplaySave {
  script: GeneratedCabanaScriptDocument;
  status: 'draft' | 'approved';
  brief: CabanaScriptBrief | null;
}
interface Props {
  initial: GeneratedCabanaScriptDocument & { status?: 'draft' | 'approved'; brief?: CabanaScriptBrief | null };
  saving: boolean;
  aiAvailable: boolean;
  onClose: () => void;
  onSave: (value: ScreenplaySave) => Promise<void>;
  onDelete?: () => Promise<void>;
  generatingMore?: boolean;
  onGenerateMore?: (count: number) => Promise<void>;
}
const blankBrief: CabanaScriptBrief = {
  amenities: '', avoid: '', bookingCta: '', location: '', mustMention: '', name: '', targetGuest: '', tone: 'calm_cinematic', contentTemplate: 'property_showcase',
};

function ScriptElement({ block, sceneNumber, onChange, onFocus, onNext, onPrevious, first }: {
  block: ScreenplayBlock; sceneNumber: number; onChange: (block: ScreenplayBlock) => void;
  onFocus: () => void; onNext: (start: number, end: number) => void;
  onPrevious: () => void; first: boolean;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    const resize = () => { element.style.height = '0px'; element.style.height = `${element.scrollHeight}px`; };
    resize();
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => { if (element.clientWidth !== width) { width = element.clientWidth; resize(); } });
    observer.observe(element);
    return () => observer.disconnect();
  }, [block.text, block.type]);
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!block.text && block.type !== 'action') onChange({ ...block, type: 'action' });
      else onNext(event.currentTarget.selectionStart, event.currentTarget.selectionEnd);
    } else if (event.key === 'Tab' && !event.shiftKey && !block.text.trim()) {
      event.preventDefault(); onChange({ ...block, type: cycleBlockType(block.type) });
    } else if (event.key === 'Backspace' && !block.text && !first) {
      event.preventDefault(); onPrevious();
    }
  };
  return <div className={`sp-element sp-element--${block.type}`}>
    <textarea aria-label={`Scene ${sceneNumber} ${block.type}`} id={`sp-block-${block.id}`} onChange={(event) => onChange({ ...block, text: event.target.value })} onFocus={onFocus} onKeyDown={keyDown} placeholder={block.type === 'action' ? 'Describe what we see and hear…' : block.type === 'character' ? 'CHARACTER NAME' : block.type === 'dialogue' ? 'What they say…' : block.type === 'parenthetical' ? '(quietly)' : 'CUT TO:'} ref={input} rows={1} spellCheck value={block.text} />
  </div>;
}

export function ScreenplayWorkspace({ initial, saving, aiAvailable, onClose, onSave, onDelete, generatingMore, onGenerateMore }: Props) {
  const [history, edit] = useReducer(reduceProductionHistory, initial.production ?? (initial.script ? null : newProduction()), productionHistory);
  const production = history.present;
  const setProduction = (value: ProductionDocument) => edit({ type: 'change', update: () => value, now: Date.now() });
  const [legacyText, setLegacyText] = useState(initial.script);
  const [title, setTitle] = useState(initial.title);
  const [hook, setHook] = useState(initial.hooks[0] ?? '');
  const [status, setStatus] = useState<'draft' | 'approved'>(initial.status ?? 'draft');
  const [selectedSceneId, setSelectedSceneId] = useState(production?.scenes[0]?.id ?? '');
  const [selectedShotId, setSelectedShotId] = useState('');
  const [activeBlockId, setActiveBlockId] = useState(production?.scenes[0]?.blocks[0]?.id ?? '');
  const [view, setView] = useState<'script' | 'plan' | 'split'>('script');
  const transitionRef = useTabTransition(`${view}:${selectedShotId}`);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 900);
  const [saved, setSaved] = useState(Boolean(initial.id));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [brief, setBrief] = useState<CabanaScriptBrief>({ ...blankBrief, ...initial.brief, name: initial.brief?.name || initial.title });
  const [aiOpen, setAiOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiDraft, setAiDraft] = useState('');
  const [moreCount, setMoreCount] = useState(3);
  const [uploading, setUploading] = useState(false);
  const busy = saving || generating || uploading || Boolean(generatingMore);
  const scene = production?.scenes.find((item) => item.id === selectedSceneId) ?? production?.scenes[0];
  const location = production?.locations.find((item) => item.id === scene?.locationId);
  const shot = scene?.shots.find((item) => item.id === selectedShotId);
  const activeBlock = scene?.blocks.find((item) => item.id === activeBlockId);
  const change = useCallback((update: (current: ProductionDocument) => ProductionDocument, group?: string) => {
    edit({ type: 'change', update: current => current ? update(current) : current, group, now: Date.now() });
    setDirty(true);
  }, []);
  const updateScene = (updated: ScreenplayScene, group?: string) => change((current) => ({ ...current, scenes: current.scenes.map((item) => item.id === updated.id ? updated : item) }), group);
  const updateLocation = (updated: ShootLocation) => change((current) => ({ ...current, locations: current.locations.map((item) => item.id === updated.id ? updated : item) }), `location:${updated.id}`);
  const updateShot = (updated: SceneShot) => { if (scene) updateScene({ ...scene, shots: scene.shots.map((item) => item.id === updated.id ? updated : item) }); };
  const close = () => { if (!busy && (!dirty || window.confirm('Discard unsaved changes to this script and floor plan?'))) onClose(); };

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  const addScene = () => {
    if (!production) return;
    const added = newScene(location?.id ?? production.locations[0].id, `INT. ${(location?.name || production.locations[0].name).toUpperCase()} – DAY`);
    change((current) => ({ ...current, scenes: [...current.scenes, added] }));
    setSelectedSceneId(added.id); setSelectedShotId('');
    window.requestAnimationFrame(() => document.getElementById(`sp-scene-${added.id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };
  const addBlock = (targetScene: ScreenplayScene, type: ScreenplayBlockType, afterId?: string) => {
    const block = newBlock(type);
    const blocks = [...targetScene.blocks];
    blocks.splice(afterId ? blocks.findIndex((item) => item.id === afterId) + 1 : blocks.length, 0, block);
    updateScene({ ...targetScene, blocks });
    window.requestAnimationFrame(() => document.getElementById(`sp-block-${block.id}`)?.focus());
  };
  const removeBlock = (targetScene: ScreenplayScene, id: string) => updateScene({ ...targetScene,
    blocks: targetScene.blocks.filter((item) => item.id !== id),
    shots: targetScene.shots.map((item) => item.dialogueBlockId === id ? { ...item, dialogueBlockId: '' } : item),
  });
  const updateBlock = (targetScene: ScreenplayScene, updated: ScreenplayBlock) => updateScene({ ...targetScene,
    blocks: targetScene.blocks.map((item) => item.id === updated.id ? updated : item),
    shots: targetScene.shots.map((item) => item.dialogueBlockId === updated.id && updated.type !== 'dialogue' ? { ...item, dialogueBlockId: '' } : item),
  }, `block:${updated.id}`);
  const addLocation = () => {
    if (!production || !scene) return;
    if (scene.markers.length && !window.confirm('Moving this scene to a new location clears its camera, talent, and movement positions. Continue?')) return;
    const added = newLocation(`Location ${production.locations.length + 1}`);
    change((current) => ({ ...current, locations: [...current.locations, added], scenes: current.scenes.map((item) => item.id === scene.id ? { ...item, locationId: added.id, roomId: '', markers: [] } : item) }));
  };
  const addShot = () => {
    if (!scene) return;
    const added: SceneShot = { id: newId(), label: `Shot ${scene.shots.length + 1}`, framing: 'Wide', movement: 'Static', action: '', dialogueBlockId: '' };
    updateScene({ ...scene, shots: [...scene.shots, added] }); setSelectedShotId(added.id);
  };
  const save = async () => {
    setError('');
    try {
      await onSave({ script: { ...initial, title: title.trim() || 'Untitled screenplay', hooks: hook.trim() ? [hook.trim(), ...initial.hooks.slice(1)] : initial.hooks.slice(1), script: production ? screenplayText(production) : legacyText, production }, status, brief: brief.name.trim() && brief.amenities.trim() ? brief : initial.brief ?? null });
      setDirty(false); setSaved(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save script. Your changes are still here.'); }
  };
  const exportDocument = (includePlans: boolean) => {
    if (production && !openProductionDocument(title, production, includePlans)) setError('Allow pop-up windows to open the PDF preview.');
  };
  const draftDialogue = async () => {
    setGenerating(true); setError('');
    try {
      const generated = await writeCabanaScript({ ...brief, location: brief.location || location?.name || '', mustMention: [brief.mustMention, scene?.notes, scene?.blocks.filter((block) => block.type === 'action').map((block) => block.text).join('\n')].filter(Boolean).join('\n') });
      setAiDraft(generated.script.script);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not draft dialogue.'); }
    finally { setGenerating(false); }
  };

  const undo = () => { if (history.past.length) { edit({ type: 'undo' }); setDirty(true); } };
  const redo = () => { if (history.future.length) { edit({ type: 'redo' }); setDirty(true); } };
  const editorKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.metaKey || event.ctrlKey) || busy) return;
    if (event.key.toLowerCase() === 's') { event.preventDefault(); if (!initial.productionInvalid) void save(); }
    if (['z', 'y'].includes(event.key.toLowerCase()) && (event.target as HTMLElement).closest('.sp-script-pane,.sp-plan')) {
      event.preventDefault();
      if (event.shiftKey || event.key.toLowerCase() === 'y') redo();
      else undo();
    }
  };
  const splitElement = (target: ScreenplayScene, block: ScreenplayBlock, start: number, end: number) => {
    const [before, after] = splitBlock(block, start, end);
    const blocks = target.blocks.flatMap(item => item.id === block.id ? [before, after] : [item]);
    updateScene({ ...target, blocks });
    window.requestAnimationFrame(() => document.getElementById(`sp-block-${after.id}`)?.focus());
  };

  return <Modal className="sp-workspace-modal" fullscreen onClose={close} open title="Script writing">
    <div className="sp-workspace" onKeyDown={editorKeys}>
      <div className="sp-workspace-toolbar">
        <label className="sp-title-label">Script title<input aria-label="Script title" disabled={busy || initial.productionInvalid} onChange={(event) => { setTitle(event.target.value); setDirty(true); }} placeholder="Untitled screenplay" value={title} /></label>
        <span aria-live="polite" className="sp-save-state">{saving ? 'Saving…' : dirty ? 'Unsaved changes' : saved ? 'All changes saved' : 'New screenplay'}</span>
        <label className="sp-status-label">Status<select aria-label="Script status" disabled={busy || initial.productionInvalid} onChange={(event) => { setStatus(event.target.value as typeof status); setDirty(true); }} value={status}><option value="draft">Draft</option><option value="approved">Approved</option></select></label>
        {production ? <><div className="sp-export-actions"><Button disabled={busy} icon="download" onClick={() => exportDocument(false)} variant="secondary">Screenplay PDF</Button><Button disabled={busy} onClick={() => exportDocument(true)} variant="secondary">Production pack</Button></div><select aria-label="Export script" className="sp-export-select" disabled={busy} value="" onChange={event => exportDocument(event.target.value === 'production')}><option value="" disabled>Export</option><option value="screenplay">Screenplay PDF</option><option value="production">Production pack</option></select></> : null}
        <Button disabled={busy || initial.productionInvalid || !(production ? screenplayText(production).trim() : legacyText.trim())} onClick={() => void save()}>{saving ? 'Saving…' : 'Save script'}</Button>
      </div>
      {error ? <div className="sp-error" role="alert">{error}</div> : null}
      {initial.productionInvalid ? <p className="sp-error" role="alert">This script contains production data this editor cannot read. Export the original text or recover the production data before editing.</p> : null}
      {!production ? <div className="sp-legacy"><h3>Original script</h3><p>Your existing text is preserved. Convert it when you are ready to organize it into scenes and add a floor plan.</p><label className="sp-field">Script<textarea disabled={busy || initial.productionInvalid} onChange={(event) => { setLegacyText(event.target.value); setDirty(true); }} rows={16} value={legacyText} /></label><Button disabled={busy || initial.productionInvalid} onClick={() => { const converted = productionFromText(legacyText); setProduction(converted); setSelectedSceneId(converted.scenes[0].id); setDirty(true); }}>Convert to screenplay</Button></div> : <>
        <nav aria-label="Writing views" className="sp-view-tabs">{([{ id: 'script', label: 'Script' }, { id: 'plan', label: 'Floor Plan' }, { id: 'split', label: 'Split View' }] as const).map((item) => <button aria-pressed={view === item.id} key={item.id} onClick={() => setView(item.id)} type="button">{item.label}</button>)}<span className="sp-view-actions"><button aria-pressed={outlineOpen} onClick={() => { setOutlineOpen(!outlineOpen); if (!outlineOpen) setDetailsOpen(false); }} type="button"><Icon name="list-check" size={16}/>Scenes</button><button aria-expanded={detailsOpen} onClick={() => { setDetailsOpen(!detailsOpen); if (!detailsOpen) setOutlineOpen(false); }} type="button"><Icon name="settings" size={16}/>Scene setup</button><button aria-label="Undo script or plan edit" disabled={!history.past.length || busy} onClick={undo} type="button">Undo</button><button aria-label="Redo script or plan edit" disabled={!history.future.length || busy} onClick={redo} type="button">Redo</button></span></nav>
        <div className={`sp-workspace-body sp-view--${view}${outlineOpen ? ' has-outline' : ''}${detailsOpen ? ' has-details' : ''}`} inert={busy || undefined} ref={transitionRef}>
          {outlineOpen ? <aside className="sp-outline" aria-label="Scene outline">
            <div className="sp-panel-heading"><h3>Scenes <small>{production.scenes.length}</small></h3><button aria-label="Close scene list" onClick={() => setOutlineOpen(false)} type="button"><Icon name="x" size={18}/></button></div>
            <ol>{production.scenes.map((item, index) => <li className={scene?.id === item.id ? 'is-selected' : ''} key={item.id}>
              <button aria-current={scene?.id === item.id ? 'step' : undefined} onClick={() => { setSelectedSceneId(item.id); setSelectedShotId(''); document.getElementById(`sp-scene-${item.id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }} type="button"><span className="sp-scene-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{item.heading || 'Untitled scene'}</strong><small>{production.locations.find((entry) => entry.id === item.locationId)?.name} · {item.shots.length} {item.shots.length === 1 ? 'shot' : 'shots'}</small></span></button>
              <div className="sp-outline-order"><button aria-label={`Move scene ${index + 1} up`} disabled={index === 0 || busy} onClick={() => change((current) => ({ ...current, scenes: moveItem(current.scenes, item.id, -1) }))} type="button">↑</button><button aria-label={`Move scene ${index + 1} down`} disabled={index === production.scenes.length - 1 || busy} onClick={() => change((current) => ({ ...current, scenes: moveItem(current.scenes, item.id, 1) }))} type="button">↓</button></div>
            </li>)}</ol>
            <Button disabled={busy} icon="plus" onClick={addScene} variant="secondary">Add scene</Button>
            <p className="sp-hint">Select a scene to plan its shots and positions.</p>
          </aside> : null}
          <main className="sp-writing-area" key={view}>
            {view !== 'plan' ? <section aria-label="Screenplay editor" className="sp-script-pane"><div className="sp-format-bar" aria-label="Element formatting">
              <select aria-label="Current element type" disabled={!activeBlock} value={activeBlock?.type ?? ''} onChange={event => { if (scene && activeBlock) { updateBlock(scene, { ...activeBlock, type: event.target.value as ScreenplayBlockType }); window.requestAnimationFrame(() => document.getElementById(`sp-block-${activeBlock.id}`)?.focus()); } }}><option value="" disabled>Scene heading</option>{blockTypes.map(type => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}</select>
              <button aria-label="Move element up" disabled={!activeBlock || scene?.blocks[0]?.id === activeBlock.id} onClick={() => { if (scene && activeBlock) updateScene({ ...scene, blocks: moveItem(scene.blocks, activeBlock.id, -1) }); }} type="button"><Icon name="chevron-up" size={18}/></button>
              <button aria-label="Move element down" disabled={!activeBlock || scene?.blocks.at(-1)?.id === activeBlock.id} onClick={() => { if (scene && activeBlock) updateScene({ ...scene, blocks: moveItem(scene.blocks, activeBlock.id, 1) }); }} type="button"><Icon name="chevron-down" size={18}/></button>
              <button aria-label="Remove current element" disabled={!activeBlock} onClick={() => { if (scene && activeBlock) removeBlock(scene, activeBlock.id); }} type="button"><Icon name="trash" size={18}/></button>
              <span>Scene {scene ? production.scenes.indexOf(scene) + 1 : 1}</span>
            </div><p className="sp-script-hint">Enter: next element · Shift+Enter: line break · Tab on an empty line: change format</p><div className="sp-paper"><p className="sp-paper-title">{title || 'UNTITLED SCREENPLAY'}</p>{production.scenes.map((item, sceneIndex) => <section className={`sp-script-scene ${scene?.id === item.id ? 'is-active' : ''}`} id={`sp-scene-${item.id}`} key={item.id} onFocus={() => { if (scene?.id !== item.id) { setSelectedSceneId(item.id); setSelectedShotId(''); } }}>
              <div className="sp-heading"><span>{sceneIndex + 1}</span><input aria-label={`Scene ${sceneIndex + 1} heading`} onFocus={() => setActiveBlockId('')} onChange={(event) => updateScene({ ...item, heading: event.target.value }, `heading:${item.id}`)} onKeyDown={event => { if(event.key === 'Enter') { event.preventDefault(); if(item.blocks.length) document.getElementById(`sp-block-${item.blocks[0].id}`)?.focus(); else addBlock(item, 'action'); } }} placeholder="INT. LOCATION – DAY" value={item.heading} /></div>
              {item.blocks.map((block, blockIndex) => <ScriptElement block={block} first={blockIndex === 0} key={block.id} onFocus={() => setActiveBlockId(block.id)} onChange={updated => updateBlock(item, updated)} onNext={(start, end) => splitElement(item, block, start, end)} onPrevious={() => { const previous = item.blocks[blockIndex - 1]; removeBlock(item, block.id); window.requestAnimationFrame(() => { const input = document.getElementById(`sp-block-${previous.id}`) as HTMLTextAreaElement | null; input?.focus(); input?.setSelectionRange(previous.text.length, previous.text.length); }); }} sceneNumber={sceneIndex + 1} />)}
              <div className="sp-add-elements">{blockTypes.map((type) => <button key={type} onClick={() => addBlock(item, type)} type="button">+ {type}</button>)}</div>
            </section>)}</div></section> : null}
            {view !== 'script' && scene && location ? <FloorPlanEditor key={scene.id} location={location} onError={setError} onUploadingChange={setUploading} onLocationChange={updateLocation} onRemoveRoom={(id) => change((current) => removeRoom(current, location.id, id))} onSceneChange={updated => updateScene(updated, `plan:${updated.id}`)} onSelectShot={setSelectedShotId} scene={scene} selectedShotId={selectedShotId} /> : null}
          </main>
          {detailsOpen ? <aside aria-label="Scene details" className="sp-details">
            <div className="sp-panel-heading"><h3>Scene setup</h3><button aria-label="Close scene setup" onClick={() => setDetailsOpen(false)} type="button"><Icon name="x" size={18}/></button></div>
            {scene && location ? <>
              <div className="sp-panel-heading"><h3>Scene {production.scenes.indexOf(scene) + 1}</h3><button aria-label="Delete selected scene" disabled={production.scenes.length === 1 || busy} onClick={() => {
                if (!window.confirm('Delete this scene, its shots, and its camera and talent positions?')) return;
                change((current) => ({ ...current, scenes: current.scenes.filter((item) => item.id !== scene.id) }));
                setSelectedSceneId(production.scenes.find((item) => item.id !== scene.id)!.id); setSelectedShotId('');
              }} type="button">Delete scene</button></div>
              <label className="sp-field">Scene heading<input onChange={(event) => updateScene({ ...scene, heading: event.target.value })} value={scene.heading} /></label>
              <label className="sp-field">Location<select onChange={(event) => {
                if (scene.markers.length && !window.confirm('Changing location clears this scene’s camera, talent, and movement positions. Continue?')) return;
                updateScene({ ...scene, locationId: event.target.value, roomId: '', markers: [] });
              }} value={scene.locationId}>{production.locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label className="sp-field">Location name<input onChange={(event) => updateLocation({ ...location, name: event.target.value })} value={location.name} /></label>
              <button className="sp-text-button" onClick={addLocation} type="button">+ New location</button>
              <label className="sp-field">Room<select onChange={(event) => updateScene({ ...scene, roomId: event.target.value })} value={scene.roomId}><option value="">Whole location / unassigned</option>{location.rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
              <label className="sp-field">Cast<input onChange={(event) => updateScene({ ...scene, cast: event.target.value })} placeholder="Presenter, guest…" value={scene.cast} /></label>
              <label className="sp-field">Production notes<textarea onChange={(event) => updateScene({ ...scene, notes: event.target.value })} placeholder="Light, sound, props, timing…" rows={3} value={scene.notes} /></label>
              <div className="sp-panel-heading"><h3>Shots</h3><button aria-label="Add shot" onClick={addShot} type="button">+</button></div>
              {scene.shots.length ? <div className="sp-shot-tabs">{scene.shots.map((item, index) => <button aria-pressed={item.id === shot?.id} key={item.id} onClick={() => setSelectedShotId(item.id)} type="button">{item.label || `Shot ${index + 1}`}</button>)}</div> : <p className="sp-hint">Add a shot, then link it to a camera on the floor plan.</p>}
              <button className="sp-text-button" onClick={addShot} type="button">+ Add shot</button>
              {shot ? <div className="sp-shot-fields">
                <label className="sp-field">Shot label<input onChange={(event) => updateShot({ ...shot, label: event.target.value })} value={shot.label} /></label>
                <label className="sp-field">Framing<select onChange={(event) => updateShot({ ...shot, framing: event.target.value })} value={shot.framing}>{['Wide', 'Medium', 'Close-up', 'Detail', 'Over the shoulder', 'POV', 'Drone'].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label className="sp-field">Camera movement<select onChange={(event) => updateShot({ ...shot, movement: event.target.value })} value={shot.movement}>{['Static', 'Pan', 'Tilt', 'Push in', 'Pull out', 'Tracking', 'Handheld', 'Gimbal'].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label className="sp-field">Action / shot notes<textarea onChange={(event) => updateShot({ ...shot, action: event.target.value })} rows={3} value={shot.action} /></label>
                <label className="sp-field">Dialogue cue<select onChange={(event) => updateShot({ ...shot, dialogueBlockId: event.target.value })} value={shot.dialogueBlockId}><option value="">No dialogue cue</option>{scene.blocks.filter((block) => block.type === 'dialogue').map((block) => <option key={block.id} value={block.id}>{block.text.slice(0, 65) || 'Empty dialogue'}</option>)}</select></label>
                <div className="sp-shot-order"><button disabled={scene.shots[0].id === shot.id} onClick={() => updateScene({ ...scene, shots: moveItem(scene.shots, shot.id, -1) })} type="button">Move shot up</button><button disabled={scene.shots.at(-1)?.id === shot.id} onClick={() => updateScene({ ...scene, shots: moveItem(scene.shots, shot.id, 1) })} type="button">Move shot down</button></div>
                <button className="sp-text-button" onClick={() => { updateScene(removeShot(scene, shot.id)); setSelectedShotId(''); }} type="button">Remove shot</button>
              </div> : null}
            </> : null}
            <label className="sp-field sp-hook">Opening hook (optional)<input onChange={(event) => { setHook(event.target.value); setDirty(true); }} value={hook} /></label>
            <button aria-expanded={aiOpen} className="sp-text-button" onClick={() => setAiOpen(!aiOpen)} type="button">{aiOpen ? 'Close AI dialogue draft' : 'AI dialogue draft'}</button>
            {aiOpen ? <div className="sp-ai"><p className="sp-hint">Draft Romanian spoken dialogue from your brief, then insert it into the selected scene.</p>{!aiAvailable ? <p className="sp-hint">AI drafting requires a connected workspace.</p> : null}
              {([{ key: 'name', label: 'Brand or property' }, { key: 'location', label: 'Location' }, { key: 'amenities', label: 'Concept and confirmed facts' }, { key: 'targetGuest', label: 'Audience' }, { key: 'bookingCta', label: 'Call to action' }] as const).map((field) => <label className="sp-field" key={field.key}>{field.label}<textarea disabled={generating} onChange={(event) => { setBrief((current) => ({ ...current, [field.key]: event.target.value })); setDirty(true); }} rows={2} value={brief[field.key]} /></label>)}
              <Button disabled={busy || !aiAvailable || !brief.name.trim() || !brief.amenities.trim() || !brief.bookingCta.trim() || !(brief.location || location?.name || '').trim()} icon="sparkles" onClick={() => void draftDialogue()} variant="secondary">{generating ? 'Drafting…' : 'Draft dialogue'}</Button>
              {aiDraft ? <><label className="sp-field">Suggested dialogue<textarea onChange={(event) => setAiDraft(event.target.value)} rows={6} value={aiDraft} /></label><Button disabled={busy || !scene || !aiDraft.trim()} onClick={() => { if (scene) { updateScene({ ...scene, blocks: [...scene.blocks, newBlock('character', 'NARRATOR (V.O.)'), newBlock('dialogue', aiDraft)] }); setAiDraft(''); setAiOpen(false); } }}>Insert into selected scene</Button></> : null}
            </div> : null}
          </aside> : null}
        </div>
      </>}
      <footer className="sp-workspace-footer"><span>{production ? 'Script and floor plan save together · ⌘/Ctrl+S to save' : 'Original text script'}</span><div>{onGenerateMore ? <><select aria-label="Number of script variations" disabled={busy} onChange={(event) => setMoreCount(Number(event.target.value))} value={moreCount}>{[1, 3, 5, 10].map((count) => <option key={count} value={count}>{count} more</option>)}</select><Button disabled={busy || dirty} onClick={() => void onGenerateMore(moreCount).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'Could not generate variations.'))} title={dirty ? 'Save changes before generating variations' : 'Generate new scripts from this saved brief'} variant="secondary">{generatingMore ? 'Generating…' : 'Generate more'}</Button></> : null}{onDelete ? <Button disabled={busy} icon="trash" onClick={() => { if (window.confirm('Delete this script and its production plan?')) void onDelete().catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'Could not delete script.')); }} variant="secondary">Delete script</Button> : null}<Button disabled={busy} onClick={close} variant="secondary">Close</Button></div></footer>
    </div>
  </Modal>;
}
