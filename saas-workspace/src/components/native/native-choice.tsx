import React, { createContext, useCallback, useContext, useState } from 'react';
import { ActionSheetIOS, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './brand-text';
import { nativeColors } from './native-colors';

type Choice = { label: string; select: () => void };
type ShowChoices = (title: string, choices: Choice[]) => void;
const ChoiceContext = createContext<ShowChoices | null>(null);

/** Android alerts are limited to three actions; a scrollable dialog supports real member/property lists. */
export function NativeChoiceProvider({ children }: React.PropsWithChildren) {
  const [request, setRequest] = useState<{ title: string; choices: Choice[] } | null>(null);
  const insets = useSafeAreaInsets();
  const show = useCallback<ShowChoices>((title, choices) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ title, options: [...choices.map(c => c.label), 'Cancel'], cancelButtonIndex: choices.length }, index => choices[index]?.select());
    } else {
      setRequest({ title, choices });
    }
  }, []);
  const close = () => setRequest(null);
  return (
    <ChoiceContext.Provider value={show}>
      {children}
      <Modal visible={Boolean(request)} transparent animationType="fade" onRequestClose={close}>
        <View style={[styles.backdrop, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          <Pressable accessibilityLabel="Cancel selection" onPress={close} style={StyleSheet.absoluteFill} />
          <View accessibilityViewIsModal style={styles.dialog}>
            <Text accessibilityRole="header" style={styles.title}>{request?.title}</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {request?.choices.map((choice, index) => (
                <Pressable accessibilityRole="button" key={`${choice.label}:${index}`} style={styles.option} onPress={() => { close(); choice.select(); }}>
                  <Text style={styles.label}>{choice.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={close} style={styles.option}><Text style={styles.cancel}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>
    </ChoiceContext.Provider>
  );
}

export function useNativeChoice() {
  const show = useContext(ChoiceContext);
  if (!show) throw new Error('useNativeChoice requires NativeChoiceProvider');
  return <Value,>(title: string, choices: { label: string; value: Value }[], onSelect: (value: Value) => void) => {
    show(title, choices.map(choice => ({ label: choice.label, select: () => onSelect(choice.value) })));
  };
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: '#00000066' },
  dialog: { maxHeight: '85%', width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: nativeColors.card, borderRadius: 16, overflow: 'hidden' },
  title: { fontSize: 20, fontWeight: '600', padding: 20, color: nativeColors.label },
  option: { minHeight: 52, paddingHorizontal: 20, paddingVertical: 16, justifyContent: 'center' },
  label: { fontSize: 16, color: nativeColors.label },
  cancel: { fontSize: 16, color: nativeColors.accent },
});
