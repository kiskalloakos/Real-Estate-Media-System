import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { Icon, type IconName } from './Icon';

export function cx(...values: (string | false | null | undefined)[]) {
  return values.filter(Boolean).join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: IconName;
  iconAfter?: IconName;
  /**
   * The four color names are the canonical Realty Media button variants.
   * The remaining names are compatibility aliases for existing screens:
   * primary/danger -> blue with white content, secondary/paper -> white with
   * black content, ghost -> grey with black content, black -> white content.
   */
  variant?:
    | 'blue'
    | 'white'
    | 'black'
    | 'grey'
    | 'primary'
    | 'secondary'
    | 'ghost'
    | 'paper'
    | 'danger';
}

export function Button({
  children,
  className,
  icon,
  iconAfter,
  type = 'button',
  variant = 'blue',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx('rm-button', `rm-button--${variant}`, className)}
      type={type}
      {...props}
    >
      {icon ? <Icon name={icon} size={17} /> : null}
      <span>{children}</span>
      {iconAfter ? <Icon name={iconAfter} size={17} /> : null}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  size?: 'sm' | 'md';
}

export function IconButton({
  className,
  icon,
  label,
  size = 'md',
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={cx('rm-icon-button', `rm-icon-button--${size}`, className)}
      title={label}
      type={type}
      {...props}
    >
      <Icon name={icon} size={size === 'sm' ? 17 : 19} />
    </button>
  );
}

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'article' | 'div' | 'section';
  tone?: 'paper' | 'bright' | 'dark' | 'transparent';
}

export function Card({
  as: Element = 'article',
  children,
  className,
  tone = 'paper',
  ...props
}: CardProps) {
  return (
    <Element className={cx('rm-card', `rm-card--${tone}`, className)} {...props}>
      {children}
    </Element>
  );
}

export interface AvatarProps {
  alt?: string;
  className?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  src?: string;
}

export function Avatar({ alt, className, name, size = 'md', src }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <span className={cx('rm-avatar', `rm-avatar--${size}`, className)}>
      {src ? (
        <img alt={alt ?? name} decoding="async" loading="eager" src={src} />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  );
}

export interface StatusPillProps {
  children: ReactNode;
  className?: string;
  dot?: boolean;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'ink';
}

export function StatusPill({
  children,
  className,
  dot = false,
  tone = 'neutral',
}: StatusPillProps) {
  return (
    <span className={cx('rm-status', `rm-status--${tone}`, className)}>
      {dot ? <span aria-hidden="true" className="rm-status__dot" /> : null}
      {children}
    </span>
  );
}

export interface PageHeaderProps {
  actions?: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
}

export function PageHeader({ actions, title, description, eyebrow }: PageHeaderProps) {

  return (
    <header className="rm-page-header">
      <div className="aw-feature-heading">{eyebrow ? <span className="aw-eyebrow">{eyebrow}</span> : null}<h1>{title}</h1>{description ? <p>{description}</p> : null}</div>
      <div className="rm-page-header__actions">{actions}</div>
    </header>
  );
}

export interface SectionHeaderProps {
  action?: ReactNode;
  description?: string;
  kicker?: string;
  title: string;
}

export function SectionHeader({ action, kicker, title }: SectionHeaderProps) {
  return (
    <header className="rm-section-header">
      <div>
        {kicker ? <p className="rm-section-kicker">{kicker}</p> : null}
        <h2>{title}</h2>
      </div>
      {action}
    </header>
  );
}

export interface KpiCardProps {
  className?: string;
  detail?: string;
  icon: IconName;
  label: string;
  tone?: 'paper' | 'dark' | 'accent';
  trend?: string;
  value: string;
}

export function KpiCard({
  className,
  detail,
  icon,
  label,
  tone = 'paper',
  trend,
  value,
}: KpiCardProps) {
  const surfaceTone = tone === 'dark' ? 'paper' : tone;
  return (
    <Card className={cx('rm-kpi', `rm-kpi--${surfaceTone}`, className)} tone="paper">
      <div className="rm-kpi__topline">
        <span className="rm-kpi__icon">
          <Icon name={icon} size={18} />
        </span>
        {trend ? (
          <span className="rm-kpi__trend">
            <Icon name="trend-up" size={14} />
            {trend}
          </span>
        ) : null}
      </div>
      <p className="rm-kpi__label">{label}</p>
      <strong className="rm-kpi__value">{value}</strong>
      {detail ? <p className="rm-kpi__detail">{detail}</p> : null}
    </Card>
  );
}

export interface ProgressBarProps {
  className?: string;
  label?: string;
  tone?: 'accent' | 'success' | 'warning';
  value: number;
}

export function ProgressBar({
  className,
  label,
  tone = 'accent',
  value,
}: ProgressBarProps) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={safeValue}
      className={cx('rm-progress', className)}
      role="progressbar"
    >
      <span
        className={cx('rm-progress__fill', `rm-progress__fill--${tone}`)}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

export interface ModalProps {
  className?: string;
  children: ReactNode;
  description?: string;
  fullscreen?: boolean;
  onClose: () => void;
  open: boolean;
  title: string;
  wide?: boolean;
}

export function Modal({ className, children, description, fullscreen, onClose, open, title, wide }: ModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const scrollContainer = document.querySelector<HTMLElement>('.aw-frame, .rm-portal');
    const previousOverflow = scrollContainer?.style.overflow ?? document.body.style.overflow;
    if (scrollContainer) {
      scrollContainer.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'hidden';
    }
    const focusTimer = window.setTimeout(() => {
      const preferred = dialogRef.current?.querySelector<HTMLElement>(
        '[data-modal-autofocus], [autofocus]',
      );
      const fallback = dialogRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
      );
      (preferred ?? fallback ?? dialogRef.current)?.focus();
    }, 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      if (scrollContainer) {
        scrollContainer.style.overflow = previousOverflow;
      } else {
        document.body.style.overflow = previousOverflow;
      }
      previousFocus?.focus();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="rm-modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onCloseRef.current();
      }}
    >
      <section
        aria-describedby={description ? 'rm-modal-description' : undefined}
        aria-labelledby="rm-modal-title"
        aria-modal="true"
        className={cx('rm-modal', 'rm-modal--liquid-glass', className, wide && 'rm-modal--wide', fullscreen && 'rm-modal--fullscreen')}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="rm-modal__header">
          <div>
            <h2 id="rm-modal-title">{title}</h2>
            {description ? <p id="rm-modal-description">{description}</p> : null}
          </div>
          <IconButton
            icon="x"
            label="Close dialog"
            onClick={() => onCloseRef.current()}
          />
        </header>
        <div className="rm-modal__body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

export interface EmptyStateProps {
  action?: ReactNode;
  description?: string;
  icon?: IconName;
  title: string;
}

export function EmptyState({
  action,
  description,
  icon = 'sparkles',
  title,
}: EmptyStateProps) {
  return (
    <div className="rm-empty">
      <span className="rm-empty__icon">
        <Icon name={icon} size={22} />
      </span>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export interface MiniSparklineProps {
  label: string;
  points: number[];
  tone?: 'paper' | 'dark';
}

export function MiniSparkline({ label, points, tone = 'paper' }: MiniSparklineProps) {
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = Math.max(max - min, 1);
  const coordinates = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 46 - ((point - min) / range) * 38;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      aria-label={label}
      className={cx('rm-sparkline', `rm-sparkline--${tone}`)}
      preserveAspectRatio="none"
      role="img"
      viewBox="0 0 100 52"
    >
      <polyline fill="none" points={coordinates} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
