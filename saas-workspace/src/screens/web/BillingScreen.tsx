import { useMemo, useState, type FormEvent } from 'react';

import {
  Button,
  Card,
  EmptyState,
  Icon,
  KpiCard,
  Modal,
  PageHeader,
  SectionHeader,
  StatusPill,
  useToast,
  type PortalRole,
} from '@/components/web';

import { demoPayments } from './demoData';
import { ArchiveConfirmModal } from './ArchiveConfirmModal';
import { agreementSchedule } from './agreementSchedule';
import { formatRon } from './shared';
import type {
  AgreementSummary,
  ClientSummary,
  CreatePaymentInput,
  PaymentRecord,
  UpdateAgreementInput,
  UpdatePaymentInput,
} from './types';

export interface BillingScreenProps {
  agreements?: AgreementSummary[];
  clients?: ClientSummary[];
  onAddPayment?: (input: CreatePaymentInput) => Promise<void>;
  onArchiveAgreement?: (agreementId: string) => Promise<void>;
  onArchivePayment?: (paymentId: string) => Promise<void>;
  onMarkPaid?: (paymentId: string) => Promise<void>;
  onUpdateAgreement?: (input: UpdateAgreementInput) => Promise<void>;
  onUpdatePayment?: (input: UpdatePaymentInput) => Promise<void>;
  payments?: PaymentRecord[];
  role: Extract<PortalRole, 'admin' | 'client'>;
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

function agreementSummary(summary?: string) {
  if (!summary) return 'No plain-language agreement summary has been added yet.';
  return agreementSchedule(summary).length ? undefined : summary;
}

const paymentStatusMeta: Record<
  PaymentRecord['status'],
  { label: string; tone: 'success' | 'danger' | 'warning' | 'neutral' }
> = {
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  due: { label: 'Due', tone: 'warning' },
  overdue: { label: 'Overdue', tone: 'danger' },
  paid: { label: 'Paid', tone: 'success' },
  upcoming: { label: 'Upcoming', tone: 'neutral' },
  waived: { label: 'Waived', tone: 'neutral' },
};

const demoAgreement: AgreementSummary = {
  clientId: 'client-cabana',
  clientName: 'Cabana The One',
  currency: 'RON',
  endsOn: '2027-04-30',
  id: 'demo-agreement',
  monthlyAmount: 7200,
  startsOn: '2026-05-01',
  status: 'active',
  summary:
    'Monthly production and management including short-form video, edited photography, listing support and social publishing.',
  title: 'Full-service content partnership',
  totalValue: 86_400,
};

const emptyPaymentForm: CreatePaymentInput = {
  amount: '',
  clientId: '',
  clientNote: '',
  dueOn: new Date().toISOString().slice(0, 10),
  invoiceReference: '',
  label: '',
};

export function BillingScreen({
  agreements,
  clients = [],
  onAddPayment,
  onArchiveAgreement,
  onArchivePayment,
  onMarkPaid,
  onUpdateAgreement,
  onUpdatePayment,
  payments,
  role,
}: BillingScreenProps) {
  const { notify } = useToast();
  const isPreview = payments === undefined && agreements === undefined;
  const sourcePayments = useMemo(
    () => (isPreview ? demoPayments : (payments ?? [])),
    [isPreview, payments],
  );
  const sourceAgreements = useMemo(
    () => (isPreview ? [demoAgreement] : (agreements ?? [])),
    [agreements, isPreview],
  );
  const [selectedClientId, setSelectedClientId] = useState(
    sourceAgreements[0]?.clientId ?? clients[0]?.id ?? '',
  );
  const [agreementOpen, setAgreementOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CreatePaymentInput>(emptyPaymentForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [agreementEdit, setAgreementEdit] = useState<UpdateAgreementInput | null>(null);
  const [paymentEdit, setPaymentEdit] = useState<UpdatePaymentInput | null>(null);
  const [paymentEditSource, setPaymentEditSource] = useState<PaymentRecord | null>(null);
  const [archiveAgreementTarget, setArchiveAgreementTarget] = useState<AgreementSummary | null>(null);
  const [archivePaymentTarget, setArchivePaymentTarget] = useState<PaymentRecord | null>(null);
  const agreement =
    sourceAgreements.find((item) => item.clientId === selectedClientId) ??
    sourceAgreements[0];
  const filteredPayments = useMemo(
    () =>
      selectedClientId
        ? sourcePayments.filter(
            (payment) => !payment.clientId || payment.clientId === selectedClientId,
          )
        : sourcePayments,
    [selectedClientId, sourcePayments],
  );
  const paidTotal = filteredPayments
    .filter((payment) => payment.status === 'paid')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const upcoming = filteredPayments.find((payment) =>
    ['due', 'upcoming'].includes(payment.status),
  );
  const schedule = agreementSchedule(agreement?.summary);

  const openPaymentForm = () => {
    setForm({
      ...emptyPaymentForm,
      clientId: selectedClientId || clients[0]?.id || '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onAddPayment) return;
    setSaving(true);
    setFormError('');
    try {
      await onAddPayment(form);
      setFormOpen(false);
      setSelectedClientId(form.clientId);
      notify('Payment record added to the shared ledger.');
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not add the payment.');
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (paymentId: string) => {
    if (!onMarkPaid) return;
    setSaving(true);
    try {
      await onMarkPaid(paymentId);
      notify('Payment marked as paid.');
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not update the payment.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openAgreement = () => {
    if (role === 'client' && agreement?.fileUrl) {
      window.open(agreement.fileUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setAgreementOpen(true);
  };

  const openAgreementEdit = (item: AgreementSummary) => {
    setAgreementOpen(false);
    setFormError('');
    setAgreementEdit({
      agreementId: item.id,
      currency: item.currency,
      endsOn: item.endsOn ?? '',
      monthlyAmount: String(item.monthlyAmount),
      startsOn: item.startsOn ?? '',
      status: item.status,
      summary: item.summary ?? '',
      title: item.title,
      totalValue: String(item.totalValue),
    });
  };

  const saveAgreement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!agreementEdit || !onUpdateAgreement) return;
    setSaving(true);
    setFormError('');
    try {
      await onUpdateAgreement(agreementEdit);
      notify(`${agreementEdit.title} was updated.`);
      setAgreementEdit(null);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not update the agreement.');
    } finally {
      setSaving(false);
    }
  };

  const openPaymentEdit = (payment: PaymentRecord) => {
    setFormError('');
    setPaymentEditSource(payment);
    setPaymentEdit({
      amount: String(payment.amount),
      clientNote: payment.clientNote ?? '',
      dueOn: payment.dueDate,
      invoiceReference: payment.invoice,
      label: payment.period,
      paymentId: payment.id,
      status:
        payment.scheduleStatus === 'paid'
          ? undefined
          : payment.scheduleStatus,
    });
  };

  const savePayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paymentEdit || !onUpdatePayment) return;
    setSaving(true);
    setFormError('');
    try {
      await onUpdatePayment(paymentEdit);
      notify(`${paymentEdit.label} was updated.`);
      setPaymentEdit(null);
      setPaymentEditSource(null);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not update the payment.');
    } finally {
      setSaving(false);
    }
  };

  const archiveAgreement = async () => {
    if (!archiveAgreementTarget || !onArchiveAgreement) return;
    setSaving(true);
    try {
      await onArchiveAgreement(archiveAgreementTarget.id);
      notify(`${archiveAgreementTarget.title} was deleted.`);
      setArchiveAgreementTarget(null);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not delete the agreement.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const archivePayment = async () => {
    if (!archivePaymentTarget || !onArchivePayment) return;
    setSaving(true);
    try {
      await onArchivePayment(archivePaymentTarget.id);
      notify(`${archivePaymentTarget.period} was deleted.`);
      setArchivePaymentTarget(null);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not delete the payment.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rm-page${role === 'client' ? ' rm-client-deal-page' : ''}`}>
      {role === 'admin' ? (
        <PageHeader
          actions={
            <>
              <Button disabled={!agreement} icon="file" onClick={openAgreement} variant="secondary">
                Agreement
              </Button>
              <Button icon="plus" onClick={openPaymentForm}>Add payment record</Button>
            </>
          }
          title="Deal"
        />
      ) : null}

      {role === 'admin' && (clients.length > 1 || sourceAgreements.length > 1) ? (
        <Card className="rm-billing-client-switcher" tone="transparent">
          <label className="rm-field">
            <span>Client account</span>
            <select onChange={(event) => setSelectedClientId(event.target.value)} value={selectedClientId}>
              {[...new Map(
                [...clients.map((client) => [client.id, client.name] as const), ...sourceAgreements.map((item) => [item.clientId, item.clientName] as const)],
              )].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
        </Card>
      ) : null}

      {role === 'admin' ? (
        <section aria-label="Agreement overview" className="rm-kpi-grid rm-kpi-grid--three">
          <KpiCard
            detail={agreement?.title ?? 'No current client agreement'}
            icon="receipt"
            label="Monthly agreement"
            tone="dark"
            value={agreement ? formatRon(agreement.monthlyAmount) : '—'}
          />
          <KpiCard
            icon="calendar"
            label={upcoming ? `Next payment · ${formatDate(upcoming.dueDate)}` : 'Next payment'}
            value={upcoming ? formatRon(upcoming.amount) : '—'}
          />
          <KpiCard
            icon="check"
            label="Recorded as paid"
            value={formatRon(paidTotal)}
          />
        </section>
      ) : null}

      {agreement ? (
        <div className={`rm-billing-grid${role === 'client' ? ' rm-billing-grid--agreement-only' : ''}`}>
          <Card className="rm-agreement-card" tone="dark">
            <div className="rm-agreement-card__top">
              <div>
                <p className="rm-section-kicker">Current agreement</p>
                <h2>{agreement.clientName}</h2>
                <p className="rm-agreement-card__title">{agreement.title}</p>
              </div>
              {role === 'admin' ? (
                <StatusPill dot tone={agreement.status === 'active' ? 'success' : 'neutral'}>
                  {agreement.status}
                </StatusPill>
              ) : null}
            </div>
            {schedule.length ? (
              <div className="rm-agreement-card__schedule">
                <p>Monthly deliverables</p>
                <dl>
                  {schedule.map((row) => (
                    <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
                  ))}
                </dl>
              </div>
            ) : (
              <p className="rm-agreement-card__summary">
                {agreementSummary(agreement.summary)}
              </p>
            )}
            <dl className="rm-agreement-facts">
              <div><dt>Start date</dt><dd>{agreement.startsOn ? formatDate(agreement.startsOn) : 'Not set'}</dd></div>
              <div><dt>End date</dt><dd>{agreement.endsOn ? formatDate(agreement.endsOn) : 'Ongoing'}</dd></div>
              <div><dt>Monthly amount</dt><dd>{formatRon(agreement.monthlyAmount)}</dd></div>
              <div><dt>Total contract value</dt><dd>{formatRon(agreement.totalValue)}</dd></div>
            </dl>
            <div className="rm-agreement-card__document">
              <span><Icon name="file" size={19} /></span>
              <div>
                <strong>{agreement.filePath?.split('/').pop() ?? 'Agreement summary'}</strong>
                <small>{agreement.fileUrl ? 'Signed document attached' : 'No document uploaded'}</small>
              </div>
              <Button icon="arrow-right" onClick={openAgreement} variant="paper">
                {agreement.fileUrl ? 'Open' : 'Details'}
              </Button>
            </div>
          </Card>

          {role === 'admin' ? (
            <Card className="rm-payment-due-card" tone="bright">
              <div className="rm-manual-badge">
                <Icon name="receipt" size={16} />
                Manually tracked
              </div>
              <p className="rm-section-kicker">Upcoming</p>
              <h2>{upcoming ? formatRon(upcoming.amount) : 'Nothing due'}</h2>
              <p>{upcoming ? `${upcoming.period} · due ${formatDate(upcoming.dueDate)}` : 'All records are current.'}</p>
              <div className="rm-payment-due-card__rule" />
              {upcoming ? (
                <Button disabled={saving} icon="check" onClick={() => void markPaid(upcoming.id)}>
                  {saving ? 'Updating…' : 'Mark as paid'}
                </Button>
              ) : (
                <StatusPill dot tone="success">Current</StatusPill>
              )}
            </Card>
          ) : null}
        </div>
      ) : (
        <Card tone="bright">
          <EmptyState
            action={role === 'admin' ? <Button onClick={openPaymentForm}>Add a payment</Button> : undefined}
            icon="receipt"
            title="No agreement connected"
          />
        </Card>
      )}

      {role === 'admin' ? (
        <Card className="rm-table-card" tone="bright">
        <SectionHeader
          action={role === 'admin' ? <Button icon="plus" onClick={openPaymentForm} variant="ghost">Add record</Button> : undefined}
          kicker="Manual ledger"
          title="Payment history"
        />
        {filteredPayments.length ? (
          <div className="rm-table-wrap">
            <table className="rm-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Client</th>
                  <th>Reference</th>
                  <th>Due date</th>
                  <th>Paid date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  {role === 'admin' ? <th><span className="rm-visually-hidden">Actions</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td><strong>{payment.period}</strong></td>
                    <td>{payment.clientName ?? agreement?.clientName ?? 'Client'}</td>
                    <td>{payment.invoice}</td>
                    <td>{formatDate(payment.dueDate)}</td>
                    <td>{payment.paidDate ? formatDate(payment.paidDate) : '—'}</td>
                    <td><strong>{formatRon(payment.amount)}</strong></td>
                    <td>
                      <StatusPill
                        dot
                        tone={paymentStatusMeta[payment.status].tone}
                      >
                        {paymentStatusMeta[payment.status].label}
                      </StatusPill>
                    </td>
                    {role === 'admin' ? (
                      <td>
                        <Button onClick={() => openPaymentEdit(payment)} variant="ghost">Edit</Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            action={role === 'admin' ? <Button onClick={openPaymentForm}>Add the first record</Button> : undefined}
            icon="receipt"
            title="No payment records yet"
          />
        )}
        </Card>
      ) : null}

      <Modal
        onClose={() => setFormOpen(false)}
        open={formOpen}
        title="Add payment record"
      >
        <form className="rm-action-form" onSubmit={submitPayment}>
          {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
          <label className="rm-field">
            <span>Client</span>
            <select
              onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value }))}
              required
              value={form.clientId}
            >
              <option value="">Choose a client</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
          <div className="rm-form-grid rm-form-grid--two">
            <label className="rm-field">
              <span>Period / label</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="August 2026"
                required
                value={form.label}
              />
            </label>
            <label className="rm-field">
              <span>Amount (RON)</span>
              <input
                inputMode="decimal"
                min="0.01"
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                required
                step="0.01"
                type="number"
                value={form.amount}
              />
            </label>
            <label className="rm-field">
              <span>Due date</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, dueOn: event.target.value }))}
                required
                type="date"
                value={form.dueOn}
              />
            </label>
            <label className="rm-field">
              <span>Reference</span>
              <input
                onChange={(event) => setForm((current) => ({ ...current, invoiceReference: event.target.value }))}
                placeholder="RM-2026-08"
                value={form.invoiceReference}
              />
            </label>
          </div>
          <label className="rm-field">
            <span>Client note</span>
            <textarea
              onChange={(event) => setForm((current) => ({ ...current, clientNote: event.target.value }))}
              rows={3}
              value={form.clientNote}
            />
          </label>
          <footer className="rm-dialog-actions">
            <Button disabled={saving} onClick={() => setFormOpen(false)} variant="secondary">Cancel</Button>
            <Button disabled={saving || !form.clientId || !form.label.trim() || !form.amount} type="submit">
              {saving ? 'Adding…' : 'Add payment'}
            </Button>
          </footer>
        </form>
      </Modal>

      <Modal
        onClose={() => setAgreementOpen(false)}
        open={agreementOpen}
        title={agreement?.title ?? 'Agreement'}
      >
        {agreement ? (
          <div className="rm-agreement-dialog">
            <p>{agreement.summary || 'No agreement summary has been entered yet.'}</p>
            <dl className="rm-detail-list">
              <div><dt>Monthly</dt><dd>{formatRon(agreement.monthlyAmount)}</dd></div>
              <div><dt>Total value</dt><dd>{formatRon(agreement.totalValue)}</dd></div>
              <div><dt>Status</dt><dd>{agreement.status}</dd></div>
              <div><dt>Document</dt><dd>{agreement.fileUrl ? 'Attached' : 'Not uploaded'}</dd></div>
            </dl>
            {role === 'admin' ? (
              <footer className="rm-dialog-actions">
                {agreement.fileUrl ? (
                  <Button onClick={() => window.open(agreement.fileUrl, '_blank', 'noopener,noreferrer')} variant="secondary">
                    Open document
                  </Button>
                ) : null}
                <Button onClick={() => openAgreementEdit(agreement)}>Edit agreement</Button>
              </footer>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        onClose={() => {
          if (!saving) setAgreementEdit(null);
        }}
        open={Boolean(agreementEdit)}
        title="Edit agreement"
      >
        {agreementEdit ? (
          <form className="rm-action-form" onSubmit={saveAgreement}>
            {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
            <label className="rm-field">
              <span>Agreement title</span>
              <input onChange={(event) => setAgreementEdit((current) => current ? ({ ...current, title: event.target.value }) : current)} required value={agreementEdit.title} />
            </label>
            <div className="rm-form-grid rm-form-grid--two">
              <label className="rm-field">
                <span>Status</span>
                <select onChange={(event) => setAgreementEdit((current) => current ? ({ ...current, status: event.target.value as AgreementSummary['status'] }) : current)} value={agreementEdit.status}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="rm-field">
                <span>Currency</span>
                <input maxLength={3} onChange={(event) => setAgreementEdit((current) => current ? ({ ...current, currency: event.target.value.toUpperCase() }) : current)} required value={agreementEdit.currency} />
              </label>
              <label className="rm-field">
                <span>Monthly amount</span>
                <input min="0" onChange={(event) => setAgreementEdit((current) => current ? ({ ...current, monthlyAmount: event.target.value }) : current)} required step="0.01" type="number" value={agreementEdit.monthlyAmount} />
              </label>
              <label className="rm-field">
                <span>Total contract value</span>
                <input min="0" onChange={(event) => setAgreementEdit((current) => current ? ({ ...current, totalValue: event.target.value }) : current)} required step="0.01" type="number" value={agreementEdit.totalValue} />
              </label>
              <label className="rm-field">
                <span>Starts on</span>
                <input onChange={(event) => setAgreementEdit((current) => current ? ({ ...current, startsOn: event.target.value }) : current)} type="date" value={agreementEdit.startsOn} />
              </label>
              <label className="rm-field">
                <span>Ends on</span>
                <input onChange={(event) => setAgreementEdit((current) => current ? ({ ...current, endsOn: event.target.value }) : current)} type="date" value={agreementEdit.endsOn} />
              </label>
            </div>
            <label className="rm-field">
              <span>Client-visible summary</span>
              <textarea onChange={(event) => setAgreementEdit((current) => current ? ({ ...current, summary: event.target.value }) : current)} rows={5} value={agreementEdit.summary} />
            </label>
            <footer className="rm-dialog-actions rm-dialog-actions--split">
              <Button
                disabled={saving}
                onClick={() => {
                  const target = sourceAgreements.find((item) => item.id === agreementEdit.agreementId) ?? null;
                  setAgreementEdit(null);
                  setArchiveAgreementTarget(target);
                }}
                variant="danger"
              >
                Delete agreement
              </Button>
              <div>
                <Button disabled={saving} onClick={() => setAgreementEdit(null)} variant="secondary">Cancel</Button>
                <Button disabled={saving || !agreementEdit.title.trim()} type="submit">{saving ? 'Saving…' : 'Save changes'}</Button>
              </div>
            </footer>
          </form>
        ) : null}
      </Modal>

      <Modal
        onClose={() => {
          if (!saving) {
            setPaymentEdit(null);
            setPaymentEditSource(null);
          }
        }}
        open={Boolean(paymentEdit && paymentEditSource)}
        title={`Edit ${paymentEditSource?.period ?? 'payment'}`}
      >
        {paymentEdit && paymentEditSource ? (
          <form className="rm-action-form" onSubmit={savePayment}>
            {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
            <div className="rm-form-grid rm-form-grid--two">
              <label className="rm-field">
                <span>Period / label</span>
                <input onChange={(event) => setPaymentEdit((current) => current ? ({ ...current, label: event.target.value }) : current)} required value={paymentEdit.label} />
              </label>
              <label className="rm-field">
                <span>Amount (RON)</span>
                <input min="0.01" onChange={(event) => setPaymentEdit((current) => current ? ({ ...current, amount: event.target.value }) : current)} required step="0.01" type="number" value={paymentEdit.amount} />
              </label>
              <label className="rm-field">
                <span>Due date</span>
                <input onChange={(event) => setPaymentEdit((current) => current ? ({ ...current, dueOn: event.target.value }) : current)} required type="date" value={paymentEdit.dueOn} />
              </label>
              <label className="rm-field">
                <span>Reference</span>
                <input onChange={(event) => setPaymentEdit((current) => current ? ({ ...current, invoiceReference: event.target.value }) : current)} value={paymentEdit.invoiceReference} />
              </label>
              <label className="rm-field rm-field--wide">
                <span>Status</span>
                {paymentEditSource.scheduleStatus === 'paid' ? (
                  <>
                    <input disabled value="Paid" />
                    <small>Paid status and its financial ledger record are protected. Amount and note changes stay synchronized.</small>
                  </>
                ) : (
                  <select
                    onChange={(event) => setPaymentEdit((current) => current ? ({ ...current, status: event.target.value as UpdatePaymentInput['status'] }) : current)}
                    value={paymentEdit.status}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="due">Due</option>
                    <option value="late">Late</option>
                    <option value="waived">Waived</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                )}
              </label>
            </div>
            <label className="rm-field">
              <span>Client note</span>
              <textarea onChange={(event) => setPaymentEdit((current) => current ? ({ ...current, clientNote: event.target.value }) : current)} rows={3} value={paymentEdit.clientNote} />
            </label>
            <footer className="rm-dialog-actions rm-dialog-actions--split">
              <Button
                disabled={saving}
                onClick={() => {
                  setPaymentEdit(null);
                  setPaymentEditSource(null);
                  setArchivePaymentTarget(paymentEditSource);
                }}
                variant="danger"
              >
                Delete payment
              </Button>
              <div>
                <Button disabled={saving} onClick={() => { setPaymentEdit(null); setPaymentEditSource(null); }} variant="secondary">Cancel</Button>
                <Button disabled={saving || !paymentEdit.label.trim() || !paymentEdit.amount} type="submit">{saving ? 'Saving…' : 'Save changes'}</Button>
              </div>
            </footer>
          </form>
        ) : null}
      </Modal>

      <ArchiveConfirmModal
        busy={saving}
        label="agreement"
        onClose={() => setArchiveAgreementTarget(null)}
        onConfirm={() => void archiveAgreement()}
        open={Boolean(archiveAgreementTarget)}
      />

      <ArchiveConfirmModal
        busy={saving}
        label="payment"
        onClose={() => setArchivePaymentTarget(null)}
        onConfirm={() => void archivePayment()}
        open={Boolean(archivePaymentTarget)}
      />
    </div>
  );
}
