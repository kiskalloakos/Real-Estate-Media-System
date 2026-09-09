import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';

import {
  Button,
  Card,
  Icon,
  Modal,
  useToast,
} from '@/components/web';
import { downloadScriptPdf } from '@/lib/script-pdf-export';
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

export function ScriptingScreen({ properties = [] }: ScriptingScreenProps) {
  const { notify } = useToast();
  const [brief, setBrief] = useState<CabanaScriptBrief>(emptyBrief);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [writerOpen, setWriterOpen] = useState(false);
  const [writerForm, setWriterForm] = useState({ hook: '', script: '', title: '' });
  const [generating, setGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState('');
  const [editDraft, setEditDraft] = useState<SavedCabanaScript | null>(null);
  const [loadingScripts, setLoadingScripts] = useState(true);
  const [moreCount, setMoreCount] = useState('3');
  const [generatingMore, setGeneratingMore] = useState(false);
  const [exportingScriptId, setExportingScriptId] = useState('');
  const [savingScript, setSavingScript] = useState(false);
  const [savedScripts, setSavedScripts] = useState<SavedCabanaScript[]>([]);

  useEffect(() => {
    let cancelled = false;
    listCabanaScripts()
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
    setWriterForm({ hook: '', script: '', title: '' });
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
        script: { ...generated.script, id: '' },
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

  const updateDraftHook = (index: number, value: string) => {
    setEditDraft((current) => {
      if (!current) return current;
      const hooks = [...current.hooks];
      hooks[index] = value;
      return { ...current, hooks };
    });
  };

  const saveEditedScript = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editDraft) return;
    setSavingScript(true);
    try {
      const saved = await saveCabanaScript({
        brief: editDraft.brief,
        clientAccountId: editDraft.clientAccountId,
        model: editDraft.model,
        propertyId: editDraft.propertyId,
        script: editDraft,
        status: editDraft.status,
      });
      setSavedScripts((current) => current.map((script) => script.id === saved.id ? saved : script));
      setEditDraft(null);
      notify('Script saved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save script.';
      notify(message, 'error');
    } finally {
      setSavingScript(false);
    }
  };

  const saveWrittenScript = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingScript(true);
    try {
      const saved = await saveCabanaScript({
        model: 'manual',
        script: {
          hooks: writerForm.hook.trim() ? [writerForm.hook.trim()] : [],
          id: '',
          script: writerForm.script.trim(),
          title: writerForm.title.trim() || 'Written campaign script',
        },
        status: 'draft',
      });
      setSavedScripts((current) => [saved, ...current]);
      setWriterOpen(false);
      setWriterForm({ hook: '', script: '', title: '' });
      notify('Script saved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save script.';
      notify(message, 'error');
    } finally {
      setSavingScript(false);
    }
  };

  const archiveEditedScript = async () => {
    if (!editDraft) return;
    setSavingScript(true);
    try {
      await deleteCabanaScript(editDraft.id);
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

  const generateMoreFromDraft = async () => {
    if (!editDraft?.brief) {
      notify('This script has no saved brief to reuse.', 'error');
      return;
    }
    const count = Math.max(1, Math.min(10, Number(moreCount) || 1));
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
          script: { ...generated.script, id: '' },
          status: 'draft',
        });
        newScripts.push(saved);
      }
      setSavedScripts((current) => [...newScripts, ...current]);
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
      <div className="rm-scripting__actions">
        <Button icon="plus" onClick={openWriter} variant="secondary">Write script</Button>
        <Button icon="sparkles" onClick={openGenerator}>Generate script</Button>
      </div>

      {savedScripts.length ? (
        <section className="rm-document-grid" aria-label="Generated scripts">
          {savedScripts.map((script) => (
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
          <p>Create the first Romanian campaign script from a complete client brief.</p>
        </Card>
      )}

      <Modal
        onClose={() => setEditDraft(null)}
        open={Boolean(editDraft)}
        title="Edit script"
        wide
      >
        {editDraft ? (
          <form className="rm-document-form rm-scripting-editor" onSubmit={saveEditedScript}>
            <label className="rm-field">
              <span>Status</span>
              <select
                onChange={(event) => setEditDraft((current) =>
                  current ? {
                    ...current,
                    approvedAt: event.target.value === 'approved' ? current.approvedAt ?? new Date().toISOString() : null,
                    status: event.target.value as SavedCabanaScript['status'],
                  } : current)}
                value={editDraft.status}
              >
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
              </select>
            </label>
            {[0].map((index) => (
              <label className="rm-field rm-form-grid__wide" key={index}>
                <span>Hook</span>
                <input
                  autoFocus={index === 0}
                  onChange={(event) => updateDraftHook(index, event.target.value)}
                  value={editDraft.hooks[index] ?? ''}
                />
              </label>
            ))}
            <label className="rm-field rm-form-grid__wide">
              <span>Script</span>
              <textarea
                onChange={(event) => setEditDraft((current) => current ? { ...current, script: event.target.value } : current)}
                required
                rows={14}
                value={editDraft.script}
              />
            </label>
            <div className="rm-scripting-more rm-form-grid__wide">
              <label className="rm-field">
                <span>Generate more</span>
                <select disabled={generatingMore || savingScript} onChange={(event) => setMoreCount(event.target.value)} value={moreCount}>
                  <option value="1">1 more</option>
                  <option value="3">3 more</option>
                  <option value="5">5 more</option>
                  <option value="10">10 more</option>
                </select>
              </label>
              <Button
                disabled={generatingMore || savingScript || !editDraft.brief}
                icon="sparkles"
                onClick={() => void generateMoreFromDraft()}
                variant="secondary"
              >
                {generatingMore ? 'Generating...' : 'Generate more'}
              </Button>
              {generatingMore ? (
                <span className="rm-scripting-submit__message" role="status">
                  <span aria-hidden="true" className="rm-scripting-spinner" />
                  Se generează mai multe scripturi.
                </span>
              ) : null}
            </div>
            <footer className="rm-dialog-actions rm-form-grid__wide">
              <Button disabled={savingScript || generatingMore} onClick={archiveEditedScript} variant="secondary">Delete</Button>
              <Button disabled={savingScript || generatingMore} onClick={() => setEditDraft(null)} variant="secondary">Cancel</Button>
              <Button disabled={savingScript || generatingMore || exportingScriptId === editDraft.id} icon="download" onClick={() => void exportScript(editDraft)} variant="secondary">
                {exportingScriptId === editDraft.id ? 'Exporting...' : 'Export'}
              </Button>
              <Button disabled={savingScript || generatingMore || !editDraft.script.trim()} type="submit">
                {savingScript ? 'Saving...' : 'Save script'}
              </Button>
            </footer>
          </form>
        ) : null}
      </Modal>

      <Modal
        description="Write and save a script yourself. This does not call the AI writer."
        onClose={() => {
          if (!savingScript) setWriterOpen(false);
        }}
        open={writerOpen}
        title="Write script"
        wide
      >
        <form className="rm-form-grid rm-scripting-form" onSubmit={saveWrittenScript}>
          <label className="rm-field rm-form-grid__wide">
            <span>Title</span>
            <input
              autoFocus
              onChange={(event) => setWriterForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="e.g. Arizona Ranch — weekend pentru familie"
              value={writerForm.title}
            />
          </label>
          <label className="rm-field rm-form-grid__wide">
            <span>Hook</span>
            <input
              onChange={(event) => setWriterForm((current) => ({ ...current, hook: event.target.value }))}
              placeholder="Optional opening line"
              value={writerForm.hook}
            />
          </label>
          <label className="rm-field rm-form-grid__wide">
            <span>Script</span>
            <textarea
              onChange={(event) => setWriterForm((current) => ({ ...current, script: event.target.value }))}
              required
              rows={14}
              value={writerForm.script}
            />
          </label>
          <footer className="rm-dialog-actions rm-form-grid__wide">
            <Button disabled={savingScript} onClick={() => setWriterOpen(false)} variant="secondary">Cancel</Button>
            <Button disabled={savingScript || !writerForm.script.trim()} type="submit">
              {savingScript ? 'Saving...' : 'Save script'}
            </Button>
          </footer>
        </form>
      </Modal>

      <Modal
        description="Complete the brief before AI generation. The result will be one Romanian script with natural line breaks."
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

          {properties.length ? (
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
