import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { AppColors, Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedCattle } from '@/contexts/SelectedCattleContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useUserData } from '@/hooks/use-user-data';
import { useRouter } from 'expo-router';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { logout, user } = useAuth();
  const { userData } = useUserData();
  const { selectedCattle } = useSelectedCattle();
  const router = useRouter();

  const screenTitles: Record<string, string> = {
    index: 'Home',
    meals: 'Meals',
    pregnancy: 'Pregnant',
    calculator: 'Calculator',
    progress: 'Progress',
  };

  const displayName = userData?.fullName || user?.displayName || user?.email?.split('@')[0] || 'User';

  const [showProfileModal, setShowProfileModal] = useState(false);

  const handleProfileSelect = () => {
    setShowProfileModal(true);
  };

  const handleSwitchProfile = () => {
    setShowProfileModal(false);
    router.push('/select-profile');
  };

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
    <>
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: true,
          headerBackVisible: false,
          gestureEnabled: false,
          headerTitleAlign: 'left',
          headerStyle: styles.header,
          headerTitleStyle: styles.headerTitle,
          headerRight: () => (
            <View style={styles.headerRight}>
              {selectedCattle && (
                <Pressable style={styles.profileBtn} onPress={handleProfileSelect}>
                  <Ionicons name="person-circle-outline" size={20} color={AppColors.primary} />
                  <Text style={styles.profileText} numberOfLines={1}>
                    {selectedCattle.name}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={AppColors.primary} />
                </Pressable>
              )}
              <Pressable style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutText}>Logout</Text>
              </Pressable>
            </View>
          ),
          tabBarButton: HapticTab,
          tabBarStyle: {
            backgroundColor: AppColors.surface,
            borderTopWidth: 1,
            borderTopColor: AppColors.border,
            paddingVertical: 6,
            height: 70,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          },
          tabBarInactiveTintColor: AppColors.subtleText,
          tabBarActiveTintColor: AppColors.primary,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
          headerTitle: screenTitles[route.name] ?? 'HerdSync',
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
      {/* Profile Modal */}
      <Modal visible={showProfileModal} transparent animationType="fade" onRequestClose={() => setShowProfileModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowProfileModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {selectedCattle && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Profile Details</Text>
                  <Pressable onPress={() => setShowProfileModal(false)}>
                    <Ionicons name="close" size={24} color={AppColors.subtleText} />
                  </Pressable>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.profileDetailSection}>
                    <View style={[styles.profileAvatarLarge, { backgroundColor: selectedCattle.type === 'cow' ? '#E8EFE9' : '#F5F1E6' }]}>
                      <Text style={styles.profileAvatarEmoji}>{selectedCattle.type === 'cow' ? '🐄' : '🐴'}</Text>
                    </View>
                    <Text style={styles.profileName}>{selectedCattle.name}</Text>
                    <Text style={styles.profileBreed}>{selectedCattle.breed || 'Unknown breed'}</Text>
                    <View style={styles.profileTags}>
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>{selectedCattle.type === 'cow' ? 'Cow' : 'Horse'}</Text>
                      </View>
                      {selectedCattle.vaccinated && (
                        <View style={[styles.tag, styles.tagSuccess]}>
                          <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                          <Text style={[styles.tagText, styles.tagTextSuccess]}>Vaccinated</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.profileStats}>
                    <View style={styles.statItem}>
                      <Ionicons name="scale-outline" size={20} color={AppColors.primary} />
                      <Text style={styles.statLabel}>Weight</Text>
                      <Text style={styles.statValue}>
                        {selectedCattle.weightValue ? `${selectedCattle.weightValue} ${selectedCattle.weightUnit || 'kg'}` : '—'}
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="resize-outline" size={20} color={AppColors.primary} />
                      <Text style={styles.statLabel}>Height</Text>
                      <Text style={styles.statValue}>
                        {selectedCattle.heightValue ? `${selectedCattle.heightValue} ${selectedCattle.heightUnit || 'cm'}` : '—'}
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="calendar-outline" size={20} color={AppColors.primary} />
                      <Text style={styles.statLabel}>Age</Text>
                      <Text style={styles.statValue}>{selectedCattle.ageYears || '—'} yrs</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name={selectedCattle.sex === 'male' ? 'male' : 'female'} size={20} color={AppColors.primary} />
                      <Text style={styles.statLabel}>Gender</Text>
                      <Text style={styles.statValue}>{selectedCattle.sex === 'male' ? '♂ Male' : '♀ Female'}</Text>
                    </View>
                  </View>
                  {selectedCattle.sex === 'female' && selectedCattle.femaleStatus && (
                    <View style={styles.profileInfo}>
                      <Text style={styles.infoLabel}>Female Status</Text>
                      <Text style={styles.infoValue}>
                        {selectedCattle.femaleStatus === 'pregnant' ? '🤰 Pregnant' : selectedCattle.femaleStatus === 'lactating' ? '🥛 Lactating' : 'Not Pregnant'}
                      </Text>
                    </View>
                  )}
                  {selectedCattle.activityLevel && (
                    <View style={styles.profileInfo}>
                      <Text style={styles.infoLabel}>Activity Level</Text>
                      <Text style={styles.infoValue}>
                        {selectedCattle.activityLevel === 'maintenance' ? 'Maintenance' : selectedCattle.activityLevel === 'lightWork' ? 'Light Work' : selectedCattle.activityLevel === 'moderateWork' ? 'Moderate Work' : 'Heavy Work'}
                      </Text>
                    </View>
                  )}
                  {selectedCattle.climateRegion && (
                    <View style={styles.profileInfo}>
                      <Text style={styles.infoLabel}>Climate Region</Text>
                      <Text style={styles.infoValue}>{selectedCattle.climateRegion}</Text>
                    </View>
                  )}
                </ScrollView>
                <Pressable style={styles.switchProfileButton} onPress={handleSwitchProfile}>
                  <Ionicons name="swap-horizontal-outline" size={20} color="#fff" />
                  <Text style={styles.switchProfileText}>Switch Profile</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: AppColors.background,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: AppColors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 16,
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#7A9E7E40',
    backgroundColor: '#7A9E7E10',
    maxWidth: 150,
  },
  profileText: {
    color: AppColors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  logoutText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: AppColors.surface,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text,
  },
  profileDetailSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileAvatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileAvatarEmoji: {
    fontSize: 40,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    color: AppColors.text,
    marginBottom: 4,
  },
  profileBreed: {
    fontSize: 16,
    color: AppColors.subtleText,
    marginBottom: 12,
  },
  profileTags: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#E8EFE9',
  },
  tagSuccess: {
    backgroundColor: '#ECFDF5',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.primary,
  },
  tagTextSuccess: {
    color: '#10B981',
  },
  profileStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: AppColors.background,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: AppColors.subtleText,
    marginTop: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.text,
    marginTop: 2,
  },
  profileInfo: {
    backgroundColor: AppColors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: AppColors.subtleText,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: AppColors.text,
    fontWeight: '600',
  },
  switchProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AppColors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  switchProfileText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

