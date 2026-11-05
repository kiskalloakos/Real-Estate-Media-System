import {
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import {
  Avatar,
  Button,
  Card,
  Icon,
  Modal,
  PageHeader,
  useToast,
  type PortalRole,
} from '@/components/web';
import { useBrowserPersistedState } from '@/hooks/use-browser-persisted-state';
import { clearLocalDraft, readLocalDraft, useLocalDraft } from '@/hooks/use-local-draft';

import { taskViews, taskPreviewText, taskDateParts, taskStatusLabels, taskUpdateInput, matchesTaskSearch, matchesTaskView, type TaskView } from '@/lib/task-workspace';
import type { PortalLocation } from '@/lib/portal-location';
import { TaskDetailsDrawer } from './TaskDetailsDrawer';
import { demoTasks } from './demoData';
import type {
  AgencyMemberSummary,
  ClientSummary,
  CreateTaskInput,
  PropertySummary,
  TaskAttachment,
  TaskSummary,
  UpdateTaskInput,
} from './types';
import './TasksScreen.css';

export interface TasksScreenProps {
  projectContext?: { clientId: string; propertyId?: string };
  archivedTasks?: TaskSummary[];
  clients?: ClientSummary[];
  currentUserId?: string;
  members?: AgencyMemberSummary[];
  onArchiveTask?: (taskId: string) => Promise<void>;
  onCreateTask?: (input: CreateTaskInput) => Promise<void>;
  onDeleteAttachment?: (attachmentId: string) => Promise<void>;
  onRestoreTask?: (taskId: string) => Promise<void>;
  onUpdateTask?: (input: UpdateTaskInput) => Promise<void>;
  location?: PortalLocation;
  onLocationChange?: (changes: Partial<PortalLocation>, replace?: boolean) => void;
  onOpenClient?: (id: string) => void;
  properties?: PropertySummary[];
  role: PortalRole;
  tasks?: TaskSummary[];
}

type TaskListKey = 'todo' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
type TaskOrderState = Partial<Record<TaskListKey, string[]>>;
type TaskInsertEdge = 'before' | 'after';
type TaskDropTarget = {
  edge: TaskInsertEdge;
  taskId: string;
} | {
  edge: 'inside';
  list: TaskListKey;
};

const taskLists: {
  key: TaskListKey;
  label: string;
  matches: (task: TaskSummary) => boolean;
}[] = [
  { key: 'todo', label: 'New tasks', matches: (task) => task.status === 'todo' },
  { key: 'in_progress', label: 'In progress', matches: (task) => task.status === 'in_progress' },
  { key: 'blocked', label: 'Needs intervention', matches: (task) => task.status === 'blocked' },
  { key: 'completed', label: 'Delivered', matches: (task) => task.status === 'done' },
  { key: 'cancelled', label: 'Cancelled', matches: (task) => task.status === 'cancelled' },
];

const statusLabels = taskStatusLabels;

const priorityRank: Record<TaskSummary['priority'], number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function emptyTask(): CreateTaskInput {
  return {
    attachments: [],
    assigneeUserId: undefined,
    description: '',
    dueDate: '',
    dueTime: '',
    priority: 'normal',
    title: '',
    visibility: 'team',
  };
}

function formatDue(value?: string) {
  if (!value) return 'No deadline';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function formatArchivedAt(value?: string) {
  if (!value) return 'Archived recently';
  return `Archived ${new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))}`;
}

function isClosed(task: TaskSummary) {
  return task.status === 'done' || task.status === 'cancelled';
}

function taskListKey(task: TaskSummary): TaskListKey {
  if (task.status === 'blocked') return 'blocked';
  if (task.status === 'in_progress') return 'in_progress';
  if (task.status === 'done') return 'completed';
  if (task.status === 'cancelled') return 'cancelled';
  return 'todo';
}

function taskIsOverdue(task: TaskSummary) {
  return Boolean(task.dueAt && !isClosed(task) && new Date(task.dueAt) < new Date());
}

function taskUrgencyOrder(left: TaskSummary, right: TaskSummary) {
  const leftOverdue = taskIsOverdue(left);
  const rightOverdue = taskIsOverdue(right);
  if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;

  const priorityDifference = priorityRank[left.priority] - priorityRank[right.priority];
  if (priorityDifference) return priorityDifference;

  const leftDueAt = left.dueAt ? new Date(left.dueAt).getTime() : Number.POSITIVE_INFINITY;
  const rightDueAt = right.dueAt ? new Date(right.dueAt).getTime() : Number.POSITIVE_INFINITY;
  if (leftDueAt !== rightDueAt) return leftDueAt - rightDueAt;

  return left.id.localeCompare(right.id);
}

function orderedTasks(
  tasks: TaskSummary[],
  list: TaskListKey,
  order: TaskOrderState,
) {
  const savedOrder = order[list] ?? [];
  const savedIndex = new Map(savedOrder.map((taskId, index) => [taskId, index]));

  return [...tasks].sort((left, right) => {
    // Priority is the board's primary ordering rule. A newly created or moved
    // normal task belongs at the top of its own priority group, never above an
    // urgent task already in the list.
    const priorityDifference = priorityRank[left.priority] - priorityRank[right.priority];
    if (priorityDifference) return priorityDifference;

    const leftOverdue = taskIsOverdue(left);
    const rightOverdue = taskIsOverdue(right);
    if (leftOverdue !== rightOverdue) return leftOverdue ? -1 : 1;

    const leftIndex = savedIndex.get(left.id);
    const rightIndex = savedIndex.get(right.id);

    // Tasks absent from the saved order are newly created or newly moved into
    // this state, so they intentionally appear above existing tasks of the
    // same priority and urgency.
    if (leftIndex === undefined && rightIndex !== undefined) return -1;
    if (leftIndex !== undefined && rightIndex === undefined) return 1;
    if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;

    const createdDifference =
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    return createdDifference || taskUrgencyOrder(left, right);
  });
}

export function TasksScreen({
  projectContext,
  archivedTasks = [],
  clients = [],
  currentUserId,
  members = [],
  onArchiveTask,
  onCreateTask,
  onDeleteAttachment,
  onRestoreTask,
  onUpdateTask,
  location,
  onLocationChange,
  onOpenClient,
  properties = [],
  role,
  tasks,
}: TasksScreenProps) {
  const { notify } = useToast();
  const sourceTasks = useMemo(
    () => tasks ?? demoTasks.filter(
      (task) =>
        role === 'admin' ||
        (role === 'client' ? task.visibility === 'client' : task.visibility !== 'admin_only'),
    ),
    [role, tasks],
  );
  const accessibleTasks = useMemo(
    () => role === 'team_member'
      ? sourceTasks.filter((task) => Boolean(currentUserId) && task.assigneeUserId === currentUserId)
      : sourceTasks,
    [currentUserId, role, sourceTasks],
  );
  const stateKey = `rm:tasks-state:${currentUserId ?? role}${projectContext ? ":" + projectContext.clientId + ":" + (projectContext.propertyId ?? "general") : ""}`;
  const [assigneeId, setAssigneeId] = useBrowserPersistedState(`${stateKey}:assignee`, 'all');
  const [taskOrder, setTaskOrder] = useBrowserPersistedState<TaskOrderState>(
    `${stateKey}:order`,
    {},
  );
  const [formOpen, setFormOpen] = useState(false);
  const [createFieldsTouched, setCreateFieldsTouched] = useState(false);
  const [editFieldsTouched, setEditFieldsTouched] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTaskInput>(emptyTask);
  const taskDraftKey = projectContext ? stateKey + ':draft' : 'rm:draft:task';
  useLocalDraft(taskDraftKey, createForm, formOpen, (draft) => Boolean(draft.title.trim() || draft.description.trim()));
  const [localPreviewTask, setLocalPreviewTask] = useState<TaskSummary | null>(null);
  const [savedView, setSavedView] = useBrowserPersistedState<TaskView>(`${stateKey}:view`, 'all');
  const [savedQuery, setSavedQuery] = useBrowserPersistedState(`${stateKey}:query`, '');
  const [layout, setLayout] = useBrowserPersistedState<'list' | 'board'>(`${stateKey}:layout`, 'list');
  const view = location ? location.taskView ?? 'all' : savedView;
  const query = location ? location.taskQuery ?? '' : savedQuery;
  const effectiveAssignee = location ? location.taskAssignee ?? 'all' : assigneeId;
  const [recovery, setRecovery] = useState<{ message: string; undo: () => Promise<void> } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState('');
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(() => new Set());
  const [editTask, setEditTask] = useState<TaskSummary | null>(null);
  const [editForm, setEditForm] = useState<UpdateTaskInput | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<TaskAttachment | null>(null);
  const [removingAttachmentId, setRemovingAttachmentId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<TaskSummary | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivedTaskDetail, setArchivedTaskDetail] = useState<TaskSummary | null>(null);
  const [optimisticArchivedTasks, setOptimisticArchivedTasks] = useState<TaskSummary[]>([]);
  const [archivingTaskIds, setArchivingTaskIds] = useState<Set<string>>(() => new Set());
  const [restoringTaskId, setRestoringTaskId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskDropTarget | null>(null);
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, TaskSummary['status']>>({});
  const canManage = role !== 'client';
  const boardTasks = useMemo(
    () => accessibleTasks
      .filter((task) => !archivingTaskIds.has(task.id))
      .map((task) => ({
        ...task,
        status: optimisticStatuses[task.id] ?? task.status,
      })),
    [accessibleTasks, archivingTaskIds, optimisticStatuses],
  );
  const visibleArchivedTasks = useMemo(() => {
    const tasksById = new Map<string, TaskSummary>();
    for (const task of [...optimisticArchivedTasks, ...archivedTasks]) {
      if (role === 'team_member' && task.assigneeUserId !== currentUserId) continue;
      tasksById.set(task.id, task);
    }
    return [...tasksById.values()].sort((left, right) =>
      new Date(right.archivedAt ?? right.completedAt ?? right.createdAt).getTime()
      - new Date(left.archivedAt ?? left.completedAt ?? left.createdAt).getTime()
    );
  }, [archivedTasks, currentUserId, optimisticArchivedTasks, role]);
  const activeMembers = useMemo(
    () => members.filter((member) => member.status === 'active'),
    [members],
  );
  const memberAvatarByUserId = useMemo(
    () => new Map(members.map(member => [member.userId, member.avatarUrl])),
    [members],
  );
  const assigneeOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const member of activeMembers) options.set(member.userId, member.name);
    for (const task of accessibleTasks) {
      if (task.assigneeUserId) options.set(task.assigneeUserId, task.assigneeName);
    }
    return [...options.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [accessibleTasks, activeMembers]);
  const visibleClients = useMemo(() => {
    if (clients.length) {
      return [...clients].sort((left, right) => left.name.localeCompare(right.name));
    }
    const clientMap = new Map<string, ClientSummary>();
    for (const property of properties) {
      if (!clientMap.has(property.clientId)) {
        clientMap.set(property.clientId, {
          contactName: '',
          email: '',
          id: property.clientId,
          location: '',
          monthlyDeliverables: 0,
          monthlyPrice: 0,
          name: property.clientName,
          propertiesCount: 0,
          status: 'active',
          totalContractValue: 0,
        });
      }
    }
    return [...clientMap.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [clients, properties]);

  const previewTask = location
    ? boardTasks.find(task => task.id === location.taskId) ?? null
    : localPreviewTask;
  const setPreviewTask = (task: TaskSummary | null) => {
    if (onLocationChange) onLocationChange({ taskId: task?.id });
    else setLocalPreviewTask(task);
  };
  const changeFilters = (changes: { taskView?: TaskView; taskQuery?: string; taskAssignee?: string }, replace = false) => {
    if (changes.taskView !== undefined) setSavedView(changes.taskView);
    if (changes.taskQuery !== undefined) setSavedQuery(changes.taskQuery);
    if (changes.taskAssignee !== undefined) {
      setAssigneeId(changes.taskAssignee);
      window.dispatchEvent(new CustomEvent('rm:task-assignee-filter', { detail: { assigneeId: changes.taskAssignee, stateKey: `${stateKey}:assignee` } }));
    }
    onLocationChange?.(changes, replace);
  };
  const assignedTasks = boardTasks.filter(task => role === 'team_member' || effectiveAssignee === 'all'
    || (effectiveAssignee === 'unassigned' ? !task.assigneeUserId : task.assigneeUserId === effectiveAssignee));
  const filteredTasks = assignedTasks.filter(task => matchesTaskView(task, view, currentUserId) && matchesTaskSearch(task, query));
  const offerUndo = (message: string, undo: () => Promise<void>) => { setUndoError(''); setRecovery({ message, undo }); };
  const saveQuickTask = async (input: UpdateTaskInput) => {
    if (!onUpdateTask) return;
    const previous = boardTasks.find(task => task.id === input.taskId);
    await onUpdateTask(role === 'team_member' ? { ...input, assigneeUserId: currentUserId } : input);
    setOptimisticStatuses(current => { const next = { ...current }; delete next[input.taskId]; return next; });
    if (previous) offerUndo(`${input.title} updated.`, async () => {
      await onUpdateTask(taskUpdateInput(previous));
      setOptimisticStatuses(current => { const next = { ...current }; delete next[input.taskId]; return next; });
    });
  };

  const openCreate = () => {
    const draft = { ...(readLocalDraft<CreateTaskInput>(taskDraftKey) ?? emptyTask()), ...projectContext };
    setCreateForm(role === 'team_member'
      ? { ...draft, assigneeUserId: currentUserId }
      : draft);
    setFormError('');
    setCreateFieldsTouched(false);
    setFormOpen(true);
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onCreateTask) return;
    setSaving(true);
    setFormError('');
    try {
      await onCreateTask(role === 'team_member'
        ? { ...createForm, assigneeUserId: currentUserId }
        : createForm);
      clearLocalDraft(taskDraftKey);
      setFormOpen(false);
      notify(`${createForm.title} was added to the task board.`);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not create the task.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (task: TaskSummary) => {
    const due = taskDateParts(task.dueAt);
    setEditTask(task);
    setEditForm({
      attachments: [],
      assigneeUserId: task.assigneeUserId,
      clientId: task.clientId,
      description: task.description,
      dueDate: due.dueDate,
      dueTime: due.dueTime,
      priority: task.priority,
      propertyId: task.propertyId,
      status: task.status,
      taskId: task.id,
      title: task.title,
      visibility: task.visibility,
    });
    setFormError('');
    setEditFieldsTouched(false);
  };

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editForm || !onUpdateTask) return;
    setSaving(true);
    setFormError('');
    try {
      await onUpdateTask(editForm);
      setEditTask(null);
      setEditForm(null);
      notify(`${editForm.title} was updated.`);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not update the task.');
    } finally {
      setSaving(false);
    }
  };

  const removeAttachment = async (attachment: TaskAttachment) => {
    if (!onDeleteAttachment || removingAttachmentId) return;
    if (!window.confirm(`Remove “${attachment.name}” from this task? This cannot be undone.`)) return;

    setRemovingAttachmentId(attachment.id);
    setFormError('');
    try {
      await onDeleteAttachment(attachment.id);
      setEditTask((current) => current ? ({
        ...current,
        attachments: current.attachments?.filter((item) => item.id !== attachment.id),
      }) : current);
      if (attachmentPreview?.id === attachment.id) setAttachmentPreview(null);
      notify(`${attachment.name} was removed.`);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not remove the attachment.');
    } finally {
      setRemovingAttachmentId(null);
    }
  };

  const archiveTaskImmediately = async (task: TaskSummary) => {
    if (!onArchiveTask || archivingTaskIds.has(task.id)) return;
    const archivedTask = { ...task, archivedAt: new Date().toISOString() };
    setArchivingTaskIds((current) => new Set(current).add(task.id));
    setOptimisticArchivedTasks((current) => [
      archivedTask,
      ...current.filter((item) => item.id !== task.id),
    ]);
    try {
      await onArchiveTask(task.id);
      if (onRestoreTask) offerUndo(`${task.title} archived.`, async () => {
        await onRestoreTask(task.id);
        setOptimisticArchivedTasks(current => current.filter(item => item.id !== task.id));
        setArchivingTaskIds(current => { const next = new Set(current); next.delete(task.id); return next; });
      });
      setArchiveTarget(null);
    } catch (caught) {
      setArchivingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
      setOptimisticArchivedTasks((current) =>
        current.filter((item) => item.id !== task.id)
      );
      notify(caught instanceof Error ? caught.message : 'Could not archive the task.', 'error');
    }
  };

  const archiveTask = async () => {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      await archiveTaskImmediately(archiveTarget);
    } finally {
      setSaving(false);
    }
  };

  const restoreArchivedTask = async (task: TaskSummary) => {
    if (!onRestoreTask || restoringTaskId) return;
    setRestoringTaskId(task.id);
    try {
      await onRestoreTask(task.id);
      setOptimisticArchivedTasks((current) =>
        current.filter((item) => item.id !== task.id)
      );
      setArchivingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
      setArchivedTaskDetail(null);
      notify(`${task.title} was restored.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not restore the task.', 'error');
    } finally {
      setRestoringTaskId(null);
    }
  };

  const saveTaskPosition = (
    task: TaskSummary,
    destination: TaskListKey,
    targetTaskId?: string,
    edge: TaskInsertEdge = 'before',
  ) => {
    setTaskOrder((current) => {
      const destinationTasks = boardTasks.filter(
        (item) => item.id !== task.id && taskListKey(item) === destination,
      );
      const destinationIds = orderedTasks(destinationTasks, destination, current)
        .map((item) => item.id);
      const targetIndex = targetTaskId
        ? destinationIds.indexOf(targetTaskId)
        : -1;
      const insertAt = targetIndex === -1
        ? 0
        : targetIndex + (edge === 'after' ? 1 : 0);
      destinationIds.splice(insertAt, 0, task.id);

      return {
        blocked: (current.blocked ?? []).filter((taskId) => taskId !== task.id),
        cancelled: (current.cancelled ?? []).filter((taskId) => taskId !== task.id),
        completed: (current.completed ?? []).filter((taskId) => taskId !== task.id),
        in_progress: (current.in_progress ?? []).filter((taskId) => taskId !== task.id),
        todo: (current.todo ?? []).filter((taskId) => taskId !== task.id),
        [destination]: destinationIds,
      };
    });
  };

  const moveTask = async (
    task: TaskSummary,
    destination: TaskListKey,
    targetTaskId?: string,
    edge: TaskInsertEdge = 'before',
  ) => {
    const statusByList: Record<TaskListKey, TaskSummary['status']> = {
      blocked: 'blocked',
      cancelled: 'cancelled',
      completed: 'done',
      in_progress: 'in_progress',
      todo: 'todo',
    };
    const status = statusByList[destination];

    if (pendingTaskIds.has(task.id) || undoing) return;
    const previousOrder = taskOrder;
    if (taskListKey(task) === destination) {
      saveTaskPosition(task, destination, targetTaskId, edge);
      offerUndo(`${task.title} reordered.`, async () => setTaskOrder(previousOrder));
      return;
    }
    if (!onUpdateTask) return;

    const due = taskDateParts(task.dueAt);
    const previousStatus = task.status;
    setPendingTaskIds(current => new Set(current).add(task.id));
    // Move instantly, then reconcile with Supabase in the background. The board
    // must not wait for a network round-trip before responding to a drop.
    setOptimisticStatuses((current) => ({ ...current, [task.id]: status }));
    saveTaskPosition({ ...task, status }, destination, targetTaskId, edge);
    try {
      await onUpdateTask({
        assigneeUserId: task.assigneeUserId,
        clientId: task.clientId,
        description: task.description,
        dueDate: due.dueDate,
        dueTime: due.dueTime,
        priority: task.priority,
        propertyId: task.propertyId,
        status,
        taskId: task.id,
        title: task.title,
        visibility: task.visibility,
      });
      setOptimisticStatuses(current => { const next = { ...current }; delete next[task.id]; return next; });
      offerUndo(`${task.title} moved to ${statusLabels[status]}.`, async () => {
        await onUpdateTask(taskUpdateInput(task));
        setTaskOrder(previousOrder);
        setOptimisticStatuses(current => { const next = { ...current }; delete next[task.id]; return next; });
      });
    } catch (caught) {
      setTaskOrder(previousOrder);
      setOptimisticStatuses((current) => ({ ...current, [task.id]: previousStatus }));
      notify(caught instanceof Error ? caught.message : 'Could not move the task.', 'error');
    } finally {
      setPendingTaskIds(current => { const next = new Set(current); next.delete(task.id); return next; });
    }
  };

  const renderTaskFields = (
    form: CreateTaskInput,
    update: (changes: Partial<CreateTaskInput>) => void,
  ) => (
    <>
      <div className="rm-form-grid rm-form-grid--two">
        <label className="rm-field">
          <span>Client</span>
          <select
            onChange={(event) => {
              const clientId = event.target.value || undefined;
              update({
                clientId,
                propertyId: undefined,
                visibility: clientId ? 'client' : 'team',
              });
            }}
            disabled={Boolean(projectContext)}
            value={form.clientId ?? ''}
          >
            <option value="">Choose a client</option>
            {visibleClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
        {role === 'team_member' ? (
          <div className="rm-field">
            <span>Assigned to</span>
            <strong>You</strong>
            <small>Team-created tasks stay assigned to you.</small>
          </div>
        ) : (
          <label className="rm-field">
            <span>Assigned to</span>
            <select
              onChange={(event) => update({ assigneeUserId: event.target.value || undefined })}
              value={form.assigneeUserId ?? ''}
            >
              <option value="">Unassigned</option>
              {activeMembers.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="rm-form-grid rm-form-grid--two">
        <label className="rm-field">
          <span>Visibility</span>
          <select
            onChange={(event) => update({ visibility: event.target.value as TaskSummary['visibility'] })}
            value={form.visibility}
          >
            {role === 'admin' ? <option value="admin_only">Founders</option> : null}
            <option value="team">Team</option>
            <option value="client">Client</option>
          </select>
        </label>
        <div className="rm-field">
          <span>Priority</span>
          <div className="rm-task-priority-switch" role="radiogroup" aria-label="Priority">
            {(['low', 'normal', 'high', 'urgent'] as const).map((priority) => (
              <label
                className={form.priority === priority ? 'is-active' : undefined}
                key={priority}
              >
                <input
                  checked={form.priority === priority}
                  name="task-priority"
                  onChange={() => update({ priority })}
                  type="radio"
                  value={priority}
                />
                {priority[0].toUpperCase() + priority.slice(1)}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="rm-form-grid rm-form-grid--two">
        <label className="rm-field">
          <span>Due date</span>
          <input onChange={(event) => update({ dueDate: event.target.value })} type="date" value={form.dueDate} />
        </label>
        <label className="rm-field">
          <span>Due time</span>
          <input disabled={!form.dueDate} onChange={(event) => update({ dueTime: event.target.value })} type="time" value={form.dueTime} />
        </label>
      </div>
    </>
  );

  return (
    <div className="rm-page rm-tasks-page aw-tasks" id="aw-tasks">
      <PageHeader
        actions={(
          <div className="rm-task-page-actions">
            {role === 'admin' ? (
              <label className="aw-tasks__filter">
                <span>Assigned to</span>
                <select
                  onChange={(event) => {
                    changeFilters({ taskAssignee: event.target.value });
                  }}
                  value={effectiveAssignee}
                >
                  <option value="unassigned">Unassigned</option>
                  <option value="all">Everyone</option>
                  {assigneeOptions.map((assignee) => (
                    <option key={assignee.id} value={assignee.id}>{assignee.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
            {canManage ? (
              <Button onClick={() => setArchiveOpen(true)} variant="secondary">
                Archived
              </Button>
            ) : null}
            {canManage ? <Button icon="plus" onClick={openCreate}>New task</Button> : null}
          </div>
        )}
        title="Tasks"
      />

      <div className="aw-tasks__toolbar">
        <div className="aw-tasks__views" role="group" aria-label="Task views">
          {taskViews.map(item => <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => changeFilters({ taskView: item.id, ...(item.id === 'mine' ? { taskAssignee: 'all' } : {}) })}>{item.label}<span>{assignedTasks.filter(task => matchesTaskView(task, item.id, currentUserId)).length}</span></button>)}
        </div>
        <div className="aw-tasks__tools">
          <label className="aw-tasks__search"><span className="aw-sr-only">Search tasks</span><Icon name="search" size={16}/><input type="search" placeholder="Search tasks…" value={query} onChange={event => changeFilters({ taskQuery: event.target.value }, true)}/></label>
          <div className="aw-tasks__layouts" role="group" aria-label="Task layout">{(['list', 'board'] as const).map(value => <button key={value} type="button" aria-pressed={layout === value} onClick={() => setLayout(value)}>{value === 'list' ? 'List' : 'Board'}</button>)}</div>
        </div>
      </div>
      <p className="aw-sr-only" role="status">{filteredTasks.length} tasks in this view.</p>
      {recovery && <div className="aw-tasks__recovery" role="status"><span>{undoError || recovery.message}</span><button type="button" disabled={undoing} onClick={async () => {
        setUndoing(true); setUndoError('');
        try { await recovery.undo(); setRecovery(null); }
        catch (caught) { setUndoError(caught instanceof Error ? caught.message : 'Could not undo. Try again.'); }
        finally { setUndoing(false); }
      }}>{undoing ? 'Undoing…' : 'Undo'}</button><button type="button" aria-label="Dismiss task notification" disabled={undoing} onClick={() => { setRecovery(null); setUndoError(''); }}><Icon name="x" size={16}/></button></div>}
      {filteredTasks.length && layout === 'list' ? (
        <div className="aw-tasks__table-wrap"><table className="aw-tasks__table"><thead><tr><th scope="col">Task / context</th><th scope="col">Status</th><th scope="col">Assigned to</th><th scope="col">Due</th><th scope="col"><span className="aw-sr-only">Actions</span></th></tr></thead><tbody>
          {taskLists.flatMap(list => orderedTasks(filteredTasks.filter(list.matches), list.key, taskOrder)).map(task => <tr key={task.id}>
            <td><button className="aw-tasks__list-open" type="button" onClick={() => setPreviewTask(task)}><strong>{task.title}{task.priority === 'urgent' || task.priority === 'high' ? <span className="aw-tasks__priority"> · {task.priority === 'urgent' ? 'Urgent' : 'High'}</span> : null}</strong><span title={taskPreviewText(task)}>{taskPreviewText(task)}</span></button></td>
            <td><span data-task-status={task.status} className={task.status === 'blocked' ? 'aw-tasks__priority' : ''}>{statusLabels[task.status]}</span></td><td>{task.assigneeName || 'Unassigned'}</td><td className={taskIsOverdue(task) ? 'is-overdue' : ''}>{task.dueAt ? <time dateTime={task.dueAt}>{taskIsOverdue(task) ? 'Overdue · ' : ''}{formatDue(task.dueAt)}</time> : '—'}</td>
            <td>{task.status === 'done' && canManage && <button type="button" className="aw-tasks__list-archive" aria-label={`Archive ${task.title}`} disabled={undoing || archivingTaskIds.has(task.id)} onClick={() => void archiveTaskImmediately(task)}><Icon name="archive" size={16}/></button>}</td>
          </tr>)}
        </tbody></table></div>
      ) : filteredTasks.length ? (
        <div className="rm-task-list-grid">
          {taskLists.map((list) => {
            const listTasks = orderedTasks(
              filteredTasks.filter(list.matches),
              list.key,
              taskOrder,
            );
            return (
              <Card
                aria-labelledby={`task-list-${list.key}`}
                data-task-list={list.key}
                className={[
                  'rm-task-list-card',
                  dropTarget && 'list' in dropTarget && dropTarget.list === list.key
                    ? 'is-list-drop-target'
                    : '',
                ].filter(Boolean).join(' ')}
                key={list.key}
                onDragOver={(event) => {
                  if (!canManage || !draggedTaskId) return;
                  event.preventDefault();
                  const trailingTask = [...listTasks].reverse().find((task) => task.id !== draggedTaskId);
                  setDropTarget(trailingTask
                    ? { edge: 'after', taskId: trailingTask.id }
                    : { edge: 'inside', list: list.key });
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const task = boardTasks.find((item) => item.id === event.dataTransfer.getData('text/task-id'));
                  const target = dropTarget && 'taskId' in dropTarget ? dropTarget : undefined;
                  setDropTarget(null);
                  setDraggedTaskId(null);
                  if (task) void moveTask(task, list.key, target?.taskId, target?.edge);
                }}
                tone="bright"
              >
                <header className="rm-task-list-card__header">
                  <h2 id={`task-list-${list.key}`}>{list.label}</h2>
                  <span className="aw-tasks__count">{listTasks.length}</span>
                </header>
                <div className="rm-task-list-card__list">
                    {listTasks.map((task) => (
                      <article
                        aria-grabbed={draggedTaskId === task.id}
                        className={[
                          'rm-task-item',
                          'rm-task-item--compact',
                          `rm-task-item--${task.priority}`,
                          list.key === 'completed' && canManage
                            ? 'has-archive-action'
                            : '',
                          draggedTaskId === task.id ? 'is-dragging' : '',
                          dropTarget && 'taskId' in dropTarget && dropTarget.taskId === task.id
                            ? `is-drop-${dropTarget.edge}`
                            : '',
                        ].filter(Boolean).join(' ')}
                        draggable={canManage && !pendingTaskIds.has(task.id) && !undoing}
                        key={task.id}
                        onDragEnd={() => {
                          setDraggedTaskId(null);
                          setDropTarget(null);
                        }}
                        onDragOver={(event) => {
                          if (!canManage || draggedTaskId === task.id) return;
                          event.preventDefault();
                          event.stopPropagation();
                          const bounds = event.currentTarget.getBoundingClientRect();
                          setDropTarget({
                            edge: event.clientY < bounds.top + bounds.height / 2
                              ? 'before'
                              : 'after',
                            taskId: task.id,
                          });
                        }}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/task-id', task.id);
                          setDraggedTaskId(task.id);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const movingTask = boardTasks.find(
                            (item) => item.id === event.dataTransfer.getData('text/task-id'),
                          );
                          const bounds = event.currentTarget.getBoundingClientRect();
                          const edge = event.clientY < bounds.top + bounds.height / 2
                            ? 'before'
                            : 'after';
                          setDropTarget(null);
                          setDraggedTaskId(null);
                          if (movingTask) void moveTask(movingTask, list.key, task.id, edge);
                        }}
                        title={canManage ? 'Drag to reorder. Click to preview.' : 'Click to preview.'}
                        >
                          <button
                          className="rm-task-item__open"
                          onClick={() => setPreviewTask(task)}
                            type="button"
                          >
                            <span className={[
                              'rm-task-item__row-content',
                              task.dueAt ? '' : 'rm-task-item__row-content--no-deadline',
                            ].filter(Boolean).join(' ')}
                            >
                              <strong>{task.title}</strong>
                              <span className="aw-tasks__context" title={taskPreviewText(task)}>{taskPreviewText(task)}</span>
                              <small className="aw-tasks__meta">
                                <span>{task.assigneeName || 'Unassigned'}</span>
                                {task.dueAt ? <time className={taskIsOverdue(task) ? 'aw-tasks__due is-overdue' : 'aw-tasks__due'} dateTime={task.dueAt}>{taskIsOverdue(task) ? 'Overdue: ' : ''}{formatDue(task.dueAt)}</time> : null}
                                {task.priority === 'urgent' || task.priority === 'high' ? <span className="aw-tasks__priority">{task.priority === 'urgent' ? 'Urgent' : 'High priority'}</span> : null}
                              </small>
                            </span>
                          </button>
                        {list.key === 'completed' && canManage ? (
                          <button
                            aria-label={`Archive ${task.title}`}
                            className="rm-task-item__archive"
                            disabled={archivingTaskIds.has(task.id)}
                            onClick={() => void archiveTaskImmediately(task)}
                            title={`Archive ${task.title}`}
                            type="button"
                          >
                            <Icon name="archive" size={17} />
                          </button>
                        ) : null}
                      </article>
                    ))}
                    {!listTasks.length ? (
                      <div className="rm-task-list-card__empty">No tasks</div>
                    ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="aw-tasks__empty" tone="bright">
          <h2>No tasks in this view</h2>
          <p>{role === 'admin' && effectiveAssignee !== 'all'
            ? 'Choose another assignee to see their tasks.'
            : query || view !== 'all' ? 'Try another view or clear your search.' : canManage ? 'Use New task to add your next assignment.' : 'Tasks shared with you will appear here.'}</p>
          {(query || view !== 'all' || effectiveAssignee !== 'all') && <Button variant="secondary" onClick={() => changeFilters({ taskQuery: '', taskView: 'all', taskAssignee: 'all' })}>Clear filters</Button>}
        </Card>
      )}

      <Modal
        onClose={() => {
          setArchiveOpen(false);
          setArchivedTaskDetail(null);
        }}
        open={archiveOpen}
        title={archivedTaskDetail?.title ?? 'Archived tasks'}
      >
        {archivedTaskDetail ? (
          <div className="rm-task-archive-detail">
            <div className="rm-task-archive-detail__meta">
              <span>{archivedTaskDetail.assigneeName || 'Unassigned'}</span>
              <span>{archivedTaskDetail.clientName}</span>
              <span>{formatArchivedAt(archivedTaskDetail.archivedAt)}</span>
            </div>
            <p>
              {archivedTaskDetail.description.trim()
                || 'No description was added to this task.'}
            </p>
            {archivedTaskDetail.attachments?.length ? (
              <div className="rm-task-archive-detail__attachments">
                <strong>Attachments</strong>
                {archivedTaskDetail.attachments.map((attachment) => (
                  attachment.url ? (
                    <a
                      href={attachment.url}
                      key={attachment.id}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <Icon name="paperclip" size={16} />
                      <span>{attachment.name}</span>
                    </a>
                  ) : null
                ))}
              </div>
            ) : null}
            <footer className="rm-dialog-actions">
              <Button onClick={() => setArchivedTaskDetail(null)} variant="secondary">
                Back
              </Button>
              <Button
                disabled={restoringTaskId === archivedTaskDetail.id}
                icon="rotate-left"
                onClick={() => void restoreArchivedTask(archivedTaskDetail)}
                variant="secondary"
              >
                {restoringTaskId === archivedTaskDetail.id ? 'Restoring…' : 'Restore task'}
              </Button>
            </footer>
          </div>
        ) : (
          <div className="rm-task-archive-list">
            {visibleArchivedTasks.map((task) => (
              <article key={task.id}>
                <button
                  className="rm-task-archive-list__open"
                  onClick={() => setArchivedTaskDetail(task)}
                  type="button"
                >
                  <Avatar
                    name={task.assigneeName || 'Unassigned'}
                    size="sm"
                    src={task.assigneeUserId ? memberAvatarByUserId.get(task.assigneeUserId) : undefined}
                  />
                  <span className="rm-task-archive-list__content">
                    <strong>{task.title}</strong>
                    <small>
                      {task.assigneeName || 'Unassigned'} · {formatArchivedAt(task.archivedAt)}
                    </small>
                  </span>
                </button>
                <button
                  aria-label={`Restore ${task.title}`}
                  className="rm-task-archive-list__restore"
                  disabled={restoringTaskId === task.id}
                  onClick={() => void restoreArchivedTask(task)}
                  title={`Restore ${task.title}`}
                  type="button"
                >
                  <Icon name="rotate-left" size={17} />
                </button>
              </article>
            ))}
            {!visibleArchivedTasks.length ? (
              <div className="rm-task-archive-list__empty">
                <Icon name="list-check" size={22} />
                <strong>No archived tasks</strong>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      {previewTask && <TaskDetailsDrawer
        key={previewTask.id} task={previewTask} assignees={assigneeOptions} canManage={canManage} canReassign={role === 'admin'}
        onClose={() => setPreviewTask(null)} onOpenClient={onOpenClient}
        onOpenAttachment={setAttachmentPreview} onSave={onUpdateTask ? saveQuickTask : undefined}
        onEdit={() => { openEdit(previewTask); setPreviewTask(null); }}
      />}

      <Modal className="rm-task-form-modal" onClose={() => { if (!saving && (!createForm.title.trim() && !createForm.description.trim() || window.confirm('Close this task? Your draft will remain saved.'))) setFormOpen(false); }} open={formOpen} title="New task">
        <form
          className={`rm-action-form${createFieldsTouched ? '' : ' is-prefilled'}`}
          onChangeCapture={() => setCreateFieldsTouched(true)}
          onSubmit={submitCreate}
        >
          {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
          <label className="rm-field">
            <span>Task title</span>
            <input autoFocus data-modal-autofocus onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))} required value={createForm.title} />
          </label>
          <label className="rm-field">
            <span>Description</span>
            <textarea onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} rows={4} value={createForm.description} />
          </label>
          {renderTaskFields(
            createForm,
            (changes) => setCreateForm((current) => ({ ...current, ...changes })),
          )}
          <label className="rm-task-upload">
            <span className="rm-task-upload__label">Attachments</span>
            <input
              accept="application/pdf,image/*"
              className="rm-task-upload__input"
              multiple
              onChange={(event) => setCreateForm((current) => ({
                ...current,
                attachments: Array.from(event.target.files ?? []),
              }))}
              type="file"
            />
            <span className="rm-task-upload__control">
              <Icon name="paperclip" size={17} />
              <span className="rm-task-upload__button">Choose files</span>
              <span className="rm-task-upload__hint">
                {createForm.attachments?.length
                  ? `${createForm.attachments.length} file${createForm.attachments.length === 1 ? '' : 's'} selected`
                  : 'No files selected'}
              </span>
            </span>
          </label>
          <footer className="rm-dialog-actions">
            <Button disabled={saving} onClick={() => { if ((!createForm.title.trim() && !createForm.description.trim()) || window.confirm('Close this task? Your draft will remain saved.')) setFormOpen(false); }} variant="secondary">Cancel</Button>
            <Button disabled={saving || !createForm.title.trim()} type="submit">{saving ? 'Creating…' : 'Create task'}</Button>
          </footer>
        </form>
      </Modal>

      <Modal className="rm-task-form-modal" onClose={() => { if (!saving) { setEditTask(null); setEditForm(null); setEditFieldsTouched(false); } }} open={Boolean(editTask && editForm)} title={`Edit "${editTask?.title ?? 'task'}"`}>
        {editForm ? (
          <form
            className={`rm-action-form${editFieldsTouched ? '' : ' is-prefilled'}`}
            onChangeCapture={() => setEditFieldsTouched(true)}
            onSubmit={submitEdit}
          >
            {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
            <label className="rm-field">
              <span>Task title</span>
              <input onChange={(event) => setEditForm((current) => current ? ({ ...current, title: event.target.value }) : current)} required value={editForm.title} />
            </label>
            <label className="rm-field">
              <span>Description</span>
              <textarea onChange={(event) => setEditForm((current) => current ? ({ ...current, description: event.target.value }) : current)} rows={4} value={editForm.description} />
            </label>
            {renderTaskFields(
              editForm,
              (changes) => setEditForm((current) => current ? ({ ...current, ...changes }) : current),
            )}
            {editTask?.attachments?.length ? (
              <div className="rm-task-attachments">
                <span>Attachments</span>
                {editTask.attachments.map((attachment) => (
                  <div className="rm-task-attachment-row" key={attachment.id}>
                    <button
                      className="rm-task-attachment-row__preview"
                      disabled={!attachment.url}
                      onClick={() => setAttachmentPreview(attachment)}
                      type="button"
                    >
                      <strong>{attachment.name}</strong>
                      <small>Added by {attachment.uploadedByName} · {attachment.url ? 'Preview file' : 'File unavailable'}</small>
                    </button>
                    {onDeleteAttachment && role === 'admin' ? (
                      <button
                        aria-label={`Remove ${attachment.name}`}
                        className="rm-task-attachment-row__remove"
                        disabled={Boolean(removingAttachmentId)}
                        onClick={() => void removeAttachment(attachment)}
                        title="Remove attachment"
                        type="button"
                      >
                        <Icon name="trash" size={17} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            <label className="rm-task-upload">
              <span className="rm-task-upload__label">Add attachments</span>
              <input
                accept="application/pdf,image/*"
                className="rm-task-upload__input"
                multiple
                onChange={(event) => setEditForm((current) => current ? ({
                  ...current,
                  attachments: Array.from(event.target.files ?? []),
                }) : current)}
                type="file"
              />
              <span className="rm-task-upload__control">
                <Icon name="paperclip" size={17} />
                <span className="rm-task-upload__button">Choose files</span>
                <span className="rm-task-upload__hint">
                  {editForm.attachments?.length
                    ? `${editForm.attachments.length} file${editForm.attachments.length === 1 ? '' : 's'} selected`
                    : 'No files selected'}
                </span>
              </span>
            </label>
            <footer className="rm-dialog-actions rm-dialog-actions--split">
              <Button
                disabled={saving}
                onClick={() => {
                  setEditTask(null);
                  setEditForm(null);
                  setArchiveTarget(editTask);
                }}
                variant="secondary"
              >
                Archive task
              </Button>
              <div>
                <Button disabled={saving} onClick={() => { setEditTask(null); setEditForm(null); }} variant="secondary">Cancel</Button>
                <Button disabled={saving || !editForm.title.trim()} type="submit">{saving ? 'Saving…' : 'Save changes'}</Button>
              </div>
            </footer>
          </form>
        ) : null}
      </Modal>

      <Modal onClose={() => setAttachmentPreview(null)} open={Boolean(attachmentPreview)} title={attachmentPreview?.name ?? 'Attachment'} wide>
        {attachmentPreview?.url ? (
          <div className="rm-task-attachment-preview">
            {attachmentPreview.mimeType.startsWith('image/') ? (
              <img alt={attachmentPreview.name} src={attachmentPreview.url} />
            ) : attachmentPreview.mimeType === 'application/pdf' ? (
              <iframe title={attachmentPreview.name} src={attachmentPreview.url} />
            ) : null}
            <a href={attachmentPreview.url} rel="noreferrer" target="_blank">Open file in a new tab</a>
          </div>
        ) : null}
      </Modal>

      <Modal
        onClose={() => {
          if (!saving) setArchiveTarget(null);
        }}
        open={Boolean(archiveTarget)}
        title="Archive task?"
      >
        <div className="rm-archive-confirm">
          <footer className="rm-dialog-actions">
            <Button
              disabled={saving}
              onClick={() => setArchiveTarget(null)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button disabled={saving} onClick={() => void archiveTask()} variant="secondary">
              {saving ? 'Archiving…' : 'Archive task'}
            </Button>
          </footer>
        </div>
      </Modal>
    </div>
  );
}
