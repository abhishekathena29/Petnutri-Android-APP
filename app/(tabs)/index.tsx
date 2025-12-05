import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
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
  View,
} from 'react-native';

import { FormField } from '@/components/ui/form-field';
import { Tag } from '@/components/ui/tag';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCollection } from '@/hooks/use-user-collection';
import { addUserDocument, deleteUserDocument, updateUserDocument } from '@/services/firestore';
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

export default function HerdHomeScreen() {
  const { user } = useAuth();
  const { data: cattle, loading } = useUserCollection<CattleProfile>('cattle', { orderByField: 'createdAt' });
  const [form, setForm] = useState<typeof defaultForm>(defaultForm);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selected, setSelected] = useState<(CattleProfile & { id: string }) | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const grouped = useMemo(() => {
    const base: Record<CattleCategory, Array<CattleProfile & { id: string }>> = {
      cow: [],
      horse: [],
    };
    cattle.forEach((doc) => {
      base[doc.type as CattleCategory]?.push(doc as CattleProfile & { id: string });
    });
    return base;
  }, [cattle]);

  const handleChange = (field: keyof typeof defaultForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
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
      day: 'numeric' 
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
      Alert.alert('Success! 🎉', `${cattleName} has been added to your herd.`);
    } catch (err) {
      console.error(err);
      setError('Saving cattle failed. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (item: CattleProfile & { id: string }) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      tagId: item.tagId || '',
      type: item.type,
      vaccinated: item.vaccinated,
      country: item.country || '',
      breed: item.breed || '',
      weightKg: item.weightKg?.toString() || '',
      heightCm: item.heightCm?.toString() || '',
      ageYears: item.ageYears?.toString() || '',
      dietGoal: item.dietGoal || '',
      healthStatus: item.healthStatus || 'excellent',
      lastVetVisit: item.lastVetVisit || '',
      notes: item.notes || '',
    });
    if (item.lastVetVisit) {
      const date = new Date(item.lastVetVisit);
      setSelectedYear(date.getFullYear());
      setSelectedMonth(date.getMonth());
      setSelectedDay(date.getDate());
    }
    setSelected(null);
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!user || !editingId) return;
    if (!form.name.trim()) {
      setError('Please add at least a name for the cattle.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const cattleName = form.name.trim();
      await updateUserDocument(user.uid, 'cattle', editingId, {
        ...form,
        weightKg: Number(form.weightKg) || 0,
        heightCm: Number(form.heightCm) || 0,
        ageYears: Number(form.ageYears) || 0,
      });
      resetForm();
      setShowEditModal(false);
      setEditingId(null);
      Alert.alert('Updated! ✅', `${cattleName}'s profile has been updated.`);
    } catch (err) {
      console.error(err);
      setError('Updating cattle failed. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (item: CattleProfile & { id: string }) => {
    Alert.alert(
      'Delete Profile',
      `Are you sure you want to delete ${item.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            setDeleting(item.id);
            try {
              await deleteUserDocument(user.uid, 'cattle', item.id);
              setSelected(null);
              Alert.alert('Deleted', `${item.name} has been removed from your herd.`);
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Failed to delete. Please try again.');
            } finally {
              setDeleting(null);
            }
          },
        },
      ]
    );
  };

  const getCattleIcon = (type: CattleCategory) => {
    return type === 'cow' ? '🐄' : '🐴';
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'excellent': return '#10B981';
      case 'good': return '#F59E0B';
      default: return '#EF4444';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back 👋</Text>
            <Text style={styles.title}>Your Herd</Text>
          </View>
          <View style={styles.statsContainer}>
            <View style={styles.statBadge}>
              <Text style={styles.statNumber}>{cattle.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* Add New Cattle Card */}
        <Pressable style={styles.addCard} onPress={() => setShowCreateModal(true)}>
          <View style={styles.addCardIcon}>
            <Ionicons name="add" size={32} color="#fff" />
          </View>
          <View style={styles.addCardContent}>
            <Text style={styles.addCardTitle}>Create Cattle Profile</Text>
            <Text style={styles.addCardSubtitle}>Add a new member to your herd</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#94A3B8" />
        </Pressable>

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0a7ea4" />
            <Text style={styles.loadingText}>Loading your herd...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && cattle.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🐮</Text>
            <Text style={styles.emptyTitle}>No cattle yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the card above to add your first cattle profile
            </Text>
          </View>
        )}

        {/* Cattle Profiles */}
        {!loading && cattle.length > 0 && (
          <>
            {/* Cows Section */}
            {grouped.cow.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>🐄 Cows</Text>
                  <Tag label={`${grouped.cow.length}`} tone="primary" />
                </View>
                {grouped.cow.map((item) => (
                  <View key={item.id} style={styles.profileCard}>
                    <Pressable style={styles.profileCardContent} onPress={() => setSelected(item)}>
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
                    </Pressable>
                    <View style={styles.cardActions}>
                      <Pressable style={styles.actionButton} onPress={() => openEditModal(item)}>
                        <Ionicons name="create-outline" size={20} color="#0a7ea4" />
                      </Pressable>
                      <Pressable 
                        style={[styles.actionButton, styles.deleteButton]} 
                        onPress={() => handleDelete(item)}
                        disabled={deleting === item.id}
                      >
                        {deleting === item.id ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        )}
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Horses Section */}
            {grouped.horse.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>🐴 Horses</Text>
                  <Tag label={`${grouped.horse.length}`} tone="warning" />
                </View>
                {grouped.horse.map((item) => (
                  <View key={item.id} style={styles.profileCard}>
                    <Pressable style={styles.profileCardContent} onPress={() => setSelected(item)}>
                      <View style={[styles.profileAvatar, { backgroundColor: '#FEF3C7' }]}>
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
                    </Pressable>
                    <View style={styles.cardActions}>
                      <Pressable style={styles.actionButton} onPress={() => openEditModal(item)}>
                        <Ionicons name="create-outline" size={20} color="#0a7ea4" />
                      </Pressable>
                      <Pressable 
                        style={[styles.actionButton, styles.deleteButton]} 
                        onPress={() => handleDelete(item)}
                        disabled={deleting === item.id}
                      >
                        {deleting === item.id ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        )}
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Create Modal */}
      <Modal visible={showCreateModal} animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', default: undefined })}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <Pressable style={styles.closeButton} onPress={() => { setShowCreateModal(false); resetForm(); }}>
                    <Ionicons name="close" size={24} color="#64748B" />
                  </Pressable>
                  <Text style={styles.modalTitle}>Create Cattle Profile</Text>
                  <View style={{ width: 40 }} />
                </View>

                {/* Type Toggle */}
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

                {/* Form Fields */}
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
                      <Text style={styles.primaryText}>Save Cattle Profile</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" onRequestClose={() => { setShowEditModal(false); resetForm(); setEditingId(null); }}>
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', default: undefined })}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <Pressable style={styles.closeButton} onPress={() => { setShowEditModal(false); resetForm(); setEditingId(null); }}>
                    <Ionicons name="close" size={24} color="#64748B" />
                  </Pressable>
                  <Text style={styles.modalTitle}>Edit Profile</Text>
                  <View style={{ width: 40 }} />
                </View>

                {/* Type Toggle */}
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

                {/* Form Fields */}
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
                  onPress={handleUpdate}
                >
                  {creating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.primaryText}>Update Profile</Text>
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
              {/* Month Picker */}
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

              {/* Day Picker */}
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

              {/* Year Picker */}
              <View style={styles.dateColumn}>
                <Text style={styles.dateColumnLabel}>Year</Text>
                <ScrollView style={styles.dateScrollView} showsVerticalScrollIndicator={false}>
                  {years.map((year) => (
                    <Pressable
                      key={year}
                      style={[styles.dateOption, selectedYear === year && styles.dateOptionSelected]}
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

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={styles.modalSafe}>
          {selected ? (
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              {/* Detail Header */}
              <View style={styles.modalHeader}>
                <Pressable style={styles.closeButton} onPress={() => setSelected(null)}>
                  <Ionicons name="arrow-back" size={24} color="#64748B" />
                </Pressable>
                <Text style={styles.modalTitle}>Profile Details</Text>
                <View style={{ width: 40 }} />
              </View>

              {/* Profile Hero */}
              <View style={styles.detailHero}>
                <View style={[styles.detailAvatar, { backgroundColor: selected.type === 'cow' ? '#E0F2FE' : '#FEF3C7' }]}>
                  <Text style={styles.detailAvatarEmoji}>{getCattleIcon(selected.type)}</Text>
                </View>
                <Text style={styles.detailName}>{selected.name}</Text>
                <Text style={styles.detailBreed}>{selected.breed || 'Unknown breed'}</Text>
                <View style={styles.detailTags}>
                  <Tag label={selected.type === 'cow' ? 'Cow' : 'Horse'} tone="primary" />
                  <Tag label={selected.vaccinated ? 'Vaccinated' : 'Not vaccinated'} tone={selected.vaccinated ? 'success' : 'warning'} />
                </View>
              </View>

              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Ionicons name="scale-outline" size={24} color="#0a7ea4" />
                  <Text style={styles.statCardValue}>{selected.weightKg || '—'}</Text>
                  <Text style={styles.statCardLabel}>Weight (kg)</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="resize-outline" size={24} color="#0a7ea4" />
                  <Text style={styles.statCardValue}>{selected.heightCm || '—'}</Text>
                  <Text style={styles.statCardLabel}>Height (cm)</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="calendar-outline" size={24} color="#0a7ea4" />
                  <Text style={styles.statCardValue}>{selected.ageYears || '—'}</Text>
                  <Text style={styles.statCardLabel}>Age (years)</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="heart-outline" size={24} color="#0a7ea4" />
                  <Text style={styles.statCardValue}>{selected.healthStatus}</Text>
                  <Text style={styles.statCardLabel}>Health</Text>
                </View>
              </View>

              {/* Details List */}
              <View style={styles.detailsList}>
                <DetailItem icon="pricetag-outline" label="Tag ID" value={selected.tagId || '—'} />
                <DetailItem icon="location-outline" label="Country" value={selected.country || '—'} />
                <DetailItem icon="nutrition-outline" label="Diet Goal" value={selected.dietGoal || '—'} />
                <DetailItem icon="medkit-outline" label="Last Vet Visit" value={selected.lastVetVisit || '—'} />
                {selected.notes && <DetailItem icon="document-text-outline" label="Notes" value={selected.notes} />}
              </View>

              {/* Action Buttons */}
              <View style={styles.detailActions}>
                <Pressable style={styles.editButton} onPress={() => openEditModal(selected)}>
                  <Ionicons name="create-outline" size={20} color="#fff" />
                  <Text style={styles.editButtonText}>Edit Profile</Text>
                </Pressable>
                <Pressable 
                  style={styles.deleteButtonLarge} 
                  onPress={() => handleDelete(selected)}
                  disabled={deleting === selected.id}
                >
                  {deleting === selected.id ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </>
                  )}
                </Pressable>
              </View>

              <Pressable style={styles.secondaryButton} onPress={() => setSelected(null)}>
                <Text style={styles.secondaryText}>Close</Text>
              </Pressable>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const DetailItem = ({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) => (
  <View style={styles.detailItem}>
    <View style={styles.detailItemIcon}>
      <Ionicons name={icon} size={20} color="#64748B" />
    </View>
    <View style={styles.detailItemContent}>
      <Text style={styles.detailItemLabel}>{label}</Text>
      <Text style={styles.detailItemValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0a7ea4',
  },
  statLabel: {
    fontSize: 11,
    color: '#0a7ea4',
    fontWeight: '600',
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
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  profileCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
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
  detailActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0a7ea4',
    paddingVertical: 14,
    borderRadius: 14,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  deleteButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 16,
  },
  detailHero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  detailAvatar: {
    width: 100,
    height: 100,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailAvatarEmoji: {
    fontSize: 52,
  },
  detailName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  detailBreed: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 16,
  },
  detailTags: {
    flexDirection: 'row',
    gap: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statCardValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  statCardLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  detailsList: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  detailItemContent: {
    flex: 1,
  },
  detailItemLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 2,
  },
  detailItemValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
});
