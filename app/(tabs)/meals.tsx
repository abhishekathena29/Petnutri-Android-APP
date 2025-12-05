import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Tag } from '@/components/ui/tag';
import { useAuth } from '@/contexts/AuthContext';
import { useUserCollection } from '@/hooks/use-user-collection';
import { addUserDocument, deleteUserDocument } from '@/services/firestore';
import { CattleProfile, MealPlan } from '@/types/models';

type RecipeType = {
  id: string;
  name: string;
  dietType: string;
  calories: number;
  ingredients: string;
  nutrition: string;
  feedingTime: string;
  icon: keyof typeof Ionicons.glyphMap;
  animalType: 'cow' | 'horse';
};

// Pre-defined recipes for Cows - 2-3 recipes per diet focus
const cowRecipes: RecipeType[] = [
  // MAINTENANCE (3 recipes)
  {
    id: 'cow-m1',
    name: 'Maintenance Grazing Blend',
    dietType: 'maintenance',
    calories: 2800,
    ingredients: 'Grass hay, Timothy hay, Oat grain, Salt block, Fresh water',
    nutrition: 'Protein 12% • Fiber 28% • Fat 3% • Minerals balanced',
    feedingTime: 'Free access',
    icon: 'leaf-outline',
    animalType: 'cow',
  },
  {
    id: 'cow-m2',
    name: 'Balanced Daily Ration',
    dietType: 'maintenance',
    calories: 2600,
    ingredients: 'Mixed grass hay, Corn silage, Mineral supplement, Salt',
    nutrition: 'Protein 11% • Fiber 26% • Fat 3% • Balanced minerals',
    feedingTime: 'Morning & Evening',
    icon: 'scale-outline',
    animalType: 'cow',
  },
  {
    id: 'cow-m3',
    name: 'Summer Pasture Support',
    dietType: 'maintenance',
    calories: 2500,
    ingredients: 'Fresh pasture, Hay supplement, Electrolytes, Mineral block',
    nutrition: 'Protein 10% • Fiber 30% • Natural grazing • Hydration focus',
    feedingTime: 'Pasture access with supplements',
    icon: 'sunny-outline',
    animalType: 'cow',
  },
  // WEIGHT GAIN (3 recipes)
  {
    id: 'cow-g1',
    name: 'Weight Gain Formula',
    dietType: 'weightGain',
    calories: 4200,
    ingredients: 'Corn grain, Barley, Molasses, Cottonseed hulls, Urea supplement',
    nutrition: 'Protein 14% • Fiber 18% • Fat 6% • Energy dense',
    feedingTime: 'Three times daily',
    icon: 'trending-up-outline',
    animalType: 'cow',
  },
  {
    id: 'cow-g2',
    name: 'High Calorie Booster',
    dietType: 'weightGain',
    calories: 4500,
    ingredients: 'Whole corn, Soybean meal, Dried distillers grains, Fat supplement',
    nutrition: 'Protein 16% • Fiber 15% • Fat 8% • Maximum energy',
    feedingTime: 'Morning, Noon & Evening',
    icon: 'barbell-outline',
    animalType: 'cow',
  },
  {
    id: 'cow-g3',
    name: 'Calf Growth Starter',
    dietType: 'weightGain',
    calories: 3800,
    ingredients: 'Milk replacer, Calf starter grain, Quality hay, Growth minerals',
    nutrition: 'Protein 22% • Fat 10% • Fiber 15% • Easily digestible',
    feedingTime: 'Multiple small feedings',
    icon: 'nutrition-outline',
    animalType: 'cow',
  },
  // WEIGHT LOSS (3 recipes)
  {
    id: 'cow-l1',
    name: 'Low Calorie Hay Diet',
    dietType: 'weightLoss',
    calories: 1800,
    ingredients: 'Mature grass hay, Limited grain, Mineral supplement, Fresh water',
    nutrition: 'Protein 8% • Fiber 35% • Fat 2% • Low energy',
    feedingTime: 'Controlled portions twice daily',
    icon: 'trending-down-outline',
    animalType: 'cow',
  },
  {
    id: 'cow-l2',
    name: 'Fiber Rich Slim Mix',
    dietType: 'weightLoss',
    calories: 1600,
    ingredients: 'Straw blend, Low-quality hay, Vitamin supplement, Salt block',
    nutrition: 'Protein 7% • Fiber 40% • Fat 1.5% • High bulk low energy',
    feedingTime: 'Small portions throughout day',
    icon: 'fitness-outline',
    animalType: 'cow',
  },
  {
    id: 'cow-l3',
    name: 'Controlled Grazing Plan',
    dietType: 'weightLoss',
    calories: 2000,
    ingredients: 'Limited pasture access, Hay nets, Minerals, Restricted grain',
    nutrition: 'Protein 9% • Fiber 32% • Fat 2% • Portion controlled',
    feedingTime: 'Timed grazing sessions',
    icon: 'timer-outline',
    animalType: 'cow',
  },
  // PERFORMANCE (3 recipes)
  {
    id: 'cow-p1',
    name: 'High-Energy Lactation Mix',
    dietType: 'performance',
    calories: 3500,
    ingredients: 'Corn silage, Alfalfa hay, Soybean meal, Distillers grains, Minerals',
    nutrition: 'Protein 18% • Fiber 22% • Fat 5% • Calcium 0.9%',
    feedingTime: 'Morning & Evening',
    icon: 'water-outline',
    animalType: 'cow',
  },
  {
    id: 'cow-p2',
    name: 'Show Cattle Premium',
    dietType: 'performance',
    calories: 3800,
    ingredients: 'Steam-flaked corn, Alfalfa pellets, Soy hulls, Show supplements',
    nutrition: 'Protein 16% • Fiber 20% • Fat 6% • Coat enhancers',
    feedingTime: 'Three scheduled feedings',
    icon: 'trophy-outline',
    animalType: 'cow',
  },
  {
    id: 'cow-p3',
    name: 'Working Cattle Energy',
    dietType: 'performance',
    calories: 3600,
    ingredients: 'High-energy grain mix, Quality hay, Electrolytes, B-vitamins',
    nutrition: 'Protein 15% • Fiber 18% • Fat 5% • Quick energy release',
    feedingTime: 'Before and after work',
    icon: 'flash-outline',
    animalType: 'cow',
  },
];

// Pre-defined recipes for Horses - 2-3 recipes per diet focus
const horseRecipes: RecipeType[] = [
  // MAINTENANCE (3 recipes)
  {
    id: 'horse-m1',
    name: 'Balanced Pasture Diet',
    dietType: 'maintenance',
    calories: 2400,
    ingredients: 'Quality grass hay, Small grain ration, Mineral block, Fresh water',
    nutrition: 'Protein 10% • Fiber 28% • Fat 3% • Balanced nutrients',
    feedingTime: 'Morning & Evening',
    icon: 'leaf-outline',
    animalType: 'horse',
  },
  {
    id: 'horse-m2',
    name: 'Senior Horse Comfort',
    dietType: 'maintenance',
    calories: 2200,
    ingredients: 'Soaked hay cubes, Senior feed, Joint supplements, Probiotics',
    nutrition: 'Protein 14% • Easy to chew • Joint support • Gut health',
    feedingTime: 'Twice daily',
    icon: 'medkit-outline',
    animalType: 'horse',
  },
  {
    id: 'horse-m3',
    name: 'Digestive Health Blend',
    dietType: 'maintenance',
    calories: 2300,
    ingredients: 'Grass hay, Psyllium husk, Probiotics, Apple cider vinegar',
    nutrition: 'Protein 11% • High fiber • Gut flora support • Sand clearance',
    feedingTime: 'Daily with regular feed',
    icon: 'heart-outline',
    animalType: 'horse',
  },
  // WEIGHT GAIN (3 recipes)
  {
    id: 'horse-g1',
    name: 'Growing Foal Formula',
    dietType: 'weightGain',
    calories: 3200,
    ingredients: 'Mare milk/replacer, Creep feed, Quality hay, Growth minerals',
    nutrition: 'Protein 16% • Calcium 0.8% • Phosphorus 0.5% • Balanced growth',
    feedingTime: 'Multiple daily feedings',
    icon: 'resize-outline',
    animalType: 'horse',
  },
  {
    id: 'horse-g2',
    name: 'Weight Builder Plus',
    dietType: 'weightGain',
    calories: 3500,
    ingredients: 'Rice bran, Beet pulp, Vegetable oil, High-fat pellets, Alfalfa',
    nutrition: 'Protein 14% • Fat 10% • Fiber 18% • Calorie dense',
    feedingTime: 'Three times daily',
    icon: 'trending-up-outline',
    animalType: 'horse',
  },
  {
    id: 'horse-g3',
    name: 'Muscle Mass Builder',
    dietType: 'weightGain',
    calories: 3400,
    ingredients: 'Oats, Soybean meal, Flaxseed, Amino acid supplement, Quality hay',
    nutrition: 'Protein 18% • Fat 8% • Fiber 16% • Muscle support',
    feedingTime: 'Morning & Evening with midday snack',
    icon: 'barbell-outline',
    animalType: 'horse',
  },
  // WEIGHT LOSS (3 recipes)
  {
    id: 'horse-l1',
    name: 'Easy Keeper Diet',
    dietType: 'weightLoss',
    calories: 1600,
    ingredients: 'Timothy hay, Low-starch pellets, Vitamin supplement, Salt',
    nutrition: 'Protein 10% • Fiber 30% • Low sugar • Low starch',
    feedingTime: 'Small portions throughout day',
    icon: 'fitness-outline',
    animalType: 'horse',
  },
  {
    id: 'horse-l2',
    name: 'Metabolic Support Mix',
    dietType: 'weightLoss',
    calories: 1400,
    ingredients: 'Soaked hay, Ration balancer, Chromium supplement, Limited pasture',
    nutrition: 'Protein 12% • Fiber 35% • Very low sugar • Metabolic safe',
    feedingTime: 'Slow feeder hay nets',
    icon: 'medical-outline',
    animalType: 'horse',
  },
  {
    id: 'horse-l3',
    name: 'Low Sugar Grass Diet',
    dietType: 'weightLoss',
    calories: 1800,
    ingredients: 'Late-cut grass hay, Mineral supplement, Limited grazing time',
    nutrition: 'Protein 8% • Fiber 32% • Low NSC • Weight management',
    feedingTime: 'Controlled portions twice daily',
    icon: 'trending-down-outline',
    animalType: 'horse',
  },
  // PERFORMANCE (3 recipes)
  {
    id: 'horse-p1',
    name: 'Performance Horse Fuel',
    dietType: 'performance',
    calories: 3800,
    ingredients: 'Oats, Barley, Beet pulp, Rice bran, Flaxseed, Electrolytes',
    nutrition: 'Protein 14% • Fat 8% • Fiber 12% • High energy',
    feedingTime: '3 hours before exercise',
    icon: 'flash-outline',
    animalType: 'horse',
  },
  {
    id: 'horse-p2',
    name: 'Endurance Trail Mix',
    dietType: 'performance',
    calories: 3400,
    ingredients: 'Beet pulp, Alfalfa pellets, Vegetable oil, Electrolyte paste',
    nutrition: 'Protein 12% • Fat 10% • Slow-release energy • Hydration focus',
    feedingTime: 'Pre and post ride',
    icon: 'trail-sign-outline',
    animalType: 'horse',
  },
  {
    id: 'horse-p3',
    name: 'Competition Peak Formula',
    dietType: 'performance',
    calories: 3600,
    ingredients: 'Steam-crimped oats, Corn oil, Electrolytes, B-complex vitamins',
    nutrition: 'Protein 13% • Fat 9% • Quick energy • Recovery support',
    feedingTime: 'Scheduled around training',
    icon: 'trophy-outline',
    animalType: 'horse',
  },
];

const allRecipes = [...cowRecipes, ...horseRecipes];

const dietFocusOptions = [
  { value: 'maintenance', label: 'Maintenance', icon: 'scale-outline' as const, color: '#3B82F6' },
  { value: 'weightGain', label: 'Weight Gain', icon: 'trending-up-outline' as const, color: '#10B981' },
  { value: 'weightLoss', label: 'Weight Loss', icon: 'trending-down-outline' as const, color: '#F59E0B' },
  { value: 'performance', label: 'Performance', icon: 'trophy-outline' as const, color: '#8B5CF6' },
];

const dayOptions = [3, 5, 7, 14];

const getDietColor = (dietType: string) => {
  switch (dietType) {
    case 'maintenance': return '#3B82F6';
    case 'weightGain': return '#10B981';
    case 'weightLoss': return '#F59E0B';
    case 'performance': return '#8B5CF6';
    default: return '#64748B';
  }
};

const getDietIcon = (dietType: string): keyof typeof Ionicons.glyphMap => {
  switch (dietType) {
    case 'maintenance': return 'scale-outline';
    case 'weightGain': return 'trending-up-outline';
    case 'weightLoss': return 'trending-down-outline';
    case 'performance': return 'trophy-outline';
    default: return 'nutrition-outline';
  }
};

export default function MealsScreen() {
  const { user } = useAuth();
  const { data: herd } = useUserCollection<CattleProfile>('cattle');
  const { data: savedPlans, loading: loadingPlans } = useUserCollection<MealPlan>('meals', { orderByField: 'createdAt' });
  
  const [activeTab, setActiveTab] = useState<'mealPlan' | 'recipes'>('mealPlan');
  const [showPlannerModal, setShowPlannerModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showPlanDetailModal, setShowPlanDetailModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeType | null>(null);
  const [selectedCattle, setSelectedCattle] = useState<(CattleProfile & { id: string }) | null>(null);
  const [selectedDietFocus, setSelectedDietFocus] = useState('maintenance');
  const [selectedDays, setSelectedDays] = useState(7);
  const [selectedPlanCattle, setSelectedPlanCattle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Group saved plans by cattle with metadata
  const groupedPlans = useMemo(() => {
    const map = new Map<string, { 
      cattle: CattleProfile & { id: string } | null; 
      plans: MealPlan[];
      totalDays: number;
      dietTypes: string[];
    }>();
    
    savedPlans.forEach((plan) => {
      const existing = map.get(plan.cattleId);
      if (existing) {
        existing.plans.push(plan);
        if (!existing.dietTypes.includes(plan.dietType)) {
          existing.dietTypes.push(plan.dietType);
        }
      } else {
        const cattleMeta = herd.find((c) => c.id === plan.cattleId) as (CattleProfile & { id: string }) | undefined;
        map.set(plan.cattleId, {
          cattle: cattleMeta || null,
          plans: [plan],
          totalDays: 0,
          dietTypes: [plan.dietType],
        });
      }
    });

    // Calculate total days for each
    map.forEach((value) => {
      const uniqueDays = new Set(value.plans.map((p) => p.day || 'Daily'));
      value.totalDays = uniqueDays.size;
    });
    
    return Array.from(map.entries());
  }, [savedPlans, herd]);

  const openRecipe = (recipe: RecipeType) => {
    setSelectedRecipe(recipe);
    setShowRecipeModal(true);
  };

  const openRecipeByName = (recipeName: string) => {
    const recipe = allRecipes.find((r) => r.name === recipeName);
    if (recipe) {
      openRecipe(recipe);
    }
  };

  const generateMealPlan = async () => {
    if (!user || !selectedCattle) {
      Alert.alert('Select Cattle', 'Please select a cattle to create a meal plan.');
      return;
    }

    const recipes = selectedCattle.type === 'cow' ? cowRecipes : horseRecipes;
    
    // ONLY use recipes that match the selected diet focus
    const matchingRecipes = recipes.filter((r) => r.dietType === selectedDietFocus);
    
    // If no matching recipes found (shouldn't happen), show error
    if (matchingRecipes.length === 0) {
      Alert.alert('No Recipes', `No ${selectedDietFocus} recipes available for ${selectedCattle.type === 'cow' ? 'cows' : 'horses'}.`);
      return;
    }

    setSaving(true);
    try {
      for (let day = 1; day <= selectedDays; day++) {
        // Rotate through matching recipes only
        const morningIndex = (day - 1) % matchingRecipes.length;
        // Offset evening by 1 to ensure variety (or wrap around if only 1 recipe)
        const eveningIndex = matchingRecipes.length > 1 
          ? (morningIndex + 1) % matchingRecipes.length 
          : morningIndex;
        
        const morningRecipe = matchingRecipes[morningIndex];
        const eveningRecipe = matchingRecipes[eveningIndex];

        await addUserDocument(user.uid, 'meals', {
          cattleId: selectedCattle.id,
          cattleName: selectedCattle.name,
          recipeName: morningRecipe.name,
          dietType: selectedDietFocus,
          feedingTime: 'Morning',
          calories: morningRecipe.calories,
          ingredients: morningRecipe.ingredients,
          nutritionBreakdown: morningRecipe.nutrition,
          day: `Day ${day}`,
        });

        await addUserDocument(user.uid, 'meals', {
          cattleId: selectedCattle.id,
          cattleName: selectedCattle.name,
          recipeName: eveningRecipe.name,
          dietType: selectedDietFocus,
          feedingTime: 'Evening',
          calories: eveningRecipe.calories,
          ingredients: eveningRecipe.ingredients,
          nutritionBreakdown: eveningRecipe.nutrition,
          day: `Day ${day}`,
        });
      }

      Alert.alert('Success!', `${selectedDays}-day meal plan created for ${selectedCattle.name}`);
      setShowPlannerModal(false);
      setSelectedCattle(null);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to create meal plan. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async (planId: string) => {
    if (!user) return;
    setDeleting(planId);
    try {
      await deleteUserDocument(user.uid, 'meals', planId);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to delete meal.');
    } finally {
      setDeleting(null);
    }
  };

  const deleteAllPlansForCattle = (cattleId: string, cattleName: string) => {
    Alert.alert(
      'Delete All Plans',
      `Delete all meal plans for ${cattleName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            const plansToDelete = savedPlans.filter((p) => p.cattleId === cattleId);
            for (const plan of plansToDelete) {
              await deleteUserDocument(user.uid, 'meals', plan.id!);
            }
            setShowPlanDetailModal(false);
            setSelectedPlanCattle(null);
          },
        },
      ]
    );
  };

  const selectedCattlePlans = useMemo(() => {
    if (!selectedPlanCattle) return [];
    return savedPlans.filter((p) => p.cattleId === selectedPlanCattle);
  }, [selectedPlanCattle, savedPlans]);

  const selectedCattleInfo = useMemo(() => {
    if (!selectedPlanCattle) return null;
    return herd.find((c) => c.id === selectedPlanCattle) as (CattleProfile & { id: string }) | undefined;
  }, [selectedPlanCattle, herd]);

  const selectedPlanMeta = useMemo(() => {
    if (!selectedPlanCattle) return null;
    const data = groupedPlans.find(([id]) => id === selectedPlanCattle);
    return data ? data[1] : null;
  }, [selectedPlanCattle, groupedPlans]);

  // Group plans by day for detail view
  const plansByDay = useMemo(() => {
    const map = new Map<string, MealPlan[]>();
    selectedCattlePlans.forEach((plan) => {
      const day = plan.day || 'Daily';
      const existing = map.get(day) || [];
      existing.push(plan);
      map.set(day, existing);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const numA = parseInt(a[0].replace('Day ', '')) || 0;
      const numB = parseInt(b[0].replace('Day ', '')) || 0;
      return numA - numB;
    });
  }, [selectedCattlePlans]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'mealPlan' && styles.tabActive]}
          onPress={() => setActiveTab('mealPlan')}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={activeTab === 'mealPlan' ? '#0a7ea4' : '#64748B'}
          />
          <Text style={[styles.tabText, activeTab === 'mealPlan' && styles.tabTextActive]}>
            Meal Plan
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'recipes' && styles.tabActive]}
          onPress={() => setActiveTab('recipes')}
        >
          <Ionicons
            name="book-outline"
            size={20}
            color={activeTab === 'recipes' ? '#0a7ea4' : '#64748B'}
          />
          <Text style={[styles.tabText, activeTab === 'recipes' && styles.tabTextActive]}>
            Recipes
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* MEAL PLAN TAB */}
        {activeTab === 'mealPlan' && (
          <>
            {/* Create Meal Plan Card */}
            <Pressable style={styles.createCard} onPress={() => setShowPlannerModal(true)}>
              <View style={styles.createIconWrap}>
                <Ionicons name="add" size={28} color="#fff" />
              </View>
              <View style={styles.createContent}>
                <Text style={styles.createTitle}>Create Meal Plan</Text>
                <Text style={styles.createSubtitle}>Generate a custom diet schedule</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#94A3B8" />
            </Pressable>

            {/* Cattle Plans */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Meal Plans</Text>
              
              {loadingPlans ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="large" color="#0a7ea4" />
                </View>
              ) : groupedPlans.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="restaurant-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>No meal plans yet</Text>
                  <Text style={styles.emptySubtitle}>Create your first meal plan above</Text>
                </View>
              ) : (
                <View style={styles.planCardsGrid}>
                  {groupedPlans.map(([cattleId, data]) => (
                    <View key={cattleId} style={styles.planCard}>
                      {/* Card Header with Delete */}
                      <View style={styles.planCardHeader}>
                        <View style={[styles.planCardAvatar, data.cattle?.type === 'horse' && styles.horseCardAvatar]}>
                          <Ionicons
                            name={data.cattle?.type === 'horse' ? 'git-branch-outline' : 'logo-octocat'}
                            size={20}
                            color={data.cattle?.type === 'horse' ? '#D97706' : '#0a7ea4'}
                          />
                        </View>
                        <Pressable 
                          style={styles.planCardDeleteBtn}
                          onPress={() => deleteAllPlansForCattle(cattleId, data.cattle?.name || data.plans[0]?.cattleName || 'Unknown')}
                        >
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </Pressable>
                      </View>

                      {/* Clickable Content */}
                      <Pressable
                        onPress={() => {
                          setSelectedPlanCattle(cattleId);
                          setShowPlanDetailModal(true);
                        }}
                      >
                        {/* Cattle Name */}
                        <Text style={styles.planCardName}>
                          {data.cattle?.name || data.plans[0]?.cattleName || 'Unknown'}
                        </Text>
                        <Text style={styles.planCardType}>
                          {data.cattle?.type === 'horse' ? 'Horse' : 'Cow'}
                        </Text>

                        {/* Stats Row */}
                        <View style={styles.planCardStats}>
                          <View style={styles.planCardStat}>
                            <Ionicons name="calendar-outline" size={14} color="#64748B" />
                            <Text style={styles.planCardStatText}>{data.totalDays} days</Text>
                          </View>
                          <View style={styles.planCardStat}>
                            <Ionicons name="restaurant-outline" size={14} color="#64748B" />
                            <Text style={styles.planCardStatText}>{data.plans.length} meals</Text>
                          </View>
                        </View>

                        {/* Diet Focus Tags */}
                        <View style={styles.planCardDiets}>
                          {data.dietTypes.slice(0, 2).map((diet, idx) => (
                            <View key={idx} style={[styles.dietTag, { backgroundColor: `${getDietColor(diet)}15` }]}>
                              <Ionicons name={getDietIcon(diet)} size={12} color={getDietColor(diet)} />
                              <Text style={[styles.dietTagText, { color: getDietColor(diet) }]}>
                                {diet}
                              </Text>
                            </View>
                          ))}
                        </View>

                        {/* View Details Link */}
                        <View style={styles.viewDetailsRow}>
                          <Text style={styles.viewDetailsText}>View Details</Text>
                          <Ionicons name="chevron-forward" size={14} color="#0a7ea4" />
                        </View>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {/* RECIPES TAB */}
        {activeTab === 'recipes' && (
          <>
            {/* Cow Recipes */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="logo-octocat" size={22} color="#0a7ea4" />
                  <Text style={styles.sectionTitle}>Cow Recipes</Text>
                </View>
                <Tag label={`${cowRecipes.length}`} tone="primary" />
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.recipeScroll}
                contentContainerStyle={styles.recipeScrollContent}
              >
                {cowRecipes.map((recipe) => (
                  <Pressable key={recipe.id} style={styles.recipeCard} onPress={() => openRecipe(recipe)}>
                    <View style={styles.recipeIconWrap}>
                      <Ionicons name={recipe.icon} size={28} color="#0a7ea4" />
                    </View>
                    <Text style={styles.recipeName} numberOfLines={2}>{recipe.name}</Text>
                    <Text style={styles.recipeCalories}>{recipe.calories} kcal</Text>
                    <View style={[styles.recipeDietBadge, { backgroundColor: `${getDietColor(recipe.dietType)}15` }]}>
                      <Text style={[styles.recipeDietText, { color: getDietColor(recipe.dietType) }]}>
                        {recipe.dietType}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Horse Recipes */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="git-branch-outline" size={22} color="#D97706" />
                  <Text style={styles.sectionTitle}>Horse Recipes</Text>
                </View>
                <Tag label={`${horseRecipes.length}`} tone="warning" />
              </View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.recipeScroll}
                contentContainerStyle={styles.recipeScrollContent}
              >
                {horseRecipes.map((recipe) => (
                  <Pressable key={recipe.id} style={[styles.recipeCard, styles.horseRecipeCard]} onPress={() => openRecipe(recipe)}>
                    <View style={[styles.recipeIconWrap, styles.horseIconWrap]}>
                      <Ionicons name={recipe.icon} size={28} color="#D97706" />
                    </View>
                    <Text style={styles.recipeName} numberOfLines={2}>{recipe.name}</Text>
                    <Text style={styles.recipeCalories}>{recipe.calories} kcal</Text>
                    <View style={[styles.recipeDietBadge, { backgroundColor: `${getDietColor(recipe.dietType)}15` }]}>
                      <Text style={[styles.recipeDietText, { color: getDietColor(recipe.dietType) }]}>
                        {recipe.dietType}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </>
        )}
      </ScrollView>

      {/* Create Meal Plan Modal */}
      <Modal visible={showPlannerModal} animationType="slide" onRequestClose={() => setShowPlannerModal(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Pressable style={styles.closeButton} onPress={() => setShowPlannerModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
              <Text style={styles.modalTitle}>Create Meal Plan</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Select Cattle */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Select Cattle</Text>
              {herd.length === 0 ? (
                <Text style={styles.emptyText}>No cattle profiles found. Create one first.</Text>
              ) : (
                <View style={styles.cattleGrid}>
                  {herd.map((cattle) => (
                    <Pressable
                      key={cattle.id}
                      style={[
                        styles.cattleOption,
                        selectedCattle?.id === cattle.id && styles.cattleOptionSelected,
                      ]}
                      onPress={() => setSelectedCattle(cattle as CattleProfile & { id: string })}
                    >
                      <View style={[styles.cattleOptionIcon, cattle.type === 'horse' && styles.horseOptionIcon]}>
                        <Ionicons
                          name={cattle.type === 'cow' ? 'logo-octocat' : 'git-branch-outline'}
                          size={20}
                          color={cattle.type === 'cow' ? '#0a7ea4' : '#D97706'}
                        />
                      </View>
                      <Text style={[
                        styles.cattleOptionName,
                        selectedCattle?.id === cattle.id && styles.cattleOptionNameSelected,
                      ]}>{cattle.name}</Text>
                      {selectedCattle?.id === cattle.id && (
                        <Ionicons name="checkmark-circle" size={20} color="#0a7ea4" />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Diet Focus */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Diet Focus</Text>
              <View style={styles.dietGrid}>
                {dietFocusOptions.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.dietOption,
                      selectedDietFocus === option.value && { borderColor: option.color, backgroundColor: `${option.color}15` },
                    ]}
                    onPress={() => setSelectedDietFocus(option.value)}
                  >
                    <Ionicons name={option.icon} size={24} color={selectedDietFocus === option.value ? option.color : '#64748B'} />
                    <Text style={[
                      styles.dietOptionText,
                      selectedDietFocus === option.value && { color: option.color },
                    ]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Duration */}
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Plan Duration (Days)</Text>
              <View style={styles.daysRow}>
                {dayOptions.map((days) => (
                  <Pressable
                    key={days}
                    style={[styles.dayOption, selectedDays === days && styles.dayOptionSelected]}
                    onPress={() => setSelectedDays(days)}
                  >
                    <Text style={[styles.dayOptionText, selectedDays === days && styles.dayOptionTextSelected]}>
                      {days}
                    </Text>
                    <Text style={[styles.dayOptionLabel, selectedDays === days && styles.dayOptionLabelSelected]}>
                      days
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable 
              style={[styles.generateButton, saving && { opacity: 0.6 }]} 
              onPress={generateMealPlan}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={20} color="#fff" />
                  <Text style={styles.generateText}>Generate Meal Plan</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Plan Detail Modal */}
      <Modal visible={showPlanDetailModal} animationType="slide" onRequestClose={() => setShowPlanDetailModal(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Pressable style={styles.closeButton} onPress={() => setShowPlanDetailModal(false)}>
              <Ionicons name="arrow-back" size={24} color="#64748B" />
            </Pressable>
            <Text style={styles.modalTitle}>Meal Plan</Text>
            <Pressable 
              style={styles.deleteAllButton}
              onPress={() => selectedCattleInfo && deleteAllPlansForCattle(selectedPlanCattle!, selectedCattleInfo.name)}
            >
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Cattle Info Header */}
            {selectedCattleInfo && selectedPlanMeta && (
              <View style={styles.detailHeaderCard}>
                <View style={styles.detailHeaderTop}>
                  <View style={[styles.detailAvatar, selectedCattleInfo.type === 'horse' && styles.horseDetailAvatar]}>
                    <Ionicons
                      name={selectedCattleInfo.type === 'horse' ? 'git-branch-outline' : 'logo-octocat'}
                      size={28}
                      color={selectedCattleInfo.type === 'horse' ? '#D97706' : '#0a7ea4'}
                    />
                  </View>
                  <View style={styles.detailHeaderInfo}>
                    <Text style={styles.detailName}>{selectedCattleInfo.name}</Text>
                    <Text style={styles.detailType}>
                      {selectedCattleInfo.type === 'cow' ? 'Cow' : 'Horse'}
                    </Text>
                  </View>
                </View>

                {/* Plan Stats */}
                <View style={styles.detailStats}>
                  <View style={styles.detailStatItem}>
                    <Ionicons name="calendar-outline" size={18} color="#0a7ea4" />
                    <Text style={styles.detailStatValue}>{selectedPlanMeta.totalDays}</Text>
                    <Text style={styles.detailStatLabel}>Days</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Ionicons name="restaurant-outline" size={18} color="#0a7ea4" />
                    <Text style={styles.detailStatValue}>{selectedPlanMeta.plans.length}</Text>
                    <Text style={styles.detailStatLabel}>Meals</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Ionicons name={getDietIcon(selectedPlanMeta.dietTypes[0])} size={18} color={getDietColor(selectedPlanMeta.dietTypes[0])} />
                    <Text style={[styles.detailStatValue, { color: getDietColor(selectedPlanMeta.dietTypes[0]) }]}>
                      {selectedPlanMeta.dietTypes[0]}
                    </Text>
                    <Text style={styles.detailStatLabel}>Focus</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Day-wise Plans */}
            {plansByDay.map(([day, meals]) => (
              <View key={day} style={styles.daySection}>
                <View style={styles.dayHeader}>
                  <View style={styles.dayBadge}>
                    <Ionicons name="calendar" size={14} color="#fff" />
                    <Text style={styles.dayBadgeText}>{day}</Text>
                  </View>
                  <Text style={styles.mealCount}>{meals.length} meals</Text>
                </View>
                {meals.map((meal) => (
                  <View key={meal.id} style={styles.mealItem}>
                    <View style={styles.mealTimeWrap}>
                      <View style={[styles.mealTimeIcon, meal.feedingTime === 'Evening' && styles.eveningIcon]}>
                        <Ionicons
                          name={meal.feedingTime === 'Morning' ? 'sunny-outline' : 'moon-outline'}
                          size={14}
                          color={meal.feedingTime === 'Morning' ? '#F59E0B' : '#6366F1'}
                        />
                      </View>
                      <Text style={styles.mealTime}>{meal.feedingTime}</Text>
                    </View>
                    <Pressable style={styles.mealInfoWrap} onPress={() => openRecipeByName(meal.recipeName)}>
                      <View style={styles.mealDetails}>
                        <Text style={styles.mealName}>{meal.recipeName}</Text>
                        <Text style={styles.mealCal}>{meal.calories} kcal</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                    </Pressable>
                    <Pressable 
                      style={styles.deleteMealButton}
                      onPress={() => deletePlan(meal.id!)}
                      disabled={deleting === meal.id}
                    >
                      {deleting === meal.id ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <Ionicons name="close-circle" size={20} color="#F87171" />
                      )}
                    </Pressable>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Recipe Detail Modal */}
      <Modal visible={showRecipeModal} animationType="slide" transparent onRequestClose={() => setShowRecipeModal(false)}>
        <Pressable style={styles.recipeModalOverlay} onPress={() => setShowRecipeModal(false)}>
          <Pressable style={styles.recipeModalContent} onPress={(e) => e.stopPropagation()}>
            {selectedRecipe && (
              <>
                <View style={styles.recipeModalHeader}>
                  <View style={[
                    styles.recipeModalIcon,
                    selectedRecipe.animalType === 'horse' && styles.horseModalIcon
                  ]}>
                    <Ionicons
                      name={selectedRecipe.icon}
                      size={36}
                      color={selectedRecipe.animalType === 'horse' ? '#D97706' : '#0a7ea4'}
                    />
                  </View>
                  <Text style={styles.recipeModalTitle}>{selectedRecipe.name}</Text>
                  <Pressable style={styles.closeRecipeButton} onPress={() => setShowRecipeModal(false)}>
                    <Ionicons name="close" size={24} color="#64748B" />
                  </Pressable>
                </View>

                <View style={styles.recipeStats}>
                  <View style={styles.recipeStat}>
                    <Ionicons name="flame-outline" size={20} color="#EF4444" />
                    <Text style={styles.recipeStatValue}>{selectedRecipe.calories}</Text>
                    <Text style={styles.recipeStatLabel}>kcal</Text>
                  </View>
                  <View style={styles.recipeStat}>
                    <Ionicons name="time-outline" size={20} color="#3B82F6" />
                    <Text style={styles.recipeStatValue}>{selectedRecipe.feedingTime}</Text>
                  </View>
                </View>

                <View style={styles.recipeDetailSection}>
                  <View style={styles.recipeDetailHeader}>
                    <Ionicons name="list-outline" size={18} color="#64748B" />
                    <Text style={styles.recipeDetailLabel}>Ingredients</Text>
                  </View>
                  <Text style={styles.recipeDetailText}>{selectedRecipe.ingredients}</Text>
                </View>

                <View style={styles.recipeDetailSection}>
                  <View style={styles.recipeDetailHeader}>
                    <Ionicons name="nutrition-outline" size={18} color="#64748B" />
                    <Text style={styles.recipeDetailLabel}>Nutrition</Text>
                  </View>
                  <Text style={styles.recipeDetailText}>{selectedRecipe.nutrition}</Text>
                </View>

                <View style={styles.recipeDietTypeSection}>
                  <Tag label={selectedRecipe.dietType} tone="success" />
                  <Tag label={selectedRecipe.animalType === 'cow' ? 'For Cows' : 'For Horses'} tone={selectedRecipe.animalType === 'cow' ? 'primary' : 'warning'} />
                </View>
              </>
            )}
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: '#F0F9FF',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#0a7ea4',
  },
  container: {
    padding: 20,
    paddingBottom: 100,
  },
  createCard: {
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
  createIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#0a7ea4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  createContent: {
    flex: 1,
  },
  createTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  createSubtitle: {
    fontSize: 14,
    color: '#64748B',
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: '#fff',
    borderRadius: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  planCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  planCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planCardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  horseCardAvatar: {
    backgroundColor: '#FEF3C7',
  },
  planCardDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  planCardType: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  planCardStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  planCardStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  planCardStatText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  planCardDiets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dietTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dietTagText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  viewDetailsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0a7ea4',
  },
  recipeScroll: {
    marginHorizontal: -20,
  },
  recipeScrollContent: {
    paddingHorizontal: 20,
  },
  recipeCard: {
    width: 150,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  horseRecipeCard: {
    borderColor: '#FEF3C7',
  },
  recipeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  horseIconWrap: {
    backgroundColor: '#FEF3C7',
  },
  recipeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
    height: 38,
  },
  recipeCalories: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 10,
  },
  recipeDietBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  recipeDietText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
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
    padding: 16,
    paddingBottom: 8,
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
  deleteAllButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formSection: {
    marginBottom: 28,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 14,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
  cattleGrid: {
    gap: 12,
  },
  cattleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  cattleOptionSelected: {
    borderColor: '#0a7ea4',
    backgroundColor: '#F0F9FF',
  },
  cattleOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  horseOptionIcon: {
    backgroundColor: '#FEF3C7',
  },
  cattleOptionName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  cattleOptionNameSelected: {
    color: '#0a7ea4',
  },
  dietGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dietOption: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  dietOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  daysRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dayOption: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  dayOptionSelected: {
    borderColor: '#0a7ea4',
    backgroundColor: '#E0F2FE',
  },
  dayOptionText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#475569',
  },
  dayOptionTextSelected: {
    color: '#0a7ea4',
  },
  dayOptionLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  dayOptionLabelSelected: {
    color: '#0a7ea4',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0a7ea4',
    paddingVertical: 18,
    borderRadius: 16,
    marginTop: 12,
  },
  generateText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
  },
  detailHeaderCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  detailHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  detailAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  horseDetailAvatar: {
    backgroundColor: '#FEF3C7',
  },
  detailHeaderInfo: {
    flex: 1,
  },
  detailName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailType: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  detailStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
  },
  detailStatItem: {
    alignItems: 'center',
  },
  detailStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 6,
    textTransform: 'capitalize',
  },
  detailStatLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  detailStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },
  daySection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  dayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  dayBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  mealCount: {
    color: '#64748B',
    fontSize: 13,
  },
  mealItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  mealTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 100,
  },
  mealTimeIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eveningIcon: {
    backgroundColor: '#E0E7FF',
  },
  mealTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  mealInfoWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealDetails: {
    flex: 1,
  },
  mealName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  mealCal: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  deleteMealButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  recipeModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  recipeModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  recipeModalIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  horseModalIcon: {
    backgroundColor: '#FEF3C7',
  },
  recipeModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  closeRecipeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 24,
  },
  recipeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recipeStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  recipeStatLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  recipeDetailSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  recipeDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  recipeDetailLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  recipeDetailText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  recipeDietTypeSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },
});
