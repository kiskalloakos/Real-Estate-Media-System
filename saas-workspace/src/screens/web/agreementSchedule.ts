import type { AgreementSummary } from './types';

export interface AgreementScheduleRow {
  label: string;
  value: string;
}

export function agreementSchedule(summary?: string): AgreementScheduleRow[] {
  if (!summary) return [];

  try {
    const parsed = JSON.parse(summary) as { monthlyDeliverables?: unknown };
    if (typeof parsed.monthlyDeliverables !== 'string') return [];

    return parsed.monthlyDeliverables
      .split(/\r?\n/)
      .map((line) => line.match(/^([^:]+):\s*(.+)$/))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => ({
        label: match[1].trim(),
        value: match[2].trim(),
      }));
  } catch {
    return [];
  }
}

export function agreementScopeForMonth(
  agreement?: AgreementSummary,
  date = new Date(),
) {
  const rows = agreementSchedule(agreement?.summary);
  if (!rows.length) return undefined;

  const currentMonth = new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
  }).format(date);
  return rows.find((row) => row.label.toLowerCase() === currentMonth.toLowerCase())?.value;
}
