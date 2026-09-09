import { Image } from 'expo-image';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  NativeCard,
  NativeEmptyState,
  NativeListRow,
  NativeScreen,
  NativeSection,
  NativeSeparator,
  NativeTaskCard,
  StatusPill,
  Text,
  nativeColors,
  type NativeAsyncScreenProps,
} from '@/components/native';
import type {
  AgreementSummary,
  CalendarEvent,
  ClientMemberSummary,
  ClientSummary,
  PaymentRecord,
  PropertySummary,
  TaskSummary,
} from '@/screens/web/types';
import { taskBoardStatus } from '@/lib/task-presentation';

export interface ClientDetailNativeScreenProps extends NativeAsyncScreenProps {
  agreements?: readonly AgreementSummary[];
  client: ClientSummary;
  events?: readonly CalendarEvent[];
  members?: readonly ClientMemberSummary[];
  onPressEvent?: (eventId: string) => void;
  onPressProperty?: (propertyId: string) => void;
  onPressTask?: (taskId: string) => void;
  payments?: readonly PaymentRecord[];
  properties?: readonly PropertySummary[];
  tasks?: readonly TaskSummary[];
}

function currency(amount: number) {
  return new Intl.NumberFormat('ro-RO', {
    currency: 'RON',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount);
}

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function statusTone(status: ClientSummary['status']) {
  if (status === 'active') return 'success' as const;
  if (status === 'onboarding') return 'info' as const;
  return 'warning' as const;
}

function currentFulfillment(agreement?: AgreementSummary) {
  const month = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date());
  const deliverables = (agreement?.deliverables ?? []).filter((deliverable) => {
    if (deliverable.cadence !== 'monthly') return true;
    const prefix = deliverable.name.split(':')[0]?.trim() ?? '';
    return !/^[A-Za-z]+\s+\d{4}$/.test(prefix) || prefix === month;
  });
  const quantity = (status?: typeof deliverables[number]['status']) => deliverables.reduce(
    (total, deliverable) => total + (status && deliverable.status !== status ? 0 : deliverable.quantity),
    0,
  );
  return { deliverables, month, quantity };
}

export function ClientDetailNativeScreen({
  agreements = [],
  client,
  events = [],
  members = [],
  payments = [],
  properties = [],
  tasks = [],
  loading,
  errorMessage,
  refreshing,
  onRefresh,
  onRetry,
  onPressEvent,
  onPressProperty,
  onPressTask,
}: ClientDetailNativeScreenProps) {
  const agreement =
    agreements.find((item) => item.status === 'active') ?? agreements[0];
  const openTasks = tasks.filter(
    (task) => task.status !== 'done' && task.status !== 'cancelled',
  );
  const upcomingPayments = payments.filter(
    (payment) =>
      payment.status === 'upcoming' ||
      payment.status === 'due' ||
      payment.status === 'overdue',
  );
  const fulfillment = currentFulfillment(agreement);

  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel="Loading client"
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
    >
      <NativeCard style={styles.identityCard}>
        {client.avatarUrl ? (
          <Image
            accessibilityLabel={`${client.name} profile photo`}
            accessible
            contentFit="cover"
            source={client.avatarUrl}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarFallback}>
            <Text selectable style={styles.initials}>
              {initialsFor(client.name)}
            </Text>
          </View>
        )}
        <View style={styles.identityCopy}>
          <View style={styles.identityTopline}>
            <Text selectable style={styles.contactName}>
              {client.contactName}
            </Text>
            <StatusPill
              label={
                client.status.charAt(0).toUpperCase() + client.status.slice(1)
              }
              tone={statusTone(client.status)}
            />
          </View>
          <Text selectable style={styles.identityDetail}>
            {client.email}
          </Text>
          <Text selectable style={styles.identityDetail}>
            {client.location || 'Location not added'}
          </Text>
        </View>
      </NativeCard>

      <NativeSection
        caption="Manually managed by Realty Media"
        title="Commercial relationship"
      >
        <NativeCard>
          <NativeListRow
            detail={agreement?.title ?? 'Current monthly service'}
            showChevron={false}
            symbol="doc.text"
            title="Agreement"
            trailing={
              <StatusPill
                label={agreement?.status === 'active' ? 'Active' : 'Recorded'}
                tone={agreement?.status === 'active' ? 'success' : 'neutral'}
              />
            }
          />
          <NativeSeparator inset={60} />
          <NativeListRow
            detail={`${client.monthlyDeliverables} monthly deliverables`}
            showChevron={false}
            symbol="calendar.badge.checkmark"
            title="Monthly service"
            trailing={
              <Text selectable style={styles.value}>
                {currency(agreement?.monthlyAmount ?? client.monthlyPrice)}
              </Text>
            }
          />
          <NativeSeparator inset={60} />
          <NativeListRow
            detail="Signed commercial value"
            showChevron={false}
            symbol="signature"
            title="Contract value"
            trailing={
              <Text selectable style={styles.value}>
                {currency(agreement?.totalValue ?? client.totalContractValue)}
              </Text>
            }
          />
        </NativeCard>
      </NativeSection>

      <NativeSection
        caption={fulfillment.month}
        title="Monthly fulfillment"
      >
        {fulfillment.deliverables.length ? (
          <NativeCard>
            <NativeListRow
              detail="Committed in the current agreement"
              showChevron={false}
              symbol="cart"
              title="Purchased"
              trailing={<Text selectable style={styles.value}>{fulfillment.quantity()}</Text>}
            />
            <NativeSeparator inset={60} />
            <NativeListRow
              detail="Scheduled and being produced"
              showChevron={false}
              symbol="hammer"
              title="In production"
              trailing={<Text selectable style={styles.value}>{fulfillment.quantity('in_progress')}</Text>}
            />
            <NativeSeparator inset={60} />
            <NativeListRow
              detail="Client-approved items"
              showChevron={false}
              symbol="checkmark.seal"
              title="Approved"
              trailing={<Text selectable style={styles.value}>{fulfillment.quantity('approved')}</Text>}
            />
            <NativeSeparator inset={60} />
            <NativeListRow
              detail="Recorded as delivered"
              showChevron={false}
              symbol="tray.and.arrow.down"
              title="Delivered"
              trailing={<Text selectable style={styles.value}>{fulfillment.quantity('delivered')}</Text>}
            />
          </NativeCard>
        ) : (
          <NativeCard>
            <NativeEmptyState
              compact
              message="Add monthly deliverables in the web workspace to track them here."
              symbol="checklist"
              title="No monthly scope"
            />
          </NativeCard>
        )}
      </NativeSection>

      <NativeSection
        caption={`${properties.length} visible ${properties.length === 1 ? 'property' : 'properties'}`}
        title="Properties"
      >
        {properties.length ? (
          <NativeCard>
            {properties.map((property, index) => (
              <Fragment key={property.id}>
                {index ? <NativeSeparator inset={60} /> : null}
                <NativeListRow
                  accessibilityHint="Opens this property"
                  detail={property.nextMilestone}
                  onPress={
                    onPressProperty
                      ? () => onPressProperty(property.id)
                      : undefined
                  }
                  subtitle={property.location}
                  symbol="building.2"
                  title={property.name}
                />
              </Fragment>
            ))}
          </NativeCard>
        ) : (
          <NativeCard>
            <NativeEmptyState
              compact
              message="Properties added from the web workspace will appear here."
              symbol="building.2"
              title="No properties"
            />
          </NativeCard>
        )}
      </NativeSection>

      {openTasks.length ? (
        <NativeSection
          caption={`${openTasks.length} active ${openTasks.length === 1 ? 'task' : 'tasks'}`}
          title="Current work"
      >
          <View style={styles.taskStack}>
            {openTasks.slice(0, 8).map((task) => (
              <NativeTaskCard
                accessibilityHint={onPressTask ? 'Opens task preview' : undefined}
                key={task.id}
                meta={task.assigneeName}
                onPress={onPressTask ? () => onPressTask(task.id) : undefined}
                propertyName={task.propertyName}
                status={taskBoardStatus(task.status)}
                title={task.title}
                urgent={task.priority === 'urgent'}
              />
            ))}
          </View>
        </NativeSection>
      ) : null}

      {events.length || upcomingPayments.length ? (
        <NativeSection title="Coming up">
          <NativeCard>
            {events.slice(0, 4).map((event, index) => (
              <Fragment key={event.id}>
                {index ? <NativeSeparator inset={60} /> : null}
                <NativeListRow
                  detail={`${event.date} · ${event.start || 'All day'}`}
                  onPress={
                    onPressEvent ? () => onPressEvent(event.id) : undefined
                  }
                  showChevron={Boolean(onPressEvent)}
                  subtitle={event.propertyName}
                  title={event.title}
                />
              </Fragment>
            ))}
            {events.length && upcomingPayments.length ? (
              <NativeSeparator inset={60} />
            ) : null}
            {upcomingPayments.slice(0, 3).map((payment, index) => (
              <Fragment key={payment.id}>
                {index ? <NativeSeparator inset={60} /> : null}
                <NativeListRow
                  detail={`Due ${payment.dueDate}`}
                  showChevron={false}
                  subtitle={payment.period}
                  symbol="creditcard"
                  title={currency(payment.amount)}
                  trailing={
                    <StatusPill
                      label={
                        payment.status.charAt(0).toUpperCase() +
                        payment.status.slice(1)
                      }
                      tone={payment.status === 'overdue' ? 'critical' : 'warning'}
                    />
                  }
                />
              </Fragment>
            ))}
          </NativeCard>
        </NativeSection>
      ) : null}

      {members.length ? (
        <NativeSection title="Client account access">
          <NativeCard>
            {members.map((member, index) => (
              <Fragment key={member.id}>
                {index ? <NativeSeparator inset={60} /> : null}
                <NativeListRow
                  detail={member.email}
                  showChevron={false}
                  subtitle={
                    member.role === 'owner' ? 'Account owner' : 'Team member'
                  }
                  symbol="person"
                  title={member.name}
                  trailing={
                    <StatusPill
                      label={
                        member.status.charAt(0).toUpperCase() +
                        member.status.slice(1)
                      }
                      tone={member.status === 'active' ? 'success' : 'warning'}
                    />
                  }
                />
              </Fragment>
            ))}
          </NativeCard>
        </NativeSection>
      ) : null}
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  identityCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 15,
    padding: 16,
  },
  avatar: {
    borderCurve: 'continuous',
    borderRadius: 36,
    height: 72,
    width: 72,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  initials: {
    color: nativeColors.accent,
    fontFamily: 'OutfitSemiBold',
    fontSize: 20,
    fontWeight: '600',
  },
  identityCopy: {
    flex: 1,
    gap: 3,
  },
  identityTopline: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  contactName: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    flex: 1,
    fontSize: 19,
    fontWeight: '600',
    lineHeight: 24,
  },
  identityDetail: {
    color: nativeColors.secondaryLabel,
    fontSize: 14,
    lineHeight: 19,
  },
  taskStack: {
    gap: 10,
  },
  value: {
    color: nativeColors.label,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
});
