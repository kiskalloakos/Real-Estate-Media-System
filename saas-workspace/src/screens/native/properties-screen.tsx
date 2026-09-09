import { Image } from 'expo-image';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {
  NativeCard,
  NativeEmptyState,
  NativeScreen,
  NativeScreenIntro,
  NativeSection,
  NativeSymbol,
  StatusPill,
  Text,
  nativeColors,
  type AppRole,
  type NativeAsyncScreenProps,
  type NativeEditorialStyleProps,
  type NativeStatusTone,
  useNativeWideLayout,
} from '@/components/native';

export interface PropertySummary {
  id: string;
  name: string;
  location?: string;
  clientName?: string;
  coverImageUrl?: string | null;
  statusLabel: string;
  statusTone?: NativeStatusTone;
  assignedTeamNames?: readonly string[];
  awaitingReviewCount?: number;
  openTaskCount?: number;
  nextMilestone?: string;
  lastUpdatedLabel?: string;
  socialSummary?: string;
}

export interface PropertiesNativeScreenProps
  extends NativeAsyncScreenProps,
    NativeEditorialStyleProps {
  role: AppRole;
  properties?: readonly PropertySummary[];
  onPressProperty?: (property: PropertySummary) => void;
  onPressAddProperty?: () => void;
}

const roleCopy: Record<AppRole, { eyebrow: string; title: string; summary: string; empty: string }> = {
  admin: {
    eyebrow: 'Portfolio',
    title: 'Every active property, clearly',
    summary: 'Monitor client work, assignments, and review pressure without opening every project.',
    empty: 'Create the first property when a new client is ready to begin.',
  },
  team_member: {
    eyebrow: 'Assignments',
    title: 'The properties you work on',
    summary: 'Only assigned properties and the production context you need are shown here.',
    empty: 'An admin has not assigned a property to you yet.',
  },
  client: {
    eyebrow: 'Your properties',
    title: 'A home for every project',
    summary: 'Open a property to see its content, feedback, files, and performance.',
    empty: 'Your Realty Media team has not added a property yet.',
  },
};

function propertyDetails(property: PropertySummary, role: AppRole) {
  if (role === 'admin') {
    const team = property.assignedTeamNames?.length
      ? `${property.assignedTeamNames.length} team member${property.assignedTeamNames.length === 1 ? '' : 's'}`
      : 'Unassigned';
    return [property.clientName, team, property.openTaskCount ? `${property.openTaskCount} open tasks` : null]
      .filter(Boolean)
      .join(' · ');
  }

  if (role === 'team_member') {
    return [
      property.clientName,
      property.nextMilestone,
      property.openTaskCount ? `${property.openTaskCount} open tasks` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  return [
    property.awaitingReviewCount
      ? `${property.awaitingReviewCount} awaiting review`
      : 'No reviews waiting',
    property.lastUpdatedLabel,
  ]
    .filter(Boolean)
    .join(' · ');
}

function PropertyCard({
  property,
  role,
  onPress,
  wide,
}: {
  property: PropertySummary;
  role: AppRole;
  onPress?: () => void;
  wide?: boolean;
}) {
  const details = propertyDetails(property, role);

  return (
    <Pressable
      accessibilityHint={onPress ? 'Opens this property' : undefined}
      accessibilityLabel={[property.name, property.location, property.statusLabel, details]
        .filter(Boolean)
        .join(', ')}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        wide && styles.wideProperty,
        pressed && styles.propertyPressed,
      ]}
    >
      <NativeCard style={styles.propertyCard}>
        {property.coverImageUrl ? (
          <Image
            accessibilityLabel={`${property.name} cover`}
            accessible
            contentFit="cover"
            source={property.coverImageUrl}
            style={styles.cover}
            transition={160}
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <NativeSymbol color={nativeColors.secondaryLabel} name="building.2" size={30} />
          </View>
        )}

        <View style={styles.propertyCopy}>
          <View style={styles.propertyTitleLine}>
            <View style={styles.propertyTitleCopy}>
              <Text selectable style={styles.propertyTitle}>
                {property.name}
              </Text>
              {property.location ? (
                <Text selectable style={styles.propertyLocation}>
                  {property.location}
                </Text>
              ) : null}
            </View>
            <StatusPill label={property.statusLabel} tone={property.statusTone} />
          </View>

          {details ? (
            <Text selectable style={styles.propertyDetails}>
              {details}
            </Text>
          ) : null}

          {property.socialSummary ? (
            <View style={styles.socialLine}>
              <NativeSymbol color={nativeColors.teal} name="chart.line.uptrend.xyaxis" size={14} />
              <Text selectable style={styles.socialText}>
                {property.socialSummary}
              </Text>
            </View>
          ) : null}
        </View>
      </NativeCard>
    </Pressable>
  );
}

export function PropertiesNativeScreen({
  role,
  properties = [],
  loading,
  errorMessage,
  refreshing,
  onRefresh,
  onRetry,
  editorialTitleStyle,
  onPressProperty,
  onPressAddProperty,
}: PropertiesNativeScreenProps) {
  const copy = roleCopy[role];
  const isWide = useNativeWideLayout();

  return (
    <NativeScreen
      errorMessage={errorMessage}
      loading={loading}
      loadingLabel="Loading properties"
      onRefresh={onRefresh}
      onRetry={onRetry}
      refreshing={refreshing}
      supportsWideLayout
    >
      <NativeScreenIntro
        eyebrow={copy.eyebrow}
        summary={copy.summary}
        title={copy.title}
        titleStyle={editorialTitleStyle}
      />

      <NativeSection
        actionLabel={role === 'admin' && onPressAddProperty ? 'Add Property' : undefined}
        caption={`${properties.length} visible ${properties.length === 1 ? 'property' : 'properties'}`}
        onPressAction={onPressAddProperty}
        title={role === 'team_member' ? 'Assigned' : 'Portfolio'}
      >
        {properties.length ? (
          <View style={[styles.propertyList, isWide && styles.widePropertyList]}>
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                onPress={onPressProperty ? () => onPressProperty(property) : undefined}
                property={property}
                role={role}
                wide={isWide}
              />
            ))}
          </View>
        ) : (
          <NativeCard>
            <NativeEmptyState
              actionLabel={role === 'admin' && onPressAddProperty ? 'Add Property' : undefined}
              compact
              message={copy.empty}
              onAction={onPressAddProperty}
              symbol="building.2"
              title="No properties yet"
            />
          </NativeCard>
        )}
      </NativeSection>
    </NativeScreen>
  );
}

const styles = StyleSheet.create({
  propertyList: {
    gap: 12,
  },
  widePropertyList: {
    alignItems: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  wideProperty: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 340,
  },
  propertyPressed: {
    opacity: 0.62,
  },
  propertyCard: {
    flexDirection: 'row',
    minHeight: 132,
    padding: 12,
  },
  cover: {
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 16,
    width: 104,
  },
  coverPlaceholder: {
    alignItems: 'center',
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 16,
    justifyContent: 'center',
    width: 104,
  },
  propertyCopy: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 13,
    paddingVertical: 3,
  },
  propertyTitleLine: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
  },
  propertyTitleCopy: {
    flex: 1,
    gap: 2,
  },
  propertyTitle: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 22,
  },
  propertyLocation: {
    color: nativeColors.secondaryLabel,
    fontSize: 13,
    lineHeight: 17,
  },
  propertyDetails: {
    color: nativeColors.secondaryLabel,
    fontSize: 13,
    lineHeight: 18,
  },
  socialLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  socialText: {
    color: nativeColors.teal,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});
