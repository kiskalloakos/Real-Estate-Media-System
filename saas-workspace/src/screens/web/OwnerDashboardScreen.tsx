import {
  Avatar,
  Card,
  Icon,
} from '@/components/web';
import type { CSSProperties } from 'react';

import { formatRon } from './shared';
import type {
  CalendarEvent,
  PortalActionHandlers,
  PortalData,
  PortalScreenKey,
} from './types';

type DashboardTab = 'overview' | 'tasks' | 'calendar' | 'notes';

export interface OwnerDashboardScreenProps {
  actions?: PortalActionHandlers;
  currentUserId?: string;
  data?: PortalData;
  initialTab?: DashboardTab;
  locale?: 'en' | 'ro';
  onNavigate?: (screen: PortalScreenKey) => void;
  onOpenEvent?: (eventId: string) => void;
  onTabChange?: (tab: DashboardTab) => void;
}

const copy = {
  en: {
    addCosts: 'Add recurring costs to calculate runway',
    availableCash: 'Available cash',
    calendar: 'Calendar',
    cashRunway: 'Cash runway',
    dashboard: 'Dashboard',
    emptyEvents: 'No upcoming events.',
    emptyTasks: 'Everyone is caught up.',
    financeActiveClients: 'active client accounts',
    financeAccountBalances: 'Account balances',
    financeNoAvailableBalance: 'No available balance',
    financeAvailableNow: 'available now',
    financeMonthlyRunRate: 'monthly run rate',
    monthlyCommitments: 'Monthly commitments',
    monthlyRecurringRevenue: 'Monthly recurring revenue',
    monthsCovered: 'months covered',
    monthRevenue: 'Current monthly revenue',
    currentLiquidity: 'Current liquid cash',
    clientWork: 'Client work',
    internalWork: 'Internal work',
    nextEvents: 'Upcoming calendar',
    notes: 'Notes',
    productionDays: 'production days',
    activeAgreements: 'active agreements',
    productionLoad: 'Production load',
    scheduled: 'scheduled',
    upcomingFourWeeks: 'Upcoming 4 weeks',
    tasks: 'Tasks',
    urgent: 'Urgent',
  },
  ro: {
    addCosts: 'Adaugă costuri recurente pentru a calcula autonomia',
    availableCash: 'Lichidități disponibile',
    calendar: 'Calendar',
    cashRunway: 'Autonomie financiară',
    dashboard: 'Panou',
    emptyEvents: 'Nu există evenimente viitoare.',
    emptyTasks: 'Toate sarcinile sunt rezolvate.',
    financeActiveClients: 'conturi de client active',
    financeAccountBalances: 'Solduri conturi',
    financeNoAvailableBalance: 'Nu există lichidități disponibile',
    financeAvailableNow: 'disponibil acum',
    financeMonthlyRunRate: 'ritm lunar curent',
    monthlyCommitments: 'Angajamente lunare',
    monthlyRecurringRevenue: 'Venit recurent lunar',
    monthsCovered: 'luni acoperite',
    monthRevenue: 'Venit lunar curent',
    currentLiquidity: 'Lichidități disponibile',
    clientWork: 'Lucru pentru clienți',
    internalWork: 'Lucru intern',
    nextEvents: 'Calendarul următor',
    notes: 'Note',
    productionDays: 'zile de producție',
    activeAgreements: 'contracte active',
    productionLoad: 'Volum de producție',
    scheduled: 'programate',
    upcomingFourWeeks: 'Următoarele 4 săptămâni',
    tasks: 'Sarcini curente',
    urgent: 'Urgent',
  },
} as const;

function safeAmount(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function monthlyCost(cost: NonNullable<PortalData['costs']>[number]) {
  const amount = safeAmount(cost.amount);
  const frequency = (cost.frequencyKey || cost.frequency).toLowerCase();
  if (frequency === 'weekly') return (amount * 52) / 12;
  if (frequency === 'quarterly') return amount / 3;
  if (frequency === 'yearly') return amount / 12;
  if (frequency === 'every 6 months') return amount / 6;
  const monthInterval = frequency.match(/^every (\d+) months?$/)?.[1];
  if (monthInterval) return amount / Math.max(1, Number(monthInterval));
  return amount;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function dateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function timeInMinutes(value?: string) {
  if (!value) return 0;
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function eventMinutes(event: CalendarEvent) {
  // All-day events mark production days, but they do not represent a
  // measurable scheduled duration.
  if (event.allDay) return 0;
  const start = timeInMinutes(event.start);
  let end = timeInMinutes(event.end);
  if (end <= start) end += 24 * 60;
  return Math.max(60, end - start);
}

function productionWorkScope(event: CalendarEvent): 'client' | 'internal' | 'other' {
  // A client or property association makes this client production even when a
  // legacy event carries an outdated internal scope in its description.
  if (event.clientId || event.propertyId) return 'client';
  return event.workScope;
}

function formatHours(minutes: number) {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function taskDeadline(value: string | undefined, locale: 'en' | 'ro') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return new Intl.DateTimeFormat(locale === 'ro' ? 'ro-RO' : 'en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}

function eventInterval(event: CalendarEvent, locale: 'en' | 'ro') {
  const format = new Intl.DateTimeFormat(locale === 'ro' ? 'ro-RO' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  });
  const start = new Date(`${event.date}T12:00:00`);
  const end = new Date(`${event.endDate || event.date}T12:00:00`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    return event.endDate && event.endDate !== event.date
      ? `${event.date} — ${event.endDate}`
      : event.date;
  }
  return start.toDateString() === end.toDateString()
    ? format.format(start)
    : `${format.format(start)} — ${format.format(end)}`;
}

function OwnerOverview({
  data,
  locale,
  onOpenCalendar,
  onOpenEvent,
  onOpenTasks,
}: {
  data?: PortalData;
  locale: 'en' | 'ro';
  onOpenCalendar: () => void;
  onOpenEvent: (eventId: string) => void;
  onOpenTasks: () => void;
}) {
  const text = copy[locale];
  const liquidity = (data?.financeAccounts ?? []).reduce(
    (sum, account) => sum + safeAmount(account.currentBalance),
    0,
  );
  const monthlyCommitments = (data?.costs ?? []).reduce(
    (sum, cost) => sum + monthlyCost(cost),
    0,
  );
  const runwayMonths = monthlyCommitments > 0 ? liquidity / monthlyCommitments : null;
  const runwaySegments = Array.from({ length: 4 }, (_, index) => (
    runwayMonths === null ? 0 : Math.max(0, Math.min(100, (runwayMonths - index) * 100))
  ));
  const activeAgreements = (data?.agreements ?? []).filter(
    (agreement) => agreement.status === 'active',
  );
  const monthlyRecurringRevenue = activeAgreements.reduce(
    (sum, agreement) => sum + safeAmount(agreement.monthlyAmount),
    0,
  );
  const allTasks = (data?.tasks ?? [])
    .filter((task) => !['done', 'cancelled'].includes(task.status))
    .sort((left, right) => (left.dueAt ?? '9999').localeCompare(right.dueAt ?? '9999'));
  const memberAvatarByUserId = new Map(
    (data?.agencyMembers ?? []).map((member) => [member.userId, member.avatarUrl]),
  );
  // Production load is derived only from classified calendar work. All-day
  // events mark their covered dates without adding scheduled hours. Marketing
  // schedule items and "other / unavailable" entries stay out of this view.
  const productionEvents = (data?.calendarEvents ?? [])
    .filter((event) => productionWorkScope(event) !== 'other');
  const upcomingCalendarEvents = (data?.calendarEvents ?? [])
    .filter((event) => event.workScope === 'client' || event.workScope === 'internal')
    .filter(
      (event) =>
        `${event.endDate || event.date}T${event.end || '23:59'}` >=
        new Date().toISOString().slice(0, 16),
    )
    .sort((left, right) =>
      `${left.date}T${left.start}`.localeCompare(`${right.date}T${right.start}`),
  );
  const today = startOfDay(new Date());
  const workloadDays = Array.from({ length: 28 }, (_, index) => {
    const date = addDays(today, index);
    const key = dateKey(date);
    const dayEvents = productionEvents.filter((event) => (
      event.date <= key
      && (event.endDate || event.date) >= key
    ));
    const minutes = dayEvents.reduce((sum, event) => sum + eventMinutes(event), 0);
    const clientEvents = dayEvents.filter((event) => productionWorkScope(event) === 'client');
    const internalEvents = dayEvents.filter((event) => productionWorkScope(event) === 'internal');
    return { clientEvents, date, events: dayEvents, internalEvents, key, minutes };
  });
  const leadingEmptyDays = (today.getDay() + 6) % 7;
  const trailingEmptyDays = (7 - ((leadingEmptyDays + workloadDays.length) % 7)) % 7;
  const workloadCalendarDays = [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...workloadDays,
    ...Array.from({ length: trailingEmptyDays }, () => null),
  ];
  const scheduledMinutes = workloadDays.reduce((sum, day) => sum + day.minutes, 0);
  const productionDays = workloadDays.filter((day) => day.events.length > 0).length;
  const dateLocale = locale === 'ro' ? 'ro-RO' : 'en-GB';
  const workloadEnd = addDays(today, 27);
  const workloadRange = `${today.toLocaleDateString(dateLocale, {
    day: 'numeric',
    month: 'short',
  })} – ${workloadEnd.toLocaleDateString(dateLocale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
  return (
    <div className="rm-page rm-owner-overview">
      <section aria-label="Finance summary" className="rm-owner-finance-summary">
        <div className="rm-owner-finance-stack">
          <Card className="rm-owner-finance-card rm-owner-runway" tone="bright">
            <div className="rm-owner-finance-card__header">
              <div>
                <p className="rm-section-kicker">{text.cashRunway}</p>
                <span>{text.availableCash}</span>
              </div>
            </div>
            <div className="rm-owner-finance-card__value">
              <strong>{formatRon(liquidity)}</strong>
            </div>
            <div className="rm-owner-runway__metric">
              {runwayMonths === null ? (
                <span>{text.addCosts}</span>
              ) : (
                <>
                  <b>{runwayMonths < 0.1 ? '<0.1' : runwayMonths.toFixed(1)}</b>
                  <span>{text.monthsCovered}</span>
                </>
              )}
            </div>
            <div className="rm-owner-runway__coverage">
              <div>
                <span>{text.monthlyCommitments}</span>
                <b>{formatRon(monthlyCommitments)}</b>
              </div>
              <span
                aria-label={runwayMonths === null ? text.addCosts : `${runwayMonths.toFixed(1)} ${text.monthsCovered}`}
                className="rm-owner-runway__segments"
                role="progressbar"
                aria-valuemax={4}
                aria-valuemin={0}
                aria-valuenow={runwayMonths === null ? 0 : Math.min(4, runwayMonths)}
              >
                {runwaySegments.map((coverage, index) => (
                  <span key={index}><i style={{ width: `${coverage}%` }} /></span>
                ))}
              </span>
            </div>
          </Card>

          <Card className="rm-owner-finance-card rm-owner-mrr" tone="bright">
            <div className="rm-owner-finance-card__header">
              <div>
                <p className="rm-section-kicker">{text.monthlyRecurringRevenue}</p>
              </div>
            </div>
            <div className="rm-owner-finance-card__value">
              <strong>{formatRon(monthlyRecurringRevenue)}</strong>
            </div>
            <p>{activeAgreements.length} {text.activeAgreements}</p>
          </Card>
        </div>

        <Card className="rm-owner-finance-card rm-owner-workload" tone="bright">
          <div className="rm-owner-finance-card__header">
            <div>
              <p className="rm-section-kicker">{text.productionLoad}</p>
              <span>{text.upcomingFourWeeks} · {workloadRange}</span>
            </div>
          </div>
          <div className="rm-owner-workload__summary">
            <div className="rm-owner-finance-card__value">
              <strong>{formatHours(scheduledMinutes)}</strong>
              <span>{text.scheduled}</span>
            </div>
            <p>{productionDays} {text.productionDays}</p>
          </div>
          <div className="rm-owner-workload__weekdays" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => addDays(today, index - leadingEmptyDays)).map((date) => (
              <span key={dateKey(date)}>{date.toLocaleDateString(dateLocale, { weekday: 'narrow' })}</span>
            ))}
          </div>
          <div aria-label={text.productionLoad} className="rm-owner-workload__heatmap">
            {workloadCalendarDays.map((day, index) => {
              if (!day) {
                return <span aria-hidden="true" className="rm-owner-workload__day is-empty" key={`empty-${index}`} />;
              }
              const label = `${day.date.toLocaleDateString(dateLocale, {
                day: 'numeric',
                month: 'long',
                weekday: 'long',
              })}: ${formatHours(day.minutes)}, ${day.clientEvents.length} ${text.clientWork.toLowerCase()}, ${day.internalEvents.length} ${text.internalWork.toLowerCase()}`;
              const workloadClass = day.clientEvents.length && day.internalEvents.length
                ? 'is-mixed-production'
                : day.clientEvents.length
                  ? 'is-client-production'
                  : day.internalEvents.length
                    ? 'is-internal-production'
                    : '';
              const workloadStyle = workloadClass
                ? {
                    '--rm-workload-background': workloadClass === 'is-mixed-production'
                      ? 'linear-gradient(135deg, var(--rm-blue) 0 50%, var(--rm-grey) 50% 100%)'
                      : workloadClass === 'is-client-production'
                        ? 'var(--rm-blue)'
                        : 'var(--rm-grey)',
                    '--rm-workload-border': workloadClass === 'is-internal-production'
                      ? 'var(--rm-grey)'
                      : 'var(--rm-blue)',
                    '--rm-workload-color': workloadClass === 'is-internal-production'
                      ? 'var(--rm-black)'
                      : 'var(--rm-white)',
                  } as CSSProperties
                : undefined;
              return (
                <button
                  aria-label={label}
                  className={`rm-owner-workload__day ${workloadClass}`}
                  key={day.key}
                  onClick={onOpenCalendar}
                  style={workloadStyle}
                  title={label}
                  type="button"
                >
                  <span>{day.date.getDate()}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </section>

      <div className="rm-owner-overview__grid">
        <Card className="rm-owner-focus-card" tone="bright">
          <div className="rm-owner-focus-card__header">
            <div className="rm-owner-task-heading">
              <h2>{text.tasks}</h2>
            </div>
          </div>
          <div className="rm-owner-list rm-owner-task-list">
            {allTasks.slice(0, 8).map((task) => {
              const deadline = taskDeadline(task.dueAt, locale);
              return (
              <button
                className={`rm-owner-list__row ${task.priority === 'urgent' ? 'is-urgent' : ''}`}
                key={task.id}
                onClick={onOpenTasks}
                type="button"
              >
                <Avatar
                  name={task.assigneeName || 'Unassigned'}
                  size="sm"
                  src={task.assigneeUserId ? memberAvatarByUserId.get(task.assigneeUserId) : undefined}
                />
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.assigneeName || 'Unassigned'} · {task.propertyName || task.clientName || 'Realty Media'}</small>
                </span>
                {task.priority === 'urgent' ? <span className="rm-owner-task-urgent">{text.urgent}</span> : null}
              </button>
              );
            })}
            {!allTasks.length ? <p className="rm-owner-list__empty">{text.emptyTasks}</p> : null}
          </div>
        </Card>

        <Card className="rm-owner-focus-card" tone="paper">
          <div className="rm-owner-focus-card__header">
            <div>
              <h2>{text.calendar}</h2>
            </div>
          </div>
          <div className="rm-owner-list">
            {upcomingCalendarEvents.slice(0, 6).map((event) => (
              <button
                className="rm-owner-list__row"
                key={event.id}
                onClick={() => onOpenEvent(event.id)}
                type="button"
              >
                <span className="rm-owner-event-date">
                  <strong>{eventInterval(event, locale)}</strong>
                  <small>{event.allDay ? 'All day' : `${event.start}${event.end ? ` — ${event.end}` : ''}`}</small>
                </span>
                <span>
                  <strong>{event.title}</strong>
                  <small>{event.propertyName || event.location || 'Realty Media'}</small>
                </span>
                <Icon name="arrow-right" size={16} />
              </button>
            ))}
            {!upcomingCalendarEvents.length ? <p className="rm-owner-list__empty">{text.emptyEvents}</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function OwnerDashboardScreen({
  data,
  locale = 'en',
  onNavigate,
  onOpenEvent,
}: OwnerDashboardScreenProps) {
  return (
    <div className="rm-owner-dashboard">
      <OwnerOverview
        data={data}
        locale={locale}
        onOpenCalendar={() => onNavigate?.('calendar')}
        onOpenEvent={(eventId) => onOpenEvent?.(eventId) ?? onNavigate?.('calendar')}
        onOpenTasks={() => onNavigate?.('tasks')}
      />
    </div>
  );
}
