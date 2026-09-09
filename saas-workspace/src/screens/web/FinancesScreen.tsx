import { useMemo, useState } from 'react';

import {
  Button,
  Card,
  EmptyState,
  Icon,
  KpiCard,
  Modal,
  ProgressBar,
  SectionHeader,
  StatusPill,
  useToast,
} from '@/components/web';
import { useBrowserPersistedState } from '@/hooks/use-browser-persisted-state';

import { demoClients, demoCosts, demoDebts } from './demoData';
import { formatRon, ScreenTabs } from './shared';
import type {
  ClientSummary,
  CreateCostInput,
  CreateDebtInput,
  CreateMoneyMovementInput,
  DebtItem,
  FinanceAccountSummary,
  FinanceMoneyMovementItem,
  RecurringCostItem,
  UpdateMoneyMovementInput,
  UpdateCostInput,
  UpdateDebtInput,
  UpsertFinanceAccountInput,
} from './types';

export interface FinancesScreenProps {
  accounts?: FinanceAccountSummary[];
  archivedDebts?: DebtItem[];
  clients?: ClientSummary[];
  costs?: RecurringCostItem[];
  debts?: DebtItem[];
  moneyMovements?: FinanceMoneyMovementItem[];
  onAddCost?: (input: CreateCostInput) => Promise<void>;
  onAddDebt?: (input: CreateDebtInput) => Promise<void>;
  onCreateMoneyMovement?: (input: CreateMoneyMovementInput) => Promise<void>;
  onArchiveCost?: (costId: string) => Promise<void>;
  onArchiveDebt?: (debtId: string) => Promise<void>;
  onRecordDebtPayment?: (debtId: string, amount: string, note: string) => Promise<void>;
  onToggleCost?: (costId: string, paid: boolean) => Promise<void>;
  onUpdateDebt?: (input: UpdateDebtInput) => Promise<void>;
  onUpdateMoneyMovement?: (input: UpdateMoneyMovementInput) => Promise<void>;
  onUpdateCost?: (input: UpdateCostInput) => Promise<void>;
  onUpsertAccount?: (input: UpsertFinanceAccountInput) => Promise<void>;
}

type FinanceTab = 'business' | 'debts' | 'costs';
type CostForm = CreateCostInput & { costId?: string };

const today = new Date().toISOString().slice(0, 10);

const emptyMoneyMovement: CreateMoneyMovementInput = {
  accountId: '',
  amount: '',
  counterparty: '',
  description: '',
  occurredOn: today,
  transactionType: 'income',
};

const emptyAccount: UpsertFinanceAccountInput = {
  accountReference: '',
  accountType: 'bank',
  currentBalance: '',
  institutionName: '',
  name: '',
  notes: '',
};

const emptyDebt: CreateDebtInput = {
  amount: '',
  counterparty: '',
  direction: 'payable',
  dueOn: '',
  note: '',
};

const emptyCost: CreateCostInput = {
  amount: '',
  frequency: 'monthly',
  name: '',
  nextDueOn: today,
  notes: '',
  startsOn: today,
  vendor: '',
};

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function safeAmount(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function annualizedCost(cost: RecurringCostItem) {
  const amount = safeAmount(cost.amount);
  const frequency = cost.frequency.toLowerCase();
  if (frequency === 'weekly') return amount * 52;
  if (frequency === 'quarterly') return amount * 4;
  if (frequency === 'every 6 months') return amount * 2;
  if (frequency === 'yearly') return amount;
  const monthInterval = frequency.match(/^every (\d+) months?$/)?.[1];
  if (monthInterval) return amount * (12 / Math.max(1, Number(monthInterval)));
  return amount * 12;
}

function downloadFinanceCsv(
  moneyMovements: FinanceMoneyMovementItem[],
  debts: DebtItem[],
  costs: RecurringCostItem[],
) {
  const rows = [
    ['Type', 'Name / description', 'Amount RON', 'Date / due', 'Status'],
    ...moneyMovements.map((item) => [item.transactionType === 'income' ? 'Money added' : 'Money removed', item.description, item.amount, item.date, item.counterparty ?? '']),
    ...debts.map((item) => ['Debt', item.name, item.amount - item.paid, '', `${item.paid} paid`]),
    ...costs.map((item) => ['Recurring cost', item.name, item.amount, item.due, item.paid ? 'paid' : 'upcoming']),
  ];
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(','),
    )
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `realty-media-finances-${today}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function FinancesScreen({
  accounts: suppliedAccounts,
  archivedDebts: suppliedArchivedDebts,
  clients: suppliedClients,
  costs: suppliedCosts,
  debts: suppliedDebts,
  moneyMovements: suppliedMoneyMovements,
  onAddCost,
  onAddDebt,
  onCreateMoneyMovement,
  onArchiveCost,
  onArchiveDebt,
  onRecordDebtPayment,
  onToggleCost,
  onUpdateDebt,
  onUpdateMoneyMovement,
  onUpdateCost,
  onUpsertAccount,
}: FinancesScreenProps) {
  const { notify } = useToast();
  const isPreview =
    suppliedCosts === undefined &&
    suppliedDebts === undefined &&
    suppliedMoneyMovements === undefined;
  const costs = isPreview ? demoCosts : (suppliedCosts ?? []);
  const debts = isPreview ? demoDebts : (suppliedDebts ?? []);
  const archivedDebts = useMemo(() => suppliedArchivedDebts ?? [], [suppliedArchivedDebts]);
  const moneyMovements = useMemo(() => suppliedMoneyMovements ?? [], [suppliedMoneyMovements]);
  const accounts = useMemo(() => suppliedAccounts ?? [], [suppliedAccounts]);
  const recurringClients = useMemo(
    () => (isPreview ? demoClients : (suppliedClients ?? [])).filter(
      (client) => client.status !== 'paused' && safeAmount(client.monthlyPrice) > 0,
    ),
    [isPreview, suppliedClients],
  );
  const monthlyRecurringRevenue = recurringClients.reduce(
    (sum, client) => sum + safeAmount(client.monthlyPrice),
    0,
  );
  const liquidCash = accounts.reduce(
    (sum, account) => sum + safeAmount(account.currentBalance),
    0,
  );
  const moneyAdded = moneyMovements.filter((item) => item.transactionType === 'income');
  const allTimeRevenue = moneyAdded.reduce((sum, item) => sum + safeAmount(item.amount), 0);
  const totalDebt = debts.reduce((sum, debt) => sum + safeAmount(debt.amount), 0);
  const debtPaid = debts.reduce(
    (sum, debt) => sum + Math.min(safeAmount(debt.paid), safeAmount(debt.amount)),
    0,
  );
  const stillOwed = Math.max(0, totalDebt - debtPaid);
  const debtPaidPercent = totalDebt > 0 ? Math.min(100, (debtPaid / totalDebt) * 100) : 0;
  const monthlyCosts = costs.filter((cost) => cost.type === 'monthly');
  const periodicCosts = costs.filter((cost) => cost.type === 'periodic');
  const monthlyCostTotal = monthlyCosts.reduce((sum, cost) => sum + safeAmount(cost.amount), 0);
  const annualizedPeriodic = periodicCosts.reduce((sum, cost) => sum + annualizedCost(cost), 0);
  const unpaidCosts = costs.filter((cost) => !cost.paid);
  const unpaidCostTotal = unpaidCosts.reduce((sum, cost) => sum + safeAmount(cost.amount), 0);
  const [moneyMovementOpen, setMoneyMovementOpen] = useState(false);
  const [editingMoneyMovementId, setEditingMoneyMovementId] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountForm, setAccountForm] =
    useState<UpsertFinanceAccountInput>(emptyAccount);
  const [financeTab, setFinanceTab] = useBrowserPersistedState<FinanceTab>('rm:finances-state:tab', 'business');
  const [debtOpen, setDebtOpen] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [costOpen, setCostOpen] = useState(false);
  const [moneyMovementForm, setMoneyMovementForm] = useState<CreateMoneyMovementInput>(emptyMoneyMovement);
  const [debtForm, setDebtForm] = useState<CreateDebtInput>(emptyDebt);
  const [costForm, setCostForm] = useState<CostForm>(emptyCost);
  const [selectedDebt, setSelectedDebt] = useState<DebtItem | null>(null);
  const [selectedCost, setSelectedCost] = useState<RecurringCostItem | null>(null);
  const [debtPayment, setDebtPayment] = useState({ amount: '', note: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const runForm = async (
    mutation: (() => Promise<void>) | undefined,
    successMessage: string,
    close: () => void,
  ) => {
    if (!mutation) return;
    setSaving(true);
    setFormError('');
    try {
      await mutation();
      close();
      notify(successMessage);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not save this finance record.');
    } finally {
      setSaving(false);
    }
  };

  const openCost = (type: RecurringCostItem['type']) => {
    setCostForm({
      ...emptyCost,
      frequency: type === 'monthly' ? 'monthly' : 'quarterly',
    });
    setFormError('');
    setCostOpen(true);
  };

  const editCost = (cost: RecurringCostItem) => {
    setCostForm({
      amount: String(cost.amount),
      costId: cost.id,
      frequency: cost.frequencyKey ?? (cost.type === 'monthly' ? 'monthly' : 'quarterly'),
      name: cost.name,
      nextDueOn: cost.due,
      notes: cost.notes ?? '',
      startsOn: cost.startsOn ?? today,
      vendor: cost.vendor ?? '',
    });
    setFormError('');
    setSelectedCost(null);
    setCostOpen(true);
  };

  const toggleCost = async (cost: RecurringCostItem) => {
    if (!onToggleCost) return;
    try {
      await onToggleCost(cost.id, !cost.paid);
      notify(`${cost.name} marked ${cost.paid ? 'upcoming' : 'paid'}.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not update the cost.', 'error');
    }
  };

  const archiveDebt = async (debt: DebtItem) => {
    if (!onArchiveDebt || !window.confirm(`Archive ${debt.name}? It will remain available in Archived debts.`)) return;
    try {
      await onArchiveDebt(debt.id);
      notify(`${debt.name} archived.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : 'Could not archive the debt.', 'error');
    }
  };

  const openAccount = (account?: FinanceAccountSummary) => {
    setAccountForm(
      account
        ? {
            accountId: account.id,
            accountReference: account.accountReference ?? '',
            accountType: account.accountType,
            currentBalance: String(account.currentBalance),
            institutionName: account.institutionName ?? '',
            name: account.name,
            notes: account.notes ?? '',
          }
        : emptyAccount,
    );
    setFormError('');
    setAccountOpen(true);
  };

  const openMoneyMovement = (transactionType: CreateMoneyMovementInput['transactionType'], movement?: FinanceMoneyMovementItem) => {
    setEditingMoneyMovementId(movement?.id ?? null);
    setMoneyMovementForm(movement
      ? {
          accountId: movement.accountId,
          amount: String(movement.amount),
          counterparty: movement.counterparty ?? '',
          description: movement.description,
          occurredOn: movement.date,
          transactionType: movement.transactionType,
        }
      : {
          ...emptyMoneyMovement,
          accountId: accounts[0]?.id ?? '',
          transactionType,
        });
    setFormError('');
    setMoneyMovementOpen(true);
  };

  const openDebt = (debt?: DebtItem) => {
    setEditingDebtId(debt?.id ?? null);
    setDebtForm(debt ? {
      amount: String(debt.amount),
      counterparty: debt.name,
      direction: debt.direction,
      dueOn: debt.dueOn ?? '',
      note: debt.note,
    } : emptyDebt);
    setFormError('');
    setDebtOpen(true);
  };

  return (
    <div className="rm-page rm-finances-page">
      <div className="rm-finance-tabbar">
        <ScreenTabs
          active={financeTab}
          items={[
            { key: 'business', label: 'Business' },
            { count: debts.length, key: 'debts', label: 'Debts' },
            { count: costs.length, key: 'costs', label: 'Recurring / periodic costs' },
          ]}
          label="Finance sections"
          onChange={setFinanceTab}
        />
        <div className="rm-finance-tabbar__actions">
          {financeTab === 'business' ? (
            <>
              <Button
                icon="file"
                onClick={() => {
                  downloadFinanceCsv(moneyMovements, debts, costs);
                  notify('Finance summary exported as CSV.');
                }}
                variant="secondary"
              >
                Export summary
              </Button>
              <Button icon="plus" onClick={() => openMoneyMovement('income')}>Add money</Button>
              <Button icon="minus" onClick={() => openMoneyMovement('expense')} variant="secondary">Remove money</Button>
            </>
          ) : null}
          {financeTab === 'debts' ? (
            <Button icon="plus" onClick={() => openDebt()}>Add debt</Button>
          ) : null}
          {financeTab === 'costs' ? (
            <Button icon="plus" onClick={() => openCost('monthly')}>Add cost</Button>
          ) : null}
        </div>
      </div>

      {financeTab === 'business' ? (
        <section className="rm-finance-section">

        <div className="rm-kpi-grid rm-kpi-grid--three">
          <KpiCard detail={`${recurringClients.length} current ${pluralize(recurringClients.length, 'client agreement')}`} icon="trend-up" label="Recurring monthly revenue" value={formatRon(monthlyRecurringRevenue)} />
          <KpiCard detail={`${moneyAdded.length} ${pluralize(moneyAdded.length, 'money-in entry')}`} icon="star" label="All-time revenue" value={formatRon(allTimeRevenue)} />
          <KpiCard detail={`${monthlyCosts.length} ${pluralize(monthlyCosts.length, 'monthly expense')}`} icon="receipt" label="Monthly expenses" value={formatRon(monthlyCostTotal)} />
        </div>

        <div className="rm-business-hero">
          <Card className="rm-business-cash" tone="bright">
            <div className="rm-card-topline">
              <div>
                <p className="rm-section-kicker">Current liquidity</p>
              </div>
              <Icon name="wallet" size={21} />
            </div>
            <strong>{formatRon(liquidCash)}</strong>
            <Button className="rm-business-cash__add-account" icon="plus" onClick={() => openAccount()} variant="secondary">Add account</Button>
            {accounts.length ? (
              <div className="rm-account-list">
                {accounts.map((account) => (
                  <button
                    className="rm-account-row"
                    key={account.id}
                    onClick={() => openAccount(account)}
                    type="button"
                  >
                    <span className="rm-account-dot" />
                    <span>
                      <strong>{account.name}</strong>
                      <small>{account.institutionName || account.accountType}</small>
                    </span>
                    <b>{formatRon(account.currentBalance)}</b>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rm-finance-empty-summary">
                <Icon name="wallet" size={21} />
                <span>
                  <strong>No cash accounts yet</strong>
                  <small>Add a bank or cash account to track current liquidity.</small>
                </span>
              </div>
            )}
          </Card>
        </div>

        <Card className="rm-finance-ledger-card" tone="bright">
          <SectionHeader
            action={<div className="rm-finance-ledger-actions"><Button icon="plus" onClick={() => openMoneyMovement('income')} variant="ghost">Add money</Button><Button icon="minus" onClick={() => openMoneyMovement('expense')} variant="ghost">Remove money</Button></div>}
            kicker="Account ledger"
            title="Money Log"
          />
          {moneyMovements.length ? (
            <div className="rm-finance-income-list">
              {moneyMovements.slice(0, 10).map((item) => (
                <button
                  aria-label={`Edit ${item.transactionType === 'income' ? 'money added' : 'money removed'}: ${item.description}`}
                  key={item.id}
                  onClick={() => openMoneyMovement(item.transactionType, item)}
                  type="button"
                >
                  <span>
                    <strong>{item.description}</strong>
                    <small>{item.counterparty || (item.transactionType === 'income' ? 'Money added' : 'Money removed')} · {item.accountName} · {item.date}</small>
                  </span>
                  <b>{item.transactionType === 'expense' ? '−' : '+'}{formatRon(item.amount)}</b>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              action={<Button onClick={() => openMoneyMovement('income')} variant="secondary">Add money</Button>}
              description="Money added and removed from accounts will appear here and update each account balance."
              icon="wallet"
              title="No money movements recorded"
            />
          )}
        </Card>

        </section>
      ) : null}

      {financeTab === 'debts' ? (
        <section className="rm-finance-section">
        <Card className="rm-debt-hero" tone="dark">
          <div><p className="rm-section-kicker">Still owed</p><strong>{formatRon(stillOwed)}</strong><p>of {formatRon(totalDebt)} original balance</p></div>
          <div className="rm-debt-hero__progress">
            <span><strong>{Math.round(debtPaidPercent)}%</strong><small>paid off</small></span>
            <ProgressBar label="Total debt paid" tone="success" value={debtPaidPercent} />
          </div>
          <div><p className="rm-section-kicker">Paid off</p><strong>{formatRon(debtPaid)}</strong><p>across {debts.length} {pluralize(debts.length, 'debt')}</p></div>
        </Card>

        <div className="rm-debt-grid">
          {debts.length ? debts.map((debt) => {
            const originalAmount = safeAmount(debt.amount);
            const safePaid = Math.min(safeAmount(debt.paid), originalAmount);
            const percent = originalAmount > 0 ? Math.min(100, (safePaid / originalAmount) * 100) : 0;
            return (
              <Card className="rm-debt-card" key={debt.id} tone="bright">
                <div className="rm-card-topline">
                  <span className="rm-debt-card__icon"><Icon name="credit-card" size={18} /></span>
                  <StatusPill tone="neutral">{Math.round(percent)}% paid</StatusPill>
                </div>
                <h3>{debt.name}</h3>
                <p>{debt.note || 'No debt note'}</p>
                <div className="rm-debt-card__amounts">
                  <span><small>Remaining</small><strong>{formatRon(Math.max(0, originalAmount - safePaid))}</strong></span>
                  <span><small>Original</small><strong>{formatRon(originalAmount)}</strong></span>
                </div>
                <ProgressBar label={`${debt.name} repaid`} tone="success" value={percent} />
                <div className="rm-debt-card__actions">
                  <Button onClick={() => openDebt(debt)} variant="secondary">Edit debt</Button>
                  <Button
                    disabled={safePaid >= originalAmount}
                    onClick={() => {
                      setSelectedDebt(debt);
                      setDebtPayment({ amount: '', note: '' });
                      setFormError('');
                    }}
                    variant="ghost"
                  >
                    {safePaid >= originalAmount ? 'Paid in full' : 'Record payment'}
                  </Button>
                  {onArchiveDebt ? <Button onClick={() => void archiveDebt(debt)} variant="ghost">Archive</Button> : null}
                </div>
              </Card>
            );
          }) : (
            <Card className="rm-finance-empty-card" tone="bright">
              <EmptyState
                action={<Button icon="plus" onClick={() => openDebt()} variant="secondary">Add debt</Button>}
                description="Any financing or outstanding company balances you add will be tracked here."
                icon="credit-card"
                title="No debts recorded"
              />
            </Card>
          )}
        </div>
        {archivedDebts.length ? (
          <Card className="rm-cost-list-card rm-archived-debts-card" tone="bright">
            <SectionHeader
              kicker="Historical records"
              title={`Archived debts · ${archivedDebts.length}`}
            />
            <div className="rm-cost-list">
              {archivedDebts.map((debt) => (
                <div className="rm-cost-list__record" key={debt.id}>
                  <span>
                    <strong>{debt.name}</strong>
                    <small>{debt.direction === 'payable' ? 'Realty Media owed' : 'Owed to Realty Media'} {formatRon(safeAmount(debt.amount))} · {debt.lastPaidOn ? `Paid ${formatRon(safeAmount(debt.paid))} on ${new Date(debt.lastPaidOn).toLocaleDateString('ro-RO')}` : 'No payment recorded'} · Archived {debt.archivedAt ? new Date(debt.archivedAt).toLocaleDateString('ro-RO') : 'previously'}</small>
                  </span>
                  <b>{formatRon(safeAmount(debt.amount))}</b>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
        </section>
      ) : null}

      {financeTab === 'costs' ? (
        <section className="rm-finance-section">
        <div className="rm-cost-overview">
          <Card tone="dark"><p className="rm-section-kicker">Recurring monthly</p><strong>{formatRon(monthlyCostTotal)}</strong><span>per month · {formatRon(monthlyCostTotal * 12)} annualized</span></Card>
          <Card tone="bright"><p className="rm-section-kicker">Periodic commitments</p><strong>{formatRon(annualizedPeriodic)}</strong><span>expected over the next 12 months</span></Card>
          <Card tone="bright"><p className="rm-section-kicker">Unpaid commitments</p><strong>{formatRon(unpaidCostTotal)}</strong><span>across {unpaidCosts.length} upcoming {pluralize(unpaidCosts.length, 'cost')}</span></Card>
        </div>

        <div className="rm-cost-columns">
          {[
            { costs: monthlyCosts, kicker: 'Every month', title: 'Recurring costs', type: 'monthly' as const },
            { costs: periodicCosts, kicker: 'Quarterly, yearly or custom', title: 'Periodic costs', type: 'periodic' as const },
          ].map((section) => (
            <Card className="rm-cost-list-card" key={section.type} tone="bright">
              <SectionHeader
                action={<Button icon="plus" onClick={() => openCost(section.type)} variant="ghost">Add {section.type}</Button>}
                kicker={section.kicker}
                title={section.title}
              />
              <div className="rm-cost-list">
                {section.costs.length ? section.costs.map((cost) => (
                  <button aria-label={`Open ${cost.name}`} className={`rm-cost-list__record${cost.paid ? ' is-paid' : ''}`} key={cost.id} onClick={() => setSelectedCost(cost)} type="button">
                    <span><strong>{cost.name}</strong><small>{cost.paid ? `Paid · ${cost.frequency}` : `${cost.frequency} · ${cost.due}`}</small></span>
                    <b>{formatRon(safeAmount(cost.amount))}</b>
                  </button>
                )) : (
                  <EmptyState
                    action={<Button onClick={() => openCost(section.type)} variant="secondary">Add {section.type} cost</Button>}
                    description={section.type === 'monthly' ? 'Rent, software and monthly operations will appear here.' : 'Taxes, insurance and less frequent commitments will appear here.'}
                    icon={section.type === 'monthly' ? 'receipt' : 'calendar'}
                    title={`No ${section.type} costs`}
                  />
                )}
              </div>
            </Card>
          ))}
        </div>
        </section>
      ) : null}

      <Modal description={editingMoneyMovementId ? 'Update this account movement.' : moneyMovementForm.transactionType === 'income' ? 'Record money added to an account.' : 'Record money removed from an account.'} onClose={() => { setMoneyMovementOpen(false); setEditingMoneyMovementId(null); }} open={moneyMovementOpen} title={editingMoneyMovementId ? 'Edit money movement' : moneyMovementForm.transactionType === 'income' ? 'Add money' : 'Remove money'}>
        <form className="rm-action-form" onSubmit={(event) => {
          event.preventDefault();
          void runForm(
            editingMoneyMovementId
              ? onUpdateMoneyMovement
                ? () => onUpdateMoneyMovement({ ...moneyMovementForm, movementId: editingMoneyMovementId })
                : undefined
              : onCreateMoneyMovement
                ? () => onCreateMoneyMovement(moneyMovementForm)
                : undefined,
            editingMoneyMovementId ? 'Money movement updated.' : moneyMovementForm.transactionType === 'income' ? 'Money added.' : 'Money removed.',
            () => { setMoneyMovementOpen(false); setEditingMoneyMovementId(null); },
          );
        }}>
          {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
          <label className="rm-field"><span>Description</span><input autoFocus onChange={(event) => setMoneyMovementForm((current) => ({ ...current, description: event.target.value }))} placeholder={moneyMovementForm.transactionType === 'income' ? 'Client payment, reimbursement, or other addition' : 'Cash withdrawal, purchase, or other removal'} required value={moneyMovementForm.description} /></label>
          <label className="rm-field">
            <span>{moneyMovementForm.transactionType === 'income' ? 'Add to account' : 'Remove from account'}</span>
            <select
              onChange={(event) => setMoneyMovementForm((current) => ({ ...current, accountId: event.target.value }))}
              required
              value={moneyMovementForm.accountId}
            >
              <option value="">Choose account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {formatRon(account.currentBalance)}
                </option>
              ))}
            </select>
          </label>
          <div className="rm-form-grid rm-form-grid--two">
            <label className="rm-field"><span>Amount (RON)</span><input inputMode="decimal" min="0.01" onChange={(event) => setMoneyMovementForm((current) => ({ ...current, amount: event.target.value }))} required step="0.01" type="number" value={moneyMovementForm.amount} /></label>
            <label className="rm-field"><span>Date</span><input onChange={(event) => setMoneyMovementForm((current) => ({ ...current, occurredOn: event.target.value }))} required type="date" value={moneyMovementForm.occurredOn} /></label>
          </div>
          <label className="rm-field"><span>Counterparty</span><input onChange={(event) => setMoneyMovementForm((current) => ({ ...current, counterparty: event.target.value }))} placeholder={moneyMovementForm.transactionType === 'income' ? 'Client or source' : 'Vendor or recipient'} value={moneyMovementForm.counterparty} /></label>
          {!accounts.length ? <div className="rm-feedback rm-feedback--error" role="alert">Add an account before recording money movement.</div> : null}
          <footer className="rm-dialog-actions"><Button disabled={saving} onClick={() => { setMoneyMovementOpen(false); setEditingMoneyMovementId(null); }} variant="secondary">Cancel</Button><Button disabled={saving || !moneyMovementForm.accountId || !moneyMovementForm.amount || !moneyMovementForm.description.trim()} type="submit">{saving ? 'Saving…' : editingMoneyMovementId ? 'Save movement' : moneyMovementForm.transactionType === 'income' ? 'Add money' : 'Remove money'}</Button></footer>
        </form>
      </Modal>

      <Modal
        description="Bank and cash accounts combine into the current liquid cash shown across the owner workspace."
        onClose={() => setAccountOpen(false)}
        open={accountOpen}
        title={accountForm.accountId ? 'Edit account' : 'Add account'}
      >
        <form className="rm-action-form" onSubmit={(event) => {
          event.preventDefault();
          void runForm(
            onUpsertAccount ? () => onUpsertAccount(accountForm) : undefined,
            accountForm.accountId ? 'Account updated.' : 'Account added.',
            () => setAccountOpen(false),
          );
        }}>
          {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
          <label className="rm-field"><span>Account name</span><input autoFocus onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} placeholder="Banca Transilvania · Operating" required value={accountForm.name} /></label>
          <div className="rm-form-grid rm-form-grid--two">
            <label className="rm-field"><span>Account type</span><select onChange={(event) => setAccountForm((current) => ({ ...current, accountType: event.target.value as FinanceAccountSummary['accountType'] }))} value={accountForm.accountType}><option value="bank">Bank account</option><option value="cash">Cash</option><option value="savings">Savings</option><option value="other">Other liquid account</option></select></label>
            <label className="rm-field"><span>Current balance (RON)</span><input inputMode="decimal" min="0" onChange={(event) => setAccountForm((current) => ({ ...current, currentBalance: event.target.value }))} required step="0.01" type="number" value={accountForm.currentBalance} /></label>
          </div>
          <label className="rm-field"><span>Institution</span><input onChange={(event) => setAccountForm((current) => ({ ...current, institutionName: event.target.value }))} placeholder="Bank, safe, office cash" value={accountForm.institutionName} /></label>
          <label className="rm-field"><span>Reference</span><input onChange={(event) => setAccountForm((current) => ({ ...current, accountReference: event.target.value }))} placeholder="Optional IBAN ending or label" value={accountForm.accountReference} /></label>
          <label className="rm-field"><span>Notes</span><textarea onChange={(event) => setAccountForm((current) => ({ ...current, notes: event.target.value }))} rows={3} value={accountForm.notes} /></label>
          <footer className="rm-dialog-actions"><Button disabled={saving} onClick={() => setAccountOpen(false)} variant="secondary">Cancel</Button><Button disabled={saving || !accountForm.name.trim()} type="submit">{saving ? 'Saving…' : accountForm.accountId ? 'Save account' : 'Add account'}</Button></footer>
        </form>
      </Modal>

      <Modal description={editingDebtId ? 'Update the debt while preserving every recorded payment.' : 'Track an amount Realty Media owes or is owed.'} onClose={() => setDebtOpen(false)} open={debtOpen} title={editingDebtId ? 'Edit debt' : 'Add debt'}>
        <form className="rm-action-form" onSubmit={(event) => {
          event.preventDefault();
          void runForm(
            editingDebtId
              ? onUpdateDebt ? () => onUpdateDebt({ ...debtForm, debtId: editingDebtId }) : undefined
              : onAddDebt ? () => onAddDebt(debtForm) : undefined,
            editingDebtId ? 'Debt updated.' : 'Debt added.',
            () => { setDebtOpen(false); setEditingDebtId(null); },
          );
        }}>
          {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
          <label className="rm-field"><span>Counterparty</span><input onChange={(event) => setDebtForm((current) => ({ ...current, counterparty: event.target.value }))} required value={debtForm.counterparty} /></label>
          <div className="rm-form-grid rm-form-grid--two">
            <label className="rm-field"><span>Amount (RON)</span><input inputMode="decimal" min="0.01" onChange={(event) => setDebtForm((current) => ({ ...current, amount: event.target.value }))} required step="0.01" type="number" value={debtForm.amount} /></label>
            <label className="rm-field"><span>Direction</span><select onChange={(event) => setDebtForm((current) => ({ ...current, direction: event.target.value as CreateDebtInput['direction'] }))} value={debtForm.direction}><option value="payable">Realty Media owes</option><option value="receivable">Owed to Realty Media</option></select></label>
          </div>
          <label className="rm-field"><span>Due date</span><input onChange={(event) => setDebtForm((current) => ({ ...current, dueOn: event.target.value }))} type="date" value={debtForm.dueOn} /></label>
          <label className="rm-field"><span>Note</span><textarea onChange={(event) => setDebtForm((current) => ({ ...current, note: event.target.value }))} rows={3} value={debtForm.note} /></label>
          <footer className="rm-dialog-actions"><Button disabled={saving} onClick={() => { setDebtOpen(false); setEditingDebtId(null); }} variant="secondary">Cancel</Button><Button disabled={saving || !debtForm.amount || !debtForm.counterparty.trim()} type="submit">{saving ? 'Saving…' : editingDebtId ? 'Save debt' : 'Add debt'}</Button></footer>
        </form>
      </Modal>

      <Modal description={costForm.costId ? 'Update this repeating operating commitment.' : 'Add a repeating operating commitment.'} onClose={() => setCostOpen(false)} open={costOpen} title={costForm.costId ? 'Edit cost' : 'Add recurring cost'}>
        <form className="rm-action-form" onSubmit={(event) => {
          event.preventDefault();
          void runForm(
            costForm.costId
              ? onUpdateCost
                ? () => onUpdateCost({ ...costForm, costId: costForm.costId! })
                : undefined
              : onAddCost
                ? () => onAddCost(costForm)
                : undefined,
            costForm.costId ? 'Cost updated.' : 'Recurring cost added.',
            () => setCostOpen(false),
          );
        }}>
          {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
          <label className="rm-field"><span>Cost name</span><input onChange={(event) => setCostForm((current) => ({ ...current, name: event.target.value }))} placeholder="Adobe Creative Cloud" required value={costForm.name} /></label>
          <div className="rm-form-grid rm-form-grid--two">
            <label className="rm-field"><span>Amount (RON)</span><input inputMode="decimal" min="0.01" onChange={(event) => setCostForm((current) => ({ ...current, amount: event.target.value }))} required step="0.01" type="number" value={costForm.amount} /></label>
            <label className="rm-field"><span>Frequency</span><select onChange={(event) => setCostForm((current) => ({ ...current, frequency: event.target.value as CreateCostInput['frequency'] }))} value={costForm.frequency}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></label>
            <label className="rm-field"><span>Starts on</span><input onChange={(event) => setCostForm((current) => ({ ...current, startsOn: event.target.value }))} required type="date" value={costForm.startsOn} /></label>
            <label className="rm-field"><span>Next due</span><input min={costForm.startsOn} onChange={(event) => setCostForm((current) => ({ ...current, nextDueOn: event.target.value }))} required type="date" value={costForm.nextDueOn} /></label>
          </div>
          <label className="rm-field"><span>Vendor</span><input onChange={(event) => setCostForm((current) => ({ ...current, vendor: event.target.value }))} value={costForm.vendor} /></label>
          <label className="rm-field"><span>Notes</span><textarea onChange={(event) => setCostForm((current) => ({ ...current, notes: event.target.value }))} rows={3} value={costForm.notes} /></label>
          <footer className="rm-dialog-actions"><Button disabled={saving} onClick={() => setCostOpen(false)} variant="secondary">Cancel</Button><Button disabled={saving || !costForm.amount || !costForm.name.trim()} type="submit">{saving ? 'Saving…' : costForm.costId ? 'Save cost' : 'Add cost'}</Button></footer>
        </form>
      </Modal>

      <Modal description={selectedDebt?.note} onClose={() => setSelectedDebt(null)} open={Boolean(selectedDebt)} title={`Record payment · ${selectedDebt?.name ?? ''}`}>
        <form className="rm-action-form" onSubmit={(event) => {
          event.preventDefault();
          void runForm(
            selectedDebt && onRecordDebtPayment ? () => onRecordDebtPayment(selectedDebt.id, debtPayment.amount, debtPayment.note) : undefined,
            'Debt payment recorded.',
            () => setSelectedDebt(null),
          );
        }}>
          {formError ? <div className="rm-feedback rm-feedback--error" role="alert">{formError}</div> : null}
          <label className="rm-field"><span>Payment amount (RON)</span><input inputMode="decimal" max={selectedDebt ? selectedDebt.amount - selectedDebt.paid : undefined} min="0.01" onChange={(event) => setDebtPayment((current) => ({ ...current, amount: event.target.value }))} required step="0.01" type="number" value={debtPayment.amount} /></label>
          <label className="rm-field"><span>Note</span><textarea onChange={(event) => setDebtPayment((current) => ({ ...current, note: event.target.value }))} rows={3} value={debtPayment.note} /></label>
          <footer className="rm-dialog-actions"><Button disabled={saving} onClick={() => setSelectedDebt(null)} variant="secondary">Cancel</Button><Button disabled={saving || !debtPayment.amount} type="submit">{saving ? 'Saving…' : 'Record payment'}</Button></footer>
        </form>
      </Modal>

      <Modal description={`${selectedCost?.frequency ?? ''} · ${selectedCost ? formatRon(selectedCost.amount) : ''}`} onClose={() => setSelectedCost(null)} open={Boolean(selectedCost)} title={selectedCost?.name ?? 'Recurring cost'}>
        {selectedCost ? (
          <div className="rm-action-form">
            <dl className="rm-detail-list">
              <div><dt>Next due</dt><dd>{selectedCost.due}</dd></div>
              <div><dt>Status</dt><dd>{selectedCost.paid ? 'Paid' : 'Upcoming'}</dd></div>
              <div><dt>Annualized</dt><dd>{formatRon(annualizedCost(selectedCost))}</dd></div>
            </dl>
            <footer className="rm-dialog-actions">
              <Button onClick={() => editCost(selectedCost)} variant="secondary">Edit cost</Button>
              <Button onClick={() => void toggleCost(selectedCost)} variant="secondary">{selectedCost.paid ? 'Mark upcoming' : 'Mark paid'}</Button>
              <Button
                onClick={() => void runForm(
                  onArchiveCost ? () => onArchiveCost(selectedCost.id) : undefined,
                  'Recurring cost deleted.',
                  () => setSelectedCost(null),
                )}
              >
                Delete cost
              </Button>
            </footer>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
