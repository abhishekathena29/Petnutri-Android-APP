import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SelectedCattleProvider, useSelectedCattle } from '@/contexts/SelectedCattleContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEffect } from 'react';

function useProtectedRoute(user: unknown, initializing: boolean, isSigningUp: boolean) {
  const segments = useSegments();
  const router = useRouter();
  const { selectedCattle } = useSelectedCattle();

  useEffect(() => {
    if (initializing) return;

    const inAuthGroup = segments[0] === 'auth';
    const inSelectProfile = segments[0] === 'select-profile';
    const inTabs = segments[0] === '(tabs)';

    if (!user && !inAuthGroup) {
      // Redirect to auth if not logged in
      router.replace('/auth');
    } else if (user && inAuthGroup && !isSigningUp) {
      // After login, always go to select-profile first
      router.replace('/select-profile');
    } else if (user && inTabs && !selectedCattle) {
      // If in tabs but no profile selected, redirect to profile selection
      router.replace('/select-profile');
    }
    // Note: We don't auto-redirect from select-profile even if selectedCattle exists
    // User must explicitly select a profile via handleSelectCattle to proceed
  }, [user, segments, initializing, isSigningUp, selectedCattle, router]);
}

function RootLayoutNav() {
  const { user, initializing, isSigningUp } = useAuth();
  
  useProtectedRoute(user, initializing, isSigningUp);

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <SelectedCattleProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootLayoutNav />
          <StatusBar style="auto" />
        </ThemeProvider>
      </SelectedCattleProvider>
    </AuthProvider>
  );
}
