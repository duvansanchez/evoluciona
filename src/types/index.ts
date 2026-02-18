export type GoalCategory = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'general';
export type GoalPriority = 'high' | 'medium' | 'low';
export type DayPart = 'morning' | 'afternoon' | 'evening';

export interface SubGoal {
  id: string;
  title: string;
  completed: boolean;
  notes?: string;
  completedAt?: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  category: GoalCategory;
  priority: GoalPriority;
  recurring: boolean;
  dayPart?: DayPart;
  estimatedHours?: number;
  subGoals: SubGoal[];
  completed: boolean;
  completedAt?: string;
  skipped: boolean;
  createdAt: string;
  scheduledFor?: string;
}

export interface PhraseCategory {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  subcategories: PhraseSubcategory[];
}

export interface PhraseSubcategory {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface Phrase {
  id: string;
  text: string;
  author?: string;
  categoryId: string;
  subcategoryId: string;
  notes?: string;
  active: boolean;
  reviewCount: number;
  lastReviewedAt?: string;
  createdAt: string;
}

export interface Audio {
  id: string;
  title: string;
  fileUrl: string;
  categoryId: string;
  subcategoryId: string;
  notes?: string;
  playCount: number;
  lastPlayedAt?: string;
  createdAt: string;
}
