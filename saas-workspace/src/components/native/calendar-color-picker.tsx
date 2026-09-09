import { Pressable, View } from 'react-native';

import { Text } from './brand-text';
import { nativeColors } from './native-colors';
import { calendarColor, calendarColors, type CalendarColor } from '@/lib/calendar-colors';

export function CalendarColorPicker({ value, type, disabled, onChange }: {
  value?: CalendarColor | null;
  type: string;
  disabled?: boolean;
  onChange: (value: CalendarColor | null) => void;
}) {
  const automatic = calendarColor(null, type);
  const options = [{ id: null, label: `Automatic (${automatic.label})`, color: automatic.color }, ...calendarColors];
  return (
    <View accessibilityLabel="Event color" accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16 }}>
      {options.map((option) => {
        const selected = (value ?? null) === option.id;
        return (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            key={option.id ?? 'auto'}
            onPress={() => onChange(option.id)}
            style={({ pressed }) => ({
              alignItems: 'center', flexDirection: 'row', gap: 8,
              minHeight: 44, paddingHorizontal: 12, paddingVertical: 8,
              borderRadius: 16, borderCurve: 'continuous', borderWidth: 2,
              borderColor: selected ? nativeColors.accent : nativeColors.separator,
              backgroundColor: nativeColors.background,
              opacity: disabled || pressed ? 0.5 : 1,
            })}
          >
            <View style={{ backgroundColor: option.color, width: 16, height: 16, borderRadius: 16 }} />
            <Text style={{ color: nativeColors.label, fontSize: 14, fontWeight: selected ? '600' : '400' }}>
              {selected ? '✓ ' : ''}{option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
