import { useState, type FormEvent } from 'react';
import { Button } from '@/components/web';
import { engagementStatusLabels, projectFormValues } from '@/lib/engagements';
import type { CreateJobInput, JobSummary, PortalData } from './types';

export function ProjectForm({ project, data, initialClientId, onSave, onCancel }: {
  project?: JobSummary;
  data: PortalData;
  initialClientId?: string;
  onSave: (input: CreateJobInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CreateJobInput>(() => ({ ...projectFormValues(project), ...(!project && initialClientId ? { clientId: initialClientId } : {}) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (changes: Partial<CreateJobInput>) => setForm(current => ({ ...current, ...changes }));
  const agreements = (data.agreements ?? []).filter(item => item.clientId === form.clientId
    && !(data.jobs ?? []).some(job => job.id !== project?.id && job.agreementId === item.id));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (form.startsOn && form.dueOn && form.dueOn < form.startsOn) { setError('The end date must be on or after the start date.'); return; }
    setSaving(true);
    try { await onSave(form); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save the project.'); }
    finally { setSaving(false); }
  };
  return <form className="rm-action-form" onSubmit={submit}>
    {error && <p role="alert" className="rm-feedback rm-feedback--error">{error}</p>}
    <fieldset disabled={saving} className="engagement-form-fields">
      <label className="rm-field"><span>Project name</span><input required autoFocus data-modal-autofocus value={form.name} placeholder="e.g. Arizona Ranch social media" onChange={event => update({ name: event.target.value })}/></label>
      <label className="rm-field"><span>Client</span><select disabled={Boolean(project)} value={form.clientId ?? ''} onChange={event => update({ clientId: event.target.value || undefined, agreementId: undefined, propertyId: undefined, kind: event.target.value ? 'content_campaign' : 'internal' })}>
        <option value="">Internal agency project — no client</option>{(data.clients ?? []).map(client => <option value={client.id} key={client.id}>{client.name}</option>)}
      </select></label>
      <div className="rm-form-grid rm-form-grid--two">
        <label className="rm-field"><span>Project owner</span><select value={form.ownerUserId ?? ''} onChange={event => update({ ownerUserId: event.target.value || undefined })}><option value="">Unassigned</option>{(data.agencyMembers ?? []).filter(member => member.status === 'active').map(member => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></label>
        <label className="rm-field"><span>Project status</span><select value={form.status} onChange={event => update({ status: event.target.value as JobSummary['status'] })}>{Object.entries(engagementStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      {form.clientId && <>
        <label className="rm-field"><span>Contract (optional)</span><select value={form.agreementId ?? ''} onChange={event => {
          const agreement = agreements.find(item => item.id === event.target.value);
          update({ agreementId: agreement?.id, ...(agreement ? { startsOn: agreement.startsOn ?? form.startsOn, dueOn: agreement.endsOn ?? form.dueOn } : {}) });
        }}><option value="">No linked contract</option>{agreements.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
        <label className="rm-field"><span>Property or location (optional)</span><select value={form.propertyId ?? ''} onChange={event => update({ propertyId: event.target.value || undefined })}><option value="">No property</option>{(data.properties ?? []).filter(item => item.clientId === form.clientId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </>}
      <div className="rm-form-grid rm-form-grid--two">
        <label className="rm-field"><span>Starts on (optional)</span><input type="date" value={form.startsOn} onChange={event => update({ startsOn: event.target.value })}/></label>
        <label className="rm-field"><span>Ends on (optional)</span><input type="date" min={form.startsOn || undefined} value={form.dueOn} onChange={event => update({ dueOn: event.target.value })}/></label>
      </div>
      <label className="rm-field"><span>Project brief</span><textarea rows={4} value={form.brief} onChange={event => update({ brief: event.target.value })}/></label>
    </fieldset>
    <footer className="rm-dialog-actions"><Button variant="secondary" disabled={saving} onClick={onCancel}>Cancel</Button><Button type="submit" disabled={saving || !form.name.trim()}>{saving ? 'Saving…' : project ? 'Save project' : 'Create project'}</Button></footer>
  </form>;
}
