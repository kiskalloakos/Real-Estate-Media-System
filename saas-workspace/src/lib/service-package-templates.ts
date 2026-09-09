export type ServicePackageTask = {
  checklist: string[];
  dependsOn?: string;
  description: string;
  dueOffsetDays: number;
  priority: 'normal' | 'high';
  role: 'account_manager' | 'producer' | 'videographer' | 'editor';
  title: string;
};

export type ServicePackageTemplate = {
  contractMonths: number;
  description: string;
  id: string;
  monthlyDeliverables: string;
  monthlyPrice: number;
  name: string;
  kickoffTasks: ServicePackageTask[];
};

export const servicePackageTemplates: ServicePackageTemplate[] = [
  {
    id: 'property-launch',
    name: 'Property launch',
    description: 'A focused first-month campaign for one property.',
    contractMonths: 3,
    monthlyPrice: 4500,
    monthlyDeliverables: '1 shoot, 8 short-form videos, 20 edited photos',
    kickoffTasks: [
      { title: 'Confirm the property brief', description: 'Gather the positioning, priorities, access details, and required references.', dueOffsetDays: 1, priority: 'high', role: 'account_manager', checklist: ['Confirm listing facts', 'Collect visual references', 'Confirm client approval owner'] },
      { title: 'Schedule the launch shoot', description: 'Confirm the shoot date, crew, gear, and client access.', dueOffsetDays: 3, priority: 'high', role: 'producer', dependsOn: 'Confirm the property brief', checklist: ['Confirm date and access', 'Assign crew', 'Reserve required gear'] },
      { title: 'Prepare the launch review', description: 'Set the first review milestone and delivery expectations.', dueOffsetDays: 7, priority: 'normal', role: 'editor', dependsOn: 'Schedule the launch shoot', checklist: ['Create delivery folder', 'Set review deadline', 'Confirm delivery format'] },
    ],
  },
  {
    id: 'monthly-content',
    name: 'Monthly content retainer',
    description: 'A repeatable production rhythm for an ongoing client relationship.',
    contractMonths: 6,
    monthlyPrice: 7200,
    monthlyDeliverables: '1 shoot, 16 short-form videos, 1 campaign report',
    kickoffTasks: [
      { title: 'Run the client kickoff', description: 'Confirm the monthly goals, spokesperson, approval route, and production rhythm.', dueOffsetDays: 1, priority: 'high', role: 'account_manager', checklist: ['Set campaign goal', 'Confirm spokesperson', 'Confirm approval route'] },
      { title: 'Assign the production team', description: 'Attach the producer, videographer, editor, and account owner to the property.', dueOffsetDays: 2, priority: 'high', role: 'producer', dependsOn: 'Run the client kickoff', checklist: ['Assign producer', 'Assign videographer', 'Assign editor'] },
      { title: 'Schedule the first production day', description: 'Create the first shoot in the production calendar.', dueOffsetDays: 5, priority: 'high', role: 'producer', dependsOn: 'Assign the production team', checklist: ['Select shoot date', 'Confirm client access', 'Book gear'] },
      { title: 'Open the first review cycle', description: 'Set the first delivery target and client review deadline.', dueOffsetDays: 12, priority: 'normal', role: 'editor', dependsOn: 'Schedule the first production day', checklist: ['Prepare review link', 'Set deadline', 'Notify client'] },
    ],
  },
  {
    id: 'content-sprint',
    name: 'Content sprint',
    description: 'A short, high-output engagement for a campaign or new listing.',
    contractMonths: 1,
    monthlyPrice: 9000,
    monthlyDeliverables: '2 shoots, 24 short-form videos, 40 edited photos',
    kickoffTasks: [
      { title: 'Lock the campaign brief', description: 'Confirm the audience, offer, style references, and approval owner.', dueOffsetDays: 1, priority: 'high', role: 'account_manager', checklist: ['Confirm audience', 'Confirm offer', 'Collect references'] },
      { title: 'Book both production days', description: 'Reserve talent, crew, locations, and equipment.', dueOffsetDays: 2, priority: 'high', role: 'producer', dependsOn: 'Lock the campaign brief', checklist: ['Reserve crew', 'Reserve location', 'Reserve gear'] },
      { title: 'Set the delivery review', description: 'Create the review deadline before production begins.', dueOffsetDays: 6, priority: 'normal', role: 'editor', dependsOn: 'Book both production days', checklist: ['Create delivery plan', 'Set review date'] },
    ],
  },
];

export function monthlyScheduleFromPackage(template: ServicePackageTemplate, startsOn: string) {
  const start = new Date(`${startsOn}T12:00:00`);
  if (Number.isNaN(start.valueOf())) return '';

  return Array.from({ length: template.contractMonths }, (_, index) => {
    const date = new Date(start);
    date.setMonth(date.getMonth() + index);
    const month = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(date);
    return `${month}: ${template.monthlyDeliverables}`;
  }).join('\n');
}

/** Produces the recurring operating rhythm without tying it to a property. */
export function monthlyCampaignWindows(template: ServicePackageTemplate, startsOn: string) {
  const start = new Date(`${startsOn}T12:00:00`);
  if (Number.isNaN(start.valueOf())) return [];
  return Array.from({ length: template.contractMonths }, (_, index) => {
    const monthStart = new Date(start);
    monthStart.setMonth(monthStart.getMonth() + index);
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(monthEnd.getDate() - 1);
    return {
      dueOn: monthEnd.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(monthStart),
      startsOn: monthStart.toISOString().slice(0, 10),
    };
  });
}
