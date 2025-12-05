import React from 'react';
import { StyleSheet, Text, View, ViewProps } from 'react-native';

interface Props extends ViewProps {
  title: string;
  action?: React.ReactNode;
}

export const SectionCard = ({ title, action, style, children, ...rest }: Props) => (
  <View style={[styles.card, style]} {...rest}>
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {action}
    </View>
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E8EF',
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
});

