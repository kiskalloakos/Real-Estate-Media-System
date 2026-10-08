import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Icon,
  Modal,
  PageHeader,
  useToast,
  type PortalRole,
} from '@/components/web';
import { useBrowserPersistedState } from '@/hooks/use-browser-persisted-state';
import { clearLocalDraft, readLocalDraft, useLocalDraft } from '@/hooks/use-local-draft';

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

export interface TasksScreenProps {
  archivedTasks?: TaskSummary[];
  clients?: ClientSummary[];
  currentUserId?: string;
  members?: AgencyMemberSummary[];
  onArchiveTask?: (taskId: string) => Promise<void>;
  onCreateTask?: (input: CreateTaskInput) => Promise<void>;
  onDeleteAttachment?: (attachmentId: string) => Promise<void>;
  onRestoreTask?: (taskId: string) => Promise<void>;
  onUpdateTask?: (input: UpdateTaskInput) => Promise<void>;
  initialTaskId?: string;
  onInitialTaskOpened?: () => void;
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

const statusLabels: Record<TaskSummary['status'], string> = {
  blocked: 'Blocked',
  cancelled: 'Cancelled',
  done: 'Completed',
  in_progress: 'In progress',
  todo: 'New tasks',
};

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

function taskDateParts(value?: string) {
  if (!value) return { dueDate: '', dueTime: '17:00' };
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return {
    dueDate: local.toISOString().slice(0, 10),
    dueTime: local.toISOString().slice(11, 16),
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
  archivedTasks = [],
  clients = [],
  currentUserId,
  members = [],
  onArchiveTask,
  onCreateTask,
  onDeleteAttachment,
  onRestoreTask,
  onUpdateTask,
  initialTaskId,
  onInitialTaskOpened,
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
  const stateKey = `rm:tasks-state:${currentUserId ?? role}`;
  const [assigneeId, setAssigneeId] = useBrowserPersistedState(`${stateKey}:assignee`, 'all');
  const [taskOrder, setTaskOrder] = useBrowserPersistedState<TaskOrderState>(
    `${stateKey}:order`,
    {},
  );
  const [formOpen, setFormOpen] = useState(false);
  const [createFieldsTouched, setCreateFieldsTouched] = useState(false);
  const [editFieldsTouched, setEditFieldsTouched] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTaskInput>(emptyTask);
  const taskDraftKey = 'rm:draft:task';
  useLocalDraft(taskDraftKey, createForm, formOpen, (draft) => Boolean(draft.title.trim() || draft.description.trim()));
  const [previewTask, setPreviewTask] = useState<TaskSummary | null>(null);
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
    () => new Map(members.map((member) => [member.userId, member.avatarUrl])),
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

  const filteredTasks = useMemo(() => {
    if (role === 'team_member') return boardTasks;
    return boardTasks.filter((task) => {
      const matchesAssignee =
        assigneeId === 'all' ||
        (assigneeId === 'unassigned' && !task.assigneeUserId) ||
        task.assigneeUserId === assigneeId;
      return matchesAssignee;
    });
  }, [assigneeId, boardTasks, role]);

  const openCreate = () => {
    const draft = readLocalDraft<CreateTaskInput>(taskDraftKey) ?? emptyTask();
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
      priority: task.priority === 'urgent' || task.priority === 'high' ? 'urgent' : 'normal',
      propertyId: task.propertyId,
      status: task.status,
      taskId: task.id,
      title: task.title,
      visibility: task.visibility,
    });
    setFormError('');
    setEditFieldsTouched(false);
  };

  useEffect(() => {
    if (!initialTaskId) return;
    const task = boardTasks.find((item) => item.id === initialTaskId);
    // Opening a task is the intended synchronization with an external search selection.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (task) setPreviewTask(task);
    onInitialTaskOpened?.();
  // The target comes only from an explicit workspace-search result.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTaskId]);

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
      notify(`${task.title} moved to Archived.`);
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

    if (taskListKey(task) === destination) {
      saveTaskPosition(task, destination, targetTaskId, edge);
      return;
    }
    if (!onUpdateTask) return;

    const due = taskDateParts(task.dueAt);
    const previousStatus = task.status;
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
      notify(`${task.title} moved to ${statusLabels[status]}.`);
    } catch (caught) {
      setOptimisticStatuses((current) => ({ ...current, [task.id]: previousStatus }));
      notify(caught instanceof Error ? caught.message : 'Could not move the task.', 'error');
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
            {(['normal', 'urgent'] as const).map((priority) => (
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
                {priority === 'normal' ? 'Normal' : 'Urgent'}
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
    <div className="rm-page rm-tasks-page">
      <PageHeader
        actions={(
          <div className="rm-task-page-actions">
            {role === 'admin' ? <label className="rm-field rm-task-assignee-filter">
              <span className="rm-visually-hidden">Assigned to</span>
              <select
                onChange={(event) => {
                  const nextAssigneeId = event.target.value;
                  setAssigneeId(nextAssigneeId);
                  window.dispatchEvent(new CustomEvent('rm:task-assignee-filter', {
                    detail: { assigneeId: nextAssigneeId, stateKey },
                  }));
                }}
                value={assigneeId}
              >
                <option value="unassigned">Unassigned</option>
                <option value="all">Assigned to: Everyone</option>
                {assigneeOptions.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>Assigned to: {assignee.name}</option>
                ))}
              </select>
            </label> : null}
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

      {filteredTasks.length ? (
        <div className="rm-task-list-grid">
          {taskLists.map((list) => {
            const listTasks = orderedTasks(
              filteredTasks.filter(list.matches),
              list.key,
              taskOrder,
            );
            return (
              <Card
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
                  <h2>{list.label}</h2>
                  <div>
                    <strong>{listTasks.length}</strong>
                  </div>
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
                        draggable={canManage}
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
                            <Avatar
                              name={task.assigneeName || 'Unassigned'}
                              size="sm"
                              src={task.assigneeUserId ? memberAvatarByUserId.get(task.assigneeUserId) : undefined}
                            />
                            <span className={[
                              'rm-task-item__row-content',
                              task.dueAt ? '' : 'rm-task-item__row-content--no-deadline',
                            ].filter(Boolean).join(' ')}
                            >
                              <strong>{task.title}</strong>
                              {task.dueAt ? <small>{formatDue(task.dueAt)}</small> : null}
                              {task.priority === 'urgent' ? <span className="rm-owner-task-urgent">Urgent</span> : null}
                            </span>
                            {task.status === 'blocked' ? <span className="aw-task-badge is-blocked">Blocked</span> : task.status === 'cancelled' ? <span className="aw-task-badge">Cancelled</span> : null}
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
                      <div className="rm-task-list-card__empty">Nothing here</div>
                    ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="rm-empty-collection" tone="bright">
          <EmptyState
            action={canManage ? <Button onClick={openCreate}>Create a task</Button> : undefined}
            icon="list-check"
            title="No tasks in this view"
          />
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

      <Modal className="aw-task-preview-modal" onClose={() => setPreviewTask(null)} open={Boolean(previewTask)} title={previewTask?.title ?? 'Task preview'}>
        {previewTask ? (
          <div className="aw-task-preview">
            <dl className="aw-task-preview__details">
              <div><dt>Assigned to</dt><dd className="aw-task-preview__assignee"><Avatar name={previewTask.assigneeName || 'Unassigned'} size="sm" src={previewTask.assigneeUserId ? memberAvatarByUserId.get(previewTask.assigneeUserId) : undefined}/><span>{previewTask.assigneeName || 'Unassigned'}</span></dd></div>
              <div><dt>Client</dt><dd>{previewTask.clientName || 'Internal'}</dd></div>
              <div><dt>Status</dt><dd>{({todo: 'New task', in_progress: 'In progress', blocked: 'Needs intervention', done: 'Delivered', cancelled: 'Cancelled'} as Record<string, string>)[previewTask.status] || previewTask.status}</dd></div>
              <div><dt>Priority</dt><dd><span className={`aw-task-preview__priority${previewTask.priority === 'urgent' ? ' is-urgent' : ''}`}>{previewTask.priority}</span></dd></div>
              <div><dt>Due date</dt><dd>{previewTask.dueAt ? formatDue(previewTask.dueAt) : 'No due date'}</dd></div>
            </dl>
            <section className="aw-task-preview__description"><h3>Description</h3><p>{previewTask.description?.trim() || 'No description added.'}</p></section>
            {previewTask.attachments?.length ? <section className="aw-task-preview__attachments"><h3>Attachments</h3>{previewTask.attachments.map((attachment) => (
              <Button icon="paperclip" key={attachment.id} variant="secondary" onClick={() => setAttachmentPreview(attachment)}>{attachment.name}</Button>
            ))}</section> : null}
            <footer className="aw-task-preview__actions">
              <Button variant="secondary" onClick={() => setPreviewTask(null)}>Close</Button>
              {canManage ? <Button onClick={() => { openEdit(previewTask); setPreviewTask(null); }}>Edit task</Button> : null}
            </footer>
          </div>
        ) : null}
      </Modal>

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
