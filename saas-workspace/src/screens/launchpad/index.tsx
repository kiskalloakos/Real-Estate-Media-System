import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/native';

const foundations = [
  'Expo + React Native',
  'iOS-first product',
  'Responsive web target',
  'Ready for JOO and FameScaler modules',
] as const;

export function LaunchpadScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>Realty Media</Text>
        <Text style={styles.title}>The app foundation is ready.</Text>
        <Text style={styles.body}>
          This shared workspace will become the Realty Media iOS app and web app.
          Product decisions can now shape the foundation before feature code lands.
        </Text>

        <View style={styles.list}>
          {foundations.map((foundation) => (
            <View key={foundation} style={styles.row}>
              <View style={styles.dot} />
              <Text style={styles.rowText}>{foundation}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.platform}>
          Running on {Platform.OS === 'web' ? 'web' : 'iOS'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  eyebrow: {
    color: '#5256E0',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2.4,
    marginBottom: 18,
  },
  title: {
    color: '#000000',
    fontSize: 44,
    fontWeight: '600',
    letterSpacing: -1.6,
    lineHeight: 48,
    maxWidth: 620,
  },
  body: {
    color: '#EEEEEE',
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 620,
    marginTop: 20,
  },
  list: {
    borderColor: '#EEEEEE',
    borderRadius: 24,
    borderWidth: 1,
    gap: 18,
    marginTop: 36,
    padding: 24,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  dot: {
    backgroundColor: '#5256E0',
    borderRadius: 16,
    height: 8,
    width: 8,
  },
  rowText: {
    color: '#000000',
    fontSize: 16,
  },
  platform: {
    color: '#000000',
    fontSize: 13,
    marginTop: 28,
  },
});
