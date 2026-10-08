import type { AgreementDeliverableSummary } from '@/screens/web/types';

const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export function simplifiedFulfillmentStatus(status: AgreementDeliverableSummary['status']): 'planned' | 'in_progress' | 'delivered' {
  if (status === 'delivered') return 'delivered';
  if (status === 'planned' || status === 'skipped') return 'planned';
  return 'in_progress';
}

export function chronologicalFulfillment(deliverables: AgreementDeliverableSummary[] = []) {
  const period = (name: string) => {
    const match = name.match(/^\s*([A-Za-z]+)\s+(\d{4})\s*:/);
    const month = match ? months.indexOf(match[1].toLowerCase()) : -1;
    return match && month >= 0 ? Number(match[2]) * 12 + month : Number.MAX_SAFE_INTEGER;
  };
  // A stable ID tie-breaker keeps same-period rows fixed after backend updates.
  return [...deliverables].sort((left, right) =>
    period(left.name) - period(right.name)
    || left.name.localeCompare(right.name)
    || left.id.localeCompare(right.id));
}

export function fulfillmentCompletion(deliverables: AgreementDeliverableSummary[] = []) {
  const total = deliverables.reduce((sum, item) => sum + item.quantity, 0);
  const delivered = deliverables.reduce((sum, item) => sum + (simplifiedFulfillmentStatus(item.status) === 'delivered' ? item.quantity : 0), 0);
  return { total, delivered, percentage: total ? Math.round(delivered / total * 100) : 0 };
}
