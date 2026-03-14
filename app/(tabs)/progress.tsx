import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FormField } from '@/components/ui/form-field';
import { SectionCard } from '@/components/ui/section-card';
import { Tag } from '@/components/ui/tag';
import { AppColors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedCattle } from '@/contexts/SelectedCattleContext';
import { useUserCollection } from '@/hooks/use-user-collection';
import { addUserDocument, deleteUserDocument } from '@/services/firestore';
import { CattleProfile, ProgressLog } from '@/types/models';

const activityOptions: ('normal' | 'moderate' | 'hard')[] = ['normal', 'moderate', 'hard'];

const initialForm = {
  cattleId: '',
  logDate: '',
  mealTake: false,
  water: '',
  activity: 'normal' as 'normal' | 'moderate' | 'hard',
};

const getWeekNumber = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `Week ${Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)}`;
};

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { selectedCattle: contextSelectedCattle } = useSelectedCattle();
  const { data: herd } = useUserCollection<CattleProfile>('cattle');
  const { data: logs, loading } = useUserCollection<ProgressLog>('progress', { orderByField: 'createdAt' });
  const [form, setForm] = useState(initialForm);

  // Filter logs by selected cattle
  const filteredLogs = useMemo(() => {
    if (!contextSelectedCattle) return [];
    return logs.filter((l) => l.cattleId === contextSelectedCattle.id);
  }, [logs, contextSelectedCattle]);

  // Auto-select cattle from context
  React.useEffect(() => {
    if (contextSelectedCattle) {
      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      setForm((prev) => ({
        ...prev,
        cattleId: contextSelectedCattle.id,
        logDate: prev.logDate || todayString, // Set today's date if not already set
      }));
    }
  }, [contextSelectedCattle]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Date picker state
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 20 }, (_, i) => currentYear - 5 + i); // Show 5 years back and 15 years forward
  const allMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const days = Array.from({ length: getDaysInMonth(selectedYear, selectedMonth) }, (_, i) => i + 1);

  React.useEffect(() => {
    const maxDays = getDaysInMonth(selectedYear, selectedMonth);
    if (selectedDay > maxDays) {
      setSelectedDay(maxDays);
    }
  }, [selectedYear, selectedMonth, selectedDay]);

  // Filter daily logs only from filtered logs
  const dailyLogs = useMemo(() => filteredLogs.filter((log) => log.periodType === 'daily'), [filteredLogs]);

  // Calculate water consumption stats
  const waterStats = useMemo(() => {
    if (dailyLogs.length === 0) {
      return {
        total: 0,
        average: 0,
        byCattle: [],
      };
    }

    const waterByCattle = new Map<string, { cattleName: string; total: number; count: number }>();
    let totalWater = 0;
    let waterCount = 0;

    dailyLogs.forEach((log) => {
      if (log.water !== undefined && log.water !== null) {
        totalWater += log.water;
        waterCount++;

        const existing = waterByCattle.get(log.cattleId) || {
          cattleName: log.cattleName,
          total: 0,
          count: 0,
        };
        existing.total += log.water;
        existing.count++;
        waterByCattle.set(log.cattleId, existing);
      }
    });

    return {
      total: totalWater,
      average: waterCount > 0 ? Number((totalWater / waterCount).toFixed(1)) : 0,
      byCattle: Array.from(waterByCattle.values()).map((entry) => ({
        cattleName: entry.cattleName,
        total: entry.total,
        average: Number((entry.total / entry.count).toFixed(1)),
        count: entry.count,
      })),
    };
  }, [dailyLogs]);

  // Calculate weekly and monthly stats from daily logs grouped by cattle and type
  const stats = useMemo(() => {
    if (dailyLogs.length === 0)
      return {
        byCattle: [],
        byType: {
          cow: { weekly: [], monthly: [] },
          horse: { weekly: [], monthly: [] },
        },
      };

    // Create a map of cattleId to type
    const cattleTypeMap = new Map<string, 'cow' | 'horse'>();
    herd.forEach((cattle) => {
      if (cattle.id) {
        cattleTypeMap.set(cattle.id, cattle.type);
      }
    });

    // Group by cattle name
    const byCattleMap = new Map<
      string,
      {
        cattleName: string;
        cattleType: 'cow' | 'horse' | 'unknown';
        weekly: Map<string, { nutrition: number[]; exercise: number[]; observations: Map<string, number[]> }>;
        monthly: Map<string, { nutrition: number[]; exercise: number[]; observations: Map<string, number[]> }>;
      }
    >();

    // Group by type (cow/horse)
    const byTypeData: {
      cow: Map<string, { nutrition: number[]; exercise: number[]; observations: Map<string, number[]> }>;
      horse: Map<string, { nutrition: number[]; exercise: number[]; observations: Map<string, number[]> }>;
    } = {
      cow: new Map(),
      horse: new Map(),
    };

    dailyLogs.forEach((log) => {
      if (!log.logDate || !log.observations) return;
      const date = new Date(log.logDate);
      const weekNum = getWeekNumber(date);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const cattleType = cattleTypeMap.get(log.cattleId) || 'unknown';
      const obsType = log.observations; // e.g., "Energy", "Health", etc.

      // Group by cattle
      let cattleEntry = byCattleMap.get(log.cattleId);
      if (!cattleEntry) {
        cattleEntry = {
          cattleName: log.cattleName,
          cattleType,
          weekly: new Map(),
          monthly: new Map(),
        };
        byCattleMap.set(log.cattleId, cattleEntry);
      }

      // Weekly aggregation by cattle
      let weekEntry = cattleEntry.weekly.get(weekNum);
      if (!weekEntry) {
        weekEntry = { nutrition: [], exercise: [], observations: new Map() };
        cattleEntry.weekly.set(weekNum, weekEntry);
      }
      weekEntry.nutrition.push(log.nutritionScore);
      weekEntry.exercise.push(log.exerciseMinutes);
      if (log.observationRating && obsType) {
        let obsEntry = weekEntry.observations.get(obsType);
        if (!obsEntry) {
          obsEntry = [];
          weekEntry.observations.set(obsType, obsEntry);
        }
        obsEntry.push(log.observationRating);
      }

      // Monthly aggregation by cattle
      let monthEntry = cattleEntry.monthly.get(monthKey);
      if (!monthEntry) {
        monthEntry = { nutrition: [], exercise: [], observations: new Map() };
        cattleEntry.monthly.set(monthKey, monthEntry);
      }
      monthEntry.nutrition.push(log.nutritionScore);
      monthEntry.exercise.push(log.exerciseMinutes);
      if (log.observationRating && obsType) {
        let obsEntry = monthEntry.observations.get(obsType);
        if (!obsEntry) {
          obsEntry = [];
          monthEntry.observations.set(obsType, obsEntry);
        }
        obsEntry.push(log.observationRating);
      }

      // Group by type (cow/horse)
      if (cattleType !== 'unknown') {
        // Weekly by type
        let typeWeekEntry = byTypeData[cattleType].get(weekNum);
        if (!typeWeekEntry) {
          typeWeekEntry = { nutrition: [], exercise: [], observations: new Map() };
          byTypeData[cattleType].set(weekNum, typeWeekEntry);
        }
        typeWeekEntry.nutrition.push(log.nutritionScore);
        typeWeekEntry.exercise.push(log.exerciseMinutes);
        if (log.observationRating && obsType) {
          let obsEntry = typeWeekEntry.observations.get(obsType);
          if (!obsEntry) {
            obsEntry = [];
            typeWeekEntry.observations.set(obsType, obsEntry);
          }
          obsEntry.push(log.observationRating);
        }

        // Monthly by type
        let typeMonthEntry = byTypeData[cattleType].get(monthKey);
        if (!typeMonthEntry) {
          typeMonthEntry = { nutrition: [], exercise: [], observations: new Map() };
          byTypeData[cattleType].set(monthKey, typeMonthEntry);
        }
        typeMonthEntry.nutrition.push(log.nutritionScore);
        typeMonthEntry.exercise.push(log.exerciseMinutes);
        if (log.observationRating && obsType) {
          let obsEntry = typeMonthEntry.observations.get(obsType);
          if (!obsEntry) {
            obsEntry = [];
            typeMonthEntry.observations.set(obsType, obsEntry);
          }
          obsEntry.push(log.observationRating);
        }
      }
    });

    // Convert to arrays
    const byCattle = Array.from(byCattleMap.values()).map((entry) => ({
      cattleName: entry.cattleName,
      cattleType: entry.cattleType,
      weekly: Array.from(entry.weekly.entries()).map(([week, data]) => ({
        week,
        nutrition: Math.round(data.nutrition.reduce((a, b) => a + b, 0) / data.nutrition.length) || 0,
        exercise: Math.round(data.exercise.reduce((a, b) => a + b, 0) / data.exercise.length) || 0,
        observations: Array.from(data.observations.entries()).map(([obsType, ratings]) => ({
          type: obsType,
          value: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 20), // Convert 1-5 to 0-100
        })),
      })),
      monthly: Array.from(entry.monthly.entries()).map(([monthKey, data]) => {
        const monthName = new Date(monthKey.split('-')[0] + '-' + monthKey.split('-')[1] + '-01').toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        });
        return {
          month: monthName,
          nutrition: Math.round(data.nutrition.reduce((a, b) => a + b, 0) / data.nutrition.length) || 0,
          exercise: Math.round(data.exercise.reduce((a, b) => a + b, 0) / data.exercise.length) || 0,
          observations: Array.from(data.observations.entries()).map(([obsType, ratings]) => ({
            type: obsType,
            value: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 20), // Convert 1-5 to 0-100
          })),
        };
      }),
    }));

    const byType = {
      cow: {
        weekly: Array.from(byTypeData.cow.entries())
          .filter(([period]) => period.startsWith('Week'))
          .map(([period, data]) => ({
            period,
            nutrition: Math.round(data.nutrition.reduce((a, b) => a + b, 0) / data.nutrition.length) || 0,
            exercise: Math.round(data.exercise.reduce((a, b) => a + b, 0) / data.exercise.length) || 0,
            observations: Array.from(data.observations.entries()).map(([obsType, ratings]) => ({
              type: obsType,
              value: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 20),
            })),
          })),
        monthly: Array.from(byTypeData.cow.entries())
          .filter(([period]) => !period.startsWith('Week'))
          .map(([monthKey, data]) => {
            const monthName = new Date(monthKey.split('-')[0] + '-' + monthKey.split('-')[1] + '-01').toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            });
            return {
              period: monthName,
              nutrition: Math.round(data.nutrition.reduce((a, b) => a + b, 0) / data.nutrition.length) || 0,
              exercise: Math.round(data.exercise.reduce((a, b) => a + b, 0) / data.exercise.length) || 0,
              observations: Array.from(data.observations.entries()).map(([obsType, ratings]) => ({
                type: obsType,
                value: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 20),
              })),
            };
          }),
      },
      horse: {
        weekly: Array.from(byTypeData.horse.entries())
          .filter(([period]) => period.startsWith('Week'))
          .map(([period, data]) => ({
            period,
            nutrition: Math.round(data.nutrition.reduce((a, b) => a + b, 0) / data.nutrition.length) || 0,
            exercise: Math.round(data.exercise.reduce((a, b) => a + b, 0) / data.exercise.length) || 0,
            observations: Array.from(data.observations.entries()).map(([obsType, ratings]) => ({
              type: obsType,
              value: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 20),
            })),
          })),
        monthly: Array.from(byTypeData.horse.entries())
          .filter(([period]) => !period.startsWith('Week'))
          .map(([monthKey, data]) => {
            const monthName = new Date(monthKey.split('-')[0] + '-' + monthKey.split('-')[1] + '-01').toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            });
            return {
              period: monthName,
              nutrition: Math.round(data.nutrition.reduce((a, b) => a + b, 0) / data.nutrition.length) || 0,
              exercise: Math.round(data.exercise.reduce((a, b) => a + b, 0) / data.exercise.length) || 0,
              observations: Array.from(data.observations.entries()).map(([obsType, ratings]) => ({
                type: obsType,
                value: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 20),
              })),
            };
          }),
      },
    };

    return { byCattle, byType };
  }, [dailyLogs, herd]);

  const handleChange = (field: keyof typeof initialForm, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const openDatePicker = () => {
    if (form.logDate) {
      try {
        const date = new Date(form.logDate);
        if (!isNaN(date.getTime())) {
          setSelectedYear(date.getFullYear());
          setSelectedMonth(date.getMonth());
          setSelectedDay(date.getDate());
        }
      } catch {
        // Use current date if parsing fails
      }
    }
    setShowDatePicker(true);
  };

  const handleDateConfirm = () => {
    const formattedDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    handleChange('logDate', formattedDate);
    setShowDatePicker(false);
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

  const handleSave = async () => {
    if (!user || !form.cattleId || !form.logDate) {
      setError('Select a cattle and date.');
      return;
    }
    setError('');
    setSaving(true);
    const cattleMeta = herd.find((cattle) => cattle.id === form.cattleId);
    try {
      await addUserDocument(user.uid, 'progress', {
        cattleId: form.cattleId,
        cattleName: cattleMeta?.name ?? 'Unnamed',
        periodType: 'daily',
        periodLabel: formatDisplayDate(form.logDate),
        logDate: form.logDate,
        nutritionScore: 0, // Deprecated, kept for backward compatibility
        mealCompliance: 0, // Deprecated, kept for backward compatibility
        exerciseMinutes: 0, // Deprecated, kept for backward compatibility
        observations: '', // Deprecated, kept for backward compatibility
        observationRating: undefined, // Deprecated, kept for backward compatibility
        mealTake: form.mealTake,
        water: form.water ? Number(form.water) : undefined,
        activity: form.activity,
      });
      // Reset form but keep cattleId and set today's date for next entry
      const today = new Date();
      const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      setForm({
        ...initialForm,
        cattleId: form.cattleId, // Keep the selected cattle
        logDate: todayString, // Set to today's date
        mealTake: false,
        water: '',
        activity: 'normal',
      });
      Alert.alert('Success', 'Daily log saved!');
    } catch (err) {
      console.error(err);
      setError('Unable to save log. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (logId: string, cattleName: string) => {
    if (!user) return;

    Alert.alert('Delete Log', `Are you sure you want to delete the log for ${cattleName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(logId);
          try {
            await deleteUserDocument(user.uid, 'progress', logId);
          } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to delete. Please try again.');
          } finally {
            setDeleting(null);
          }
        },
      },
    ]);
  };


  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {!contextSelectedCattle ? (
          <View style={styles.emptyState}>
            <Ionicons name="person-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Profile Selected</Text>
            <Text style={styles.emptySubtitle}>Please select a cattle profile from the home tab to log progress</Text>
          </View>
        ) : (
          <>
            <SectionCard title="Daily Progress Log">
              <Text style={styles.helper}>Save daily logs for nutrition, meal compliance, and activity tracking.</Text>

              <View style={styles.labelContainer}>
                <Text style={styles.label}>Selected Cattle</Text>
                <View style={styles.selectedCattleCard}>
                  <View style={styles.selectedCattleInfo}>
                    <Ionicons name={contextSelectedCattle.type === 'cow' ? 'logo-octocat' : 'git-branch-outline'} size={24} color={contextSelectedCattle.type === 'cow' ? '#0a7ea4' : '#D97706'} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.selectedCattleName}>{contextSelectedCattle.name}</Text>
                      <Text style={styles.selectedCattleMeta}>
                        {contextSelectedCattle.type === 'cow' ? 'Cow' : 'Horse'} • {contextSelectedCattle.weightValue || '—'} {contextSelectedCattle.weightUnit || 'kg'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.labelContainer}>
                <Text style={styles.label}>Date</Text>
                <Pressable style={styles.datePickerButton} onPress={openDatePicker}>
                  <Text style={[styles.datePickerText, !form.logDate && styles.datePickerPlaceholder]}>
                    {form.logDate ? formatDisplayDate(form.logDate) : 'Select date'}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color="#64748B" />
                </Pressable>
              </View>

              {/* Meal Take */}
              <View style={styles.labelContainer}>
                <Text style={styles.label}>Meal Take</Text>
                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>Meal taken today</Text>
                  <Switch
                    value={Boolean(form.mealTake)}
                    onValueChange={(value) => handleChange('mealTake', value)}
                    trackColor={{ false: '#CBD5E1', true: '#0a7ea4' }}
                    thumbColor={form.mealTake ? '#fff' : '#f4f3f4'}
                  />
                </View>
              </View>

              {/* Water Intake */}
              <View style={styles.labelContainer}>
                <Text style={styles.label}>Water Intake (Liters)</Text>
                <View style={styles.rangeContainer}>
                  <FormField
                    label=""
                    placeholder="20"
                    keyboardType="numeric"
                    value={form.water}
                    onChangeText={(text) => handleChange('water', text)}
                    style={{ flex: 1 }}
                  />
                  <Text style={styles.rangeLabel}>L</Text>
                </View>
                <Text style={styles.helperText}>Daily water consumption in liters</Text>
              </View>

              {/* Activity Level */}
              <View style={styles.labelContainer}>
                <Text style={styles.label}>Activity Level</Text>
                <View style={styles.toggleRow}>
                  {activityOptions.map((option) => (
                    <Pressable
                      key={option}
                      style={[styles.optionChip, form.activity === option && styles.optionChipActive]}
                      onPress={() => handleChange('activity', option)}
                    >
                      <Text style={[styles.chipText, form.activity === option && styles.chipTextActive]}>
                        {option}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable style={[styles.primaryButton, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save Daily Log'}</Text>
              </Pressable>
            </SectionCard>

            <SectionCard title="Water Consumption Statistics">
              {waterStats.byCattle.length === 0 ? (
                <View style={styles.emptyStatsState}>
                  <Ionicons name="water-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyStatsText}>No water data yet</Text>
                  <Text style={styles.emptyStatsSubtext}>Add daily logs with water intake to see statistics</Text>
                </View>
              ) : (
                <>
                  <View style={styles.waterSummaryContainer}>
                    <View style={styles.waterSummaryCard}>
                      <Ionicons name="water-outline" size={24} color="#3B82F6" />
                      <View style={styles.waterSummaryContent}>
                        <Text style={styles.waterSummaryLabel}>Total Water</Text>
                        <Text style={styles.waterSummaryValue}>{waterStats.total.toFixed(1)} L</Text>
                      </View>
                    </View>
                    <View style={styles.waterSummaryCard}>
                      <Ionicons name="stats-chart-outline" size={24} color="#3B82F6" />
                      <View style={styles.waterSummaryContent}>
                        <Text style={styles.waterSummaryLabel}>Average Daily</Text>
                        <Text style={styles.waterSummaryValue}>{waterStats.average} L</Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.waterSectionTitle}>By Cattle</Text>
                  {waterStats.byCattle.map((cattleWater, idx) => (
                    <View key={idx} style={styles.waterCattleCard}>
                      <View style={styles.waterCattleHeader}>
                        <Text style={styles.waterCattleName}>{cattleWater.cattleName}</Text>
                        <View style={styles.waterCattleBadge}>
                          <Text style={styles.waterCattleBadgeText}>{cattleWater.count} entries</Text>
                        </View>
                      </View>
                      <View style={styles.waterCattleStats}>
                        <View style={styles.waterStatItem}>
                          <Text style={styles.waterStatLabel}>Total</Text>
                          <Text style={styles.waterStatValue}>{cattleWater.total.toFixed(1)} L</Text>
                        </View>
                        <View style={styles.waterStatItem}>
                          <Text style={styles.waterStatLabel}>Average</Text>
                          <Text style={styles.waterStatValue}>{cattleWater.average} L/day</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </SectionCard>

            <SectionCard title="Daily Logs">
              {loading ? (
                <ActivityIndicator />
              ) : dailyLogs.length === 0 ? (
                <View style={styles.emptyLogsState}>
                  <Ionicons name="document-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyLogsText}>No daily logs yet</Text>
                  <Text style={styles.emptyLogsSubtext}>Create your first log above</Text>
                </View>
              ) : (
                dailyLogs.map((log) => (
                  <View key={log.id} style={styles.logCard}>
                    <View style={styles.logHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.logTitle}>{log.cattleName}</Text>
                        <Text style={styles.logSubtitle}>{log.periodLabel || formatDisplayDate(log.logDate || '')}</Text>
                      </View>
                      <Pressable
                        style={styles.deleteButton}
                        onPress={() => log.id && handleDelete(log.id, log.cattleName)}
                        disabled={deleting === log.id}
                      >
                        {deleting === log.id ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        )}
                      </Pressable>
                    </View>
                    {/* Parameters */}
                    <View style={styles.parametersRow}>
                      {log.mealTake !== undefined && (
                        <View style={styles.parameterBadge}>
                          <Ionicons name={log.mealTake ? "checkmark-circle" : "close-circle"} size={16} color={log.mealTake ? "#10B981" : "#EF4444"} />
                          <Text style={styles.parameterText}>Meal: {log.mealTake ? 'Taken' : 'Not Taken'}</Text>
                        </View>
                      )}
                      {log.water !== undefined && (
                        <View style={styles.parameterBadge}>
                          <Ionicons name="water-outline" size={16} color="#3B82F6" />
                          <Text style={styles.parameterText}>Water: {log.water}L</Text>
                        </View>
                      )}
                      {log.activity && (
                        <View style={styles.parameterBadge}>
                          <Ionicons name="flash-outline" size={16} color="#F59E0B" />
                          <Text style={styles.parameterText}>Activity: {log.activity}</Text>
                        </View>
                      )}
                    </View>

                  </View>
                ))
              )}
            </SectionCard>
          </>
        )}
      </ScrollView>

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

const BarChart = ({ data, max }: { data: { label: string; value: number; color: string }[]; max: number }) => {
  return (
    <View style={styles.barChartContainer}>
      {data.map((item, idx) => {
        const width = Math.min((item.value / max) * 100, 100);
        return (
          <View key={idx} style={styles.barChartRow}>
            <Text style={styles.barChartLabel}>{item.label}</Text>
            <View style={styles.barChartBarContainer}>
              <View style={[styles.barChartBar, { width: `${width}%`, backgroundColor: item.color }]} />
              <Text style={styles.barChartValue}>{item.value}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metric}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={styles.metricValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  container: {
    padding: 16,
    paddingTop: 8,
  },
  helper: {
    color: '#475569',
    fontSize: 14,
    marginBottom: 12,
  },
  labelContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#0F172A',
  },
  scroller: {
    marginVertical: 8,
  },
  cattleChip: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 10,
    backgroundColor: AppColors.surface,
  },
  cattleChipActive: {
    backgroundColor: '#E2E8F0',
  },
  cattleChipText: {
    color: '#0F172A',
    fontWeight: '600',
  },
  cattleChipTextActive: {
    color: '#0a7ea4',
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
    color: '#111',
    flex: 1,
  },
  datePickerPlaceholder: {
    color: '#9AA0A6',
  },
  dropdownButton: {
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
  dropdownText: {
    fontSize: 15,
    color: '#111',
    flex: 1,
  },
  dropdownPlaceholder: {
    color: '#9AA0A6',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  error: {
    color: '#DC2626',
    marginTop: 6,
  },
  cattleStatContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: AppColors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cattleStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cattleStatName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  periodSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  typeStatsContainer: {
    gap: 20,
  },
  typeSection: {
    marginBottom: 16,
  },
  typeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  chartContainer: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  barChartContainer: {
    gap: 12,
  },
  barChartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  barChartLabel: {
    fontSize: 13,
    color: '#475569',
    width: 80,
  },
  barChartBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barChartBar: {
    height: 24,
    borderRadius: 6,
    minWidth: 4,
  },
  barChartValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    minWidth: 40,
  },
  logCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: AppColors.surface,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  logSubtitle: {
    color: '#475569',
    fontSize: 13,
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  metric: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#F8FAFE',
  },
  metricLabel: {
    fontSize: 12,
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  observationRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  logObservation: {
    color: '#0F172A',
    fontSize: 14,
    marginBottom: 4,
  },
  ratingBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  ratingBadgeText: {
    color: '#0a7ea4',
    fontSize: 12,
    fontWeight: '600',
  },
  ratingContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: AppColors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ratingLabel: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 8,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ratingButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: AppColors.surface,
    alignItems: 'center',
  },
  ratingButtonActive: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  ratingTextActive: {
    color: '#fff',
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
    padding: 20,
    width: '100%',
    maxWidth: 300,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  optionItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  optionText: {
    fontSize: 16,
    color: '#0F172A',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  selectedCattleCard: {
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E0F2FE',
    marginTop: 8,
  },
  selectedCattleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedCattleName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  selectedCattleMeta: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyStatsState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStatsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 12,
  },
  emptyStatsSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  emptyLogsState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyLogsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 12,
  },
  emptyLogsSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  // New Parameter Styles
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: '#D0D7DE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  switchLabel: {
    fontSize: 15,
    color: '#111',
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: AppColors.surface,
    minWidth: 100,
  },
  optionChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4338CA',
  },
  chipText: {
    color: '#4338CA',
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  chipTextActive: {
    fontWeight: '700',
    color: '#312E81',
  },
  rangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rangeLabel: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
  },
  parametersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  parameterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: AppColors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  parameterText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  // Water Statistics Styles
  waterSummaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  waterSummaryCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  waterSummaryContent: {
    flex: 1,
  },
  waterSummaryLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  waterSummaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E40AF',
  },
  waterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginTop: 8,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  waterCattleCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  waterCattleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  waterCattleName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  waterCattleBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  waterCattleBadgeText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '600',
  },
  waterCattleStats: {
    flexDirection: 'row',
    gap: 16,
  },
  waterStatItem: {
    flex: 1,
  },
  waterStatLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  waterStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
});
