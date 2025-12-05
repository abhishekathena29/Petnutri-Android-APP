import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormField } from '@/components/ui/form-field';
import { SectionCard } from '@/components/ui/section-card';
import { Tag } from '@/components/ui/tag';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCollection } from '@/hooks/use-user-collection';
import { addUserDocument, deleteUserDocument } from '@/services/firestore';
import { CattleProfile, ProgressLog } from '@/types/models';

const observationOptions = ['Energy', 'Health', 'Appetite', 'Coat', 'Behavior', 'Weight', 'Mobility'];

const initialForm = {
  cattleId: '',
  logDate: '',
  nutritionScore: '',
  mealCompliance: '',
  exerciseMinutes: '',
  observations: '',
  observationRating: 0,
};

const getWeekNumber = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `Week ${Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)}`;
};

export default function ProgressScreen() {
  const { user } = useAuth();
  const { data: herd } = useUserCollection<CattleProfile>('cattle');
  const { data: logs, loading } = useUserCollection<ProgressLog>('progress', { orderByField: 'createdAt' });
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showObservationDropdown, setShowObservationDropdown] = useState(false);

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

  // Filter daily logs only
  const dailyLogs = useMemo(() => logs.filter((log) => log.periodType === 'daily'), [logs]);

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

  const handleChange = (field: keyof typeof initialForm, value: string | number) => {
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
        nutritionScore: Number(form.nutritionScore) || 0,
        mealCompliance: Number(form.mealCompliance) || 0,
        exerciseMinutes: Number(form.exerciseMinutes) || 0,
        observations: form.observations,
        observationRating: form.observationRating || undefined,
      });
      setForm({
        ...initialForm,
        observationRating: 0,
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

  const selectObservation = (obs: string) => {
    handleChange('observations', obs);
    handleChange('observationRating', 0); // Reset rating when new observation is selected
    setShowObservationDropdown(false);
  };

  const selectRating = (rating: number) => {
    handleChange('observationRating', rating);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <SectionCard title="Daily Progress Log">
          <Text style={styles.helper}>Save daily logs for nutrition, meal compliance, and exercise tracking.</Text>

          <View style={styles.labelContainer}>
            <Text style={styles.label}>Cattle Name</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroller}>
              {herd.length === 0 ? (
                <Text style={styles.helper}>Create cattle first.</Text>
              ) : (
                herd.map((cattle) => (
                  <Pressable
                    key={cattle.id}
                    style={[styles.cattleChip, form.cattleId === cattle.id && styles.cattleChipActive]}
                    onPress={() => handleChange('cattleId', cattle.id!)}
                  >
                    <Text style={[styles.cattleChipText, form.cattleId === cattle.id && styles.cattleChipTextActive]}>
                      {cattle.name}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
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

          <View style={styles.row}>
            <FormField
              label="Nutrition Score"
              placeholder="80"
              keyboardType="numeric"
              value={form.nutritionScore}
              onChangeText={(text) => handleChange('nutritionScore', text)}
              style={{ flex: 1 }}
            />
            <View style={{ width: 12 }} />
            <FormField
              label="Meal Compliance %"
              placeholder="90"
              keyboardType="numeric"
              value={form.mealCompliance}
              onChangeText={(text) => handleChange('mealCompliance', text)}
              style={{ flex: 1 }}
            />
          </View>
          <FormField
            label="Exercise Minutes"
            placeholder="120"
            keyboardType="numeric"
            value={form.exerciseMinutes}
            onChangeText={(text) => handleChange('exerciseMinutes', text)}
          />

          <View style={styles.labelContainer}>
            <Text style={styles.label}>Observations</Text>
            <Pressable style={styles.dropdownButton} onPress={() => setShowObservationDropdown(true)}>
              <Text style={[styles.dropdownText, !form.observations && styles.dropdownPlaceholder]}>
                {form.observations || 'Select observation type'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#64748B" />
            </Pressable>
            {form.observations && (
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingLabel}>Rate {form.observations} (1-5):</Text>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <Pressable
                      key={rating}
                      style={[styles.ratingButton, form.observationRating === rating && styles.ratingButtonActive]}
                      onPress={() => selectRating(rating)}
                    >
                      <Text style={[styles.ratingText, form.observationRating === rating && styles.ratingTextActive]}>
                        {rating}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.primaryButton, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save Daily Log'}</Text>
          </Pressable>
        </SectionCard>

        <SectionCard title="Stats by Cattle Name">
          {stats.byCattle.length === 0 ? (
            <Text style={styles.helper}>No data yet. Add daily logs to see stats.</Text>
          ) : (
            stats.byCattle.map((cattleStat, idx) => (
              <View key={idx} style={styles.cattleStatContainer}>
                <View style={styles.cattleStatHeader}>
                  <Text style={styles.cattleStatName}>{cattleStat.cattleName}</Text>
                  <Tag label={cattleStat.cattleType === 'cow' ? '🐄 Cow' : cattleStat.cattleType === 'horse' ? '🐴 Horse' : 'Unknown'} tone="primary" />
                </View>

                <Text style={styles.periodSectionTitle}>Weekly</Text>
                {cattleStat.weekly.length === 0 ? (
                  <Text style={styles.helper}>No weekly data</Text>
                ) : (
                  cattleStat.weekly.map((stat, weekIdx) => (
                    <View key={weekIdx} style={styles.chartContainer}>
                      <Text style={styles.chartTitle}>{stat.week}</Text>
                      <BarChart data={[{ label: 'Nutrition', value: stat.nutrition, color: '#0a7ea4' }]} max={100} />
                      <BarChart data={[{ label: 'Exercise', value: stat.exercise, color: '#f97316' }]} max={200} />
                      {stat.observations.map((obs) => (
                        <BarChart key={obs.type} data={[{ label: obs.type, value: obs.value, color: '#22c55e' }]} max={100} />
                      ))}
                    </View>
                  ))
                )}

                <Text style={styles.periodSectionTitle}>Monthly</Text>
                {cattleStat.monthly.length === 0 ? (
                  <Text style={styles.helper}>No monthly data</Text>
                ) : (
                  cattleStat.monthly.map((stat, monthIdx) => (
                    <View key={monthIdx} style={styles.chartContainer}>
                      <Text style={styles.chartTitle}>{stat.month}</Text>
                      <BarChart data={[{ label: 'Nutrition', value: stat.nutrition, color: '#0a7ea4' }]} max={100} />
                      <BarChart data={[{ label: 'Exercise', value: stat.exercise, color: '#f97316' }]} max={200} />
                      {stat.observations.map((obs) => (
                        <BarChart key={obs.type} data={[{ label: obs.type, value: obs.value, color: '#22c55e' }]} max={100} />
                      ))}
                    </View>
                  ))
                )}
              </View>
            ))
          )}
        </SectionCard>

        <SectionCard title="Stats by Type (Cow vs Horse)">
          <View style={styles.typeStatsContainer}>
            <View style={styles.typeSection}>
              <Text style={styles.typeTitle}>🐄 Cows</Text>
              <Text style={styles.periodSectionTitle}>Weekly</Text>
              {stats.byType.cow.weekly.length === 0 ? (
                <Text style={styles.helper}>No weekly cow data yet</Text>
              ) : (
                stats.byType.cow.weekly.map((stat, idx) => (
                  <View key={idx} style={styles.chartContainer}>
                    <Text style={styles.chartTitle}>{stat.period}</Text>
                    <BarChart data={[{ label: 'Nutrition', value: stat.nutrition, color: '#0a7ea4' }]} max={100} />
                    <BarChart data={[{ label: 'Exercise', value: stat.exercise, color: '#f97316' }]} max={200} />
                    {stat.observations.map((obs) => (
                      <BarChart key={obs.type} data={[{ label: obs.type, value: obs.value, color: '#22c55e' }]} max={100} />
                    ))}
                  </View>
                ))
              )}
              <Text style={styles.periodSectionTitle}>Monthly</Text>
              {stats.byType.cow.monthly.length === 0 ? (
                <Text style={styles.helper}>No monthly cow data yet</Text>
              ) : (
                stats.byType.cow.monthly.map((stat, idx) => (
                  <View key={idx} style={styles.chartContainer}>
                    <Text style={styles.chartTitle}>{stat.period}</Text>
                    <BarChart data={[{ label: 'Nutrition', value: stat.nutrition, color: '#0a7ea4' }]} max={100} />
                    <BarChart data={[{ label: 'Exercise', value: stat.exercise, color: '#f97316' }]} max={200} />
                    {stat.observations.map((obs) => (
                      <BarChart key={obs.type} data={[{ label: obs.type, value: obs.value, color: '#22c55e' }]} max={100} />
                    ))}
                  </View>
                ))
              )}
            </View>

            <View style={styles.typeSection}>
              <Text style={styles.typeTitle}>🐴 Horses</Text>
              <Text style={styles.periodSectionTitle}>Weekly</Text>
              {stats.byType.horse.weekly.length === 0 ? (
                <Text style={styles.helper}>No weekly horse data yet</Text>
              ) : (
                stats.byType.horse.weekly.map((stat, idx) => (
                  <View key={idx} style={styles.chartContainer}>
                    <Text style={styles.chartTitle}>{stat.period}</Text>
                    <BarChart data={[{ label: 'Nutrition', value: stat.nutrition, color: '#0a7ea4' }]} max={100} />
                    <BarChart data={[{ label: 'Exercise', value: stat.exercise, color: '#f97316' }]} max={200} />
                    {stat.observations.map((obs) => (
                      <BarChart key={obs.type} data={[{ label: obs.type, value: obs.value, color: '#22c55e' }]} max={100} />
                    ))}
                  </View>
                ))
              )}
              <Text style={styles.periodSectionTitle}>Monthly</Text>
              {stats.byType.horse.monthly.length === 0 ? (
                <Text style={styles.helper}>No monthly horse data yet</Text>
              ) : (
                stats.byType.horse.monthly.map((stat, idx) => (
                  <View key={idx} style={styles.chartContainer}>
                    <Text style={styles.chartTitle}>{stat.period}</Text>
                    <BarChart data={[{ label: 'Nutrition', value: stat.nutrition, color: '#0a7ea4' }]} max={100} />
                    <BarChart data={[{ label: 'Exercise', value: stat.exercise, color: '#f97316' }]} max={200} />
                    {stat.observations.map((obs) => (
                      <BarChart key={obs.type} data={[{ label: obs.type, value: obs.value, color: '#22c55e' }]} max={100} />
                    ))}
                  </View>
                ))
              )}
            </View>
          </View>
        </SectionCard>

        <SectionCard title="Daily Logs">
          {loading ? (
            <ActivityIndicator />
          ) : dailyLogs.length === 0 ? (
            <Text style={styles.helper}>No daily logs yet.</Text>
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
                <View style={styles.metricsRow}>
                  <Metric label="Nutrition" value={`${log.nutritionScore}%`} />
                  <Metric label="Meal" value={`${log.mealCompliance}%`} />
                  <Metric label="Exercise" value={`${log.exerciseMinutes} min`} />
                </View>
                {log.observations && (
                  <View style={styles.observationRow}>
                    <Text style={styles.logObservation}>{log.observations}</Text>
                    {log.observationRating && (
                      <View style={styles.ratingBadge}>
                        <Text style={styles.ratingBadgeText}>Rating: {log.observationRating}/5</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))
          )}
        </SectionCard>
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

      {/* Observation Dropdown Modal */}
      <Modal visible={showObservationDropdown} transparent animationType="fade" onRequestClose={() => setShowObservationDropdown(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowObservationDropdown(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Observation</Text>
              <Pressable onPress={() => setShowObservationDropdown(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>
            <ScrollView>
              {observationOptions.map((option) => (
                <Pressable key={option} style={styles.optionItem} onPress={() => selectObservation(option)}>
                  <Text style={styles.optionText}>{option}</Text>
                </Pressable>
              ))}
            </ScrollView>
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
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#fff',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
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
});
