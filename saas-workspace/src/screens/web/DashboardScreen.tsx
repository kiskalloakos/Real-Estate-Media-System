import { upcomingEvents as futureEvents } from '@/lib/upcoming-events';
import { useEffect, useState } from 'react';

import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Icon,
  KpiCard,
  MiniSparkline,
  PageHeader,
  ProgressBar,
  SectionHeader,
  StatusPill,
  type PortalRole,
  type PortalScreenKey,
} from '@/components/web';

import {
  demoClients,
  demoEvents,
  demoPayments,
  demoProperties,
  demoReviews,
  demoTasks,
  revenueByMonth,
} from './demoData';
import {
  formatRon,
  PropertyCard,
  WorkStatusPill,
} from './shared';
import { agreementScopeForMonth } from './agreementSchedule';
import type {
  CalendarEvent,
  ClientSummary,
  PaymentRecord,
  PortalData,
  PropertySummary,
  ReviewItem,
} from './types';

export interface DashboardScreenProps {
  currentUserId?: string;
  data?: PortalData;
  onOpenCalendarEvent?: (eventId: string) => void;
  onOpenReview?: (reviewId: string) => void;
  onNavigate?: (screen: PortalScreenKey) => void;
  role: PortalRole;
  userName?: string;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day, 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(
  value: string,
  options: Intl.DateTimeFormatOptions,
  fallback = value,
) {
  const date = parseDate(value);
  return date
    ? new Intl.DateTimeFormat('en-GB', options).format(date)
    : fallback;
}

const taskDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function taskDueLabel(value?: string) {
  if (!value) return 'No deadline';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Deadline TBC';
  return `Due ${taskDateFormatter.format(date)}`;
}

const taskStatusLabels = {
  blocked: 'Blocked',
  cancelled: 'Cancelled',
  done: 'Completed',
  in_progress: 'In progress',
  todo: 'To do',
} as const;

function eventSortValue(event: CalendarEvent) {
  return `${event.date}T${event.start || '00:00'}`;
}

function sortedEvents(events: CalendarEvent[]) {
  return [...events].sort((left, right) =>
    eventSortValue(left).localeCompare(eventSortValue(right)),
  );
}

function currentDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(date);
}

function greetingForHour(hour: number) {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function useLocalDashboardClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return {
    dateLabel: currentDateLabel(now),
    greeting: greetingForHour(now.getHours()),
  };
}

function compactMetric(value: string) {
  const match = value
    .trim()
    .toLowerCase()
    .replaceAll(',', '')
    .match(/^([+-]?\d+(?:\.\d+)?)\s*([kmb])?$/);
  if (!match) return null;
  const magnitude = match[2] === 'k'
    ? 1_000
    : match[2] === 'm'
      ? 1_000_000
      : match[2] === 'b'
        ? 1_000_000_000
        : 1;
  return Number(match[1]) * magnitude;
}

function totalPropertyViews(properties: PropertySummary[]) {
  if (properties.length === 0) return 0;
  const values = properties.map((property) =>
    compactMetric(property.analytics.views),
  );
  if (values.some((value) => value === null)) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

interface PaymentMonth {
  label: string;
  value: number;
}

function paidPaymentSeries(payments: PaymentRecord[]): PaymentMonth[] {
  const totals = new Map<string, number>();
  for (const payment of payments) {
    if (payment.status !== 'paid') continue;
    const date = payment.paidDate ?? payment.dueDate;
    const monthKey = date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(monthKey)) continue;
    totals.set(monthKey, (totals.get(monthKey) ?? 0) + payment.amount);
  }

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-12)
    .map(([monthKey, value]) => ({
      label: formatDate(`${monthKey}-01`, { month: 'short' }, monthKey),
      value,
    }));
}

function reviewIcon(review: ReviewItem) {
  if (review.status === 'approved') return 'check' as const;
  if (review.status === 'in_review') return 'play' as const;
  if (review.status === 'needs_changes') return 'message' as const;
  return 'clock' as const;
}

function AdminDashboard({
  data,
  onNavigate,
  userName = 'Akos Kis',
}: Omit<DashboardScreenProps, 'role'>) {
  const localClock = useLocalDashboardClock();
  const isPreview = data === undefined;
  const clients = isPreview ? demoClients : (data.clients ?? []);
  const events = (isPreview ? demoEvents : (data.calendarEvents ?? []))
    .filter((event) => !event.allDay);
  const payments = isPreview ? demoPayments : (data.payments ?? []);
  const properties = isPreview ? demoProperties : (data.properties ?? []);
  const reviews = isPreview ? demoReviews : (data.reviews ?? []);
  const contractedMonthlyRevenue = clients.reduce(
    (sum, client) => sum + client.monthlyPrice,
    0,
  );
  const openReviews = reviews.filter((review) => review.status !== 'approved');
  const awaitingReview = reviews.filter(
    (review) => review.status === 'in_review',
  );
  const needsChanges = reviews.filter(
    (review) => review.status === 'needs_changes',
  );
  const upcomingEvents = sortedEvents(futureEvents(events));
  const shoots = events.filter((event) => event.type === 'shoot');
  const paidPayments = payments.filter((payment) => payment.status === 'paid');
  const paidTotal = paidPayments.reduce(
    (sum, payment) => sum + payment.amount,
    0,
  );
  const outstandingTotal = payments
    .filter((payment) => !['paid', 'waived', 'cancelled'].includes(payment.status))
    .reduce((sum, payment) => sum + payment.amount, 0);
  const paymentSeries = paidPaymentSeries(payments);

  return (
    <div className="rm-page rm-dashboard">
      <PageHeader
        actions={
          <>
            <Button icon="calendar" onClick={() => onNavigate?.('calendar')} variant="secondary">
              View calendar
            </Button>
            <Button icon="plus" onClick={() => onNavigate?.('clients')}>
              Add client
            </Button>
          </>
        }
        description="Production, clients and cashflow — one clear view of the week ahead."
        eyebrow={isPreview ? 'Sunday · 26 July' : localClock.dateLabel}
        title={`${localClock.greeting}, ${firstName(userName)}.`}
      />

      <section aria-label="Business overview" className="rm-kpi-grid">
        {isPreview ? (
          <>
            <KpiCard
              detail="Across 7 client accounts"
              icon="wallet"
              label="Monthly revenue"
              tone="dark"
              trend="12.4%"
              value={formatRon(41_900)}
            />
            <KpiCard
              detail="12 deliverables moving this week"
              icon="building"
              label="Properties"
              trend="3 new"
              value="7"
            />
            <KpiCard
              detail="2 need owner attention today"
              icon="play"
              label="Awaiting review"
              value="4"
            />
            <KpiCard
              detail="92% delivered by target date"
              icon="list-check"
              label="On-time delivery"
              trend="4.8%"
              value="92%"
            />
          </>
        ) : (
          <>
            <KpiCard
              detail={`Across ${clients.length} ${pluralize(clients.length, 'client account')}`}
              icon="wallet"
              label="Contracted monthly"
              tone="dark"
              value={formatRon(contractedMonthlyRevenue)}
            />
            <KpiCard
              detail={`${properties.length} tracked ${pluralize(properties.length, 'property', 'properties')}`}
              icon="building"
              label="Properties"
              value={String(properties.length)}
            />
            <KpiCard
              detail={`${awaitingReview.length} awaiting review · ${needsChanges.length} need changes`}
              icon="play"
              label="Open reviews"
              value={String(openReviews.length)}
            />
            <KpiCard
              detail={`${shoots.length} ${pluralize(shoots.length, 'shoot')} on the calendar`}
              icon="calendar"
              label="Upcoming events"
              value={String(events.length)}
            />
          </>
        )}
      </section>

      <section className="rm-dashboard-grid rm-dashboard-grid--hero">
        <Card className="rm-revenue-card" tone="dark">
          {isPreview ? (
            <>
              <div className="rm-card-topline">
                <div>
                  <p className="rm-section-kicker">Business pulse</p>
                  <h2>Revenue is finding a steadier rhythm.</h2>
                </div>
                <StatusPill tone="success">2026</StatusPill>
              </div>
              <div className="rm-revenue-card__number">
                <strong>{formatRon(346_800)}</strong>
                <span>
                  <Icon name="trend-up" size={15} />
                  18.2% vs. last year
                </span>
              </div>
              <MiniSparkline label="Revenue trend over twelve months" points={revenueByMonth} tone="dark" />
              <div className="rm-chart-months" aria-hidden="true">
                <span>Jan</span>
                <span>Mar</span>
                <span>May</span>
                <span>Jul</span>
                <span>Sep</span>
                <span>Dec</span>
              </div>
            </>
          ) : (
            <>
              <div className="rm-card-topline">
                <div>
                  <p className="rm-section-kicker">Manual payment ledger</p>
                  <h2>Recorded payments, without the guesswork.</h2>
                </div>
                <StatusPill tone={outstandingTotal > 0 ? 'warning' : 'success'}>
                  {payments.length} {pluralize(payments.length, 'record')}
                </StatusPill>
              </div>
              {payments.length > 0 ? (
                <>
                  <div className="rm-revenue-card__number">
                    <strong>{formatRon(paidTotal)}</strong>
                    <span>
                      <Icon name="receipt" size={15} />
                      {paidPayments.length} {pluralize(paidPayments.length, 'payment')} paid
                    </span>
                  </div>
                  {paymentSeries.length > 0 ? (
                    <>
                      <MiniSparkline
                        label="Recorded paid payments by month"
                        points={paymentSeries.map((month) => month.value)}
                        tone="dark"
                      />
                      <div className="rm-chart-months" aria-hidden="true">
                        {paymentSeries.map((month) => (
                          <span key={month.label}>{month.label}</span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="rm-dashboard-empty-slot">
                      <Icon name="receipt" size={20} />
                      <span>No paid entries have been recorded yet.</span>
                    </div>
                  )}
                  <p className="rm-revenue-card__ledger-note">
                    {outstandingTotal > 0
                      ? `${formatRon(outstandingTotal)} remains due or overdue.`
                      : 'No outstanding scheduled payments.'}
                  </p>
                </>
              ) : (
                <EmptyState
                  description="Add payment schedule items to see paid totals and monthly history here."
                  icon="receipt"
                  title="No payment records yet"
                />
              )}
            </>
          )}
          <Button iconAfter="arrow-right" onClick={() => onNavigate?.('finances')} variant="paper">
            Open finances
          </Button>
        </Card>

        <Card className="rm-today-card" tone="bright">
          <SectionHeader
            action={
              <Button onClick={() => onNavigate?.('calendar')} variant="ghost">
                Full calendar
              </Button>
            }
            kicker="Next up"
            title={isPreview ? 'This week' : 'Upcoming schedule'}
          />
          {upcomingEvents.length > 0 ? (
            <div className="rm-timeline-list">
              {upcomingEvents.slice(0, 4).map((event) => (
                <article className="rm-timeline-item" key={event.id}>
                  <div className="rm-timeline-item__time">
                    <strong>{event.start || 'TBC'}</strong>
                    <span>
                      {isPreview
                        ? formatDate(event.date, { day: 'numeric', weekday: 'short' })
                        : formatDate(event.date, { day: 'numeric', weekday: 'short' })}
                    </span>
                  </div>
                  <span className={`rm-timeline-item__marker rm-event--${event.type}`} />
                  <div className="rm-timeline-item__copy">
                    <strong>{event.title}</strong>
                    <span>
                      {[event.propertyName, event.location].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <Icon name="chevron-right" size={16} />
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              action={
                <Button onClick={() => onNavigate?.('calendar')} variant="secondary">
                  Open calendar
                </Button>
              }
              description="Shoots, reviews and internal events will collect here once they are scheduled."
              icon="calendar"
              title="The schedule is clear"
            />
          )}
        </Card>
      </section>

      <section>
        <SectionHeader
          action={
            <Button iconAfter="arrow-right" onClick={() => onNavigate?.('properties')} variant="ghost">
              All properties
            </Button>
          }
          description="Work that needs attention before the next client touchpoint."
          kicker="Production"
          title="Campaigns in motion"
        />
        <div className="rm-property-grid rm-property-grid--compact">
          {properties.length > 0 ? (
            properties.slice(0, 3).map((property) => (
              <PropertyCard
                key={property.id}
                onOpen={() => onNavigate?.('properties')}
                property={property}
              />
            ))
          ) : (
            <Card className="rm-dashboard-empty-card">
              <EmptyState
                action={
                  <Button onClick={() => onNavigate?.('clients')} variant="secondary">
                    Add a client
                  </Button>
                }
                description="Create a client and their first property to begin tracking production here."
                icon="building"
                title="No properties yet"
              />
            </Card>
          )}
        </div>
      </section>

      <section className="rm-dashboard-grid rm-dashboard-grid--lower">
        <Card className="rm-review-queue">
          <SectionHeader
            action={
              <Button onClick={() => onNavigate?.('reviews')} variant="ghost">
                Review room
              </Button>
            }
            kicker="Approvals"
            title="Review queue"
          />
          {reviews.length > 0 ? (
            <div className="rm-compact-list">
              {reviews.slice(0, 3).map((review) => (
                <button
                  className="rm-compact-list__row"
                  key={review.id}
                  onClick={() => onNavigate?.('reviews')}
                  type="button"
                >
                  <span className="rm-compact-thumb">
                    {review.thumbnailUrl ? <img alt="" src={review.thumbnailUrl} /> : null}
                    <Icon name="play" size={14} />
                  </span>
                  <span className="rm-compact-list__copy">
                    <strong>{review.title}</strong>
                    <span>{review.propertyName} · {review.version}</span>
                  </span>
                  <WorkStatusPill status={review.status} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Uploaded cuts and client feedback will appear here when a review starts."
              icon="play"
              title="No reviews in the queue"
            />
          )}
        </Card>

        <Card className="rm-team-pulse" tone="bright">
          <SectionHeader kicker="Capacity" title="Team pulse" />
          {isPreview ? (
            <>
              <div className="rm-team-pulse__people">
                <div>
                  <Avatar name="Soma Irsai" size="md" src="https://images.unsplash.com/photo-1507591064344-4c6ce005b128?auto=format&fit=crop&w=120&q=80" />
                  <span>
                    <strong>Soma</strong>
                    <small>3 assignments</small>
                  </span>
                  <StatusPill tone="success">On shoot</StatusPill>
                </div>
                <div>
                  <Avatar name="Nessa Kis" size="md" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80" />
                  <span>
                    <strong>Nessa</strong>
                    <small>4 edits</small>
                  </span>
                  <StatusPill tone="accent">Editing</StatusPill>
                </div>
                <div>
                  <Avatar name="Akos Kis" size="md" />
                  <span>
                    <strong>Akos</strong>
                    <small>2 approvals</small>
                  </span>
                  <StatusPill tone="neutral">Studio</StatusPill>
                </div>
              </div>
              <div className="rm-capacity">
                <div>
                  <span>Weekly capacity</span>
                  <strong>68%</strong>
                </div>
                <ProgressBar label="Team weekly capacity" tone="success" value={68} />
              </div>
            </>
          ) : (
            <EmptyState
              description="Team workload will appear once member assignments and capacity are connected."
              icon="users"
              title="Capacity is not connected yet"
            />
          )}
        </Card>
      </section>
    </div>
  );
}

function TeamDashboard({
  currentUserId,
  data,
  onNavigate,
  userName = 'Soma Irsai',
}: Omit<DashboardScreenProps, 'role'>) {
  const isPreview = data === undefined;
  const events = (isPreview ? demoEvents : (data.calendarEvents ?? []))
    .filter((event) => !event.allDay);
  const assignedTasks = (isPreview
    ? demoTasks.filter((task) => task.assigneeUserId === 'demo-soma')
    : (data.tasks ?? []).filter((task) => task.assigneeUserId === currentUserId));
  const openAssignedTasks = assignedTasks.filter(
    (task) => task.status !== 'done' && task.status !== 'cancelled',
  );
  const today = localDateKey();
  const shoots = sortedEvents(events.filter(
    (event) => event.type === 'shoot' && (isPreview || event.date >= today),
  ));
  const nextShoot = shoots[0];
  const nextShootProperty = (isPreview ? demoProperties : (data.properties ?? []))
    .find((property) => property.id === nextShoot?.propertyId);
  const nextShootCoverUrl = nextShoot?.propertyCoverUrl ?? nextShootProperty?.coverUrl;

  return (
    <div className="rm-page rm-dashboard">
      <PageHeader
        description="Your next production dates and directly assigned work."
        eyebrow="Production workspace"
        title={`Ready for the week, ${firstName(userName)}?`}
      />
      <section className="rm-dashboard-grid rm-dashboard-grid--team">
        <Card className="rm-today-card" tone="bright">
          <SectionHeader
            kicker={
              isPreview
                ? 'Monday · 27 July'
                : nextShoot
                  ? formatDate(nextShoot.date, {
                    day: 'numeric',
                    month: 'long',
                    weekday: 'long',
                  })
                  : 'Schedule'
            }
            title="Your next shoot"
          />
          {(isPreview || nextShoot) ? (
            <div className={`rm-next-shoot-event${nextShootCoverUrl ? ' rm-next-shoot-event--with-image' : ''}`}>
              <div className="rm-next-shoot-event__copy">
                <span className="rm-next-shoot-event__time">
                  {isPreview
                    ? '09:00 — 12:30'
                    : [nextShoot?.start, nextShoot?.end].filter(Boolean).join(' — ') || 'Time TBC'}
                </span>
                <h3>{isPreview ? 'Summer campaign shoot' : nextShoot?.title}</h3>
                <p>
                  {isPreview
                    ? `${demoProperties[0].name} · ${demoProperties[0].location}`
                    : [nextShoot?.propertyName, nextShoot?.location].filter(Boolean).join(' · ')}
                </p>
              </div>
              {nextShootCoverUrl ? (
                <img
                  alt={nextShoot?.propertyName ?? 'Property'}
                  className="rm-next-shoot-event__property"
                  src={nextShootCoverUrl}
                />
              ) : null}
            </div>
          ) : (
            <div className="rm-next-shoot-event rm-next-shoot-event--empty">
              <div className="rm-next-shoot-event__copy">
                <h3>No shoot assigned</h3>
                <p>Your next assigned production shoot will appear here once it is scheduled.</p>
              </div>
            </div>
          )}
        </Card>

        <Card className="rm-task-card">
          <SectionHeader
            action={openAssignedTasks.length ? <StatusPill tone="accent">{openAssignedTasks.length} open</StatusPill> : undefined}
            kicker="Assigned work"
            title="Tasks"
          />
          {openAssignedTasks.length ? (
            <div className="rm-compact-list">
              {openAssignedTasks.slice(0, 5).map((task) => (
                <button
                  className="rm-compact-list__row"
                  key={task.id}
                  onClick={() => onNavigate?.('tasks')}
                  type="button"
                >
                  <span className="rm-compact-thumb rm-compact-thumb--paper">
                    <Icon name="list-check" size={18} />
                  </span>
                  <span className="rm-compact-list__copy">
                    <strong>{task.title}</strong>
                    <span>{task.propertyName || 'Team task'} · {taskDueLabel(task.dueAt)}</span>
                  </span>
                  <StatusPill tone="neutral">{taskStatusLabels[task.status]}</StatusPill>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Tasks assigned directly to you will appear here."
              icon="list-check"
              title="No open tasks"
            />
          )}
        </Card>
      </section>
    </div>
  );
}

function ClientDashboard({
  data,
  onNavigate,
  onOpenCalendarEvent,
  onOpenReview,
  userName = 'Andrei Pop',
}: Omit<DashboardScreenProps, 'role'>) {
  const isPreview = data === undefined;
  const clientProperties = isPreview
    ? demoProperties.filter((property) => property.clientId === 'client-cabana')
    : (data.properties ?? []);
  const clients = isPreview ? demoClients : (data.clients ?? []);
  const events = (isPreview ? demoEvents : (data.calendarEvents ?? []))
    .filter((event) => !event.allDay);
  const payments = isPreview ? demoPayments : (data.payments ?? []);
  const agreements = data?.agreements ?? [];
  const reviews = isPreview ? demoReviews : (data.reviews ?? []);
  const tasks = (isPreview
    ? demoTasks.filter((task) => task.clientId === 'client-cabana')
    : (data.tasks ?? []))
    .filter((task) => task.status !== 'cancelled')
    .sort((left, right) => {
      const leftComplete = left.status === 'done' ? 1 : 0;
      const rightComplete = right.status === 'done' ? 1 : 0;
      if (leftComplete !== rightComplete) return leftComplete - rightComplete;
      return (left.dueAt ?? '9999').localeCompare(right.dueAt ?? '9999');
    });
  const featuredProperty = clientProperties[0];
  const clientRecord = clients.find(
    (client) => client.id === featuredProperty?.clientId,
  ) ?? clients[0];
  const currentAgreement = agreements.find(
    (agreement) => agreement.clientId === clientRecord?.id && agreement.status === 'active',
  ) ?? agreements.find((agreement) => agreement.clientId === clientRecord?.id);
  const currentMonthlyScope = agreementScopeForMonth(currentAgreement);
  const approvals = reviews.filter((review) =>
    review.status === 'in_review' || review.status === 'needs_changes',
  );
  const deliveredAssets = reviews.filter((review) => review.status === 'approved');
  const upcomingShoots = sortedEvents(futureEvents(events))
    .filter((event) => event.type === 'shoot')
    .slice(0, 3);
  const nextEvent = sortedEvents(futureEvents(events))[0];
  const nextPayment = [...payments]
    .filter((payment) => !['paid', 'waived', 'cancelled'].includes(payment.status))
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))[0];
  return (
    <div className="rm-page rm-dashboard">
      <PageHeader
        description="Your property, deliverables, schedule and results — all in one place."
        eyebrow={
          isPreview
            ? 'Cabana The One'
            : clientRecord?.name ?? featuredProperty?.name ?? 'Client workspace'
        }
        title={`Welcome back, ${firstName(userName)}.`}
      />

      <section className="rm-client-action-grid" aria-label="Client actions">
        <Card className="rm-client-action-card rm-client-action-card--approval" tone="bright">
          <SectionHeader
            action={approvals.length ? <StatusPill tone="accent">{approvals.length}</StatusPill> : undefined}
            kicker="Your action"
            title="Needs your approval"
          />
          {approvals.length ? (
            <div className="rm-client-action-card__list">
              {approvals.slice(0, 3).map((review) => (
                <button key={review.id} onClick={() => onOpenReview?.(review.id)} type="button">
                  <span><strong>{review.title}</strong><small>{review.propertyName} · {review.version}</small></span>
                  <span className="rm-client-action-card__cta">Review <Icon name="arrow-right" size={15} /></span>
                </button>
              ))}
            </div>
          ) : <EmptyState description="New versions will appear here with the exact version ready for your decision." icon="check" title="Nothing waiting for you" />}
        </Card>

        <Card className="rm-client-action-card" tone="bright">
          <SectionHeader kicker="Production" title="Upcoming shoots" />
          {upcomingShoots.length ? (
            <div className="rm-client-action-card__list">
              {upcomingShoots.map((event) => (
                <button key={event.id} onClick={() => onOpenCalendarEvent?.(event.id)} type="button">
                  <span><strong>{event.title}</strong><small>{formatDate(event.date, { day: 'numeric', month: 'short', weekday: 'short' })} · {[event.start, event.location].filter(Boolean).join(' · ') || 'Details to follow'}</small></span>
                  <Icon name="arrow-right" size={15} />
                </button>
              ))}
            </div>
          ) : <EmptyState description="Your next production day will appear here as soon as it is scheduled." icon="calendar" title="No shoot scheduled" />}
        </Card>

        <Card className="rm-client-action-card" tone="bright">
          <SectionHeader action={deliveredAssets.length ? <StatusPill tone="success">{deliveredAssets.length}</StatusPill> : undefined} kicker="Your library" title="Delivered assets" />
          {deliveredAssets.length ? (
            <div className="rm-client-action-card__list">
              {deliveredAssets.slice(0, 3).map((review) => (
                <button key={review.id} onClick={() => onOpenReview?.(review.id)} type="button">
                  <span><strong>{review.title}</strong><small>{review.propertyName} · {review.version}</small></span>
                  <span className="rm-client-action-card__cta">Open file <Icon name="download" size={15} /></span>
                </button>
              ))}
            </div>
          ) : <EmptyState description="Approved files will be available here for straightforward access." icon="download" title="No delivered assets yet" />}
        </Card>
      </section>

      <section className="rm-client-hero">
        {clientProperties.length > 0 ? (
          <div
            aria-label="Client properties"
            className={`rm-client-hero__properties${clientProperties.length > 1 ? ' is-multiple' : ''}`}
            style={{ gridTemplateColumns: `repeat(${clientProperties.length}, minmax(0, 1fr))` }}
          >
            {clientProperties.map((property, index) => (
              <article className="rm-client-hero__image" key={property.id}>
                <img
                  alt={`${property.name} property`}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  src={property.coverUrl}
                />
                <div className="rm-client-hero__shade" />
                <div className="rm-client-hero__copy">
                  <h2>{property.name}</h2>
                  {property.location ? <p>{property.location}</p> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Card className="rm-client-hero__image rm-client-hero__empty">
            <EmptyState
              description="Your Realty Media team will add your first property workspace here."
              icon="building"
              title="No property connected yet"
            />
          </Card>
        )}

        <Card className="rm-client-hero__summary" tone="bright">
          {isPreview ? (
            <>
              <p className="rm-section-kicker">Next milestone</p>
              <span className="rm-date-block">
                <strong>28</strong>
                <span>JUL<br />MONDAY</span>
              </span>
              <h3>Campaign production shoot</h3>
              <p className="rm-meta-line">
                <Icon name="clock" size={16} />
                09:00 — 12:30
              </p>
              <p className="rm-meta-line">
                <Icon name="map-pin" size={16} />
                Cabana The One, Mărișel
              </p>
            </>
          ) : nextEvent ? (
            <>
              <p className="rm-section-kicker">Next milestone</p>
              <span className="rm-date-block">
                <strong>{formatDate(nextEvent.date, { day: '2-digit' })}</strong>
                <span>
                  {formatDate(nextEvent.date, { month: 'short' }).toUpperCase()}
                  <br />
                  {formatDate(nextEvent.date, { weekday: 'long' }).toUpperCase()}
                </span>
              </span>
              <h3>{nextEvent.title}</h3>
              <p className="rm-meta-line">
                <Icon name="clock" size={16} />
                {[nextEvent.start, nextEvent.end].filter(Boolean).join(' — ') || 'Time TBC'}
              </p>
              {nextEvent.location ? (
                <p className="rm-meta-line">
                  <Icon name="map-pin" size={16} />
                  {nextEvent.location}
                </p>
              ) : null}
            </>
          ) : (
            <EmptyState
              description="Your next shoot, review or delivery date will appear here once scheduled."
              icon="calendar"
              title="No upcoming milestone"
            />
          )}
        </Card>
      </section>

      <section className="rm-dashboard-grid rm-dashboard-grid--client">
        <Card className="rm-deliverables-card rm-client-tasks-card">
          <SectionHeader
            action={
              tasks.length > 0 ? (
                <StatusPill tone="accent">
                  {tasks.length} {pluralize(tasks.length, 'task')}
                </StatusPill>
              ) : undefined
            }
            kicker="Assigned work"
            title="Tasks"
          />
          {tasks.length > 0 ? (
            <ul aria-label="Tasks assigned to this client" className="rm-client-task-list">
              {tasks.slice(0, 6).map((task) => (
                <li className={`is-${task.status}`} key={task.id}>
                  <span className="rm-client-task-list__icon">
                    <Icon name={task.status === 'done' ? 'check' : 'list-check'} size={15} />
                  </span>
                  <span className="rm-client-task-list__copy">
                    <strong>{task.title}</strong>
                    <small>
                      {[task.propertyName, task.assigneeName, taskDueLabel(task.dueAt)]
                        .filter(Boolean)
                        .join(' · ')}
                    </small>
                  </span>
                  <span className="rm-client-task-list__status">
                    {taskStatusLabels[task.status]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              description="Tasks assigned to this client will appear here."
              icon="list-check"
              title="No assigned tasks"
            />
          )}
        </Card>

        <Card className="rm-deal-card" tone="dark">
          {isPreview ? (
            <>
              <div className="rm-card-topline">
                <div>
                  <p className="rm-section-kicker">Current agreement</p>
                  <h2>Full-service content partnership</h2>
                </div>
              </div>
              <div className="rm-deal-card__price">
                <strong>{formatRon(7200)}</strong>
                <span>per month</span>
              </div>
              <dl className="rm-deal-list">
                <div><dt>Contract term</dt><dd>12 months</dd></div>
                <div><dt>Monthly scope</dt><dd>12 deliverables</dd></div>
                <div><dt>Next payment</dt><dd>1 August 2026</dd></div>
                <div><dt>Payment tracking</dt><dd>Manual ledger</dd></div>
              </dl>
            </>
          ) : clientRecord ? (
            <>
              <div className="rm-card-topline">
                <div>
                  <p className="rm-section-kicker">Current agreement</p>
                  <h2>{clientRecord.name}</h2>
                </div>
              </div>
              <div className="rm-deal-card__price">
                <strong>{formatRon(clientRecord.monthlyPrice)}</strong>
                <span>per month</span>
              </div>
              <dl className="rm-deal-list">
                <div>
                  <dt>Monthly scope</dt>
                  <dd>
                    {currentMonthlyScope
                      ?? (clientRecord.monthlyDeliverables > 0
                      ? `${clientRecord.monthlyDeliverables} deliverables`
                      : 'Not recorded')}
                  </dd>
                </div>
                <div>
                  <dt>Total contract value</dt>
                  <dd>{formatRon(clientRecord.totalContractValue)}</dd>
                </div>
                <div>
                  <dt>Properties</dt>
                  <dd>{clientRecord.propertiesCount}</dd>
                </div>
                <div>
                  <dt>Next payment</dt>
                  <dd>
                    {nextPayment
                      ? formatDate(nextPayment.dueDate, {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                      : 'Not scheduled'}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <EmptyState
              description="Agreement details will appear once Realty Media adds an active service contract."
              icon="file"
              title="No agreement connected"
            />
          )}
          <Button
            className="rm-deal-card__action"
            iconAfter="arrow-right"
            onClick={() => onNavigate?.('billing')}
            variant="paper"
          >
            Agreement & payments
          </Button>
        </Card>
      </section>
    </div>
  );
}

export function DashboardScreen(props: DashboardScreenProps) {
  if (props.role === 'client') return <ClientDashboard {...props} />;
  if (props.role === 'team_member') return <TeamDashboard {...props} />;
  return <AdminDashboard {...props} />;
}
