export type CattleCategory = 'cow' | 'horse';

export interface CattleProfile {
  id?: string;
  name: string;
  tagId?: string;
  type: CattleCategory;
  vaccinated: boolean;
  country: string;
  breed: string;
  weightKg: number;
  heightCm: number;
  ageYears: number;
  dietGoal: string;
  healthStatus: 'excellent' | 'good' | 'monitor';
  lastVetVisit: string;
  notes?: string;
  createdAt?: Date;
}

export interface MealPlan {
  id?: string;
  cattleId: string;
  cattleName: string;
  recipeName: string;
  dietType: 'maintenance' | 'weightGain' | 'weightLoss' | 'performance';
  feedingTime: string;
  calories: number;
  ingredients: string;
  nutritionBreakdown: string;
  day?: string;
  createdAt?: Date;
}

export interface PregnancyPlan {
  id?: string;
  cattleId: string;
  cattleName: string;
  dueDate: string;
  trimester: 'early' | 'mid' | 'late';
  blockedMonth: string;
  todo: string;
  nutritionFocus: string;
  calendarDate: string;
  createdAt?: Date;
}

export interface NutritionCalculation {
  id?: string;
  cattleId: string;
  cattleName: string;
  type: CattleCategory;
  weightKg: number;
  activityLevel: 'low' | 'moderate' | 'high';
  productionStage: 'maintenance' | 'lactating' | 'pregnant' | 'working';
  totalCalories: number;
  proteinGrams: number;
  fiberGrams: number;
  minerals: string;
  createdAt?: Date;
}

export interface ProgressLog {
  id?: string;
  cattleId: string;
  cattleName: string;
  periodType: 'weekly' | 'monthly';
  periodLabel: string;
  nutritionScore: number;
  mealCompliance: number;
  exerciseMinutes: number;
  observations: string;
  createdAt?: Date;
}

