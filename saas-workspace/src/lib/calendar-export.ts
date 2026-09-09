import type { CalendarEvent } from '@/screens/web/types';

const calendarTimeZone = 'Europe/Bucharest';

function compactDate(value: string) {
  return value.replaceAll('-', '');
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function compactDateTime(date: string, time: string) {
  return `${compactDate(date)}T${time.replace(':', '')}00`;
}

function eventDescription(event: CalendarEvent) {
  return [
    event.description,
    event.propertyName ? `Property: ${event.propertyName}` : null,
    event.assignee ? `Coordinator: ${event.assignee}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function eventRange(event: CalendarEvent) {
  const endDate = event.endDate || event.date;

  if (event.allDay) {
    return {
      end: compactDate(addDays(endDate, 1)),
      start: compactDate(event.date),
    };
  }

  return {
    end: compactDateTime(endDate, event.end || event.start || '10:00'),
    start: compactDateTime(event.date, event.start || '09:00'),
  };
}

function escapeIcsText(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;');
}

function safeFileName(value: string) {
  const name = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${name || 'realty-media-event'}.ics`;
}

function utcTimestamp(value: Date) {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function googleCalendarUrl(event: CalendarEvent) {
  const range = eventRange(event);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    dates: `${range.start}/${range.end}`,
    details: eventDescription(event),
    location: event.location,
    text: event.title,
  });

  if (!event.allDay) {
    params.set('ctz', calendarTimeZone);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function calendarIcs(event: CalendarEvent) {
  const range = eventRange(event);
  const dateLines = event.allDay
    ? [
        `DTSTART;VALUE=DATE:${range.start}`,
        `DTEND;VALUE=DATE:${range.end}`,
      ]
    : [
        `DTSTART;TZID=${calendarTimeZone}:${range.start}`,
        `DTEND;TZID=${calendarTimeZone}:${range.end}`,
      ];

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'PRODID:-//Realty Media//Calendar Event//EN',
    `X-WR-TIMEZONE:${calendarTimeZone}`,
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(event.id)}@app.realtymedia.ro`,
    `DTSTAMP:${utcTimestamp(new Date())}`,
    ...dateLines,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(eventDescription(event))}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

export function downloadCalendarIcs(event: CalendarEvent) {
  const blob = new Blob([calendarIcs(event)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.download = safeFileName(event.title);
  anchor.href = url;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
