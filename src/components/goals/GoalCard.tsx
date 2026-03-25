import { ArrowUpCircle, Check, ChevronDown, ChevronUp, Clock, Edit2, EyeOff, Eye, Focus, Repeat, Trash2 } from 'lucide-react';
import type { Goal } from '@/types';
import { useState } from 'react';

const categoryStyles: Record<string, string> = {
  daily: 'bg-category-daily/15 text-category-daily border-category-daily/30',
  weekly: 'bg-category-weekly/15 text-category-weekly border-category-weekly/30',
  monthly: 'bg-category-monthly/15 text-category-monthly border-category-monthly/30',
  yearly: 'bg-category-yearly/15 text-category-yearly border-category-yearly/30',
  general: 'bg-category-general/15 text-category-general border-category-general/30',
};

const categoryLabels: Record<string, string> = {
  daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual', yearly: 'Anual', general: 'General',
};

const priorityDot: Record<string, string> = {
  high: 'bg-priority-high', medium: 'bg-priority-medium', low: 'bg-priority-low',
};

const dayPartLabels: Record<string, string> = {
  morning: '🌅 Mañana', afternoon: '☀️ Tarde', evening: '🌙 Noche',
};

interface GoalCardProps {
  goal: Goal;
  isHidden?: boolean;
  onEdit?: (id: string) => void;
  onToggle?: (id: string) => void;
  onFocusGoal?: (goalId: string) => void;
  onDelete?: (id: string) => void;
  onToggleSubGoal?: (subGoalId: string) => void;
  onHide?: (id: string) => void;
  onMakeCurrent?: (id: string) => void;
}

export default function GoalCard({ goal, isHidden, onToggle, onEdit, onFocusGoal, onDelete, onToggleSubGoal, onHide, onMakeCurrent }: GoalCardProps) {
  const [expanded, setExpanded] = useState(true);
  const completedSubs = goal.subGoals.filter(s => s.completed).length;

  return (
    <div
      className={`group rounded-xl border bg-card p-4 transition-all hover:shadow-md ${
        isHidden ? 'opacity-40 border-dashed' : goal.completed ? 'opacity-60 border-border' : 'border-border hover:border-primary/30'
      } ${goal.skipped ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggle?.(goal.id)}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
            goal.completed
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/30 hover:border-primary'
          }`}
        >
          {goal.completed && <Check className="h-3 w-3" />}
        </button>

        <div className="flex-1 min-w-0">
          {/* Title & actions */}
          <div className="flex items-start justify-between gap-2">
            <h3 className={`font-heading font-semibold text-sm leading-tight flex items-center gap-2 ${goal.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {goal.icon && <span className="text-base">{goal.icon}</span>}
              {goal.title}
            </h3>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!goal.completed && (
                <button
                  onClick={() => onFocusGoal?.(goal.id)}
                  className="p-1 rounded hover:bg-primary/10 text-primary"
                  title="Modo Focus del objetivo"
                >
                  <Focus className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => onHide?.(goal.id)}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
                title={isHidden ? 'Mostrar hoy' : 'Ocultar hoy'}
              >
                {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => onEdit?.(goal.id)} className="p-1 rounded hover:bg-accent text-muted-foreground"><Edit2 className="h-3.5 w-3.5" /></button>
              <button onClick={() => onDelete?.(goal.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>

          {/* Description */}
          {goal.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{goal.description}</p>
          )}

          {/* Badges */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${categoryStyles[goal.category]}`}>
              {categoryLabels[goal.category]}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${priorityDot[goal.priority]}`} />
              {goal.priority === 'high' ? 'Alta' : goal.priority === 'medium' ? 'Media' : 'Baja'}
            </span>
            {goal.recurring && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Repeat className="h-3 w-3" /> Recurrente
              </span>
            )}
            {goal.dayPart && (
              <span className="text-[10px] text-muted-foreground">{dayPartLabels[goal.dayPart]}</span>
            )}
            {goal.estimatedHours && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" /> {goal.estimatedHours}h
              </span>
            )}
          </div>

          {/* Pasar a objetivo actual */}
          {onMakeCurrent && (
            <button
              onClick={() => onMakeCurrent(goal.id)}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/15 transition-colors"
            >
              <ArrowUpCircle className="h-3.5 w-3.5" />
              Pasar a objetivo actual
            </button>
          )}

          {/* SubGoals */}
          {goal.subGoals.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Subobjetivos ({completedSubs}/{goal.subGoals.length})
              </button>
              {/* Progress bar */}
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    completedSubs === goal.subGoals.length
                      ? 'bg-green-500'
                      : completedSubs > 0
                        ? 'bg-primary'
                        : 'bg-muted-foreground/30'
                  }`}
                  style={{ width: `${(completedSubs / goal.subGoals.length) * 100}%` }}
                />
              </div>
              {expanded && (
                <div className="mt-2 space-y-1.5 animate-fade-in">
                  {goal.subGoals.map(sub => (
                    <div key={sub.id} className="group/sub flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-accent/50 transition-colors">
                      <button
                        onClick={() => onToggleSubGoal?.(sub.id)}
                        className={`h-3.5 w-3.5 shrink-0 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                          sub.completed ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 hover:border-primary'
                        }`}
                      >
                        {sub.completed && <Check className="h-2.5 w-2.5" />}
                      </button>
                      <span className={`flex-1 ${sub.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {sub.title}
                      </span>
                      {sub.focusTimeSeconds && sub.focusTimeSeconds > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {Math.floor(sub.focusTimeSeconds / 60)}m
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
