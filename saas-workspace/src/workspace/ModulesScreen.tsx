import { useEffect, useState, type FormEvent } from 'react';

import { Icon } from '@/components/web/Icon';
import { supabase } from '@/lib/supabase';

import { modules, presets, type ModuleId } from './modules';
import { useWorkspace } from './WorkspaceProvider';

type AgencySettings = {
  notificationWording?: { deliveryReady?: string; reviewReady?: string };
  servicePackages?: { deliverables: string; monthlyPrice: string; name: string }[];
  workflowDefaults?: { defaultAssigneeRole?: string; reviewDueDays?: string; taskDueDays?: string };
};

function readSettings(value: unknown): AgencySettings {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AgencySettings : {};
}

function packagesToText(packages: AgencySettings['servicePackages']) {
  return (packages ?? []).map((item) => [item.name, item.monthlyPrice, item.deliverables].join(' | ')).join('\n');
}

function packagesFromText(value: string) {
  return value.split('\n').map((line) => line.split('|').map((part) => part.trim()))
    .filter(([name]) => Boolean(name))
    .map(([name, monthlyPrice = '', deliverables = '']) => ({ deliverables, monthlyPrice, name }));
}

export function ModulesScreen({ agencyId }: { agencyId?: string | null }) {
  const { config, save, storageError } = useWorkspace();
  const [name, setName] = useState(config.name);
  const [message, setMessage] = useState('');
  const [presetMessage, setPresetMessage] = useState('');
  const [loading, setLoading] = useState(Boolean(agencyId));
  const [saving, setSaving] = useState(false);
  const [agencyLoaded, setAgencyLoaded] = useState(false);
  const [error, setError] = useState('');
  const [storedSettings, setStoredSettings] = useState<AgencySettings>({});
  const [form, setForm] = useState({
    currency: 'RON', deliveryReady: 'Your final files are ready to download.', legalName: '',
    logo: null as File | null, logoPath: '', packageLines: '', reviewDueDays: '2',
    reviewReady: 'A new version is ready for your approval.', taskDueDays: '3',
    timezone: 'Europe/Bucharest', workflowRole: 'account_manager',
  });

  useEffect(() => {
    setAgencyLoaded(false); setError('');
    if (!agencyId || !supabase) { setLoading(false); return; }
    setLoading(true);
    let cancelled = false;
    void supabase.from('agencies').select('name, legal_name, logo_path, timezone, default_currency, settings').eq('id', agencyId).maybeSingle()
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) { setError(`Could not load agency settings: ${queryError.message}`); setLoading(false); return; }
        if (!data) { setError('Agency settings were not found or you do not have access.'); setLoading(false); return; }
        const settings = readSettings(data.settings);
        setAgencyLoaded(true);
        setStoredSettings(settings);
        setName(data.name);
        setForm((current) => ({
          ...current, currency: data.default_currency, legalName: data.legal_name ?? '', logoPath: data.logo_path ?? '', timezone: data.timezone,
          packageLines: packagesToText(settings.servicePackages),
          reviewReady: settings.notificationWording?.reviewReady ?? current.reviewReady,
          deliveryReady: settings.notificationWording?.deliveryReady ?? current.deliveryReady,
          workflowRole: settings.workflowDefaults?.defaultAssigneeRole ?? current.workflowRole,
          taskDueDays: settings.workflowDefaults?.taskDueDays ?? current.taskDueDays,
          reviewDueDays: settings.workflowDefaults?.reviewDueDays ?? current.reviewDueDays,
        }));
        setLoading(false);
      }, (caught: unknown) => {
        if (cancelled) return;
        setError(`Could not load agency settings: ${caught instanceof Error ? caught.message : 'Connection failed.'}`);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [agencyId]);

  const canEditAgency = Boolean(agencyId && supabase && agencyLoaded && !loading && !saving);
  const update = (changes: Partial<typeof form>) => setForm((current) => ({ ...current, ...changes }));
  const toggle = (id: ModuleId) => { setPresetMessage(''); save({ ...config, enabled: config.enabled.includes(id) ? config.enabled.filter((item) => item !== id) : [...config.enabled, id] }); };
  const move = (id: ModuleId, direction: number) => {
    const order = [...config.order]; const index = order.indexOf(id); const target = index + direction;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]]; setPresetMessage(''); save({ ...config, order });
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!canEditAgency || !agencyId || !supabase) return;
    setSaving(true); setError(''); setMessage('');
    try {
      let logoPath = form.logoPath || null;
      if (form.logo) {
        logoPath = `${agencyId}/branding/${Date.now()}-${form.logo.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
        const { error: uploadError } = await supabase.storage.from('agency-files').upload(logoPath, form.logo, { upsert: true });
        if (uploadError) throw new Error(`Could not upload logo: ${uploadError.message}`);
      }
      const settings: AgencySettings = {
        ...storedSettings,
        notificationWording: { deliveryReady: form.deliveryReady.trim(), reviewReady: form.reviewReady.trim() },
        servicePackages: packagesFromText(form.packageLines),
        workflowDefaults: { defaultAssigneeRole: form.workflowRole, reviewDueDays: form.reviewDueDays, taskDueDays: form.taskDueDays },
      };
      const { error: updateError } = await supabase.from('agencies').update({ default_currency: form.currency, legal_name: form.legalName.trim() || null, logo_path: logoPath, name: name.trim(), settings, timezone: form.timezone }).eq('id', agencyId).select('id').single();
      if (updateError) throw new Error(`Could not save agency settings: ${updateError.message}`);
      save({ ...config, name: name.trim() }); setStoredSettings(settings); setForm((current) => ({ ...current, logo: null, logoPath: logoPath ?? '' })); setMessage('Agency settings saved.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save agency settings.'); } finally { setSaving(false); }
  };

  return <div className="aw-page aw-settings-page">
    <div className="aw-eyebrow">MAKE IT YOURS</div>
    <div className="aw-heading"><div><h1>Workspace settings</h1><p>Set the agency identity, operating defaults, and workspace modules.</p></div><span className="aw-tag">{config.enabled.length} modules enabled</span></div>
    <form className="rm-profile-form aw-agency-settings" onSubmit={submit}>
      <div className="aw-section-heading"><h2>Agency configuration</h2><span>Applies to this agency workspace.</span></div>
      {loading ? <p>Loading agency settings…</p> : null}{error ? <p className="rm-feedback rm-feedback--warning">{error}</p> : null}
      <div className="rm-form-grid rm-form-grid--two">
        <label className="rm-field"><span>Agency name</span><input disabled={!canEditAgency} maxLength={60} required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="rm-field"><span>Legal name</span><input disabled={!canEditAgency} value={form.legalName} onChange={(event) => update({ legalName: event.target.value })} /></label>
        <label className="rm-field"><span>Timezone</span><select disabled={!canEditAgency} value={form.timezone} onChange={(event) => update({ timezone: event.target.value })}><option value="Europe/Bucharest">Europe/Bucharest</option><option value="Europe/London">Europe/London</option><option value="Europe/Paris">Europe/Paris</option><option value="America/New_York">America/New_York</option></select></label>
        <label className="rm-field"><span>Default currency</span><select disabled={!canEditAgency} value={form.currency} onChange={(event) => update({ currency: event.target.value })}><option value="RON">RON</option><option value="EUR">EUR</option><option value="USD">USD</option><option value="GBP">GBP</option></select></label>
        <label className="rm-field rm-form-grid__wide"><span>Logo</span><input accept="image/*" disabled={!canEditAgency} onChange={(event) => update({ logo: event.target.files?.[0] ?? null })} type="file" /><small>{form.logo ? form.logo.name : form.logoPath ? 'Current logo saved' : 'Optional. Used for client-facing branding.'}</small></label>
      </div>
      <div className="aw-section-heading"><h2>Workflow defaults</h2><span>Saved preferences; automatic task and review defaults are not connected yet.</span></div>
      <div className="rm-form-grid rm-form-grid--three"><label className="rm-field"><span>Default owner role</span><select disabled={!canEditAgency} value={form.workflowRole} onChange={(event) => update({ workflowRole: event.target.value })}><option value="account_manager">Account manager</option><option value="producer">Producer</option><option value="videographer">Videographer</option><option value="editor">Editor</option></select></label><label className="rm-field"><span>Task due in days</span><input disabled={!canEditAgency} min="0" onChange={(event) => update({ taskDueDays: event.target.value })} type="number" value={form.taskDueDays} /></label><label className="rm-field"><span>Review due in days</span><input disabled={!canEditAgency} min="0" onChange={(event) => update({ reviewDueDays: event.target.value })} type="number" value={form.reviewDueDays} /></label></div>
      <div className="aw-section-heading"><h2>Service packages</h2><span>Saved templates; not connected to client creation yet. Name | Price | Deliverables.</span></div>
      <label className="rm-field"><span>Package defaults</span><textarea disabled={!canEditAgency} onChange={(event) => update({ packageLines: event.target.value })} placeholder={'Property launch | 4500 | 1 shoot, 8 videos, 20 photos\nMonthly content | 7200 | 1 shoot, 16 videos, reporting'} rows={4} value={form.packageLines} /></label>
      <div className="aw-section-heading"><h2>Client notification wording</h2><span>Saved wording; not connected to outgoing notifications yet.</span></div>
      <div className="rm-form-grid rm-form-grid--two"><label className="rm-field"><span>Review ready</span><input disabled={!canEditAgency} onChange={(event) => update({ reviewReady: event.target.value })} value={form.reviewReady} /></label><label className="rm-field"><span>Delivery ready</span><input disabled={!canEditAgency} onChange={(event) => update({ deliveryReady: event.target.value })} value={form.deliveryReady} /></label></div>
      <div className="rm-dialog-actions"><span role="status">{message}</span><button className="aw-button" disabled={!canEditAgency || !name.trim()} type="submit">{saving ? 'Saving…' : 'Save agency settings'}</button></div>
    </form>
    <div className="aw-section-heading"><h2>Start with a setup</h2><span>You can change every module below.</span></div>
    {presetMessage ? <p className="aw-settings-notice" role="status">{presetMessage}</p> : null}
    <div className="aw-presets">{Object.entries(presets).map(([key, preset]) => <button key={key} className="aw-preset" onClick={() => { save({ ...config, enabled: [...preset.enabled] }); setPresetMessage(`${preset.label} setup applied.`); }} type="button"><Icon name={key === 'production' ? 'camera' : key === 'content' ? 'file' : 'grid'} size={22}/><strong>{preset.label}</strong><span>{preset.description}</span><small>Apply setup <Icon name="arrow-right" size={14}/></small></button>)}</div>
    <div className="aw-section-heading"><h2>Workspace modules</h2><span>Home and agency settings are always available.</span></div>
    <div className="aw-module-list">{config.order.map((id, index) => { const module = modules.find((item) => item.id === id)!; const enabled = config.enabled.includes(id); return <div className="aw-module-row" key={id}><span className="aw-module-icon"><Icon name={module.icon}/></span><div className="aw-module-copy"><strong>{module.label}</strong><p>{module.description}</p></div><div className="aw-reorder"><button aria-label={`Move ${module.label} up`} disabled={index === 0} onClick={() => move(id, -1)} type="button"><Icon name="chevron-up" size={16}/></button><button aria-label={`Move ${module.label} down`} disabled={index === config.order.length - 1} onClick={() => move(id, 1)} type="button"><Icon name="chevron-down" size={16}/></button></div><span className="aw-module-state">{enabled ? 'On' : 'Off'}</span><button className="aw-module-toggle" role="switch" aria-label={`Enable ${module.label}`} aria-checked={enabled} onClick={() => toggle(id)} type="button"><span className="aw-module-toggle__thumb"/></button></div>; })}</div>
    <p className="aw-footnote" role="status">{storageError ? 'Your browser could not save module preferences. They will last for this session only.' : 'Module layout is saved in this browser. Agency configuration is saved to the shared agency workspace.'}</p>
  </div>;
}
