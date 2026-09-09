import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Text, nativeColors } from '@/components/native';
import { useNativeReviewActions } from '@/hooks/use-native-review-actions';
import { useApp } from '@/providers/app-provider';

function validTimestamp(value: string) {
  if (!value.trim()) return true;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  return Boolean(match && Number(match[2]) < 60);
}

export default function ReviewCommentRoute() {
  const params = useLocalSearchParams<{ reviewId: string | string[] }>();
  const router = useRouter();
  const { identity, isPreview } = useApp();
  const actions = useNativeReviewActions({ identity, isPreview });
  const reviewId = Array.isArray(params.reviewId)
    ? params.reviewId[0]
    : params.reviewId;
  const [body, setBody] = React.useState('');
  const [timestamp, setTimestamp] = React.useState('');
  const [validationError, setValidationError] = React.useState('');

  const submit = async () => {
    const comment = body.trim();
    if (!comment) {
      setValidationError('Write your feedback before saving.');
      return;
    }
    if (!validTimestamp(timestamp)) {
      setValidationError('Use MM:SS for a video time, for example 00:18.');
      return;
    }

    setValidationError('');
    actions.reset();
    try {
      await actions.addComment(
        reviewId,
        comment,
        timestamp.trim() || 'General',
      );
      router.back();
    } catch {
      // The mutation error is rendered below the fields.
    }
  };

  const errorMessage = validationError || actions.errorMessage;

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
        <View style={styles.intro}>
          <Text selectable style={styles.title}>
            Clear feedback, in context
          </Text>
          <Text selectable style={styles.summary}>
            Add a general note or attach it to a specific moment in the video.
          </Text>
        </View>

        {errorMessage ? (
          <Text
            accessibilityLiveRegion="polite"
            selectable
            style={styles.error}
          >
            {errorMessage}
          </Text>
        ) : null}

        <View style={styles.field}>
          <Text selectable style={styles.label}>
            Comment
          </Text>
          <TextInput
            accessibilityLabel="Comment"
            autoFocus
            editable={!actions.busy}
            multiline
            onChangeText={setBody}
            placeholder="What should change, or what works well?"
            placeholderTextColor={nativeColors.tertiaryLabel}
            style={[styles.input, styles.commentInput]}
            textAlignVertical="top"
            value={body}
          />
        </View>

        <View style={styles.field}>
          <Text selectable style={styles.label}>
            Video time
          </Text>
          <TextInput
            accessibilityLabel="Video time"
            editable={!actions.busy}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            onChangeText={setTimestamp}
            placeholder="Optional · MM:SS"
            placeholderTextColor={nativeColors.tertiaryLabel}
            style={styles.input}
            value={timestamp}
          />
          <Text selectable style={styles.helper}>
            Leave empty for a general comment.
          </Text>
        </View>
      </ScrollView>

      <Stack.Title>Add Comment</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          disabled={actions.busy}
          onPress={() => router.back()}
        >
          Cancel
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          disabled={actions.busy || !body.trim()}
          onPress={() => void submit()}
          variant="done"
        >
          {actions.busy ? 'Saving…' : 'Save'}
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
    paddingBottom: 36,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  intro: {
    gap: 5,
  },
  title: {
    color: nativeColors.label,
    fontFamily: 'OutfitSemiBold',
    fontSize: 21,
    fontWeight: '600',
    lineHeight: 26,
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
  field: {
    gap: 7,
  },
  label: {
    color: nativeColors.label,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    paddingHorizontal: 2,
  },
  input: {
    backgroundColor: nativeColors.card,
    borderCurve: 'continuous',
    borderRadius: 16,
    color: nativeColors.label,
    fontFamily: 'OutfitRegular',
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  commentInput: {
    minHeight: 150,
  },
  helper: {
    color: nativeColors.tertiaryLabel,
    fontSize: 13,
    lineHeight: 17,
    paddingHorizontal: 2,
  },
});
