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
  const [activeTab, setActiveTab] = useState<GoalCategory | 'all'>('all');
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
              const mappedSubgoals = subgoalsData.map((sub: any): SubGoal => ({
                id: sub.id.toString(),
                title: sub.titulo,
                completed: sub.completado || false,
                notes: sub.notas || undefined,
                completedAt: sub.fecha_completado || undefined,
                priority: undefined, // Los subobjetivos no tienen prioridad en  la tabla subobjetivos
                focusTimeSeconds: sub.tiempo_focus || 0,
              }));
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

  const filtered = activeTab === 'all' ? goals : goals.filter(g => g.category === activeTab);
  const daily = goals.filter(g => g.category === 'daily');
  const weekly = goals.filter(g => g.category === 'weekly');
  const monthly = goals.filter(g => g.category === 'monthly');
  const yearly = goals.filter(g => g.category === 'yearly');

  const completedOf = (arr: typeof goals) => `${arr.filter(g => g.completed).length}/${arr.length}`;

  const handleToggle = (id: string) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !g.completed, completedAt: !g.completed ? new Date().toISOString() : undefined } : g));
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

  const handleSave = (data: any) => {
    if (editingGoal) {
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
    } else {
      const newGoal: Goal = {
        id: `new-${Date.now()}`,
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
        subGoals: data.subGoals,
        completed: false,
        skipped: false,
        createdAt: new Date().toISOString(),
        scheduledFor: data.scheduledType === 'specific' ? data.scheduledDate : undefined,
      };
      setGoals(prev => [newGoal, ...prev]);
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

    setFocusParentGoal(focusGoal);
    setFocusSubGoal(subGoal);
    setGoalFocusOpen(false);
    setFocusModalOpen(true);
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
        onOpenChange={(open) => {
          setFocusModalOpen(open);
          if (!open && focusParentGoal) {
            const updatedParent = goals.find(g => g.id === focusParentGoal.id) || focusParentGoal;
            setFocusGoal(updatedParent);
            setGoalFocusOpen(true);
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
