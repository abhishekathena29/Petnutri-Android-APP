import React from 'react';
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

import { AppColors } from '@/constants/theme';

interface Props extends TextInputProps {
  label: string;
  helper?: string;
}

export const FormField = ({ label, helper, style, ...props }: Props) => (
  <View style={styles.wrapper}>
    <Text style={styles.label}>{label}</Text>
    <TextInput style={[styles.input, style]} placeholderTextColor="#9AA0A6" {...props} />
    {helper ? <Text style={styles.helper}>{helper}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: AppColors.text,
  },
  inputFocused: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.surface,
  },
  helper: {
    fontSize: 12,
    color: '#556070',
    marginTop: 4,
  },
});

