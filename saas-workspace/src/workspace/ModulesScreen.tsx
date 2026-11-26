import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Icon } from '@/components/web/Icon';
import { uploadAgencyLogo } from './agency-service';

import { modules, type ModuleId } from './modules';
import { workspaceModuleGroup, workspaceModuleGroups } from './navigation';
import { WorkspaceLogoPicker } from './WorkspaceLogoPicker';
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

export function ModulesScreen({ onStartSetup }: { onStartSetup: () => void }) {
  const { config, save, saveModules, storageError, agency, logoUrl, loading, error: loadError, retry, updateAgency, isLive } = useWorkspace();
  const [name, setName] = useState(config.name);
  const [message, setMessage] = useState('');
  const [moduleMessage, setModuleMessage] = useState('');
  const [moduleError, setModuleError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const loadedAgencyId = useRef<string | null>(null);
  const [form, setForm] = useState({
    currency: 'RON', deliveryReady: 'Your final files are ready to download.', legalName: '',
    logo: null as File | null, logoPath: '', packageLines: '', reviewDueDays: '2',
    reviewReady: 'A new version is ready for your approval.', taskDueDays: '3',
    timezone: 'Europe/Bucharest', workflowRole: 'account_manager',
  });

  useEffect(() => {
    if (!agency || loadedAgencyId.current === agency.id) return;
    loadedAgencyId.current = agency.id;
    const settings = readSettings(agency.settings);
    setName(agency.name);
    setForm((current) => ({
      ...current, currency: agency.default_currency, legalName: agency.legal_name ?? '', logoPath: agency.logo_path ?? '', timezone: agency.timezone,
      packageLines: packagesToText(settings.servicePackages),
      reviewReady: settings.notificationWording?.reviewReady ?? current.reviewReady,
      deliveryReady: settings.notificationWording?.deliveryReady ?? current.deliveryReady,
      workflowRole: settings.workflowDefaults?.defaultAssigneeRole ?? current.workflowRole,
      taskDueDays: settings.workflowDefaults?.taskDueDays ?? current.taskDueDays,
      reviewDueDays: settings.workflowDefaults?.reviewDueDays ?? current.reviewDueDays,
    }));
  }, [agency]);

  const canEditAgency = Boolean(agency && !loading && !saving);
  const update = (changes: Partial<typeof form>) => setForm((current) => ({ ...current, ...changes }));
  const toggle = async (id: ModuleId) => {
    if (!canEditAgency) return;
    const enabled = config.enabled.includes(id) ? config.enabled.filter(item => item !== id) : [...config.enabled, id];
    setSaving(true); setModuleError(''); setModuleMessage('');
    try { await saveModules(enabled); setModuleMessage('Workspace tools saved.'); }
    catch (caught) { setModuleError(caught instanceof Error ? caught.message : 'Could not save workspace tools. Try again.'); }
    finally { setSaving(false); }
  };
  const move = (id: ModuleId, direction: number) => {
    const group = workspaceModuleGroup(id);
    if (group === 'Workspace') return;
    const siblings = config.order.filter(item => workspaceModuleGroup(item) === group);
    const sibling = siblings[siblings.indexOf(id) + direction];
    if (!sibling) return;
    const order = [...config.order]; const index = order.indexOf(id); const target = order.indexOf(sibling);
    [order[index], order[target]] = [order[target], order[index]]; setModuleMessage(''); save({ ...config, order });
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!canEditAgency || !agency) return;
    setSaving(true); setError(''); setMessage('');
    try {
      let logoPath = form.logoPath || null;
      if (form.logo) {
        logoPath = await uploadAgencyLogo(agency.id, form.logo);
      }
      const settings: AgencySettings = {
        notificationWording: { deliveryReady: form.deliveryReady.trim(), reviewReady: form.reviewReady.trim() },
        servicePackages: packagesFromText(form.packageLines),
        workflowDefaults: { defaultAssigneeRole: form.workflowRole, reviewDueDays: form.reviewDueDays, taskDueDays: form.taskDueDays },
      };
      await updateAgency({ default_currency: form.currency, legal_name: form.legalName.trim() || null, logo_path: logoPath, name: name.trim(), settings, timezone: form.timezone });
      setForm((current) => ({ ...current, logo: null, logoPath: logoPath ?? '' })); setMessage('Agency settings saved.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save agency settings.'); } finally { setSaving(false); }
  };

  return <div className="aw-page aw-settings-page">
    <div className="aw-heading"><h1>Workspace settings</h1></div>
    {loadError ? <p role="alert">{loadError.message} <button type="button" onClick={retry}>Try again</button></p> : null}
    <div className="aw-section-heading"><h2>Workspace modules</h2><span>{config.enabled.length} enabled</span></div>
    <span className="rm-visually-hidden" role="status">{moduleMessage}</span>
    {moduleError && <p className="rm-feedback rm-feedback--warning" role="alert">{moduleError}</p>}
    {workspaceModuleGroups.map(group => {
      const siblings = config.order.filter(id => workspaceModuleGroup(id) === group);
      return <section key={group} aria-label={`${group} modules`}>
        <div className="aw-section-heading"><h3>{group}</h3></div>
        <div className="aw-module-list">{siblings.map((id, index) => {
          const module = modules.find(item => item.id === id)!;
          const enabled = config.enabled.includes(id);
          return <div className="aw-module-row" key={id}>
            <span className="aw-module-icon"><Icon name={module.icon}/></span>
            <div className="aw-module-copy"><strong>{module.label}</strong><p>{module.description}</p></div>
            <div className="aw-module-controls">
              {group !== 'Workspace' && <div className="aw-reorder">
                <button aria-label={`Move ${module.label} up`} disabled={index === 0 || saving} onClick={() => move(id, -1)} type="button"><Icon name="chevron-up" size={16}/></button>
                <button aria-label={`Move ${module.label} down`} disabled={index === siblings.length - 1 || saving} onClick={() => move(id, 1)} type="button"><Icon name="chevron-down" size={16}/></button>
              </div>}
              <span className="aw-module-state" aria-hidden="true">{enabled ? 'On' : 'Off'}</span>
              <button className="aw-module-toggle" role="switch" aria-label={`Enable ${module.label}`} aria-checked={enabled} disabled={!canEditAgency} onClick={() => void toggle(id)} type="button"><span className="aw-module-toggle__thumb"/></button>
            </div>
          </div>;
        })}</div>
      </section>;
    })}
    <details className="aw-settings-setup">
      <summary>Guided setup <Icon name="chevron-down" size={18}/></summary>
      <div>
        <p>Review your agency details or choose a setup preset.</p>
        <button type="button" className="aw-button aw-button-secondary" disabled={!canEditAgency} onClick={onStartSetup}>Set up workspace</button>
      </div>
    </details>
    <form className="rm-profile-form aw-agency-settings" onSubmit={submit}>
      <div className="aw-section-heading"><h2>Agency configuration</h2><span>Applies to this agency workspace.</span></div>
      {loading ? <p role="status">Loading agency settings…</p> : null}
      <div className="rm-form-grid rm-form-grid--two">
        <label className="rm-field"><span>Agency name</span><input disabled={!canEditAgency} maxLength={120} required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="rm-field"><span>Legal name</span><input disabled={!canEditAgency} value={form.legalName} onChange={(event) => update({ legalName: event.target.value })} /></label>
        <label className="rm-field"><span>Timezone</span><select disabled={!canEditAgency} value={form.timezone} onChange={(event) => update({ timezone: event.target.value })}>{Array.from(new Set([form.timezone, 'Europe/Bucharest', 'Europe/London', 'Europe/Paris', 'America/New_York'])).map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="rm-field"><span>Default currency</span><select disabled={!canEditAgency} value={form.currency} onChange={(event) => update({ currency: event.target.value })}>{Array.from(new Set([form.currency, 'RON', 'EUR', 'USD', 'GBP'])).map(value => <option key={value}>{value}</option>)}</select></label>
        <WorkspaceLogoPicker name={name} logoUrl={logoUrl} fileName={form.logo?.name} available={isLive} disabled={!canEditAgency} onChange={logo => update({ logo })}/>
      </div>
      <div className="aw-section-heading"><h2>Workflow defaults</h2><span>Saved preferences; automatic task and review defaults are not connected yet.</span></div>
      <div className="rm-form-grid rm-form-grid--three"><label className="rm-field"><span>Default owner role</span><select disabled={!canEditAgency} value={form.workflowRole} onChange={(event) => update({ workflowRole: event.target.value })}><option value="account_manager">Account manager</option><option value="producer">Producer</option><option value="videographer">Videographer</option><option value="editor">Editor</option></select></label><label className="rm-field"><span>Task due in days</span><input disabled={!canEditAgency} min="0" onChange={(event) => update({ taskDueDays: event.target.value })} type="number" value={form.taskDueDays} /></label><label className="rm-field"><span>Review due in days</span><input disabled={!canEditAgency} min="0" onChange={(event) => update({ reviewDueDays: event.target.value })} type="number" value={form.reviewDueDays} /></label></div>
      <div className="aw-section-heading"><h2>Service packages</h2><span>Saved templates; not connected to client creation yet. Name | Price | Deliverables.</span></div>
      <label className="rm-field"><span>Package defaults</span><textarea disabled={!canEditAgency} onChange={(event) => update({ packageLines: event.target.value })} placeholder={'Property launch | 4500 | 1 shoot, 8 videos, 20 photos\nMonthly content | 7200 | 1 shoot, 16 videos, reporting'} rows={4} value={form.packageLines} /></label>
      <div className="aw-section-heading"><h2>Client notification wording</h2><span>Saved wording; not connected to outgoing notifications yet.</span></div>
      <div className="rm-form-grid rm-form-grid--two"><label className="rm-field"><span>Review ready</span><input disabled={!canEditAgency} onChange={(event) => update({ reviewReady: event.target.value })} value={form.reviewReady} /></label><label className="rm-field"><span>Delivery ready</span><input disabled={!canEditAgency} onChange={(event) => update({ deliveryReady: event.target.value })} value={form.deliveryReady} /></label></div>
      {error && <p className="rm-feedback rm-feedback--warning" role="alert">{error}</p>}
      <div className="rm-dialog-actions"><span role="status">{message}</span><button className="aw-button" disabled={!canEditAgency || !name.trim()} type="submit">{saving ? 'Saving…' : 'Save agency settings'}</button></div>
    </form>
    <p className="aw-footnote" role="status">{storageError ? 'Your browser could not save preferences. They will last for this session only.' : isLive ? 'Agency details and enabled tools are shared across your workspace. Sidebar mode and tool order are personal to this browser.' : 'Sample workspace. Changes are saved only in this browser.'}</p>
  </div>;
}
