import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Grid3X3, List, Plus, Target, TrendingUp } from 'lucide-react';
import MetricCard from '@/components/MetricCard';
import GoalCard from '@/components/goals/GoalCard';
import GoalModal from '@/components/goals/GoalModal';
import GoalFocusModal from '@/components/goals/GoalFocusModal';
import FocusModal from '@/components/goals/FocusModal';
import { goalsAPI } from '@/services/api';
import type { Goal, GoalCategory, SubGoal } from '@/types';

const tabs: { key: GoalCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'daily', label: 'Diarios' },
  { key: 'weekly', label: 'Semanales' },
  { key: 'monthly', label: 'Mensuales' },
  { key: 'yearly', label: 'Anuales' },
  { key: 'general', label: 'Generales' },
];

// Mapear categoría de español a inglés
const mapCategory = (categoria: string | null | undefined): GoalCategory => {
  if (!categoria) return 'general';
  const normalized = categoria.toLowerCase().trim();
  switch (normalized) {
    case 'diario': return 'daily';
    case 'semanal': return 'weekly';
    case 'mensual': return 'monthly';
    case 'anual': return 'yearly';
    case 'diarios': return 'daily';
    case 'semanales': return 'weekly';
    case 'mensuales': return 'monthly';
    case 'anuales': return 'yearly';
    case 'general': return 'general';
    default: return 'general';
  }
};

// Mapear prioridad de español a inglés
const mapPriority = (prioridad: string | null | undefined): 'high' | 'medium' | 'low' => {
  if (!prioridad) return 'medium';
  const normalized = prioridad.toLowerCase().trim();
  if (normalized === 'alta' || normalized === 'high') return 'high';
  if (normalized === 'baja' || normalized === 'low') return 'low';
  return 'medium';
};

// Filtrar objetivos según reglas de visualización por fecha
const shouldShowGoal = (item: any, goalCategory: GoalCategory): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Determinar el período según la categoría
  let periodoInicio: Date;
  let periodoFin: Date;
  
  switch (goalCategory) {
    case 'daily':
      // HOY: desde las 00:00 de hoy hasta las 00:00 de mañana
      periodoInicio = today;
      periodoFin = tomorrow;
      break;
    case 'weekly':
      // SEMANA: desde el lunes de esta semana
      const monday = new Date(today);
      monday.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
      monday.setHours(0, 0, 0, 0);
      periodoInicio = monday;
      periodoFin = new Date(monday);
      periodoFin.setDate(monday.getDate() + 7);
      break;
    case 'monthly':
      // MES: desde el día 1 del mes actual
      periodoInicio = new Date(today.getFullYear(), today.getMonth(), 1);
      periodoFin = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      break;
    case 'yearly':
      // AÑO: desde el 1 de enero del año actual
      periodoInicio = new Date(today.getFullYear(), 0, 1);
      periodoFin = new Date(today.getFullYear() + 1, 0, 1);
      break;
    case 'general':
      // General: siempre se muestra
      return true;
    default:
      return true;
  }
  
  // Lógica de la app anterior:
  // 1. Si es RECURRENTE de esta categoría → SIEMPRE cuenta
  if (item.recurrente === true) {
    return true;
  }
  
  // 2. Si NO es recurrente → Solo cuenta si fue creado dentro del período
  if (item.fecha_creacion) {
    const fechaCreacion = new Date(item.fecha_creacion);
    fechaCreacion.setHours(0, 0, 0, 0);
    return fechaCreacion >= periodoInicio && fechaCreacion < periodoFin;
  }
  
  // Por defecto no mostrar
  return false;
};

// Mapear datos del backend al formato frontend
const mapBackendGoal = (item: any): Goal => ({
  id: item.id.toString(),
  user_id: item.user_id,
  title: item.titulo,
  description: item.descripcion || undefined,
  category: mapCategory(item.categoria),
  priority: mapPriority(item.prioridad),
  completed: item.completado || false,
  recurring: item.recurrente || false,
  createdAt: item.fecha_creacion,
  completedAt: item.fecha_completado || undefined,
  parentGoalId: item.objetivo_padre_id?.toString(),
  isParent: item.es_padre || false,
  subGoals: [] as SubGoal[],
  skipped: false,
  scheduledFor: item.programado_para || undefined,
});

export default function Goals() {
  const [activeTab, setActiveTab] = useState<GoalCategory | 'all'>('daily');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalFocusOpen, setGoalFocusOpen] = useState(false);
  const [focusGoal, setFocusGoal] = useState<Goal | null>(null);
  const [focusModalOpen, setFocusModalOpen] = useState(false);
  const [focusSubGoal, setFocusSubGoal] = useState<SubGoal | null>(null);
  const [focusParentGoal, setFocusParentGoal] = useState<Goal | null>(null);

  // Cargar objetivos del backend
  useEffect(() => {
    const loadGoals = async () => {
      try {
        setLoading(true);
        
        // Cargar primera página para obtener el total
        const firstPage = await goalsAPI.getGoals(1, 100);
        const totalPages = firstPage.pages;
        console.log(`📊 Total de páginas: ${totalPages}, Total objetivos: ${firstPage.total}`);
        
        // Cargar todas las páginas restantes en paralelo
        const pagePromises = [];
        for (let page = 2; page <= totalPages; page++) {
          pagePromises.push(goalsAPI.getGoals(page, 100));
        }
        
        const restPages = await Promise.all(pagePromises);
        
        // Combinar todos los items
        const allItems = [
          ...firstPage.items,
          ...restPages.flatMap(p => p.items)
        ];
        
        console.log(`✅ Total objetivos cargados: ${allItems.length}`);
        
        // Mapear PRIMERO (para tener la categoría en inglés)
        const allMapped = allItems.map(mapBackendGoal);
        
        console.log('📋 Categorías SIN filtro de fecha:', allMapped.reduce((acc, g) => {
          acc[g.category] = (acc[g.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>));
        
        // Ahora filtrar usando la categoría ya mapeada
        const filteredGoals = allMapped.filter(goal => shouldShowGoal(
          allItems.find(item => item.id.toString() === goal.id)!,
          goal.category
        ));
        
        // Cargar subobjetivos para cada objetivo filtrado
        const goalsWithSubgoals = await Promise.all(
          filteredGoals.map(async (goal) => {
            try {
              const subgoalsData = await goalsAPI.getSubGoals(goal.id);
              const mappedSubgoals = subgoalsData
                .map((sub: any): SubGoal => ({
                  id: sub.id.toString(),
                  title: sub.titulo,
                  completed: sub.completado || false,
                  notes: sub.notas || undefined,
                  completedAt: sub.fecha_completado || undefined,
                  priority: undefined, // Los subobjetivos no tienen prioridad en  la tabla subobjetivos
                  focusTimeSeconds: sub.tiempo_focus || 0,
                }))
                .sort((a, b) => {
                  const orderA = subgoalsData.find((s: any) => s.id.toString() === a.id)?.orden || 0;
                  const orderB = subgoalsData.find((s: any) => s.id.toString() === b.id)?.orden || 0;
                  return orderA - orderB;
                });
              return { ...goal, subGoals: mappedSubgoals };
            } catch (error) {
              console.warn(`⚠️ No se pudieron cargar subobjetivos para objetivo ${goal.id}:`, error);
              return { ...goal, subGoals: [] };
            }
          })
        );
        
        console.log('📊 Total objetivos del backend:', allItems.length);
        console.log('✅ Objetivos visibles tras filtrado POR FECHA:', goalsWithSubgoals.length);
        console.log('📋 Categorías CON filtro de fecha:', goalsWithSubgoals.reduce((acc, g) => {
          acc[g.category] = (acc[g.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>));
        console.log('🔸 Objetivos con subobjetivos:', goalsWithSubgoals.filter(g => g.subGoals.length > 0).length);
        
        setGoals(goalsWithSubgoals);
      } catch (error) {
        console.error('❌ Error loading goals:', error);
        // En caso de error, mantener los goals vacíos
      } finally {
        setLoading(false);
      }
    };

    loadGoals();
  }, []);

  // Escuchar Shift+N para crear nuevo objetivo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditingGoal(null);
        setModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filtered = activeTab === 'all' ? goals : goals.filter(g => g.category === activeTab);
  const daily = goals.filter(g => g.category === 'daily');
  const weekly = goals.filter(g => g.category === 'weekly');
  const monthly = goals.filter(g => g.category === 'monthly');
  const yearly = goals.filter(g => g.category === 'yearly');

  const completedOf = (arr: typeof goals) => `${arr.filter(g => g.completed).length}/${arr.length}`;

  const handleToggle = (id: string) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    
    const newCompleted = !goal.completed;
    const completedAt = newCompleted ? new Date().toISOString() : undefined;
    
    setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: newCompleted, completedAt } : g));
    
    void persistGoalUpdate(id, { completed: newCompleted, completedAt });
  };

  const persistGoalUpdate = async (goalId: string, updates: { completed: boolean; completedAt?: string }) => {
    console.log('📤 persistGoalUpdate called with:', { goalId, updates });
    
    const payload: Record<string, unknown> = {};
    if (typeof updates.completed === 'boolean') payload.completado = updates.completed;
    if (updates.completedAt) payload.fecha_completado = updates.completedAt;
    
    console.log('📤 Payload to send:', payload);
    
    if (Object.keys(payload).length === 0) {
      console.warn('⚠️ Empty payload, returning early');
      return;
    }

    try {
      const result = await goalsAPI.updateGoal(goalId, payload);
      console.log('✅ Goal update success:', { goalId, result });
    } catch (error) {
      console.error('❌ Goal update failed:', { goalId, error });
      // Re-throw para que se propague si lo necesita
      throw error;
    }
  };

  const handleEdit = (id: string) => {
    const goal = goals.find(g => g.id === id);
    if (goal) {
      setEditingGoal(goal);
      setModalOpen(true);
    }
  };

  const handleCreate = () => {
    setEditingGoal(null);
    setModalOpen(true);
  };

  const handleSave = async (data: any) => {
    // Mapear categorías del frontend al backend
    const categoryMap: Record<string, string> = {
      daily: 'diario',
      weekly: 'semanal',
      monthly: 'mensual',
      yearly: 'anual',
      general: 'general'
    };
    
    if (editingGoal) {
      // Update existing goal in backend
      const updatePayload: Record<string, unknown> = {
        title: data.title,
      };
      
      if (data.description) updatePayload.descripcion = data.description;
      if (data.category) updatePayload.categoria = categoryMap[data.category] || data.category;
      if (data.priority) updatePayload.prioridad = data.priority;
      if (data.recurring !== undefined) updatePayload.recurrente = data.recurring;
      if (data.dayPart && data.dayPart !== 'none') updatePayload.parte_dia = data.dayPart;
      if (data.estimatedHours) updatePayload.horas_estimadas = parseInt(data.estimatedHours);
      if (data.reward) updatePayload.recompensa = data.reward;
      if (data.isParent !== undefined) updatePayload.es_padre = data.isParent;
      if (data.parentGoalId) updatePayload.objetivo_padre_id = data.parentGoalId;
      if (data.startDate) updatePayload.fecha_inicio = data.startDate;
      if (data.endDate) updatePayload.fecha_fin = data.endDate;
      if (data.scheduledType === 'specific' && data.scheduledDate) updatePayload.programado_para = data.scheduledDate;
      
      try {
        await goalsAPI.updateGoal(editingGoal.id, updatePayload);
        setGoals(prev => prev.map(g => g.id === editingGoal.id ? {
          ...g,
          title: data.title,
          description: data.description || undefined,
          priority: data.priority,
          category: data.category,
          parentGoalId: data.parentGoalId || undefined,
          startDate: data.startDate || undefined,
          endDate: data.endDate || undefined,
          estimatedHours: data.estimatedHours ? parseInt(data.estimatedHours) : undefined,
          estimatedMinutes: data.estimatedMinutes ? parseInt(data.estimatedMinutes) : undefined,
          reward: data.reward || undefined,
          dayPart: data.dayPart === 'none' ? undefined : data.dayPart,
          recurring: data.recurring,
          isParent: data.isParent,
          scheduledFor: data.scheduledType === 'specific' ? data.scheduledDate : undefined,
          subGoals: data.subGoals,
        } : g));
      } catch (error) {
        console.error('Error updating goal:', error);
      }

      data.subGoals.forEach((sub: SubGoal, index: number) => {
        if (sub.id.startsWith('new-')) return;
        void persistSubGoalUpdate(sub.id, {
          title: sub.title,
          completed: sub.completed,
          focusTimeSeconds: sub.focusTimeSeconds,
          notes: sub.notes,
        }, index); // Pasar el índice como el nuevo orden
      });
    } else {
      // Create new goal in backend
      // Mapear categorías del frontend al backend
      const categoryMap: Record<string, string> = {
        daily: 'diario',
        weekly: 'semanal',
        monthly: 'mensual',
        yearly: 'anual',
        general: 'general'
      };
      
      const createPayload: Record<string, unknown> = {
        title: data.title,
      };
      
      if (data.description) createPayload.descripcion = data.description;
      if (data.category) createPayload.categoria = categoryMap[data.category] || data.category;
      if (data.priority) createPayload.prioridad = data.priority;
      if (data.recurring !== undefined) createPayload.recurrente = data.recurring;
      if (data.dayPart && data.dayPart !== 'none') createPayload.parte_dia = data.dayPart;
      if (data.estimatedHours) createPayload.horas_estimadas = parseInt(data.estimatedHours);
      if (data.reward) createPayload.recompensa = data.reward;
      if (data.isParent !== undefined) createPayload.es_padre = data.isParent;
      if (data.parentGoalId) createPayload.objetivo_padre_id = data.parentGoalId;
      if (data.startDate) createPayload.fecha_inicio = data.startDate;
      if (data.endDate) createPayload.fecha_fin = data.endDate;
      if (data.scheduledType === 'specific' && data.scheduledDate) createPayload.programado_para = data.scheduledDate;
      
      try {
        const createdGoal = await goalsAPI.createGoal(createPayload);
        console.log('✅ Goal created:', createdGoal);
        
        // Crear subobjetivos nuevos en el backend
        const newSubGoals: SubGoal[] = [];
        for (let i = 0; i < data.subGoals.length; i++) {
          const subGoal = data.subGoals[i];
          if (subGoal.id.startsWith('new-')) {
            try {
              const createdSubGoal = await goalsAPI.createSubGoal(createdGoal.id, {
                titulo: subGoal.title,
                completado: subGoal.completed || false,
                notas: subGoal.notes || null,
                orden: i, // Guardar el índice como orden
              });
              console.log('✅ SubGoal created:', createdSubGoal);
              newSubGoals.push({
                id: createdSubGoal.id,
                title: subGoal.title,
                completed: subGoal.completed || false,
                notes: subGoal.notes,
              });
            } catch (subError) {
              console.error('❌ Error creating subgoal:', subError);
            }
          } else {
            newSubGoals.push(subGoal);
          }
        }
        
        const newGoal: Goal = {
          id: createdGoal.id,
          title: data.title,
          description: data.description || undefined,
          category: data.category,
          priority: data.priority,
          recurring: data.recurring,
          dayPart: data.dayPart === 'none' ? undefined : data.dayPart,
          estimatedHours: data.estimatedHours ? parseInt(data.estimatedHours) : undefined,
          estimatedMinutes: data.estimatedMinutes ? parseInt(data.estimatedMinutes) : undefined,
          reward: data.reward || undefined,
          isParent: data.isParent,
          parentGoalId: data.parentGoalId || undefined,
          startDate: data.startDate || undefined,
          endDate: data.endDate || undefined,
          subGoals: newSubGoals,
          completed: false,
          skipped: false,
          createdAt: createdGoal.fecha_creacion || new Date().toISOString(),
          scheduledFor: data.scheduledType === 'specific' ? data.scheduledDate : undefined,
        };
        setGoals(prev => [newGoal, ...prev]);
        
        // Recargar objetivos desde BD para sincronizar
        setTimeout(async () => {
          try {
            const response = await goalsAPI.getGoals(1, 100);
            setGoals(response.items || []);
            console.log('✅ Goals reloaded from DB');
          } catch (reloadError) {
            console.warn('Could not reload goals:', reloadError);
          }
        }, 500);
        
      } catch (error) {
        console.error('❌ Error creating goal:', error);
        alert(`Error al crear objetivo: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };

  const handleOpenGoalFocus = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    setFocusGoal(goal);
    setGoalFocusOpen(true);
  };

  const handleOpenSubGoalFocusFromGoal = (subGoalId: string) => {
    if (!focusGoal) return;

    const subGoal = focusGoal.subGoals.find(s => s.id === subGoalId);
    if (!subGoal) return;

    // Usar focusGoal actualizado como parent
    setFocusParentGoal(focusGoal);
    setFocusSubGoal(subGoal);
    setGoalFocusOpen(false);
    setFocusModalOpen(true);
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      await goalsAPI.deleteGoal(goalId);
      setGoals(prev => prev.filter(g => g.id !== goalId));
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const handleFocusSubGoal = (goalId: string, subGoalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    
    const subGoal = goal.subGoals.find(s => s.id === subGoalId);
    if (!subGoal) return;
    
    setFocusParentGoal(goal);
    setFocusSubGoal(subGoal);
    setFocusModalOpen(true);
  };

  const persistSubGoalUpdate = async (subGoalId: string, updates: Partial<SubGoal>, orden?: number) => {
    const payload: Record<string, unknown> = {};
    if (typeof updates.title === 'string') payload.titulo = updates.title;
    if (typeof updates.completed === 'boolean') payload.completado = updates.completed;
    if (typeof updates.focusTimeSeconds === 'number') payload.tiempo_focus = updates.focusTimeSeconds;
    if (typeof updates.notes === 'string') payload.notas = updates.notes;
    if (typeof orden === 'number') payload.orden = orden;
    if (Object.keys(payload).length === 0) return;

    try {
      await goalsAPI.updateSubGoal(subGoalId, payload);
    } catch (error) {
      console.error('❌ Error updating subgoal:', subGoalId, error);
    }
  };

  const handleSaveGoalFocusProgress = (goalId: string, updates: { subGoals: SubGoal[]; focusTimeSeconds: number; focusNotes: string }) => {
    setGoals(prev => prev.map(g =>
      g.id === goalId
        ? {
            ...g,
            subGoals: updates.subGoals,
            focusTimeSeconds: updates.focusTimeSeconds,
            focusNotes: updates.focusNotes,
          }
        : g
    ));

    setFocusGoal(prev => prev && prev.id === goalId
      ? {
          ...prev,
          subGoals: updates.subGoals,
          focusTimeSeconds: updates.focusTimeSeconds,
          focusNotes: updates.focusNotes,
        }
      : prev
    );

    updates.subGoals.forEach((sub, index) => {
      void persistSubGoalUpdate(sub.id, {
        completed: sub.completed,
        focusTimeSeconds: sub.focusTimeSeconds,
        notes: sub.notes,
      }, index); // Pasar el índice como el nuevo orden
    });
  };

  const handleCompleteGoalFromFocus = (goalId: string) => {
    setGoals(prev => prev.map(g =>
      g.id === goalId
        ? { ...g, completed: true, completedAt: new Date().toISOString() }
        : g
    ));
  };

  const handleSaveFocusProgress = (subGoalId: string, updates: Partial<SubGoal>) => {
    if (!focusParentGoal) return;
    
    setGoals(prev => prev.map(g => 
      g.id === focusParentGoal.id
        ? {
            ...g,
            subGoals: g.subGoals.map(s =>
              s.id === subGoalId ? { ...s, ...updates } : s
            )
          }
        : g
    ));
    
    // Actualizar también el estado local del subobjetivo en focus
    if (focusSubGoal && focusSubGoal.id === subGoalId) {
      setFocusSubGoal(prev => prev ? { ...prev, ...updates } : null);
    }

    void persistSubGoalUpdate(subGoalId, updates);
  };

  const handleCompleteSubGoal = (subGoalId: string) => {
    if (!focusParentGoal) return;
    
    setGoals(prev => prev.map(g => 
      g.id === focusParentGoal.id
        ? {
            ...g,
            subGoals: g.subGoals.map(s =>
              s.id === subGoalId 
                ? { ...s, completed: true, completedAt: new Date().toISOString() } 
                : s
            ).sort((a, b) => {
              // Ordenar: no completados primero, completados al final
              if (a.completed !== b.completed) return a.completed ? 1 : -1;
              return 0;
            })
          }
        : g
    ));

    void persistSubGoalUpdate(subGoalId, { completed: true });
  };

  const handleToggleSubGoal = (subGoalId: string) => {
    setGoals(prev => prev.map(g => ({
      ...g,
      subGoals: g.subGoals.map(s => {
        if (s.id === subGoalId) {
          const newCompleted = !s.completed;
          return { 
            ...s, 
            completed: newCompleted,
            completedAt: newCompleted ? new Date().toISOString() : undefined
          };
        }
        return s;
      }).sort((a, b) => {
        // Ordenar: no completados primero, completados al final
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return 0;
      })
    })));

    // Encontrar el subobjetivo para obtener su estado anterior
    const subGoal = goals.flatMap(g => g.subGoals).find(s => s.id === subGoalId);
    if (subGoal) {
      void persistSubGoalUpdate(subGoalId, { completed: !subGoal.completed });
    }
  };

  const sorted = [...filtered].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.priority !== b.priority) {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    }
    return 0;
  });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Objetivos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestiona tus metas y haz seguimiento de tu progreso</p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors self-start"
        >
          <Plus className="h-4 w-4" />
          Nuevo Objetivo
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <MetricCard title="Diarios" value={completedOf(daily)} icon={Circle} color="success" subtitle="Hoy" />
        <MetricCard title="Semanales" value={completedOf(weekly)} icon={TrendingUp} color="primary" subtitle="Esta semana" />
        <MetricCard title="Mensuales" value={completedOf(monthly)} icon={Target} color="warning" subtitle="Este mes" />
        <MetricCard title="Anuales" value={completedOf(yearly)} icon={CheckCircle2} color="destructive" subtitle="Este año" />
      </div>

      {/* Tabs + Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent'}`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Goals Grid */}
      <div className={viewMode === 'grid'
        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
        : 'space-y-3'
      }>
        {sorted.map(goal => (
          <GoalCard 
            key={goal.id} 
            goal={goal} 
            onToggle={handleToggle} 
            onEdit={handleEdit}
            onFocusGoal={handleOpenGoalFocus}
            onDelete={handleDeleteGoal}
            onToggleSubGoal={handleToggleSubGoal}
          />
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Target className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">No hay objetivos en esta categoría</p>
          <p className="text-xs text-muted-foreground mt-1">Crea tu primer objetivo para empezar</p>
        </div>
      )}

      {/* Modal */}
      <GoalModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        goal={editingGoal}
        goals={goals}
        onSave={handleSave}
      />

      <GoalFocusModal
        open={goalFocusOpen}
        onOpenChange={setGoalFocusOpen}
        goal={focusGoal}
        onSave={handleSaveGoalFocusProgress}
        onComplete={handleCompleteGoalFromFocus}
        onOpenSubGoalFocus={handleOpenSubGoalFocusFromGoal}
      />

      {/* Focus Modal */}
      <FocusModal
        open={focusModalOpen}
        onOpenChange={async (open) => {
          if (!open && focusParentGoal) {
            // Abrir el GoalFocusModal PRIMERO (instantáneamente)
            setGoalFocusOpen(true);
            // Luego cerrar el FocusModal
            setFocusModalOpen(false);
            
            // Mientras tanto, refrescar datos en background
            try {
              const subgoalsData = await goalsAPI.getSubGoals(focusParentGoal.id);
              const mappedSubgoals = subgoalsData
                .map((sub: any): SubGoal => ({
                  id: sub.id.toString(),
                  title: sub.titulo,
                  completed: sub.completado || false,
                  notes: sub.notas || undefined,
                  completedAt: sub.fecha_completado || undefined,
                  priority: undefined,
                  focusTimeSeconds: sub.tiempo_focus || 0,
                }))
                .sort((a, b) => {
                  const orderA = subgoalsData.find((s: any) => s.id.toString() === a.id)?.orden || 0;
                  const orderB = subgoalsData.find((s: any) => s.id.toString() === b.id)?.orden || 0;
                  return orderA - orderB;
                });
              
              const updatedParent = { ...focusParentGoal, subGoals: mappedSubgoals };
              setFocusGoal(updatedParent);
            } catch (error) {
              console.warn('Could not refresh subgoals:', error);
              const updatedParent = goals.find(g => g.id === focusParentGoal.id) || focusParentGoal;
              setFocusGoal(updatedParent);
            }
          } else {
            setFocusModalOpen(open);
          }
        }}
        subGoal={focusSubGoal}
        parentGoal={focusParentGoal}
        onSave={handleSaveFocusProgress}
        onComplete={handleCompleteSubGoal}
      />
    </div>
  );
}
