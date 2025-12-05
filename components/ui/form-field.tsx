import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

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
    marginBottom: 6,
    color: '#182230',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D0D7DE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#fff',
  },
  helper: {
    fontSize: 12,
    color: '#556070',
    marginTop: 4,
  },
});

