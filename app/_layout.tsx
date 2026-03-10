import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F1EA' }}>
        <ActivityIndicator size="large" color="#7A9E7E" />
      </View>
    );
  }

  return <Slot />;
}

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const errorHandler = (error: Error) => {
      console.error('App error:', error);
      setError(error);
      setHasError(true);
    };

    // Catch unhandled errors
    const originalError = console.error;
    console.error = (...args) => {
      originalError(...args);
      if (args[0] instanceof Error) {
        errorHandler(args[0]);
      }
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  if (hasError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F1EA', padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#DC2626', marginBottom: 12, textAlign: 'center' }}>
          App Error
        </Text>
        <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20 }}>
          {error?.message || 'An unexpected error occurred'}
        </Text>
        <Pressable
          onPress={() => {
            setHasError(false);
            setError(null);
          }}
          style={{ backgroundColor: '#7A9E7E', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ErrorBoundary>
      <AuthProvider>
        <SelectedCattleProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <RootLayoutNav />
            <StatusBar style="dark" translucent backgroundColor="transparent" />
          </ThemeProvider>
        </SelectedCattleProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
