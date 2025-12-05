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
import { SectionCard } from '@/components/ui/section-card';
import { Tag } from '@/components/ui/tag';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCollection } from '@/hooks/use-user-collection';
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

export default function HerdHomeScreen() {
  const { user } = useAuth();
  const { data: cattle, loading } = useUserCollection<CattleProfile>('cattle', { orderByField: 'createdAt' });
  const [form, setForm] = useState<typeof defaultForm>(defaultForm);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<(CattleProfile & { id: string }) | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const grouped = useMemo(() => {
    const base: Record<CattleCategory, Array<CattleProfile & { id: string }>> = {
      cow: [],
      horse: [],
    };
    cattle.forEach((doc) => {
      base[doc.type as CattleCategory]?.push(doc as CattleProfile & { id: string });
    });
    return [
      { key: 'cow', title: 'Cows', data: base.cow },
      { key: 'horse', title: 'Horses', data: base.horse },
    ];
  }, [cattle]);

  const handleChange = (field: keyof typeof defaultForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const resetForm = () => setForm({ ...defaultForm });

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
      setSuccess('Cattle saved successfully!');
      Alert.alert('Cattle saved', `${cattleName} is now part of your herd overview.`);
    } catch (err) {
      console.error(err);
      setError('Saving cattle failed. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', default: undefined })}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <SectionCard title="Create a cattle profile">
              <View style={styles.toggleRow}>
                {(['cow', 'horse'] as CattleCategory[]).map((type) => (
                  <Pressable key={type} style={[styles.toggleChip, form.type === type && styles.toggleChipActive]} onPress={() => handleChange('type', type)}>
                    <Text style={[styles.toggleText, form.type === type && styles.toggleTextActive]}>{type === 'cow' ? 'Cow' : 'Horse'}</Text>
                  </Pressable>
                ))}
              </View>
              <FormField label="Name" placeholder="Luna, Bolt..." value={form.name} onChangeText={(text) => handleChange('name', text)} />
              <FormField label="Tag ID" placeholder="#FR-221" value={form.tagId} onChangeText={(text) => handleChange('tagId', text)} />
              <FormField label="Country" placeholder="Canada" value={form.country} onChangeText={(text) => handleChange('country', text)} />
              <FormField label="Breed" placeholder="Holstein Friesian" value={form.breed} onChangeText={(text) => handleChange('breed', text)} />
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
                <FormField
                  label="Last vet visit"
                  placeholder="2025-03-14"
                  style={{ flex: 1 }}
                  value={form.lastVetVisit}
                  onChangeText={(text) => handleChange('lastVetVisit', text)}
                />
              </View>
              <FormField label="Diet goal" placeholder="High-energy lactation plan" value={form.dietGoal} onChangeText={(text) => handleChange('dietGoal', text)} />
              <FormField label="Notes" placeholder="Any special care instructions" value={form.notes} onChangeText={(text) => handleChange('notes', text)} multiline numberOfLines={4} />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Vaccinated</Text>
                <Switch value={form.vaccinated} onValueChange={(value) => handleChange('vaccinated', value)} />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}
              {success ? <Text style={styles.success}>{success}</Text> : null}

              <Pressable style={[styles.primaryButton, creating && { opacity: 0.6 }]} disabled={creating} onPress={handleCreate}>
                <Text style={styles.primaryText}>{creating ? 'Saving...' : 'Save cattle'}</Text>
              </Pressable>
            </SectionCard>

            <SectionCard title="Herd overview">
              {loading ? (
                <ActivityIndicator />
              ) : cattle.length === 0 ? (
                <Text style={styles.empty}>No cattle yet. Create your first profile above.</Text>
              ) : (
                grouped.map((section) => (
                  <View key={section.key} style={{ marginBottom: 24 }}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{section.title}</Text>
                      <Tag
                        label={`${section.data.length} ${section.data.length === 1 ? 'profile' : 'profiles'}`}
                        tone={section.key === 'cow' ? 'primary' : 'warning'}
                      />
                    </View>
                    <View>
                      {section.data.map((item) => (
                        <Pressable key={item.id} style={styles.cattleCard} onPress={() => setSelected(item)}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={styles.cattleName}>{item.name}</Text>
                            <Tag label={item.vaccinated ? 'Vaccinated' : 'Needs shot'} tone={item.vaccinated ? 'success' : 'warning'} />
                          </View>
                          <Text style={styles.cattleSub}>{item.breed}</Text>
                          <Text style={styles.cattleMeta}>
                            {item.weightKg}kg • {item.heightCm}cm • Diet: {item.dietGoal || 'Not set'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))
              )}
            </SectionCard>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={styles.modalSafe}>
          {selected ? (
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{selected.name}</Text>
              <Text style={styles.modalSubtitle}>{selected.type === 'cow' ? 'Cow' : 'Horse'} • {selected.breed}</Text>
              <View style={styles.detailGrid}>
                <DetailRow label="Tag ID" value={selected.tagId || '—'} />
                <DetailRow label="Country" value={selected.country || '—'} />
                <DetailRow label="Weight" value={`${selected.weightKg} kg`} />
                <DetailRow label="Height" value={`${selected.heightCm} cm`} />
                <DetailRow label="Age" value={`${selected.ageYears} years`} />
                <DetailRow label="Diet goal" value={selected.dietGoal || '—'} fullWidth />
                <DetailRow label="Last vet visit" value={selected.lastVetVisit || '—'} />
                <DetailRow label="Notes" value={selected.notes || '—'} fullWidth />
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

const DetailRow = ({ label, value, fullWidth }: { label: string; value: string; fullWidth?: boolean }) => (
  <View style={[styles.detailRow, fullWidth && { flexBasis: '100%' }]}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  toggleChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0a7ea4',
  },
  toggleText: {
    fontWeight: '600',
    color: '#475569',
  },
  toggleTextActive: {
    color: '#0a7ea4',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  primaryButton: {
    backgroundColor: '#0a7ea4',
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
    marginBottom: 8,
  },
  success: {
    color: '#16A34A',
    marginBottom: 8,
    fontWeight: '600',
  },
  empty: {
    color: '#475569',
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  cattleCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#F8FAFE',
  },
  cattleName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  cattleSub: {
    color: '#475569',
    marginBottom: 4,
  },
  cattleMeta: {
    color: '#64748B',
    fontSize: 13,
  },
  modalSafe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContent: {
    padding: 24,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 24,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailRow: {
    flexBasis: '48%',
  },
  detailLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 32,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    alignItems: 'center',
  },
  secondaryText: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
});
