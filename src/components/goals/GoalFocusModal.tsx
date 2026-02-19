import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Focus, Pause, Play, RotateCcw, X } from 'lucide-react';
import type { SubGoal, Goal } from '@/types';

interface GoalFocusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
  onSave: (goalId: string, updates: { subGoals: SubGoal[]; focusTimeSeconds: number; focusNotes: string }) => void;
  onComplete: (goalId: string) => void;
  onOpenSubGoalFocus: (subGoalId: string) => void;
}

type TimerState = 'idle' | 'running' | 'paused';

export default function GoalFocusModal({ 
  open, 
  onOpenChange, 
  goal, 
  onSave, 
  onComplete,
  onOpenSubGoalFocus
}: GoalFocusModalProps) {
  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [subGoals, setSubGoals] = useState<SubGoal[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const intervalRef = useRef<number | null>(null);

  // Cargar datos del objetivo
  useEffect(() => {
    if (open && goal) {
      setSeconds(goal.focusTimeSeconds || 0);
      setNotes(goal.focusNotes || '');
      setSubGoals([...goal.subGoals].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return 0;
      }));
      setTimerState('idle');
      setHasUnsavedChanges(false);
    }
  }, [open, goal]);

  // Timer logic
  useEffect(() => {
    if (timerState === 'running') {
      intervalRef.current = window.setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState]);

  const handleStart = () => {
    setTimerState('running');
  };

  const handlePause = () => {
    setTimerState('paused');
  };

  const handleReset = () => {
    if (confirm('¿Estás seguro de reiniciar el timer?')) {
      setSeconds(0);
      setTimerState('idle');
    }
  };

  const handleSave = () => {
    if (!goal) return;
    onSave(goal.id, { subGoals, focusTimeSeconds: seconds, focusNotes: notes.trim() });
    setHasUnsavedChanges(false);
  };

  const handleComplete = () => {
    if (!goal) return;
    if (timerState === 'running') setTimerState('paused');
    handleSave();
    onComplete(goal.id);
    onOpenChange(false);
  };

  const handleClose = () => {
    if (timerState === 'running') setTimerState('paused');
    if (hasUnsavedChanges) handleSave();
    onOpenChange(false);
  };

  const toggleSubGoal = (id: string) => {
    const nextSubGoals = subGoals.map(s =>
      s.id === id ? { ...s, completed: !s.completed, completedAt: !s.completed ? new Date().toISOString() : undefined } : s
    ).sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return 0;
    });

    setSubGoals(nextSubGoals);
    setHasUnsavedChanges(false);
    if (goal) {
      onSave(goal.id, { subGoals: nextSubGoals, focusTimeSeconds: seconds, focusNotes: notes.trim() });
    }
  };

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!open || !goal) return null;

  const completedCount = subGoals.filter(s => s.completed).length;
  const totalCount = subGoals.length;

  return (
    <div className="fixed inset-0 z-50 bg-background animate-fade-in overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20">
                <Focus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Modo Focus</h2>
                <p className="text-xs text-muted-foreground">Concéntrate en este objetivo</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8 max-w-5xl">
        {/* Goal Title */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">{goal.title}</h1>
          {goal.description && (
            <p className="text-muted-foreground">{goal.description}</p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
              goal.category === 'daily' ? 'bg-category-daily/20 text-category-daily' :
              goal.category === 'weekly' ? 'bg-category-weekly/20 text-category-weekly' :
              goal.category === 'monthly' ? 'bg-category-monthly/20 text-category-monthly' :
              goal.category === 'yearly' ? 'bg-category-yearly/20 text-category-yearly' :
              'bg-category-general/20 text-category-general'
            }`}>
              {goal.category === 'daily' ? 'Diario' : goal.category === 'weekly' ? 'Semanal' : goal.category === 'monthly' ? 'Mensual' : goal.category === 'yearly' ? 'Anual' : 'General'}
            </span>
            <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
              goal.priority === 'high' ? 'bg-red-500/20 text-red-400' :
              goal.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-green-500/20 text-green-400'
            }`}>
              {goal.priority === 'high' ? '🔴 Alta' : goal.priority === 'medium' ? '🟡 Media' : '🟢 Baja'}
            </span>
            {goal.recurring && (
              <span className="px-2 py-1 rounded-md text-xs font-semibold bg-purple-500/20 text-purple-400">
                🔄 Recurrente
              </span>
            )}
            {goal.dayPart && (
              <span className="px-2 py-1 rounded-md text-xs font-semibold bg-blue-500/20 text-blue-400">
                {goal.dayPart === 'morning' ? '🌅 Mañana' : goal.dayPart === 'afternoon' ? '☀️ Tarde' : '🌙 Noche'}
              </span>
            )}
          </div>
        </div>

        {/* Timer */}
        <div className="mb-8 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-12 overflow-hidden">
          <div className="text-center">
            <div className="text-6xl font-mono font-bold text-foreground mb-6 tracking-tight" style={{ wordBreak: 'break-all', overflowWrap: 'break-word' }}>
              {formatTime(seconds)}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {timerState === 'idle' || timerState === 'paused' ? (
                <button
                  onClick={handleStart}
                  className="flex items-center gap-2 rounded-xl bg-green-600 px-8 py-3 text-base font-semibold text-white hover:bg-green-700 transition-all shadow-lg"
                >
                  <Play className="h-5 w-5" />
                  {timerState === 'idle' ? 'Iniciar' : 'Reanudar'}
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="flex items-center gap-2 rounded-xl bg-amber-600 px-8 py-3 text-base font-semibold text-white hover:bg-amber-700 transition-all shadow-lg"
                >
                  <Pause className="h-5 w-5" />
                  Pausar
                </button>
              )}
              <button
                onClick={handleReset}
                disabled={seconds === 0}
                className="flex items-center gap-2 rounded-xl border border-border bg-background px-6 py-3 text-base font-medium text-foreground hover:bg-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <RotateCcw className="h-5 w-5" />
                Reiniciar
              </button>
            </div>
          </div>
        </div>

        {/* Subgoals Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-foreground">≡ Progreso del objetivo</h3>
              <span className="px-2 py-1 rounded-md bg-primary/20 text-primary text-sm font-bold">
                {completedCount}/{totalCount}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-4">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
            />
          </div>

          {/* Subgoals list */}
          <div className="space-y-2">
            {subGoals.map(sub => (
              <div
                key={sub.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors group"
              >
                <button
                  onClick={() => toggleSubGoal(sub.id)}
                  className={`h-5 w-5 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all ${
                    sub.completed
                      ? 'bg-primary border-primary'
                      : 'border-input hover:border-primary'
                  }`}
                >
                  {sub.completed && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span className={`flex-1 text-sm ${sub.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {sub.title}
                </span>
                {sub.focusTimeSeconds && sub.focusTimeSeconds > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {Math.floor(sub.focusTimeSeconds / 60)}m
                  </span>
                )}
                {!sub.completed && (
                  <button
                    onClick={() => onOpenSubGoalFocus(sub.id)}
                    className="rounded-lg bg-primary/10 hover:bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary transition-colors flex items-center gap-1"
                  >
                    <Focus className="h-3.5 w-3.5" />
                    Focus
                  </button>
                )}
              </div>
            ))}
          </div>

          {totalCount === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No hay subobjetivos. Edita el objetivo para agregar algunos.</p>
            </div>
          )}
        </div>

        {/* Notes Section */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-foreground mb-3">
            📝 Notas de la sesión
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Anota tu progreso, ideas o reflexiones sobre este objetivo..."
            className="w-full min-h-[150px] rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
            maxLength={2000}
          />
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
            <button
              onClick={handleClose}
              className="flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <X className="h-4 w-4" />
              Salir del Focus
            </button>
            
            <div className="flex items-center gap-3">
              <button
                className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Desmarcar de hoy
              </button>
              <button
                className="rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Marcar como hoy
              </button>
              <button
                onClick={handleComplete}
                className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors shadow-lg"
              >
                <CheckCircle2 className="h-5 w-5" />
                ✓ Completar Objetivo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
