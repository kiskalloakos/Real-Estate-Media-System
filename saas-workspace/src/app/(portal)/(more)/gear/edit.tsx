import { useNativeChoice } from '@/components/native/native-choice';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import {
  NativeCard,
  NativeEmptyState,
  NativeListRow,
  NativeSection,
  NativeSeparator,
  Text,
  nativeColors,
} from '@/components/native';
import { useNativePortalData } from '@/hooks/use-native-portal-data';
import { transferGearItem } from '@/lib/portal-action-service';
import { useApp } from '@/providers/app-provider';
import type { GearItem, TransferGearInput } from '@/screens/web/types';

type GearStatus = TransferGearInput['status'];

const statusChoices: { label: string; value: GearStatus }[] = [
  { label: 'Available at studio', value: 'available' },
  { label: 'Placed on site', value: 'on_site' },
  { label: 'In maintenance', value: 'maintenance' },
];


function editableStatus(item?: GearItem): GearStatus {
  if (item?.status === 'on_site' || item?.status === 'maintenance') {
    return item.status;
  }
  return 'available';
}

export default function GearEditorRoute() {
  const params = useLocalSearchParams<{ gearId?: string | string[] }>();
  const { identity, isPreview } = useApp();
  const live = useNativePortalData({ identity, isPreview });
  const gearId = Array.isArray(params.gearId) ? params.gearId[0] : params.gearId;
  const item = live.data?.gear?.find((candidate) => candidate.id === gearId);

  if (!identity) return null;

  if (live.loading && !item) {
    return (
      <>
        <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.screen}>
          <View style={styles.unavailable}>
            <Text style={styles.summary}>Loading gear item…</Text>
          </View>
        </ScrollView>
        <Stack.Title>Move Gear</Stack.Title>
      </>
    );
  }

  return (
    <GearEditorContent
      identity={identity}
      isPreview={isPreview}
      item={item}
      key={gearId}
      live={live}
    />
  );
}

function GearEditorContent({
  identity,
  isPreview,
  item,
  live,
}: {
  identity: NonNullable<ReturnType<typeof useApp>['identity']>;
  isPreview: boolean;
  item?: GearItem;
  live: ReturnType<typeof useNativePortalData>;
}) {
  const choose = useNativeChoice();
  const router = useRouter();
  const [status, setStatus] = React.useState<GearStatus>(editableStatus(item));
  const [propertyId, setPropertyId] = React.useState<string | undefined>();
  const [location, setLocation] = React.useState(item?.location ?? '');
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const properties = React.useMemo(
    () =>
      [...(live.data?.properties ?? [])].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    [live.data?.properties],
  );
  const property = properties.find((candidate) => candidate.id === propertyId);

  const selectStatus = () => {
    choose('Gear status', statusChoices, (nextStatus) => {
      setStatus(nextStatus);
      if (nextStatus !== 'on_site') setPropertyId(undefined);
      if (nextStatus === 'available' && !location.trim()) {
        setLocation('Realty Media studio');
      }
    });
  };

  const selectProperty = () => {
    choose(
      'Property',
      properties.map((candidate) => ({
        label: `${candidate.name} · ${candidate.location}`,
        value: candidate.id,
      })),
      (nextPropertyId) => {
        setPropertyId(nextPropertyId);
        const next = properties.find(
          (candidate) => candidate.id === nextPropertyId,
        );
        if (next) setLocation(next.location);
      },
    );
  };

  const submit = async () => {
    if (
      !item ||
      identity.role !== 'admin' ||
      !identity.agencyId ||
      isPreview
    ) {
      return;
    }
    if (status === 'on_site' && !propertyId) {
      setErrorMessage('Choose the property where this gear is going.');
      return;
    }
    setSaving(true);
    setErrorMessage('');
    try {
      await transferGearItem(
        {
          gearId: item.id,
          location,
          note,
          propertyId,
          status,
        },
        { agencyId: identity.agencyId, userId: identity.userId },
      );
      await live.retry();
      router.back();
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error ? caught.message : 'Could not update the gear.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (identity.role !== 'admin' || !item) {
    return (
      <>
        <ScrollView
          contentContainerStyle={styles.unavailable}
          contentInsetAdjustmentBehavior="automatic"
          style={styles.screen}
        >
          <NativeEmptyState
            message={
              identity.role === 'admin'
                ? 'This gear item is no longer available.'
                : 'Only administrators can move gear.'
            }
            symbol="camera"
            title="Gear unavailable"
          />
        </ScrollView>
        <Stack.Title>Move Gear</Stack.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button onPress={() => router.back()}>
            Close
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      </>
    );
  }

  return (
    <>
      <ScrollView
        alwaysBounceVertical={false}
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        style={styles.screen}
      >
        <View style={styles.intro}>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.summary}>
            Record where the item is now. The change is shared with the web app.
          </Text>
        </View>

        {errorMessage ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {errorMessage}
          </Text>
        ) : null}

        <NativeSection title="Movement">
          <NativeCard>
            <NativeListRow
              detail={
                statusChoices.find((choice) => choice.value === status)?.label
              }
              disabled={saving}
              onPress={selectStatus}
              symbol="arrow.left.arrow.right"
              title="Status"
            />
            {status === 'on_site' ? (
              <>
                <NativeSeparator inset={60} />
                <NativeListRow
                  detail={property?.name ?? 'Choose a property'}
                  disabled={saving || !properties.length}
                  onPress={selectProperty}
                  symbol="building.2"
                  title="Property"
                />
              </>
            ) : null}
          </NativeCard>
        </NativeSection>

        <NativeSection title="Details">
          <NativeCard style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Current location</Text>
              <TextInput
                editable={!saving}
                onChangeText={setLocation}
                placeholder="Studio, service centre, or site"
                placeholderTextColor={nativeColors.tertiaryLabel}
                style={styles.input}
                value={location}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Movement note</Text>
              <TextInput
                editable={!saving}
                multiline
                onChangeText={setNote}
                placeholder="Optional handoff or condition note"
                placeholderTextColor={nativeColors.tertiaryLabel}
                style={[styles.input, styles.noteInput]}
                textAlignVertical="top"
                value={note}
              />
            </View>
          </NativeCard>
        </NativeSection>
      </ScrollView>

      <Stack.Title>Move Gear</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button disabled={saving} onPress={() => router.back()}>
          Cancel
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          disabled={saving || (status === 'on_site' && !propertyId)}
          onPress={() => void submit()}
          variant="done"
        >
          {saving ? 'Saving…' : 'Save'}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: nativeColors.background,
    flex: 1,
  },
  content: {
    gap: 22,
    paddingBottom: 40,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  unavailable: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  intro: {
    gap: 5,
  },
  title: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 23,
    fontWeight: '600',
    lineHeight: 28,
  },
  summary: {
    color: nativeColors.secondaryLabel,
    fontSize: 15,
    lineHeight: 21,
  },
  error: {
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 16,
    color: nativeColors.critical,
    fontSize: 14,
    lineHeight: 19,
    padding: 12,
  },
  form: {
    gap: 18,
    padding: 16,
  },
  field: {
    gap: 7,
  },
  label: {
    color: nativeColors.secondaryLabel,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: nativeColors.fill,
    borderCurve: 'continuous',
    borderRadius: 16,
    color: nativeColors.label,
    fontFamily: 'OutfitRegular',
    fontSize: 17,
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  noteInput: {
    minHeight: 92,
  },
});
