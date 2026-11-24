import type { CalendarEvent, PropertySummary, ReviewItem } from '../screens/web/types';

export const productionPhases = ['pre-production', 'production', 'post-production', 'delivery'] as const;
export type ProductionPhase = typeof productionPhases[number];
export type ProjectStage = ProductionPhase | 'completed';
export const projectStages = [...productionPhases, 'completed'] as const;
export const projectStageLabels: Record<ProjectStage, string> = {
  'pre-production': 'Pre-production',
  production: 'Production',
  'post-production': 'Post-production',
  delivery: 'Delivery',
  completed: 'Completed',
};
export const projectSections = ['Overview', 'Pages', 'Scripts', 'Reviews', 'Files', 'Tasks', 'Calendar', 'Client details', 'Details'] as const;
export type ProjectSection = typeof projectSections[number];

/** A view of existing production activity, not a separately saved workflow status. */
export function projectStage(property: PropertySummary, reviews: ReviewItem[], events: CalendarEvent[], today: string): ProjectStage {
  if (property.status === 'complete') return 'completed';
  const assets = reviews.filter(item => item.propertyId === property.id && item.kind !== 'script');
  if (assets.length) return assets.every(item => item.status === 'approved') ? 'delivery' : 'post-production';
  if (property.status === 'approved') return 'delivery';
  if (property.status === 'in_review' || property.status === 'needs_changes') return 'post-production';
  const shoots = events.filter(item => item.propertyId === property.id && item.type === 'shoot');
  if (shoots.some(item => (item.endDate || item.date) < today)) return 'post-production';
  if (shoots.some(item => item.date <= today && (item.endDate || item.date) >= today)) return 'production';
  return 'pre-production';
}

export function localDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
