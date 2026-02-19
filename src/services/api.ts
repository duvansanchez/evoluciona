/**
 * Servicio API para conectar con el backend FastAPI
 */

const API_BASE_URL = 'http://127.0.0.1:3001/api';

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
    if (!response.ok) throw new Error('Error creating goal');
    return response.json();
  },
  
  updateGoal: async (goalId: number | string, updates: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE_URL}/goals/${goalId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Error updating goal');
    return response.json();
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
};

/**
 * Phrases API
 */
export const phrasesAPI = {
  getPhrases: async (page = 1, page_size = 50, categoryId?: number, subcategoryId?: number) => {
    let url = `${API_BASE_URL}/phrases?page=${page}&page_size=${page_size}`;
    if (categoryId) url += `&category_id=${categoryId}`;
    if (subcategoryId) url += `&subcategory_id=${subcategoryId}`;
    
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
