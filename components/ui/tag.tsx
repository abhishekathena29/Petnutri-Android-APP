import React from 'react';
import { StyleSheet, Text, TextProps, View } from 'react-native';

interface Props extends TextProps {
  label: string;
  tone?: 'primary' | 'success' | 'warning';
}

const toneMap = {
  primary: {
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
  },
  success: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
  },
  warning: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
};

export const Tag = ({ label, tone = 'primary', style }: Props) => (
  <View style={[styles.tag, toneMap[tone], style] as any}>
    <Text style={[styles.text, { color: toneMap[tone].color }]}>
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  tag: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});

