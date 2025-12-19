import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableWithoutFeedback,
    View
} from 'react-native';

import { FormField } from '@/components/ui/form-field';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedCattle } from '@/contexts/SelectedCattleContext';
import { addUserDocument } from '@/services/firestore';
import { CattleCategory, CattleProfile } from '@/types/models';

const defaultForm = {
  name: '',
  tagId: '',
  type: 'cow' as CattleCategory,
  vaccinated: true,
  country: '',
  breed: '',
  weightKg: '',
  heightCm: '',
  ageYears: '',
  dietGoal: '',
  healthStatus: 'excellent',
  lastVetVisit: '',
  notes: '',
};

export default function SelectProfileScreen() {
  const { user, logout } = useAuth();
  const { cattle, loading, setSelectedCattle, selectedCattle } = useSelectedCattle();
  const router = useRouter();
  const [form, setForm] = useState<typeof defaultForm>(defaultForm);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState('');

  // Clear selected cattle when entering this page to force user to explicitly select
  useEffect(() => {
    setSelectedCattle(null);
  }, []); // Only run once on mount

  const handleBackToLogin = async () => {
    try {
      await logout();
      router.replace('/auth');
    } catch (err) {
      console.error('Logout failed:', err);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  // Date picker state
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const days = Array.from({ length: getDaysInMonth(selectedYear, selectedMonth) }, (_, i) => i + 1);

  const handleChange = (field: keyof typeof defaultForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleDateConfirm = () => {
    const formattedDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    handleChange('lastVetVisit', formattedDate);
    setShowDatePicker(false);
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const openDatePicker = () => {
    if (form.lastVetVisit) {
      const date = new Date(form.lastVetVisit);
      setSelectedYear(date.getFullYear());
      setSelectedMonth(date.getMonth());
      setSelectedDay(date.getDate());
    }
    setShowDatePicker(true);
  };

  const resetForm = () => {
    setForm({ ...defaultForm });
    setShowDatePicker(false);
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!form.name.trim()) {
      setError('Please add at least a name for the cattle.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const cattleName = form.name.trim();
      await addUserDocument(user.uid, 'cattle', {
        ...form,
        weightKg: Number(form.weightKg) || 0,
        heightCm: Number(form.heightCm) || 0,
        ageYears: Number(form.ageYears) || 0,
      });
      
      resetForm();
      setShowCreateModal(false);
      
      // The cattle list will refresh automatically via useUserCollection
      // We'll need to wait for it to update, then select the new cattle
      // For now, just show success and let user select manually
      Alert.alert('Success! 🎉', `${cattleName} has been created. Please select it to continue.`);
    } catch (err) {
      console.error(err);
      setError('Saving cattle failed. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleSelectCattle = (cattleProfile: CattleProfile & { id: string }) => {
    setSelectedCattle(cattleProfile);
    router.replace('/(tabs)');
  };

  const getCattleIcon = (type: CattleCategory) => {
    return type === 'cow' ? '🐄' : '🐴';
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return '#10B981';
      case 'good':
        return '#F59E0B';
      default:
        return '#EF4444';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header with Back Button */}
      <View style={styles.topHeader}>
        <Pressable style={styles.backButton} onPress={handleBackToLogin}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </Pressable>
        <Text style={styles.topHeaderTitle}>Select Profile</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Cattle Profile</Text>
          <Text style={styles.subtitle}>Choose a profile to continue or create a new one</Text>
        </View>

        {/* Create New Profile Card */}
        <Pressable style={styles.addCard} onPress={() => setShowCreateModal(true)}>
          <View style={styles.addCardIcon}>
            <Ionicons name="add" size={32} color="#fff" />
          </View>
          <View style={styles.addCardContent}>
            <Text style={styles.addCardTitle}>Create New Profile</Text>
            <Text style={styles.addCardSubtitle}>Add a new cattle profile</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#94A3B8" />
        </Pressable>

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0a7ea4" />
            <Text style={styles.loadingText}>Loading profiles...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && cattle.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🐮</Text>
            <Text style={styles.emptyTitle}>No profiles yet</Text>
            <Text style={styles.emptySubtitle}>Create your first cattle profile to get started</Text>
          </View>
        )}

        {/* Cattle Profiles List */}
        {!loading && cattle.length > 0 && (
          <View style={styles.profilesList}>
            {cattle.map((item) => (
              <Pressable
                key={item.id}
                style={styles.profileCard}
                onPress={() => handleSelectCattle(item)}
              >
                <View style={styles.profileCardContent}>
                  <View style={styles.profileAvatar}>
                    <Text style={styles.avatarEmoji}>{getCattleIcon(item.type)}</Text>
                  </View>
                  <View style={styles.profileInfo}>
                    <View style={styles.profileHeader}>
                      <Text style={styles.profileName}>{item.name}</Text>
                      <View style={[styles.healthDot, { backgroundColor: getHealthColor(item.healthStatus) }]} />
                    </View>
                    <Text style={styles.profileBreed}>{item.breed || 'Unknown breed'}</Text>
                    <View style={styles.profileMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="scale-outline" size={14} color="#64748B" />
                        <Text style={styles.metaText}>{item.weightKg || '—'} kg</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={14} color="#64748B" />
                        <Text style={styles.metaText}>{item.ageYears || '—'} yrs</Text>
                      </View>
                      {item.vaccinated && (
                        <View style={styles.vaccinatedBadge}>
                          <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                          <Text style={styles.vaccinatedText}>Vaccinated</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#94A3B8" />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create Modal */}
      <Modal visible={showCreateModal} animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', default: undefined })}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <Pressable style={styles.closeButton} onPress={() => { setShowCreateModal(false); resetForm(); }}>
                    <Ionicons name="close" size={24} color="#64748B" />
                  </Pressable>
                  <Text style={styles.modalTitle}>Create Cattle Profile</Text>
                  <View style={{ width: 40 }} />
                </View>

                <View style={styles.toggleRow}>
                  {(['cow', 'horse'] as CattleCategory[]).map((type) => (
                    <Pressable
                      key={type}
                      style={[styles.toggleChip, form.type === type && styles.toggleChipActive]}
                      onPress={() => handleChange('type', type)}
                    >
                      <Text style={styles.toggleEmoji}>{type === 'cow' ? '🐄' : '🐴'}</Text>
                      <Text style={[styles.toggleText, form.type === type && styles.toggleTextActive]}>
                        {type === 'cow' ? 'Cow' : 'Horse'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Basic Information</Text>
                  <FormField label="Name" placeholder="Luna, Bolt..." value={form.name} onChangeText={(text) => handleChange('name', text)} />
                  <FormField label="Tag ID" placeholder="#FR-221" value={form.tagId} onChangeText={(text) => handleChange('tagId', text)} />
                  <FormField label="Country" placeholder="Canada" value={form.country} onChangeText={(text) => handleChange('country', text)} />
                  <FormField label="Breed" placeholder="Holstein Friesian" value={form.breed} onChangeText={(text) => handleChange('breed', text)} />
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Physical Details</Text>
                  <View style={styles.row}>
                    <FormField
                      label="Weight (kg)"
                      placeholder="550"
                      keyboardType="numeric"
                      style={{ flex: 1 }}
                      value={form.weightKg}
                      onChangeText={(text) => handleChange('weightKg', text)}
                    />
                    <View style={{ width: 12 }} />
                    <FormField
                      label="Height (cm)"
                      placeholder="160"
                      keyboardType="numeric"
                      style={{ flex: 1 }}
                      value={form.heightCm}
                      onChangeText={(text) => handleChange('heightCm', text)}
                    />
                  </View>
                  <View style={styles.row}>
                    <FormField
                      label="Age (years)"
                      placeholder="3"
                      keyboardType="numeric"
                      style={{ flex: 1 }}
                      value={form.ageYears}
                      onChangeText={(text) => handleChange('ageYears', text)}
                    />
                    <View style={{ width: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dateLabel}>Last vet visit</Text>
                      <Pressable style={styles.datePickerButton} onPress={openDatePicker}>
                        <Ionicons name="calendar-outline" size={20} color="#64748B" />
                        <Text style={[styles.datePickerText, !form.lastVetVisit && styles.datePickerPlaceholder]}>
                          {form.lastVetVisit ? formatDisplayDate(form.lastVetVisit) : 'Select date'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Care & Notes</Text>
                  <FormField label="Diet goal" placeholder="High-energy lactation plan" value={form.dietGoal} onChangeText={(text) => handleChange('dietGoal', text)} />
                  <FormField label="Notes" placeholder="Any special care instructions" value={form.notes} onChangeText={(text) => handleChange('notes', text)} multiline numberOfLines={3} />
                  
                  <View style={styles.switchRow}>
                    <View style={styles.switchInfo}>
                      <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                      <Text style={styles.switchLabel}>Vaccinated</Text>
                    </View>
                    <Switch
                      value={form.vaccinated}
                      onValueChange={(value) => handleChange('vaccinated', value)}
                      trackColor={{ false: '#E2E8F0', true: '#A7F3D0' }}
                      thumbColor={form.vaccinated ? '#10B981' : '#94A3B8'}
                    />
                  </View>
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable
                  style={[styles.primaryButton, creating && { opacity: 0.6 }]}
                  disabled={creating}
                  onPress={handleCreate}
                >
                  {creating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.primaryText}>Create Profile</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={styles.dateModalOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable style={styles.dateModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dateModalHeader}>
              <Text style={styles.dateModalTitle}>Select Date</Text>
              <Pressable onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>
            
            <View style={styles.datePickerRow}>
              <View style={styles.dateColumn}>
                <Text style={styles.dateColumnLabel}>Month</Text>
                <ScrollView style={styles.dateScrollView} showsVerticalScrollIndicator={false}>
                  {months.map((month, index) => (
                    <Pressable
                      key={month}
                      style={[styles.dateOption, selectedMonth === index && styles.dateOptionSelected]}
                      onPress={() => setSelectedMonth(index)}
                    >
                      <Text style={[styles.dateOptionText, selectedMonth === index && styles.dateOptionTextSelected]}>
                        {month}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.dateColumn}>
                <Text style={styles.dateColumnLabel}>Day</Text>
                <ScrollView style={styles.dateScrollView} showsVerticalScrollIndicator={false}>
                  {days.map((day) => (
                    <Pressable
                      key={day}
                      style={[styles.dateOption, selectedDay === day && styles.dateOptionSelected]}
                      onPress={() => setSelectedDay(day)}
                    >
                      <Text style={[styles.dateOptionText, selectedDay === day && styles.dateOptionTextSelected]}>
                        {day}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.dateColumn}>
                <Text style={styles.dateColumnLabel}>Year</Text>
                <ScrollView style={styles.dateScrollView} showsVerticalScrollIndicator={false}>
                  {years.map((year) => (
                    <Pressable
                      key={year}
                      style={[styles.dateOption, selectedYear === year && styles.dateOptionTextSelected]}
                      onPress={() => setSelectedYear(year)}
                    >
                      <Text style={[styles.dateOptionText, selectedYear === year && styles.dateOptionTextSelected]}>
                        {year}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            <Pressable style={styles.dateConfirmButton} onPress={handleDateConfirm}>
              <Text style={styles.dateConfirmText}>Confirm</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#E0F2FE',
    borderStyle: 'dashed',
    shadowColor: '#0a7ea4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  addCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#0a7ea4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  addCardContent: {
    flex: 1,
  },
  addCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  addCardSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#fff',
    borderRadius: 24,
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  profilesList: {
    gap: 12,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarEmoji: {
    fontSize: 28,
  },
  profileInfo: {
    flex: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  profileBreed: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 6,
  },
  profileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#64748B',
  },
  vaccinatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  vaccinatedText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  modalSafe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalContent: {
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  toggleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  toggleChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0a7ea4',
  },
  toggleEmoji: {
    fontSize: 24,
  },
  toggleText: {
    fontWeight: '700',
    fontSize: 16,
    color: '#64748B',
  },
  toggleTextActive: {
    color: '#0a7ea4',
  },
  formSection: {
    marginBottom: 24,
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  datePickerText: {
    fontSize: 15,
    color: '#0F172A',
    flex: 1,
  },
  datePickerPlaceholder: {
    color: '#94A3B8',
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dateModalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  dateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dateModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  datePickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  dateColumn: {
    flex: 1,
  },
  dateColumnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  dateScrollView: {
    height: 180,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  dateOption: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  dateOptionSelected: {
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  dateOptionText: {
    fontSize: 16,
    color: '#64748B',
  },
  dateOptionTextSelected: {
    color: '#0a7ea4',
    fontWeight: '700',
  },
  dateConfirmButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  dateConfirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  switchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0a7ea4',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 12,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  error: {
    color: '#DC2626',
    marginBottom: 8,
    textAlign: 'center',
  },
});
