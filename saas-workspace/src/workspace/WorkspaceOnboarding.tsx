import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/web/Icon';
import { AgencyAvatar } from './AgencyAvatar';
import { enabledModulesPatch, workspaceSettings, type PresetId } from './agency-settings';
import { uploadAgencyLogo } from './agency-service';
import { modules, presets, type ModuleId } from './modules';
import { WorkspaceLogoPicker } from './WorkspaceLogoPicker';
import { useWorkspace } from './WorkspaceProvider';

const commonTimezones = ['Europe/Bucharest', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Dubai', 'Australia/Sydney', 'UTC'];

export function WorkspaceOnboarding({ onComplete, onCancel, onSignOut }: {
  onComplete: () => void;
  onCancel?: () => void;
  onSignOut?: () => void;
}) {
  const { agency, config, logoUrl, updateAgency, isLive, storageError } = useWorkspace();
  const saved = workspaceSettings(agency?.settings ?? {}).onboarding;
  const reviewing = Boolean(onCancel);
  const [step, setStep] = useState(reviewing || saved.completedAt ? 1 : saved.step);
  const [name, setName] = useState(agency?.name ?? config.name);
  const [timezone, setTimezone] = useState(agency?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [currency, setCurrency] = useState(agency?.default_currency ?? 'EUR');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetId | null>(reviewing ? null : saved.preset);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const previewUrl = useRef<string | null>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);
  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);
  const selectLogo = (file: File | null) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = file ? URL.createObjectURL(file) : null;
    setLogoFile(file); setLogoPreview(previewUrl.current); setError('');
  };
  const timezones = Array.from(new Set([timezone, ...commonTimezones])).sort();
  const currencies = Array.from(new Set([currency, 'EUR', 'RON', 'USD', 'GBP']));
  const presetTools: ModuleId[] | null = preset ? presets[preset].enabled : null;
  const turningOn = presetTools ? modules.filter(tool => presetTools.includes(tool.id) && !config.enabled.includes(tool.id)) : [];
  const turningOff = presetTools ? modules.filter(tool => !presetTools.includes(tool.id) && config.enabled.includes(tool.id)) : [];

  const identity = async () => ({
    name: name.trim(), timezone, default_currency: currency,
    logo_path: logoFile && agency ? await uploadAgencyLogo(agency.id, logoFile) : agency?.logo_path ?? null,
  });

  const continueIdentity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !name.trim()) return;
    if (reviewing) { setStep(2); return; }
    setSaving(true); setError('');
    try {
      await updateAgency({ ...await identity(),
        settings: { workspace: { onboarding: { version: 1, step: 2 } } } });
      selectLogo(null); setStep(2);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save your workspace. Please try again.'); }
    finally { setSaving(false); }
  };
  const choosePreset = async (next: PresetId) => {
    if (saving) return;
    setPreset(next); setError('');
    if (reviewing) return;
    setSaving(true);
    try { await updateAgency({ settings: { workspace: { onboarding: { preset: next } } } }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save your selection. Please try again.'); }
    finally { setSaving(false); }
  };
  const back = async () => {
    if (saving) return;
    if (reviewing) { setStep(1); return; }
    setSaving(true); setError('');
    try {
      await updateAgency({ settings: { workspace: { onboarding: { step: 1 } } } });
      setStep(1);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save your progress. Please try again.'); }
    finally { setSaving(false); }
  };
  const finish = async () => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      if (reviewing) {
        await updateAgency({ ...await identity(), ...(presetTools ? enabledModulesPatch(presetTools) : {}) });
      } else if (preset && presetTools) {
        await updateAgency({ settings: { workspace: {
          enabledModules: [...presetTools],
          onboarding: { version: 1, step: 2, preset, completedAt: saved.completedAt ?? new Date().toISOString() },
        } } });
      }
      onComplete();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not finish setup. Please try again.'); }
    finally { setSaving(false); }
  };

  const choices = <div className="aw-setup__presets" role="group" aria-label="Choose your tools">
    {(Object.entries(presets) as [PresetId, typeof presets[PresetId]][]).map(([id, item]) => <button type="button" key={id} className="aw-setup__preset" aria-pressed={preset === id} disabled={saving} onClick={() => void choosePreset(id)}>
      <span className="aw-setup__preset-top"><Icon name={id === 'production' ? 'camera' : id === 'content' ? 'file' : 'grid'} size={24} /><span className="aw-setup__radio">{preset === id && <Icon name="check" size={13} />}</span></span><strong>{item.label}</strong><span>{item.description}</span><small>{item.enabled.map(tool => modules.find(module => module.id === tool)?.label).join(' · ')}</small>
    </button>)}
  </div>;

  return <main className="aw-setup">
    <div className="aw-setup__top">
      <div className="aw-setup__identity"><AgencyAvatar name={name} logoUrl={logoPreview ?? logoUrl} /><strong>{name.trim() || 'Your workspace'}</strong></div>
      {onCancel ? <button type="button" disabled={saving} onClick={onCancel}>Return to workspace</button>
        : onSignOut ? <button type="button" disabled={saving} onClick={onSignOut}>Sign out</button> : null}
    </div>
    <div className="aw-setup__body">
      <div className="aw-setup__intro"><h1 ref={heading} tabIndex={-1}>{step === 1 ? 'Set up your workspace' : 'Choose your workspace tools'}</h1></div>
      <ol className="aw-setup__steps" aria-label="Setup progress">
        <li aria-current={step === 1 ? 'step' : undefined}><span>{step === 2 ? <Icon name="check" size={15} /> : '1'}</span>Your workspace</li>
        <li aria-current={step === 2 ? 'step' : undefined}><span>2</span>Choose your setup</li>
      </ol>
      {step === 1 ? <form className="aw-setup__panel" onSubmit={continueIdentity}>
        <label className="aw-setup__field"><span>Agency name</span><input autoComplete="organization" maxLength={120} required disabled={saving} value={name} onChange={event => setName(event.target.value)} /></label>
        <WorkspaceLogoPicker name={name} logoUrl={logoPreview ?? logoUrl} fileName={logoFile?.name} available={isLive} disabled={saving} onChange={selectLogo}/>
        <div className="aw-setup__fields"><label className="aw-setup__field"><span>Timezone</span><select disabled={saving} value={timezone} onChange={event => setTimezone(event.target.value)}>{timezones.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label><label className="aw-setup__field"><span>Currency</span><select disabled={saving} value={currency} onChange={event => setCurrency(event.target.value)}>{currencies.map(value => <option key={value}>{value}</option>)}</select></label></div>
        {error && <p className="aw-setup__error" role="alert">{error}</p>}
        <div className="aw-setup__actions"><small>{reviewing ? 'Changes are saved when you finish.' : 'Your progress is saved when you continue.'}</small><button className="aw-setup__primary" type="submit" disabled={saving || !name.trim()}>{saving ? 'Saving…' : 'Continue'}<Icon name="arrow-right" size={17} /></button></div>
      </form> : <section className="aw-setup__panel" aria-label="Workspace setup">
        {reviewing ? <>
          <p>{preset ? `${presets[preset].label} selected.` : 'Your current tools will stay enabled.'}</p>
          <details className="aw-setup__preset-options">
            <summary>Setup presets <Icon name="chevron-down" size={18}/></summary>
            {choices}
          </details>
          {preset && <div className="aw-setup__preset-changes" aria-live="polite">
            {turningOn.length > 0 && <p><strong>Turn on</strong> {turningOn.map(tool => tool.label).join(', ')}</p>}
            {turningOff.length > 0 && <p><strong>Turn off</strong> {turningOff.map(tool => tool.label).join(', ')}</p>}
            {!turningOn.length && !turningOff.length && <p>This preset matches your current tools.</p>}
            <button disabled={saving} type="button" onClick={() => { setPreset(null); setError(''); }}>Keep current tools</button>
          </div>}
        </> : choices}
        {error && <p className="aw-setup__error" role="alert">{error}</p>}
        <div className="aw-setup__actions"><button type="button" disabled={saving} onClick={() => void back()}><Icon name="chevron-left" size={16} />Back</button><button type="button" className="aw-setup__primary" disabled={saving} onClick={() => void finish()}>{saving ? 'Saving…' : reviewing ? preset ? 'Apply preset' : 'Finish setup' : 'Enter workspace'}<Icon name="arrow-right" size={17} /></button></div>
      </section>}
      {!isLive && <p className="aw-setup__footnote">Sample workspace · changes stay in this browser.</p>}
      {storageError && <p className="aw-setup__error" role="status">Your browser could not save preview preferences. They will last for this session only.</p>}
    </div>
  </main>;
}
