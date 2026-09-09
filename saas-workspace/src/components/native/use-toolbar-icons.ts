import { useEffect, useState } from 'react';
import { Platform, type ImageSourcePropType } from 'react-native';
import { unstable_getMaterialSymbolSourceAsync, type SFSymbol, type AndroidSymbol } from 'expo-symbols';

const names: Record<string, AndroidSymbol> = {
  plus: 'add', pencil: 'edit', trash: 'delete', map: 'map',
  'chevron.left': 'chevron_left', 'text.bubble': 'chat',
  'play.rectangle': 'play_circle', doc: 'description',
  'checkmark.circle': 'check_circle', 'arrow.uturn.backward.circle': 'undo',
  bell: 'notifications', 'bell.badge.fill': 'notifications_active',
};
let sources: Record<string, ImageSourcePropType> = {};
let loading: Promise<void> | undefined;
function load() {
  loading ??= Promise.all(Object.entries(names).map(async ([sf, material]) => {
    const source = await unstable_getMaterialSymbolSourceAsync(material, 24, '#191b22');
    if (source) sources[sf] = source;
  })).then(() => undefined).catch(error => {
    loading = undefined;
    console.warn('Could not load Android toolbar icons', error);
  });
  return loading;
}
/** Expo toolbar SF icon strings are iOS-only; Android requires image sources. */
export function useToolbarIcons() {
  const [icons, setIcons] = useState(sources);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let active = true;
    void load().then(() => { if (active) setIcons({ ...sources }); });
    return () => { active = false; };
  }, []);
  return (name: SFSymbol): SFSymbol | ImageSourcePropType | undefined => Platform.OS === 'ios' ? name : icons[name];
}
