import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useUserData } from '@/hooks/use-user-data';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { logout, user } = useAuth();
  const { userData } = useUserData();

  const screenTitles: Record<string, string> = {
    index: 'Home',
    meals: 'Meals',
    pregnancy: 'Pregnant',
    calculator: 'Calculator',
    progress: 'Progress',
  };

  const displayName = userData?.fullName || user?.displayName || user?.email?.split('@')[0] || 'User';

  const doLogout = () => {
    logout().catch((err) => {
      console.error('Logout failed', err);
      Alert.alert('Logout failed', 'Please try again.');
    });
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: doLogout },
      ],
    );
  };

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: true,
        headerTitleAlign: 'left',
        headerStatusBarHeight: 8,
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
        headerRight: () => (
          <View style={styles.headerRight}>
            <Text style={styles.userName}>{displayName}</Text>
            <Pressable style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
        ),
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingVertical: 6,
          height: 70,
        },
        headerTitle: screenTitles[route.name] ?? 'PetNutri',
      })}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="meals"
        options={{
          title: 'Meals',
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="pregnancy"
        options={{
          title: 'Pregnant',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="calculator"
        options={{
          title: 'Calculator',
          tabBarIcon: ({ color, size }) => <Ionicons name="calculator" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#F8FAFC',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 16,
  },
  userName: {
    color: '#0F172A',
    fontWeight: '600',
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  logoutText: {
    color: '#DC2626',
    fontWeight: '600',
  },
});
