import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import {
  ChevronDown, ChevronLeft, ChevronRight, Plus, Sun, Sunset, Moon,
  CheckCircle2, Circle, Settings2, X, Pencil, Trash2, BookOpen, SkipForward,
} from 'lucide-react';
import { getLocalDateString } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { goalsAPI, rutinasAPI } from '@/services/api';
import type { Rutina, RutinaAsignacion, DiaSemana } from '@/services/api';
import RutinaModal from '@/components/rutina/RutinaModal';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ── Constantes ────────────────────────────────────────────────────────────────

const PARTES = [
  { value: 'morning', label: 'Mañana', icon: Sun, colorClass: 'text-amber-500', bgClass: 'bg-amber-500/10' },
  { value: 'afternoon', label: 'Tarde', icon: Sunset, colorClass: 'text-orange-500', bgClass: 'bg-orange-500/10' },
  { value: 'evening', label: 'Noche', icon: Moon, colorClass: 'text-indigo-500', bgClass: 'bg-indigo-500/10' },
] as const;

const COLOR_BG: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  purple: 'bg-purple-500',
  red: 'bg-red-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
};

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_LABELS_ASCII = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// ── Helpers de fecha ──────────────────────────────────────────────────────────

const getMonday = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

const addDays = (date: Date, n: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const toISODate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatWeekLabel = (start: Date): string => {
  const end = addDays(start, 6);
  return `${start.getDate()} ${MONTH_NAMES[start.getMonth()]} — ${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
};

const isToday = (isoDate: string): boolean => toISODate(new Date()) === isoDate;

// ── Helpers de calendario mensual ─────────────────────────────────────────────

const buildMonthCalendar = (month: Date): Date[] => {
  const y = month.getFullYear();
  const m = month.getMonth();
  const firstOfMonth = new Date(y, m, 1);
  const lastOfMonth = new Date(y, m + 1, 0);
  const startDay = getMonday(firstOfMonth);
  const endDow = lastOfMonth.getDay();
  const endDay = addDays(lastOfMonth, endDow === 0 ? 0 : 7 - endDow);
  const days: Date[] = [];
  let d = startDay;
  while (d <= endDay) {
    days.push(d);
    d = addDays(d, 1);
  }
  return days;
};

// ── Componente ────────────────────────────────────────────────────────────────

export default function RutinaPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [semana, setSemana] = useState<DiaSemana[]>([]);
  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [loading, setLoading] = useState(true);

  // Historial
  const [activeView, setActiveView] = useState<'semana' | 'historial'>('semana');
  const [historialMonth, setHistorialMonth] = useState<Date>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [historialData, setHistorialData] = useState<RutinaAsignacion[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [skippedGoalsByDate, setSkippedGoalsByDate] = useState<Record<string, Set<string>>>({});
  const [skippedGoalReasonByDate, setSkippedGoalReasonByDate] = useState<Record<string, Record<string, string>>>({});
  const [completedGoalsByDate, setCompletedGoalsByDate] = useState<Record<string, Set<string>>>({});
  const [skippedSubGoalsByDate, setSkippedSubGoalsByDate] = useState<Record<string, Set<string>>>({});
  const [subGoalsByGoalId, setSubGoalsByGoalId] = useState<Record<number, Array<{ id: number; titulo: string; completado: boolean }>>>({});

  // Modal crear/editar rutina
  const [showRutinaModal, setShowRutinaModal] = useState(false);
  const [editingRutina, setEditingRutina] = useState<Rutina | null>(null);
  const [defaultParteDia, setDefaultParteDia] = useState<string>('morning');

  // Picker de asignación (selector de rutina para una celda)
  const [picker, setPicker] = useState<{ fecha: string; parte_dia: string } | null>(null);

  // Detalle de asignación expandido
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingAssignmentGoals, setEditingAssignmentGoals] = useState<RutinaAsignacion | null>(null);
  const [assignmentGoalDraft, setAssignmentGoalDraft] = useState<Set<number>>(new Set());
  const [assignmentSkippedGoalDraft, setAssignmentSkippedGoalDraft] = useState<Set<number>>(new Set());
  const [assignmentSkipReasonDraft, setAssignmentSkipReasonDraft] = useState<Record<number, string>>({});
  const [assignmentSkipReasonOriginal, setAssignmentSkipReasonOriginal] = useState<Record<number, string>>({});
  const [assignmentSkipDialogGoal, setAssignmentSkipDialogGoal] = useState<{ id: number; title: string } | null>(null);
  const [assignmentSkipDialogStep, setAssignmentSkipDialogStep] = useState<'choice' | 'reason'>('choice');
  const [assignmentSkipDialogReason, setAssignmentSkipDialogReason] = useState('');
  const [savingAssignmentGoals, setSavingAssignmentGoals] = useState(false);

  // Confirmar eliminar rutina
  const [deletingRutinaId, setDeletingRutinaId] = useState<number | null>(null);

  // Filtro de categoría en biblioteca
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const loadSkippedGoalsForDates = useCallback(async (dates: string[]) => {
    const uniqueDates = [...new Set(dates)];
    if (uniqueDates.length === 0) return;

    try {
      const results = await Promise.all(
        uniqueDates.map(async (date) => ({
          date,
          details: await goalsAPI.getSkippedGoalsDetails(date),
        }))
      );

      setSkippedGoalsByDate(prev => {
        const next = { ...prev };
        results.forEach(({ date, details }) => {
          next[date] = new Set(details.map(item => item.goal_id.toString()));
        });
        return next;
      });
      setSkippedGoalReasonByDate(prev => {
        const next = { ...prev };
        results.forEach(({ date, details }) => {
          next[date] = details.reduce<Record<string, string>>((acc, item) => {
            if (item.reason) acc[item.goal_id.toString()] = item.reason;
            return acc;
          }, {});
        });
        return next;
      });
    } catch (error) {
      console.error('Error loading skipped goals for rutina view:', error);
    }
  }, []);

  const loadCompletedGoalsForDates = useCallback(async (dates: string[]) => {
    const uniqueDates = [...new Set(dates)];
    if (uniqueDates.length === 0) return;

    try {
      const results = await Promise.all(
        uniqueDates.map(async (date) => ({
          date,
          entries: await goalsAPI.getCompletedGoals(date),
        }))
      );

      setCompletedGoalsByDate(prev => {
        const next = { ...prev };
        results.forEach(({ date, entries }) => {
          next[date] = new Set(entries.map(entry => entry.goal_id.toString()));
        });
        return next;
      });
    } catch (error) {
      console.error('Error loading completed goals for rutina view:', error);
    }
  }, []);

  const loadSkippedSubGoalsForDates = useCallback(async (dates: string[]) => {
    const uniqueDates = [...new Set(dates)];
    if (uniqueDates.length === 0) return;

    try {
      const results = await Promise.all(
        uniqueDates.map(async (date) => ({
          date,
          ids: await goalsAPI.getSkippedSubGoals(date),
        }))
      );

      setSkippedSubGoalsByDate(prev => {
        const next = { ...prev };
        results.forEach(({ date, ids }) => {
          next[date] = new Set(ids.map(id => id.toString()));
        });
        return next;
      });
    } catch (error) {
      console.error('Error loading skipped subgoals for rutina view:', error);
    }
  }, []);

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const fetchSemana = useCallback(async (start: Date) => {
    setLoading(true);
    try {
      const data = await rutinasAPI.getSemana(toISODate(start));
      setSemana(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRutinas = useCallback(async () => {
    try {
      const data = await rutinasAPI.getRutinas();
      setRutinas(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchRutinas();
  }, []);

  useEffect(() => {
    fetchSemana(weekStart);
  }, [weekStart]);

  useEffect(() => {
    loadSkippedGoalsForDates(weekDates.map(toISODate));
    loadCompletedGoalsForDates(weekDates.map(toISODate));
    loadSkippedSubGoalsForDates(weekDates.map(toISODate));
  }, [weekStart, loadSkippedGoalsForDates, loadCompletedGoalsForDates, loadSkippedSubGoalsForDates]);

  useEffect(() => {
    if (activeView !== 'historial') return;
    const y = historialMonth.getFullYear();
    const m = historialMonth.getMonth();
    const fechaDesde = toISODate(new Date(y, m, 1));
    const fechaHasta = toISODate(new Date(y, m + 1, 0));
    setHistorialLoading(true);
    rutinasAPI.getHistorial(fechaDesde, fechaHasta)
      .then(setHistorialData)
      .catch(console.error)
      .finally(() => setHistorialLoading(false));

    const datesInMonth = buildMonthCalendar(historialMonth).map(toISODate);
    loadSkippedGoalsForDates(datesInMonth);
    loadCompletedGoalsForDates(datesInMonth);
    loadSkippedSubGoalsForDates(datesInMonth);
  }, [activeView, historialMonth, loadSkippedGoalsForDates, loadCompletedGoalsForDates, loadSkippedSubGoalsForDates]);

  // ── Helpers de estado local ─────────────────────────────────────────────────

  const getAsignaciones = (fecha: string, parte_dia: string): RutinaAsignacion[] =>
    (semana.find(d => d.fecha === fecha)?.asignaciones ?? [])
      .filter(a => a.parte_dia === parte_dia)
      .sort((a, b) => a.id - b.id);

  const updateSemanaLocal = (asignacion: RutinaAsignacion) => {
    setSemana(prev => prev.map(dia => {
      if (dia.fecha !== asignacion.fecha) return dia;
      const existing = dia.asignaciones.find(a => a.id === asignacion.id);
      return {
        ...dia,
        asignaciones: existing
          ? dia.asignaciones.map(a => a.id === asignacion.id ? asignacion : a)
          : [...dia.asignaciones, asignacion],
      };
    }));
  };

  const removeAsignacionLocal = (asignacionId: number) => {
    setSemana(prev => prev.map(dia => ({
      ...dia,
      asignaciones: dia.asignaciones.filter(a => a.id !== asignacionId),
    })));
  };

  const isGoalSkippedOnDate = (goalId: number, fecha: string) =>
    skippedGoalsByDate[fecha]?.has(goalId.toString()) ?? false;

  const isGoalCompletedOnDate = (goalId: number, fecha: string) =>
    completedGoalsByDate[fecha]?.has(goalId.toString()) ?? false;

  const isSubGoalSkippedOnDate = (subGoalId: number, fecha: string) =>
    skippedSubGoalsByDate[fecha]?.has(subGoalId.toString()) ?? false;

  const isGoalSkippedByAllSubGoalsOnDate = (goalId: number, fecha: string) => {
    const subGoals = subGoalsByGoalId[goalId] ?? [];
    if (subGoals.length === 0) return false;
    return subGoals.every(sub => isSubGoalSkippedOnDate(sub.id, fecha));
  };

  const getGoalStatusOnDate = (goalId: number, fecha: string): 'completed' | 'skipped' | 'pending' => {
    if (isGoalCompletedOnDate(goalId, fecha)) return 'completed';
    if (isGoalSkippedOnDate(goalId, fecha) || isGoalSkippedByAllSubGoalsOnDate(goalId, fecha)) return 'skipped';
    return 'pending';
  };

  const getGoalSkipReasonOnDate = (goalId: number, fecha: string) =>
    skippedGoalReasonByDate[fecha]?.[goalId.toString()];

  const getGoalsForAssignment = (asignacion: RutinaAsignacion) => {
    const allGoals = asignacion.rutina.objetivos ?? [];
    if (!asignacion.objetivo_ids || asignacion.objetivo_ids.length === 0) {
      return allGoals;
    }
    const goalById = new Map(allGoals.map(goal => [goal.id, goal]));
    return asignacion.objetivo_ids
      .map(goalId => goalById.get(goalId))
      .filter((goal): goal is (typeof allGoals)[number] => Boolean(goal));
  };

  const openAssignmentGoalEditor = async (asignacion: RutinaAsignacion) => {
    const goals = getGoalsForAssignment(asignacion);
    const completedSet = completedGoalsByDate[asignacion.fecha] ?? new Set<string>();
    const completedIds = goals
      .filter(goal => completedSet.has(goal.id.toString()))
      .map(goal => goal.id);
    setAssignmentGoalDraft(new Set(completedIds));
    try {
      const skippedEntries = await goalsAPI.getSkippedGoalsDetails(asignacion.fecha);
      const skippedIds = new Set(
        goals
          .filter(goal => skippedEntries.some(entry => entry.goal_id === goal.id))
          .map(goal => goal.id)
      );
      const reasonMap = skippedEntries.reduce<Record<number, string>>((acc, entry) => {
        if (goals.some(goal => goal.id === entry.goal_id) && entry.reason) {
          acc[entry.goal_id] = entry.reason;
        }
        return acc;
      }, {});
      setAssignmentSkippedGoalDraft(skippedIds);
      setAssignmentSkipReasonDraft(reasonMap);
      setAssignmentSkipReasonOriginal(reasonMap);
    } catch (error) {
      console.error('Error loading skipped goals for assignment editor:', error);
      setAssignmentSkippedGoalDraft(new Set());
      setAssignmentSkipReasonDraft({});
      setAssignmentSkipReasonOriginal({});
    }
    setEditingAssignmentGoals(asignacion);
  };

  const getAssignmentGoalDraftStatus = (goalId: number): 'completed' | 'skipped' | 'pending' => {
    if (assignmentGoalDraft.has(goalId)) return 'completed';
    if (assignmentSkippedGoalDraft.has(goalId)) return 'skipped';
    return 'pending';
  };

  const applyAssignmentGoalSkipped = (goalId: number, reason?: string) => {
    setAssignmentGoalDraft(prev => {
      const next = new Set(prev);
      next.delete(goalId);
      return next;
    });
    setAssignmentSkippedGoalDraft(prev => new Set(prev).add(goalId));
    setAssignmentSkipReasonDraft(prev => {
      const next = { ...prev };
      if (reason?.trim()) next[goalId] = reason.trim();
      else delete next[goalId];
      return next;
    });
  };

  const clearAssignmentGoalStatus = (goalId: number) => {
    setAssignmentGoalDraft(prev => {
      const next = new Set(prev);
      next.delete(goalId);
      return next;
    });
    setAssignmentSkippedGoalDraft(prev => {
      const next = new Set(prev);
      next.delete(goalId);
      return next;
    });
    setAssignmentSkipReasonDraft(prev => {
      const next = { ...prev };
      delete next[goalId];
      return next;
    });
  };

  const closeAssignmentSkipDialog = () => {
    setAssignmentSkipDialogGoal(null);
    setAssignmentSkipDialogStep('choice');
    setAssignmentSkipDialogReason('');
  };

  const confirmAssignmentSkipWithoutReason = () => {
    if (!assignmentSkipDialogGoal) return;
    applyAssignmentGoalSkipped(assignmentSkipDialogGoal.id);
    closeAssignmentSkipDialog();
  };

  const confirmAssignmentSkipWithReason = () => {
    if (!assignmentSkipDialogGoal) return;
    applyAssignmentGoalSkipped(assignmentSkipDialogGoal.id, assignmentSkipDialogReason);
    closeAssignmentSkipDialog();
  };

  const handleSaveAssignmentGoals = async () => {
    if (!editingAssignmentGoals) return;

    const goals = getGoalsForAssignment(editingAssignmentGoals);
    if (goals.length === 0) return;

    const targetDate = editingAssignmentGoals.fecha || getLocalDateString();
    const currentCompletedSet = completedGoalsByDate[targetDate] ?? new Set<string>();
    const desiredCompletedSet = new Set(Array.from(assignmentGoalDraft).map(id => id.toString()));
    const currentSkippedSet = skippedGoalsByDate[targetDate] ?? new Set<string>();
    const desiredSkippedSet = new Set(Array.from(assignmentSkippedGoalDraft).map(id => id.toString()));

    setSavingAssignmentGoals(true);
    try {
      const goalOps: Array<Promise<unknown>> = [];
      goals.forEach(goal => {
        const goalId = goal.id.toString();
        const isCurrentlyCompleted = currentCompletedSet.has(goalId);
        const shouldBeCompleted = desiredCompletedSet.has(goalId);
        const isCurrentlySkipped = currentSkippedSet.has(goalId);
        const shouldBeSkipped = desiredSkippedSet.has(goalId);
        const nextSkipReason = assignmentSkipReasonDraft[goal.id]?.trim() || undefined;
        const originalSkipReason = assignmentSkipReasonOriginal[goal.id]?.trim() || undefined;

        if (shouldBeCompleted) {
          if (isCurrentlySkipped) goalOps.push(goalsAPI.unskipGoalForDate(goal.id, targetDate));
          if (!isCurrentlyCompleted) goalOps.push(goalsAPI.completeGoalForDate(goal.id, targetDate));
          return;
        }

        if (shouldBeSkipped) {
          if (isCurrentlyCompleted) goalOps.push(goalsAPI.uncompleteGoalForDate(goal.id, targetDate));
          if (!isCurrentlySkipped || nextSkipReason !== originalSkipReason) {
            goalOps.push(goalsAPI.skipGoalForDate(goal.id, targetDate, nextSkipReason));
          }
          return;
        }

        if (isCurrentlyCompleted) goalOps.push(goalsAPI.uncompleteGoalForDate(goal.id, targetDate));
        if (isCurrentlySkipped) goalOps.push(goalsAPI.unskipGoalForDate(goal.id, targetDate));
      });

      const operationResults = await Promise.allSettled(goalOps);
      const failedOperations = operationResults.filter(result => result.status === 'rejected').length;

      let refreshedCompletedSet = desiredCompletedSet;
      let refreshedSkippedSet = desiredSkippedSet;
      try {
        const [completedEntries, skippedEntries] = await Promise.all([
          goalsAPI.getCompletedGoals(targetDate),
          goalsAPI.getSkippedGoalsDetails(targetDate),
        ]);
        refreshedCompletedSet = new Set(completedEntries.map(entry => entry.goal_id.toString()));
        refreshedSkippedSet = new Set(skippedEntries.map(entry => entry.goal_id.toString()));
        setCompletedGoalsByDate(prev => ({
          ...prev,
          [targetDate]: refreshedCompletedSet,
        }));
        setSkippedGoalsByDate(prev => ({
          ...prev,
          [targetDate]: refreshedSkippedSet,
        }));
      } catch (refreshError) {
        console.error('Error refreshing assignment goal states after update:', refreshError);
        setCompletedGoalsByDate(prev => ({
          ...prev,
          [targetDate]: refreshedCompletedSet,
        }));
        setSkippedGoalsByDate(prev => ({
          ...prev,
          [targetDate]: refreshedSkippedSet,
        }));
      }

      const allGoalsDone = goals.length > 0 && goals.every(goal => refreshedCompletedSet.has(goal.id.toString()));
      if (editingAssignmentGoals.completada !== allGoalsDone) {
        const updatedAssignment = await rutinasAPI.updateAsignacion(editingAssignmentGoals.id, {
          completada: allGoalsDone,
        });
        updateSemanaLocal(updatedAssignment);
      }

      setEditingAssignmentGoals(null);

      if (failedOperations > 0) {
        toast({
          title: 'Actualización parcial',
          description: `Se aplicaron cambios, pero ${failedOperations} objetivo(s) no se pudo/pudieron sincronizar.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Objetivos actualizados',
          description: `${assignmentGoalDraft.size} completado(s), ${assignmentSkippedGoalDraft.size} saltado(s).`,
        });
      }
    } catch (error) {
      console.error('Error updating assignment goals:', error);
      toast({
        title: 'No se pudo guardar',
        description: 'Ocurrió un error al actualizar el estado de los objetivos de esta asignación.',
        variant: 'destructive',
      });
    } finally {
      setSavingAssignmentGoals(false);
    }
  };

  const fetchSubGoalsForGoal = useCallback(async (goalId: number) => {
    try {
      const subGoals = await goalsAPI.getSubGoals(goalId);
      setSubGoalsByGoalId(prev => ({
        ...prev,
        [goalId]: Array.isArray(subGoals)
          ? subGoals.map((sub: any) => ({
              id: Number(sub.id),
              titulo: sub.titulo,
              completado: Boolean(sub.completado),
            }))
          : [],
      }));
    } catch (error) {
      console.error(`Error loading subgoals for goal ${goalId}:`, error);
      setSubGoalsByGoalId(prev => ({ ...prev, [goalId]: [] }));
    }
  }, []);

  useEffect(() => {
    if (expandedId === null) return;

    const assignment = semana
      .flatMap(dia => dia.asignaciones)
      .find(item => item.id === expandedId);

    if (!assignment) return;

    getGoalsForAssignment(assignment).forEach((goal) => {
      if (subGoalsByGoalId[goal.id] !== undefined) return;
      void fetchSubGoalsForGoal(goal.id);
    });
  }, [expandedId, semana, subGoalsByGoalId, fetchSubGoalsForGoal]);

  useEffect(() => {
    const goalIds = Array.from(new Set(
      semana
        .flatMap(dia => dia.asignaciones)
        .flatMap(asig => getGoalsForAssignment(asig).map(goal => goal.id))
    ));

    goalIds.forEach((goalId) => {
      if (subGoalsByGoalId[goalId] !== undefined) return;
      void fetchSubGoalsForGoal(goalId);
    });
  }, [semana, subGoalsByGoalId, fetchSubGoalsForGoal]);

  const getAssignmentSkipStats = (asignacion: RutinaAsignacion, fecha: string) => {
    const goals = getGoalsForAssignment(asignacion);
    const totalGoals = goals.length;
    const skippedCount = goals.filter(g => getGoalStatusOnDate(g.id, fecha) === 'skipped').length;
    const isNeutralBySkips = totalGoals > 0 && skippedCount === totalGoals;
    return { totalGoals, skippedCount, isNeutralBySkips };
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const assignRutinaToSlot = async (rutinaId: number, fecha: string, parte_dia: string) => {
    try {
      const asignacion = await rutinasAPI.createAsignacion({
        fecha,
        parte_dia,
        rutina_id: rutinaId,
      });
      updateSemanaLocal(asignacion);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAsignar = async (rutinaId: number) => {
    if (!picker) return;
    await assignRutinaToSlot(rutinaId, picker.fecha, picker.parte_dia);
    setPicker(null);
  };

  const renderAssignmentCard = (asignacion: RutinaAsignacion, iso: string, skippedCount: number, isNeutralBySkips: boolean) => (
    <div className="h-full flex flex-col gap-1">
      <div
        className={`rounded-lg border border-border bg-background p-2 flex-1 cursor-pointer hover:shadow-sm transition-shadow ${
          asignacion.completada ? 'opacity-60' : ''
        }`}
        onClick={() => setExpandedId(expandedId === asignacion.id ? null : asignacion.id)}
      >
        <div className="flex items-start gap-1.5">
          <div className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLOR_BG[asignacion.rutina.color || 'blue']}`} />
          <p className={`text-[11px] font-medium leading-tight flex-1 min-w-0 truncate ${
            asignacion.completada ? 'line-through text-muted-foreground' : 'text-foreground'
          }`}>
            {asignacion.rutina.nombre}
          </p>
        </div>
        {getGoalsForAssignment(asignacion).length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1 pl-4">
            {getGoalsForAssignment(asignacion).length} objetivo{getGoalsForAssignment(asignacion).length !== 1 ? 's' : ''}
            {skippedCount > 0 && ` · ${skippedCount} saltado${skippedCount !== 1 ? 's' : ''}`}
          </p>
        )}
        {asignacion.rutina.duracion_proyectada_minutos ? (
          <p className="text-[10px] text-muted-foreground mt-1 pl-4">
            ⏱ {asignacion.rutina.duracion_proyectada_minutos} min proyectados
          </p>
        ) : null}
        {isNeutralBySkips && (
          <p className="text-[10px] text-amber-600 mt-1 pl-4 font-medium">
            Rutina nula hoy: todos los objetivos se saltaron
          </p>
        )}
        {asignacion.es_automatica && (
          <p className="text-[9px] text-primary mt-1 pl-4">Automatica</p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            openAssignmentGoalEditor(asignacion);
          }}
          title="Marcar objetivos específicos"
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button
          disabled={isNeutralBySkips}
          onClick={(e) => {
            e.stopPropagation();
            void handleToggleCompleta(asignacion);
          }}
          title={isNeutralBySkips ? 'No aplica: todos los objetivos de la rutina fueron saltados' : (asignacion.completada ? 'Marcar pendiente' : 'Marcar completada')}
          className={`flex-1 flex items-center justify-center p-1 rounded transition-colors ${
            isNeutralBySkips ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted'
          }`}
        >
          {asignacion.completada
            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            : <Circle className="h-3.5 w-3.5 text-muted-foreground" />
          }
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            void handleQuitarAsignacion(asignacion);
          }}
          title="Quitar asignación"
          className="p-1 rounded hover:bg-destructive/10 transition-colors"
        >
          <X className="h-3 w-3 text-destructive/60" />
        </button>
      </div>

      {expandedId === asignacion.id && getGoalsForAssignment(asignacion).length > 0 && (
        <div className="rounded-lg bg-muted/50 p-2 space-y-1 animate-fade-in">
          {getGoalsForAssignment(asignacion).map(g => {
            const goalStatus = getGoalStatusOnDate(g.id, iso);
            const goalSkipReason = getGoalSkipReasonOnDate(g.id, iso);
            const goalSubGoals = subGoalsByGoalId[g.id] ?? [];

            return (
              <div key={g.id} className="rounded-md border border-border/70 bg-background/70 px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] flex-shrink-0">{g.icono || '🎯'}</span>
                  <p className="text-[10px] text-foreground truncate flex-1">{g.titulo}</p>

                  {goalStatus === 'completed' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-1.5 py-0.5 text-[9px] font-medium text-green-600">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Completado
                    </span>
                  )}
                  {goalStatus === 'skipped' && (
                    <div className="flex flex-col items-end gap-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-600">
                        <SkipForward className="h-2.5 w-2.5" />
                        Saltado
                      </span>
                      {goalSkipReason ? (
                        <span className="max-w-[180px] text-right text-[9px] text-amber-700 dark:text-amber-300">
                          Motivo: {goalSkipReason}
                        </span>
                      ) : null}
                    </div>
                  )}
                  {goalStatus === 'pending' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] font-medium text-red-600">
                      <Circle className="h-2.5 w-2.5" />
                      Pendiente
                    </span>
                  )}
                </div>

                {goalSubGoals.length > 0 && (
                  <div className="mt-1.5 pl-4 space-y-1 border-l border-border/60">
                    {goalSubGoals.map(sub => {
                      const subSkipped = isSubGoalSkippedOnDate(sub.id, iso);
                      const subCompleted = sub.completado;
                      return (
                        <div key={sub.id} className="flex items-center gap-1.5">
                          <span className="text-[9px] text-muted-foreground">•</span>
                          <p className="text-[9px] text-foreground/90 truncate flex-1">{sub.titulo}</p>
                          {subCompleted ? (
                            <span className="text-[9px] font-medium text-green-600">Completado</span>
                          ) : subSkipped ? (
                            <span className="text-[9px] font-medium text-amber-600">Saltado</span>
                          ) : (
                            <span className="text-[9px] font-medium text-red-600">Pendiente</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const handleToggleCompleta = async (asignacion: RutinaAsignacion) => {
    const newCompleted = !asignacion.completada;
    try {
      const updated = await rutinasAPI.updateAsignacion(asignacion.id, {
        completada: newCompleted,
      });
      updateSemanaLocal(updated);

      // Sincronizar objetivos vinculados a la rutina en la fecha de la asignacion
      const targetDate = asignacion.fecha || getLocalDateString();
      const objetivos = getGoalsForAssignment(asignacion);
      const results = await Promise.allSettled(
        objetivos.map(obj =>
          newCompleted
            ? goalsAPI.completeGoalForDate(obj.id, targetDate)
            : goalsAPI.uncompleteGoalForDate(obj.id, targetDate)
        )
      );

      const syncedCount = results.filter(result => result.status === 'fulfilled').length;
      const failedCount = results.length - syncedCount;
      if (failedCount > 0) {
        console.warn('Some routine-linked goals could not be synced:', results);
        toast({
          title: 'Sincronización parcial',
          description: `${syncedCount} objetivo(s) actualizado(s), ${failedCount} con error.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: newCompleted ? 'Rutina completada' : 'Rutina desmarcada',
          description: `${syncedCount} objetivo(s) sincronizado(s).`,
        });
      }

      // Reflejar en UI de Rutina el estado completado por fecha sin esperar recarga
      setCompletedGoalsByDate(prev => {
        const next = { ...prev };
        const existing = new Set(next[targetDate] ?? []);
        objetivos.forEach(obj => {
          if (newCompleted) {
            existing.add(obj.id.toString());
          } else {
            existing.delete(obj.id.toString());
          }
        });
        next[targetDate] = existing;
        return next;
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleQuitarAsignacion = async (asignacion: RutinaAsignacion) => {
    try {
      await rutinasAPI.deleteAsignacion(asignacion.id);
      removeAsignacionLocal(asignacion.id);
      if (expandedId === asignacion.id) setExpandedId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const syncObjetivos = async (rutina: Rutina, newIds: number[]) => {
    const currentIds = (rutina.objetivos ?? []).map(g => g.id);
    const hasSameLength = currentIds.length === newIds.length;
    const hasSameOrder = hasSameLength && currentIds.every((id, index) => id === newIds[index]);
    if (hasSameOrder) return;

    for (const goalId of currentIds) {
      await rutinasAPI.removeObjetivo(rutina.id, goalId);
    }
    for (const goalId of newIds) {
      await rutinasAPI.addObjetivo(rutina.id, goalId);
    }
  };

  const handleSaveRutina = async (data: { nombre: string; parte_dia: string; color?: string; categoria?: string; descripcion?: string; duracion_proyectada_minutos?: number; dias_semana: number[]; objetivoIds: number[] }) => {
    const { objetivoIds, ...rutinaData } = data;
    if (editingRutina) {
      const updated = await rutinasAPI.updateRutina(editingRutina.id, rutinaData);
      await syncObjetivos(updated, objetivoIds);
      const fresh = await rutinasAPI.getRutinas();
      setRutinas(fresh);
      setSemana(prev => prev.map(dia => ({
        ...dia,
        asignaciones: dia.asignaciones.map(a =>
          a.rutina_id === updated.id ? { ...a, rutina: fresh.find(r => r.id === updated.id) ?? a.rutina } : a
        ),
      })));
      fetchSemana(weekStart);
    } else {
      const created = await rutinasAPI.createRutina(rutinaData);
      if (objetivoIds.length > 0) await syncObjetivos(created, objetivoIds);
      const fresh = await rutinasAPI.getRutinas();
      setRutinas(fresh);
      fetchSemana(weekStart);
    }
  };

  const handleDeleteRutina = async () => {
    if (deletingRutinaId === null) return;
    await rutinasAPI.deleteRutina(deletingRutinaId);
    setRutinas(prev => prev.filter(r => r.id !== deletingRutinaId));
    // Recargar semana por si alguna asignación usaba esa rutina
    fetchSemana(weekStart);
    setDeletingRutinaId(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const pickerRutinas = picker
    ? rutinas.filter(r => r.parte_dia === picker.parte_dia)
    : [];

  const filteredRutinas = useMemo(() => (
    rutinas.filter(rutina =>
      categoriaFilter === 'todas' ? true :
      categoriaFilter === 'sin_categoria' ? !rutina.categoria :
      rutina.categoria === categoriaFilter
    )
  ), [rutinas, categoriaFilter]);

  const groupedEntries = useMemo(() => {
    const groupedRutinas = filteredRutinas.reduce<Record<string, Rutina[]>>((acc, rutina) => {
      const key = rutina.categoria?.trim() || 'Sin categoría';
      if (!acc[key]) acc[key] = [];
      acc[key].push(rutina);
      return acc;
    }, {});

    return Object.entries(groupedRutinas).sort(([a], [b]) => {
      if (a === 'Sin categoría') return 1;
      if (b === 'Sin categoría') return -1;
      return a.localeCompare(b, 'es');
    });
  }, [filteredRutinas]);

  const rutinaCategoryOptions = useMemo(() => (
    Array.from(
      new Set(
        rutinas
          .map(rutina => rutina.categoria?.trim())
          .filter((categoria): categoria is string => Boolean(categoria))
      )
    ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
  ), [rutinas]);

  useEffect(() => {
    const keys = groupedEntries.map(([categoria]) => categoria);
    setCollapsedCategories(prev => {
      const next: Record<string, boolean> = {};
      keys.forEach((key) => {
        next[key] = prev[key] ?? true;
      });
      const sameLength = Object.keys(prev).length === Object.keys(next).length;
      const sameValues = sameLength && Object.keys(next).every((key) => prev[key] === next[key]);
      if (sameValues) return prev;
      return next;
    });
  }, [groupedEntries]);

  const parteOrder: Record<string, number> = {
    morning: 0,
    afternoon: 1,
    evening: 2,
  };

  return (
    <DragDropContext onDragEnd={() => {}}>
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Rutinas</h1>
          <p className="text-sm text-muted-foreground mt-1">Planifica y organiza tu día a día</p>
        </div>
        <button
          onClick={() => { setEditingRutina(null); setDefaultParteDia('morning'); setShowRutinaModal(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nueva Rutina
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-muted w-fit">
        <button
          onClick={() => setActiveView('semana')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeView === 'semana' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Semana
        </button>
        <button
          onClick={() => setActiveView('historial')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeView === 'historial' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Historial
        </button>
      </div>

      {/* Navegación de semana */}
      <div className={`flex items-center justify-between mb-4 ${activeView !== 'semana' ? 'hidden' : ''}`}>
        <button
          onClick={() => setWeekStart(prev => addDays(prev, -7))}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">{formatWeekLabel(weekStart)}</span>
          <button
            onClick={() => setWeekStart(getMonday(new Date()))}
            className="text-xs text-primary hover:underline"
          >
            Hoy
          </button>
        </div>
        <button
          onClick={() => setWeekStart(prev => addDays(prev, 7))}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Grid semanal */}
      <div className={`mb-8 rounded-xl border border-border bg-card overflow-hidden ${activeView !== 'semana' ? 'hidden' : ''}`}>
        {/* Cabecera de días */}
        <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-border">
          <div className="px-3 py-2" />
          {weekDates.map((date, i) => {
            const iso = toISODate(date);
            const today = isToday(iso);
            return (
              <div key={iso} className={`px-2 py-2 text-center border-l border-border ${today ? 'bg-primary/5' : ''}`}>
                <p className={`text-[11px] font-medium uppercase tracking-wide ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                  {DAY_NAMES[i]}
                </p>
                <p className={`text-sm font-semibold mt-0.5 ${today ? 'text-primary' : 'text-foreground'}`}>
                  {date.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Filas por parte del día */}
        {PARTES.map(({ value: parte, label, icon: Icon, colorClass, bgClass }) => (
          <div key={parte} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-border last:border-b-0">
            {/* Label fila */}
            <div className={`flex flex-col items-center justify-center gap-1 px-2 py-3 ${bgClass}`}>
              <Icon className={`h-4 w-4 ${colorClass}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${colorClass}`}>{label}</span>
            </div>

            {/* Celdas */}
            {weekDates.map(date => {
              const iso = toISODate(date);
              const asignaciones = getAsignaciones(iso, parte);
              const today = isToday(iso);

              return (
                <div
                  key={`${iso}-${parte}`}
                  className={`border-l border-border p-1.5 min-h-[80px] ${today ? 'bg-primary/5' : ''}`}
                >
                  <div className="space-y-1.5">
                    {asignaciones.map(asignacion => {
                      const stats = getAssignmentSkipStats(asignacion, iso);
                      return (
                        <div key={asignacion.id}>
                          {renderAssignmentCard(asignacion, iso, stats.skippedCount, stats.isNeutralBySkips)}
                        </div>
                      );
                    })}

                    <button
                      onClick={() => { setDefaultParteDia(parte); setPicker({ fecha: iso, parte_dia: parte }); }}
                      className={`w-full min-h-[44px] flex items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors ${asignaciones.length === 0 ? 'h-full min-h-[64px]' : ''}`}
                      title="Agregar rutina"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Vista Historial mensual */}
      {activeView === 'historial' && (
        <div className="mb-8">
          {/* Navegación de mes */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setHistorialMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-foreground capitalize">
              {historialMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => setHistorialMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Stats del mes */}
          {!historialLoading && (() => {
            const total = historialData.length;
            const completadas = historialData.filter(a => a.completada).length;
            const pct = total > 0 ? Math.round(completadas / total * 100) : 0;
            return (
              <div className="flex gap-4 mb-4 p-3 rounded-xl bg-muted/50 border border-border">
                <div className="text-center flex-1">
                  <p className="text-lg font-bold text-foreground">{total}</p>
                  <p className="text-[11px] text-muted-foreground">Asignadas</p>
                </div>
                <div className="w-px bg-border" />
                <div className="text-center flex-1">
                  <p className="text-lg font-bold text-green-500">{completadas}</p>
                  <p className="text-[11px] text-muted-foreground">Completadas</p>
                </div>
                <div className="w-px bg-border" />
                <div className="text-center flex-1">
                  <p className={`text-lg font-bold ${pct >= 70 ? 'text-green-500' : pct >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                    {pct}%
                  </p>
                  <p className="text-[11px] text-muted-foreground">Cumplimiento</p>
                </div>
              </div>
            );
          })()}

          {/* Calendario mensual */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Cabecera días */}
            <div className="grid grid-cols-7 border-b border-border">
              {DAY_NAMES.map(d => (
                <div key={d} className="py-2 text-center text-[11px] font-semibold text-muted-foreground uppercase">{d}</div>
              ))}
            </div>

            {historialLoading ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Cargando...</div>
            ) : (() => {
              const calDays = buildMonthCalendar(historialMonth);
              const asigByDate: Record<string, RutinaAsignacion[]> = {};
              historialData.forEach(a => {
                if (!asigByDate[a.fecha]) asigByDate[a.fecha] = [];
                asigByDate[a.fecha].push(a);
              });
              const weeks: Date[][] = [];
              for (let i = 0; i < calDays.length; i += 7) weeks.push(calDays.slice(i, i + 7));

              return (
                <div>
                  {weeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
                      {week.map(day => {
                        const iso = toISODate(day);
                        const inMonth = day.getMonth() === historialMonth.getMonth();
                        const dayAsigs = asigByDate[iso] || [];
                        const today = isToday(iso);
                        return (
                          <div
                            key={iso}
                            className={`p-1.5 min-h-[72px] border-r border-border last:border-r-0 ${
                              today ? 'bg-primary/5' : !inMonth ? 'bg-muted/30' : ''
                            }`}
                          >
                            <p className={`text-xs font-medium mb-1 ${
                              today ? 'text-primary font-bold' : !inMonth ? 'text-muted-foreground/30' : 'text-foreground'
                            }`}>
                              {day.getDate()}
                            </p>
                            <div className="space-y-0.5">
                              {dayAsigs.map(a => (
                                (() => {
                                  const stats = getAssignmentSkipStats(a, iso);
                                  return (
                                <div
                                  key={a.id}
                                  title={`${a.rutina.nombre}${stats.isNeutralBySkips ? ' · Rutina nula por objetivos saltados' : ''}`}
                                  className={`flex items-center gap-1 rounded px-1 py-0.5 ${
                                    stats.isNeutralBySkips
                                      ? 'bg-amber-500/15'
                                      : a.completada ? 'bg-green-500/15' : 'bg-red-500/10'
                                  }`}
                                >
                                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${COLOR_BG[a.rutina.color || 'blue']}`} />
                                  <p className="text-[9px] truncate text-foreground leading-tight flex-1">{a.rutina.nombre}</p>
                                  {stats.skippedCount > 0 && (
                                    <SkipForward className="h-2.5 w-2.5 text-amber-500 flex-shrink-0" />
                                  )}
                                  {!stats.isNeutralBySkips && a.completada && <CheckCircle2 className="h-2.5 w-2.5 text-green-500 flex-shrink-0" />}
                                </div>
                                  );
                                })()
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Biblioteca de rutinas */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Mis Rutinas</h2>
          <span className="text-xs text-muted-foreground">({rutinas.length})</span>
        </div>

        {/* Filtros de categoría */}
        {rutinas.length > 0 && (() => {
          const cats = Array.from(new Set(rutinas.map(r => r.categoria).filter(Boolean) as string[])).sort();
          if (cats.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setCategoriaFilter('todas')}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  categoriaFilter === 'todas'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setCategoriaFilter('sin_categoria')}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  categoriaFilter === 'sin_categoria'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                Sin categoría
              </button>
              {cats.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoriaFilter(cat)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    categoriaFilter === cat
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          );
        })()}

        {rutinas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No hay rutinas guardadas</p>
            <p className="text-xs text-muted-foreground mt-1">Crea tu primera rutina con el botón de arriba</p>
          </div>
        ) : filteredRutinas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">No hay rutinas para esta categoría</p>
            <p className="text-xs text-muted-foreground mt-1">Prueba otro filtro para ver más rutinas.</p>
          </div>
        ) : (
          <Droppable droppableId="library" direction="horizontal" isDropDisabled>
            {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-5">
             {(() => {
               let dragIndex = 0;
                return groupedEntries.map(([categoria, items]) => {
                  const collapsed = collapsedCategories[categoria] ?? true;
                  return (
                  <div key={categoria} className="space-y-3">
                    <button
                      onClick={() => setCollapsedCategories(prev => ({ ...prev, [categoria]: !collapsed }))}
                      className="w-full flex items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-muted/40 transition-colors"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`} />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{categoria}</h3>
                      <span className="text-[10px] text-muted-foreground">({items.length})</span>
                    </button>
                    {!collapsed && (
                      <>
                    {PARTES.map(({ value: parteValue, label: parteLabel, icon: ParteIcon, colorClass }) => {
                      const itemsByParte = items
                        .filter(rutina => rutina.parte_dia === parteValue)
                        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
                      if (itemsByParte.length === 0) return null;

                      return (
                        <div key={`${categoria}-${parteValue}`} className="space-y-2">
                          <div className="flex items-center gap-1.5 pl-1">
                            <ParteIcon className={`h-3.5 w-3.5 ${colorClass}`} />
                            <span className={`text-[11px] font-semibold ${colorClass}`}>{parteLabel}</span>
                            <span className="text-[10px] text-muted-foreground">({itemsByParte.length})</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {itemsByParte.map(rutina => {
                        const currentIndex = dragIndex;
                        dragIndex += 1;
                        const parte = PARTES.find(p => p.value === rutina.parte_dia);
                        const PartIcon = parte?.icon ?? Sun;
                        const weeklyLabel = (rutina.dias_semana ?? []).length > 0
                         ? (rutina.dias_semana ?? []).map(day => DAY_LABELS_ASCII[day]).join(' · ')
                         : null;
                       return (
                         <Draggable key={rutina.id} draggableId={`rutina:${rutina.id}`} index={currentIndex} isDragDisabled>
                           {(dragProvided, dragSnapshot) => (
                             (() => {
                               const card = (
                                 <div
                                   ref={dragProvided.innerRef}
                                   {...dragProvided.draggableProps}
                                   {...dragProvided.dragHandleProps}
                                   className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3"
                                   style={dragProvided.draggableProps.style}
                                 >
                                   <div className="flex items-start gap-3">
                                     <div className={`w-3 h-full min-h-[40px] rounded-full flex-shrink-0 ${COLOR_BG[rutina.color || 'blue']}`} />
                                     <div className="flex-1 min-w-0">
                                       <div className="flex items-start justify-between gap-2">
                                         <p className="text-sm font-semibold text-foreground leading-tight">{rutina.nombre}</p>
                                         {rutina.categoria && (
                                           <span className="flex-shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                             {rutina.categoria}
                                           </span>
                                         )}
                                       </div>
                                       <div className={`flex items-center gap-1 mt-1 ${parte?.colorClass}`}>
                                         <PartIcon className="h-3 w-3" />
                                         <span className="text-xs font-medium">{parte?.label}</span>
                                       </div>
                                       {rutina.descripcion && (
                                         <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rutina.descripcion}</p>
                                       )}
                                       {weeklyLabel && (
                                         <p className="text-[11px] text-primary mt-1">Se repite: {weeklyLabel}</p>
                                       )}
                                     </div>
                                   </div>

                                   {(rutina.objetivos ?? []).length > 0 && (
                                     <div className="space-y-1">
                                       {rutina.objetivos.map(g => (
                                         <div key={g.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                           <span className="flex-shrink-0">{g.icono || '🎯'}</span>
                                           <span className="flex-1 truncate">{g.titulo}</span>
                                           {g.frecuencia && <span className="flex-shrink-0 text-[10px] capitalize">{g.frecuencia}</span>}
                                         </div>
                                       ))}
                                     </div>
                                   )}

                                   <div className="flex items-center gap-2 mt-auto pt-1 border-t border-border">
                                     <button
                                       onClick={() => { setEditingRutina(rutina); setShowRutinaModal(true); }}
                                       className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                     >
                                       <Pencil className="h-3.5 w-3.5" />
                                       Editar
                                     </button>
                                     <button
                                       onClick={() => setDeletingRutinaId(rutina.id)}
                                       className="flex items-center gap-1.5 text-xs text-destructive/70 hover:text-destructive transition-colors ml-auto"
                                     >
                                       <Trash2 className="h-3.5 w-3.5" />
                                       Eliminar
                                     </button>
                                   </div>
                                 </div>
                               );

                               if (dragSnapshot.isDragging) {
                                 return createPortal(
                                   <div
                                     ref={dragProvided.innerRef}
                                     {...dragProvided.draggableProps}
                                     {...dragProvided.dragHandleProps}
                                     style={dragProvided.draggableProps.style}
                                     className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-xl ring-2 ring-primary/30 max-w-[200px]"
                                   >
                                     <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLOR_BG[rutina.color || 'blue']}`} />
                                     <span className="text-xs font-semibold text-foreground truncate">{rutina.nombre}</span>
                                   </div>,
                                   document.body
                                 );
                               }
                               return card;
                             })()
                           )}
                          </Draggable>
                        );
                      })}
                          </div>
                        </div>
                      );
                    })}

                    {items
                      .filter(rutina => !(rutina.parte_dia in parteOrder))
                      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
                      .length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 pl-1">
                          <span className="text-[11px] font-semibold text-muted-foreground">Sin parte del día</span>
                          <span className="text-[10px] text-muted-foreground">
                            ({items.filter(rutina => !(rutina.parte_dia in parteOrder)).length})
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {items
                            .filter(rutina => !(rutina.parte_dia in parteOrder))
                            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
                            .map(rutina => {
                              const currentIndex = dragIndex;
                              dragIndex += 1;
                              const parte = PARTES.find(p => p.value === rutina.parte_dia);
                              const PartIcon = parte?.icon ?? Sun;
                              const weeklyLabel = (rutina.dias_semana ?? []).length > 0
                                ? (rutina.dias_semana ?? []).map(day => DAY_LABELS_ASCII[day]).join(' · ')
                                : null;
                              return (
                                <Draggable key={rutina.id} draggableId={`rutina:${rutina.id}`} index={currentIndex} isDragDisabled>
                                  {(dragProvided, dragSnapshot) => (
                                    (() => {
                                      const card = (
                                        <div
                                          ref={dragProvided.innerRef}
                                          {...dragProvided.draggableProps}
                                          {...dragProvided.dragHandleProps}
                                          className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3"
                                          style={dragProvided.draggableProps.style}
                                        >
                                          <div className="flex items-start gap-3">
                                            <div className={`w-3 h-full min-h-[40px] rounded-full flex-shrink-0 ${COLOR_BG[rutina.color || 'blue']}`} />
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-semibold text-foreground leading-tight">{rutina.nombre}</p>
                                                {rutina.categoria && (
                                                  <span className="flex-shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                    {rutina.categoria}
                                                  </span>
                                                )}
                                              </div>
                                              <div className={`flex items-center gap-1 mt-1 ${parte?.colorClass}`}>
                                                <PartIcon className="h-3 w-3" />
                                                <span className="text-xs font-medium">{parte?.label}</span>
                                              </div>
                                              {rutina.descripcion && (
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rutina.descripcion}</p>
                                              )}
                                              {weeklyLabel && (
                                                <p className="text-[11px] text-primary mt-1">Se repite: {weeklyLabel}</p>
                                              )}
                                            </div>
                                          </div>

                                          {(rutina.objetivos ?? []).length > 0 && (
                                            <div className="space-y-1">
                                              {rutina.objetivos.map(g => (
                                                <div key={g.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                                  <span className="flex-shrink-0">{g.icono || '🎯'}</span>
                                                  <span className="flex-1 truncate">{g.titulo}</span>
                                                  {g.frecuencia && <span className="flex-shrink-0 text-[10px] capitalize">{g.frecuencia}</span>}
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          <div className="flex items-center gap-2 mt-auto pt-1 border-t border-border">
                                            <button
                                              onClick={() => { setEditingRutina(rutina); setShowRutinaModal(true); }}
                                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                              <Pencil className="h-3.5 w-3.5" />
                                              Editar
                                            </button>
                                            <button
                                              onClick={() => setDeletingRutinaId(rutina.id)}
                                              className="flex items-center gap-1.5 text-xs text-destructive/70 hover:text-destructive transition-colors ml-auto"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                              Eliminar
                                            </button>
                                          </div>
                                        </div>
                                      );

                                      if (dragSnapshot.isDragging) {
                                        return createPortal(
                                          <div
                                            ref={dragProvided.innerRef}
                                            {...dragProvided.draggableProps}
                                            {...dragProvided.dragHandleProps}
                                            style={dragProvided.draggableProps.style}
                                            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-xl ring-2 ring-primary/30 max-w-[200px]"
                                          >
                                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${COLOR_BG[rutina.color || 'blue']}`} />
                                            <span className="text-xs font-semibold text-foreground truncate">{rutina.nombre}</span>
                                          </div>,
                                          document.body
                                        );
                                      }
                                      return card;
                                    })()
                                  )}
                                </Draggable>
                              );
                            })}
                        </div>
                      </div>
                    )}
                      </>
                    )}
                  </div>
                );});
              })()}
             {provided.placeholder}
          </div>
            )}
          </Droppable>
        )}
      </section>

      {/* ── Picker de asignación ───────────────────────────────────────────── */}
      {picker && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setPicker(null)} />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">Asignar rutina</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {PARTES.find(p => p.value === picker.parte_dia)?.label} · {picker.fecha}
                </p>
              </div>
              <button onClick={() => setPicker(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-4 py-3 max-h-72 overflow-y-auto space-y-2">
              {pickerRutinas.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No hay rutinas de {PARTES.find(p => p.value === picker.parte_dia)?.label.toLowerCase()} guardadas.</p>
                  <button
                    onClick={() => {
                      setPicker(null);
                      setEditingRutina(null);
                      setDefaultParteDia(picker.parte_dia);
                      setShowRutinaModal(true);
                    }}
                    className="mt-3 text-xs text-primary hover:underline"
                  >
                    Crear una ahora
                  </button>
                </div>
              ) : (
                pickerRutinas.map(rutina => (
                  <button
                    key={rutina.id}
                    onClick={() => handleAsignar(rutina.id)}
                    className="w-full flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 hover:bg-muted hover:border-primary/50 transition-colors text-left"
                  >
                    <div className={`w-3 h-10 rounded-full flex-shrink-0 ${COLOR_BG[rutina.color || 'blue']}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{rutina.nombre}</p>
                      {(rutina.objetivos ?? []).length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {rutina.objetivos.length} objetivo{rutina.objetivos.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {editingAssignmentGoals && (
        <div className="fixed inset-0 z-[320] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingAssignmentGoals(null)} />
          <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">Marcar objetivos completados</p>
                <p className="text-xs text-muted-foreground mt-0.5">{editingAssignmentGoals.rutina.nombre} · {editingAssignmentGoals.fecha}</p>
              </div>
              <button onClick={() => setEditingAssignmentGoals(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-4 py-3 max-h-80 overflow-y-auto space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-border/70">
                  <span className="text-xs text-muted-foreground">
                    {assignmentGoalDraft.size} completado(s) · {assignmentSkippedGoalDraft.size} saltado(s)
                  </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = getGoalsForAssignment(editingAssignmentGoals).map(goal => goal.id);
                      setAssignmentGoalDraft(new Set(allIds));
                      setAssignmentSkippedGoalDraft(new Set());
                      setAssignmentSkipReasonDraft({});
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Marcar todos
                  </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAssignmentGoalDraft(new Set());
                        setAssignmentSkippedGoalDraft(new Set());
                        setAssignmentSkipReasonDraft({});
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Limpiar estados
                    </button>
                  </div>
                </div>

              {getGoalsForAssignment(editingAssignmentGoals).map(goal => {
                const status = getAssignmentGoalDraftStatus(goal.id);
                const skipReason = assignmentSkipReasonDraft[goal.id];
                return (
                  <div
                    key={goal.id}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                      status === 'completed'
                        ? 'border-green-500/60 bg-green-500/10'
                        : status === 'skipped'
                          ? 'border-amber-500/60 bg-amber-500/10'
                          : 'border-border bg-background'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{goal.icono || '🎯'}</span>
                      <span className="text-sm font-medium flex-1 truncate text-foreground">{goal.titulo}</span>
                      {status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-300" /> : status === 'skipped' ? <SkipForward className="h-4 w-4 text-amber-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAssignmentSkippedGoalDraft(prev => {
                            const next = new Set(prev);
                            next.delete(goal.id);
                            return next;
                          });
                          setAssignmentGoalDraft(prev => new Set(prev).add(goal.id));
                        }}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${status === 'completed' ? 'bg-green-600 text-white' : 'border border-border text-foreground hover:bg-muted'}`}
                      >
                        Completar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAssignmentSkipDialogGoal({ id: goal.id, title: goal.titulo });
                          setAssignmentSkipDialogStep('choice');
                          setAssignmentSkipDialogReason(assignmentSkipReasonDraft[goal.id] || '');
                        }}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${status === 'skipped' ? 'bg-amber-600 text-white' : 'border border-border text-foreground hover:bg-muted'}`}
                      >
                        Saltar
                      </button>
                      <button
                        type="button"
                        onClick={() => clearAssignmentGoalStatus(goal.id)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${status === 'pending' ? 'bg-muted text-foreground' : 'border border-border text-foreground hover:bg-muted'}`}
                      >
                        Pendiente
                      </button>
                    </div>
                    {status === 'skipped' && skipReason ? (
                      <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">Motivo: {skipReason}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingAssignmentGoals(null)}
                className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={savingAssignmentGoals}
                onClick={() => { void handleSaveAssignmentGoals(); }}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {savingAssignmentGoals ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {assignmentSkipDialogGoal && (
        <div className="fixed inset-0 z-[340] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeAssignmentSkipDialog} />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-2xl">
            <div className="h-1.5 w-full bg-gradient-to-r from-amber-500/70 via-amber-500 to-amber-500/70" />
            <div className="space-y-4 p-5">
              <div className="space-y-1">
                <h3 className="text-base font-semibold">Saltar objetivo en esta rutina</h3>
                <p className="text-sm text-muted-foreground">
                  {`Puedes saltar "${assignmentSkipDialogGoal.title}" con o sin explicación para esta fecha.`}
                </p>
              </div>

              {assignmentSkipDialogStep === 'choice' ? (
                <div className="space-y-2">
                  <button
                    onClick={confirmAssignmentSkipWithoutReason}
                    className="w-full rounded-xl border border-border bg-card px-3 py-3 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <div className="font-medium text-foreground">Saltar sin explicar</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">No se guarda ningún motivo.</div>
                  </button>
                  <button
                    onClick={() => setAssignmentSkipDialogStep('reason')}
                    className="w-full rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-left text-sm transition-colors hover:bg-amber-500/10"
                  >
                    <div className="font-medium text-foreground">Sí, explicar</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">Añade un motivo breve para registrarlo en esta fecha.</div>
                  </button>
                </div>
              ) : (
                <>
                  <textarea
                    value={assignmentSkipDialogReason}
                    onChange={(e) => setAssignmentSkipDialogReason(e.target.value)}
                    placeholder="Cuéntame por qué lo saltas (opcional)"
                    rows={4}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="text-right text-[11px] text-muted-foreground">{assignmentSkipDialogReason.trim().length}/280</div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setAssignmentSkipDialogStep('choice')}
                      className="inline-flex items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      Volver
                    </button>
                    <button
                      onClick={confirmAssignmentSkipWithReason}
                      className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
                    >
                      Guardar y saltar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modales ────────────────────────────────────────────────────────── */}
      <RutinaModal
        open={showRutinaModal}
        onOpenChange={setShowRutinaModal}
        rutina={editingRutina}
        defaultParteDia={defaultParteDia}
        existingCategories={rutinaCategoryOptions}
        onSave={handleSaveRutina}
      />

      <AlertDialog open={deletingRutinaId !== null} onOpenChange={open => { if (!open) setDeletingRutinaId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar rutina?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La rutina y todas sus asignaciones en el calendario se eliminarán permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRutina}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </DragDropContext>
  );
}
