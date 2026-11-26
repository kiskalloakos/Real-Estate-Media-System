import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';

import {
  Button,
  Card,
  Icon,
  Modal,
  PageHeader,
  useToast,
} from '@/components/web';
import { downloadScriptPdf } from '@/lib/script-pdf-export';
import { ScreenplayWorkspace, type ScreenplaySave } from '@/components/web/ScreenplayWorkspace';
import { isSupabaseConfigured } from '@/lib/supabase';
import { productionFromDialogue } from '@/lib/screenplay';
import { openProductionDocument } from '@/lib/screenplay-export';
import { listPreviewScripts, storePreviewScripts } from '@/lib/scripting-preview';
import {
  deleteCabanaScript,
  generateCabanaScripts,
  listCabanaScripts,
  saveCabanaScript,
  writeCabanaScript,
  type CabanaScriptBrief,
  type CabanaScriptTone,
  type GeneratedCabanaScriptDocument,
  type SavedCabanaScript,
} from '@/lib/scripting-service';

import type { PropertySummary } from './types';

export interface ScriptingScreenProps {
  properties?: PropertySummary[];
  projectId?: string;
}

const emptyBrief: CabanaScriptBrief = {
  amenities: '',
  avoid: '',
  bookingCta: 'Rezervă din timp prin link-ul din bio, weekendurile bune se ocupă repede.',
  location: '',
  mustMention: '',
  name: '',
  contentTemplate: 'property_showcase',
  targetGuest: 'family',
  tone: 'calm_cinematic',
};

const toneOptions: { label: string; value: CabanaScriptTone }[] = [
  { label: 'Calm cinematic', value: 'calm_cinematic' },
  { label: 'Warm family', value: 'warm_family' },
  { label: 'Premium', value: 'premium' },
  { label: 'Playful', value: 'playful' },
  { label: 'Direct sales', value: 'direct_sales' },
];

function scriptToText(script: GeneratedCabanaScriptDocument) {
  const hooks = script.hooks.length
    ? `${script.hooks.map((hook, index) => `HOOK ${index + 1}:\n${hook}`).join('\n\n')}\n\n`
    : '';

  return `${hooks}${script.script}`.trim();
}

export function ScriptingScreen({ properties = [], projectId }: ScriptingScreenProps) {
  const { notify } = useToast();
  const [brief, setBrief] = useState<CabanaScriptBrief>(() => {
    const project = properties.find(item => item.id === projectId);
    return project ? { ...emptyBrief, clientAccountId: project.clientId, propertyId: project.id, name: project.name, location: project.location, amenities: project.scriptingBrief, mustMention: project.description } : emptyBrief;
  });
  const [selectedPropertyId, setSelectedPropertyId] = useState(projectId ?? '');
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [writerOpen, setWriterOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState('');
  const [editDraft, setEditDraft] = useState<SavedCabanaScript | null>(null);
  const [loadingScripts, setLoadingScripts] = useState(true);
  const [generatingMore, setGeneratingMore] = useState(false);
  const [exportingScriptId, setExportingScriptId] = useState('');
  const [savingScript, setSavingScript] = useState(false);
  const [savedScripts, setSavedScripts] = useState<SavedCabanaScript[]>([]);
  const visibleScripts = projectId ? savedScripts.filter(script => script.propertyId === projectId) : savedScripts;

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => isSupabaseConfigured ? listCabanaScripts() : listPreviewScripts())
      .then((scripts) => {
        if (!cancelled) setSavedScripts(scripts);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Could not load scripts.';
        notify(message, 'error');
      })
      .finally(() => {
        if (!cancelled) setLoadingScripts(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notify]);

  const updateBrief = (key: keyof CabanaScriptBrief, value: string) => {
    setBrief((current) => ({ ...current, [key]: value }));
  };

  const openGenerator = () => {
    setGenerationMessage('');
    setGeneratorOpen(true);
  };

  const openWriter = () => {
    setWriterOpen(true);
  };

  const applyProperty = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    const property = properties.find((item) => item.id === propertyId);
    if (!property) {
      setBrief((current) => ({
        ...current,
        clientAccountId: undefined,
        propertyId: undefined,
      }));
      return;
    }
    setBrief((current) => ({
      ...current,
      amenities: property.scriptingBrief.trim() || current.amenities,
      clientAccountId: property.clientId,
      location: property.location,
      name: property.name,
      propertyId: property.id,
      mustMention: [current.mustMention, property.description].filter(Boolean).join('\n'),
    }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGenerating(true);
    setGenerationMessage('Se generează scripturile. Poate dura 20-60 de secunde.');
    try {
      const generated = await writeCabanaScript(brief);
      const property = properties.find((item) => item.id === selectedPropertyId);
      const saved = await saveCabanaScript({
        brief,
        clientAccountId: property?.clientId ?? brief.clientAccountId ?? null,
        model: generated.model,
        propertyId: selectedPropertyId || brief.propertyId || null,
        script: { ...generated.script, id: '', production: productionFromDialogue(generated.script.script, brief.name) },
        status: 'draft',
      });
      setSavedScripts((current) => [saved, ...current]);
      setGenerationMessage('Scriptul este gata.');
      setGeneratorOpen(false);
      setEditDraft(saved);
      notify('Romanian script written.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not generate script.';
      setGenerationMessage(message);
      notify(message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const exportScript = async (script: GeneratedCabanaScriptDocument) => {
    if (script.production) {
      if (!openProductionDocument(script.title, script.production)) notify('Allow pop-up windows to open the PDF preview.', 'error');
      return;
    }
    setExportingScriptId(script.id);
    try {
      await downloadScriptPdf(script.title || 'Campaign script', scriptToText(script));
      notify('Script exported.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not export script.';
      notify(message, 'error');
    } finally {
      setExportingScriptId('');
    }
  };

  const openSavedScript = (script: SavedCabanaScript) => {
    setEditDraft({ ...script, hooks: [...script.hooks] });
  };

  const handleScriptCardKeyDown = (event: KeyboardEvent<HTMLElement>, script: SavedCabanaScript) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openSavedScript(script);
  };

  const saveWorkspace = async (value: ScreenplaySave) => {
    setSavingScript(true);
    try {
      const propertyId = editDraft?.propertyId ?? projectId ?? value.brief?.propertyId ?? null;
      const clientAccountId = editDraft?.clientAccountId ?? properties.find((item) => item.id === propertyId)?.clientId ?? value.brief?.clientAccountId ?? null;
      const saved: SavedCabanaScript = isSupabaseConfigured
        ? await saveCabanaScript({ ...value, propertyId, clientAccountId, model: editDraft?.model ?? 'manual' })
        : {
            ...value.script, id: value.script.id || crypto.randomUUID(), status: value.status,
            brief: value.brief, propertyId, clientAccountId, model: 'manual',
            approvedAt: value.status === 'approved' ? new Date().toISOString() : null,
            createdAt: editDraft?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString(),
          };
      const updated = [saved, ...savedScripts.filter((script) => script.id !== saved.id)];
      if (!isSupabaseConfigured) storePreviewScripts(updated);
      setSavedScripts(updated);
      setEditDraft(saved);
      setWriterOpen(false);
      notify('Script and production plan saved.');
    } finally {
      setSavingScript(false);
    }
  };

  const archiveEditedScript = async () => {
    if (!editDraft) return;
    setSavingScript(true);
    try {
      if (isSupabaseConfigured) await deleteCabanaScript(editDraft.id);
      else storePreviewScripts(savedScripts.filter((script) => script.id !== editDraft.id));
      setSavedScripts((current) => current.filter((script) => script.id !== editDraft.id));
      setEditDraft(null);
      notify('Script deleted.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not delete script.';
      notify(message, 'error');
    } finally {
      setSavingScript(false);
    }
  };

  const generateMoreFromDraft = async (requestedCount: number) => {
    if (!editDraft?.brief) {
      notify('This script has no saved brief to reuse.', 'error');
      return;
    }
    const count = Math.max(1, Math.min(10, requestedCount || 1));
    setGeneratingMore(true);
    try {
      const newScripts: SavedCabanaScript[] = [];
      for (let index = 0; index < count; index += 1) {
        const generated = await generateCabanaScripts({
          ...editDraft.brief,
          clientAccountId: editDraft.clientAccountId ?? editDraft.brief.clientAccountId,
          generationMode: 'more',
          propertyId: editDraft.propertyId ?? editDraft.brief.propertyId,
          variationIndex: index,
        });
        const saved = await saveCabanaScript({
          brief: editDraft.brief,
          clientAccountId: editDraft.clientAccountId,
          model: generated.model,
          propertyId: editDraft.propertyId,
          script: { ...generated.script, id: '', production: productionFromDialogue(generated.script.script, editDraft.brief.name) },
          status: 'draft',
        });
        newScripts.push(saved);
        setSavedScripts((current) => [saved, ...current]);
      }
      setEditDraft(null);
      notify(`${newScripts.length} more script${newScripts.length === 1 ? '' : 's'} generated.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not generate more scripts.';
      notify(message, 'error');
    } finally {
      setGeneratingMore(false);
    }
  };

  return (
    <div className="rm-page rm-scripting">
      <PageHeader title="Scripts" actions={<div className="rm-scripting__actions">
        <Button icon="plus" onClick={openWriter} variant="secondary">Write script</Button>
        <Button disabled={!isSupabaseConfigured} onClick={openGenerator}>Generate script</Button>
      </div>} />
      {!isSupabaseConfigured ? <p className="sp-hint">Preview workspace · scripts are saved in this browser.</p> : null}

      {visibleScripts.length ? (
        <section className="rm-document-grid" aria-label="Saved scripts">
          {visibleScripts.map((script) => (
            <Card
              aria-label={`Edit ${script.title}`}
              className="rm-document-card rm-document-card--editable rm-scripting-card"
              key={script.id}
              onClick={() => openSavedScript(script)}
              onKeyDown={(event) => handleScriptCardKeyDown(event, script)}
              role="button"
              tabIndex={0}
              tone="bright"
            >
              <div className="rm-document-card__top">
                <span><Icon name="file" size={19} /></span>
              </div>
              <div className="rm-document-card__body">
                <h3>{script.title || 'Generated campaign script'}</h3>
                {script.production ? <small>{script.production.scenes.length} {script.production.scenes.length === 1 ? 'scene' : 'scenes'} · {script.production.locations.length} {script.production.locations.length === 1 ? 'location' : 'locations'}</small> : null}
                <p>{script.script.slice(0, 180)}</p>
              </div>
              <footer>
                <small>
                  {script.status === 'approved' ? 'Approved' : 'Draft'} · Updated{' '}
                  {new Intl.DateTimeFormat('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }).format(new Date(script.updatedAt))}
                </small>
                <Button
                  disabled={exportingScriptId === script.id}
                  icon="download"
                  onClick={(event) => {
                    event.stopPropagation();
                    void exportScript(script);
                  }}
                  variant="secondary"
                >
                  {exportingScriptId === script.id ? 'Exporting...' : 'Export'}
                </Button>
              </footer>
            </Card>
          ))}
        </section>
      ) : loadingScripts ? (
        <Card className="rm-scripting-empty">
          <h2>Loading scripts...</h2>
          <p>Your saved campaign scripts will appear here.</p>
        </Card>
      ) : (
        <Card className="rm-scripting-empty">
          <h2>No script yet</h2>
          <p>Write a screenplay, plan your locations, and connect scenes to camera and talent positions.</p>
        </Card>
      )}

      {editDraft || writerOpen ? (
        <ScreenplayWorkspace
          aiAvailable={isSupabaseConfigured}
          generatingMore={generatingMore}
          initial={editDraft ?? { id: '', title: '', script: '', hooks: [], brief: projectId ? brief : null }}
          onClose={() => { setEditDraft(null); setWriterOpen(false); }}
          onDelete={editDraft ? archiveEditedScript : undefined}
          onGenerateMore={editDraft?.brief && isSupabaseConfigured ? generateMoreFromDraft : undefined}
          onSave={saveWorkspace}
          saving={savingScript}
        />
      ) : null}

      <Modal
        description="Generate Romanian spoken dialogue, then organize it into screenplay scenes and plan the shoot."
        onClose={() => {
          if (!generating) setGeneratorOpen(false);
        }}
        open={generatorOpen}
        title="Generate campaign script"
        wide
      >
        <form className="rm-form-grid rm-scripting-form" onSubmit={submit}>
          {generationMessage && !generating ? (
            <div
              className={`rm-scripting-modal-state ${generationMessage === 'Scriptul este gata.' ? 'is-ready' : 'is-error'}`}
              role="status"
            >
              <span>{generationMessage}</span>
            </div>
          ) : null}

          {properties.length && !projectId ? (
            <label className="rm-field rm-form-grid__wide">
              <span>Existing property</span>
              <select onChange={(event) => applyProperty(event.target.value)} value={selectedPropertyId}>
                <option value="">Start from blank brief</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>{property.name} · {property.location}</option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="rm-field">
            <span>Brand, business or property</span>
            <input autoFocus onChange={(event) => updateBrief('name', event.target.value)} required value={brief.name} />
          </label>
          <label className="rm-field">
            <span>Script template</span>
            <select onChange={(event) => updateBrief('contentTemplate', event.target.value)} value={brief.contentTemplate}>
              <option value="property_showcase">Property showcase</option>
              <option value="personal_brand">Personal brand</option>
              <option value="service_explainer">Service explainer</option>
              <option value="testimonial">Testimonial</option>
              <option value="campaign_offer">Campaign offer</option>
            </select>
          </label>
          <label className="rm-field">
            <span>Location</span>
            <input onChange={(event) => updateBrief('location', event.target.value)} required value={brief.location} />
          </label>
          <label className="rm-field rm-form-grid__wide">
            <span>Offer, proof points or visual assets</span>
            <textarea onChange={(event) => updateBrief('amenities', event.target.value)} required rows={4} value={brief.amenities} />
          </label>
          <label className="rm-field">
            <span>Audience</span>
            <input onChange={(event) => updateBrief('targetGuest', event.target.value)} value={brief.targetGuest} />
          </label>
          <label className="rm-field">
            <span>Call to action</span>
            <input onChange={(event) => updateBrief('bookingCta', event.target.value)} required value={brief.bookingCta} />
          </label>
          <label className="rm-field">
            <span>Tone</span>
            <select onChange={(event) => updateBrief('tone', event.target.value)} value={brief.tone}>
              {toneOptions.map((tone) => <option key={tone.value} value={tone.value}>{tone.label}</option>)}
            </select>
          </label>
          <label className="rm-field rm-form-grid__wide">
            <span>Must include</span>
            <textarea onChange={(event) => updateBrief('mustMention', event.target.value)} rows={3} value={brief.mustMention} />
          </label>
          <label className="rm-field rm-form-grid__wide">
            <span>Avoid</span>
            <textarea onChange={(event) => updateBrief('avoid', event.target.value)} rows={3} value={brief.avoid} />
          </label>

          <footer className="rm-dialog-actions rm-form-grid__wide">
            <Button disabled={generating} onClick={() => setGeneratorOpen(false)} variant="secondary">Cancel</Button>
            <div className="rm-scripting-submit">
              {generating ? (
                <span className="rm-scripting-submit__message" role="status">
                  <span aria-hidden="true" className="rm-scripting-spinner" />
                  Se generează scripturile. Poate dura 20-60 de secunde.
                </span>
              ) : null}
              <Button disabled={generating} icon="sparkles" type="submit">{generating ? 'Generating...' : 'Generate script'}</Button>
            </div>
          </footer>
        </form>
      </Modal>
    </div>
  );
}
