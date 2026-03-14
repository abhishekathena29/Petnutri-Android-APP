import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionCard } from '@/components/ui/section-card';
import { Tag } from '@/components/ui/tag';
import { AppColors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedCattle } from '@/contexts/SelectedCattleContext';
import { useUserCollection } from '@/hooks/use-user-collection';
import { addUserDocument, deleteUserDocument, updateUserDocument } from '@/services/firestore';
import { CattleProfile, PregnancyPlan } from '@/types/models';

const trimesters: PregnancyPlan['trimester'][] = ['early', 'mid', 'late'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
const allMonthsList = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

const initialTodoForm = {
  calendarDate: '',
  todo: '',
};

export default function PregnancyScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { selectedCattle: contextSelectedCattle } = useSelectedCattle();
  const { data: herd } = useUserCollection<CattleProfile>('cattle');
  const { data: plans, loading } = useUserCollection<PregnancyPlan>('pregnancy', { orderByField: 'createdAt' });
  const [editingTrimester, setEditingTrimester] = useState<string | null>(null);
  const [editTrimesterValue, setEditTrimesterValue] = useState<'early' | 'mid' | 'late'>('early');
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Filter plans by selected cattle (include both active and completed)
  const filteredPlans = useMemo(() => {
    if (!contextSelectedCattle) return [];
    return plans.filter((p) => p.cattleId === contextSelectedCattle.id);
  }, [plans, contextSelectedCattle]);

  const [todoForm, setTodoForm] = useState(initialTodoForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingTodo, setDeletingTodo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showTodoDatePicker, setShowTodoDatePicker] = useState(false);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [selectedCattleId, setSelectedCattleId] = useState<string | null>(null);

  // Pregnancy Form Modal State
  const [showPregnancyFormModal, setShowPregnancyFormModal] = useState(false);
  const [pregnancyForm, setPregnancyForm] = useState<{ dueDate: string; trimester: 'early' | 'mid' | 'late'; blockedMonths: string[] }>({
    dueDate: '',
    trimester: 'early',
    blockedMonths: [],
  });
  const [creating, setCreating] = useState(false);

  // Date picker state
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);
  const allMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const days = Array.from({ length: getDaysInMonth(selectedYear, selectedMonth) }, (_, i) => i + 1);

  // Adjust selected day if it's invalid for the selected month
  useEffect(() => {
    const maxDays = getDaysInMonth(selectedYear, selectedMonth);
    if (selectedDay > maxDays) {
      setSelectedDay(maxDays);
    }
  }, [selectedYear, selectedMonth, selectedDay]);

  const groupedPlans = useMemo(() => {
    // Use filtered plans (only for selected cattle) instead of all plans
    if (filteredPlans.length === 0) return [];
    
    console.log('Pregnancy page - filteredPlans:', {
      total: filteredPlans.length,
      plans: filteredPlans.map(p => ({
        id: p.id,
        cattleId: p.cattleId,
        completed: p.completed,
        hasTodo: !!p.todo,
        hasCalendarDate: !!p.calendarDate,
        dueDate: p.dueDate
      }))
    });
    
    // Get all main pregnancy plans (both active and completed) - the ones without todo/calendarDate
    // Explicitly check for both undefined and false for completed status
    const mainPlans = filteredPlans.filter(p => !p.todo && !p.calendarDate);
    
    // Sort: show active plans first, then completed ones
    mainPlans.sort((a, b) => {
      const aCompleted = a.completed === true;
      const bCompleted = b.completed === true;
      if (aCompleted === bCompleted) return 0;
      return aCompleted ? 1 : -1; // Active first
    });
    
    console.log('Pregnancy page - mainPlans:', {
      total: mainPlans.length,
      active: mainPlans.filter(p => !p.completed).length,
      completed: mainPlans.filter(p => p.completed === true).length,
      plans: mainPlans.map(p => ({ 
        id: p.id, 
        completed: p.completed, 
        completedType: typeof p.completed,
        completedValue: p.completed,
        dueDate: p.dueDate 
      }))
    });
    
    // Get all todos (entries with todo and calendarDate) - include both active and completed
    const todos = filteredPlans.filter(p => p.todo && p.calendarDate);
    
    // Group todos by their main plan's cattleId
    const todosByCattleId: Record<string, PregnancyPlan[]> = {};
    todos.forEach(todo => {
      if (!todosByCattleId[todo.cattleId]) {
        todosByCattleId[todo.cattleId] = [];
      }
      todosByCattleId[todo.cattleId].push(todo);
    });
    
    // Create a group for each main plan (this allows showing multiple pregnancy histories)
    const grouped = mainPlans.map(mainPlan => ({
      cattleId: mainPlan.cattleId,
      cattleName: mainPlan.cattleName,
      entries: [mainPlan, ...(todosByCattleId[mainPlan.cattleId] || []).filter(t => {
        // Match todos to this main plan by checking if they share the same cattleId
        // and if the todo's dueDate matches the main plan's dueDate (they belong together)
        return t.cattleId === mainPlan.cattleId && t.dueDate === mainPlan.dueDate;
      })],
    }));
    
    console.log('Pregnancy page - groupedPlans:', {
      total: grouped.length,
      groups: grouped.map(g => ({
        cattleId: g.cattleId,
        cattleName: g.cattleName,
        entriesCount: g.entries.length,
        mainPlanCompleted: g.entries.find(e => !e.todo && !e.calendarDate)?.completed
      }))
    });
    
    return grouped;
  }, [filteredPlans]);

  const handleTodoChange = (field: keyof typeof initialTodoForm, value: string) => {
    setTodoForm((prev) => ({ ...prev, [field]: value }));
  };

  const openDatePicker = () => {
    const dateToParse = todoForm.calendarDate;

    if (dateToParse) {
      try {
        const date = new Date(dateToParse);
        if (!isNaN(date.getTime())) {
          setSelectedYear(date.getFullYear());
          setSelectedMonth(date.getMonth());
          setSelectedDay(date.getDate());
        }
      } catch {
        // Use current date if parsing fails
      }
    }

    setShowTodoDatePicker(true);
  };

  const handleDateConfirm = () => {
    if (showPregnancyFormModal) {
      handlePregnancyDateConfirm();
      return;
    }
    const formattedDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    handleTodoChange('calendarDate', formattedDate);
    setShowTodoDatePicker(false);
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatBlockedMonths = (monthsString: string) => {
    if (!monthsString) return '—';
    const monthArray = monthsString.split(',').map((m) => m.trim());
    if (monthArray.length === 0) return '—';
    if (monthArray.length === 1) return monthArray[0];
    return `${monthArray[0]} to ${monthArray[monthArray.length - 1]}`;
  };

  // Calculate expected delivery months based on pregnancy date (dueDateStr is actually the pregnancy date)
  // For cows: 9 months from pregnancy date
  // For horses: 12 months from pregnancy date
  const calculateExpectedMonths = (dueDateStr: string, cattleType: 'cow' | 'horse' = 'cow') => {
    if (!dueDateStr) return null;
    
    const pregnancyMonths = cattleType === 'cow' ? 9 : 12;
    
    try {
      // Parse the date string properly to avoid timezone issues
      // dueDateStr is actually the pregnancy date (when they got pregnant)
      // Handle YYYY-MM-DD format
      const dateStr = dueDateStr.split('T')[0]; // Remove time portion if present
      const [year, month, day] = dateStr.split('-').map(Number);
      const pregnancyDate = new Date(year, month - 1, day); // month is 0-indexed
      
      // Calculate expected delivery date (pregnancy date + pregnancy months)
      // For cows: 9 months from pregnancy date
      // For horses: 12 months from pregnancy date
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
        monthIndices: [beforeMonth, afterMonth],
        years: [beforeYear, afterYear],
        display: `${firstMonth} ${beforeYear} to ${secondMonth} ${afterYear}`
      };
    } catch {
      return null;
    }
  };

  // Get blocked months array from string
  const getBlockedMonthsArray = (blockedMonthStr: string): string[] => {
    if (!blockedMonthStr) return [];
    return blockedMonthStr.split(',').map(m => m.trim());
  };

  // Calculate blocked months based on pregnancy date and trimester
  // dueDateStr is actually the pregnancy date (when they got pregnant)
  // For cows (9 months): Early: 0-3, Mid: 3-6, Late: 6-9
  // For horses (12 months): Early: 0-4, Mid: 4-8, Late: 8-12
  const calculateBlockedMonthsFromTrimester = (dueDateStr: string, trimester: 'early' | 'mid' | 'late', cattleType: 'cow' | 'horse' = 'cow'): string[] => {
    if (!dueDateStr) return [];
    
    try {
      // dueDateStr is actually the pregnancy date
      const pregnancyDate = new Date(dueDateStr);
      
      // Determine month range based on trimester and cattle type
      // The pregnancy month itself counts as month 1
      // For cows (9 months): Early: months 1-3 (0-2 offset), Mid: months 4-6 (3-5 offset), Late: months 7-9 (6-8 offset)
      // For horses (12 months): Early: months 1-4 (0-3 offset), Mid: months 5-8 (4-7 offset), Late: months 9-12 (8-11 offset)
      let startMonthOffset = 0;
      let endMonthOffset = cattleType === 'cow' ? 3 : 4; // End is exclusive, so 3 means months 0,1,2 (which are months 1,2,3)
      
      if (trimester === 'mid') {
        startMonthOffset = cattleType === 'cow' ? 3 : 4;
        endMonthOffset = cattleType === 'cow' ? 6 : 8;
      } else if (trimester === 'late') {
        startMonthOffset = cattleType === 'cow' ? 6 : 8;
        endMonthOffset = cattleType === 'cow' ? 9 : 12;
      }
      
      const blockedMonths: string[] = [];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
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

  const handleCreatePregnancyPlan = async () => {
    if (!user || !contextSelectedCattle) return;
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
      await addUserDocument(user.uid, 'pregnancy', {
        cattleId: contextSelectedCattle.id,
        cattleName: contextSelectedCattle.name ?? 'Unnamed',
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
      Alert.alert('Success! ✅', 'Pregnancy plan has been created.');
    } catch (err) {
      console.error(err);
      setError('Unable to save. Try again.');
    } finally {
      setCreating(false);
    }
  };

  const togglePregnancyMonth = (month: string) => {
    setPregnancyForm((prev) => {
      const isSelected = prev.blockedMonths.includes(month);
      if (isSelected) {
        return { ...prev, blockedMonths: prev.blockedMonths.filter((m) => m !== month) };
      } else {
        const currentMonths = [...prev.blockedMonths, month];
        // Sort months biologically
        currentMonths.sort((a, b) => allMonthsList.indexOf(a) - allMonthsList.indexOf(b));
        return { ...prev, blockedMonths: currentMonths };
      }
    });
  };

  const openPregnancyDatePicker = () => {
    const dateToParse = pregnancyForm.dueDate;
    if (dateToParse) {
      try {
        const date = new Date(dateToParse);
        if (!isNaN(date.getTime())) {
          setSelectedYear(date.getFullYear());
          setSelectedMonth(date.getMonth());
          setSelectedDay(date.getDate());
        }
      } catch {
      }
    }
    // Repurpose date picker for pregnancy start date
    setShowTodoDatePicker(true);
  };

  const handlePregnancyDateConfirm = () => {
    const date = new Date(selectedYear, selectedMonth, selectedDay);
    const dateStr = date.toISOString().split('T')[0];
    setPregnancyForm((prev) => {
      const cattleMeta = herd.find(c => c.id === contextSelectedCattle?.id);
      const cattleType = cattleMeta?.type || 'cow';
      const autoBlockedMonths = calculateBlockedMonthsFromTrimester(dateStr, prev.trimester, cattleType);
      return { ...prev, dueDate: dateStr, blockedMonths: autoBlockedMonths };
    });
    setShowTodoDatePicker(false);
  };

  // Get available months/years for todo date picker based on trimester
  const getTrimesterDateRange = (mainPlan: PregnancyPlan) => {
    if (!mainPlan.dueDate) return { startMonth: 0, endMonth: 11, startYear: new Date().getFullYear(), endYear: new Date().getFullYear() + 1 };
    
    // Get cattle type from herd
    const cattleMeta = herd.find(c => c.id === mainPlan.cattleId);
    const cattleType = cattleMeta?.type || 'cow';
    const pregnancyMonths = cattleType === 'cow' ? 9 : 12;
    
    try {
      // dueDate is actually the pregnancy date
      const pregnancyDate = new Date(mainPlan.dueDate);
      
      const trimester = mainPlan.trimester || 'early';
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
        endMonthOffset = pregnancyMonths;
      }
      
      const startDate = new Date(pregnancyDate);
      startDate.setMonth(startDate.getMonth() + startMonthOffset);
      
      const endDate = new Date(pregnancyDate);
      endDate.setMonth(endDate.getMonth() + endMonthOffset);
      
      return {
        startMonth: startDate.getMonth(),
        startYear: startDate.getFullYear(),
        endMonth: endDate.getMonth(),
        endYear: endDate.getFullYear(),
      };
    } catch {
      return { startMonth: 0, endMonth: 11, startYear: new Date().getFullYear(), endYear: new Date().getFullYear() + 1 };
    }
  };


  const handleAddTodo = async () => {
    if (!user || !selectedCattleId || !todoForm.calendarDate || !todoForm.todo.trim()) {
      setError('Please fill all todo fields.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const cattleEntry = groupedPlans.find((g) => g.cattleId === selectedCattleId);
      if (!cattleEntry) return;

      await addUserDocument(user.uid, 'pregnancy', {
        cattleId: selectedCattleId,
        cattleName: cattleEntry.cattleName,
        dueDate: cattleEntry.entries[0]?.dueDate || '',
        trimester: cattleEntry.entries[0]?.trimester || 'early',
        blockedMonth: cattleEntry.entries[0]?.blockedMonth || '',
        todo: todoForm.todo,
        nutritionFocus: '',
        calendarDate: todoForm.calendarDate,
      });
      setTodoForm(initialTodoForm);
      setShowTodoModal(false);
      setSelectedCattleId(null);
    } catch (err) {
      console.error(err);
      setError('Unable to add todo. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCattle = async (cattleId: string, cattleName: string) => {
    if (!user) return;

    Alert.alert(
      'Delete Pregnancy Plan',
      `Are you sure you want to delete all pregnancy records for ${cattleName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Ask for female status
            Alert.alert(
              'Update Female Status',
              'Please select the new status for this female cattle:',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Not Pregnant',
                  onPress: async () => {
                    await confirmDeleteAndUpdateStatus(cattleId, cattleName, 'notPregnant');
                  },
                },
                {
                  text: 'Lactating',
                  onPress: async () => {
                    await confirmDeleteAndUpdateStatus(cattleId, cattleName, 'lactating');
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const confirmDeleteAndUpdateStatus = async (cattleId: string, cattleName: string, femaleStatus: 'notPregnant' | 'lactating') => {
    if (!user) return;
    
    setDeleting(cattleId);
    try {
      // Delete all pregnancy records
      const cattleEntries = groupedPlans.find((g) => g.cattleId === cattleId);
      if (cattleEntries) {
        const deletePromises = cattleEntries.entries
          .filter((e) => e.id)
          .map((e) => deleteUserDocument(user.uid, 'pregnancy', e.id!));
        await Promise.all(deletePromises);
      }
      
      // Update cattle profile female status
      const cattleProfile = herd.find(c => c.id === cattleId);
      if (cattleProfile && cattleProfile.id) {
        const { updateUserDocument } = await import('@/services/firestore');
        await updateUserDocument(user.uid, 'cattle', cattleProfile.id, {
          femaleStatus: femaleStatus,
        });
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to delete. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const handleEditTrimester = (planId: string, currentTrimester: 'early' | 'mid' | 'late') => {
    setEditTrimesterValue(currentTrimester);
    setEditingPlanId(planId);
    setEditingTrimester(planId);
  };

  const handleSaveTrimester = async () => {
    if (!user || !editingPlanId) return;
    
    try {
      // Find the plan to get dueDate
      const planToUpdate = filteredPlans.find(p => p.id === editingPlanId);
      if (!planToUpdate || !planToUpdate.dueDate) {
        Alert.alert('Error', 'Cannot update: missing due date information.');
        return;
      }
      
      // Get cattle type from herd
      const cattleMeta = herd.find(c => c.id === planToUpdate.cattleId);
      const cattleType = cattleMeta?.type || 'cow';
      
      // Calculate new blocked months based on new trimester
      const newBlockedMonths = calculateBlockedMonthsFromTrimester(planToUpdate.dueDate, editTrimesterValue, cattleType);
      
      // Update both trimester and blocked months
      await updateUserDocument(user.uid, 'pregnancy', editingPlanId, {
        trimester: editTrimesterValue,
        blockedMonth: newBlockedMonths.join(','),
      });
      
      setEditingTrimester(null);
      setEditingPlanId(null);
      Alert.alert('Success', 'Trimester and blocked months updated successfully.');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update trimester. Please try again.');
    }
  };

  const handleCancelEditTrimester = () => {
    setEditingTrimester(null);
    setEditingPlanId(null);
  };

  const handleToggleTodo = async (todoId: string, currentStatus: boolean) => {
    if (!user) return;

    try {
      await updateUserDocument(user.uid, 'pregnancy', todoId, {
        completed: !currentStatus,
      });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update todo. Please try again.');
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    if (!user) return;

    Alert.alert('Delete Todo', 'Are you sure you want to delete this todo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingTodo(todoId);
          try {
            await deleteUserDocument(user.uid, 'pregnancy', todoId);
          } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to delete. Please try again.');
          } finally {
            setDeletingTodo(null);
          }
        },
      },
    ]);
  };

  const toggleCardExpansion = (planId: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(planId)) {
        newSet.delete(planId);
      } else {
        newSet.add(planId);
      }
      return newSet;
    });
  };

  const openTodoModal = (cattleId: string, mainPlanId?: string) => {
    setSelectedCattleId(cattleId);
    setShowTodoModal(true);
    // Initialize date picker with first available date from trimester
    const mainPlan = mainPlanId 
      ? filteredPlans.find(p => p.id === mainPlanId && !p.todo && !p.calendarDate)
      : filteredPlans.find(p => !p.todo && !p.calendarDate && p.cattleId === cattleId);
    if (mainPlan) {
      const dateRange = getTrimesterDateRange(mainPlan);
      setSelectedYear(dateRange.startYear);
      setSelectedMonth(dateRange.startMonth);
      setSelectedDay(1);
    }
  };


  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView 
        contentContainerStyle={styles.container}
      >
        {!contextSelectedCattle ? (
          <SectionCard title="Pregnancy">
            <Text style={styles.helper}>Please select a cattle profile to manage pregnancy plans.</Text>
          </SectionCard>
        ) : (
          <>
            {loading ? (
              <SectionCard title="Pregnancy">
                <ActivityIndicator size="large" color="#0a7ea4" />
                <Text style={styles.helper}>Loading pregnancy plans...</Text>
              </SectionCard>
            ) : filteredPlans.length === 0 ? (
              <SectionCard title="Pregnancy">
                {contextSelectedCattle.sex === 'female' && contextSelectedCattle.femaleStatus === 'pregnant' ? (
                  <>
                    <Text style={styles.helper}>This cattle is marked as pregnant but has no plan.</Text>
                    <Pressable style={styles.primaryButton} onPress={() => setShowPregnancyFormModal(true)}>
                      <Ionicons name="add" size={20} color="#fff" />
                      <Text style={styles.primaryText}>Create Pregnancy Plan</Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={styles.helper}>No pregnancy plan found for {contextSelectedCattle.name}.</Text>
                )}
              </SectionCard>
            ) : groupedPlans.length === 0 ? (
              <SectionCard title="Pregnancy">
                <Text style={styles.helper}>No main pregnancy plan found. Total plans: {filteredPlans.length}</Text>
                <Text style={styles.helper}>Plans breakdown: {JSON.stringify(filteredPlans.map(p => ({ hasTodo: !!p.todo, hasCalendar: !!p.calendarDate, completed: p.completed })), null, 2)}</Text>
              </SectionCard>
            ) : (
              // Show all pregnancy plans as expandable history cards
              groupedPlans.map((group) => {
                const mainPlan = group.entries.find(e => !e.todo && !e.calendarDate) || group.entries[0];
                const todos = group.entries.filter(e => e.todo && e.calendarDate);
                
                // Get cattle type from herd
                const cattleMeta = herd.find(c => c.id === group.cattleId);
                const cattleType = cattleMeta?.type || 'cow';
                const expectedMonths = mainPlan.dueDate ? calculateExpectedMonths(mainPlan.dueDate, cattleType) : null;
                const blockedMonthsArray = getBlockedMonthsArray(mainPlan.blockedMonth || '');
                const isCompleted = mainPlan.completed === true;
                const isExpanded = mainPlan.id ? expandedCards.has(mainPlan.id) : false;
                
                return (
                  <View key={mainPlan.id || group.cattleId} style={styles.historyCardContainer}>
                    {isCompleted ? (
                      // Completed Pregnancy - Keep existing compact layout
                      <>
                        <Pressable 
                          style={[styles.historyCard, styles.historyCardCompleted]}
                          onPress={() => mainPlan.id && toggleCardExpansion(mainPlan.id)}
                        >
                          <View style={styles.historyCardHeader}>
                            <View style={styles.historyCardLeft}>
                              <View style={styles.historyCardIconContainer}>
                                <Ionicons 
                                  name="checkmark-circle" 
                                  size={24} 
                                  color="#10B981" 
                                />
                              </View>
                              <View style={styles.historyCardInfo}>
                                <View style={styles.historyCardTitleRow}>
                                  <Text style={styles.historyCardTitle}>{group.cattleName}</Text>
                                  <View style={styles.historyCompletedBadge}>
                                    <Text style={styles.historyCompletedText}>Completed</Text>
                                  </View>
                                </View>
                                <Text style={styles.historyCardSubtitle}>Pregnancy History</Text>
                                <View style={styles.historyCardMeta}>
                                  <View style={styles.historyMetaItem}>
                                    <Ionicons name="calendar-outline" size={14} color="#64748B" />
                                    <Text style={styles.historyMetaText}>
                                      {expectedMonths ? expectedMonths.display : 'No date set'}
                                    </Text>
                                  </View>
                                  <View style={styles.historyMetaItem}>
                                    <Ionicons name="time-outline" size={14} color="#64748B" />
                                    <Text style={styles.historyMetaText}>
                                      {mainPlan.trimester || 'early'} trimester
                                    </Text>
                                  </View>
                                  {todos.length > 0 && (
                                    <View style={styles.historyMetaItem}>
                                      <Ionicons name="list-outline" size={14} color="#64748B" />
                                      <Text style={styles.historyMetaText}>
                                        {todos.length} {todos.length === 1 ? 'task' : 'tasks'}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            </View>
                            <View style={styles.historyCardActions}>
                              <Ionicons 
                                name={isExpanded ? "chevron-up" : "chevron-down"} 
                                size={24} 
                                color="#64748B" 
                              />
                            </View>
                          </View>
                        </Pressable>

                        {/* Expanded Details - Show when card is expanded */}
                        {isExpanded && (
                          <View style={styles.historyCardDetails}>
                            {/* Expected Delivery */}
                            {expectedMonths && (
                              <View style={styles.detailSection}>
                                <View style={styles.detailSectionHeader}>
                                  <Ionicons name="calendar" size={18} color="#0a7ea4" />
                                  <Text style={styles.detailSectionTitle}>Expected Delivery</Text>
                                </View>
                                <Text style={styles.detailSectionValue}>{expectedMonths.display}</Text>
                                <Text style={styles.detailSectionNote}>Estimate only</Text>
                              </View>
                            )}

                            {/* Trimester */}
                            <View style={styles.detailSection}>
                              <View style={styles.detailSectionHeader}>
                                <Ionicons name="time" size={18} color="#D97706" />
                                <Text style={styles.detailSectionTitle}>Trimester</Text>
                              </View>
                              <Tag label={mainPlan.trimester || 'early'} tone="warning" />
                            </View>

                            {/* Blocked Months */}
                            {blockedMonthsArray.length > 0 && (
                              <View style={styles.detailSection}>
                                <View style={styles.detailSectionHeader}>
                                  <Ionicons name="lock-closed" size={18} color="#92400E" />
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.detailSectionTitle}>Blocked Months</Text>
                                    <Text style={styles.detailSectionSubtitle}>
                                      {(() => {
                                        const trimester = mainPlan.trimester || 'early';
                                        if (cattleType === 'cow') {
                                          return trimester === 'early' 
                                            ? 'Months 0-3 from pregnancy date' 
                                            : trimester === 'mid' 
                                            ? 'Months 3-6 from pregnancy date' 
                                            : 'Months 6-9 from pregnancy date';
                                        } else {
                                          return trimester === 'early' 
                                            ? 'Months 0-4 from pregnancy date' 
                                            : trimester === 'mid' 
                                            ? 'Months 4-8 from pregnancy date' 
                                            : 'Months 8-12 from pregnancy date';
                                        }
                                      })()}
                                    </Text>
                                  </View>
                                </View>
                                <View style={styles.blockedMonthsRow}>
                                  {blockedMonthsArray.map((month) => (
                                    <View key={month} style={styles.blockedMonthChip}>
                                      <Text style={styles.blockedMonthText}>{month}</Text>
                                    </View>
                                  ))}
                                </View>
                              </View>
                            )}

                            {/* To-Do List */}
                            <View style={styles.detailSection}>
                              <View style={styles.detailSectionHeader}>
                                <Ionicons name="list" size={18} color="#D97706" />
                                <Text style={styles.detailSectionTitle}>To-Do List</Text>
                              </View>
                              
                              {todos.length === 0 ? (
                                <View style={styles.emptyTodosInline}>
                                  <Ionicons name="checkmark-circle-outline" size={32} color="#CBD5E1" />
                                  <Text style={styles.emptyTodosInlineText}>No tasks yet</Text>
                                </View>
                              ) : (
                                <View style={styles.todosListInline}>
                                  {todos.map((entry, idx) => {
                                    const todoCompleted = entry.completed || false;
                                    return (
                                      <View key={entry.id || idx} style={[styles.todoItemInline, todoCompleted && styles.todoItemInlineCompleted]}>
                                        <Pressable
                                          style={styles.todoCheckboxInline}
                                          onPress={() => entry.id && handleToggleTodo(entry.id, todoCompleted)}
                                        >
                                          <View style={[styles.checkboxInline, todoCompleted && styles.checkboxInlineChecked]}>
                                            {todoCompleted && <Ionicons name="checkmark" size={12} color="#fff" />}
                                          </View>
                                        </Pressable>
                                        <View style={styles.todoContentInline}>
                                          <View style={styles.todoHeaderInline}>
                                            <View style={styles.todoDateInline}>
                                              <Ionicons name="calendar-outline" size={12} color="#64748B" />
                                              <Text style={styles.todoDateTextInline}>{formatDisplayDate(entry.calendarDate || '')}</Text>
                                            </View>
                                            <Pressable
                                              style={styles.todoDeleteInline}
                                              onPress={() => entry.id && handleDeleteTodo(entry.id)}
                                              disabled={deletingTodo === entry.id}
                                            >
                                              {deletingTodo === entry.id ? (
                                                <ActivityIndicator size="small" color="#EF4444" />
                                              ) : (
                                                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                                              )}
                                            </Pressable>
                                          </View>
                                          <Text style={[styles.todoTextInline, todoCompleted && styles.todoTextInlineCompleted]}>
                                            {entry.todo}
                                          </Text>
                                        </View>
                                      </View>
                                    );
                                  })}
                                </View>
                              )}
                            </View>

                            {/* Action Buttons */}
                            <View style={styles.detailActions}>
                              <Pressable
                                style={[styles.detailActionButton, styles.detailActionButtonDelete]}
                                onPress={() => handleDeleteCattle(group.cattleId, group.cattleName)}
                                disabled={deleting === group.cattleId}
                              >
                                {deleting === group.cattleId ? (
                                  <ActivityIndicator size="small" color="#EF4444" />
                                ) : (
                                  <>
                                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                    <Text style={[styles.detailActionText, styles.detailActionTextDelete]}>Delete</Text>
                                  </>
                                )}
                              </Pressable>
                            </View>
                          </View>
                        )}
                      </>
                    ) : (
                      // Active Pregnancy - New prominent layout
                      <View style={styles.activePregnancyCard}>
                        {/* Header Section */}
                        <View style={styles.activePregnancyHeader}>
                          <View style={styles.activePregnancyHeaderLeft}>
                            <View style={styles.activePregnancyIconContainer}>
                              <Ionicons name="heart" size={28} color="#0a7ea4" />
                            </View>
                            <View style={styles.activePregnancyTitleSection}>
                              <Text style={styles.activePregnancyTitle}>{group.cattleName}</Text>
                              <View style={styles.activePregnancyBadge}>
                                <Ionicons name="time" size={14} color="#0a7ea4" />
                                <Text style={styles.activePregnancyBadgeText}>Active Pregnancy</Text>
                              </View>
                            </View>
                          </View>
                        </View>

                        {/* Expected Delivery - Prominent Display */}
                        {expectedMonths && (
                          <View style={styles.activeExpectedDelivery}>
                            <View style={styles.activeExpectedDeliveryIcon}>
                              <Ionicons name="calendar" size={24} color="#fff" />
                            </View>
                            <View style={styles.activeExpectedDeliveryContent}>
                              <Text style={styles.activeExpectedDeliveryLabel}>Expected Delivery</Text>
                              <Text style={styles.activeExpectedDeliveryValue}>{expectedMonths.display}</Text>
                              <Text style={styles.activeExpectedDeliveryNote}>±15 days estimate</Text>
                            </View>
                          </View>
                        )}

                        {/* Trimester & Blocked Months Row */}
                        <View style={styles.activeInfoRow}>
                          <View style={styles.activeTrimesterCard}>
                            <Ionicons name="time" size={20} color="#D97706" />
                            <Text style={styles.activeTrimesterLabel}>Trimester</Text>
                            <Tag label={mainPlan.trimester || 'early'} tone="warning" />
                          </View>
                          
                          {blockedMonthsArray.length > 0 && (
                            <View style={styles.activeBlockedMonthsCard}>
                              <Ionicons name="lock-closed" size={20} color="#92400E" />
                              <Text style={styles.activeBlockedMonthsLabel}>Blocked</Text>
                              <Text style={styles.activeBlockedMonthsCount}>{blockedMonthsArray.length} months</Text>
                            </View>
                          )}
                        </View>

                        {/* Blocked Months Grid */}
                        {blockedMonthsArray.length > 0 && (
                          <View style={styles.activeBlockedMonthsSection}>
                            <Text style={styles.activeBlockedMonthsSectionTitle}>
                              {(() => {
                                const trimester = mainPlan.trimester || 'early';
                                if (cattleType === 'cow') {
                                  return trimester === 'early' 
                                    ? 'Months 0-3 from pregnancy date' 
                                    : trimester === 'mid' 
                                    ? 'Months 3-6 from pregnancy date' 
                                    : 'Months 6-9 from pregnancy date';
                                } else {
                                  return trimester === 'early' 
                                    ? 'Months 0-4 from pregnancy date' 
                                    : trimester === 'mid' 
                                    ? 'Months 4-8 from pregnancy date' 
                                    : 'Months 8-12 from pregnancy date';
                                }
                              })()}
                            </Text>
                            <View style={styles.activeBlockedMonthsGrid}>
                              {blockedMonthsArray.map((month) => (
                                <View key={month} style={styles.activeBlockedMonthChip}>
                                  <Ionicons name="lock-closed" size={14} color="#92400E" />
                                  <Text style={styles.activeBlockedMonthText}>{month}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}

                        {/* To-Do List Section */}
                        <View style={styles.activeTodosSection}>
                          <View style={styles.activeTodosHeader}>
                            <View style={styles.activeTodosHeaderLeft}>
                              <Ionicons name="list" size={20} color="#D97706" />
                              <Text style={styles.activeTodosTitle}>To-Do List</Text>
                              {todos.length > 0 && (
                                <View style={styles.activeTodosCountBadge}>
                                  <Text style={styles.activeTodosCountText}>{todos.length}</Text>
                                </View>
                              )}
                            </View>
                            <Pressable 
                              style={styles.activeAddTodoButton}
                              onPress={() => openTodoModal(group.cattleId, mainPlan.id)}
                            >
                              <Ionicons name="add-circle" size={24} color="#D97706" />
                            </Pressable>
                          </View>
                          
                          {todos.length === 0 ? (
                            <View style={styles.activeEmptyTodos}>
                              <Ionicons name="checkmark-circle-outline" size={40} color="#CBD5E1" />
                              <Text style={styles.activeEmptyTodosText}>No tasks yet. Add your first task!</Text>
                            </View>
                          ) : (
                            <View style={styles.activeTodosList}>
                              {todos.map((entry, idx) => {
                                const todoCompleted = entry.completed || false;
                                return (
                                  <View key={entry.id || idx} style={[styles.activeTodoItem, todoCompleted && styles.activeTodoItemCompleted]}>
                                    <Pressable
                                      style={styles.activeTodoCheckbox}
                                      onPress={() => entry.id && handleToggleTodo(entry.id, todoCompleted)}
                                    >
                                      <View style={[styles.activeCheckbox, todoCompleted && styles.activeCheckboxChecked]}>
                                        {todoCompleted && <Ionicons name="checkmark" size={14} color="#fff" />}
                                      </View>
                                    </Pressable>
                                    <View style={styles.activeTodoContent}>
                                      <View style={styles.activeTodoHeader}>
                                        <View style={styles.activeTodoDate}>
                                          <Ionicons name="calendar-outline" size={14} color="#64748B" />
                                          <Text style={styles.activeTodoDateText}>{formatDisplayDate(entry.calendarDate || '')}</Text>
                                        </View>
                                        <Pressable
                                          style={styles.activeTodoDelete}
                                          onPress={() => entry.id && handleDeleteTodo(entry.id)}
                                          disabled={deletingTodo === entry.id}
                                        >
                                          {deletingTodo === entry.id ? (
                                            <ActivityIndicator size="small" color="#EF4444" />
                                          ) : (
                                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                          )}
                                        </Pressable>
                                      </View>
                                      <Text style={[styles.activeTodoText, todoCompleted && styles.activeTodoTextCompleted]}>
                                        {entry.todo}
                                      </Text>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.activeActions}>
                          <Pressable
                            style={styles.activeEditButton}
                            onPress={() => mainPlan.id && handleEditTrimester(mainPlan.id, (mainPlan.trimester || 'early') as 'early' | 'mid' | 'late')}
                          >
                            <Ionicons name="pencil" size={18} color="#0a7ea4" />
                            <Text style={styles.activeEditButtonText}>Edit Trimester</Text>
                          </Pressable>
                          <Pressable
                            style={styles.activeDeleteButton}
                            onPress={() => handleDeleteCattle(group.cattleId, group.cattleName)}
                            disabled={deleting === group.cattleId}
                          >
                            {deleting === group.cattleId ? (
                              <ActivityIndicator size="small" color="#EF4444" />
                            ) : (
                              <>
                                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                <Text style={styles.activeDeleteButtonText}>Delete</Text>
                              </>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* Edit Trimester Modal */}
      <Modal visible={editingTrimester !== null} animationType="slide" onRequestClose={handleCancelEditTrimester}>
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', default: undefined })}>
            <ScrollView contentContainerStyle={styles.editTrimesterModalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.editTrimesterModalHeader}>
                <Pressable style={styles.closeButton} onPress={handleCancelEditTrimester}>
                  <Ionicons name="close" size={24} color="#64748B" />
                </Pressable>
                <Text style={styles.editTrimesterModalTitle}>Edit Trimester</Text>
                <View style={{ width: 40 }} />
              </View>

              <Text style={styles.editTrimesterModalSubtitle}>
                Select the current trimester. Blocked months will be updated automatically.
              </Text>

              <View style={styles.editTrimesterOptions}>
                {(['early', 'mid', 'late'] as const).map((trimester) => (
                  <Pressable
                    key={trimester}
                    style={[styles.trimesterOptionCard, editTrimesterValue === trimester && styles.trimesterOptionCardActive]}
                    onPress={() => setEditTrimesterValue(trimester)}
                  >
                    <View style={styles.trimesterOptionContent}>
                      <View style={[styles.trimesterOptionIcon, editTrimesterValue === trimester && styles.trimesterOptionIconActive]}>
                        <Ionicons 
                          name={trimester === 'early' ? 'leaf' : trimester === 'mid' ? 'flower' : 'star'} 
                          size={24} 
                          color={editTrimesterValue === trimester ? '#fff' : '#D97706'} 
                        />
                      </View>
                      <View style={styles.trimesterOptionText}>
                        <Text style={[styles.trimesterOptionLabel, editTrimesterValue === trimester && styles.trimesterOptionLabelActive]}>
                          {trimester.charAt(0).toUpperCase() + trimester.slice(1)} Trimester
                        </Text>
                        <Text style={styles.trimesterOptionDescription}>
                          {(() => {
                            const cattleMeta = herd.find(c => c.id === filteredPlans.find(p => p.id === editingPlanId)?.cattleId);
                            const cattleType = cattleMeta?.type || 'cow';
                            if (cattleType === 'cow') {
                              return trimester === 'early' 
                                ? 'Months 0-3 of pregnancy' 
                                : trimester === 'mid' 
                                ? 'Months 3-6 of pregnancy' 
                                : 'Months 6-9 of pregnancy';
                            } else {
                              return trimester === 'early' 
                                ? 'Months 0-4 of pregnancy' 
                                : trimester === 'mid' 
                                ? 'Months 4-8 of pregnancy' 
                                : 'Months 8-12 of pregnancy';
                            }
                          })()}
                        </Text>
                      </View>
                      {editTrimesterValue === trimester && (
                        <Ionicons name="checkmark-circle" size={24} color="#0a7ea4" />
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>

              <View style={styles.editTrimesterModalActions}>
                <Pressable style={styles.cancelTrimesterButton} onPress={handleCancelEditTrimester}>
                  <Text style={styles.cancelTrimesterButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveTrimesterButton} onPress={handleSaveTrimester}>
                  <Text style={styles.saveTrimesterButtonText}>Save Changes</Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Add Todo Modal */}
      <Modal visible={showTodoModal} animationType="slide" onRequestClose={() => setShowTodoModal(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', default: undefined })}>
            {Platform.OS === 'web' ? (
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <Pressable style={styles.closeButton} onPress={() => { setShowTodoModal(false); setTodoForm(initialTodoForm); setError(''); }}>
                    <Ionicons name="close" size={24} color="#64748B" />
                  </Pressable>
                  <Text style={styles.modalTitle}>Add To-Do</Text>
                  <View style={{ width: 40 }} />
                </View>

                <View style={styles.labelContainer}>
                  <Text style={styles.label}>Calendar Date</Text>
                  <Pressable style={styles.datePickerButton} onPress={openDatePicker}>
                    <Text style={[styles.datePickerText, !todoForm.calendarDate && styles.datePickerPlaceholder]}>
                      {todoForm.calendarDate ? formatDisplayDate(todoForm.calendarDate) : 'Select date'}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#64748B" />
                  </Pressable>
                </View>

                <View style={styles.labelContainer}>
                  <Text style={styles.label}>To-Do / Action</Text>
                    <TextInput
                      style={[styles.input, styles.todoInput]}
                      placeholder="Ultrasound, hoof check, add mineral mix..."
                      placeholderTextColor="#94A3B8"
                      value={todoForm.todo}
                      onChangeText={(text) => handleTodoChange('todo', text)}
                      multiline
                      numberOfLines={4}
                    />
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable style={[styles.primaryButton, saving && { opacity: 0.6 }]} onPress={handleAddTodo} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryText}>{saving ? 'Adding…' : 'Add Todo'}</Text>
                  )}
                </Pressable>
              </ScrollView>
            ) : (
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={styles.modalHeader}>
                    <Pressable style={styles.closeButton} onPress={() => { setShowTodoModal(false); setTodoForm(initialTodoForm); setError(''); }}>
                      <Ionicons name="close" size={24} color="#64748B" />
                    </Pressable>
                    <Text style={styles.modalTitle}>Add To-Do</Text>
                    <View style={{ width: 40 }} />
                  </View>

                  <View style={styles.labelContainer}>
                    <Text style={styles.label}>Calendar Date</Text>
                    <Pressable style={styles.datePickerButton} onPress={openDatePicker}>
                      <Text style={[styles.datePickerText, !todoForm.calendarDate && styles.datePickerPlaceholder]}>
                        {todoForm.calendarDate ? formatDisplayDate(todoForm.calendarDate) : 'Select date'}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color="#64748B" />
                    </Pressable>
                  </View>

                  <View style={styles.labelContainer}>
                    <Text style={styles.label}>To-Do / Action</Text>
                    <TextInput
                      style={[styles.input, styles.todoInput]}
                      placeholder="Ultrasound, hoof check, add mineral mix..."
                      placeholderTextColor="#94A3B8"
                      value={todoForm.todo}
                      onChangeText={(text) => handleTodoChange('todo', text)}
                      multiline
                      numberOfLines={4}
                    />
                  </View>

                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <Pressable style={[styles.primaryButton, saving && { opacity: 0.6 }]} onPress={handleAddTodo} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryText}>{saving ? 'Adding…' : 'Add Todo'}</Text>
                    )}
                  </Pressable>
                </ScrollView>
              </TouchableWithoutFeedback>
            )}
          </KeyboardAvoidingView>
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
                          style={[styles.toggleChip, { minWidth: 120 }, pregnancyForm.trimester === trimester && styles.toggleChipActive]}
                          onPress={() => {
                            setPregnancyForm((prev) => {
                              if (prev.dueDate) {
                                const cattleType = contextSelectedCattle?.type || 'cow';
                                const autoBlockedMonths = calculateBlockedMonthsFromTrimester(prev.dueDate, trimester, cattleType);
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
                        const isInRange = pregnancyForm.blockedMonths.includes(month);

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

                  <Pressable style={[styles.primaryButton, creating && { opacity: 0.6 }]} onPress={handleCreatePregnancyPlan} disabled={creating}>
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
                            style={[styles.toggleChip, { minWidth: 120 }, pregnancyForm.trimester === trimester && styles.toggleChipActive]}
                            onPress={() => {
                              setPregnancyForm((prev) => {
                                if (prev.dueDate) {
                                  const cattleType = contextSelectedCattle?.type || 'cow';
                                  const autoBlockedMonths = calculateBlockedMonthsFromTrimester(prev.dueDate, trimester, cattleType);
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
                          const isInRange = pregnancyForm.blockedMonths.includes(month);

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

                    <Pressable style={[styles.primaryButton, creating && { opacity: 0.6 }]} onPress={handleCreatePregnancyPlan} disabled={creating}>
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

      {/* Todo Date Picker Modal - Rendered last to appear on top of Add Todo Modal */}
      <Modal visible={showTodoDatePicker} transparent animationType="fade" onRequestClose={() => setShowTodoDatePicker(false)}>
        <Pressable style={styles.dateModalOverlay} onPress={() => setShowTodoDatePicker(false)}>
          <Pressable style={styles.dateModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dateModalHeader}>
              <Text style={styles.dateModalTitle}>Select Calendar Date</Text>
              <Pressable onPress={() => setShowTodoDatePicker(false)}>
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
  safe: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    borderColor: AppColors.border,
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: AppColors.surface,
  },
  toggleChipActive: {
    backgroundColor: '#E8EFE9',
    borderColor: AppColors.primary,
  },
  toggleText: {
    fontWeight: '700',
    fontSize: 15,
    color: AppColors.subtleText,
  },
  toggleTextActive: {
    color: AppColors.primary,
  },
  container: {
    padding: 20,
    paddingBottom: 60,
  },
  helper: {
    color: '#475569',
    fontSize: 14,
    marginBottom: 12,
  },
  helperText: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 8,
  },
  labelContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#182230',
  },
  cattleScroller: {
    marginVertical: 8,
  },
  cattleChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    marginRight: 10,
    backgroundColor: AppColors.surface,
  },
  cattleChipActive: {
    backgroundColor: '#FDE68A',
    borderColor: '#EAB308',
  },
  cattleChipText: {
    color: '#475569',
    fontWeight: '600',
  },
  cattleChipTextActive: {
    color: '#92400E',
  },
  triChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  triChipActive: {
    backgroundColor: '#FEF9C3',
  },
  triChipText: {
    color: '#92400E',
  },
  triChipTextActive: {
    fontWeight: '700',
  },
  monthRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    backgroundColor: AppColors.surface,
  },
  monthChipActive: {
    backgroundColor: '#FDE68A',
    borderColor: '#EAB308',
  },
  monthChipText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  monthChipTextActive: {
    color: '#92400E',
  },
  selectedMonthsText: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: '#D0D7DE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  datePickerText: {
    fontSize: 15,
    color: '#0F172A',
    flex: 1,
  },
  datePickerPlaceholder: {
    color: '#94A3B8',
  },
  primaryButton: {
    backgroundColor: '#D97706',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  error: {
    color: '#DC2626',
    marginTop: 6,
    fontSize: 14,
  },
  board: {
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#FFFBEB',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#78350F',
  },
  groupSubtitle: {
    color: '#9A3412',
    fontSize: 14,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  cardInfo: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoLabel: {
    color: '#92400E',
    fontWeight: '600',
    fontSize: 14,
  },
  infoValue: {
    color: '#78350F',
    fontSize: 14,
  },
  todosSection: {
    marginTop: 8,
  },
  todosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  todosTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#78350F',
  },
  addTodoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
  },
  addTodoText: {
    color: '#D97706',
    fontWeight: '600',
    fontSize: 14,
  },
  todoCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#D97706',
  },
  todoCardCompleted: {
    opacity: 0.7,
    borderLeftColor: '#10B981',
  },
  todoContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkboxContainer: {
    paddingTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D97706',
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  todoTextContainer: {
    flex: 1,
  },
  todoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  todoDate: {
    color: '#B45309',
    fontWeight: '600',
    fontSize: 13,
    flex: 1,
  },
  todoDeleteButton: {
    padding: 4,
  },
  todoText: {
    color: '#78350F',
    fontSize: 14,
  },
  todoTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  noTodos: {
    color: '#94A3B8',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
    elevation: 9999,
  },
  dateModalContent: {
    backgroundColor: AppColors.surface,
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    zIndex: 10000,
    elevation: 10000,
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
    color: '#64748B',
  },
  dateOptionTextSelected: {
    color: '#0a7ea4',
    fontWeight: '700',
  },
  dateConfirmButton: {
    backgroundColor: '#D97706',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  dateConfirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSafe: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  modalContent: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
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
    color: '#0F172A',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D0D7DE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111',
    backgroundColor: AppColors.surface,
  },
  todoInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  // New Colorful Pregnancy Plan UI Styles
  pregnancyPlanContainer: {
    marginBottom: 20,
    gap: 16,
  },
  pregnancyPlanCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E0F2FE',
    shadowColor: '#0a7ea4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#0a7ea4', { width: 0, height: 4 }, 0.1, 12),
    }),
  },
  pregnancyPlanCardCompleted: {
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDF4',
    opacity: 0.95,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cattleNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cattleNameText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  planSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonDelete: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expectedDeliveryHighlight: {
    backgroundColor: '#0a7ea4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#0a7ea4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#0a7ea4', { width: 0, height: 2 }, 0.2, 6),
    }),
  },
  expectedDeliveryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expectedDeliveryTextContainer: {
    flex: 1,
  },
  expectedDeliveryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  expectedDeliveryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  disclaimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  disclaimerTextSmall: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  trimesterCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#FCD34D',
  },
  trimesterCardHeader: {
    marginBottom: 12,
  },
  trimesterCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trimesterCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  trimesterEditButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: AppColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  trimesterCardContent: {
    alignItems: 'flex-start',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  editTrimesterContainer: {
    marginTop: 8,
  },
  // Edit Trimester Modal Styles
  editTrimesterModalContent: {
    backgroundColor: AppColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  editTrimesterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editTrimesterModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  editTrimesterModalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
    lineHeight: 20,
  },
  editTrimesterOptions: {
    gap: 12,
    marginBottom: 24,
  },
  trimesterOptionCard: {
    backgroundColor: AppColors.background,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  trimesterOptionCardActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0a7ea4',
  },
  trimesterOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  trimesterOptionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trimesterOptionIconActive: {
    backgroundColor: '#0a7ea4',
  },
  trimesterOptionText: {
    flex: 1,
  },
  trimesterOptionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  trimesterOptionLabelActive: {
    color: '#0a7ea4',
  },
  trimesterOptionDescription: {
    fontSize: 13,
    color: '#64748B',
  },
  editTrimesterModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelTrimesterButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelTrimesterButtonText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 16,
  },
  saveTrimesterButton: {
    flex: 1,
    backgroundColor: '#0a7ea4',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveTrimesterButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  triChipEdit: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    marginBottom: 8,
  },
  triChipEditActive: {
    backgroundColor: '#FDE68A',
  },
  triChipEditText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  triChipEditTextActive: {
    color: '#92400E',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  saveButtonEdit: {
    flex: 1,
    backgroundColor: '#0a7ea4',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonEditText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  cancelButtonEdit: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonEditText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
  },
  monthsSection: {
    marginBottom: 8,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  monthChipDisplay: {
    width: '22%',
    minWidth: 70,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: AppColors.background,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    padding: 8,
  },
  monthChipBlocked: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 2,
  },
  monthChipExpected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#60A5FA',
    borderWidth: 2,
  },
  monthChipDisplayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  monthChipDisplayTextBlocked: {
    color: '#92400E',
  },
  monthChipDisplayTextExpected: {
    color: '#1E40AF',
  },
  expectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
  monthsLegend: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendColorBlocked: {
    backgroundColor: '#FCD34D',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  legendColorExpected: {
    backgroundColor: '#60A5FA',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  legendText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  todosCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FEF3C7',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#D97706', { width: 0, height: 4 }, 0.1, 12),
    }),
  },
  todosCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  todosCardSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  addTodoButtonCard: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E0F2FE',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  addButtonText: {
    color: '#0a7ea4',
    fontWeight: '700',
    fontSize: 15,
  },
  todosList: {
    gap: 12,
    marginTop: 16,
  },
  emptyTodosBoxNew: {
    backgroundColor: AppColors.background,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyTodosIconContainer: {
    marginBottom: 12,
  },
  emptyTodosTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  emptyTodosText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  todoCardNew: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#000', { width: 0, height: 1 }, 0.05, 2),
    }),
  },
  todoCardNewCompleted: {
    opacity: 0.7,
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDF4',
  },
  todoCheckboxNew: {
    paddingTop: 2,
  },
  checkboxNew: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D97706',
    backgroundColor: AppColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxNewChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  todoContentNew: {
    flex: 1,
  },
  todoHeaderNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  todoDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  todoDateNew: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  todoDeleteButtonNew: {
    padding: 4,
    borderRadius: 6,
  },
  todoTextNew: {
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 20,
    fontWeight: '500',
  },
  todoTextNewCompleted: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  // Legacy styles (keeping for compatibility)
  expectedMonthCard: {
    backgroundColor: '#E0F2FE',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0a7ea4',
    marginBottom: 16,
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
  trimesterDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#0a7ea4',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
  },
  actionButtonsRow: {
    marginTop: 16,
  },
  // History Card Styles
  historyCardContainer: {
    marginBottom: 16,
  },
  historyCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#000', { width: 0, height: 2 }, 0.05, 8),
    }),
  },
  historyCardCompleted: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1FAE5',
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyCardLeft: {
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  historyCardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyCardInfo: {
    flex: 1,
    gap: 4,
  },
  historyCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  historyCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyCompletedBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historyCompletedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
    textTransform: 'uppercase',
  },
  historyCardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  historyCardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  historyMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyMetaText: {
    fontSize: 12,
    color: '#64748B',
  },
  historyCardActions: {
    paddingLeft: 8,
  },
  historyCardDetails: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 16,
  },
  detailSection: {
    gap: 8,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  detailSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  detailSectionValue: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  detailSectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  detailSectionNote: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  blockedMonthsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  blockedMonthChip: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  blockedMonthText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  addTodoButtonInline: {
    marginLeft: 'auto',
    padding: 4,
  },
  emptyTodosInline: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyTodosInlineText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  todosListInline: {
    gap: 12,
  },
  todoItemInline: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: AppColors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  todoItemInlineCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#D1FAE5',
    opacity: 0.8,
  },
  todoCheckboxInline: {
    paddingTop: 2,
  },
  checkboxInline: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D97706',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
  },
  checkboxInlineChecked: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  todoContentInline: {
    flex: 1,
    gap: 6,
  },
  todoHeaderInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todoDateInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todoDateTextInline: {
    fontSize: 12,
    color: '#64748B',
  },
  todoDeleteInline: {
    padding: 4,
  },
  todoTextInline: {
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 20,
  },
  todoTextInlineCompleted: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  detailActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  detailActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  detailActionButtonDelete: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  detailActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  detailActionTextDelete: {
    color: '#EF4444',
  },
  deletePlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#EF4444', { width: 0, height: 2 }, 0.2, 4),
    }),
  },
  deletePlanButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  // Active Pregnancy Layout Styles
  activePregnancyCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E0F2FE',
    shadowColor: '#0a7ea4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#0a7ea4', { width: 0, height: 4 }, 0.1, 12),
    }),
  },
  activePregnancyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  activePregnancyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  activePregnancyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePregnancyTitleSection: {
    flex: 1,
  },
  activePregnancyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  activePregnancyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  activePregnancyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0a7ea4',
    textTransform: 'uppercase',
  },
  activeExpectedDelivery: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a7ea4',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    gap: 16,
    shadowColor: '#0a7ea4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    ...(Platform.OS === 'web' && {
      boxShadow: createBoxShadow('#0a7ea4', { width: 0, height: 2 }, 0.2, 6),
    }),
  },
  activeExpectedDeliveryIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeExpectedDeliveryContent: {
    flex: 1,
  },
  activeExpectedDeliveryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  activeExpectedDeliveryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  activeExpectedDeliveryNote: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontStyle: 'italic',
  },
  activeInfoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  activeTrimesterCard: {
    flex: 1,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FCD34D',
    alignItems: 'center',
    gap: 8,
  },
  activeTrimesterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    textTransform: 'uppercase',
  },
  activeBlockedMonthsCard: {
    flex: 1,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FCD34D',
    alignItems: 'center',
    gap: 8,
  },
  activeBlockedMonthsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    textTransform: 'uppercase',
  },
  activeBlockedMonthsCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400E',
  },
  activeBlockedMonthsSection: {
    marginBottom: 20,
  },
  activeBlockedMonthsSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
  },
  activeBlockedMonthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeBlockedMonthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FCD34D',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  activeBlockedMonthText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  activeTodosSection: {
    marginBottom: 20,
  },
  activeTodosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activeTodosHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeTodosTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  activeTodosCountBadge: {
    backgroundColor: '#D97706',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  activeTodosCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  activeAddTodoButton: {
    padding: 4,
  },
  activeEmptyTodos: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
    backgroundColor: AppColors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  activeEmptyTodosText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  activeTodosList: {
    gap: 12,
  },
  activeTodoItem: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: AppColors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeTodoItemCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#D1FAE5',
    opacity: 0.8,
  },
  activeTodoCheckbox: {
    paddingTop: 2,
  },
  activeCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D97706',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
  },
  activeCheckboxChecked: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  activeTodoContent: {
    flex: 1,
    gap: 8,
  },
  activeTodoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeTodoDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeTodoDateText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  activeTodoDelete: {
    padding: 4,
  },
  activeTodoText: {
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 20,
    fontWeight: '500',
  },
  activeTodoTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  activeActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  activeEditButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  activeEditButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  activeDeleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  activeDeleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});
