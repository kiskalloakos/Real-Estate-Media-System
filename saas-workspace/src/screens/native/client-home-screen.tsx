import { Image } from 'expo-image';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  NativeButton,
  NativeCard,
  NativeEmptyState,
  NativeListRow,
  NativeScreen,
  NativeSection,
  NativeSeparator,
  NativeSymbol,
  NativeTaskCard,
  StatusPill,
  Text,
  nativeColors,
  type NativeAsyncScreenProps,
  useNativeWideLayout,
} from '@/components/native';
import type { AgreementSummary, ReviewItem } from '@/screens/web/types';
import { nativeStatusLabel, nativeText, type NativeLocale } from '@/lib/native-i18n';
import { taskBoardStatus } from '@/lib/task-presentation';

import type { HomeScheduleItem } from './home-screen';
import type { PropertySummary } from './properties-screen';

export interface ClientTaskSummary {
  dueAt?: string;
  id: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  propertyName: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
  title: string;
}

export interface ClientHomeNativeScreenProps extends NativeAsyncScreenProps {
  agreement?: AgreementSummary;
  onPressAgreement?: () => void;
  onPressProductionDay?: (item: HomeScheduleItem) => void;
  onPressProperty?: (property: PropertySummary) => void;
  onPressReview?: (review: ReviewItem) => void;
  approvals?: readonly ReviewItem[];
  deliveredAssets?: readonly ReviewItem[];
  locale?: NativeLocale;
  productionDays?: readonly HomeScheduleItem[];
  properties?: readonly PropertySummary[];
  tasks?: readonly ClientTaskSummary[];
  userName: string;
}

function dueLabel(value: string | undefined, locale: NativeLocale) {
  if (!value) return nativeText(locale, 'noDeadline');
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function money(value: number, currency = 'RON') {
  return new Intl.NumberFormat('ro-RO', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function PropertyFeature({
  locale,
  onPress,
  property,
}: {
  locale: NativeLocale;
  onPress?: () => void;
  property: PropertySummary;
}) {
  return (
    <Pressable
      accessibilityHint={onPress ? 'Opens this property' : undefined}
      accessibilityLabel={`${property.name}, ${property.location ?? ''}`}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <NativeCard>
        {property.coverImageUrl ? (
          <Image
            accessibilityLabel={`${property.name} cover`}
            accessible
            contentFit="cover"
            source={property.coverImageUrl}
            style={styles.propertyImage}
            transition={180}
          />
        ) : (
          <View style={styles.propertyPlaceholder}>
            <NativeSymbol color={nativeColors.secondaryLabel} name="building.2" size={34} />
          </View>
        )}
        <View style={styles.propertyCopy}>
          <View style={styles.propertyTitleRow}>
            <View style={styles.propertyTitleCopy}>
              <Text selectable style={styles.propertyName}>{property.name}</Text>
              <Text selectable style={styles.propertyLocation}>{property.location}</Text>
            </View>
            <StatusPill label={nativeStatusLabel(locale, property.statusLabel)} tone={property.statusTone} />
          </View>
          {property.nextMilestone ? (
            <Text selectable style={styles.propertyMeta}>{property.nextMilestone}</Text>
          ) : null}
        </View>
      </NativeCard>
    </Pressable>
  );
}

function PropertiesCard({
  locale,
  onPressProperty,
  properties,
}: {
  locale: NativeLocale;
  onPressProperty?: (property: PropertySummary) => void;
  properties: readonly PropertySummary[];
}) {
  const [featured, ...rest] = properties;
  return (
    <NativeSection title={nativeText(locale, 'properties')}>
      {featured ? (
        <>
          <PropertyFeature locale={locale} onPress={() => onPressProperty?.(featured)} property={featured} />
          {rest.length ? (
            <NativeCard style={styles.secondaryProperties}>
              {rest.map((property, index) => (
                <Fragment key={property.id}>
                  {index ? <NativeSeparator inset={60} /> : null}
                  <Pressable
                    accessibilityHint={onPressProperty ? 'Opens this property' : undefined}
                    accessibilityLabel={`${property.name}, ${property.location ?? ''}`}
                    accessibilityRole={onPressProperty ? 'button' : undefined}
                    disabled={!onPressProperty}
                    onPress={() => onPressProperty?.(property)}
                    style={({ pressed }) => [styles.propertyRow, pressed && styles.pressed]}
                  >
                    {property.coverImageUrl ? (
                      <Image
                        accessibilityLabel={`${property.name} thumbnail`}
                        accessible
                        contentFit="cover"
                        source={property.coverImageUrl}
                        style={styles.propertyThumbnail}
                      />
                    ) : (
                      <View style={styles.propertyThumbnailPlaceholder}>
                        <NativeSymbol color={nativeColors.secondaryLabel} name="building.2" size={18} />
                      </View>
                    )}
                    <View style={styles.propertyRowCopy}>
                      <Text selectable style={styles.propertyRowTitle}>{property.name}</Text>
                      <Text selectable style={styles.propertyLocation}>{property.location}</Text>
                    </View>
                    <StatusPill label={nativeStatusLabel(locale, property.statusLabel)} tone={property.statusTone} />
                    {onPressProperty ? <NativeSymbol color={nativeColors.tertiaryLabel} name="chevron.right" size={13} /> : null}
                  </Pressable>
                </Fragment>
              ))}
            </NativeCard>
          ) : null}
        </>
      ) : (
        <NativeCard><NativeEmptyState compact message={nativeText(locale, 'noPropertiesMessage')} symbol="building.2" title={nativeText(locale, 'noProperties')} /></NativeCard>
      )}
    </NativeSection>
  );
}

function ProductionCard({
  locale,
  onPress,
  items,
}: {
  locale: NativeLocale;
  items: readonly HomeScheduleItem[];
  onPress?: (item: HomeScheduleItem) => void;
}) {
  return (
    <NativeSection title={nativeText(locale, 'productionDays')}>
      {items.length ? (
        <NativeCard>
          {items.map((item, index) => (
            <Fragment key={item.id}>
              {index ? <NativeSeparator inset={60} /> : null}
              <NativeListRow
                detail={item.timeLabel}
                onPress={onPress ? () => onPress(item) : undefined}
                showChevron={Boolean(onPress)}
                subtitle={item.subtitle}
                title={item.title}
              />
            </Fragment>
          ))}
        </NativeCard>
      ) : (
        <NativeCard><NativeEmptyState compact message={nativeText(locale, 'noProductionDaysMessage')} symbol="camera" title={nativeText(locale, 'noProductionDays')} /></NativeCard>
      )}
    </NativeSection>
  );
}

function ReviewActionCard({
  actionLabel,
  emptyMessage,
  emptyTitle,
  items,
  onPressReview,
  title,
}: {
  actionLabel: string;
  emptyMessage: string;
  emptyTitle: string;
  items: readonly ReviewItem[];
  onPressReview?: (review: ReviewItem) => void;
  title: string;
}) {
  return (
    <NativeSection caption={items.length ? `${items.length} item${items.length === 1 ? '' : 's'}` : undefined} title={title}>
      {items.length ? (
        <NativeCard>
          {items.slice(0, 4).map((review, index) => (
            <Fragment key={review.id}>
              {index ? <NativeSeparator inset={60} /> : null}
              <NativeListRow
                accessibilityHint="Opens the exact version"
                detail={`${review.propertyName} · ${review.version}`}
                onPress={onPressReview ? () => onPressReview(review) : undefined}
                showChevron={Boolean(onPressReview)}
                subtitle={actionLabel}
                symbol={review.kind === 'video' ? 'play.rectangle' : 'doc.text'}
                title={review.title}
                trailing={<StatusPill label={review.status === 'approved' ? 'Delivered' : 'Review'} tone={review.status === 'approved' ? 'success' : 'warning'} />}
              />
            </Fragment>
          ))}
        </NativeCard>
      ) : (
        <NativeCard><NativeEmptyState compact message={emptyMessage} symbol="checkmark.bubble" title={emptyTitle} /></NativeCard>
      )}
    </NativeSection>
  );
}

function TasksCard({
  locale,
  tasks,
}: {
  locale: NativeLocale;
  tasks: readonly ClientTaskSummary[];
}) {
  return (
    <NativeSection title={nativeText(locale, 'tasks')}>
      {tasks.length ? (
        <View style={styles.taskStack}>
          {tasks.map((task) => (
            <NativeTaskCard
              key={task.id}
              meta={dueLabel(task.dueAt, locale)}
              propertyName={task.propertyName}
              status={taskBoardStatus(task.status)}
              title={task.title}
              urgent={task.priority === 'urgent'}
            />
          ))}
        </View>
      ) : (
        <NativeCard><NativeEmptyState compact message={nativeText(locale, 'noAssignedTasksMessage')} symbol="checklist" title={nativeText(locale, 'noAssignedTasks')} /></NativeCard>
      )}
    </NativeSection>
  );
}

function AgreementCard({
  agreement,
  locale,
  onPress,
}: {
  agreement?: AgreementSummary;
  locale: NativeLocale;
  onPress?: () => void;
}) {
  return (
    <NativeSection title={nativeText(locale, 'currentAgreement')}>
      {agreement ? (
        <Pressable
          accessibilityHint={onPress ? 'Opens agreement details' : undefined}
          accessibilityLabel={agreement.title}
          accessibilityRole={onPress ? 'button' : undefined}
          disabled={!onPress}
          onPress={onPress}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <NativeCard style={styles.agreementCard}>
            <View style={styles.agreementHeader}>
              <View style={styles.agreementTitleCopy}>
                <Text selectable style={styles.agreementTitle}>{agreement.title}</Text>
                <Text selectable style={styles.agreementStatus}>{agreement.status === 'active' ? nativeText(locale, 'statusActive') : agreement.status}</Text>
              </View>
              <NativeSymbol color={nativeColors.accent} name="doc.text" size={26} />
            </View>
            <View style={styles.agreementFacts}>
              <View><Text selectable style={styles.factLabel}>{nativeText(locale, 'monthly')}</Text><Text selectable style={styles.factValue}>{money(agreement.monthlyAmount, agreement.currency)}</Text></View>
              <View><Text selectable style={styles.factLabel}>{nativeText(locale, 'totalValue')}</Text><Text selectable style={styles.factValue}>{money(agreement.totalValue, agreement.currency)}</Text></View>
            </View>
            <NativeButton
              disabled={!onPress}
              label={agreement.fileUrl ? nativeText(locale, 'downloadAgreement') : nativeText(locale, 'viewAgreementDetails')}
              onPress={onPress}
            />
          </NativeCard>
        </Pressable>
      ) : (
        <NativeCard><NativeEmptyState compact message={nativeText(locale, 'noAgreementMessage')} symbol="doc.text" title={nativeText(locale, 'noAgreement')} /></NativeCard>
      )}
    </NativeSection>
  );
}

export function ClientHomeNativeScreen({
  agreement,
  approvals = [],
  deliveredAssets = [],
  errorMessage,
  loading,
  onPressAgreement,
  onPressProductionDay,
  onPressProperty,
  onPressReview,
  onRefresh,
  onRetry,
  productionDays = [],
  properties = [],
  refreshing,
  tasks = [],
  userName,
  locale = 'en',
}: ClientHomeNativeScreenProps) {
  const isWide = useNativeWideLayout();
  const firstName = userName.trim().split(/\s+/)[0] || userName;
  const propertiesCard = <PropertiesCard locale={locale} onPressProperty={onPressProperty} properties={properties} />;
  const productionCard = <ProductionCard items={productionDays} locale={locale} onPress={onPressProductionDay} />;
  const approvalsCard = <ReviewActionCard actionLabel="Decision needed" emptyMessage="New versions will appear here when your approval is needed." emptyTitle="Nothing waiting for you" items={approvals} onPressReview={onPressReview} title="Needs your approval" />;
  const deliveredAssetsCard = <ReviewActionCard actionLabel="Open latest file" emptyMessage="Approved final files will appear here." emptyTitle="No delivered assets yet" items={deliveredAssets} onPressReview={onPressReview} title="Delivered assets" />;
  const tasksCard = <TasksCard locale={locale} tasks={tasks} />;
  const agreementCard = <AgreementCard agreement={agreement} locale={locale} onPress={onPressAgreement} />;

  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel={locale === 'ro' ? 'Se încarcă pagina principală' : 'Loading your home'}
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
      supportsWideLayout
    >
      <View style={styles.intro}>
        <Text selectable style={styles.title}>{locale === 'ro' ? `Mă bucur să te revăd, ${firstName}` : `Good to see you, ${firstName}`}</Text>
      </View>
      {isWide ? (
        <View style={styles.wideColumns}>
          <View style={styles.wideColumn}>{approvalsCard}{productionCard}{propertiesCard}</View>
          <View style={styles.wideColumn}>{deliveredAssetsCard}{tasksCard}{agreementCard}</View>
        </View>
      ) : (
        <>{approvalsCard}{productionCard}{deliveredAssetsCard}{propertiesCard}{tasksCard}{agreementCard}</>
      )}
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: 2 },
  title: { color: nativeColors.label, fontFamily: 'OutfitSemiBold', fontSize: 30, fontWeight: '600', letterSpacing: -0.5, lineHeight: 36 },
  wideColumns: { alignItems: 'flex-start', flexDirection: 'row', gap: 20 },
  wideColumn: { flex: 1, gap: 24, minWidth: 0 },
  taskStack: { gap: 10 },
  pressed: { opacity: 0.78 },
  propertyImage: { backgroundColor: nativeColors.fill, height: 190, width: '100%' },
  propertyPlaceholder: { alignItems: 'center', backgroundColor: nativeColors.fill, height: 190, justifyContent: 'center' },
  propertyCopy: { gap: 8, padding: 16 },
  propertyTitleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  propertyTitleCopy: { flex: 1, gap: 3 },
  propertyName: { color: nativeColors.label, fontFamily: 'OutfitSemiBold', fontSize: 21, fontWeight: '600', lineHeight: 26 },
  propertyLocation: { color: nativeColors.secondaryLabel, fontSize: 14, lineHeight: 19 },
  propertyMeta: { color: nativeColors.secondaryLabel, fontSize: 14, lineHeight: 19 },
  secondaryProperties: { marginTop: 10 },
  propertyRow: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 78, paddingHorizontal: 14, paddingVertical: 9 },
  propertyThumbnail: { backgroundColor: nativeColors.fill, borderRadius: 12, height: 58, width: 58 },
  propertyThumbnailPlaceholder: { alignItems: 'center', backgroundColor: nativeColors.fill, borderRadius: 12, height: 58, justifyContent: 'center', width: 58 },
  propertyRowCopy: { flex: 1, gap: 2 },
  propertyRowTitle: { color: nativeColors.label, fontFamily: 'OutfitSemiBold', fontSize: 16, fontWeight: '600', lineHeight: 21 },
  taskBadges: { alignItems: 'flex-end', flexShrink: 0, gap: 5 },
  taskBadge: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 999, flexDirection: 'row', gap: 5, minHeight: 26, paddingHorizontal: 8, paddingVertical: 4 },
  taskBadgeDot: { borderRadius: 999, height: 6, width: 6 },
  taskBadgeLabel: { fontSize: 11, fontWeight: '600', lineHeight: 15 },
  urgentBadge: { alignItems: 'center', backgroundColor: nativeColors.accent, borderCurve: 'continuous', borderRadius: 999, minHeight: 26, paddingHorizontal: 9, paddingVertical: 4 },
  urgentBadgeLabel: { color: nativeColors.card, fontSize: 11, fontWeight: '700', lineHeight: 15, textTransform: 'uppercase' },
  agreementCard: { gap: 22, padding: 18 },
  agreementHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  agreementTitleCopy: { flex: 1, gap: 4 },
  agreementTitle: { color: nativeColors.label, fontFamily: 'OutfitSemiBold', fontSize: 22, fontWeight: '600', lineHeight: 27 },
  agreementStatus: { color: nativeColors.accent, fontSize: 14, textTransform: 'capitalize' },
  agreementFacts: { flexDirection: 'row', gap: 32 },
  factLabel: { color: nativeColors.secondaryLabel, fontSize: 13, lineHeight: 18 },
  factValue: { color: nativeColors.label, fontFamily: 'OutfitSemiBold', fontSize: 17, fontWeight: '600', lineHeight: 23 },
});
