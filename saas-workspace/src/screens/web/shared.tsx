import { Button, Card, Icon, ProgressBar, StatusPill, type StatusPillProps } from '@/components/web';

import type { PropertySummary, WorkStatus } from './types';

export function formatRon(value: number) {
  return new Intl.NumberFormat('ro-RO', {
    currency: 'RON',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 1, notation: 'compact' }).format(value);
}

const statusMeta: Record<WorkStatus, { label: string; tone: StatusPillProps['tone'] }> = {
  active: { label: 'Active', tone: 'success' },
  approved: { label: 'Approved', tone: 'success' },
  complete: { label: 'Complete', tone: 'success' },
  draft: { label: 'Draft', tone: 'neutral' },
  in_review: { label: 'In review', tone: 'accent' },
  needs_changes: { label: 'Changes requested', tone: 'warning' },
  overdue: { label: 'Overdue', tone: 'danger' },
  scheduled: { label: 'Scheduled', tone: 'ink' },
};

export function WorkStatusPill({ status }: { status: WorkStatus }) {
  const meta = statusMeta[status];
  return (
    <StatusPill dot tone={meta.tone}>
      {meta.label}
    </StatusPill>
  );
}

export interface PropertyCardProps {
  onOpen?: (property: PropertySummary) => void;
  property: PropertySummary;
  showClient?: boolean;
}

export function PropertyCard({ onOpen, property, showClient = true }: PropertyCardProps) {
  return (
    <Card className="rm-property-card">
      <div className="rm-property-card__media">
        <img alt={`${property.name} exterior`} loading="lazy" src={property.coverUrl} />
        <div className="rm-property-card__media-topline">
          <button
            aria-label={`View details for ${property.name}`}
            className="rm-media-menu"
            onClick={() => onOpen?.(property)}
            type="button"
          >
            <Icon name="dots" size={18} />
          </button>
        </div>
      </div>
      <div className="rm-property-card__body">
        {showClient ? <p className="rm-section-kicker">{property.clientName}</p> : null}
        <h3>{property.name}</h3>
        <p className="rm-meta-line">
          <Icon name="map-pin" size={15} />
          {property.location}
        </p>
        {property.assignedTeamNames.length ? (
          <p className="rm-meta-line">
            <Icon name="users" size={15} />
            {property.assignedTeamNames.join(', ')}
          </p>
        ) : null}
        <div className="rm-property-card__progress">
          <div>
            <span>Campaign progress</span>
            <strong>{property.completion}%</strong>
          </div>
          <ProgressBar label={`${property.name} campaign progress`} value={property.completion} />
        </div>
        <div className="rm-property-card__metrics">
          <div>
            <span>Views</span>
            <strong>{property.analytics.views}</strong>
          </div>
          <div>
            <span>Growth</span>
            <strong>{property.analytics.followers}</strong>
          </div>
          <div>
            <span>Engagement</span>
            <strong>{property.analytics.engagement}</strong>
          </div>
        </div>
        <div className="rm-property-card__footer">
          <p>
            <Icon name="clock" size={15} />
            {property.nextMilestone}
          </p>
          <Button iconAfter="arrow-right" onClick={() => onOpen?.(property)} variant="ghost">
            Open
          </Button>
        </div>
      </div>
    </Card>
  );
}

export interface ScreenTabsProps<T extends string> {
  active: T;
  items: { count?: number; key: T; label: string }[];
  label: string;
  onChange: (key: T) => void;
}

export function ScreenTabs<T extends string>({
  active,
  items,
  label,
  onChange,
}: ScreenTabsProps<T>) {
  return (
    <div aria-label={label} className="rm-tabs" role="tablist">
      {items.map((item) => (
        <button
          aria-selected={active === item.key}
          className={active === item.key ? 'is-active' : undefined}
          key={item.key}
          onClick={() => onChange(item.key)}
          role="tab"
          type="button"
        >
          {item.label}
          {typeof item.count === 'number' ? <span>{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
