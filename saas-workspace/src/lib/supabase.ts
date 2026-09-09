import 'react-native-url-polyfill/auto';

import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const nativeStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: process.env.EXPO_OS === 'web',
        persistSession: true,
        storage: process.env.EXPO_OS === 'web' ? undefined : nativeStorage,
      },
    })
  : null;

if (supabase && process.env.EXPO_OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export function createIsolatedSupabaseClient() {
  if (!isSupabaseConfigured) {
    return null;
  }

  return createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
