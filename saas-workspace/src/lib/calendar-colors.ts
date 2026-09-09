// Shared event colors are data labels, independent of either platform's theme.
export const calendarColors = [
  { id: 'blue', label: 'Blue', color: '#5256E0', background: '#EEF0FF' },
  { id: 'green', label: 'Green', color: '#167A54', background: '#E5F5EE' },
  { id: 'amber', label: 'Amber', color: '#9A5B00', background: '#FFF3D6' },
  { id: 'red', label: 'Red', color: '#A52A2A', background: '#FDE7E7' },
  { id: 'purple', label: 'Purple', color: '#8038A3', background: '#F4E8FB' },
  { id: 'pink', label: 'Pink', color: '#A72D68', background: '#FCE7F1' },
  { id: 'slate', label: 'Slate', color: '#475569', background: '#E8EDF2' },
] as const;

export type CalendarColor = (typeof calendarColors)[number]['id'];

export function calendarColor(value?: string | null, type = 'shoot') {
  const defaults: Record<string, CalendarColor> = {
    shoot: 'blue', review: 'purple', deadline: 'red', internal: 'green',
    meeting: 'green', reminder: 'amber', payment: 'amber', marketing: 'slate',
  };
  return calendarColors.find((option) => option.id === value)
    ?? calendarColors.find((option) => option.id === defaults[type])
    ?? calendarColors[0];
}
