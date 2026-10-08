import type { CalendarEvent } from '@/screens/web/types';

export function upcomingEvents(events: CalendarEvent[], now = new Date()) {
  return events.filter(event => {
    const endDate = event.endDate || event.date;
    // Date/time fields are local calendar values, not UTC timestamps.
    const end = new Date(`${endDate}T${event.allDay ? '23:59:59.999' : event.end || event.start || '23:59:59.999'}`);
    return Number.isFinite(end.getTime()) && end.getTime() > now.getTime();
  }).sort((left, right) =>
    left.date.localeCompare(right.date) || left.start.localeCompare(right.start) || left.id.localeCompare(right.id));
}
