import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/ui/form-field';
import { useAuth } from '@/contexts/AuthContext';

type Mode = 'login' | 'signup';

const initialForm = {
  fullName: '',
  email: '',
  password: '',
};

export default function AuthScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const title = mode === 'login' ? 'Welcome back' : 'Create an account';
  const cta = mode === 'login' ? 'Login' : 'Sign up';

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleSubmit = () => {
    if (submitting) return;
    
    setSubmitting(true);
    setError('');
    setSuccess('');
    
    if (mode === 'login') {
      login(form.email, form.password)
        .then(() => {
          // Navigation happens automatically via auth state change
        })
        .catch((err) => {
          console.error(err);
          Alert.alert('Login Failed', 'Incorrect email or password. Please try again.');
          setError('Incorrect email or password.');
        })
        .finally(() => {
          setSubmitting(false);
        });
    } else {
      signup({ email: form.email, password: form.password, fullName: form.fullName })
        .then(() => {
          Alert.alert('Account Created', 'Your account has been created! Please login.');
          setSuccess('Account created! Please login with your credentials.');
          setMode('login');
          setForm({ ...initialForm, email: form.email });
        })
        .catch((err) => {
          console.error(err);
          const msg = (err as Error).message ?? 'Signup failed.';
          Alert.alert('Signup Failed', msg);
          setError(msg);
        })
        .finally(() => {
          setSubmitting(false);
        });
    }
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    setError('');
    setSuccess('');
  };

  const submitDisabled = submitting || !form.email || !form.password || (mode === 'signup' && !form.fullName);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', default: undefined })}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Manage all cattle nutrition insights in one place.</Text>

            {mode === 'signup' && (
              <FormField
                label="Full name"
                value={form.fullName}
                onChangeText={(text) => handleChange('fullName', text)}
                autoCapitalize="words"
                autoComplete="name"
                placeholder="Ex. Olivia Martin"
                returnKeyType="next"
              />
            )}

            <FormField
              label="Email"
              value={form.email}
              onChangeText={(text) => handleChange('email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="you@email.com"
              returnKeyType="next"
            />

            <FormField
              label="Password"
              value={form.password}
              onChangeText={(text) => handleChange('password', text)}
              secureTextEntry
              placeholder="Minimum 6 characters"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {success ? <Text style={styles.success}>{success}</Text> : null}

            <Pressable disabled={submitDisabled} style={[styles.primaryButton, submitDisabled && { opacity: 0.5 }]} onPress={handleSubmit}>
              <Text style={styles.primaryButtonText}>{submitting ? 'Please wait...' : cta}</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={toggleMode}>
              <Text style={styles.secondaryText}>
                {mode === 'login' ? 'New to PetNutri? ' : 'Already registered? '}
                <Text style={styles.switchText}>{mode === 'login' ? 'Create an account' : 'Login instead'}</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#475569',
    marginBottom: 30,
  },
  primaryButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#334155',
    fontSize: 14,
  },
  switchText: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  error: {
    color: '#DC2626',
    marginBottom: 12,
    fontSize: 13,
  },
  success: {
    color: '#16A34A',
    marginBottom: 12,
    fontSize: 13,
  },
});
