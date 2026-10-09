import type { CalendarEvent } from '@/screens/web/types';

/** Index the visible period once; long-running events are clipped to that period. */
export function indexCalendarEvents(days: readonly { date: string }[], events: readonly CalendarEvent[]) {
  const grouped = new Map(days.map(day => [day.date, [] as CalendarEvent[]]));
  if (!days.length) return grouped;
  const firstDay = days[0].date;
  const lastDay = days[days.length - 1].date;
  const sorted = [...events].sort((left, right) =>
    Number(Boolean(right.allDay)) - Number(Boolean(left.allDay))
    || left.start.localeCompare(right.start)
    || left.title.localeCompare(right.title),
  );
  for (const event of sorted) {
    const first = event.date > firstDay ? event.date : firstDay;
    const end = event.endDate || event.date;
    const last = end < lastDay ? end : lastDay;
    for (let date = first; date <= last;) {
      grouped.get(date)?.push(event);
      const next = new Date(`${date}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      date = next.toISOString().slice(0, 10);
    }
  }
  return grouped;
}
