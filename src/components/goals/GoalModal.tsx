import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CalendarDays, CheckSquare, Edit2, Info, ListChecks, Plus, PlusCircle, Trash2, X } from 'lucide-react';
import type { Goal, GoalCategory, GoalPriority, DayPart, SubGoal } from '@/types';

interface GoalFormData {
  title: string;
  description: string;
  priority: GoalPriority;
  category: GoalCategory;
  parentGoalId: string;
  startDate: string;
  endDate: string;
  estimatedHours: string;
  estimatedMinutes: string;
  reward: string;
  dayPart: DayPart | 'none';
  recurring: boolean;
  isParent: boolean;
  scheduledType: 'today' | 'tomorrow' | 'specific';
  scheduledDate: string;
  subGoals: SubGoal[];
}

const defaultForm: GoalFormData = {
  title: '',
  description: '',
  priority: 'medium',
  category: 'daily',
  parentGoalId: '',
  startDate: '',
  endDate: '',
  estimatedHours: '',
  estimatedMinutes: '',
  reward: '',
  dayPart: 'none',
  recurring: false,
  isParent: false,
  scheduledType: 'today',
  scheduledDate: '',
  subGoals: [],
};

interface GoalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: Goal | null;
  goals: Goal[];
  onSave: (data: GoalFormData) => void;
}

const priorityDot: Record<string, string> = {
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
};

export default function GoalModal({ open, onOpenChange, goal, goals, onSave }: GoalModalProps) {
  const isEditing = !!goal;
  const [form, setForm] = useState<GoalFormData>(defaultForm);
  const [newSubGoalTitle, setNewSubGoalTitle] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);

  useEffect(() => {
    if (goal) {
      setForm({
        title: goal.title,
        description: goal.description || '',
        priority: goal.priority,
        category: goal.category,
        parentGoalId: goal.parentGoalId || '',
        startDate: goal.startDate || '',
        endDate: goal.endDate || '',
        estimatedHours: goal.estimatedHours?.toString() || '',
        estimatedMinutes: goal.estimatedMinutes?.toString() || '',
        reward: goal.reward || '',
        dayPart: goal.dayPart || 'none',
        recurring: goal.recurring,
        isParent: goal.isParent,
        scheduledType: goal.scheduledFor ? 'specific' : 'today',
        scheduledDate: goal.scheduledFor || '',
        subGoals: [...goal.subGoals],
      });
      setShowChecklist(goal.subGoals.length > 0);
    } else {
      setForm(defaultForm);
      setShowChecklist(false);
    }
    setNewSubGoalTitle('');
  }, [goal, open]);

  const update = <K extends keyof GoalFormData>(key: K, value: GoalFormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const addSubGoal = () => {
    if (!newSubGoalTitle.trim()) return;
    const newSub: SubGoal = {
      id: `new-${Date.now()}`,
      title: newSubGoalTitle.trim(),
      completed: false,
    };
    update('subGoals', [...form.subGoals, newSub]);
    setNewSubGoalTitle('');
  };

  const removeSubGoal = (id: string) => {
    update('subGoals', form.subGoals.filter(s => s.id !== id));
  };

  const toggleSubGoal = (id: string) => {
    update('subGoals', form.subGoals.map(s =>
      s.id === id ? { ...s, completed: !s.completed } : s
    ));
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onSave(form);
    onOpenChange(false);
  };

  const parentGoals = goals.filter(g => g.isParent && g.id !== goal?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="goal-modal max-w-lg max-h-[90vh] overflow-y-auto border-[hsl(210,30%,18%)] bg-[hsl(215,35%,10%)] text-[hsl(210,20%,90%)] p-0 gap-0 sm:rounded-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[hsl(215,35%,10%)] px-6 pt-6 pb-4 border-b border-[hsl(210,25%,16%)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-heading font-bold text-[hsl(210,20%,95%)]">
              {isEditing ? (
                <><Edit2 className="h-4 w-4 text-[hsl(200,80%,60%)]" /> Editar Objetivo</>
              ) : (
                <><PlusCircle className="h-4 w-4 text-[hsl(200,80%,60%)]" /> Agregar Nuevo Objetivo</>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-[hsl(210,15%,50%)]">
              {isEditing
                ? 'Modifica los campos que desees y guarda los cambios.'
                : 'Completa los campos para crear un nuevo objetivo.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Título */}
          <FieldGroup label="Título">
            <input
              value={form.title}
              onChange={e => update('title', e.target.value)}
              placeholder="Título del objetivo"
              className="modal-input"
              maxLength={200}
            />
          </FieldGroup>

          {/* Descripción */}
          <FieldGroup label="Descripción">
            <textarea
              value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="Descripción detallada del objetivo"
              className="modal-input min-h-[70px] resize-y"
              maxLength={2000}
            />
          </FieldGroup>

          {/* Prioridad + Categoría */}
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Prioridad">
              <select value={form.priority} onChange={e => update('priority', e.target.value as GoalPriority)} className="modal-input">
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </FieldGroup>
            <FieldGroup label="Categoría" required>
              <select value={form.category} onChange={e => update('category', e.target.value as GoalCategory)} className="modal-input">
                <option value="daily">Diarios</option>
                <option value="weekly">Semanales</option>
                <option value="monthly">Mensuales</option>
                <option value="yearly">Anuales</option>
                <option value="general">General</option>
              </select>
            </FieldGroup>
          </div>

          {/* Objetivo Padre */}
          <FieldGroup label="Objetivo Padre (Opcional)">
            <select value={form.parentGoalId} onChange={e => update('parentGoalId', e.target.value)} className="modal-input">
              <option value="">Seleccionar objetivo padre</option>
              {parentGoals.map(g => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </FieldGroup>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Fecha inicio">
              <input type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)} className="modal-input" />
            </FieldGroup>
            <FieldGroup label="Fecha fin">
              <input type="date" value={form.endDate} onChange={e => update('endDate', e.target.value)} className="modal-input" />
            </FieldGroup>
          </div>

          {/* Duración estimada */}
          <FieldGroup label="Duración estimada">
            <div className="grid grid-cols-2 gap-4">
              <input type="number" min="0" value={form.estimatedHours} onChange={e => update('estimatedHours', e.target.value)} placeholder="Horas" className="modal-input" />
              <input type="number" min="0" max="59" value={form.estimatedMinutes} onChange={e => update('estimatedMinutes', e.target.value)} placeholder="Minutos" className="modal-input" />
            </div>
          </FieldGroup>

          {/* Recompensa */}
          <FieldGroup label="Recompensa">
            <input value={form.reward} onChange={e => update('reward', e.target.value)} placeholder="¿Qué te darás si lo logras?" className="modal-input" maxLength={300} />
          </FieldGroup>

          {/* Parte del día */}
          <FieldGroup label="Parte del día (Opcional)">
            <select value={form.dayPart} onChange={e => update('dayPart', e.target.value as DayPart)} className="modal-input">
              <option value="none">Sin especificar</option>
              <option value="morning">Mañana</option>
              <option value="afternoon">Tarde</option>
              <option value="evening">Noche</option>
            </select>
          </FieldGroup>

          {/* Checkboxes */}
          <div className="space-y-3 border-t border-[hsl(210,25%,16%)] pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.recurring} onChange={e => update('recurring', e.target.checked)} className="modal-checkbox" />
              <span className="text-sm text-[hsl(210,20%,80%)]">Hacer este objetivo recurrente</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.isParent} onChange={e => update('isParent', e.target.checked)} className="modal-checkbox" />
              <span className="text-sm text-[hsl(210,20%,80%)]">¿Este objetivo es padre?</span>
            </label>
          </div>

          {/* Programación */}
          <div className="border-t border-[hsl(210,25%,16%)] pt-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-[hsl(210,15%,50%)]" />
              <span className="text-sm font-medium text-[hsl(210,20%,80%)]">Programación</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Programar para:" labelSize="xs">
                <select value={form.scheduledType} onChange={e => update('scheduledType', e.target.value as 'today' | 'tomorrow' | 'specific')} className="modal-input">
                  <option value="today">Hoy (sin programar)</option>
                  <option value="tomorrow">Mañana</option>
                  <option value="specific">Fecha específica</option>
                </select>
              </FieldGroup>
              <FieldGroup label="Fecha específica:" labelSize="xs">
                <input
                  type="date"
                  value={form.scheduledDate}
                  onChange={e => update('scheduledDate', e.target.value)}
                  disabled={form.scheduledType !== 'specific'}
                  className="modal-input disabled:opacity-40"
                />
              </FieldGroup>
            </div>
            <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-[hsl(210,30%,13%)]">
              <Info className="h-3.5 w-3.5 text-[hsl(210,15%,45%)] mt-0.5 shrink-0" />
              <p className="text-[10px] text-[hsl(210,15%,45%)]">
                Los objetivos programados no aparecerán en la lista de hoy hasta la fecha seleccionada.
              </p>
            </div>
          </div>

          {/* Checklist / Subobjetivos */}
          <div className="border-t border-[hsl(210,25%,16%)] pt-4">
            <button
              onClick={() => setShowChecklist(!showChecklist)}
              className="inline-flex items-center gap-2 rounded-lg border border-[hsl(200,80%,50%)] px-4 py-2 text-sm font-medium text-[hsl(200,80%,60%)] hover:bg-[hsl(200,80%,50%,0.1)] transition-colors"
            >
              <ListChecks className="h-4 w-4" />
              {isEditing ? 'Editar checklist (subobjetivos)' : 'Agregar checklist (subobjetivos)'}
            </button>

            {showChecklist && (
              <div className="mt-4 space-y-3 animate-fade-in">
                <p className="text-xs font-medium text-[hsl(200,80%,60%)]">Checklist (subobjetivos)</p>

                {form.subGoals.length > 0 && (
                  <div className="space-y-2">
                    {form.subGoals.map(sub => (
                      <div key={sub.id} className="flex items-center gap-3 group/sub">
                        <button
                          onClick={() => toggleSubGoal(sub.id)}
                          className={`h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                            sub.completed
                              ? 'bg-primary border-primary'
                              : 'border-[hsl(210,15%,35%)] hover:border-primary'
                          }`}
                        >
                          {sub.completed && (
                            <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className={`flex-1 text-sm ${sub.completed ? 'line-through text-[hsl(210,15%,40%)]' : 'text-[hsl(210,20%,80%)]'}`}>
                          {sub.title}
                        </span>
                        {/* Priority dots */}
                        <div className="flex items-center gap-1">
                          {(['low', 'medium', 'high'] as GoalPriority[]).map(p => (
                            <button
                              key={p}
                              onClick={() => update('subGoals', form.subGoals.map(s => s.id === sub.id ? { ...s, priority: p } : s))}
                              className={`h-2.5 w-2.5 rounded-full transition-all ${
                                sub.priority === p ? priorityDot[p] : 'bg-[hsl(210,15%,25%)] hover:bg-[hsl(210,15%,35%)]'
                              }`}
                            />
                          ))}
                        </div>
                        <button
                          onClick={() => removeSubGoal(sub.id)}
                          className="p-0.5 rounded text-[hsl(0,60%,50%)] opacity-0 group-hover/sub:opacity-100 hover:bg-[hsl(0,60%,50%,0.15)] transition-all"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new subgoal */}
                <div className="flex items-center gap-2">
                  <input
                    value={newSubGoalTitle}
                    onChange={e => setNewSubGoalTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSubGoal()}
                    placeholder="Nuevo subobjetivo..."
                    className="modal-input flex-1"
                    maxLength={200}
                  />
                  <button
                    onClick={addSubGoal}
                    disabled={!newSubGoalTitle.trim()}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-[hsl(210,25%,16%)] bg-[hsl(215,35%,10%)] px-6 py-4">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-5 py-2 text-sm font-medium text-[hsl(210,20%,70%)] hover:text-[hsl(210,20%,90%)] hover:bg-[hsl(210,25%,16%)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.title.trim()}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {isEditing ? 'Guardar Cambios' : 'Guardar objetivo'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FieldGroup({ label, required, labelSize = 'sm', children }: { label: string; required?: boolean; labelSize?: 'xs' | 'sm'; children: React.ReactNode }) {
  return (
    <div>
      <label className={`block mb-1.5 font-medium text-[hsl(200,80%,60%)] ${labelSize === 'xs' ? 'text-[10px] uppercase tracking-wider' : 'text-xs'}`}>
        {label}{required && <span className="text-[hsl(0,60%,50%)]"> *</span>}
      </label>
      {children}
    </div>
  );
}
