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
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormField } from '@/components/ui/form-field';
import { AppColors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedCattle } from '@/contexts/SelectedCattleContext';
import { addUserDocument } from '@/services/firestore';
import { CattleCategory, CattleProfile } from '@/types/models';

// Helper function to convert hex color to rgba
const hexToRgba = (hex: string, opacity: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Helper function to create boxShadow from shadow props
const createBoxShadow = (
  shadowColor: string,
  shadowOffset: { width: number; height: number },
  shadowOpacity: number,
  shadowRadius: number
): string => {
  const color = hexToRgba(shadowColor, shadowOpacity);
  return `${shadowOffset.width}px ${shadowOffset.height}px ${shadowRadius}px 0px ${color}`;
};

const defaultForm = {
  name: '',
  type: 'cow' as CattleCategory,
  breed: '',
  ageYears: '',
  sex: 'male' as 'male' | 'female',
  weightUnit: 'kg' as 'kg' | 'lbs',
  weightValue: '',
  heightUnit: 'cm' as 'hands' | 'cm',
  heightValue: '',
  vaccinated: true,
  femaleStatus: 'notPregnant' as 'pregnant' | 'notPregnant' | 'lactating',
  activityLevel: 'maintenance' as 'maintenance' | 'lightWork' | 'moderateWork' | 'heavyWork',
  climateRegion: '',
};

export default function SelectProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { cattle, loading, setSelectedCattle, selectedCattle } = useSelectedCattle();
  const router = useRouter();
  const [form, setForm] = useState<typeof defaultForm>(defaultForm);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showClimatePicker, setShowClimatePicker] = useState(false);
  const [showPregnancyModal, setShowPregnancyModal] = useState(false);
  const [error, setError] = useState('');

  // Pregnancy form state
  const [pregnancyForm, setPregnancyForm] = useState({
    pregnancyDate: '',
    dueDate: '',
    trimester: 'early' as 'early' | 'mid' | 'late',
    blockedMonths: [] as string[],
  });
  const [showPregnancyDatePicker, setShowPregnancyDatePicker] = useState(false);
  const [pregnancyDateYear, setPregnancyDateYear] = useState(new Date().getFullYear());
  const [pregnancyDateMonth, setPregnancyDateMonth] = useState(new Date().getMonth());
  const [pregnancyDateDay, setPregnancyDateDay] = useState(new Date().getDate());
  const pregnancyMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const climateRegions = [
    'Tropical',
    'Subtropical',
    'Temperate',
    'Continental',
    'Arid',
    'Semi-arid',
    'Mediterranean',
    'Polar',
    'Highland',
  ];

  // Clear selected cattle when entering this page to force user to explicitly select
  useEffect(() => {
    // Call async function without await - we don't need to wait for storage update
    // Wrap in try-catch to prevent errors from breaking the component
    try {
      setSelectedCattle(null).catch((err) => {
        console.error('Error clearing selected cattle:', err);
      });
    } catch (err) {
      console.error('Error in setSelectedCattle:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleChange = (field: keyof typeof defaultForm, value: string | boolean | 'male' | 'female' | 'hands' | 'cm' | 'kg' | 'lbs' | 'pregnant' | 'notPregnant' | 'lactating' | 'maintenance' | 'lightWork' | 'moderateWork' | 'heavyWork') => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');

    // If user selects "pregnant", show pregnancy form modal
    if (field === 'femaleStatus' && value === 'pregnant') {
      setShowPregnancyModal(true);
    }
  };

  const togglePregnancyMonth = (month: string) => {
    setPregnancyForm((prev) => {
      const currentMonths = prev.blockedMonths;
      if (currentMonths.includes(month)) {
        return { ...prev, blockedMonths: currentMonths.filter((m) => m !== month) };
      } else {
        if (currentMonths.length === 0) {
          return { ...prev, blockedMonths: [month] };
        }
        const monthIndex = pregnancyMonths.indexOf(month);
        const firstIndex = pregnancyMonths.indexOf(currentMonths[0]);
        const lastIndex = pregnancyMonths.indexOf(currentMonths[currentMonths.length - 1]);

        if (monthIndex < firstIndex) {
          const newMonths = [];
          for (let i = monthIndex; i <= lastIndex; i++) {
            newMonths.push(pregnancyMonths[i]);
          }
          return { ...prev, blockedMonths: newMonths };
        } else if (monthIndex > lastIndex) {
          const newMonths = [...currentMonths];
          for (let i = lastIndex + 1; i <= monthIndex; i++) {
            newMonths.push(pregnancyMonths[i]);
          }
          return { ...prev, blockedMonths: newMonths };
        } else {
          return { ...prev, blockedMonths: currentMonths.slice(0, currentMonths.indexOf(month) + 1) };
        }
      }
    });
  };

  const formatBlockedMonths = (monthsString: string) => {
    const monthArray = monthsString.split(',').map((m) => m.trim());
    if (monthArray.length === 0) return '—';
    if (monthArray.length === 1) return monthArray[0];
    return `${monthArray[0]} to ${monthArray[monthArray.length - 1]}`;
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

  const calculateBlockedMonths = (pregnancyDateStr: string, trimester: 'early' | 'mid' | 'late', cattleType: 'cow' | 'horse' = 'cow') => {
    if (!pregnancyDateStr) return [];

    try {
      // Parse date properly to avoid timezone issues
      const dateStr = pregnancyDateStr.split('T')[0];
      const [year, month, day] = dateStr.split('-').map(Number);
      const pregnancyDate = new Date(year, month - 1, day);

      const blockedMonths: string[] = [];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      // Determine month range based on trimester and cattle type
      // The pregnancy month itself counts as month 1
      // For cows (9 months): Early: months 1-3 (0-2 offset), Mid: months 4-6 (3-5 offset), Late: months 7-9 (6-8 offset)
      // For horses (12 months): Early: months 1-4 (0-3 offset), Mid: months 5-8 (4-7 offset), Late: months 9-12 (8-11 offset)
      let startMonthOffset = 0;
      let endMonthOffset = cattleType === 'cow' ? 3 : 4; // End is exclusive

      if (trimester === 'mid') {
        startMonthOffset = cattleType === 'cow' ? 3 : 4;
        endMonthOffset = cattleType === 'cow' ? 6 : 8;
      } else if (trimester === 'late') {
        startMonthOffset = cattleType === 'cow' ? 6 : 8;
        endMonthOffset = cattleType === 'cow' ? 9 : 12;
      }

      // Calculate blocked months starting from pregnancy date (month 1)
      for (let i = startMonthOffset; i < endMonthOffset; i++) {
        const monthDate = new Date(pregnancyDate);
        monthDate.setMonth(monthDate.getMonth() + i);
        const monthName = monthNames[monthDate.getMonth()];
        if (!blockedMonths.includes(monthName)) {
          blockedMonths.push(monthName);
        }
      }

      return blockedMonths;
    } catch {
      return [];
    }
  };

  const calculateExpectedDeliveryDate = (pregnancyDateStr: string, cattleType: 'cow' | 'horse' = 'cow') => {
    if (!pregnancyDateStr) return '';
    const pregnancyMonths = cattleType === 'cow' ? 9 : 12;
    // Parse date properly to avoid timezone issues
    const dateStr = pregnancyDateStr.split('T')[0];
    const [year, month, day] = dateStr.split('-').map(Number);
    const pregnancyDate = new Date(year, month - 1, day);
    const expectedDate = new Date(pregnancyDate);
    expectedDate.setMonth(expectedDate.getMonth() + pregnancyMonths);
    return expectedDate.toISOString().split('T')[0];
  };

  const calculateExpectedMonths = (pregnancyDateStr: string, cattleType: 'cow' | 'horse' = 'cow') => {
    if (!pregnancyDateStr) return null;

    const pregnancyMonths = cattleType === 'cow' ? 9 : 12;

    try {
      // Parse date properly to avoid timezone issues
      const dateStr = pregnancyDateStr.split('T')[0];
      const [year, month, day] = dateStr.split('-').map(Number);
      const pregnancyDate = new Date(year, month - 1, day);

      // Calculate expected delivery date (pregnancy date + pregnancy months)
      const expectedDeliveryDate = new Date(pregnancyDate);
      expectedDeliveryDate.setMonth(expectedDeliveryDate.getMonth() + pregnancyMonths);

      // Calculate 15 days before and after the expected delivery date
      const dayBefore = new Date(expectedDeliveryDate);
      dayBefore.setDate(dayBefore.getDate() - 15);

      const dayAfter = new Date(expectedDeliveryDate);
      dayAfter.setDate(dayAfter.getDate() + 15);

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      // Get the months for the range (15 days before to 15 days after)
      const beforeMonth = dayBefore.getMonth();
      const beforeYear = dayBefore.getFullYear();
      const afterMonth = dayAfter.getMonth();
      const afterYear = dayAfter.getFullYear();

      // Always show the actual months that the range spans (15 days before to 15 days after)
      const firstMonth = monthNames[beforeMonth];
      const secondMonth = monthNames[afterMonth];

      return {
        months: [firstMonth, secondMonth],
        years: [beforeYear, afterYear],
        display: `${firstMonth} ${beforeYear} to ${secondMonth} ${afterYear}`
      };
    } catch {
      return null;
    }
  };

  const handlePregnancyDateConfirm = () => {
    const formattedDate = `${pregnancyDateYear}-${String(pregnancyDateMonth + 1).padStart(2, '0')}-${String(pregnancyDateDay).padStart(2, '0')}`;
    const cattleType = form.type || 'cow';
    const blockedMonths = calculateBlockedMonths(formattedDate, pregnancyForm.trimester, cattleType);
    const dueDate = calculateExpectedDeliveryDate(formattedDate, cattleType);

    setPregnancyForm((prev) => ({
      ...prev,
      pregnancyDate: formattedDate,
      dueDate: dueDate,
      blockedMonths: blockedMonths
    }));
    setShowPregnancyDatePicker(false);

    // Update selected date picker values if pregnancy date exists
    if (formattedDate) {
      const date = new Date(formattedDate);
      setPregnancyDateYear(date.getFullYear());
      setPregnancyDateMonth(date.getMonth());
      setPregnancyDateDay(date.getDate());
    }
  };

  // Update blocked months when trimester changes
  useEffect(() => {
    if (pregnancyForm.pregnancyDate) {
      const cattleType = form.type || 'cow';
      const blockedMonths = calculateBlockedMonths(pregnancyForm.pregnancyDate, pregnancyForm.trimester, cattleType);
      setPregnancyForm((prev) => ({ ...prev, blockedMonths }));
    }
  }, [pregnancyForm.trimester, form.type]);

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };


  const resetForm = () => {
    setForm({ ...defaultForm });
    setPregnancyForm({ pregnancyDate: '', dueDate: '', trimester: 'early', blockedMonths: [] });
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
      const profileData: any = {
        name: cattleName,
        type: form.type,
        breed: form.breed.trim(),
        ageYears: Number(form.ageYears) || 0,
        sex: form.sex,
        weightUnit: form.weightUnit,
        weightValue: Number(form.weightValue) || 0,
        heightUnit: form.heightUnit,
        heightValue: Number(form.heightValue) || 0,
        vaccinated: form.vaccinated,
        activityLevel: form.activityLevel,
        climateRegion: form.climateRegion,
      };

      // Only include femaleStatus if sex is female
      if (form.sex === 'female') {
        profileData.femaleStatus = form.femaleStatus;
      }

      // Create the cattle profile
      const cattleRef = await addUserDocument(user.uid, 'cattle', profileData);
      const cattleId = cattleRef.id;

      // If female and pregnant, and pregnancy form is filled, create pregnancy plan
      if (form.sex === 'female' && form.femaleStatus === 'pregnant' && pregnancyForm.pregnancyDate && pregnancyForm.blockedMonths.length > 0) {
        try {
          await addUserDocument(user.uid, 'pregnancy', {
            cattleId: cattleId,
            cattleName: cattleName,
            dueDate: pregnancyForm.dueDate || calculateExpectedDeliveryDate(pregnancyForm.pregnancyDate),
            trimester: pregnancyForm.trimester,
            blockedMonth: pregnancyForm.blockedMonths.join(','),
            todo: '',
            nutritionFocus: '',
            calendarDate: '',
          });
        } catch (pregnancyErr) {
          console.error('Failed to save pregnancy plan:', pregnancyErr);
          // Don't fail the whole operation if pregnancy save fails
        }
      }

      resetForm();
      setShowCreateModal(false);
      setShowPregnancyModal(false);
      setPregnancyForm({ pregnancyDate: '', dueDate: '', trimester: 'early', blockedMonths: [] });

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


  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Header with Logout */}
      <View style={[styles.topHeader, { paddingTop: insets.top }]}>
        <Text style={styles.topHeaderTitle}>HerdSync</Text>
        <Pressable onPress={handleBackToLogin} style={({ pressed }) => [styles.logoutButton, pressed && { opacity: 0.7 }]}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Select Profile</Text>
          <Text style={styles.subtitle}>Choose a profile to continue or create a new one</Text>
        </View>

        {/* Create New Profile Card */}
        <Pressable style={styles.addCard} onPress={() => setShowCreateModal(true)}>
          <View style={styles.addCardIcon}>
            <Ionicons name="add" size={32} color={AppColors.primary} />
          </View>
          <View style={styles.addCardContent}>
            <Text style={styles.addCardTitle}>Create New Profile</Text>
            <Text style={styles.addCardSubtitle}>Add a new cattle profile</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={AppColors.subtleText} />
        </Pressable>

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={AppColors.primary} />
            <Text style={styles.loadingText}>Loading profiles...</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && cattle.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>🐮</Text>
            </View>
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
                  <View style={[styles.profileAvatar, { backgroundColor: item.type === 'cow' ? '#E8EFE9' : '#F5F1E6' }]}>
                    <Text style={styles.avatarEmoji}>{getCattleIcon(item.type)}</Text>
                  </View>
                  <View style={styles.profileInfo}>
                    <View style={styles.profileHeader}>
                      <Text style={styles.profileName}>{item.name}</Text>
                      <Text style={[styles.metaText, { color: AppColors.subtleText, fontSize: 13 }]}>{item.sex === 'male' ? '♂' : '♀'}</Text>
                    </View>
                    <Text style={styles.profileBreed}>{item.breed || 'Unknown breed'}</Text>
                    <View style={styles.profileMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="scale-outline" size={14} color={AppColors.subtleText} />
                        <Text style={styles.metaText}>{item.weightValue || '—'} {item.weightUnit || 'kg'}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="calendar-outline" size={14} color={AppColors.subtleText} />
                        <Text style={styles.metaText}>{item.ageYears || '—'} yrs</Text>
                      </View>
                      {item.sex === 'female' && item.femaleStatus && (
                        <View style={[
                          styles.femaleStatusBadge,
                          item.femaleStatus === 'pregnant' ? styles.pregnantBadge : styles.lactatingBadge
                        ]}>
                          <Text style={[
                            styles.femaleStatusText,
                            item.femaleStatus === 'pregnant' ? styles.pregnantText : styles.lactatingText
                          ]}>
                            {item.femaleStatus === 'pregnant' ? '🤰' : item.femaleStatus === 'lactating' ? '🥛' : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={24} color={AppColors.subtleText} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create Modal */}
      <Modal visible={showCreateModal} animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', default: undefined })}>
            {Platform.OS === 'web' ? (
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <Pressable style={styles.closeButton} onPress={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}>
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
                  <FormField label="Breed" placeholder="Holstein Friesian" value={form.breed} onChangeText={(text) => handleChange('breed', text)} />
                  <FormField
                    label="Age (years)"
                    placeholder="3"
                    keyboardType="numeric"
                    value={form.ageYears}
                    onChangeText={(text) => handleChange('ageYears', text)}
                  />
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Sex</Text>
                  <View style={styles.toggleRow}>
                    {(['male', 'female'] as const).map((sex) => (
                      <Pressable
                        key={sex}
                        style={[styles.toggleChip, form.sex === sex && styles.toggleChipActive]}
                        onPress={() => handleChange('sex', sex)}
                      >
                        <Text style={[styles.toggleText, form.sex === sex && styles.toggleTextActive]}>
                          {sex === 'male' ? '♂ Male' : '♀ Female'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Physical Details</Text>
                  <View style={styles.row}>
                    <FormField
                      label={`Body Weight (${form.weightUnit})`}
                      placeholder={form.weightUnit === 'kg' ? '550' : '1212'}
                      keyboardType="numeric"
                      style={{ flex: 1 }}
                      value={form.weightValue}
                      onChangeText={(text) => handleChange('weightValue', text)}
                    />
                    <View style={{ width: 12 }} />
                    <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 12 }}>
                      <View style={styles.toggleRow}>
                        {(['kg', 'lbs'] as const).map((unit) => (
                          <Pressable
                            key={unit}
                            style={[styles.toggleChipSmall, form.weightUnit === unit && styles.toggleChipActive]}
                            onPress={() => handleChange('weightUnit', unit)}
                          >
                            <Text style={[styles.toggleTextSmall, form.weightUnit === unit && styles.toggleTextActive]}>
                              {unit.toUpperCase()}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>
                  <View style={styles.row}>
                    <FormField
                      label={`Height (${form.heightUnit === 'hands' ? 'hands' : 'cm'})`}
                      placeholder={form.heightUnit === 'hands' ? '15.2' : '160'}
                      keyboardType="numeric"
                      style={{ flex: 1 }}
                      value={form.heightValue}
                      onChangeText={(text) => handleChange('heightValue', text)}
                    />
                    <View style={{ width: 12 }} />
                    <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 12 }}>
                      <View style={styles.toggleRow}>
                        {(['hands', 'cm'] as const).map((unit) => (
                          <Pressable
                            key={unit}
                            style={[styles.toggleChipSmall, form.heightUnit === unit && styles.toggleChipActive]}
                            onPress={() => handleChange('heightUnit', unit)}
                          >
                            <Text style={[styles.toggleTextSmall, form.heightUnit === unit && styles.toggleTextActive]}>
                              {unit.toUpperCase()}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>
                </View>

                {form.sex === 'female' && (
                  <View style={styles.formSection}>
                    <Text style={styles.formSectionTitle}>Female Status</Text>
                    <View style={styles.toggleRow}>
                      {(['pregnant', 'notPregnant', 'lactating'] as const).map((status) => (
                        <Pressable
                          key={status}
                          style={[
                            styles.toggleChip,
                            styles.toggleChipResponsive,
                            form.femaleStatus === status && styles.toggleChipActive
                          ]}
                          onPress={() => handleChange('femaleStatus', status)}
                        >
                          <Text
                            style={[styles.toggleText, form.femaleStatus === status && styles.toggleTextActive]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.85}
                          >
                            {status === 'pregnant' ? '🤰 Pregnant' : status === 'lactating' ? '🥛 Lactating' : 'Not Pregnant'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Activity Level</Text>
                  <View style={styles.toggleRow}>
                    {(['maintenance', 'lightWork', 'moderateWork', 'heavyWork'] as const).map((level) => (
                      <Pressable
                        key={level}
                        style={[
                          styles.toggleChip,
                          styles.toggleChipResponsive,
                          form.activityLevel === level && styles.toggleChipActive
                        ]}
                        onPress={() => handleChange('activityLevel', level)}
                      >
                        <Text
                          style={[styles.toggleText, form.activityLevel === level && styles.toggleTextActive]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.85}
                        >
                          {level === 'maintenance' ? 'Maintenance' : level === 'lightWork' ? 'Light Work' : level === 'moderateWork' ? 'Moderate Work' : 'Heavy Work'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Climate / Region</Text>
                  <Pressable style={styles.dropdownButton} onPress={() => setShowClimatePicker(true)}>
                    <Text style={[styles.dropdownText, !form.climateRegion && styles.dropdownPlaceholder]}>
                      {form.climateRegion || 'Select climate region'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#64748B" />
                  </Pressable>
                  <Text style={styles.helperText}>Heat affects water & electrolytes requirements</Text>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Care</Text>
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
            ) : (
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={styles.modalHeader}>
                    <Pressable style={styles.closeButton} onPress={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}>
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
                    <FormField label="Breed" placeholder="Holstein Friesian" value={form.breed} onChangeText={(text) => handleChange('breed', text)} />
                    <FormField
                      label="Age (years)"
                      placeholder="3"
                      keyboardType="numeric"
                      value={form.ageYears}
                      onChangeText={(text) => handleChange('ageYears', text)}
                    />
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.formSectionTitle}>Sex</Text>
                    <View style={styles.toggleRow}>
                      {(['male', 'female'] as const).map((sex) => (
                        <Pressable
                          key={sex}
                          style={[styles.toggleChip, form.sex === sex && styles.toggleChipActive]}
                          onPress={() => handleChange('sex', sex)}
                        >
                          <Text style={[styles.toggleText, form.sex === sex && styles.toggleTextActive]}>
                            {sex === 'male' ? '♂ Male' : '♀ Female'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.formSectionTitle}>Physical Details</Text>
                    <View style={styles.row}>
                      <FormField
                        label={`Body Weight (${form.weightUnit})`}
                        placeholder={form.weightUnit === 'kg' ? '550' : '1212'}
                        keyboardType="numeric"
                        style={{ flex: 1 }}
                        value={form.weightValue}
                        onChangeText={(text) => handleChange('weightValue', text)}
                      />
                      <View style={{ width: 12 }} />
                      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 12 }}>
                        <View style={styles.toggleRow}>
                          {(['kg', 'lbs'] as const).map((unit) => (
                            <Pressable
                              key={unit}
                              style={[styles.toggleChipSmall, form.weightUnit === unit && styles.toggleChipActive]}
                              onPress={() => handleChange('weightUnit', unit)}
                            >
                              <Text style={[styles.toggleTextSmall, form.weightUnit === unit && styles.toggleTextActive]}>
                                {unit.toUpperCase()}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    </View>
                    <View style={styles.row}>
                      <FormField
                        label={`Height (${form.heightUnit === 'hands' ? 'hands' : 'cm'})`}
                        placeholder={form.heightUnit === 'hands' ? '15.2' : '160'}
                        keyboardType="numeric"
                        style={{ flex: 1 }}
                        value={form.heightValue}
                        onChangeText={(text) => handleChange('heightValue', text)}
                      />
                      <View style={{ width: 12 }} />
                      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 12 }}>
                        <View style={styles.toggleRow}>
                          {(['hands', 'cm'] as const).map((unit) => (
                            <Pressable
                              key={unit}
                              style={[styles.toggleChipSmall, form.heightUnit === unit && styles.toggleChipActive]}
                              onPress={() => handleChange('heightUnit', unit)}
                            >
                              <Text style={[styles.toggleTextSmall, form.heightUnit === unit && styles.toggleTextActive]}>
                                {unit.toUpperCase()}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    </View>
                  </View>

                  {form.sex === 'female' && (
                    <View style={styles.formSection}>
                      <Text style={styles.formSectionTitle}>Female Status</Text>
                      <View style={styles.toggleRow}>
                        {(['pregnant', 'notPregnant', 'lactating'] as const).map((status) => (
                          <Pressable
                            key={status}
                            style={[styles.toggleChip, form.femaleStatus === status && styles.toggleChipActive]}
                            onPress={() => handleChange('femaleStatus', status)}
                          >
                            <Text style={[styles.toggleText, form.femaleStatus === status && styles.toggleTextActive]}>
                              {status === 'pregnant' ? '🤰 Pregnant' : status === 'lactating' ? '🥛 Lactating' : 'Not Pregnant'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  <View style={styles.formSection}>
                    <Text style={styles.formSectionTitle}>Activity Level</Text>
                    <View style={styles.toggleRow}>
                      {(['maintenance', 'lightWork', 'moderateWork', 'heavyWork'] as const).map((level) => (
                        <Pressable
                          key={level}
                          style={[styles.toggleChip, form.activityLevel === level && styles.toggleChipActive]}
                          onPress={() => handleChange('activityLevel', level)}
                        >
                          <Text style={[styles.toggleText, form.activityLevel === level && styles.toggleTextActive]}>
                            {level === 'maintenance' ? 'Maintenance' : level === 'lightWork' ? 'Light Work' : level === 'moderateWork' ? 'Moderate Work' : 'Heavy Work'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.formSectionTitle}>Climate / Region</Text>
                    <Pressable style={styles.dropdownButton} onPress={() => setShowClimatePicker(true)}>
                      <Text style={[styles.dropdownText, !form.climateRegion && styles.dropdownPlaceholder]}>
                        {form.climateRegion || 'Select climate region'}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#64748B" />
                    </Pressable>
                    <Text style={styles.helperText}>Heat affects water & electrolytes requirements</Text>
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.formSectionTitle}>Care</Text>
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
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Climate Region Picker Modal */}
      <Modal visible={showClimatePicker} transparent animationType="fade" onRequestClose={() => setShowClimatePicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowClimatePicker(false)}>
          <Pressable style={styles.pickerModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Climate Region</Text>
              <Pressable onPress={() => setShowClimatePicker(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView style={styles.pickerScrollView} showsVerticalScrollIndicator={false}>
              {climateRegions.map((region) => (
                <Pressable
                  key={region}
                  style={[styles.pickerOption, form.climateRegion === region && styles.pickerOptionSelected]}
                  onPress={() => {
                    handleChange('climateRegion', region);
                    setShowClimatePicker(false);
                  }}
                >
                  <Text style={[styles.pickerOptionText, form.climateRegion === region && styles.pickerOptionTextSelected]}>
                    {region}
                  </Text>
                  {form.climateRegion === region && (
                    <Ionicons name="checkmark" size={20} color="#0a7ea4" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Pregnancy Form Modal */}
      <Modal visible={showPregnancyModal} animationType="slide" onRequestClose={() => setShowPregnancyModal(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', default: undefined })}>
            {Platform.OS === 'web' ? (
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <Pressable style={styles.closeButton} onPress={() => setShowPregnancyModal(false)}>
                    <Ionicons name="close" size={24} color="#64748B" />
                  </Pressable>
                  <Text style={styles.modalTitle}>Pregnancy Plan</Text>
                  <View style={{ width: 40 }} />
                </View>

                {!pregnancyForm.pregnancyDate && (
                  <Text style={[styles.helperText, { marginBottom: 16, paddingHorizontal: 4 }]}>
                    Please select the pregnancy date first. Months will be automatically blocked based on the trimester.
                  </Text>
                )}

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Trimester</Text>
                  <View style={styles.toggleRow}>
                    {(['early', 'mid', 'late'] as const).map((trimester) => (
                      <Pressable
                        key={trimester}
                        style={[styles.toggleChip, pregnancyForm.trimester === trimester && styles.toggleChipActive]}
                        onPress={() => setPregnancyForm((prev) => ({ ...prev, trimester }))}
                      >
                        <Text style={[styles.toggleText, pregnancyForm.trimester === trimester && styles.toggleTextActive]}>
                          {trimester.charAt(0).toUpperCase() + trimester.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.formSection}>
                  <Text style={styles.formSectionTitle}>Pregnancy Date</Text>
                  <Pressable style={styles.datePickerButton} onPress={() => setShowPregnancyDatePicker(true)}>
                    <Text style={[styles.datePickerText, !pregnancyForm.pregnancyDate && styles.datePickerPlaceholder]}>
                      {pregnancyForm.pregnancyDate ? formatDisplayDate(pregnancyForm.pregnancyDate) : 'Select pregnancy date'}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#64748B" />
                  </Pressable>
                </View>

                {pregnancyForm.pregnancyDate && (
                  <View style={styles.formSection}>
                    <View style={styles.expectedMonthCard}>
                      <View style={styles.expectedMonthHeader}>
                        <Ionicons name="calendar" size={20} color="#0a7ea4" />
                        <Text style={styles.expectedMonthTitle}>Expected Delivery Month</Text>
                      </View>
                      {(() => {
                        const cattleType = form.type || 'cow';
                        const expectedMonths = calculateExpectedMonths(pregnancyForm.pregnancyDate, cattleType);
                        return expectedMonths ? (
                          <Text style={styles.expectedMonthValue}>{expectedMonths.display}</Text>
                        ) : null;
                      })()}
                      <Text style={styles.disclaimerText}>
                        ⚠️ Note: This is an estimate and not a guarantee. Actual delivery may vary.
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.formSection}>
                  <View style={styles.blockedMonthsHeader}>
                    <View>
                      <Text style={styles.formSectionTitle}>Blocked Months</Text>
                      <Text style={styles.helperText}>
                        {pregnancyForm.trimester === 'early' ? 'Months 0-3' : pregnancyForm.trimester === 'mid' ? 'Months 3-6' : 'Months 6-9'} from pregnancy date
                      </Text>
                    </View>
                    {pregnancyForm.blockedMonths.length > 0 && (
                      <View style={styles.blockedCountBadge}>
                        <Text style={styles.blockedCountText}>{pregnancyForm.blockedMonths.length}</Text>
                      </View>
                    )}
                  </View>

                  {pregnancyForm.pregnancyDate ? (
                    <>
                      <View style={styles.monthsGrid}>
                        {pregnancyMonths.map((month) => {
                          const isBlocked = pregnancyForm.blockedMonths.includes(month);
                          return (
                            <View
                              key={month}
                              style={[
                                styles.monthChipNew,
                                isBlocked ? styles.monthChipBlocked : styles.monthChipAvailable
                              ]}
                            >
                              {isBlocked && (
                                <Ionicons name="lock-closed" size={14} color="#92400E" style={{ marginRight: 4 }} />
                              )}
                              <Text style={[
                                styles.monthChipTextNew,
                                isBlocked ? styles.monthChipTextBlocked : styles.monthChipTextAvailable
                              ]}>
                                {month}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                      {pregnancyForm.blockedMonths.length > 0 && (
                        <View style={styles.blockedMonthsSummary}>
                          <Ionicons name="information-circle" size={18} color="#D97706" />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.blockedMonthsLabel}>Blocked Period</Text>
                            <Text style={styles.blockedMonthsText}>
                              {formatBlockedMonths(pregnancyForm.blockedMonths.join(','))}
                            </Text>
                          </View>
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={styles.emptyStateBox}>
                      <Ionicons name="calendar-outline" size={32} color="#CBD5E1" />
                      <Text style={styles.emptyStateText}>Select pregnancy date to calculate blocked months</Text>
                    </View>
                  )}
                </View>

                <Pressable style={styles.secondaryButton} onPress={() => setShowPregnancyModal(false)}>
                  <Text style={styles.secondaryButtonText}>Done</Text>
                </Pressable>
              </ScrollView>
            ) : (
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={styles.modalHeader}>
                    <Pressable style={styles.closeButton} onPress={() => setShowPregnancyModal(false)}>
                      <Ionicons name="close" size={24} color="#64748B" />
                    </Pressable>
                    <Text style={styles.modalTitle}>Pregnancy Plan</Text>
                    <View style={{ width: 40 }} />
                  </View>

                  {!pregnancyForm.pregnancyDate && (
                    <Text style={[styles.helperText, { marginBottom: 16, paddingHorizontal: 4 }]}>
                      Please select the pregnancy date first. Months will be automatically blocked based on the trimester.
                    </Text>
                  )}

                  <View style={styles.formSection}>
                    <Text style={styles.formSectionTitle}>Trimester</Text>
                    <View style={styles.toggleRow}>
                      {(['early', 'mid', 'late'] as const).map((trimester) => (
                        <Pressable
                          key={trimester}
                          style={[styles.toggleChip, pregnancyForm.trimester === trimester && styles.toggleChipActive]}
                          onPress={() => setPregnancyForm((prev) => ({ ...prev, trimester }))}
                        >
                          <Text style={[styles.toggleText, pregnancyForm.trimester === trimester && styles.toggleTextActive]}>
                            {trimester.charAt(0).toUpperCase() + trimester.slice(1)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.formSection}>
                    <Text style={styles.formSectionTitle}>Pregnancy Date</Text>
                    <Pressable style={styles.datePickerButton} onPress={() => setShowPregnancyDatePicker(true)}>
                      <Text style={[styles.datePickerText, !pregnancyForm.pregnancyDate && styles.datePickerPlaceholder]}>
                        {pregnancyForm.pregnancyDate ? formatDisplayDate(pregnancyForm.pregnancyDate) : 'Select pregnancy date'}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color="#64748B" />
                    </Pressable>
                  </View>

                  {pregnancyForm.pregnancyDate && (
                    <View style={styles.formSection}>
                      <View style={styles.expectedMonthCard}>
                        <View style={styles.expectedMonthHeader}>
                          <Ionicons name="calendar" size={20} color="#0a7ea4" />
                          <Text style={styles.expectedMonthTitle}>Expected Delivery Month</Text>
                        </View>
                        {(() => {
                          const cattleType = form.type || 'cow';
                          const expectedMonths = calculateExpectedMonths(pregnancyForm.pregnancyDate, cattleType);
                          return expectedMonths ? (
                            <Text style={styles.expectedMonthValue}>{expectedMonths.display}</Text>
                          ) : null;
                        })()}
                        <Text style={styles.disclaimerText}>
                          ⚠️ Note: This is an estimate and not a guarantee. Actual delivery may vary.
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.formSection}>
                    <View style={styles.blockedMonthsHeader}>
                      <View>
                        <Text style={styles.formSectionTitle}>Blocked Months</Text>
                        <Text style={styles.helperText}>
                          {pregnancyForm.trimester === 'early' ? 'Months 0-3' : pregnancyForm.trimester === 'mid' ? 'Months 3-6' : 'Months 6-9'} from pregnancy date
                        </Text>
                      </View>
                      {pregnancyForm.blockedMonths.length > 0 && (
                        <View style={styles.blockedCountBadge}>
                          <Text style={styles.blockedCountText}>{pregnancyForm.blockedMonths.length}</Text>
                        </View>
                      )}
                    </View>

                    {pregnancyForm.pregnancyDate ? (
                      <>
                        <View style={styles.monthsGrid}>
                          {pregnancyMonths.map((month) => {
                            const isBlocked = pregnancyForm.blockedMonths.includes(month);
                            return (
                              <View
                                key={month}
                                style={[
                                  styles.monthChipNew,
                                  isBlocked ? styles.monthChipBlocked : styles.monthChipAvailable
                                ]}
                              >
                                {isBlocked && (
                                  <Ionicons name="lock-closed" size={14} color="#92400E" style={{ marginRight: 4 }} />
                                )}
                                <Text style={[
                                  styles.monthChipTextNew,
                                  isBlocked ? styles.monthChipTextBlocked : styles.monthChipTextAvailable
                                ]}>
                                  {month}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                        {pregnancyForm.blockedMonths.length > 0 && (
                          <View style={styles.blockedMonthsSummary}>
                            <Ionicons name="information-circle" size={18} color="#D97706" />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.blockedMonthsLabel}>Blocked Period</Text>
                              <Text style={styles.blockedMonthsText}>
                                {formatBlockedMonths(pregnancyForm.blockedMonths.join(','))}
                              </Text>
                            </View>
                          </View>
                        )}
                      </>
                    ) : (
                      <View style={styles.emptyStateBox}>
                        <Ionicons name="calendar-outline" size={32} color="#CBD5E1" />
                        <Text style={styles.emptyStateText}>Select pregnancy date to calculate blocked months</Text>
                      </View>
                    )}
                  </View>

                  <Pressable style={styles.secondaryButton} onPress={() => setShowPregnancyModal(false)}>
                    <Text style={styles.secondaryButtonText}>Done</Text>
                  </Pressable>
                </ScrollView>
              </TouchableWithoutFeedback>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Pregnancy Date Picker Modal */}
      <Modal visible={showPregnancyDatePicker} transparent animationType="fade" onRequestClose={() => setShowPregnancyDatePicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowPregnancyDatePicker(false)}>
          <Pressable style={styles.dateModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dateModalHeader}>
              <Text style={styles.dateModalTitle}>Select Pregnancy Date</Text>
              <Pressable onPress={() => setShowPregnancyDatePicker(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            <View style={styles.datePickerRow}>
              <View style={styles.dateColumn}>
                <Text style={styles.dateColumnLabel}>Month</Text>
                <ScrollView style={styles.dateScrollView} showsVerticalScrollIndicator={false}>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => (
                    <Pressable
                      key={month}
                      style={[styles.dateOption, pregnancyDateMonth === index && styles.dateOptionSelected]}
                      onPress={() => setPregnancyDateMonth(index)}
                    >
                      <Text style={[styles.dateOptionText, pregnancyDateMonth === index && styles.dateOptionTextSelected]}>
                        {month}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.dateColumn}>
                <Text style={styles.dateColumnLabel}>Day</Text>
                <ScrollView style={styles.dateScrollView} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: getDaysInMonth(pregnancyDateYear, pregnancyDateMonth) }, (_, i) => i + 1).map((day) => (
                    <Pressable
                      key={day}
                      style={[styles.dateOption, pregnancyDateDay === day && styles.dateOptionSelected]}
                      onPress={() => setPregnancyDateDay(day)}
                    >
                      <Text style={[styles.dateOptionText, pregnancyDateDay === day && styles.dateOptionTextSelected]}>
                        {day}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.dateColumn}>
                <Text style={styles.dateColumnLabel}>Year</Text>
                <ScrollView style={styles.dateScrollView} showsVerticalScrollIndicator={false}>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 1 + i).map((year) => (
                    <Pressable
                      key={year}
                      style={[styles.dateOption, pregnancyDateYear === year && styles.dateOptionSelected]}
                      onPress={() => setPregnancyDateYear(year)}
                    >
                      <Text style={[styles.dateOptionText, pregnancyDateYear === year && styles.dateOptionTextSelected]}>
                        {year}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            <Pressable style={styles.dateConfirmButton} onPress={handlePregnancyDateConfirm}>
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
    backgroundColor: AppColors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: AppColors.surface,
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
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 14,
  },
  topHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.text,
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
    color: AppColors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: AppColors.subtleText,
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: AppColors.primary,
    borderStyle: 'dashed',
    shadowColor: '#0a7ea4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#0a7ea4', { width: 0, height: 4 }, 0.08, 12),
    }),
  },
  addCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#E8EFE9',
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
    color: AppColors.text,
    marginBottom: 4,
  },
  addCardSubtitle: {
    fontSize: 14,
    color: AppColors.subtleText,
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
    backgroundColor: AppColors.surface,
    borderRadius: 24,
    marginTop: 20,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: AppColors.subtleText,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  profilesList: {
    gap: 12,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#000', { width: 0, height: 2 }, 0.05, 8),
    }),
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
    color: AppColors.text,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  profileBreed: {
    fontSize: 14,
    color: AppColors.subtleText,
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
  femaleStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pregnantBadge: {
    backgroundColor: '#FCE7F3',
  },
  lactatingBadge: {
    backgroundColor: '#E0F2FE',
  },
  femaleStatusText: {
    fontSize: 12,
  },
  pregnantText: {
    color: '#EC4899',
  },
  lactatingText: {
    color: '#0284C7',
  },
  modalSafe: {
    flex: 1,
    backgroundColor: AppColors.background,
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
    color: AppColors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  toggleChip: {
    flex: 1,
    minWidth: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: AppColors.border,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: AppColors.surface,
  },
  toggleChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: AppColors.primary,
  },
  toggleChipResponsive: {
    maxWidth: '48%',
    flexBasis: '48%',
    flex: 0,
    minWidth: 100,
  },
  toggleEmoji: {
    fontSize: 24,
  },
  toggleText: {
    fontWeight: '700',
    fontSize: 14,
    color: AppColors.subtleText,
    textAlign: 'center',
    flexShrink: 1,
  },
  toggleTextActive: {
    color: AppColors.primary,
  },
  toggleChipSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: AppColors.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: AppColors.surface,
  },
  toggleTextSmall: {
    fontWeight: '600',
    fontSize: 13,
    color: AppColors.subtleText,
  },
  formSection: {
    marginBottom: 24,
  },
  helperText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
    fontStyle: 'italic',
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
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  datePickerText: {
    fontSize: 15,
    color: AppColors.text,
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
    backgroundColor: AppColors.surface,
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
    color: AppColors.text,
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
    backgroundColor: AppColors.background,
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
    color: AppColors.subtleText,
  },
  dateOptionTextSelected: {
    color: AppColors.primary,
    fontWeight: '700',
  },
  dateConfirmButton: {
    backgroundColor: AppColors.primary,
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
    backgroundColor: AppColors.surface,
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
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 6,
  },
  dropdownText: {
    fontSize: 15,
    color: '#0F172A',
    flex: 1,
  },
  dropdownPlaceholder: {
    color: '#94A3B8',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerModalContent: {
    backgroundColor: AppColors.surface,
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  pickerModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  pickerScrollView: {
    maxHeight: 400,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  pickerOptionSelected: {
    backgroundColor: '#E0F2FE',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#0F172A',
  },
  pickerOptionTextSelected: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 16,
  },
  expectedMonthCard: {
    backgroundColor: '#E0F2FE',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0a7ea4',
  },
  expectedMonthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  expectedMonthTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a7ea4',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expectedMonthValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  blockedMonthsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  blockedCountBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  blockedCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  monthChipNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 80,
    borderWidth: 2,
  },
  monthChipBlocked: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  monthChipAvailable: {
    backgroundColor: AppColors.background,
    borderColor: '#E2E8F0',
  },
  monthChipTextNew: {
    fontSize: 14,
    fontWeight: '600',
  },
  monthChipTextBlocked: {
    color: '#92400E',
  },
  monthChipTextAvailable: {
    color: '#94A3B8',
  },
  blockedMonthsSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FCD34D',
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
  },
  blockedMonthsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  blockedMonthsText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  emptyStateBox: {
    padding: 32,
    backgroundColor: AppColors.background,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
});
