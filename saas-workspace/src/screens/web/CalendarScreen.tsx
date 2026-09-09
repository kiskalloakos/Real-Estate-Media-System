import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';

import {
  Button,
  Card,
  Icon,
  IconButton,
  Modal,
  PageHeader,
  ScriptReader,
  SectionHeader,
  useToast,
  type PortalRole,
  type ScriptReaderData,
} from '@/components/web';
import { CalendarColorPicker } from '@/components/web/calendar-color-picker';
import { calendarColor } from '@/lib/calendar-colors';
import { useBrowserPersistedState } from '@/hooks/use-browser-persisted-state';
import { clearLocalDraft, readLocalDraft, useLocalDraft } from '@/hooks/use-local-draft';
import { downloadCalendarIcs, googleCalendarUrl } from '@/lib/calendar-export';

import { demoEvents } from './demoData';
import { ArchiveConfirmModal } from './ArchiveConfirmModal';
import type {
  AgencyMemberSummary,
  CalendarEvent,
  ClientSummary,
  CreateCalendarEventInput,
  CreateNoteInput,
  GearItem,
  NoteItem,
  PropertySummary,
  UpdateCalendarEventInput,
  MarketingContentSummary,
  UpsertMarketingContentInput,
} from './types';

export interface CalendarScreenProps {
  clients?: ClientSummary[];
  clientWorkOnly?: boolean;
  currentUserId?: string;
  embedded?: boolean;
  events?: CalendarEvent[];
  forceCalendarFilter?: 'marketing';
  gear?: GearItem[];
  initialEventId?: string;
  marketingContent?: MarketingContentSummary[];
  members?: AgencyMemberSummary[];
  notes?: NoteItem[];
  onArchiveEvent?: (eventId: string) => Promise<void>;
  onCreateEvent?: (input: CreateCalendarEventInput) => Promise<void>;
  onCreateNote?: (input: CreateNoteInput) => Promise<void>;
  onUpdateEvent?: (input: UpdateCalendarEventInput) => Promise<void>;
  onSaveMarketingContent?: (input: UpsertMarketingContentInput) => Promise<void>;
  onEditMarketingContent?: (contentId: string) => void;
  onInitialEventOpened?: () => void;
  properties?: PropertySummary[];
  role: PortalRole;
}

const emptyEventForm: CreateCalendarEventInput = {
  allDay: false,
  color: null,
  assigneeUserIds: [],
  date: new Date().toISOString().slice(0, 10),
  description: '',
  end: '10:00',
  endDate: new Date().toISOString().slice(0, 10),
  location: '',
  start: '09:00',
  title: '',
  type: 'shoot',
  visibility: 'team',
  workScope: 'client',
};

type MarketingEventForm = {
  assigneeUserIds: string[];
  caption: string;
  contentType: string;
  platform: string;
  script: string;
};

const emptyMarketingEventForm: MarketingEventForm = {
  assigneeUserIds: [],
  caption: '',
  contentType: 'Post',
  platform: 'Instagram',
  script: '',
};

const emptyNoteForm: CreateNoteInput = {
  body: '',
  title: '',
  visibility: 'team',
};

const demoNotes: NoteItem[] = [
  {
    body: 'Cabana The One kit leaves the studio at 07:30.',
    createdAt: '2026-07-26T07:00:00Z',
    id: 'demo-note-1',
    title: 'Charge FX3 batteries',
    visibility: 'team',
  },
  {
    body: 'Review the Mountain View seasonal brief before the shoot.',
    createdAt: '2026-07-25T14:00:00Z',
    id: 'demo-note-2',
    title: 'Shot list attached',
    visibility: 'team',
  },
];

function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = date.getDay();
  // Weeks start on Monday. Sunday belongs to the preceding Monday–Sunday
  // range; treating it as +1 would make the Today action jump a week ahead.
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  date.setHours(12, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function addMonths(value: Date, months: number) {
  const date = new Date(value);
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  date.setHours(12, 0, 0, 0);
  return date;
}

function startOfMonth(value: Date) {
  const date = new Date(value);
  date.setDate(1);
  date.setHours(12, 0, 0, 0);
  return date;
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function localDateTime(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const dayLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const monthEventRowLimit = 2;
const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });
const calendarRangeDateLabel = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const fullDateLabel = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const shortMonthLabel = new Intl.DateTimeFormat('en-GB', { month: 'short' });
type CalendarView = 'month' | 'week';

function eventInstanceKey(event: CalendarEvent) {
  // Calendar event IDs are unique in persisted data. Including the rendered
  // occurrence as well makes drag state resilient to duplicate preview data
  // and avoids ever resolving a drag to a same-titled neighbouring event.
  return [event.id, event.date, event.endDate ?? '', event.start, event.end, event.title].join('\u0001');
}

function isMarketingCalendarEvent(event: CalendarEvent) {
  return event.id.startsWith('marketing:');
}

function eventColor(event: CalendarEvent) {
  return calendarColor(event.color, isMarketingCalendarEvent(event) ? 'marketing' : event.type);
}

function eventColorStyle(event: CalendarEvent): CSSProperties {
  return { '--rm-event-color': eventColor(event).color } as CSSProperties;
}

function setCalendarDragPayload(dataTransfer: DataTransfer, event: CalendarEvent) {
  dataTransfer.effectAllowed = 'move';
  // HTML drag-and-drop reliably preserves text/plain. A database event ID is
  // already a stable unique identifier, so it is the safest payload to carry
  // between calendar date targets.
  dataTransfer.setData('text/plain', event.id);
}

function draggedCalendarEvent(dataTransfer: DataTransfer, events: CalendarEvent[]) {
  const eventId = dataTransfer.getData('text/plain');
  return events.find((event) => event.id === eventId);
}

function eventOccursOnDate(event: CalendarEvent, date: string) {
  const endDate = event.endDate || event.date;
  return date >= event.date && date <= endDate;
}

function shiftIsoDate(value: string, offset: number) {
  return isoDate(addDays(new Date(`${value}T12:00:00`), offset));
}

function dateDistance(from: string, to: string) {
  return Math.round(
    (new Date(`${to}T12:00:00`).valueOf() - new Date(`${from}T12:00:00`).valueOf())
    / 86_400_000,
  );
}

type MonthEventSegment = {
  continuesFromPreviousWeek: boolean;
  continuesIntoNextWeek: boolean;
  endColumn: number;
  event: CalendarEvent;
  lane: number;
  startColumn: number;
};

function buildMonthEventSegments(
  week: { date: string }[],
  events: CalendarEvent[],
): MonthEventSegment[] {
  const weekStart = week[0]?.date;
  const weekEnd = week[week.length - 1]?.date;
  if (!weekStart || !weekEnd) return [];

  const segments = events
    .filter((event) => eventOccursOnDate(event, weekStart) || eventOccursOnDate(event, weekEnd) || (
      event.date >= weekStart && event.date <= weekEnd
    ))
    .map((event) => {
      const eventEnd = event.endDate || event.date;
      const segmentStart = event.date < weekStart ? weekStart : event.date;
      const segmentEnd = eventEnd > weekEnd ? weekEnd : eventEnd;
      return {
        continuesFromPreviousWeek: event.date < weekStart,
        continuesIntoNextWeek: eventEnd > weekEnd,
        endColumn: dateDistance(weekStart, segmentEnd),
        event,
        lane: 0,
        startColumn: dateDistance(weekStart, segmentStart),
      };
    })
    .sort((left, right) => (
      left.startColumn - right.startColumn
      || right.endColumn - left.endColumn
      || left.event.title.localeCompare(right.event.title)
    ));

  const laneEndColumns: number[] = [];
  return segments.map((segment) => {
    const availableLane = laneEndColumns.findIndex((endColumn) => endColumn < segment.startColumn);
    const lane = availableLane === -1 ? laneEndColumns.length : availableLane;
    laneEndColumns[lane] = segment.endColumn;
    return { ...segment, lane };
  });
}

export function CalendarScreen({
  clients = [],
  clientWorkOnly = false,
  events,
  currentUserId,
  embedded = false,
  forceCalendarFilter,
  gear = [],
  initialEventId,
  marketingContent = [],
  members = [],
  notes,
  onArchiveEvent,
  onCreateEvent,
  onCreateNote,
  onUpdateEvent,
  onSaveMarketingContent,
  onEditMarketingContent,
  onInitialEventOpened,
  properties = [],
  role,
}: CalendarScreenProps) {
  const { notify } = useToast();
  const stateKey = `rm:calendar-state:${currentUserId ?? role}${embedded ? ':marketing' : ''}`;
  const [anchorDateValue, setAnchorDateValue] = useBrowserPersistedState(
    `${stateKey}:anchor-date`,
    isoDate(new Date()),
  );
  const anchorDate = useMemo(() => new Date(`${anchorDateValue}T12:00:00`), [anchorDateValue]);
  const [calendarView, setCalendarView] = useBrowserPersistedState<CalendarView>(`${stateKey}:view`, 'month');
  const [calendarFilter, setCalendarFilter] = useBrowserPersistedState(`${stateKey}:calendar-filter`, forceCalendarFilter ?? 'all');
  const [propertyFilter, setPropertyFilter] = useBrowserPersistedState(`${stateKey}:property-filter`, 'all');
  const [eventForm, setEventForm] = useState<CreateCalendarEventInput>(emptyEventForm);
  const [marketingEventForm, setMarketingEventForm] = useState<MarketingEventForm>(emptyMarketingEventForm);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const marketingDraftKey = 'rm:draft:marketing-calendar';
  const [noteForm, setNoteForm] = useState<CreateNoteInput>(emptyNoteForm);
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [monthOverflowDate, setMonthOverflowDate] = useState<string | null>(null);
  const [scriptReaderOpen, setScriptReaderOpen] = useState(false);
  useEffect(() => {
    if (!initialEventId || !events) return;
    const event = events.find((candidate) => candidate.id === initialEventId);
    if (!event) return;
    const timeoutId = window.setTimeout(() => {
      setAnchorDateValue(event.date);
      setSelectedEvent(event);
      onInitialEventOpened?.();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [events, initialEventId, onInitialEventOpened, setAnchorDateValue]);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [editEventForm, setEditEventForm] = useState<UpdateCalendarEventInput | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const activeMembers = useMemo(
    () => members.filter((member) => member.status === 'active'),
    [members],
  );
  const [formError, setFormError] = useState('');
  const [draggedEventKey, setDraggedEventKey] = useState<string | null>(null);
  const [optimisticEvents, setOptimisticEvents] = useState<Record<string, CalendarEvent>>({});
  const activeCalendarFilter = forceCalendarFilter ?? (
    calendarFilter === 'founders' || calendarFilter === 'team'
      ? 'all'
      : calendarFilter
  );
  useEffect(() => {
    if (!forceCalendarFilter && (calendarFilter === 'founders' || calendarFilter === 'team')) {
      setCalendarFilter('all');
    }
  }, [calendarFilter, forceCalendarFilter, setCalendarFilter]);
  useLocalDraft(marketingDraftKey, { eventForm, marketingEventForm }, eventFormOpen && activeCalendarFilter === 'marketing', (draft) => Boolean(draft.eventForm.title.trim() || draft.marketingEventForm.caption.trim() || draft.marketingEventForm.script.trim()));
  const agencyEvents =
    events ??
    (role === 'client'
      ? demoEvents.filter((event) => event.propertyName === 'Cabana The One')
      : demoEvents);
  const marketingEvents = useMemo<CalendarEvent[]>(
    () => marketingContent
      .filter((item) => item.plannedFor)
      .map((item) => {
        const plannedFor = new Date(item.plannedFor as string);
        const plannedUntil = item.plannedUntil
          ? new Date(item.plannedUntil)
          : new Date(plannedFor.valueOf() + 60 * 60 * 1000);
        const date = isoDate(plannedFor);
        return {
          allDay: Boolean(item.allDay),
          assignee: item.assigneeUserIds?.map((userId) => activeMembers.find((member) => member.userId === userId)?.name).filter(Boolean).join(', ') || 'Realty Media',
          assigneeUserIds: item.assigneeUserIds ?? [],
          date,
          description: item.caption || item.body,
          end: item.allDay ? '' : plannedUntil.toTimeString().slice(0, 5),
          endDate: isoDate(plannedUntil),
          id: `marketing:${item.id}`,
          location: item.platform || 'Marketing',
          propertyName: 'Marketing',
          start: item.allDay ? '' : plannedFor.toTimeString().slice(0, 5),
          title: item.title,
          type: 'internal',
          visibility: 'team',
          workScope: 'internal',
        };
      }),
    [activeMembers, marketingContent],
  );
  const sourceEvents = useMemo(
    // Keep a pending move visible without masking colors edited on either app.
    () => [...agencyEvents, ...marketingEvents].map((event) => optimisticEvents[event.id]
      ? { ...optimisticEvents[event.id], color: event.color }
      : event),
    [agencyEvents, marketingEvents, optimisticEvents],
  );
  const sourceNotes = notes ?? demoNotes;
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(startOfWeek(anchorDate), index);
        return {
          date: isoDate(date),
          day: String(date.getDate()),
          isToday: isoDate(date) === isoDate(new Date()),
          label: dayLabel.format(date),
          month: shortMonthLabel.format(date),
        };
      }),
    [anchorDate],
  );
  const monthDays = useMemo(() => {
    const firstVisibleDay = startOfWeek(startOfMonth(anchorDate));
    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(firstVisibleDay, index);
      return {
        date: isoDate(date),
        day: String(date.getDate()),
        inCurrentMonth: date.getMonth() === anchorDate.getMonth(),
        isToday: isoDate(date) === isoDate(new Date()),
        label: dayLabel.format(date),
      };
    });
  }, [anchorDate]);
  const monthWeeks = useMemo(
    () => Array.from({ length: monthDays.length / 7 }, (_, index) => (
      monthDays.slice(index * 7, index * 7 + 7)
    )),
    [monthDays],
  );
  const visibleDays = calendarView === 'month' ? monthDays : weekDays;
  const clientCalendars = useMemo(
    () => {
      const grouped = new Map(clients.map((client) => [client.id, { id: client.id, name: client.name }]));
      properties.forEach((property) => grouped.set(property.clientId, { id: property.clientId, name: property.clientName }));
      return [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name));
    },
    [clients, properties],
  );
  const visibleEvents = useMemo(
    () => {
      const selectedProperty = properties.find(
        (property) => property.id === propertyFilter,
      );
      return sourceEvents.filter((event) => {
        if (!visibleDays.some((day) => eventOccursOnDate(event, day.date))) return false;
        if (clientWorkOnly && !event.clientId && !event.propertyId) return false;
        const isMarketing = event.id.startsWith('marketing:');
        if (activeCalendarFilter === 'marketing') return isMarketing;
        if (isMarketing && activeCalendarFilter !== 'all') return false;
        if (
          activeCalendarFilter.startsWith('client:') &&
          event.clientId !== activeCalendarFilter.slice('client:'.length)
        ) return false;
        if (propertyFilter === 'all') return true;
        if (event.propertyId) return event.propertyId === propertyFilter;
        return Boolean(
          selectedProperty
          && event.propertyName === selectedProperty.name
          && (!event.clientId || event.clientId === selectedProperty.clientId),
        );
      });
    },
    [activeCalendarFilter, clientWorkOnly, properties, propertyFilter, sourceEvents, visibleDays],
  );
  const monthEventSegments = useMemo(
    () => monthWeeks.map((week) => buildMonthEventSegments(week, visibleEvents)),
    [monthWeeks, visibleEvents],
  );
  const monthOverflowEvents = useMemo(
    () => monthOverflowDate
      ? visibleEvents.filter((event) => eventOccursOnDate(event, monthOverflowDate))
      : [],
    [monthOverflowDate, visibleEvents],
  );
  const selectedEventGear = selectedEvent
    ? gear.filter((item) => item.calendarEventId === selectedEvent.id)
    : [];
  const selectedMarketingItem = selectedEvent?.id.startsWith('marketing:')
    ? marketingContent.find((item) => item.id === selectedEvent.id.slice('marketing:'.length))
    : undefined;
  const scriptReaderData: ScriptReaderData | null = selectedMarketingItem && selectedEvent ? {
    assignees: selectedEvent.assigneeUserIds?.map((userId) => activeMembers.find((member) => member.userId === userId)?.name).filter((name): name is string => Boolean(name)) ?? [],
    caption: selectedMarketingItem.caption,
    platform: selectedMarketingItem.platform,
    schedule: `${fullDateLabel.format(new Date(`${selectedEvent.date}T12:00:00`))}${selectedEvent.allDay ? ' · All day' : ` · ${selectedEvent.start}${selectedEvent.end ? ` — ${selectedEvent.end}` : ''}`}`,
    script: selectedMarketingItem.body,
    status: selectedMarketingItem.status,
    title: selectedMarketingItem.title,
  } : null;

  const setEventField = <K extends keyof CreateCalendarEventInput>(
    key: K,
    value: CreateCalendarEventInput[K],
  ) => setEventForm((current) => ({ ...current, [key]: value }));

  const setEventAllDay = (allDay: boolean) => {
    setEventForm((current) => ({
      ...current,
      allDay,
      end: allDay ? '' : (current.end || '10:00'),
      endDate: current.endDate || current.date,
      start: allDay ? '' : (current.start || '09:00'),
    }));
  };

  const setEditEventAllDay = (allDay: boolean) => {
    setEditEventForm((current) => current ? ({
      ...current,
      allDay,
      end: allDay ? '' : (current.end || '10:00'),
      endDate: current.endDate || current.date,
      start: allDay ? '' : (current.start || '09:00'),
    }) : current);
  };

  const setMarketingEventField = <K extends keyof MarketingEventForm>(
    key: K,
    value: MarketingEventForm[K],
  ) => setMarketingEventForm((current) => ({ ...current, [key]: value }));

  const toggleEventAssignee = (selectedIds: string[] | undefined, userId: string) => (
    selectedIds?.includes(userId)
      ? selectedIds.filter((id) => id !== userId)
      : [...(selectedIds ?? []), userId]
  );

  const eventAssigneePicker = (
    selectedIds: string[] | undefined,
    onChange: (ids: string[]) => void,
  ) => (
    <div className="rm-field">
      <span>Assigned to</span>
      <div className="rm-event-assignee-picker">
        {activeMembers.map((member) => {
          const checked = selectedIds?.includes(member.userId) ?? false;
          return (
            <label className="rm-event-assignee-option" key={member.userId}>
              <input
                checked={checked}
                onChange={() => onChange(toggleEventAssignee(selectedIds, member.userId))}
                type="checkbox"
              />
              <span>{member.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );

  const openEventForm = (date = isoDate(new Date())) => {
    setFormError('');
    const draft = activeCalendarFilter === 'marketing'
      ? readLocalDraft<{ eventForm: CreateCalendarEventInput; marketingEventForm: MarketingEventForm }>(marketingDraftKey)
      : null;
    setEventForm({
      ...emptyEventForm,
      ...(draft?.eventForm ?? {}),
      date,
      endDate: date,
      visibility: 'team',
    });
    setMarketingEventForm(draft?.marketingEventForm ?? emptyMarketingEventForm);
    setEventFormOpen(true);
  };

  const moveEventToDate = async (calendarEvent: CalendarEvent, targetDate: string) => {
    if (role === 'client' || calendarEvent.date === targetDate) return;
    const offset = dateDistance(calendarEvent.date, targetDate);
    const movedEvent: CalendarEvent = {
      ...calendarEvent,
      date: targetDate,
      endDate: shiftIsoDate(calendarEvent.endDate || calendarEvent.date, offset),
    };
    // Move immediately. Persistence follows without holding the calendar in its
    // old position while the request crosses the network.
    // Preserve the optimistic move under the database event ID. Unlike an
    // occurrence key, this remains stable after each successful drop, so the
    // same event can be dragged repeatedly without waiting for a reload.
    const eventKey = calendarEvent.id;
    setOptimisticEvents((current) => ({ ...current, [eventKey]: movedEvent }));
    setDraggedEventKey(null);
    try {
      if (calendarEvent.id.startsWith('marketing:')) {
        const source = marketingContent.find((item) => item.id === calendarEvent.id.slice('marketing:'.length));
        if (!source || !onSaveMarketingContent) return;
        const original = new Date(source.plannedFor as string);
        original.setDate(original.getDate() + offset);
        const originalEnd = new Date((source.plannedUntil || source.plannedFor) as string);
        originalEnd.setDate(originalEnd.getDate() + offset);
        await onSaveMarketingContent({
          allDay: source.allDay,
          assigneeUserIds: source.assigneeUserIds ?? [],
          body: source.body,
          caption: source.caption,
          contentId: source.id,
          contentType: source.contentType,
          plannedFor: localDateTime(original),
          plannedUntil: localDateTime(originalEnd),
          platform: source.platform,
          status: source.status,
          title: source.title,
        });
      } else if (onUpdateEvent) {
        await onUpdateEvent({
          allDay: calendarEvent.allDay,
          assigneeUserIds: calendarEvent.assigneeUserIds,
          clientId: calendarEvent.clientId,
          color: calendarEvent.color ?? null,
          date: targetDate,
          description: calendarEvent.description ?? '',
          end: calendarEvent.allDay ? '' : calendarEvent.end,
          endDate: shiftIsoDate(calendarEvent.endDate || calendarEvent.date, offset),
          eventId: calendarEvent.id,
          location: calendarEvent.location,
          propertyId: calendarEvent.propertyId,
          start: calendarEvent.start,
          title: calendarEvent.title,
          type: calendarEvent.type,
          visibility: calendarEvent.visibility ?? 'team',
          workScope: calendarEvent.workScope,
        });
      }
      notify(`${calendarEvent.title} was moved.`);
    } catch (caught) {
      setOptimisticEvents((current) => {
        const next = { ...current };
        delete next[eventKey];
        return next;
      });
      notify(caught instanceof Error ? caught.message : 'Could not move the event.', 'error');
    }
  };

  const moveCalendar = (direction: -1 | 1) => {
    setAnchorDateValue(isoDate(
      calendarView === 'month'
        ? addMonths(anchorDate, direction)
        : addDays(anchorDate, direction * 7),
    ));
  };

  const calendarRangeLabel =
    calendarView === 'month'
      ? monthLabel.format(anchorDate)
      : `${calendarRangeDateLabel.format(startOfWeek(anchorDate))} — ${calendarRangeDateLabel.format(addDays(startOfWeek(anchorDate), 6))}`;

  const submitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onCreateEvent && !(activeCalendarFilter === 'marketing' && onSaveMarketingContent)) return;
    if (activeCalendarFilter === 'marketing') {
      await saveMarketingEvent('ready');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (onCreateEvent) {
        await onCreateEvent(eventForm);
      }
      setEventFormOpen(false);
      notify('Event added to the Realty Media calendar.');
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not create the event.');
    } finally {
      setSaving(false);
    }
  };

  const saveMarketingEvent = async (status: 'draft' | 'ready') => {
    if (!onSaveMarketingContent || !eventForm.title.trim()) return;
    setSaving(true);
    setFormError('');
    try {
      await onSaveMarketingContent({
        assigneeUserIds: marketingEventForm.assigneeUserIds,
        body: marketingEventForm.script,
        caption: marketingEventForm.caption,
        contentType: marketingEventForm.contentType,
        allDay: eventForm.allDay,
        plannedFor: `${eventForm.date}T${eventForm.allDay ? '00:00' : eventForm.start}:00`,
        plannedUntil: `${eventForm.endDate || eventForm.date}T${eventForm.allDay ? '23:59' : (eventForm.end || eventForm.start)}:00`,
        platform: marketingEventForm.platform,
        status,
        title: eventForm.title,
      });
      clearLocalDraft(marketingDraftKey);
      setEventFormOpen(false);
      notify(status === 'draft' ? 'Marketing draft saved.' : 'Marketing content scheduled.');
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not save the marketing item.');
    } finally {
      setSaving(false);
    }
  };

  const submitNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onCreateNote) return;
    setSaving(true);
    setFormError('');
    try {
      await onCreateNote(noteForm);
      setNoteFormOpen(false);
      setNoteForm(emptyNoteForm);
      notify('Note pinned to the workspace.');
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not save the note.');
    } finally {
      setSaving(false);
    }
  };

  const openEditEvent = (calendarEvent: CalendarEvent) => {
    setSelectedEvent(null);
    setFormError('');
    setEditEvent(calendarEvent);
    setEditEventForm({
      allDay: calendarEvent.allDay,
      assigneeUserIds: calendarEvent.assigneeUserIds ?? [],
      clientId: calendarEvent.clientId,
      color: calendarEvent.color ?? null,
      date: calendarEvent.date,
      description: calendarEvent.description ?? '',
      end: calendarEvent.allDay ? '' : calendarEvent.end,
      endDate: calendarEvent.endDate || calendarEvent.date,
      eventId: calendarEvent.id,
      location: calendarEvent.location,
      propertyId: calendarEvent.propertyId,
      start: calendarEvent.start,
      title: calendarEvent.title,
      type: calendarEvent.type,
      visibility: calendarEvent.visibility ?? 'team',
      workScope: calendarEvent.workScope,
    });
  };

  const submitEventUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editEventForm || !onUpdateEvent) return;
    setSaving(true);
    setFormError('');
    try {
      await onUpdateEvent(editEventForm);
      setEditEvent(null);
      setEditEventForm(null);
      notify(`${editEventForm.title} was updated.`);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not update the event.');
    } finally {
      setSaving(false);
    }
  };

  const archiveEvent = async () => {
    if (!archiveTarget || !onArchiveEvent) return;
    setSaving(true);
    try {
      await onArchiveEvent(archiveTarget.id);
      notify(`${archiveTarget.title} was deleted.`);
      setArchiveTarget(null);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not delete the event.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rm-page${embedded ? ' rm-calendar-embedded' : ''}`}>
      {!embedded ? <PageHeader
        description={
          role === 'client'
            ? 'Shoots, reviews and delivery dates for your properties.'
            : 'A complete view of shoots, deadlines, reviews and internal production.'
        }
        eyebrow={calendarRangeLabel}
        title="Calendar"
      /> : null}

      <div className="rm-calendar-layout">
        <Card className="rm-calendar-card" tone="bright">
          <div className="rm-calendar-toolbar">
            <div className="rm-calendar-toolbar__date">
              <IconButton
                icon="chevron-left"
                label={`Previous ${calendarView}`}
                onClick={() => moveCalendar(-1)}
                size="sm"
              />
              <h2>{calendarRangeLabel}</h2>
              <IconButton
                icon="chevron-right"
                label={`Next ${calendarView}`}
                onClick={() => moveCalendar(1)}
                size="sm"
              />
            </div>
            <div className="rm-calendar-toolbar__controls">
              <div aria-label="Calendar view" className="rm-calendar-view-switch">
                {(['month', 'week'] as const).map((view) => (
                  <button
                    aria-pressed={calendarView === view}
                    className={calendarView === view ? 'is-active' : undefined}
                    key={view}
                    onClick={() => setCalendarView(view)}
                    type="button"
                  >
                    {view === 'month' ? 'Month' : 'Week'}
                  </button>
                ))}
              </div>
              {!forceCalendarFilter && !clientWorkOnly ? <label className="rm-calendar-property-filter">
                <select
                  aria-label="Choose a synced calendar"
                  onChange={(event) => {
                    setCalendarFilter(event.target.value);
                    setPropertyFilter('all');
                  }}
                  value={activeCalendarFilter}
                >
                  <option value="all">All calendars</option>
                  <option value="marketing">Marketing</option>
                  {clientCalendars.map((client) => (
                    <option key={client.id} value={`client:${client.id}`}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              : null}
              {!forceCalendarFilter ? <label className="rm-calendar-property-filter">
                <select
                  aria-label="Filter calendar by property"
                  onChange={(event) => setPropertyFilter(event.target.value)}
                  value={propertyFilter}
                >
                  <option value="all">All properties</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name} · {property.clientName}
                    </option>
                  ))}
                </select>
              </label> : null}
            </div>
            <div className="rm-calendar-toolbar__actions">
              <Button
                icon="calendar"
                onClick={() => setAnchorDateValue(isoDate(new Date()))}
                variant="secondary"
              >
                Today
              </Button>
              {role !== 'client' ? (
                <Button icon="plus" onClick={() => openEventForm()}>{activeCalendarFilter === 'marketing' ? 'New marketing item' : 'New event'}</Button>
              ) : null}
            </div>
          </div>

          {calendarView === 'month' ? (
            <div className={`rm-month-grid rm-month-grid--${monthWeeks.length}`} role="grid">
              <div className="rm-month-grid__weekdays">
                {weekDays.map((day) => (
                  <div className="rm-month-grid__weekday" key={day.label} role="columnheader">
                    {day.label}
                  </div>
                ))}
              </div>
              {monthWeeks.map((week, weekIndex) => {
                const eventSegments = monthEventSegments[weekIndex] ?? [];
                const visibleSegments = eventSegments.filter((segment) => segment.lane < monthEventRowLimit);
                const overflowByDate = new Map(week.map((day) => [
                  day.date,
                  eventSegments.filter((segment) => (
                    segment.lane >= monthEventRowLimit
                    && segment.startColumn <= week.findIndex((candidate) => candidate.date === day.date)
                    && segment.endColumn >= week.findIndex((candidate) => candidate.date === day.date)
                  )).length,
                ]));
                return (
                  <div
                    className="rm-month-grid__week"
                    key={week[0]?.date ?? weekIndex}
                    onDragOver={(event) => {
                      if (role !== 'client') event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const movingEvent = draggedCalendarEvent(event.dataTransfer, sourceEvents);
                      const bounds = event.currentTarget.getBoundingClientRect();
                      const dayIndex = Math.max(0, Math.min(6, Math.floor(
                        (event.clientX - bounds.left) / (bounds.width / 7),
                      )));
                      const targetDate = week[dayIndex]?.date;
                      if (movingEvent && targetDate) void moveEventToDate(movingEvent, targetDate);
                    }}
                    style={{ '--rm-month-event-rows': monthEventRowLimit } as CSSProperties}
                  >
                    <div className="rm-month-grid__days">
                      {week.map((day) => {
                        const overflowCount = overflowByDate.get(day.date) ?? 0;
                        return (
                        <div
                          className={[
                            'rm-month-grid__day',
                            day.inCurrentMonth ? '' : 'is-outside',
                            day.isToday ? 'is-today' : '',
                          ].filter(Boolean).join(' ')}
                          key={day.date}
                          onClick={(event) => {
                            if (role !== 'client' && !(event.target as HTMLElement).closest('button')) openEventForm(day.date);
                          }}
                          role="gridcell"
                        >
                          <button
                            aria-label={
                              role === 'client'
                                ? fullDateLabel.format(new Date(`${day.date}T12:00:00`))
                                : `Add event on ${fullDateLabel.format(new Date(`${day.date}T12:00:00`))}`
                            }
                            className="rm-month-grid__date"
                            disabled={role === 'client'}
                            onClick={() => openEventForm(day.date)}
                            type="button"
                          >
                            {day.day}
                          </button>
                          {overflowCount ? (
                            <button
                              aria-label={`Show ${overflowCount} more events on ${fullDateLabel.format(new Date(`${day.date}T12:00:00`))}`}
                              className="rm-month-grid__more"
                              onClick={(event) => {
                                event.stopPropagation();
                                setMonthOverflowDate(day.date);
                              }}
                              type="button"
                            >
                              +{overflowCount} more
                            </button>
                          ) : null}
                        </div>
                        );
                      })}
                    </div>
                    <div className="rm-month-grid__events">
                      {visibleSegments.map((segment) => {
                        const event = segment.event;
                        return (
                        <button
                          className={[
                            `rm-month-event rm-month-event--${event.type}`,
                            isMarketingCalendarEvent(event) ? 'is-marketing-event' : '',
                            segment.continuesFromPreviousWeek ? 'is-continuing-from-previous-week' : '',
                            segment.continuesIntoNextWeek ? 'is-continuing-into-next-week' : '',
                            draggedEventKey === eventInstanceKey(event) ? 'is-dragging' : '',
                          ].filter(Boolean).join(' ')}
                          data-event-color={eventColor(event).id}
                          title={`${event.title} · ${eventColor(event).label}`}
                          draggable={role !== 'client'}
                          key={`${eventInstanceKey(event)}:${week[0]?.date ?? weekIndex}`}
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            setSelectedEvent(event);
                          }}
                          onDragEnd={() => setDraggedEventKey(null)}
                          onDragStart={(dragEvent) => {
                            setCalendarDragPayload(dragEvent.dataTransfer, event);
                            setDraggedEventKey(eventInstanceKey(event));
                          }}
                          style={{
                            ...eventColorStyle(event),
                            gridColumn: `${segment.startColumn + 1} / ${segment.endColumn + 2}`,
                            gridRow: segment.lane + 1,
                          }}
                          type="button"
                        >
                          {!event.allDay && !segment.continuesFromPreviousWeek ? <span>{event.start}</span> : null}
                          <strong>{event.title}</strong>
                        </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rm-week-stack-grid" role="grid">
              {weekDays.map((day) => (
                <div
                  className={`rm-week-stack-grid__day${day.isToday ? ' is-today' : ''}`}
                  key={day.date}
                  role="columnheader"
                >
                  <span>{day.label} · {day.month}</span>
                  <strong>{day.day}</strong>
                </div>
              ))}

              {weekDays.map((day) => (
                <div
                  className={`rm-week-stack-grid__events${day.isToday ? ' is-today' : ''}`}
                  key={`events-${day.date}`}
                  onClick={(event) => {
                    if (role !== 'client' && !(event.target as HTMLElement).closest('button')) openEventForm(day.date);
                  }}
                  onDragOver={(event) => {
                    if (role !== 'client') event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const movingEvent = draggedCalendarEvent(event.dataTransfer, sourceEvents);
                    if (movingEvent) void moveEventToDate(movingEvent, day.date);
                  }}
                  role="gridcell"
                >
                  {visibleEvents
                    .filter((event) => eventOccursOnDate(event, day.date))
                    .sort((left, right) => (
                      Number(Boolean(right.allDay)) - Number(Boolean(left.allDay))
                      || left.start.localeCompare(right.start)
                      || left.title.localeCompare(right.title)
                    ))
                    .map((event) => (
                      <button
                        aria-label={`${event.title}, ${eventColor(event).label}`}
                        data-event-color={eventColor(event).id}
                        style={eventColorStyle(event)}
                        className={`rm-week-stack-event${isMarketingCalendarEvent(event) ? ' is-marketing-event' : ' rm-button--primary'}${draggedEventKey === eventInstanceKey(event) ? ' is-dragging' : ''}`}
                        draggable={role !== 'client'}
                        key={eventInstanceKey(event)}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          setSelectedEvent(event);
                        }}
                        onDragEnd={() => setDraggedEventKey(null)}
                        onDragStart={(dragEvent) => {
                          setCalendarDragPayload(dragEvent.dataTransfer, event);
                          setDraggedEventKey(eventInstanceKey(event));
                        }}
                        type="button"
                      >
                        <span>{event.allDay ? 'All day' : `${event.start}${event.end ? ` — ${event.end}` : ''}`}</span>
                        <strong>{event.title}</strong>
                        <small>{event.propertyName || event.location}</small>
                      </button>
                    ))}
                </div>
              ))}
            </div>
          )}

          <div className="rm-mobile-agenda" aria-label="Calendar agenda">
            {!visibleEvents.length ? <p className="rm-empty-copy">No events in this {calendarView}. Choose another period or add a new event.</p> : null}
            {visibleEvents.map((event) => (
              <button key={eventInstanceKey(event)} onClick={() => setSelectedEvent(event)} type="button">
                <span aria-label={eventColor(event).label} className="rm-event-dot" style={{ backgroundColor: eventColor(event).color }} />
                <span>
                  <small>{dayLabel.format(new Date(`${event.date}T12:00:00`))} {new Date(`${event.date}T12:00:00`).getDate()} · {event.start}</small>
                  <strong>{event.title}</strong>
                  <small>{event.propertyName} · {event.location}</small>
                </span>
                <Icon name="chevron-right" size={16} />
              </button>
            ))}
          </div>

        </Card>
      </div>

      <Card className="rm-reminders-card rm-reminders-card--full" hidden tone="bright">
        <SectionHeader
          action={role !== 'client' ? (
            <Button icon="plus" onClick={() => setNoteFormOpen(true)} variant="secondary">New note</Button>
          ) : undefined}
          kicker="Pinned"
          title="Reminders & notes"
        />
        <div className="rm-reminder-list">
          {sourceNotes.slice(0, 8).map((note) => (
            <article key={note.id}>
              <span className="rm-reminder-list__icon"><Icon name="message" size={16} /></span>
              <div>
                <strong>{note.title}</strong>
                <p>{note.body}</p>
                <small>{new Date(note.createdAt).toLocaleDateString('en-GB')}</small>
              </div>
            </article>
          ))}
        </div>
        {!sourceNotes.length ? (
          <p className="rm-empty-copy">No notes pinned yet.</p>
        ) : null}
      </Card>

      <Modal
        onClose={() => {
          const hasDraft = activeCalendarFilter === 'marketing' && (eventForm.title.trim() || marketingEventForm.caption.trim() || marketingEventForm.script.trim());
          if (hasDraft && !window.confirm('Close this marketing item? Your draft will remain saved.')) return;
          setEventFormOpen(false);
        }}
        open={eventFormOpen}
        title={activeCalendarFilter === 'marketing' ? 'New marketing item' : 'New calendar event'}
      >
        <form className="rm-action-form rm-calendar-event-form" onSubmit={submitEvent}>
          {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
          <label className="rm-field">
            <span>{activeCalendarFilter === 'marketing' ? 'Content title' : 'Event title'}</span>
            <input
              onChange={(event) => setEventField('title', event.target.value)}
              placeholder={activeCalendarFilter === 'marketing'
                ? 'e.g. Mountain View summer reel'
                : 'e.g. Mountain View summer shoot'}
              required
              value={eventForm.title}
            />
          </label>
          {activeCalendarFilter === 'marketing' ? (
            <div className="rm-form-grid rm-form-grid--two">
              <label className="rm-field">
                <span>Platform</span>
                <select
                  onChange={(event) => setMarketingEventField('platform', event.target.value)}
                  value={marketingEventForm.platform}
                >
                  <option>Instagram</option>
                  <option>Facebook</option>
                  <option>TikTok</option>
                  <option>YouTube</option>
                  <option>Website</option>
                  <option>Multi-platform</option>
                </select>
              </label>
              <label className="rm-field">
                <span>Content type</span>
                <select
                  onChange={(event) => setMarketingEventField('contentType', event.target.value)}
                  value={marketingEventForm.contentType}
                >
                  <option>Post</option>
                  <option>Reel</option>
                  <option>Story</option>
                  <option>Video</option>
                </select>
              </label>
            </div>
          ) : null}
          {activeCalendarFilter !== 'marketing' ? <CalendarColorPicker value={eventForm.color} type={eventForm.type} disabled={saving} onChange={(color) => setEventField('color', color)} /> : null}
          {activeCalendarFilter !== 'marketing' ? <div className="rm-form-grid">
            <label className="rm-field">
              <span>Work classification</span>
              <select
                onChange={(event) => setEventField('workScope', event.target.value as CreateCalendarEventInput['workScope'])}
                value={eventForm.workScope}
              >
                <option value="client">Client work</option>
                <option value="internal">Internal work</option>
                <option value="other">Other / unavailable</option>
              </select>
            </label>
            <label className="rm-field">
              <span>Visibility</span>
              <select
                onChange={(event) => setEventField('visibility', event.target.value as CreateCalendarEventInput['visibility'])}
                value={eventForm.visibility}
              >
                {role === 'admin' ? <option value="admin_only">Founders</option> : null}
                <option value="team">Team & founders</option>
                <option value="client">Client</option>
              </select>
            </label>
          </div>
          : null}
          {activeCalendarFilter !== 'marketing' ? <label className="rm-field">
            <span>Property</span>
            <select
              onChange={(event) => {
                const property = properties.find((item) => item.id === event.target.value);
                setEventForm((current) => ({
                  ...current,
                  clientId: property?.clientId,
                  propertyId: property?.id,
                }));
              }}
              value={eventForm.propertyId ?? ''}
            >
              <option value="">Agency / no property</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.name} · {property.clientName}</option>)}
            </select>
          </label>
          : null}
          <div className="rm-form-grid rm-form-grid--two">
            <label className="rm-field">
              <span>Start date</span>
              <input onChange={(event) => setEventField('date', event.target.value)} required type="date" value={eventForm.date} />
            </label>
            <label className="rm-field">
              <span>End date</span>
              <input min={eventForm.date} onChange={(event) => setEventField('endDate', event.target.value)} required type="date" value={eventForm.endDate || eventForm.date} />
            </label>
          </div>
          <label className="rm-checkbox rm-calendar-all-day-toggle">
            <input
              checked={Boolean(eventForm.allDay)}
              onChange={(event) => setEventAllDay(event.target.checked)}
              type="checkbox"
            />
            <span>All day</span>
          </label>
          {!eventForm.allDay ? <div className="rm-form-grid rm-form-grid--two">
            <label className="rm-field">
              <span>Starts</span>
              <input onChange={(event) => setEventField('start', event.target.value)} required type="time" value={eventForm.start} />
            </label>
            <label className="rm-field">
              <span>Ends</span>
              <input onChange={(event) => setEventField('end', event.target.value)} type="time" value={eventForm.end} />
            </label>
          </div>
          : null}
          {activeCalendarFilter !== 'marketing' ? <label className="rm-field">
            <span>Location</span>
            <input onChange={(event) => setEventField('location', event.target.value)} placeholder="Studio, property, or video call" value={eventForm.location} />
          </label>
          : null}
          {activeCalendarFilter === 'marketing'
            ? eventAssigneePicker(marketingEventForm.assigneeUserIds, (assigneeUserIds) => setMarketingEventField('assigneeUserIds', assigneeUserIds))
            : eventAssigneePicker(eventForm.assigneeUserIds, (assigneeUserIds) => setEventField('assigneeUserIds', assigneeUserIds))}
          {activeCalendarFilter === 'marketing' ? (
            <>
              <label className="rm-field">
                <span>Caption</span>
                <textarea
                  onChange={(event) => setMarketingEventField('caption', event.target.value)}
                  placeholder="Write the public-facing caption, including hashtags and calls to action."
                  rows={4}
                  value={marketingEventForm.caption}
                />
              </label>
              <label className="rm-field">
                <span>Content script</span>
                <textarea
                  onChange={(event) => setMarketingEventField('script', event.target.value)}
                  placeholder="Write the hook, scenes, voiceover, and production notes."
                  rows={8}
                  value={marketingEventForm.script}
                />
              </label>
            </>
          ) : (
            <label className="rm-field">
              <span>Notes</span>
              <textarea onChange={(event) => setEventField('description', event.target.value)} rows={3} value={eventForm.description} />
            </label>
          )}
          <footer className="rm-dialog-actions">
            <Button disabled={saving} onClick={() => {
              const hasDraft = activeCalendarFilter === 'marketing' && (eventForm.title.trim() || marketingEventForm.caption.trim() || marketingEventForm.script.trim());
              if (hasDraft && !window.confirm('Close this marketing item? Your draft will remain saved.')) return;
              setEventFormOpen(false);
            }} variant="secondary">Cancel</Button>
            {activeCalendarFilter === 'marketing' ? (
              <>
                <Button
                  disabled={saving || !eventForm.title.trim()}
                  onClick={() => void saveMarketingEvent('draft')}
                  variant="paper"
                >
                  {saving ? 'Saving…' : 'Save draft'}
                </Button>
                <Button disabled={saving || !eventForm.title.trim()} type="submit">
                  {saving ? 'Scheduling…' : 'Schedule content'}
                </Button>
              </>
            ) : (
              <Button disabled={saving || !eventForm.title.trim()} type="submit">{saving ? 'Scheduling…' : 'Schedule event'}</Button>
            )}
          </footer>
        </form>
      </Modal>

      <Modal
        description="Keep an internal reminder visible beside the production calendar."
        onClose={() => setNoteFormOpen(false)}
        open={noteFormOpen}
        title="New note"
      >
        <form className="rm-action-form" onSubmit={submitNote}>
          {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
          <label className="rm-field">
            <span>Title</span>
            <input onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))} required value={noteForm.title} />
          </label>
          <label className="rm-field">
            <span>Note</span>
            <textarea onChange={(event) => setNoteForm((current) => ({ ...current, body: event.target.value }))} required rows={5} value={noteForm.body} />
          </label>
          <label className="rm-field">
            <span>Visibility</span>
            <select onChange={(event) => setNoteForm((current) => ({ ...current, visibility: event.target.value as CreateNoteInput['visibility'] }))} value={noteForm.visibility}>
              {role === 'admin' ? <option value="admin_only">Founders</option> : null}
                <option value="team">Team & founders</option>
              <option value="client">Client</option>
            </select>
          </label>
          <footer className="rm-dialog-actions">
            <Button disabled={saving} onClick={() => setNoteFormOpen(false)} variant="secondary">Cancel</Button>
            <Button disabled={saving || !noteForm.title.trim() || !noteForm.body.trim()} type="submit">{saving ? 'Saving…' : 'Pin note'}</Button>
          </footer>
        </form>
      </Modal>

      <Modal
        className="rm-modal--overflow"
        onClose={() => setMonthOverflowDate(null)}
        open={Boolean(monthOverflowDate)}
        title={monthOverflowDate ? `Events on ${fullDateLabel.format(new Date(`${monthOverflowDate}T12:00:00`))}` : 'More events'}
      >
        <div className="rm-calendar-overflow-list">
          {monthOverflowEvents.map((event) => (
            <button
              data-event-color={eventColor(event).id}
              style={eventColorStyle(event)}
              aria-label={`${event.title}, ${eventColor(event).label}`}
              className={`rm-calendar-overflow-event${isMarketingCalendarEvent(event) ? ' is-marketing-event' : ' rm-button--primary'}`}
              key={eventInstanceKey(event)}
              onClick={() => {
                setMonthOverflowDate(null);
                setSelectedEvent(event);
              }}
              type="button"
            >
              <span>{event.allDay ? 'All day' : `${event.start}${event.end ? ` — ${event.end}` : ''}`}</span>
              <strong>{event.title}</strong>
              <small>{event.propertyName || event.location}</small>
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        onClose={() => setSelectedEvent(null)}
        open={Boolean(selectedEvent)}
        title={selectedEvent?.title ?? 'Event'}
      >
        {selectedEvent ? (
          <div className="rm-event-detail">
            <dl className="rm-detail-list">
              <div><dt>Event color</dt><dd><span aria-hidden="true" className="rm-calendar-color-dot" style={{ backgroundColor: eventColor(selectedEvent).color }} /> {eventColor(selectedEvent).label}{!selectedEvent.color ? ' (automatic)' : ''}</dd></div>
              <div><dt>Start date</dt><dd>{fullDateLabel.format(new Date(`${selectedEvent.date}T12:00:00`))}</dd></div>
              {selectedEvent.endDate && selectedEvent.endDate !== selectedEvent.date ? <div><dt>End date</dt><dd>{fullDateLabel.format(new Date(`${selectedEvent.endDate}T12:00:00`))}</dd></div> : null}
              <div><dt>Time</dt><dd>{selectedEvent.allDay ? 'All day' : `${selectedEvent.start}${selectedEvent.end ? ` — ${selectedEvent.end}` : ''}`}</dd></div>
              <div><dt>Property</dt><dd>{selectedEvent.propertyName}</dd></div>
              <div><dt>Location</dt><dd>{selectedEvent.location || 'Not specified'}</dd></div>
              <div><dt>Visibility</dt><dd>{selectedEvent.visibility?.replace('_', ' ') ?? 'Workspace'}</dd></div>
              {selectedEventGear.length ? <div><dt>Equipment</dt><dd>{selectedEventGear.map((item) => item.name).join(', ')}</dd></div> : null}
              {selectedEvent.assigneeUserIds?.length ? <div><dt>Assigned to</dt><dd>{selectedEvent.assigneeUserIds.map((userId) => activeMembers.find((member) => member.userId === userId)?.name).filter(Boolean).join(', ')}</dd></div> : null}
              {selectedMarketingItem?.caption ? <div><dt>Caption</dt><dd>{selectedMarketingItem.caption}</dd></div> : null}
              {selectedMarketingItem?.body ? <div><dt>Script</dt><dd className="rm-event-detail__script-preview">{selectedMarketingItem.body}</dd></div> : null}
              {!selectedMarketingItem && selectedEvent.description ? <div><dt>Notes</dt><dd>{selectedEvent.description}</dd></div> : null}
            </dl>
            <footer className="rm-event-detail__actions">
              <Button
                icon="arrow-up-right"
                onClick={() => window.open(googleCalendarUrl(selectedEvent), '_blank', 'noopener,noreferrer')}
                variant="secondary"
              >
                Google Calendar
              </Button>
              <Button
                icon="calendar"
                onClick={() => {
                  downloadCalendarIcs(selectedEvent);
                  notify('Apple Calendar file downloaded.');
                }}
                variant="secondary"
              >
                Apple Calendar
              </Button>
              {selectedMarketingItem?.body ? <Button icon="arrow-up-right" onClick={() => setScriptReaderOpen(true)} variant="secondary">Open script reader</Button> : null}
              {role === 'admin' ? (
                <>
                {selectedEvent.id.startsWith('marketing:') ? (
                  onEditMarketingContent ? <Button onClick={() => {
                    onEditMarketingContent(selectedEvent.id.slice('marketing:'.length));
                    setSelectedEvent(null);
                  }} variant="secondary">Edit marketing item</Button> : null
                ) : <Button onClick={() => openEditEvent(selectedEvent)} variant="secondary">Edit event</Button>}
                <Button onClick={() => setSelectedEvent(null)}>Done</Button>
                </>
              ) : <Button onClick={() => setSelectedEvent(null)}>Done</Button>}
            </footer>
          </div>
        ) : null}
      </Modal>
      <ScriptReader
        data={scriptReaderData}
        onClose={() => setScriptReaderOpen(false)}
        open={scriptReaderOpen}
      />

      <Modal
        onClose={() => {
          if (!saving) {
            setEditEvent(null);
            setEditEventForm(null);
          }
        }}
        open={Boolean(editEvent && editEventForm)}
        title={`Edit ${editEvent?.title ?? 'event'}`}
      >
        {editEventForm ? (
          <form className="rm-action-form" onSubmit={submitEventUpdate}>
            {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
            <label className="rm-field">
              <span>Event title</span>
              <input
                onChange={(event) => setEditEventForm((current) => current ? ({ ...current, title: event.target.value }) : current)}
                required
                value={editEventForm.title}
              />
            </label>
            <CalendarColorPicker value={editEventForm.color} type={editEventForm.type} disabled={saving} onChange={(color) => setEditEventForm((current) => current ? { ...current, color } : current)} />
            <div className="rm-form-grid">
              <label className="rm-field">
                <span>Work classification</span>
                <select
                  onChange={(event) => setEditEventForm((current) => current ? ({ ...current, workScope: event.target.value as UpdateCalendarEventInput['workScope'] }) : current)}
                  value={editEventForm.workScope}
                >
                  <option value="client">Client work</option>
                  <option value="internal">Internal work</option>
                  <option value="other">Other / unavailable</option>
                </select>
              </label>
              <label className="rm-field">
                <span>Visibility</span>
                <select
                  onChange={(event) => setEditEventForm((current) => current ? ({ ...current, visibility: event.target.value as UpdateCalendarEventInput['visibility'] }) : current)}
                  value={editEventForm.visibility}
                >
                  <option value="admin_only">Founders</option>
                  <option value="team">Team & founders</option>
                  <option value="client">Client</option>
                </select>
              </label>
            </div>
            <label className="rm-checkbox rm-calendar-all-day-toggle">
              <input
                checked={Boolean(editEventForm.allDay)}
                onChange={(event) => setEditEventAllDay(event.target.checked)}
                type="checkbox"
              />
              <span>All day</span>
            </label>
            <label className="rm-field">
              <span>Property</span>
              <select
                onChange={(event) => {
                  const property = properties.find((item) => item.id === event.target.value);
                  setEditEventForm((current) => current ? ({
                    ...current,
                    clientId: property?.clientId,
                    propertyId: property?.id,
                  }) : current);
                }}
                value={editEventForm.propertyId ?? ''}
              >
                <option value="">Agency / no property</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.name} · {property.clientName}</option>)}
              </select>
            </label>
            {eventAssigneePicker(editEventForm.assigneeUserIds, (assigneeUserIds) => setEditEventForm((current) => current ? ({ ...current, assigneeUserIds }) : current))}
            <div className="rm-form-grid rm-form-grid--two">
              <label className="rm-field">
                <span>Start date</span>
                <input onChange={(event) => setEditEventForm((current) => current ? ({ ...current, date: event.target.value }) : current)} required type="date" value={editEventForm.date} />
              </label>
              <label className="rm-field">
                <span>End date</span>
                <input min={editEventForm.date} onChange={(event) => setEditEventForm((current) => current ? ({ ...current, endDate: event.target.value }) : current)} required type="date" value={editEventForm.endDate || editEventForm.date} />
              </label>
            </div>
            {!editEventForm.allDay ? <div className="rm-form-grid rm-form-grid--two">
              <label className="rm-field">
                <span>Starts</span>
                <input onChange={(event) => setEditEventForm((current) => current ? ({ ...current, start: event.target.value }) : current)} required type="time" value={editEventForm.start} />
              </label>
              <label className="rm-field">
                <span>Ends</span>
                <input onChange={(event) => setEditEventForm((current) => current ? ({ ...current, end: event.target.value }) : current)} type="time" value={editEventForm.end} />
              </label>
            </div> : null}
            <label className="rm-field">
              <span>Location</span>
              <input onChange={(event) => setEditEventForm((current) => current ? ({ ...current, location: event.target.value }) : current)} value={editEventForm.location} />
            </label>
            <label className="rm-field">
              <span>Notes</span>
              <textarea onChange={(event) => setEditEventForm((current) => current ? ({ ...current, description: event.target.value }) : current)} rows={4} value={editEventForm.description} />
            </label>
            <footer className="rm-dialog-actions rm-dialog-actions--split">
              <Button
                disabled={saving}
                onClick={() => {
                  setEditEvent(null);
                  setEditEventForm(null);
                  setArchiveTarget(editEvent);
                }}
                variant="danger"
              >
                Delete event
              </Button>
              <div>
                <Button disabled={saving} onClick={() => { setEditEvent(null); setEditEventForm(null); }} variant="secondary">Cancel</Button>
                <Button disabled={saving || !editEventForm.title.trim()} type="submit">{saving ? 'Saving…' : 'Save changes'}</Button>
              </div>
            </footer>
          </form>
        ) : null}
      </Modal>

      <ArchiveConfirmModal
        busy={saving}
        label="event"
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => void archiveEvent()}
        open={Boolean(archiveTarget)}
      />
    </div>
  );
}
