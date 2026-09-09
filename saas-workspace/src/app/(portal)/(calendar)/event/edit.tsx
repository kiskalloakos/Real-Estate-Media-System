import { useToolbarIcons } from '@/components/native/use-toolbar-icons';
import { useNativeChoice } from '@/components/native/native-choice';
import DateTimePicker from '@/components/native/native-date-time-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import {
  NativeCard,
  NativeEmptyState,
  NativeListRow,
  NativeScreen,
  NativeSection,
  NativeSeparator,
  Text,
  nativeColors,
} from '@/components/native';
import { CalendarColorPicker } from '@/components/native/calendar-color-picker';
import type { CalendarColor } from '@/lib/calendar-colors';
import { useNativePortalData } from '@/hooks/use-native-portal-data';
import {
  archiveCalendarEvent,
  createCalendarEvent,
  updateCalendarEvent,
} from '@/lib/portal-action-service';
import {
  archivePreviewCalendarEvent,
  createPreviewCalendarEvent,
  updatePreviewCalendarEvent,
} from '@/lib/native-preview-store';
import { useApp, type AppIdentity } from '@/providers/app-provider';
import type {
  CalendarEvent,
  ClientSummary,
  CreateCalendarEventInput,
  PropertySummary,
  UpdateCalendarEventInput,
} from '@/screens/web/types';

type Choice<Value extends string | undefined> = {
  label: string;
  value: Value;
};

const typeChoices: Choice<CalendarEvent['type']>[] = [
  { label: 'Production shoot', value: 'shoot' },
  { label: 'Deadline', value: 'deadline' },
  { label: 'Review', value: 'review' },
  { label: 'Internal', value: 'internal' },
];

type EventVisibility = NonNullable<CalendarEvent['visibility']>;
type EventWorkScope = CalendarEvent['workScope'];

const visibilityChoices: Choice<EventVisibility>[] = [
  { label: 'Owners only', value: 'admin_only' },
  { label: 'Realty Media team', value: 'team' },
  { label: 'Client visible', value: 'client' },
];

const workScopeChoices: Choice<EventWorkScope>[] = [
  { label: 'Internal work', value: 'internal' },
  { label: 'Client work', value: 'client' },
  { label: 'Other / unavailable', value: 'other' },
];


function localDateString(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localTimeString(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(
    value.getMinutes(),
  ).padStart(2, '0')}`;
}

function eventDate(event?: CalendarEvent, end = false) {
  if (event) {
    const time = end ? event.end : event.start;
    const date = end ? (event.endDate || event.date) : event.date;
    const value = new Date(`${date}T${time || (end ? '10:00' : '09:00')}:00`);
    if (!Number.isNaN(value.valueOf())) return value;
  }
  const value = new Date();
  value.setSeconds(0, 0);
  value.setMinutes(0);
  value.setHours(end ? value.getHours() + 2 : value.getHours() + 1);
  return value;
}

export default function CalendarEventEditorRoute() {
  const params = useLocalSearchParams<{ eventId?: string | string[] }>();
  const { identity, isPreview } = useApp();
  const live = useNativePortalData({ identity, isPreview });
  const eventId = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const existingEvent = live.data?.calendarEvents?.find(
    (event) => event.id === eventId,
  );

  if (!identity) return null;

  if (eventId && live.loading && !existingEvent) {
    return (
      <>
        <NativeScreen loading loadingLabel="Loading calendar event">
          <></>
        </NativeScreen>
        <Stack.Title>Calendar Event</Stack.Title>
      </>
    );
  }

  return (
    <CalendarEventEditor
      event={existingEvent}
      eventId={eventId}
      identity={identity}
      isPreview={isPreview}
      key={eventId ?? 'new-event'}
      live={live}
    />
  );
}

interface CalendarEventEditorProps {
  event?: CalendarEvent;
  eventId?: string;
  identity: AppIdentity;
  isPreview: boolean;
  live: ReturnType<typeof useNativePortalData>;
}

function CalendarEventEditor({
  event,
  eventId,
  identity,
  isPreview,
  live,
}: CalendarEventEditorProps) {
  const toolbarIcon = useToolbarIcons();
  const choose = useNativeChoice();
  const router = useRouter();
  const editing = Boolean(eventId);
  const [color, setColor] = React.useState<CalendarColor | null>(event?.color ?? null);
  const [title, setTitle] = React.useState(event?.title ?? '');
  const [description, setDescription] = React.useState(event?.description ?? '');
  const [location, setLocation] = React.useState(event?.location ?? '');
  const [type, setType] = React.useState<CalendarEvent['type']>(
    event?.type ?? 'shoot',
  );
  const [visibility, setVisibility] = React.useState<EventVisibility>(
    event?.visibility ?? 'team',
  );
  const [workScope, setWorkScope] = React.useState<EventWorkScope>(
    event?.workScope ?? 'client',
  );
  const [clientId, setClientId] = React.useState<string | undefined>(
    event?.clientId,
  );
  const [propertyId, setPropertyId] = React.useState<string | undefined>(
    event?.propertyId,
  );
  const [startsAt, setStartsAt] = React.useState(() => eventDate(event));
  const [endsAt, setEndsAt] = React.useState(() => eventDate(event, true));
  const [hasEndTime, setHasEndTime] = React.useState(Boolean(event?.end));
  const [saving, setSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');

  const clients = React.useMemo(
    () =>
      [...(live.data?.clients ?? [])].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    [live.data?.clients],
  );
  const properties = React.useMemo(
    () =>
      (live.data?.properties ?? [])
        .filter((property) => !clientId || property.clientId === clientId)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [clientId, live.data?.properties],
  );
  const selectedClient = clients.find((client) => client.id === clientId);
  const selectedProperty = properties.find(
    (property) => property.id === propertyId,
  );

  const chooseClient = () =>
    choose<string | undefined>(
      'Client scope',
      [
        { label: 'Internal Realty Media event', value: undefined },
        ...clients.map((client: ClientSummary) => ({
          label: client.name,
          value: client.id,
        })),
      ],
      (nextClientId) => {
        setClientId(nextClientId);
        setPropertyId(undefined);
        if (!nextClientId && visibility === 'client') setVisibility('team');
      },
    );

  const chooseProperty = () =>
    choose<string | undefined>(
      'Property',
      [
        { label: 'No specific property', value: undefined },
        ...properties.map((property: PropertySummary) => ({
          label: property.name,
          value: property.id,
        })),
      ],
      (nextPropertyId) => {
        setPropertyId(nextPropertyId);
        const property = properties.find((item) => item.id === nextPropertyId);
        if (property) setClientId(property.clientId);
      },
    );

  const submit = async () => {
    if (identity.role !== 'admin') return;
    if (!title.trim()) {
      setErrorMessage('Add an event title before saving.');
      return;
    }
    if (visibility === 'client' && !clientId) {
      setErrorMessage('Choose a client before making this event client visible.');
      return;
    }
    if (!isPreview && !identity.agencyId) {
      setErrorMessage('Your administrator account is missing an agency.');
      return;
    }

    const input: CreateCalendarEventInput = {
      allDay: event?.allDay,
      color,
      clientId,
      date: localDateString(startsAt),
      description,
      end: hasEndTime ? localTimeString(endsAt) : '',
      endDate: localDateString(endsAt),
      location,
      propertyId,
      start: localTimeString(startsAt),
      title,
      type,
      visibility,
      workScope,
    };

    setSaving(true);
    setErrorMessage('');
    try {
      if (isPreview && eventId) {
        updatePreviewCalendarEvent({ ...input, eventId });
      } else if (isPreview) {
        createPreviewCalendarEvent(input, identity.displayName);
      } else if (eventId) {
        const updateInput: UpdateCalendarEventInput = {
          ...input,
          eventId,
        };
        await updateCalendarEvent(updateInput);
      } else {
        await createCalendarEvent(input, {
          agencyId: identity.agencyId!,
          userId: identity.userId,
        });
      }
      if (!isPreview) await live.retry();
      router.back();
    } catch (caught) {
      setErrorMessage(
        caught instanceof Error
          ? caught.message
          : `Could not ${editing ? 'update' : 'create'} the event.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!eventId || saving) return;
    Alert.alert(
      'Delete calendar event?',
      'This removes the event from every shared calendar.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => {
            setSaving(true);
            const archive = isPreview
              ? Promise.resolve(archivePreviewCalendarEvent(eventId))
              : archiveCalendarEvent(eventId);
            void archive
              .then(async () => {
                if (!isPreview) await live.retry();
                router.dismissAll();
                router.replace('/(portal)/(calendar)');
              })
              .catch((caught) => {
                setErrorMessage(
                  caught instanceof Error
                    ? caught.message
                    : 'Could not delete the event.',
                );
                setSaving(false);
              });
          },
          style: 'destructive',
          text: 'Delete',
        },
      ],
    );
  };

  if (identity.role !== 'admin') {
    return (
      <>
        <ScrollView
          contentContainerStyle={styles.unavailable}
          contentInsetAdjustmentBehavior="automatic"
          style={styles.screen}
        >
          <NativeEmptyState
            message="Only Realty Media administrators can manage calendar events."
            symbol="lock"
            title="Administrator access required"
          />
        </ScrollView>
        <Stack.Title>Calendar Event</Stack.Title>
      </>
    );
  }

  if (editing && !event && !live.loading) {
    return (
      <>
        <ScrollView
          contentContainerStyle={styles.unavailable}
          contentInsetAdjustmentBehavior="automatic"
          style={styles.screen}
        >
          <NativeEmptyState
            message="This event may have been deleted or is no longer available."
            symbol="calendar.badge.exclamationmark"
            title="Event unavailable"
          />
        </ScrollView>
        <Stack.Title>Calendar Event</Stack.Title>
      </>
    );
  }

  return (
    <>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        style={styles.screen}
      >
        {errorMessage ? (
          <Text accessibilityLiveRegion="polite" selectable style={styles.error}>
            {errorMessage}
          </Text>
        ) : null}

        <NativeSection title="Event">
          <NativeCard style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                accessibilityLabel="Event title"
                autoCapitalize="sentences"
                autoFocus={!editing}
                editable={!saving}
                onChangeText={setTitle}
                placeholder="e.g. Mountain View production shoot"
                placeholderTextColor={nativeColors.tertiaryLabel}
                style={styles.input}
                value={title}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                accessibilityLabel="Event notes"
                editable={!saving}
                multiline
                onChangeText={setDescription}
                placeholder="Call sheet notes, links, or preparation"
                placeholderTextColor={nativeColors.tertiaryLabel}
                style={[styles.input, styles.notesInput]}
                textAlignVertical="top"
                value={description}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Location</Text>
              <TextInput
                accessibilityLabel="Event location"
                editable={!saving}
                onChangeText={setLocation}
                placeholder="Address or meeting point"
                placeholderTextColor={nativeColors.tertiaryLabel}
                style={styles.input}
                value={location}
              />
            </View>
          </NativeCard>
        </NativeSection>

        <NativeSection title="Event color">
          <NativeCard>
            <CalendarColorPicker value={color} type={type} disabled={saving} onChange={setColor} />
          </NativeCard>
        </NativeSection>

        <NativeSection title="Scope">
          <NativeCard>
            <NativeListRow
              detail={
                workScopeChoices.find((choice) => choice.value === workScope)
                  ?.label
              }
              disabled={saving}
              onPress={() =>
                choose('Work classification', workScopeChoices, setWorkScope)
              }
              symbol="briefcase"
              title="Work classification"
            />
            <NativeSeparator inset={60} />
            <NativeListRow
              detail={
                typeChoices.find((choice) => choice.value === type)?.label
              }
              disabled={saving}
              onPress={() => choose('Event type', typeChoices, setType)}
              symbol="calendar"
              title="Type"
            />
            <NativeSeparator inset={60} />
            <NativeListRow
              detail={selectedClient?.name ?? 'Internal Realty Media event'}
              disabled={saving || live.loading}
              onPress={chooseClient}
              symbol="person.2"
              title="Client"
            />
            <NativeSeparator inset={60} />
            <NativeListRow
              detail={selectedProperty?.name ?? 'No specific property'}
              disabled={saving || live.loading}
              onPress={chooseProperty}
              symbol="building.2"
              title="Property"
            />
            <NativeSeparator inset={60} />
            <NativeListRow
              detail={
                visibilityChoices.find(
                  (choice) => choice.value === visibility,
                )?.label
              }
              disabled={saving}
              onPress={() =>
                choose('Visibility', visibilityChoices, setVisibility)
              }
              symbol="eye"
              title="Visibility"
            />
          </NativeCard>
        </NativeSection>

        <NativeSection title="Schedule">
          <NativeCard>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Start date</Text>
              <DateTimePicker
                disabled={saving}
                display="compact"
                mode="date"
                onChange={(_event, value) => {
                  if (!value) return;
                  const nextStart = new Date(startsAt);
                  nextStart.setFullYear(
                    value.getFullYear(),
                    value.getMonth(),
                    value.getDate(),
                  );
                  setStartsAt(nextStart);
                  if (nextStart > endsAt) {
                    const nextEnd = new Date(endsAt);
                    nextEnd.setFullYear(
                      value.getFullYear(),
                      value.getMonth(),
                      value.getDate(),
                    );
                    setEndsAt(nextEnd);
                  }
                }}
                value={startsAt}
              />
            </View>
            <NativeSeparator inset={16} />
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>End date</Text>
              <DateTimePicker
                disabled={saving}
                display="compact"
                minimumDate={startsAt}
                mode="date"
                onChange={(_event, value) => {
                  if (!value) return;
                  const nextEnd = new Date(endsAt);
                  nextEnd.setFullYear(
                    value.getFullYear(),
                    value.getMonth(),
                    value.getDate(),
                  );
                  setEndsAt(nextEnd);
                }}
                value={endsAt}
              />
            </View>
            <NativeSeparator inset={16} />
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Starts</Text>
              <DateTimePicker
                disabled={saving}
                display="compact"
                mode="time"
                onChange={(_event, value) => {
                  if (!value) return;
                  const next = new Date(startsAt);
                  next.setHours(value.getHours(), value.getMinutes(), 0, 0);
                  setStartsAt(next);
                }}
                value={startsAt}
              />
            </View>
            <NativeSeparator inset={16} />
            <NativeListRow
              detail="Include a scheduled end"
              showChevron={false}
              symbol="clock"
              title="End time"
              trailing={
                <Switch
                  accessibilityLabel="End time"
                  disabled={saving}
                  onValueChange={setHasEndTime}
                  value={hasEndTime}
                />
              }
            />
            {hasEndTime ? (
              <>
                <NativeSeparator inset={16} />
                <View style={styles.dateRow}>
                  <Text style={styles.dateLabel}>Ends</Text>
                  <DateTimePicker
                    disabled={saving}
                    display="compact"
                    mode="time"
                    onChange={(_event, value) => {
                      if (!value) return;
                      const next = new Date(endsAt);
                      next.setHours(value.getHours(), value.getMinutes(), 0, 0);
                      setEndsAt(next);
                    }}
                    value={endsAt}
                  />
                </View>
              </>
            ) : null}
          </NativeCard>
        </NativeSection>
      </ScrollView>

      <Stack.Title>{editing ? 'Edit Event' : 'New Event'}</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button disabled={saving} onPress={() => router.back()}>
          Cancel
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        {editing ? (
          <Stack.Toolbar.Button
            accessibilityLabel="Delete event"
            disabled={saving}
            icon={toolbarIcon('trash')}
            onPress={confirmDelete}
          />
        ) : null}
        <Stack.Toolbar.Button
          disabled={
            saving ||
            !title.trim() ||
            live.loading ||
            (editing && !event)
          }
          onPress={() => void submit()}
          variant="done"
        >
          {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 22,
    paddingBottom: 40,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  dateLabel: {
    color: nativeColors.label,
    fontSize: 16,
    fontWeight: '600',
  },
  dateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 7,
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
  field: {
    gap: 7,
  },
  form: {
    gap: 18,
    padding: 16,
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
  label: {
    color: nativeColors.secondaryLabel,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  notesInput: {
    minHeight: 96,
  },
  screen: {
    backgroundColor: nativeColors.background,
    flex: 1,
  },
  unavailable: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
});
