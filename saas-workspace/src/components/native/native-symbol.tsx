import { SymbolView, type SFSymbol, type AndroidSymbol } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import { nativeColors } from './native-colors';

// Keep existing iOS names at call sites while providing real Android symbols.
const androidSymbols: Record<string, AndroidSymbol> = {
  'arrow.down.circle': 'download', 'arrow.left.arrow.right': 'swap_horiz',
  banknote: 'payments', bell: 'notifications', 'bell.badge': 'notifications_active', 'bell.slash': 'notifications_off',
  briefcase: 'work', 'building.2': 'apartment', 'building.2.crop.circle': 'apartment',
  calendar: 'calendar_month', 'calendar.badge.checkmark': 'event_available', 'calendar.badge.clock': 'event', 'calendar.badge.exclamationmark': 'event_busy',
  camera: 'photo_camera', 'camera.filters': 'filter', 'chart.bar.fill': 'bar_chart', 'chart.line.uptrend.xyaxis': 'trending_up', 'chart.xyaxis.line': 'monitoring',
  checklist: 'checklist', 'checklist.unchecked': 'checklist', 'checklist.checked': 'checklist', 'checkmark.bubble': 'mark_chat_read', 'checkmark.circle': 'check_circle',
  'chevron.left': 'chevron_left', 'chevron.right': 'chevron_right', 'circle.fill': 'circle', clock: 'schedule', creditcard: 'credit_card',
  'doc.questionmark': 'help', 'doc.text': 'description', envelope: 'mail', 'exclamationmark.triangle': 'warning', eye: 'visibility',
  flag: 'flag', folder: 'folder', 'folder.fill': 'folder', heart: 'favorite', lock: 'lock', paperclip: 'attach_file',
  person: 'person', 'person.2': 'group', 'person.crop.circle': 'account_circle', 'person.crop.rectangle.stack': 'contacts',
  photo: 'image', 'photo.on.rectangle': 'photo_library', 'play.rectangle': 'video_library', repeat: 'repeat', signature: 'signature',
  'square.stack.3d.up': 'layers', 'text.bubble': 'chat', plus: 'add', xmark: 'close', checkmark: 'check', trash: 'delete', pencil: 'edit',
  house: 'home', ellipsis: 'more_horiz', 'arrow.up.right': 'north_east', 'arrow.clockwise': 'refresh', 'rectangle.portrait.and.arrow.right': 'logout',
};
export interface NativeSymbolProps {
  name: string;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
}
export function NativeSymbol({ name, size = 18, color = nativeColors.secondaryLabel, style }: NativeSymbolProps) {
  const android = androidSymbols[name] ?? androidSymbols[name.replace(/\.fill$/, '')] ?? 'info';
  return <SymbolView accessibilityElementsHidden importantForAccessibility="no-hide-descendants" name={{ ios: name as SFSymbol, android, web: android }} size={size} tintColor={color} style={[{ height: size, width: size }, style]} />;
}
