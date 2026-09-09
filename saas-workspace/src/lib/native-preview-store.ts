import { useSyncExternalStore } from 'react';

import {
  demoClients,
  demoEvents,
  demoProperties,
  demoTasks,
} from '@/screens/web/demoData';
import type {
  AgencyMemberSummary,
  CalendarEvent,
  CompanyDocumentFolderSummary,
  CompanyDocumentSummary,
  CreateCalendarEventInput,
  CreateTaskInput,
  MoveCompanyDocumentToFolderInput,
  PortalData,
  RecurringCostItem,
  TaskSummary,
  UpsertCompanyDocumentFolderInput,
  UpsertDocumentInput,
  UpdateCalendarEventInput,
  UpdateTaskInput,
} from '@/screens/web/types';

const previewMembers: AgencyMemberSummary[] = [
  {
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
    email: 'akos@realtymedia.ro',
    id: 'preview-member-akos',
    name: 'Akos Kis',
    role: 'admin',
    status: 'active',
    userId: 'demo-akos',
  },
  {
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80',
    email: 'soma@realtymedia.ro',
    id: 'preview-member-soma',
    name: 'Soma Irsai',
    role: 'team_member',
    status: 'active',
    userId: 'demo-soma',
  },
  {
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
    email: 'nessa@realtymedia.ro',
    id: 'preview-member-nessa',
    name: 'Nessa Kis',
    role: 'team_member',
    status: 'active',
    userId: 'demo-nessa',
  },
];

const previewCosts: RecurringCostItem[] = [
  {
    amount: 5,
    due: 'Due monthly',
    frequency: 'Monthly',
    frequencyKey: 'monthly',
    id: 'preview-cost-monthly',
    name: 'Monthly commitments',
    paid: false,
    type: 'monthly',
  },
];

type PreviewListener = () => void;

const listeners = new Set<PreviewListener>();
let sequence = 0;

function createSnapshot(
  tasks: TaskSummary[],
  calendarEvents: CalendarEvent[],
  companyDocuments: CompanyDocumentSummary[],
  companyDocumentFolders: CompanyDocumentFolderSummary[],
): PortalData {
  return {
    agencyMembers: previewMembers,
    agreements: [
      {
        clientId: 'client-cabana',
        clientName: 'Cabana The One',
        currency: 'RON',
        id: 'preview-agreement',
        monthlyAmount: 1000,
        status: 'active',
        title: 'Cabana The One · Realty Media agreement',
        totalValue: 12000,
      },
    ],
    calendarEvents,
    clients: demoClients,
    companyDocumentFolders,
    companyDocuments,
    costs: previewCosts,
    financeAccounts: [
      {
        accountType: 'cash',
        currency: 'RON',
        currentBalance: 900,
        id: 'preview-cash-account',
        name: 'Available cash',
        openingBalance: 900,
      },
    ],
    properties: demoProperties,
    tasks,
  };
}

let tasks = demoTasks.map((task) => ({ ...task }));
let calendarEvents = demoEvents.map((event) => ({ ...event }));
let companyDocumentFolders: CompanyDocumentFolderSummary[] = [
  { id: 'preview-folder-brand', name: 'Brand', scope: 'documents' },
  { id: 'preview-folder-production', name: 'Production', scope: 'documents' },
];
let companyDocuments: CompanyDocumentSummary[] = [
  {
    assigneeUserIds: [],
    contentHtml: 'Realty Media brand references and approved usage notes.',
    folderId: 'preview-folder-brand',
    id: 'preview-document-brand',
    kind: 'company_file',
    title: 'Brand guidelines',
    updatedAt: '2026-08-18T10:00:00.000Z',
  },
  {
    assigneeUserIds: ['demo-soma'],
    contentHtml: 'Production preparation checklist for property shoots.',
    folderId: 'preview-folder-production',
    id: 'preview-document-production',
    kind: 'sop',
    title: 'Production checklist',
    updatedAt: '2026-08-17T10:00:00.000Z',
  },
];
let snapshot = createSnapshot(
  tasks,
  calendarEvents,
  companyDocuments,
  companyDocumentFolders,
);

function notify() {
  snapshot = createSnapshot(
    tasks,
    calendarEvents,
    companyDocuments,
    companyDocumentFolders,
  );
  listeners.forEach((listener) => listener());
}

function nextId(prefix: string) {
  sequence += 1;
  return `preview-${prefix}-${Date.now()}-${sequence}`;
}

function dueAt(input: CreateTaskInput) {
  if (!input.dueDate) return undefined;
  return `${input.dueDate}T${input.dueTime || '17:00'}:00`;
}

export function useNativePreviewPortalData() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => snapshot,
  );
}

export function createPreviewTask(input: CreateTaskInput, createdByName: string) {
  const client = demoClients.find((item) => item.id === input.clientId);
  const property = demoProperties.find((item) => item.id === input.propertyId);
  const member = previewMembers.find((item) => item.userId === input.assigneeUserId);
  const now = new Date().toISOString();
  const task: TaskSummary = {
    assigneeName: member?.name ?? 'Unassigned',
    assigneeUserId: input.assigneeUserId,
    clientId: input.clientId,
    clientName: client?.name ?? 'Realty Media',
    createdAt: now,
    createdByName,
    description: input.description.trim(),
    dueAt: dueAt(input),
    id: nextId('task'),
    priority: input.priority,
    propertyId: input.propertyId,
    propertyName: property?.name ?? client?.name ?? 'Agency task',
    status: 'todo',
    title: input.title.trim(),
    visibility: input.visibility,
  };
  tasks = [task, ...tasks];
  notify();
}

export function updatePreviewTask(input: UpdateTaskInput) {
  tasks = tasks.map((task) => {
    if (task.id !== input.taskId) return task;
    const client = demoClients.find((item) => item.id === input.clientId);
    const property = demoProperties.find((item) => item.id === input.propertyId);
    const member = previewMembers.find((item) => item.userId === input.assigneeUserId);
    return {
      ...task,
      assigneeName: member?.name ?? 'Unassigned',
      assigneeUserId: input.assigneeUserId,
      clientId: input.clientId,
      clientName: client?.name ?? 'Realty Media',
      completedAt:
        input.status === 'done'
          ? task.completedAt ?? new Date().toISOString()
          : undefined,
      description: input.description.trim(),
      dueAt: dueAt(input),
      priority: input.priority,
      propertyId: input.propertyId,
      propertyName: property?.name ?? client?.name ?? 'Agency task',
      status: input.status,
      title: input.title.trim(),
      visibility: input.visibility,
    };
  });
  notify();
}

export function archivePreviewTask(taskId: string) {
  tasks = tasks.filter((task) => task.id !== taskId);
  notify();
}

export function createPreviewCalendarEvent(input: CreateCalendarEventInput, assignee: string) {
  const client = demoClients.find((item) => item.id === input.clientId);
  const property = demoProperties.find((item) => item.id === input.propertyId);
  const event: CalendarEvent = {
    allDay: input.allDay,
    color: input.color,
    assignee,
    clientId: input.clientId,
    date: input.date,
    description: input.description.trim(),
    end: input.end,
    endDate: input.endDate,
    id: nextId('event'),
    location: input.location.trim(),
    propertyId: input.propertyId,
    propertyName: property?.name ?? client?.name ?? 'Internal',
    start: input.start,
    title: input.title.trim(),
    type: input.type,
    visibility: input.visibility,
    workScope: input.workScope,
  };
  calendarEvents = [event, ...calendarEvents];
  notify();
}

export function updatePreviewCalendarEvent(input: UpdateCalendarEventInput) {
  calendarEvents = calendarEvents.map((event) => {
    if (event.id !== input.eventId) return event;
    const client = demoClients.find((item) => item.id === input.clientId);
    const property = demoProperties.find((item) => item.id === input.propertyId);
    return {
      ...event,
      ...(input.color !== undefined ? { color: input.color } : {}),
      allDay: input.allDay ?? event.allDay,
      clientId: input.clientId,
      date: input.date,
      description: input.description.trim(),
      end: input.end,
      endDate: input.endDate,
      location: input.location.trim(),
      propertyId: input.propertyId,
      propertyName: property?.name ?? client?.name ?? 'Internal',
      start: input.start,
      title: input.title.trim(),
      type: input.type,
      visibility: input.visibility,
      workScope: input.workScope,
    };
  });
  notify();
}

export function archivePreviewCalendarEvent(eventId: string) {
  calendarEvents = calendarEvents.filter((event) => event.id !== eventId);
  notify();
}

export function upsertPreviewCompanyDocument(input: UpsertDocumentInput) {
  const now = new Date().toISOString();
  const documentId = input.documentId ?? nextId('document');
  const existing = companyDocuments.find((document) => document.id === documentId);
  const file = input.file as (File & { uri?: string }) | null;
  const nextDocument: CompanyDocumentSummary = {
    assigneeUserIds: input.kind === 'sop' ? input.assigneeUserIds ?? [] : [],
    callerList: input.callerList,
    contentHtml: input.contentHtml.trim(),
    fileName: file?.name,
    fileUrl: file?.uri,
    folderId: input.folderId ?? undefined,
    id: documentId,
    kind: input.kind,
    mimeType: file?.type,
    salesDocumentType: input.salesDocumentType,
    title: input.title.trim(),
    updatedAt: now,
  };
  companyDocuments = existing
    ? companyDocuments.map((document) =>
        document.id === documentId ? nextDocument : document,
      )
    : [nextDocument, ...companyDocuments];
  notify();
  return documentId;
}

export function archivePreviewCompanyDocument(documentId: string) {
  companyDocuments = companyDocuments.filter((document) => document.id !== documentId);
  notify();
}

export function upsertPreviewCompanyDocumentFolder(
  input: UpsertCompanyDocumentFolderInput,
) {
  const folderId = input.folderId ?? nextId('folder');
  const folder: CompanyDocumentFolderSummary = {
    id: folderId,
    name: input.name.trim(),
    scope: input.scope,
  };
  companyDocumentFolders = input.folderId
    ? companyDocumentFolders.map((item) => (item.id === folderId ? folder : item))
    : [folder, ...companyDocumentFolders];
  notify();
  return folderId;
}

export function deletePreviewCompanyDocumentFolder(folderId: string) {
  companyDocumentFolders = companyDocumentFolders.filter((folder) => folder.id !== folderId);
  companyDocuments = companyDocuments.map((document) =>
    document.folderId === folderId ? { ...document, folderId: undefined } : document,
  );
  notify();
}

export function movePreviewCompanyDocumentToFolder(
  input: MoveCompanyDocumentToFolderInput,
) {
  companyDocuments = companyDocuments.map((document) =>
    document.id === input.documentId
      ? { ...document, folderId: input.folderId ?? undefined }
      : document,
  );
  notify();
}
