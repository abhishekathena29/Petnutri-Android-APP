import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { SectionCard } from '@/components/ui/section-card';
import { Tag } from '@/components/ui/tag';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCollection } from '@/hooks/use-user-collection';
import { addUserDocument, deleteUserDocument, updateUserDocument } from '@/services/firestore';
import { CattleProfile, PregnancyPlan } from '@/types/models';

const trimesters: PregnancyPlan['trimester'][] = ['early', 'mid', 'late'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

const initialForm = {
  cattleId: '',
  dueDate: '',
  trimester: 'early' as PregnancyPlan['trimester'],
  blockedMonths: [] as string[],
};

const initialTodoForm = {
  calendarDate: '',
  todo: '',
};

export default function PregnancyScreen() {
  const { user } = useAuth();
  const { data: herd } = useUserCollection<CattleProfile>('cattle');
  const { data: plans, loading } = useUserCollection<PregnancyPlan>('pregnancy', { orderByField: 'createdAt' });
  const [form, setForm] = useState(initialForm);
  const [todoForm, setTodoForm] = useState(initialTodoForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingTodo, setDeletingTodo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTodoDatePicker, setShowTodoDatePicker] = useState(false);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [selectedCattleId, setSelectedCattleId] = useState<string | null>(null);
  const [datePickerType, setDatePickerType] = useState<'delivery' | 'todo'>('delivery');

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
    const byCattle = new Map<string, PregnancyPlan[]>();
    plans.forEach((plan) => {
      const key = plan.cattleId || plan.cattleName.toLowerCase();
      const arr = byCattle.get(key) ?? [];
      arr.push(plan);
      byCattle.set(key, arr);
    });
    return Array.from(byCattle.entries()).map(([key, entries]) => {
      return {
        cattleId: key,
        cattleName: entries[0]?.cattleName ?? 'Unnamed',
        entries,
      };
    });
  }, [plans]);

  const handleChange = (field: keyof typeof initialForm, value: string | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleTodoChange = (field: keyof typeof initialTodoForm, value: string) => {
    setTodoForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleMonth = (month: string) => {
    setForm((prev) => {
      const currentMonths = prev.blockedMonths;
      if (currentMonths.includes(month)) {
        return { ...prev, blockedMonths: currentMonths.filter((m) => m !== month) };
      } else {
        // Only allow selecting months in order (range)
        if (currentMonths.length === 0) {
          return { ...prev, blockedMonths: [month] };
        }
        const monthIndex = months.indexOf(month);
        const firstIndex = months.indexOf(currentMonths[0]);
        const lastIndex = months.indexOf(currentMonths[currentMonths.length - 1]);

        // If clicking before first, add to beginning
        if (monthIndex < firstIndex) {
          const newMonths = [];
          for (let i = monthIndex; i <= lastIndex; i++) {
            newMonths.push(months[i]);
          }
          return { ...prev, blockedMonths: newMonths };
        }
        // If clicking after last, add to end
        else if (monthIndex > lastIndex) {
          const newMonths = [...currentMonths];
          for (let i = lastIndex + 1; i <= monthIndex; i++) {
            newMonths.push(months[i]);
          }
          return { ...prev, blockedMonths: newMonths };
        }
        // If clicking in the middle, remove from that point to end
        else {
          return { ...prev, blockedMonths: currentMonths.slice(0, currentMonths.indexOf(month) + 1) };
        }
      }
    });
  };

  const openDatePicker = (type: 'delivery' | 'todo') => {
    setDatePickerType(type);
    let dateToParse = '';
    if (type === 'delivery') {
      dateToParse = form.dueDate;
    } else {
      dateToParse = todoForm.calendarDate;
    }

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

    if (type === 'delivery') {
      setShowDatePicker(true);
    } else {
      setShowTodoDatePicker(true);
    }
  };

  const handleDateConfirm = () => {
    const formattedDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    if (datePickerType === 'delivery') {
      handleChange('dueDate', formattedDate);
      setShowDatePicker(false);
    } else {
      handleTodoChange('calendarDate', formattedDate);
      setShowTodoDatePicker(false);
    }
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

  const handleSave = async () => {
    if (!user || !form.cattleId) {
      setError('Please select a cattle.');
      return;
    }
    if (!form.dueDate) {
      setError('Please select delivery date.');
      return;
    }
    if (form.blockedMonths.length === 0) {
      setError('Please select at least one month to block.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const cattleMeta = herd.find((item) => item.id === form.cattleId);
      await addUserDocument(user.uid, 'pregnancy', {
        cattleId: form.cattleId,
        cattleName: cattleMeta?.name ?? 'Unnamed',
        dueDate: form.dueDate,
        trimester: form.trimester,
        blockedMonth: form.blockedMonths.join(','),
        todo: '',
        nutritionFocus: '',
        calendarDate: '',
      });
      setForm(initialForm);
    } catch (err) {
      console.error(err);
      setError('Unable to save. Try again.');
    } finally {
      setSaving(false);
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

    Alert.alert('Delete Cattle', `Are you sure you want to delete all pregnancy records for ${cattleName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(cattleId);
          try {
            const cattleEntries = groupedPlans.find((g) => g.cattleId === cattleId);
            if (cattleEntries) {
              const deletePromises = cattleEntries.entries
                .filter((e) => e.id)
                .map((e) => deleteUserDocument(user.uid, 'pregnancy', e.id!));
              await Promise.all(deletePromises);
            }
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

  const openTodoModal = (cattleId: string) => {
    setSelectedCattleId(cattleId);
    setShowTodoModal(true);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <SectionCard title="Add Pregnant Cattle">
          <Text style={styles.helper}>Select cattle, trimester, blocked months, and delivery date.</Text>

          <View style={styles.labelContainer}>
            <Text style={styles.label}>Cattle Name</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cattleScroller}>
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
            <Text style={styles.label}>Trimester</Text>
            <View style={styles.toggleRow}>
              {trimesters.map((trimester) => (
                <Pressable
                  key={trimester}
                  style={[styles.triChip, form.trimester === trimester && styles.triChipActive]}
                  onPress={() => handleChange('trimester', trimester)}
                >
                  <Text style={[styles.triChipText, form.trimester === trimester && styles.triChipTextActive]}>
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
                const isSelected = form.blockedMonths.includes(month);
                const monthIndex = months.indexOf(month);
                const firstIndex = form.blockedMonths.length > 0 ? months.indexOf(form.blockedMonths[0]) : -1;
                const lastIndex =
                  form.blockedMonths.length > 0 ? months.indexOf(form.blockedMonths[form.blockedMonths.length - 1]) : -1;
                const isInRange = monthIndex >= firstIndex && monthIndex <= lastIndex && firstIndex !== -1;

                return (
                  <Pressable key={month} style={[styles.monthChip, isInRange && styles.monthChipActive]} onPress={() => toggleMonth(month)}>
                    <Text style={[styles.monthChipText, isInRange && styles.monthChipTextActive]}>{month}</Text>
                  </Pressable>
                );
              })}
            </View>
            {form.blockedMonths.length > 0 && (
              <Text style={styles.selectedMonthsText}>Selected: {formatBlockedMonths(form.blockedMonths.join(','))}</Text>
            )}
          </View>

          <View style={styles.labelContainer}>
            <Text style={styles.label}>Delivery Date</Text>
            <Pressable style={styles.datePickerButton} onPress={() => openDatePicker('delivery')}>
              <Text style={[styles.datePickerText, !form.dueDate && styles.datePickerPlaceholder]}>
                {form.dueDate ? formatDisplayDate(form.dueDate) : 'Select delivery date'}
              </Text>
              <Ionicons name="calendar-outline" size={20} color="#64748B" />
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={[styles.primaryButton, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Add to board'}</Text>
          </Pressable>
        </SectionCard>

        <SectionCard title="Pregnancy Board">
          {loading ? (
            <ActivityIndicator />
          ) : groupedPlans.length === 0 ? (
            <Text style={styles.helper}>No pregnancy plans stored yet.</Text>
          ) : (
            groupedPlans.map((group) => (
              <View key={group.cattleId} style={styles.board}>
                <View style={styles.groupHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.groupTitle}>{group.cattleName}</Text>
                    <Text style={styles.groupSubtitle}>
                      Due: {group.entries[0]?.dueDate ? formatDisplayDate(group.entries[0].dueDate) : '—'}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleDeleteCattle(group.cattleId, group.cattleName)}
                    disabled={deleting === group.cattleId}
                  >
                    {deleting === group.cattleId ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    )}
                  </Pressable>
                </View>

                <View style={styles.cardInfo}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Trimester:</Text>
                    <Tag label={group.entries[0]?.trimester || 'early'} tone="warning" />
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Blocked Months:</Text>
                    <Text style={styles.infoValue}>
                      {group.entries[0]?.blockedMonth ? formatBlockedMonths(group.entries[0].blockedMonth) : '—'}
                    </Text>
                  </View>
                </View>

                <View style={styles.todosSection}>
                  <View style={styles.todosHeader}>
                    <Text style={styles.todosTitle}>To-Do List</Text>
                    <Pressable style={styles.addTodoButton} onPress={() => openTodoModal(group.cattleId)}>
                      <Ionicons name="add-circle" size={20} color="#D97706" />
                      <Text style={styles.addTodoText}>Add Todo</Text>
                    </Pressable>
                  </View>

                  {group.entries
                    .filter((e) => e.todo && e.calendarDate)
                    .map((entry, idx) => {
                      const isCompleted = entry.completed || false;
                      return (
                        <View key={entry.id || idx} style={[styles.todoCard, isCompleted && styles.todoCardCompleted]}>
                          <View style={styles.todoContent}>
                            <Pressable
                              style={styles.checkboxContainer}
                              onPress={() => entry.id && handleToggleTodo(entry.id, isCompleted)}
                            >
                              <View style={[styles.checkbox, isCompleted && styles.checkboxChecked]}>
                                {isCompleted && <Ionicons name="checkmark" size={16} color="#fff" />}
                              </View>
                            </Pressable>
                            <View style={styles.todoTextContainer}>
                              <View style={styles.todoHeader}>
                                <Text style={styles.todoDate}>{formatDisplayDate(entry.calendarDate || '')}</Text>
                                <Pressable
                                  style={styles.todoDeleteButton}
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
                              <Text style={[styles.todoText, isCompleted && styles.todoTextCompleted]}>{entry.todo}</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}

                  {group.entries.filter((e) => e.todo && e.calendarDate).length === 0 && (
                    <Text style={styles.noTodos}>No todos yet. Click "Add Todo" to add one.</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </SectionCard>
      </ScrollView>

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

            <Pressable style={styles.dateConfirmButton} onPress={handleDateConfirm}>
              <Text style={styles.dateConfirmText}>Confirm</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Todo Date Picker Modal */}
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

      {/* Add Todo Modal */}
      <Modal visible={showTodoModal} transparent animationType="slide" onRequestClose={() => setShowTodoModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowTodoModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add To-Do</Text>
              <Pressable onPress={() => setShowTodoModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            <View style={styles.labelContainer}>
              <Text style={styles.label}>Calendar Date</Text>
              <Pressable style={styles.datePickerButton} onPress={() => openDatePicker('todo')}>
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
                value={todoForm.todo}
                onChangeText={(text) => handleTodoChange('todo', text)}
                multiline
                numberOfLines={4}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable style={[styles.primaryButton, saving && { opacity: 0.6 }]} onPress={handleAddTodo} disabled={saving}>
              <Text style={styles.primaryText}>{saving ? 'Adding…' : 'Add Todo'}</Text>
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
    backgroundColor: '#fff',
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
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
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
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
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
    color: '#0F172A',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D0D7DE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#fff',
  },
  todoInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
