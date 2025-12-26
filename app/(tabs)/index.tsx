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
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormField } from '@/components/ui/form-field';
import { Tag } from '@/components/ui/tag';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedCattle } from '@/contexts/SelectedCattleContext';
import { useUserCollection } from '@/hooks/use-user-collection';
import { addUserDocument, deleteUserDocument, updateUserDocument } from '@/services/firestore';
import { CattleCategory, CattleProfile, PregnancyPlan } from '@/types/models';
import { useRouter } from 'expo-router';

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

export default function HerdHomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { selectedCattle, setSelectedCattle } = useSelectedCattle();
  const router = useRouter();
  const { data: cattle, loading } = useUserCollection<CattleProfile>('cattle', { orderByField: 'createdAt' });
  const { data: pregnancyPlans } = useUserCollection<PregnancyPlan>('pregnancy');
  const [form, setForm] = useState<typeof defaultForm>(defaultForm);
  const [creating, setCreating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showClimatePicker, setShowClimatePicker] = useState(false);
  const [selected, setSelected] = useState<(CattleProfile & { id: string }) | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previousFemaleStatus, setPreviousFemaleStatus] = useState<'pregnant' | 'notPregnant' | 'lactating' | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  
  // Pregnancy form state
  const [showPregnancyFormModal, setShowPregnancyFormModal] = useState(false);
  const [pregnancyForm, setPregnancyForm] = useState({
    dueDate: '',
    trimester: 'early' as PregnancyPlan['trimester'],
    blockedMonths: [] as string[],
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerType, setDatePickerType] = useState<'delivery'>('delivery');
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);
  const allMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Dynamic months based on cattle type: 9 months for cows, 12 months for horses
  const pregnancyMonths = useMemo(() => {
    if (!editingId) return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']; // Default to cow
    const editingCattle = cattle.find(c => c.id === editingId);
    const cattleType = editingCattle?.type || 'cow';
    return cattleType === 'cow' 
      ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  }, [editingId, cattle]);
  const months = pregnancyMonths;
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());

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

  // Filter to show only selected cattle
  const filteredCattle = useMemo(() => {
    if (!selectedCattle) return [];
    return cattle.filter((c) => c.id === selectedCattle.id);
  }, [cattle, selectedCattle]);

  const grouped = useMemo(() => {
    const base: Record<CattleCategory, Array<CattleProfile & { id: string }>> = {
      cow: [],
      horse: [],
    };
    filteredCattle.forEach((doc) => {
      base[doc.type as CattleCategory]?.push(doc as CattleProfile & { id: string });
    });
    return base;
  }, [filteredCattle]);

  const handleChange = (field: keyof typeof defaultForm, value: string | boolean | 'male' | 'female' | 'hands' | 'cm' | 'kg' | 'lbs' | 'pregnant' | 'notPregnant' | 'lactating' | 'maintenance' | 'lightWork' | 'moderateWork' | 'heavyWork') => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };



  const resetForm = () => {
    setForm({ ...defaultForm });
  };

  // Pregnancy form helpers
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const days = Array.from({ length: getDaysInMonth(selectedYear, selectedMonth) }, (_, i) => i + 1);

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return `${allMonths[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const formatBlockedMonths = (monthsStr: string) => {
    if (!monthsStr) return '';
    const monthArray = monthsStr.split(',').map((m) => m.trim());
    if (monthArray.length === 0) return '';
    if (monthArray.length === 1) return monthArray[0];
    return `${monthArray[0]} to ${monthArray[monthArray.length - 1]}`;
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
        const monthIndex = months.indexOf(month);
        const firstIndex = months.indexOf(currentMonths[0]);
        const lastIndex = months.indexOf(currentMonths[currentMonths.length - 1]);

        if (monthIndex < firstIndex) {
          const newMonths = [];
          for (let i = monthIndex; i <= lastIndex; i++) {
            newMonths.push(months[i]);
          }
          return { ...prev, blockedMonths: newMonths };
        } else if (monthIndex > lastIndex) {
          const newMonths = [...currentMonths];
          for (let i = lastIndex + 1; i <= monthIndex; i++) {
            newMonths.push(months[i]);
          }
          return { ...prev, blockedMonths: newMonths };
        } else {
          return { ...prev, blockedMonths: currentMonths.slice(0, currentMonths.indexOf(month) + 1) };
        }
      }
    });
  };

  const openPregnancyDatePicker = () => {
    if (pregnancyForm.dueDate) {
      try {
        const date = new Date(pregnancyForm.dueDate);
      setSelectedYear(date.getFullYear());
      setSelectedMonth(date.getMonth());
      setSelectedDay(date.getDate());
      } catch {
        // Use defaults
      }
    }
    setShowDatePicker(true);
  };

  // Calculate blocked months based on due date and trimester
  // Calculate blocked months based on pregnancy date and trimester
  // dueDateStr is actually the pregnancy date (when they got pregnant)
  // For cows (9 months): Early: 0-3, Mid: 3-6, Late: 6-9
  // For horses (12 months): Early: 0-4, Mid: 4-8, Late: 8-12
  const calculateBlockedMonthsForTrimester = (dueDateStr: string, trimester: 'early' | 'mid' | 'late', cattleType: 'cow' | 'horse'): string[] => {
    if (!dueDateStr) return [];
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    try {
      // dueDateStr is actually the pregnancy date
      const pregnancyDate = new Date(dueDateStr);
      
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
      
      const blockedMonths: string[] = [];
      
      // Calculate blocked months starting from pregnancy date
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

  const handlePregnancyDateConfirm = () => {
    const date = new Date(selectedYear, selectedMonth, selectedDay);
    const dateStr = date.toISOString().split('T')[0];
    setPregnancyForm((prev) => {
      // Auto-calculate blocked months based on due date and trimester
      const cattleMeta = editingId ? cattle.find(c => c.id === editingId) : null;
      const cattleType = cattleMeta?.type || 'cow';
      const autoBlockedMonths = calculateBlockedMonthsForTrimester(dateStr, prev.trimester, cattleType);
      return { ...prev, dueDate: dateStr, blockedMonths: autoBlockedMonths };
    });
    setShowDatePicker(false);
  };

  const handlePregnancyFormSave = async () => {
    if (!user || !editingId) {
      setError('Please select a cattle.');
      return;
    }
    if (!pregnancyForm.dueDate) {
      setError('Please select delivery date.');
      return;
    }
    if (pregnancyForm.blockedMonths.length === 0) {
      setError('Please select at least one month to block.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const cattleMeta = cattle.find((item) => item.id === editingId);
      await addUserDocument(user.uid, 'pregnancy', {
        cattleId: editingId,
        cattleName: cattleMeta?.name ?? 'Unnamed',
        dueDate: pregnancyForm.dueDate,
        trimester: pregnancyForm.trimester,
        blockedMonth: pregnancyForm.blockedMonths.join(','),
        todo: '',
        nutritionFocus: '',
        calendarDate: '',
      });
      setPregnancyForm({
        dueDate: '',
        trimester: 'early',
        blockedMonths: [],
      });
      setShowPregnancyFormModal(false);
      
      // Close edit modal if it was open
      if (showEditModal) {
      resetForm();
        setShowEditModal(false);
        setEditingId(null);
        setPreviousFemaleStatus(null);
      }
      
      Alert.alert('Success! ✅', 'Pregnancy plan has been created.');
    } catch (err) {
      console.error(err);
      setError('Unable to save. Try again.');
    } finally {
      setCreating(false);
    }
  };


  const openEditModal = (item: CattleProfile & { id: string }) => {
    if (!item.id) {
      Alert.alert('Error', 'Cannot edit: Profile ID is missing.');
      return;
    }
    console.log('Opening edit modal for:', item.id, item.name, 'with femaleStatus:', item.femaleStatus);
    setEditingId(item.id);
    // Store previous femaleStatus to detect changes
    const prevStatus = item.femaleStatus || null;
    setPreviousFemaleStatus(prevStatus);
    console.log('Set previousFemaleStatus to:', prevStatus);
    setForm({
      name: item.name || '',
      type: item.type || 'cow',
      breed: item.breed || '',
      ageYears: item.ageYears?.toString() || '',
      sex: item.sex || 'male',
      weightUnit: item.weightUnit || 'kg',
      weightValue: item.weightValue?.toString() || '',
      heightUnit: item.heightUnit || 'cm',
      heightValue: item.heightValue?.toString() || '',
      vaccinated: item.vaccinated ?? true,
      femaleStatus: item.femaleStatus || 'notPregnant',
      activityLevel: item.activityLevel || 'maintenance',
      climateRegion: item.climateRegion || '',
    });
    setSelected(null);
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!user) {
      setError('You must be logged in to update a profile.');
      return;
    }
    if (!editingId) {
      setError('No profile selected for editing.');
      console.error('editingId is null');
      return;
    }
    if (!form.name.trim()) {
      setError('Please add at least a name for the cattle.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const cattleName = form.name.trim();
      console.log('🔄 Starting profile update:', {
        editingId,
        previousFemaleStatus,
        currentFemaleStatus: form.femaleStatus,
        sex: form.sex
      });
      
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
        console.log('✅ Sex is female, checking pregnancy status changes...');
        profileData.femaleStatus = form.femaleStatus;
        
        // Handle pregnancy status changes
        const wasPregnant = previousFemaleStatus === 'pregnant';
        const wasNotPregnantOrLactating = previousFemaleStatus === 'notPregnant' || previousFemaleStatus === 'lactating' || previousFemaleStatus === null;
        const isNowPregnant = form.femaleStatus === 'pregnant';
        const isNowNotPregnantOrLactating = form.femaleStatus === 'notPregnant' || form.femaleStatus === 'lactating';
        
        console.log('Pregnancy status change check:', {
          previousFemaleStatus,
          currentFemaleStatus: form.femaleStatus,
          wasPregnant,
          isNowNotPregnantOrLactating,
          shouldMarkCompleted: wasPregnant && isNowNotPregnantOrLactating,
          pregnancyPlansCount: pregnancyPlans.length,
          plansForThisCattle: pregnancyPlans.filter(p => p.cattleId === editingId).length,
          allPlans: pregnancyPlans.map(p => ({ id: p.id, cattleId: p.cattleId, completed: p.completed }))
        });
        
        // If changing from pregnant to not pregnant/lactating, mark pregnancy plans as completed
        if (wasPregnant && isNowNotPregnantOrLactating) {
          console.log('✅ Condition met: Marking pregnancy plans as completed');
          const activePregnancyPlans = pregnancyPlans.filter(
            (p) => {
              const matches = p.cattleId === editingId && 
                             (p.completed === undefined || p.completed === false || !p.completed) && 
                             !p.todo && 
                             !p.calendarDate;
              return matches;
            }
          );
          console.log('Marking pregnancy plans as completed:', {
            editingId,
            activePlansCount: activePregnancyPlans.length,
            allPlansForCattle: pregnancyPlans.filter(p => p.cattleId === editingId).length,
            activePlans: activePregnancyPlans.map(p => ({ id: p.id, completed: p.completed, todo: p.todo, calendarDate: p.calendarDate }))
          });
          
          if (activePregnancyPlans.length === 0) {
            console.warn('No active pregnancy plans found to mark as completed');
          }
          
          for (const plan of activePregnancyPlans) {
            if (plan.id) {
              try {
                await updateUserDocument(user.uid, 'pregnancy', plan.id, { completed: true });
                console.log('Successfully marked pregnancy plan as completed:', plan.id);
              } catch (err) {
                console.error('Error marking pregnancy plan as completed:', err, plan.id);
              }
            } else {
              console.warn('Pregnancy plan has no id:', plan);
            }
          }
        } else {
          console.log('❌ Condition NOT met for marking completed:', {
            wasPregnant,
            isNowNotPregnantOrLactating,
            previousFemaleStatus,
            currentFemaleStatus: form.femaleStatus
          });
        }
        
        // If changing from not pregnant/lactating to pregnant, show pregnancy form modal
        if (wasNotPregnantOrLactating && isNowPregnant) {
          // Check if there's already an active pregnancy plan
          const hasActivePlan = pregnancyPlans.some(
            (p) => p.cattleId === editingId && !p.completed && !p.todo && !p.calendarDate
          );
          
          if (!hasActivePlan) {
            console.log('Opening pregnancy form modal for new pregnancy');
            // Reset pregnancy form and show modal
            setPregnancyForm({
              dueDate: '',
              trimester: 'early',
              blockedMonths: [],
            });
            // Don't close edit modal yet, we'll close it after pregnancy form is saved
            setShowPregnancyFormModal(true);
          }
        }
      } else {
        // Remove femaleStatus if sex is male
        profileData.femaleStatus = undefined;
      }
      
      console.log('Updating profile:', { editingId, profileData });
      await updateUserDocument(user.uid, 'cattle', editingId, profileData);
      console.log('Profile updated successfully');
      
      // Update selectedCattle if it's the one being edited
      if (selectedCattle && selectedCattle.id === editingId) {
        const updatedCattle = {
          ...selectedCattle,
          ...profileData,
        };
        await setSelectedCattle(updatedCattle);
      }
      
      resetForm();
      setShowEditModal(false);
      setEditingId(null);
      setPreviousFemaleStatus(null);
      
      // Only show success alert if we're not opening pregnancy form
      if (!(form.sex === 'female' && form.femaleStatus === 'pregnant' && previousFemaleStatus !== 'pregnant')) {
      Alert.alert('Updated! ✅', `${cattleName}'s profile has been updated.`);
      }
    } catch (err) {
      console.error('Update error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Updating cattle failed. Please try again.';
      setError(errorMessage);
      Alert.alert('Update Failed', errorMessage);
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView 
        contentContainerStyle={styles.content} 
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back 👋</Text>
            <Text style={styles.title}>
              {selectedCattle ? `${selectedCattle.name}'s Profile` : 'Your Herd'}
            </Text>
          </View>
          {selectedCattle && (
            <View style={styles.statsContainer}>
              <View style={styles.statBadge}>
                <Text style={styles.statNumber}>{selectedCattle.type === 'cow' ? '🐄' : '🐴'}</Text>
                <Text style={styles.statLabel}>{selectedCattle.type === 'cow' ? 'Cow' : 'Horse'}</Text>
              </View>
            </View>
          )}
        </View>

        {!selectedCattle && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🐮</Text>
            <Text style={styles.emptyTitle}>No Profile Selected</Text>
            <Text style={styles.emptySubtitle}>Please select a cattle profile to view details</Text>
          </View>
        )}

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0a7ea4" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        )}

        {/* Cattle Profile Details */}
        {!loading && selectedCattle && (
          <>
            <View style={styles.profileDetailCard}>
              <Pressable style={styles.profileCardContent} onPress={() => setSelected(selectedCattle)}>
                <View style={[styles.profileAvatar, { backgroundColor: selectedCattle.type === 'cow' ? '#E0F2FE' : '#FEF3C7' }]}>
                  <Text style={styles.avatarEmoji}>{getCattleIcon(selectedCattle.type)}</Text>
                </View>
                <View style={styles.profileInfo}>
                  <View style={styles.profileHeader}>
                    <Text style={styles.profileName}>{selectedCattle.name}</Text>
                  </View>
                  {selectedCattle.breed && selectedCattle.breed.trim() !== '' ? (
                    <Text style={styles.profileBreed}>{selectedCattle.breed}</Text>
                  ) : null}
                  <View style={styles.profileMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name={selectedCattle.sex === 'male' ? 'male' : 'female'} size={16} color="#64748B" />
                      <Text style={styles.metaText}>{selectedCattle.sex === 'male' ? '♂ Male' : '♀ Female'}</Text>
                    </View>
                    {selectedCattle.sex === 'female' && selectedCattle.femaleStatus && (
                      <View style={[
                        styles.femaleStatusBadge,
                        selectedCattle.femaleStatus === 'pregnant' && styles.femaleStatusBadgePregnant,
                        selectedCattle.femaleStatus === 'lactating' && styles.femaleStatusBadgeLactating
                      ]}>
                        <Text style={styles.femaleStatusText}>
                          {selectedCattle.femaleStatus === 'pregnant' ? '🤰 Pregnant' : selectedCattle.femaleStatus === 'lactating' ? '🥛 Lactating' : 'Not Pregnant'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.metaItem}>
                      <Ionicons name="scale-outline" size={16} color="#64748B" />
                      <Text style={styles.metaText}>
                        {selectedCattle.weightValue ? `${selectedCattle.weightValue} ${selectedCattle.weightUnit || 'kg'}` : '—'}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="calendar-outline" size={16} color="#64748B" />
                      <Text style={styles.metaText}>{selectedCattle.ageYears || '—'} yrs</Text>
                    </View>
                    {selectedCattle.vaccinated && (
                      <View style={styles.vaccinatedBadge}>
                        <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                        <Text style={styles.vaccinatedText}>Vaccinated</Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
              <View style={styles.cardActions}>
                <Pressable style={styles.actionButton} onPress={() => openEditModal(selectedCattle)}>
                  <Ionicons name="create-outline" size={20} color="#0a7ea4" />
                </Pressable>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActionsSection}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickActionsGrid}>
                <Pressable 
                  style={styles.quickActionCard}
                  onPress={() => router.push('/(tabs)/calculator')}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#E0F2FE' }]}>
                    <Ionicons name="calculator-outline" size={24} color="#0a7ea4" />
                  </View>
                  <Text style={styles.quickActionText}>Calculate Nutrition</Text>
                </Pressable>
                <Pressable 
                  style={styles.quickActionCard}
                  onPress={() => router.push('/(tabs)/meals')}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="restaurant-outline" size={24} color="#F59E0B" />
                  </View>
                  <Text style={styles.quickActionText}>Create Meal Plan</Text>
                </Pressable>
                <Pressable 
                  style={styles.quickActionCard}
                  onPress={() => router.push('/(tabs)/progress')}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#D1FAE5' }]}>
                    <Ionicons name="bar-chart-outline" size={24} color="#10B981" />
                  </View>
                  <Text style={styles.quickActionText}>Log Progress</Text>
                </Pressable>
                <Pressable 
                  style={styles.quickActionCard}
                  onPress={() => router.push('/(tabs)/pregnancy')}
                >
                  <View style={[styles.quickActionIcon, { backgroundColor: '#FCE7F3' }]}>
                    <Ionicons name="calendar-outline" size={24} color="#EC4899" />
                  </View>
                  <Text style={styles.quickActionText}>Pregnancy Plan</Text>
                </Pressable>
              </View>
            </View>

            {/* Profile Details Summary */}
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Profile Details</Text>
              <View style={styles.detailsCard}>
                <DetailRow 
                  icon="pricetag-outline" 
                  label="Breed" 
                  value={selectedCattle.breed || 'Not specified'} 
                />
                <DetailRow 
                  icon="scale-outline" 
                  label="Weight" 
                  value={selectedCattle.weightValue ? `${selectedCattle.weightValue} ${selectedCattle.weightUnit || 'kg'}` : 'Not specified'} 
                />
                <DetailRow 
                  icon="resize-outline" 
                  label="Height" 
                  value={selectedCattle.heightValue ? `${selectedCattle.heightValue} ${selectedCattle.heightUnit || 'cm'}` : 'Not specified'} 
                />
                <DetailRow 
                  icon="calendar-outline" 
                  label="Age" 
                  value={selectedCattle.ageYears ? `${selectedCattle.ageYears} years` : 'Not specified'} 
                />
                <DetailRow 
                  icon={selectedCattle.sex === 'male' ? 'male' : 'female'} 
                  label="Gender" 
                  value={selectedCattle.sex === 'male' ? '♂ Male' : '♀ Female'} 
                />
                {selectedCattle.sex === 'female' && selectedCattle.femaleStatus && (
                  <DetailRow 
                    icon="heart-outline" 
                    label="Female Status" 
                    value={selectedCattle.femaleStatus === 'pregnant' ? '🤰 Pregnant' : selectedCattle.femaleStatus === 'lactating' ? '🥛 Lactating' : 'Not Pregnant'} 
                  />
                )}
                <DetailRow 
                  icon="barbell-outline" 
                  label="Activity Level" 
                  value={selectedCattle.activityLevel ? (selectedCattle.activityLevel === 'maintenance' ? 'Maintenance' : selectedCattle.activityLevel === 'lightWork' ? 'Light Work' : selectedCattle.activityLevel === 'moderateWork' ? 'Moderate Work' : 'Heavy Work') : 'Not specified'} 
                />
                {selectedCattle.climateRegion && (
                  <DetailRow 
                    icon="location-outline" 
                    label="Climate Region" 
                    value={selectedCattle.climateRegion} 
                  />
                )}
                <DetailRow 
                  icon="shield-checkmark-outline" 
                  label="Vaccinated" 
                  value={selectedCattle.vaccinated ? 'Yes ✓' : 'No'} 
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" onRequestClose={() => { setShowEditModal(false); resetForm(); setEditingId(null); }}>
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', default: undefined })}>
            {Platform.OS === 'web' ? (
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
                        <Text 
                          style={[styles.toggleText, form.sex === sex && styles.toggleTextActive]}
                          numberOfLines={1}
                        >
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
            ) : (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                          <Text 
                            style={[styles.toggleText, form.sex === sex && styles.toggleTextActive]}
                            numberOfLines={1}
                          >
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
                  <Text style={styles.statCardValue}>
                    {selected.weightValue ? `${selected.weightValue} ${selected.weightUnit || 'kg'}` : '—'}
                  </Text>
                  <Text style={styles.statCardLabel}>Weight</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="resize-outline" size={24} color="#0a7ea4" />
                  <Text style={styles.statCardValue}>
                    {selected.heightValue ? `${selected.heightValue} ${selected.heightUnit || 'cm'}` : '—'}
                  </Text>
                  <Text style={styles.statCardLabel}>Height</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name="calendar-outline" size={24} color="#0a7ea4" />
                  <Text style={styles.statCardValue}>{selected.ageYears || '—'}</Text>
                  <Text style={styles.statCardLabel}>Age (years)</Text>
                </View>
                <View style={styles.statCard}>
                  <Ionicons name={selected.sex === 'male' ? 'male' : 'female'} size={24} color="#0a7ea4" />
                  <Text style={styles.statCardValue}>{selected.sex === 'male' ? '♂' : '♀'}</Text>
                  <Text style={styles.statCardLabel}>Gender</Text>
                </View>
              </View>

              {/* Details List */}
              <View style={styles.detailsList}>
                <DetailItem icon="pricetag-outline" label="Breed" value={selected.breed || '—'} />
                {selected.sex === 'female' && selected.femaleStatus && (
                  <DetailItem 
                    icon="heart-outline" 
                    label="Female Status" 
                    value={selected.femaleStatus === 'pregnant' ? '🤰 Pregnant' : selected.femaleStatus === 'lactating' ? '🥛 Lactating' : 'Not Pregnant'} 
                  />
                )}
                <DetailItem 
                  icon="barbell-outline" 
                  label="Activity Level" 
                  value={selected.activityLevel ? (selected.activityLevel === 'maintenance' ? 'Maintenance' : selected.activityLevel === 'lightWork' ? 'Light Work' : selected.activityLevel === 'moderateWork' ? 'Moderate Work' : 'Heavy Work') : '—'} 
                />
                {selected.climateRegion && (
                  <DetailItem icon="location-outline" label="Climate Region" value={selected.climateRegion} />
                )}
                <DetailItem 
                  icon="shield-checkmark-outline" 
                  label="Vaccinated" 
                  value={selected.vaccinated ? 'Yes' : 'No'} 
                />
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

      {/* Pregnancy Form Modal */}
      <Modal visible={showPregnancyFormModal} animationType="slide" onRequestClose={() => setShowPregnancyFormModal(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', default: undefined })}>
            {Platform.OS === 'web' ? (
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <Pressable style={styles.closeButton} onPress={() => { setShowPregnancyFormModal(false); setPregnancyForm({ dueDate: '', trimester: 'early', blockedMonths: [] }); setError(''); }}>
                    <Ionicons name="close" size={24} color="#64748B" />
                  </Pressable>
                  <Text style={styles.modalTitle}>Add Pregnancy Plan</Text>
                  <View style={{ width: 40 }} />
                </View>

                <Text style={styles.helper}>Select trimester, blocked months, and delivery date.</Text>

                <View style={styles.labelContainer}>
                  <Text style={styles.label}>Trimester</Text>
                  <View style={styles.toggleRow}>
                    {(['early', 'mid', 'late'] as const).map((trimester) => (
                      <Pressable
                        key={trimester}
                        style={[styles.toggleChip, styles.toggleChipResponsive, pregnancyForm.trimester === trimester && styles.toggleChipActive]}
                        onPress={() => {
                          setPregnancyForm((prev) => {
                            // Auto-calculate blocked months when trimester changes
                            if (prev.dueDate) {
                              const cattleMeta = editingId ? cattle.find(c => c.id === editingId) : null;
                              const cattleType = cattleMeta?.type || 'cow';
                              const autoBlockedMonths = calculateBlockedMonthsForTrimester(prev.dueDate, trimester, cattleType);
                              return { ...prev, trimester, blockedMonths: autoBlockedMonths };
                            }
                            return { ...prev, trimester };
                          });
                        }}
                      >
                        <Text style={[styles.toggleText, pregnancyForm.trimester === trimester && styles.toggleTextActive]}>
                          {trimester} trimester
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.labelContainer}>
                  <Text style={styles.label}>Month to Block</Text>
                  <Text style={styles.helperText}>Select a range (e.g., Jan to May)</Text>
                  <View style={styles.monthRow}>
                    {months.map((month) => {
                      const isSelected = pregnancyForm.blockedMonths.includes(month);
                      const monthIndex = months.indexOf(month);
                      const firstIndex = pregnancyForm.blockedMonths.length > 0 ? months.indexOf(pregnancyForm.blockedMonths[0]) : -1;
                      const lastIndex =
                        pregnancyForm.blockedMonths.length > 0 ? months.indexOf(pregnancyForm.blockedMonths[pregnancyForm.blockedMonths.length - 1]) : -1;
                      const isInRange = monthIndex >= firstIndex && monthIndex <= lastIndex && firstIndex !== -1;

                      return (
                        <Pressable key={month} style={[styles.monthChip, isInRange && styles.monthChipActive]} onPress={() => togglePregnancyMonth(month)}>
                          <Text style={[styles.monthChipText, isInRange && styles.monthChipTextActive]}>{month}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {pregnancyForm.blockedMonths.length > 0 && (
                    <Text style={styles.selectedMonthsText}>Selected: {formatBlockedMonths(pregnancyForm.blockedMonths.join(','))}</Text>
                  )}
                </View>

                <View style={styles.labelContainer}>
                  <Text style={styles.label}>Delivery Date</Text>
                  <Pressable style={styles.datePickerButton} onPress={openPregnancyDatePicker}>
                    <Text style={[styles.datePickerText, !pregnancyForm.dueDate && styles.datePickerPlaceholder]}>
                      {pregnancyForm.dueDate ? formatDisplayDate(pregnancyForm.dueDate) : 'Select delivery date'}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#64748B" />
                  </Pressable>
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable style={[styles.primaryButton, creating && { opacity: 0.6 }]} onPress={handlePregnancyFormSave} disabled={creating}>
                  {creating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.primaryText}>Save Pregnancy Plan</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            ) : (
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={styles.modalHeader}>
                    <Pressable style={styles.closeButton} onPress={() => { setShowPregnancyFormModal(false); setPregnancyForm({ dueDate: '', trimester: 'early', blockedMonths: [] }); setError(''); }}>
                      <Ionicons name="close" size={24} color="#64748B" />
                    </Pressable>
                    <Text style={styles.modalTitle}>Add Pregnancy Plan</Text>
                    <View style={{ width: 40 }} />
                  </View>

                  <Text style={styles.helper}>Select trimester, blocked months, and delivery date.</Text>

                  <View style={styles.labelContainer}>
                    <Text style={styles.label}>Trimester</Text>
                    <View style={styles.toggleRow}>
                      {(['early', 'mid', 'late'] as const).map((trimester) => (
                        <Pressable
                          key={trimester}
                          style={[styles.toggleChip, styles.toggleChipResponsive, pregnancyForm.trimester === trimester && styles.toggleChipActive]}
                          onPress={() => {
                          setPregnancyForm((prev) => {
                            // Auto-calculate blocked months when trimester changes
                            if (prev.dueDate) {
                              const cattleMeta = editingId ? cattle.find(c => c.id === editingId) : null;
                              const cattleType = cattleMeta?.type || 'cow';
                              const autoBlockedMonths = calculateBlockedMonthsForTrimester(prev.dueDate, trimester, cattleType);
                              return { ...prev, trimester, blockedMonths: autoBlockedMonths };
                            }
                            return { ...prev, trimester };
                          });
                        }}
                        >
                          <Text style={[styles.toggleText, pregnancyForm.trimester === trimester && styles.toggleTextActive]}>
                            {trimester} trimester
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.labelContainer}>
                    <Text style={styles.label}>Month to Block</Text>
                    <Text style={styles.helperText}>Select a range (e.g., Jan to May)</Text>
                    <View style={styles.monthRow}>
                      {months.map((month) => {
                        const isSelected = pregnancyForm.blockedMonths.includes(month);
                        const monthIndex = months.indexOf(month);
                        const firstIndex = pregnancyForm.blockedMonths.length > 0 ? months.indexOf(pregnancyForm.blockedMonths[0]) : -1;
                        const lastIndex =
                          pregnancyForm.blockedMonths.length > 0 ? months.indexOf(pregnancyForm.blockedMonths[pregnancyForm.blockedMonths.length - 1]) : -1;
                        const isInRange = monthIndex >= firstIndex && monthIndex <= lastIndex && firstIndex !== -1;

                        return (
                          <Pressable key={month} style={[styles.monthChip, isInRange && styles.monthChipActive]} onPress={() => togglePregnancyMonth(month)}>
                            <Text style={[styles.monthChipText, isInRange && styles.monthChipTextActive]}>{month}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {pregnancyForm.blockedMonths.length > 0 && (
                      <Text style={styles.selectedMonthsText}>Selected: {formatBlockedMonths(pregnancyForm.blockedMonths.join(','))}</Text>
                    )}
                  </View>

                  <View style={styles.labelContainer}>
                    <Text style={styles.label}>Delivery Date</Text>
                    <Pressable style={styles.datePickerButton} onPress={openPregnancyDatePicker}>
                      <Text style={[styles.datePickerText, !pregnancyForm.dueDate && styles.datePickerPlaceholder]}>
                        {pregnancyForm.dueDate ? formatDisplayDate(pregnancyForm.dueDate) : 'Select delivery date'}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color="#64748B" />
                    </Pressable>
                  </View>

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <Pressable style={[styles.primaryButton, creating && { opacity: 0.6 }]} onPress={handlePregnancyFormSave} disabled={creating}>
                    {creating ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.primaryText}>Save Pregnancy Plan</Text>
                      </>
                    )}
                  </Pressable>
                </ScrollView>
              </TouchableWithoutFeedback>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Delivery Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={styles.dateModalOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable style={styles.dateModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dateModalHeader}>
              <Text style={styles.dateModalTitle}>Select Delivery Date</Text>
              <Pressable onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            <View style={styles.datePickerRow}>
              <View style={styles.dateColumn}>
                <Text style={styles.dateColumnLabel}>Month</Text>
                <ScrollView style={styles.dateScrollView} showsVerticalScrollIndicator={false}>
                  {allMonths.map((month, index) => (
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

            <Pressable style={styles.dateConfirmButton} onPress={handlePregnancyDateConfirm}>
              <Text style={styles.dateConfirmText}>Confirm</Text>
            </Pressable>
          </Pressable>
        </Pressable>
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

const DetailRow = ({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailRowIcon}>
      <Ionicons name={icon} size={18} color="#64748B" />
    </View>
    <View style={styles.detailRowContent}>
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text style={styles.detailRowValue}>{value}</Text>
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
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#0a7ea4', { width: 0, height: 4 }, 0.08, 12),
    }),
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
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#000', { width: 0, height: 2 }, 0.05, 8),
    }),
  },
  profileDetailCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#000', { width: 0, height: 2 }, 0.05, 8),
    }),
  },
  quickActionsSection: {
    marginBottom: 24,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  quickActionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#000', { width: 0, height: 2 }, 0.05, 8),
    }),
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
  },
  detailsSection: {
    marginBottom: 24,
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#000', { width: 0, height: 2 }, 0.05, 8),
    }),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailRowContent: {
    flex: 1,
  },
  detailRowLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontWeight: '600',
  },
  detailRowValue: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
    flex: 1,
  },
  profileCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    paddingBottom: 16,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0F2FE',
    shadowColor: '#0a7ea4',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#0a7ea4', { width: 0, height: 1 }, 0.1, 2),
    }),
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#000', { width: 0, height: 2 }, 0.1, 4),
    }),
  },
  avatarEmoji: {
    fontSize: 32,
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
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  profileBreed: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
    fontWeight: '500',
  },
  profileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingRight: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  vaccinatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  vaccinatedText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  femaleStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FCE7F3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  femaleStatusBadgePregnant: {
    backgroundColor: '#FDF2F8',
    borderColor: '#F9A8D4',
  },
  femaleStatusBadgeLactating: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  femaleStatusText: {
    fontSize: 11,
    color: '#EC4899',
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
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  toggleChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0a7ea4',
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
    color: '#64748B',
    textAlign: 'center',
    flexShrink: 1,
  },
  toggleTextActive: {
    color: '#0a7ea4',
  },
  toggleChipSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  toggleTextSmall: {
    fontWeight: '600',
    fontSize: 13,
    color: '#64748B',
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
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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
  monthRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  monthChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  monthChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0a7ea4',
  },
  monthChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  monthChipTextActive: {
    color: '#0a7ea4',
  },
  selectedMonthsText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginTop: 8,
  },
  datePickerText: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  datePickerPlaceholder: {
    color: '#94A3B8',
    fontWeight: '400',
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
