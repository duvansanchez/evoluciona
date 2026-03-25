/**
 * Servicio API para conectar con el backend FastAPI
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Tipos para respuestas paginadas
interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  items: T[];
}

/**
 * Goals API
 */
export const goalsAPI = {
  getGoals: async (page = 1, page_size = 50) => {
    const response = await fetch(`${API_BASE_URL}/goals?page=${page}&page_size=${page_size}`);
    if (!response.ok) throw new Error('Error fetching goals');
    return response.json() as Promise<PaginatedResponse<any>>;
  },
  
  createGoal: async (goalData: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/goals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(goalData),
    });
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Error creating goal: ${response.status} ${errorData}`);
    }
    const data = await response.json();
    console.log('🎯 Goal API Response:', data);
    return data;
  },
  
  updateGoal: async (goalId: number | string, updates: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/goals/${goalId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ Error updating goal ${goalId}:`, response.status, errorData);
      throw new Error(`Error updating goal: ${response.status} ${errorData}`);
    }
    const data = await response.json();
    console.log('✅ Goal updated successfully:', data);
    return data;
  },
  
  deleteGoal: async (goalId: number | string) => {
    const response = await fetch(`${API_BASE_URL}/goals/${goalId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) throw new Error('Error deleting goal');
    return response.json();
  },
  
  getSubGoals: async (goalId: number | string) => {
    const response = await fetch(`${API_BASE_URL}/goals/${goalId}/subgoals`);
    if (!response.ok) throw new Error('Error fetching subgoals');
    return response.json();
  },
  updateSubGoal: async (subGoalId: number | string, updates: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/subgoals/${subGoalId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Error updating subgoal');
    return response.json();
  },

  createSubGoal: async (goalId: number | string, subGoalData: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/goals/${goalId}/subgoals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subGoalData),
    });
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Error creating subgoal: ${response.status} ${errorData}`);
    }
    const data = await response.json();
    console.log('✅ SubGoal created:', data);
    return data;
  },

  deleteSubGoal: async (subGoalId: number | string) => {
    const response = await fetch(`${API_BASE_URL}/subgoals/${subGoalId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) throw new Error('Error deleting subgoal');
    return response.json();
  },
};

/**
 * Phrases API
 */
export const phrasesAPI = {
  getPhrases: async (
    page = 1,
    page_size = 50,
    categoryId?: number | string,
    subcategoryId?: number | string,
    active?: boolean,
  ) => {
    let url = `${API_BASE_URL}/phrases?page=${page}&page_size=${page_size}`;
    if (categoryId) url += `&category_id=${categoryId}`;
    if (subcategoryId) url += `&subcategory_id=${subcategoryId}`;
    if (typeof active === 'boolean') url += `&active=${active}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Error fetching phrases');
    return response.json() as Promise<PaginatedResponse<any>>;
  },

  getCategories: async () => {
    const response = await fetch(`${API_BASE_URL}/phrases/categories`);
    if (!response.ok) throw new Error('Error fetching phrase categories');
    return response.json();
  },

  getCategoriesTree: async () => {
    const response = await fetch(`${API_BASE_URL}/phrases/categories-tree`);
    if (!response.ok) throw new Error('Error fetching phrase categories tree');
    return response.json();
  },

  createPhrase: async (payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/phrases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error creating phrase');
    return response.json();
  },

  updatePhrase: async (phraseId: number | string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/phrases/${phraseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error updating phrase');
    return response.json();
  },

  deletePhrase: async (phraseId: number | string) => {
    const response = await fetch(`${API_BASE_URL}/phrases/${phraseId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Error deleting phrase');
    return response.json();
  },

  getCategoriesAdmin: async () => {
    const response = await fetch(`${API_BASE_URL}/phrases/categories-admin`);
    if (!response.ok) throw new Error('Error fetching categories admin');
    return response.json();
  },

  createCategory: async (payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/phrases/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error creating category');
    return response.json();
  },

  updateCategory: async (categoryId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/phrases/categories/${categoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error updating category');
    return response.json();
  },

  deleteCategory: async (categoryId: string) => {
    const response = await fetch(`${API_BASE_URL}/phrases/categories/${categoryId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Error deleting category');
    return response.json();
  },

  createSubcategory: async (payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/phrases/subcategories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error creating subcategory');
    return response.json();
  },

  updateSubcategory: async (subcategoryId: string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/phrases/subcategories/${subcategoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error updating subcategory');
    return response.json();
  },

  deleteSubcategory: async (subcategoryId: string) => {
    const response = await fetch(`${API_BASE_URL}/phrases/subcategories/${subcategoryId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Error deleting subcategory');
    return response.json();
  },
};

/**
 * Questions API
 */
export const questionsAPI = {
  getQuestions: async (page = 1, page_size = 50, category?: string, active?: boolean, frequency?: string) => {
    let url = `${API_BASE_URL}/questions?page=${page}&page_size=${page_size}`;
    if (category) url += `&category=${category}`;
    if (typeof active === 'boolean') url += `&active=${active}`;
    if (frequency) url += `&frequency=${frequency}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Error fetching questions');
    return response.json() as Promise<PaginatedResponse<any>>;
  },
  createQuestion: async (payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error creating question');
    return response.json();
  },
  updateQuestion: async (questionId: number | string, payload: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error updating question');
    return response.json();
  },
  deleteQuestion: async (questionId: number | string) => {
    const response = await fetch(`${API_BASE_URL}/questions/${questionId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Error deleting question');
  },
  getDailySession: async (date: string) => {
    const response = await fetch(`${API_BASE_URL}/daily-sessions/${date}`);
    if (!response.ok) throw new Error('Error fetching daily session');
    return response.json();
  },
  saveDailyResponses: async (date: string, payload: { responses: { question_id: string; response: string }[] }) => {
    const response = await fetch(`${API_BASE_URL}/daily-sessions/${date}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Error saving daily responses');
    return response.json();
  },
  saveSingleResponse: async (date: string, questionId: string, response: string) => {
    const r = await fetch(`${API_BASE_URL}/daily-sessions/${date}/responses/${questionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response }),
    });
    if (!r.ok) throw new Error('Error saving response');
    return r.json();
  },
  getCalendarSummary: async (year: number, month: number) => {
    const r = await fetch(`${API_BASE_URL}/daily-sessions/calendar?year=${year}&month=${month}`);
    if (!r.ok) throw new Error('Error fetching calendar');
    return r.json();
  },
  getHistorySession: async (date: string) => {
    const r = await fetch(`${API_BASE_URL}/daily-sessions/${date}/history`);
    if (!r.ok) throw new Error('Error fetching history');
    return r.json();
  },
};

/**
 * Reports API
 */
export const reportsAPI = {
  getHistory: async (limit = 5) => {
    const response = await fetch(`${API_BASE_URL}/reports/history?limit=${limit}`);
    if (!response.ok) throw new Error('Error fetching reports history');
    return response.json();
  },
  getSchedule: async () => {
    const response = await fetch(`${API_BASE_URL}/reports/schedule`);
    if (!response.ok) throw new Error('Error fetching report schedule');
    return response.json();
  },
  updateSchedule: async (payload: {
    enabled?: boolean;
    day_of_week?: string;
    hour?: number;
    minute?: number;
  }) => {
    const response = await fetch(`${API_BASE_URL}/reports/schedule`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error updating report schedule');
    }
    return response.json();
  },
  sendCurrentWeekReport: async () => {
    const response = await fetch(`${API_BASE_URL}/reports/send-current-week`, {
      method: 'POST',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error sending current week report');
    }
    return response.json();
  },
  sendPreviousWeekReport: async () => {
    const response = await fetch(`${API_BASE_URL}/reports/send-weekly`, {
      method: 'POST',
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Error sending previous week report');
    }
    return response.json();
  },
};

export interface ReviewPlanConfig {
  shuffle: boolean;
  daily_limit: number | null;
  excluded_phrase_ids: number[];
}

export interface ReviewPlanData {
  id: number;
  name: string;
  targets: string[];
  config: ReviewPlanConfig;
  created_at?: string;
}

/**
 * Review Plans API
 */
export const reviewPlansAPI = {
  getPlans: async (): Promise<ReviewPlanData[]> => {
    const response = await fetch(`${API_BASE_URL}/phrases/review-plans`);
    if (!response.ok) throw new Error('Error fetching review plans');
    return response.json();
  },

  createPlan: async (data: { name: string; targets: string[] }): Promise<ReviewPlanData> => {
    const response = await fetch(`${API_BASE_URL}/phrases/review-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Error creating review plan');
    return response.json();
  },

  updatePlan: async (id: number, config: ReviewPlanConfig): Promise<ReviewPlanData> => {
    const response = await fetch(`${API_BASE_URL}/phrases/review-plans/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
    if (!response.ok) throw new Error('Error updating review plan config');
    return response.json();
  },

  deletePlan: async (id: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/phrases/review-plans/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Error deleting review plan');
  },
};

/**
 * Rutinas API
 */
export interface GoalSimple {
  id: number;
  titulo: string;
  icono?: string;
  categoria?: string;
  frecuencia?: string;
}

export interface RutinaBloque {
  id: number;
  rutina_id: number;
  nombre: string;
  orden: number;
  hora_inicio?: string;
  duracion_minutos?: number;
  notas?: string;
}

export interface Rutina {
  id: number;
  nombre: string;
  parte_dia: 'morning' | 'afternoon' | 'evening';
  color?: string;
  descripcion?: string;
  activa: boolean;
  fecha_creacion?: string;
  bloques: RutinaBloque[];
  objetivos: GoalSimple[];
}

export interface RutinaAsignacion {
  id: number;
  fecha: string;
  parte_dia: string;
  rutina_id: number;
  completada: boolean;
  objetivo_ids: number[];
  rutina: Rutina;
}

export interface DiaSemana {
  fecha: string;
  asignaciones: RutinaAsignacion[];
}

export const rutinasAPI = {
  getRutinas: async (): Promise<Rutina[]> => {
    const r = await fetch(`${API_BASE_URL}/rutinas`);
    if (!r.ok) throw new Error('Error fetching rutinas');
    return r.json();
  },

  createRutina: async (data: {
    nombre: string;
    parte_dia: string;
    color?: string;
    descripcion?: string;
    bloques: Omit<RutinaBloque, 'id' | 'rutina_id'>[];
  }): Promise<Rutina> => {
    const r = await fetch(`${API_BASE_URL}/rutinas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error('Error creating rutina');
    return r.json();
  },

  updateRutina: async (id: number, data: {
    nombre?: string;
    parte_dia?: string;
    color?: string;
    descripcion?: string;
    bloques?: Omit<RutinaBloque, 'id' | 'rutina_id'>[];
  }): Promise<Rutina> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error('Error updating rutina');
    return r.json();
  },

  deleteRutina: async (id: number): Promise<void> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/${id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Error deleting rutina');
  },

  getSemana: async (fechaInicio: string): Promise<DiaSemana[]> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/semana?fecha_inicio=${fechaInicio}`);
    if (!r.ok) throw new Error('Error fetching semana');
    return r.json();
  },

  createAsignacion: async (data: {
    fecha: string;
    parte_dia: string;
    rutina_id: number;
  }): Promise<RutinaAsignacion> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/asignaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error('Error creating asignacion');
    return r.json();
  },

  updateAsignacion: async (id: number, data: {
    rutina_id?: number;
    completada?: boolean;
    objetivo_ids?: number[];
  }): Promise<RutinaAsignacion> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/asignaciones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error('Error updating asignacion');
    return r.json();
  },

  deleteAsignacion: async (id: number): Promise<void> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/asignaciones/${id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Error deleting asignacion');
  },

  getRecurrenteGoals: async (): Promise<GoalSimple[]> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/objetivos-recurrentes`);
    if (!r.ok) throw new Error('Error fetching objetivos recurrentes');
    return r.json();
  },

  addObjetivo: async (rutinaId: number, objetivoId: number): Promise<void> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/${rutinaId}/objetivos/${objetivoId}`, { method: 'POST' });
    if (!r.ok) throw new Error('Error adding objetivo to rutina');
  },

  removeObjetivo: async (rutinaId: number, objetivoId: number): Promise<void> => {
    const r = await fetch(`${API_BASE_URL}/rutinas/${rutinaId}/objetivos/${objetivoId}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Error removing objetivo from rutina');
  },
};

/**
 * Función auxiliar para hacer fetch con manejo de errores
 */
export const fetchAPI = async (url: string, options?: RequestInit) => {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API error:', error);
    throw error;
  }
};
