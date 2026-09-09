import { Fragment, useState } from 'react';
import { Image } from 'expo-image';
import {
  Alert,
  Linking,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import {
  NativeCard,
  NativeButton,
  NativeEmptyState,
  NativeListRow,
  NativeScreen,
  NativeSection,
  NativeSeparator,
  NativeTaskCard,
  StatusPill,
  Text,
  nativeColors,
  type AppRole,
  type NativeStatusTone,
  useNativeWideLayout,
} from '@/components/native';
import { nativeStatusLabel, nativeText, type NativeLocale } from '@/lib/native-i18n';
import { taskBoardStatus } from '@/lib/task-presentation';
import type {
  ClientSummary,
  CompanyDocumentSummary,
  CreateMoneyMovementInput,
  FinanceAccountSummary,
  FinanceMoneyMovementItem,
  GearItem,
  PortalData,
  TaskSummary,
  UpdateMoneyMovementInput,
  UpsertFinanceAccountInput,
} from '@/screens/web/types';
import { demoClients, demoTasks } from '@/screens/web/demoData';

import { DocumentsNativeScreen } from './documents-screen';

export type MoreDestination =
  | 'availability'
  | 'analytics'
  | 'clients'
  | 'deal'
  | 'documents'
  | 'files'
  | 'finance'
  | 'gear'
  | 'help'
  | 'members'
  | 'notifications'
  | 'profile'
  | 'team'
  | 'tasks';

export const moreDestinationTitles: Record<MoreDestination, string> = {
  availability: 'Availability',
  analytics: 'Social Analytics',
  clients: 'Clients',
  deal: 'Deal & Payments',
  documents: 'Documents',
  files: 'Shared Files',
  finance: 'Finance',
  gear: 'Gear',
  help: 'Help & Support',
  members: 'Account Members',
  notifications: 'Notifications',
  profile: 'Profile',
  team: 'Team',
  tasks: 'Tasks',
};

export function isMoreDestination(value: string): value is MoreDestination {
  return value in moreDestinationTitles;
}

export function canOpenMoreDestination(
  role: AppRole,
  destination: MoreDestination,
) {
  if (
    destination === 'profile' ||
    destination === 'notifications' ||
    destination === 'help'
  ) {
    return true;
  }

  return {
    admin: ['clients', 'analytics', 'tasks', 'finance', 'gear', 'team', 'documents'],
    client: [] as MoreDestination[],
    team_member: ['tasks'],
  }[role].includes(destination);
}

function currency(amount: number, code = 'RON') {
  return new Intl.NumberFormat('ro-RO', {
    currency: code,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount);
}

function toneForStatus(status: string): NativeStatusTone {
  if (
    status === 'active' ||
    status === 'available' ||
    status === 'paid' ||
    status === 'approved'
  ) {
    return 'success';
  }
  if (
    status === 'overdue' ||
    status === 'maintenance' ||
    status === 'suspended' ||
    status === 'needs_changes' ||
    status === 'blocked'
  ) {
    return 'critical';
  }
  if (status === 'in_progress') {
    return 'info';
  }
  if (
    status === 'due' ||
    status === 'invited' ||
    status === 'with_team' ||
    status === 'on_site'
  ) {
    return 'warning';
  }
  return 'neutral';
}

function labelForStatus(status: string) {
  return status
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function EmptyRows({
  message,
  symbol,
  title,
}: {
  message: string;
  symbol: string;
  title: string;
}) {
  return (
    <NativeCard>
      <NativeEmptyState compact message={message} symbol={symbol} title={title} />
    </NativeCard>
  );
}

function taskDueLabel(value?: string) {
  if (!value) return 'No deadline';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function TasksContent({
  data,
  onPressTask,
  role,
  previewTasks,
  currentUserId,
}: {
  data?: PortalData;
  onPressTask?: (task: TaskSummary) => void;
  role: AppRole;
  previewTasks?: readonly TaskSummary[];
  currentUserId?: string;
}) {
  const isWide = useNativeWideLayout();
  const [assigneeFilter, setAssigneeFilter] = useState<'mine' | 'all'>('mine');
  const tasks = data
    ? (data.tasks ?? [])
    : (previewTasks ?? demoTasks);
  const visibleTasks = role === 'team_member'
    ? tasks.filter((task) => Boolean(currentUserId) && task.assigneeUserId === currentUserId)
    : role === 'admin' && currentUserId && assigneeFilter === 'mine'
      ? tasks.filter((task) => task.assigneeUserId === currentUserId)
      : tasks;
  const completedTasks = visibleTasks.filter(
    (task) => task.status === 'done' || task.status === 'cancelled',
  );
  const newTasks = visibleTasks.filter(
    (task) => task.status === 'todo' || task.status === 'blocked',
  );
  const inProgressTasks = visibleTasks.filter((task) => task.status === 'in_progress');

  const taskCards = (items: typeof tasks) => (
    <View style={styles.taskCardStack}>
      {items.map((task) => (
        <NativeTaskCard
          accessibilityHint={onPressTask ? 'Opens task preview' : undefined}
          key={task.id}
          onPress={onPressTask ? () => onPressTask(task) : undefined}
          propertyName={task.propertyName}
          meta={`${task.assigneeName || 'Unassigned'} · ${taskDueLabel(task.dueAt)}`}
          status={taskBoardStatus(task.status)}
          title={task.title}
          urgent={task.priority === 'urgent'}
        />
      ))}
    </View>
  );

  const filterSection = role === 'admin' && currentUserId ? (
    <View accessibilityLabel="Task assignee filter" style={styles.taskFilters}>
      <NativeButton
        label="My tasks"
        onPress={() => setAssigneeFilter('mine')}
        style={styles.taskFilterButton}
        variant={assigneeFilter === 'mine' ? 'primary' : 'secondary'}
      />
      <NativeButton
        label="Everyone"
        onPress={() => setAssigneeFilter('all')}
        style={styles.taskFilterButton}
        variant={assigneeFilter === 'all' ? 'primary' : 'secondary'}
      />
    </View>
  ) : null;

  const taskSection = (
    items: typeof tasks,
    title: string,
  ) => (
    <NativeSection
      caption={`${items.length} task${items.length === 1 ? '' : 's'}`}
      title={title}
    >
      {items.length ? taskCards(items) : (
        <EmptyRows
          message={role === 'team_member' ? 'Tasks assigned to you will appear here.' : 'Tasks will appear here.'}
          symbol="checklist"
          title="Nothing here"
        />
      )}
    </NativeSection>
  );
  const newSection = taskSection(newTasks, 'New tasks');
  const inProgressSection = taskSection(inProgressTasks, 'In progress');
  const doneSection = taskSection(completedTasks, 'Completed');

  return isWide ? (
    <View style={styles.taskScreen}>
      {filterSection}
      <View style={styles.destinationWideColumns}>
        <View style={styles.destinationWideColumn}>{newSection}</View>
        <View style={styles.destinationWideColumn}>{inProgressSection}</View>
        <View style={styles.destinationWideColumn}>{doneSection}</View>
      </View>
    </View>
  ) : (
    <>
      {filterSection}
      {newSection}
      {inProgressSection}
      {doneSection}
    </>
  );
}

function ClientsContent({
  data,
  onPressClient,
}: {
  data?: PortalData;
  onPressClient?: (client: ClientSummary) => void;
}) {
  const clients = data === undefined ? demoClients : (data.clients ?? []);

  return (
    <NativeSection
      caption={`${clients.length} active ${clients.length === 1 ? 'account' : 'accounts'}`}
      title="Client accounts"
    >
      {clients.length ? (
        <NativeCard>
          {clients.map((client, index) => (
            <Fragment key={client.id}>
              {index ? <NativeSeparator inset={60} /> : null}
              <NativeListRow
                accessibilityHint="Opens this client account"
                detail={`${client.propertiesCount} ${client.propertiesCount === 1 ? 'property' : 'properties'} · ${currency(client.monthlyPrice)}/month`}
                onPress={
                  onPressClient ? () => onPressClient(client) : undefined
                }
                subtitle={[client.contactName, client.location]
                  .filter(Boolean)
                  .join(' · ')}
                symbol="person.crop.rectangle.stack"
                title={client.name}
                trailing={
                  <StatusPill
                    label={labelForStatus(client.status)}
                    tone={toneForStatus(client.status)}
                  />
                }
              />
            </Fragment>
          ))}
        </NativeCard>
      ) : (
        <EmptyRows
          message="Clients created in the admin web workspace will appear here."
          symbol="person.2"
          title="No clients yet"
        />
      )}
    </NativeSection>
  );
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value);
}

function viewsForAccount(
  account: { provider: 'Instagram' | 'TikTok'; metrics: readonly { date: string; views: number }[] },
  rangeStart: number,
) {
  const metrics = account.metrics.filter(
    (metric) => new Date(metric.date).valueOf() >= rangeStart,
  );
  if (account.provider === 'TikTok') {
    return [...metrics].sort((left, right) => left.date.localeCompare(right.date)).at(-1)?.views ?? 0;
  }
  return metrics.reduce((sum, metric) => sum + metric.views, 0);
}

function InstagramAnalyticsContent({
  clientAccountId,
  data,
}: {
  clientAccountId?: string | null;
  data?: PortalData;
}) {
  const accounts = [
    ...(data?.instagramAccounts ?? []).map((account) => ({ ...account, provider: 'Instagram' as const })),
    ...(data?.tiktokAccounts ?? []).map((account) => ({ ...account, provider: 'TikTok' as const })),
  ].filter((account) => !clientAccountId || account.clientId === clientAccountId);
  const [rangeStart] = useState(
    () => Date.now() - 30 * 24 * 60 * 60 * 1000,
  );
  const followers = accounts.reduce((sum, account) => {
    const latest = [...account.metrics]
      .reverse()
      .find((metric) => metric.followers !== null)?.followers;
    return sum + (latest ?? 0);
  }, 0);
  const views = accounts.reduce(
    (sum, account) =>
      sum + viewsForAccount(account, rangeStart),
    0,
  );
  const media = accounts
    .flatMap((account) =>
      account.media.map((item) => ({
        ...item,
        accountUsername: account.username,
        provider: account.provider,
      })),
    )
    .filter(
      (item) =>
        !item.postedAt || new Date(item.postedAt).valueOf() >= rangeStart,
    )
    .sort((left, right) =>
      (right.postedAt ?? '').localeCompare(left.postedAt ?? ''),
    );
  const interactions = media.reduce(
    (sum, item) => sum + item.totalInteractions,
    0,
  );

  if (!accounts.length) {
    return (
      <NativeSection title="Social analytics">
        <EmptyRows
          message="Connect Instagram or TikTok from the Realty Media web app."
          symbol="chart.xyaxis.line"
          title="No account connected"
        />
      </NativeSection>
    );
  }

  return (
    <>
      <NativeSection caption="Connected social profile results" title="Last 30 days">
        <NativeCard>
          <NativeListRow
            detail="Current audience"
            showChevron={false}
            symbol="person.2"
            title="Followers"
            trailing={<Text style={styles.value}>{compactNumber(followers)}</Text>}
          />
          <NativeSeparator inset={60} />
          <NativeListRow
            detail="Video and content views"
            showChevron={false}
            symbol="play.rectangle"
            title="Views"
            trailing={<Text style={styles.value}>{compactNumber(views)}</Text>}
          />
          <NativeSeparator inset={60} />
          <NativeListRow
            detail={`${media.length} post${media.length === 1 ? '' : 's'} in range`}
            showChevron={false}
            symbol="heart"
            title="Interactions"
            trailing={
              <Text style={styles.value}>{compactNumber(interactions)}</Text>
            }
          />
        </NativeCard>
      </NativeSection>

      <NativeSection
        caption="Connections are managed on the web app"
        title="Connected accounts"
      >
        <NativeCard>
          {accounts.map((account, index) => (
            <Fragment key={account.id}>
              {index ? <NativeSeparator inset={60} /> : null}
              <NativeListRow
                detail={`${account.provider} · ${account.clientName} · ${
                  account.lastSyncedAt
                    ? `Updated ${new Intl.DateTimeFormat('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      }).format(new Date(account.lastSyncedAt))}`
                    : 'Sync pending'
                }`}
                showChevron={false}
                subtitle={account.displayName}
                symbol="camera.filters"
                title={`@${account.username}`}
                trailing={
                  <StatusPill
                    label={
                      account.status === 'active'
                        ? 'Connected'
                        : account.status === 'needs_reauth'
                          ? 'Reconnect'
                          : 'Sync issue'
                    }
                    tone={
                      account.status === 'active'
                        ? 'success'
                        : account.status === 'needs_reauth'
                          ? 'critical'
                          : 'warning'
                    }
                  />
                }
              />
            </Fragment>
          ))}
        </NativeCard>
      </NativeSection>

      <NativeSection title="Recent content">
        {media.length ? (
          <NativeCard>
            {media.slice(0, 12).map((item, index) => (
              <Fragment key={item.id}>
                {index ? <NativeSeparator inset={60} /> : null}
                <NativeListRow
                  detail={`${compactNumber(item.views)} views · ${compactNumber(item.totalInteractions)} interactions`}
                  disabled={!item.permalink}
                  onPress={
                    item.permalink
                      ? () => void Linking.openURL(item.permalink as string)
                      : undefined
                  }
                  showChevron={Boolean(item.permalink)}
                  subtitle={`@${item.accountUsername}${
                    item.postedAt
                      ? ` · ${new Intl.DateTimeFormat('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        }).format(new Date(item.postedAt))}`
                      : ''
                  }`}
                  symbol="photo"
                  title={item.caption || `${item.provider} post`}
                />
              </Fragment>
            ))}
          </NativeCard>
        ) : (
          <EmptyRows
            message="No posts were returned for the last 30 days."
            symbol="photo.on.rectangle"
            title="No recent content"
          />
        )}
      </NativeSection>
    </>
  );
}

type FinanceAccountDraft = Omit<UpsertFinanceAccountInput, 'accountId'> & { accountId?: string };
type FinanceMovementDraft = Omit<CreateMoneyMovementInput, 'transactionType'> & {
  movementId?: string;
  transactionType: CreateMoneyMovementInput['transactionType'];
};

function FinanceField({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'decimal-pad' | 'numbers-and-punctuation';
}) {
  return (
    <View style={styles.financeField}>
      <Text style={styles.financeFieldLabel}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={nativeColors.tertiaryLabel}
        style={styles.financeInput}
        value={value}
      />
    </View>
  );
}

function FinanceContent({
  data,
  onSaveAccount,
  onSaveMovement,
}: {
  data?: PortalData;
  onSaveAccount?: (input: UpsertFinanceAccountInput) => Promise<void>;
  onSaveMovement?: (input: CreateMoneyMovementInput | UpdateMoneyMovementInput) => Promise<void>;
}) {
  const isWide = useNativeWideLayout();
  const [localAccounts, setLocalAccounts] = useState<FinanceAccountSummary[] | null>(null);
  const [localMovements, setLocalMovements] = useState<FinanceMoneyMovementItem[] | null>(null);
  const [accountEditor, setAccountEditor] = useState<FinanceAccountDraft | null>(null);
  const [movementEditor, setMovementEditor] = useState<FinanceMovementDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const accounts = localAccounts ?? data?.financeAccounts ?? [];
  const movements = localMovements ?? data?.financeMoneyMovements ?? [];
  const costs = data?.costs ?? [];
  const debts = data?.debts ?? [];
  const incomeTotal = movements
    .filter((item) => item.transactionType === 'income')
    .reduce((sum, item) => sum + item.amount, 0);
  const liquidCash = accounts.reduce(
    (sum, account) => sum + account.currentBalance,
    0,
  );
  const costTotal = costs.reduce((sum, item) => sum + item.amount, 0);
  const outstanding = debts.reduce(
    (sum, item) => sum + Math.max(0, item.amount - item.paid),
    0,
  );

  const startAccountEditor = (account?: FinanceAccountSummary) => {
    setAccountEditor({
      accountId: account?.id,
      accountReference: account?.accountReference ?? '',
      accountType: account?.accountType ?? 'cash',
      currentBalance: String(account?.currentBalance ?? 0),
      institutionName: account?.institutionName ?? '',
      name: account?.name ?? '',
      notes: account?.notes ?? '',
    });
    setMovementEditor(null);
  };

  const startMovementEditor = (movement?: FinanceMoneyMovementItem) => {
    setMovementEditor({
      accountId: movement?.accountId ?? accounts[0]?.id ?? '',
      amount: String(movement?.amount ?? ''),
      counterparty: movement?.counterparty ?? '',
      description: movement?.description ?? '',
      occurredOn: movement?.date ?? new Date().toISOString().slice(0, 10),
      transactionType: movement?.transactionType ?? 'income',
      movementId: movement?.id,
    });
    setAccountEditor(null);
  };

  const saveAccount = async () => {
    if (!accountEditor?.name.trim()) return;
    setSaving(true);
    try {
      const input: UpsertFinanceAccountInput = accountEditor;
      if (onSaveAccount) await onSaveAccount(input);
      const nextAccount: FinanceAccountSummary = {
        accountReference: input.accountReference || undefined,
        accountType: input.accountType,
        currency: 'RON',
        currentBalance: Number(input.currentBalance) || 0,
        id: input.accountId ?? `local-account-${Date.now()}`,
        institutionName: input.institutionName || undefined,
        name: input.name,
        notes: input.notes || undefined,
        openingBalance: Number(input.currentBalance) || 0,
      };
      setLocalAccounts((current) => {
        const base = current ?? accounts;
        return input.accountId
          ? base.map((account) => account.id === input.accountId ? { ...account, ...nextAccount } : account)
          : [...base, nextAccount];
      });
      setAccountEditor(null);
    } catch (error) {
      Alert.alert('Could not save account', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveMovement = async () => {
    if (!movementEditor?.accountId || !movementEditor.description.trim()) return;
    setSaving(true);
    try {
      const input = movementEditor.movementId
        ? movementEditor as UpdateMoneyMovementInput
        : movementEditor as CreateMoneyMovementInput;
      if (onSaveMovement) await onSaveMovement(input);
      const accountName = accounts.find((account) => account.id === input.accountId)?.name ?? 'Account';
      const movementId = 'movementId' in input
        ? (input as UpdateMoneyMovementInput).movementId
        : undefined;
      const nextMovement: FinanceMoneyMovementItem = {
        accountId: input.accountId,
        accountName,
        amount: Number(input.amount) || 0,
        counterparty: input.counterparty || undefined,
        date: input.occurredOn,
        description: input.description,
        id: movementId ?? `local-movement-${Date.now()}`,
        transactionType: input.transactionType,
      };
      setLocalMovements((current) => {
        const base = current ?? movements;
        return movementId
          ? base.map((movement) => movement.id === movementId ? nextMovement : movement)
          : [nextMovement, ...base];
      });
      setMovementEditor(null);
    } catch (error) {
      Alert.alert('Could not save transaction', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const accountEditorSection = accountEditor ? (
    <NativeSection title={accountEditor.accountId ? 'Edit account' : 'New account'}>
      <NativeCard style={styles.financeEditor}>
        <FinanceField label="Name" onChangeText={(value) => setAccountEditor((current) => current && { ...current, name: value })} value={accountEditor.name} />
        <FinanceField label="Institution" onChangeText={(value) => setAccountEditor((current) => current && { ...current, institutionName: value })} value={accountEditor.institutionName} />
        <FinanceField keyboardType="decimal-pad" label="Current balance" onChangeText={(value) => setAccountEditor((current) => current && { ...current, currentBalance: value })} value={accountEditor.currentBalance} />
        <View style={styles.financeActions}>
          <NativeButton label="Cancel" onPress={() => setAccountEditor(null)} variant="secondary" />
          <NativeButton label="Save account" loading={saving} onPress={() => void saveAccount()} />
        </View>
      </NativeCard>
    </NativeSection>
  ) : null;

  const movementEditorSection = movementEditor ? (
    <NativeSection title={movementEditor.movementId ? 'Edit transaction' : 'New transaction'}>
      <NativeCard style={styles.financeEditor}>
        <View style={styles.financeActions}>
          <NativeButton label="Income" onPress={() => setMovementEditor((current) => current && { ...current, transactionType: 'income' })} variant={movementEditor.transactionType === 'income' ? 'primary' : 'secondary'} />
          <NativeButton label="Expense" onPress={() => setMovementEditor((current) => current && { ...current, transactionType: 'expense' })} variant={movementEditor.transactionType === 'expense' ? 'primary' : 'secondary'} />
        </View>
        <FinanceField keyboardType="decimal-pad" label="Amount" onChangeText={(value) => setMovementEditor((current) => current && { ...current, amount: value })} value={movementEditor.amount} />
        <FinanceField label="Description" onChangeText={(value) => setMovementEditor((current) => current && { ...current, description: value })} value={movementEditor.description} />
        <FinanceField label="Date (YYYY-MM-DD)" onChangeText={(value) => setMovementEditor((current) => current && { ...current, occurredOn: value })} value={movementEditor.occurredOn} />
        <View style={styles.financeActions}>
          <NativeButton label="Cancel" onPress={() => setMovementEditor(null)} variant="secondary" />
          <NativeButton label="Save transaction" loading={saving} onPress={() => void saveMovement()} />
        </View>
      </NativeCard>
    </NativeSection>
  ) : null;

  const snapshotSection = (
    <NativeSection title="Business snapshot">
      <NativeCard>
        <NativeListRow
          detail={`${accounts.length} active ${accounts.length === 1 ? 'account' : 'accounts'}`}
          showChevron={false}
          symbol="banknote"
          symbolColor={nativeColors.success}
          title="Current liquid cash"
          trailing={<Text style={styles.value}>{currency(liquidCash)}</Text>}
        />
        <NativeSeparator inset={60} />
        <NativeListRow
          detail="Recorded manually"
          showChevron={false}
          symbol="arrow.down.circle"
          title="Income"
          trailing={<Text style={styles.value}>{currency(incomeTotal)}</Text>}
        />
        <NativeSeparator inset={60} />
        <NativeListRow
          detail="Current recurring costs"
          showChevron={false}
          symbol="repeat"
          title="Recurring costs"
          trailing={<Text style={styles.value}>{currency(costTotal)}</Text>}
        />
        <NativeSeparator inset={60} />
        <NativeListRow
          detail="Remaining debt balance"
          showChevron={false}
          symbol="creditcard"
          title="Outstanding debts"
          trailing={<Text style={styles.value}>{currency(outstanding)}</Text>}
        />
      </NativeCard>
    </NativeSection>
  );
  const accountsSection = (
    <NativeSection actionLabel="Add account" onPressAction={() => startAccountEditor()} title="Accounts">
      <NativeCard>
        {accounts.map((account, index) => (
          <Fragment key={account.id}>
            {index ? <NativeSeparator inset={60} /> : null}
            <NativeListRow
              detail={account.institutionName ?? labelForStatus(account.accountType)}
              onPress={() => startAccountEditor(account)}
              symbol={account.accountType === 'cash' ? 'banknote' : 'building.columns'}
              title={account.name}
              trailing={
                <Text style={styles.value}>
                  {currency(account.currentBalance)}
                </Text>
              }
            />
          </Fragment>
        ))}
      </NativeCard>
    </NativeSection>
  );
  const movementsSection = (
    <NativeSection actionLabel="Add transaction" onPressAction={() => startMovementEditor()} title="Money movements">
      {movements.length ? (
        <NativeCard>
          {movements.slice(0, 12).map((movement, index) => (
            <Fragment key={movement.id}>
              {index ? <NativeSeparator inset={60} /> : null}
              <NativeListRow
                detail={`${movement.accountName} · ${movement.date}`}
                onPress={() => startMovementEditor(movement)}
                symbol={movement.transactionType === 'income' ? 'arrow.down.circle' : 'arrow.up.circle'}
                symbolColor={movement.transactionType === 'income' ? nativeColors.success : nativeColors.critical}
                title={movement.description}
                trailing={<Text style={styles.value}>{currency(movement.amount)}</Text>}
              />
            </Fragment>
          ))}
        </NativeCard>
      ) : (
        <EmptyRows message="Add income and expenses to keep the workspace current." symbol="banknote" title="No transactions yet" />
      )}
    </NativeSection>
  );

  if (isWide) {
    return (
      <View style={styles.destinationWideColumns}>
        <View style={styles.destinationWideColumn}>
          {snapshotSection}
          <View style={styles.destinationStackItem}>{accountsSection}</View>
        </View>
        <View style={styles.destinationWideColumn}>
          {accountEditorSection}
          {movementEditorSection}
          {movementsSection}
        </View>
      </View>
    );
  }

  return (
    <>
      {snapshotSection}
      {accountsSection}
      {accountEditorSection}
      {movementEditorSection}
      {movementsSection}
    </>
  );
}

function GearContent({
  data,
  onPressGear,
}: {
  data?: PortalData;
  onPressGear?: (item: GearItem) => void;
}) {
  const gear = data?.gear ?? [];
  return (
    <NativeSection caption={`${gear.length} tracked item${gear.length === 1 ? '' : 's'}`} title="Inventory">
      {gear.length ? (
        <NativeCard>
          {gear.map((item, index) => (
            <Fragment key={item.id}>
              {index ? <NativeSeparator inset={60} /> : null}
              <NativeListRow
                detail={`${item.location} · ${item.serial || 'No serial'}`}
                onPress={onPressGear ? () => onPressGear(item) : undefined}
                showChevron={Boolean(onPressGear)}
                symbol={
                  item.category === 'camera'
                    ? 'camera'
                    : item.category === 'audio'
                      ? 'waveform'
                      : 'shippingbox'
                }
                title={item.name}
                trailing={
                  <StatusPill
                    label={labelForStatus(item.status)}
                    tone={toneForStatus(item.status)}
                  />
                }
              />
            </Fragment>
          ))}
        </NativeCard>
      ) : (
        <EmptyRows
          message="Add gear from the admin web app to track it here."
          symbol="camera"
          title="No gear tracked"
        />
      )}
    </NativeSection>
  );
}

function TeamContent({ data }: { data?: PortalData }) {
  const members = data?.agencyMembers ?? [];
  const assignments = data?.propertyAssignments ?? [];
  return (
    <NativeSection caption="Access changes remain available on the web app" title="Realty Media team">
      {members.length ? (
        <NativeCard>
          {members.map((member, index) => (
            <Fragment key={member.id}>
              {index ? <NativeSeparator inset={60} /> : null}
              <NativeListRow
                detail={`${member.email} · ${
                  member.role === 'admin'
                    ? 'All properties'
                    : `${assignments.filter((assignment) => assignment.userId === member.userId).length} assigned`
                }`}
                showChevron={false}
                subtitle={member.title ?? labelForStatus(member.role)}
                symbol={member.role === 'admin' ? 'person.badge.key' : 'person'}
                title={member.name}
                trailing={
                  <View style={styles.memberTrailing}>
                    {member.avatarUrl ? (
                      <Image
                        accessibilityLabel={`${member.name} profile photo`}
                        contentFit="cover"
                        source={member.avatarUrl}
                        style={styles.memberAvatar}
                      />
                    ) : (
                      <View style={styles.memberAvatarFallback}>
                        <Text style={styles.memberAvatarInitials}>
                          {member.name
                            .trim()
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((part) => part.charAt(0).toUpperCase())
                            .join('')}
                        </Text>
                      </View>
                    )}
                    <StatusPill
                      label={labelForStatus(member.status)}
                      tone={toneForStatus(member.status)}
                    />
                  </View>
                }
              />
            </Fragment>
          ))}
        </NativeCard>
      ) : (
        <EmptyRows
          message="Team accounts created on the web app will appear here."
          symbol="person.2"
          title="No team members"
        />
      )}
    </NativeSection>
  );
}

function AvailabilityContent({ data }: { data?: PortalData }) {
  const today = new Date().toISOString().slice(0, 10);
  const events = (data?.calendarEvents ?? []).filter((event) => event.date >= today);
  return (
    <NativeSection
      caption="Your live Realty Media schedule"
      title="Upcoming commitments"
    >
      {events.length ? (
        <NativeCard>
          {events.map((event, index) => (
            <Fragment key={event.id}>
              {index ? <NativeSeparator inset={60} /> : null}
              <NativeListRow
                detail={`${event.date} · ${event.start || 'All day'}${event.location ? ` · ${event.location}` : ''}`}
                showChevron={false}
                subtitle={event.propertyName}
                symbol={event.type === 'shoot' ? 'camera' : 'calendar'}
                title={event.title}
              />
            </Fragment>
          ))}
        </NativeCard>
      ) : (
        <EmptyRows
          message="Assigned shoots and deadlines will appear here."
          symbol="calendar.badge.clock"
          title="Your schedule is clear"
        />
      )}
    </NativeSection>
  );
}

function FilesContent({ data }: { data?: PortalData }) {
  const files = data?.reviews ?? [];
  return files.length ? (
    <NativeCard>
      {files.map((file, index) => (
        <Fragment key={file.id}>
          {index ? <NativeSeparator inset={60} /> : null}
          <NativeListRow
            accessibilityHint={
              file.fileUrl ? 'Opens the latest file version' : undefined
            }
            detail={`${file.propertyName} · ${file.version}`}
            disabled={!file.fileUrl}
            onPress={
              file.fileUrl
                ? () => void Linking.openURL(file.fileUrl as string)
                : undefined
            }
            showChevron={Boolean(file.fileUrl)}
            symbol={file.mimeType?.startsWith('video') ? 'play.rectangle' : 'doc'}
            title={file.title}
            trailing={
              <StatusPill
                label={labelForStatus(file.status)}
                tone={toneForStatus(file.status)}
              />
            }
          />
        </Fragment>
      ))}
    </NativeCard>
  ) : (
    <EmptyRows
      message="Files shared with your account will appear here."
      symbol="folder"
      title="No shared files"
    />
  );
}

function MembersContent({
  clientAccountId,
  data,
}: {
  clientAccountId?: string | null;
  data?: PortalData;
}) {
  const members = (data?.clientMembers ?? []).filter(
    (member) => !clientAccountId || member.clientAccountId === clientAccountId,
  );
  return (
    <NativeSection caption="Invitations and access changes are managed on the web app" title="Your account">
      {members.length ? (
        <NativeCard>
          {members.map((member, index) => (
            <Fragment key={member.id}>
              {index ? <NativeSeparator inset={60} /> : null}
              <NativeListRow
                detail={member.email}
                showChevron={false}
                subtitle={labelForStatus(member.role)}
                symbol={member.role === 'owner' ? 'person.badge.key' : 'person'}
                title={member.name}
                trailing={
                  <StatusPill
                    label={labelForStatus(member.status)}
                    tone={toneForStatus(member.status)}
                  />
                }
              />
            </Fragment>
          ))}
        </NativeCard>
      ) : (
        <EmptyRows
          message="Client account members will appear here."
          symbol="person.2"
          title="No account members"
        />
      )}
    </NativeSection>
  );
}

function DealContent({
  clientAccountId,
  data,
  locale,
}: {
  clientAccountId?: string | null;
  data?: PortalData;
  locale: NativeLocale;
}) {
  const agreements = (data?.agreements ?? []).filter(
    (agreement) => !clientAccountId || agreement.clientId === clientAccountId,
  );
  return (
    <>
      <NativeSection title={nativeText(locale, 'currentAgreement')}>
        {agreements.length ? (
          <NativeCard>
            {agreements.map((agreement, index) => (
              <Fragment key={agreement.id}>
                {index ? <NativeSeparator inset={60} /> : null}
                <NativeListRow
                  detail={[
                    agreement.startsOn ? `${nativeText(locale, 'from')} ${agreement.startsOn}` : null,
                    agreement.endsOn ? `${nativeText(locale, 'to')} ${agreement.endsOn}` : null,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onPress={
                    agreement.fileUrl
                      ? () => void Linking.openURL(agreement.fileUrl as string)
                      : undefined
                  }
                  showChevron={Boolean(agreement.fileUrl)}
                  subtitle={`${currency(agreement.monthlyAmount, agreement.currency)} / month · ${currency(agreement.totalValue, agreement.currency)} total`}
                  symbol="doc.text"
                  title={agreement.title}
                  trailing={
                    <StatusPill
                      label={nativeStatusLabel(locale, labelForStatus(agreement.status))}
                      tone={toneForStatus(agreement.status)}
                    />
                  }
                />
              </Fragment>
            ))}
          </NativeCard>
        ) : (
          <EmptyRows
            message={nativeText(locale, 'noAgreementMessage')}
            symbol="doc.text"
            title={nativeText(locale, 'noAgreement')}
          />
        )}
      </NativeSection>
    </>
  );
}

function HelpContent() {
  return (
    <>
      <NativeSection title="Realty Media support">
        <NativeCard style={styles.helpCard}>
          <Text selectable style={styles.helpTitle}>
            We’re here when you need us.
          </Text>
          <Text selectable style={styles.helpCopy}>
            Email the Realty Media team for account access, production, billing,
            or technical questions.
          </Text>
          <View style={styles.actions}>
            <NativeButton
              label="Email Support"
              onPress={() => void Linking.openURL('mailto:contact@realtymedia.ro')}
            />
            <NativeButton
              label="Open realtymedia.ro"
              onPress={() => void Linking.openURL('https://realtymedia.ro')}
            />
          </View>
        </NativeCard>
      </NativeSection>
      <NativeSection title="Account">
        <NativeCard>
          <NativeListRow
            detail="contact@realtymedia.ro"
            onPress={() => void Linking.openURL('mailto:contact@realtymedia.ro')}
            symbol="envelope"
            title="Support email"
          />
        </NativeCard>
      </NativeSection>
    </>
  );
}

export interface MoreDestinationNativeScreenProps {
  clientAccountId?: string | null;
  data?: PortalData;
  destination: Exclude<MoreDestination, 'notifications' | 'profile'>;
  role: AppRole;
  errorMessage?: string | null;
  loading?: boolean;
  onRefresh?: () => void;
  onRetry?: () => void;
  onPressClient?: (client: ClientSummary) => void;
  onPressDocument?: (document: CompanyDocumentSummary) => void;
  onPressGear?: (item: GearItem) => void;
  onPressTask?: (task: TaskSummary) => void;
  currentUserId?: string;
  onSaveAccount?: (input: UpsertFinanceAccountInput) => Promise<void>;
  onSaveMovement?: (input: CreateMoneyMovementInput | UpdateMoneyMovementInput) => Promise<void>;
  onArchiveDocument?: (documentId: string) => Promise<void>;
  onDeleteDocumentFolder?: (folderId: string) => Promise<void>;
  onSaveDocument?: (input: import('@/screens/web/types').UpsertDocumentInput) => Promise<string | void>;
  onSaveDocumentFolder?: (input: import('@/screens/web/types').UpsertCompanyDocumentFolderInput) => Promise<string | void>;
  previewTasks?: readonly TaskSummary[];
  refreshing?: boolean;
  locale?: NativeLocale;
}

export function MoreDestinationNativeScreen({
  clientAccountId,
  data,
  destination,
  role,
  errorMessage,
  loading,
  onPressClient,
  onPressDocument,
  onPressGear,
  onPressTask,
  currentUserId,
  onSaveAccount,
  onSaveMovement,
  onArchiveDocument,
  onDeleteDocumentFolder,
  onSaveDocument,
  onSaveDocumentFolder,
  previewTasks,
  onRefresh,
  onRetry,
  refreshing,
  locale = 'en',
}: MoreDestinationNativeScreenProps) {
  if (destination === 'documents') {
    return (
      <DocumentsNativeScreen
        data={data}
        errorMessage={errorMessage}
        loading={loading}
        onArchiveDocument={onArchiveDocument}
        onDeleteFolder={onDeleteDocumentFolder}
        onRefresh={onRefresh}
        onRetry={onRetry}
        onSaveDocument={onSaveDocument}
        onSaveFolder={onSaveDocumentFolder}
        refreshing={refreshing}
      />
    );
  }

  let content = <HelpContent />;

  switch (destination) {
    case 'analytics':
      content = (
        <InstagramAnalyticsContent
          clientAccountId={clientAccountId}
          data={data}
        />
      );
      break;
    case 'clients':
      content = <ClientsContent data={data} onPressClient={onPressClient} />;
      break;
    case 'tasks':
      content = (
        <TasksContent
          data={data}
          onPressTask={onPressTask}
          currentUserId={currentUserId}
          role={role}
          previewTasks={previewTasks}
        />
      );
      break;
    case 'finance':
      content = <FinanceContent data={data} onSaveAccount={onSaveAccount} onSaveMovement={onSaveMovement} />;
      break;
    case 'gear':
      content = <GearContent data={data} onPressGear={onPressGear} />;
      break;
    case 'team':
      content = <TeamContent data={data} />;
      break;
    case 'availability':
      content = <AvailabilityContent data={data} />;
      break;
    case 'files':
      content = (
        <NativeSection title="Shared with you">
          <FilesContent data={data} />
        </NativeSection>
      );
      break;
    case 'members':
      content = <MembersContent clientAccountId={clientAccountId} data={data} />;
      break;
    case 'deal':
      content = <DealContent clientAccountId={clientAccountId} data={data} locale={locale} />;
      break;
    case 'help':
      content = <HelpContent />;
      break;
  }

  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel={locale === 'ro' ? 'Se încarcă' : `Loading ${moreDestinationTitles[destination].toLowerCase()}`}
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
      supportsWideLayout
    >
      {content}
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  taskScreen: {
    gap: 16,
  },
  taskFilters: {
    flexDirection: 'row',
    gap: 8,
  },
  taskFilterButton: {
    flex: 1,
  },
  taskCardStack: {
    gap: 10,
  },
  destinationStackItem: {
    paddingTop: 24,
  },
  destinationWideColumn: {
    flex: 1,
    minWidth: 0,
  },
  destinationWideColumns: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 20,
  },
  financeEditor: {
    gap: 12,
    padding: 16,
  },
  financeField: {
    gap: 5,
  },
  financeFieldLabel: {
    color: nativeColors.secondaryLabel,
    fontSize: 13,
    fontWeight: '600',
  },
  financeInput: {
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 14,
    color: nativeColors.label,
    fontSize: 16,
    minHeight: 46,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  financeActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  value: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 15,
    fontWeight: '600',
  },
  memberTrailing: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  memberAvatar: {
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  memberAvatarFallback: {
    alignItems: 'center',
    backgroundColor: nativeColors.fill,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  memberAvatarInitials: {
    color: nativeColors.label,
    fontSize: 12,
    fontWeight: '600',
  },
  helpCard: {
    gap: 12,
    padding: 18,
  },
  helpTitle: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 25,
  },
  helpCopy: {
    color: nativeColors.secondaryLabel,
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    gap: 6,
    paddingTop: 4,
  },
});
