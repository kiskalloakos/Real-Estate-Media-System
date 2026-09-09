import type { LeadStatus, LeadSummary } from '@/screens/web/types';

const leadStatusLabels: Record<LeadStatus, string> = {
  follow_up: 'Follow Up',
  lost: 'Declined',
  pending: 'Lead',
  won: 'Onboarding / Client',
};

const exportColumns: {
  label: string;
  value: (lead: LeadSummary) => string;
}[] = [
  { label: 'Name', value: (lead) => lead.researchName },
  { label: 'Location', value: (lead) => lead.location },
  { label: 'Phone number', value: (lead) => lead.phoneNumber },
  { label: 'Website', value: (lead) => lead.website },
  { label: 'Instagram', value: (lead) => lead.instagram },
  { label: 'Facebook', value: (lead) => lead.facebook },
  { label: 'TikTok', value: (lead) => lead.tiktok },
  { label: 'Listing link', value: (lead) => lead.listingLink },
  { label: 'Notes', value: (lead) => lead.notes },
  { label: 'Status', value: (lead) => leadStatusLabels[lead.status] ?? leadStatusLabels.pending },
];

function csvCell(value: string) {
  const spreadsheetSafeValue = /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
  return `"${spreadsheetSafeValue.replace(/"/g, '""')}"`;
}

export function leadsCsv(leads: LeadSummary[]) {
  const rows = [
    exportColumns.map((column) => csvCell(column.label)).join(','),
    ...leads.map((lead) => exportColumns.map((column) => csvCell(column.value(lead))).join(',')),
  ];
  return `\uFEFF${rows.join('\r\n')}`;
}
