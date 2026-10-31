import { useState } from 'react';
import { Button, Modal } from '@/components/web';
import { portalLocationUrl } from '@/lib/portal-location';
import { taskContext, taskStatusLabels, taskUpdateInput } from '@/lib/task-workspace';
import type { TaskAttachment, TaskSummary, UpdateTaskInput } from './types';

interface TaskDetailsDrawerProps {
  task: TaskSummary;
  assignees: { id: string; name: string }[];
  canManage: boolean;
  canReassign: boolean;
  onClose: () => void;
  onEdit: () => void;
  onOpenAttachment: (attachment: TaskAttachment) => void;
  onOpenClient?: (id: string) => void;
  onSave?: (input: UpdateTaskInput) => Promise<void>;
}

export function TaskDetailsDrawer({ task, assignees, canManage, canReassign, onClose, onEdit, onOpenAttachment, onOpenClient, onSave }: TaskDetailsDrawerProps) {
  const [form, setForm] = useState(() => taskUpdateInput(task));
  const [baseline, setBaseline] = useState(form);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const update = (changes: Partial<UpdateTaskInput>) => { setForm(current => ({ ...current, ...changes })); setMessage(''); };
  const leave = (action: () => void) => {
    if (saving) return;
    if (dirty) setPendingLeave(() => action);
    else action();
  };
  const copyLink = async () => {
    try {
      const url = new URL(portalLocationUrl(window.location.href, { screen: 'tasks', taskId: task.id }), window.location.origin);
      await navigator.clipboard.writeText(url.href);
      setMessage('Task link copied.');
    } catch { setError('Could not copy the link. You can copy this page’s address instead.'); }
  };
  return (
    <Modal className="aw-task-drawer" open title={task.title} description={taskContext(task)} onClose={() => leave(onClose)}>
      <div className="aw-task-drawer__content">
        {pendingLeave && <div className="aw-task-drawer__discard" role="alert">
          <p>You have unsaved changes.</p>
          <Button variant="secondary" onClick={() => setPendingLeave(null)}>Keep editing</Button>
          <Button onClick={() => { setPendingLeave(null); pendingLeave(); }}>Discard changes</Button>
        </div>}
        <div className="aw-task-drawer__links">
          {task.clientId && onOpenClient && <Button variant="secondary" onClick={() => leave(() => onOpenClient(task.clientId!))}>Open client</Button>}
          <Button variant="secondary" onClick={() => void copyLink()}>Copy task link</Button>
        </div>
        <section className="aw-task-drawer__description"><h3>Description</h3><p>{task.description.trim() || 'No description added.'}</p></section>
        <form className="aw-task-drawer__form" onSubmit={async event => {
          event.preventDefault();
          if (!onSave || !dirty || saving) return;
          setSaving(true); setError(''); setMessage('');
          try {
            // Keep the record's latest descriptive fields when saving these four quick controls.
            const input = { ...taskUpdateInput(task), status: form.status, assigneeUserId: form.assigneeUserId, priority: form.priority, dueDate: form.dueDate, dueTime: form.dueTime };
            await onSave(input);
            setBaseline(form); setMessage('Changes saved.');
          } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save changes. Please try again.'); }
          finally { setSaving(false); }
        }}>
          <fieldset disabled={!canManage || !onSave || saving}>
            <legend>Task details</legend>
            <label className="rm-field"><span>Status</span><select value={form.status} onChange={event => update({ status: event.target.value as TaskSummary['status'] })}>{Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="rm-field"><span>Assigned to</span><select disabled={!canReassign} value={form.assigneeUserId ?? ''} onChange={event => update({ assigneeUserId: event.target.value || undefined })}><option value="">Unassigned</option>{assignees.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
            <label className="rm-field"><span>Priority</span><select value={form.priority} onChange={event => update({ priority: event.target.value as TaskSummary['priority'] })}>{['low', 'normal', 'high', 'urgent'].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
            <div className="aw-task-drawer__dates"><label className="rm-field"><span>Due date</span><input type="date" value={form.dueDate} onChange={event => update({ dueDate: event.target.value })}/></label><label className="rm-field"><span>Due time</span><input type="time" disabled={!form.dueDate || saving || !canManage || !onSave} value={form.dueTime} onChange={event => update({ dueTime: event.target.value })}/></label></div>
          </fieldset>
          {error && <p className="aw-task-drawer__error" role="alert">{error}</p>}
          <p className="aw-task-drawer__message" role="status">{message || (dirty ? 'Unsaved changes' : '')}</p>
          {canManage && <footer className="aw-task-drawer__actions"><Button variant="secondary" disabled={saving} onClick={() => leave(onEdit)}>Edit full task</Button><Button disabled={!onSave || !dirty || saving} type="submit">{saving ? 'Saving…' : 'Save changes'}</Button></footer>}
        </form>
        {!!task.attachments?.length && <section className="aw-task-drawer__attachments"><h3>Attachments</h3>{task.attachments.map(attachment => <Button icon="paperclip" key={attachment.id} variant="secondary" onClick={() => onOpenAttachment(attachment)}>{attachment.name}</Button>)}</section>}
      </div>
    </Modal>
  );
}
