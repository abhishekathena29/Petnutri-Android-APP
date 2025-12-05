import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';

interface Props {
  visible: boolean;
}

export const LoadingOverlay = ({ visible }: Props) => (
  <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color="#0a7ea4" />
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#fff',
  },
});

