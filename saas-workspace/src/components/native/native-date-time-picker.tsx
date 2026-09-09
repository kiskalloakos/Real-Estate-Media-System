import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent, type IOSNativeProps } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { Text } from './brand-text';
import { nativeColors } from './native-colors';

type Props = Omit<IOSNativeProps, 'mode'> & { mode?: 'date' | 'time' };
/** Android pickers open on demand, never as a side effect of rendering a form. */
export default function NativeDateTimePicker(props: Props) {
  if (Platform.OS !== 'android') return <DateTimePicker {...props} />;
  const mode = props.mode === 'time' ? 'time' : 'date';
  const label = mode === 'time'
    ? props.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : props.value.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  const open = () => DateTimePickerAndroid.open({
    value: props.value,
    mode,
    minimumDate: props.minimumDate,
    maximumDate: props.maximumDate,
    onChange: (event: DateTimePickerEvent, value?: Date) => {
      if (event.type === 'set' && value) props.onChange?.(event, value);
    },
  });
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={props.accessibilityLabel ?? `Choose ${mode}: ${label}`} accessibilityState={{ disabled: props.disabled }} disabled={props.disabled} onPress={open} style={[styles.control, props.disabled && styles.disabled]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  control: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, backgroundColor: nativeColors.fill, flexShrink: 1 },
  label: { color: nativeColors.accent, fontSize: 16 },
  disabled: { opacity: 0.5 },
});
