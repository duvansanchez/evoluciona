import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CalendarDays, CheckSquare, ChevronDown, Edit2, FolderOpen, GripVertical, Info, ListChecks, Plus, PlusCircle, Settings2, Trash2, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import type { Goal, GoalCategory, GoalFolder, GoalPriority, DayPart, SubGoal } from '@/types';
import GoalFoldersModal from './GoalFoldersModal';

interface GoalFormData {
  title: string;
  icon: string;
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
  icon: '',
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
  folders: GoalFolder[];
  onFoldersChange: (folders: GoalFolder[]) => void;
  onSave: (data: GoalFormData) => void;
}

const priorityDot: Record<string, string> = {
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
};

export default function GoalModal({ open, onOpenChange, goal, goals, folders, onFoldersChange, onSave }: GoalModalProps) {
  const isEditing = !!goal;
  const [form, setForm] = useState<GoalFormData>(defaultForm);
  const [newSubGoalTitle, setNewSubGoalTitle] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);
  const [showDatesSection, setShowDatesSection] = useState(false);
  const [showDurationSection, setShowDurationSection] = useState(false);
  const [showRelationsSection, setShowRelationsSection] = useState(false);
  const [showFoldersModal, setShowFoldersModal] = useState(false);

  useEffect(() => {
    if (goal) {
      setForm({
        title: goal.title,
        icon: goal.icon || '',
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
    } else {
      setForm(defaultForm);
      setShowChecklist(false);
      setShowDatesSection(false);
      setShowDurationSection(false);
      setShowRelationsSection(false);
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

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    
    // Si se soltó fuera de una zona droppable
    if (!destination) return;
    
    // Si la posición no cambió
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const newSubGoals = Array.from(form.subGoals);
    const [removed] = newSubGoals.splice(source.index, 1);
    newSubGoals.splice(destination.index, 0, removed);
    
    // Actualizar el orden en el estado
    update('subGoals', newSubGoals);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onSave(form);
    onOpenChange(false);
  };

  const parentGoals = goals.filter(g => g.isParent && g.id !== goal?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="goal-modal max-w-2xl max-h-[90vh] overflow-y-auto border-border bg-background text-foreground p-0 gap-0 sm:rounded-2xl">
        {/* Header with gradient */}
        <div className="sticky top-0 z-10 bg-primary px-6 pt-5 pb-4 rounded-t-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-heading font-bold text-white drop-shadow-lg">
              {isEditing ? (
                <><Edit2 className="h-5 w-5" /> Editar Objetivo</>
              ) : (
                <><PlusCircle className="h-5 w-5" /> Nuevo Objetivo</>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-white/75 mt-1">
              {isEditing
                ? 'Modifica los campos que desees y guarda los cambios.'
                : 'Define tu objetivo y establece los detalles para alcanzarlo.'}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-1">
          {/* Título e Icono */}
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <FieldGroup label="Icono">
              <input
                value={form.icon}
                onChange={e => update('icon', e.target.value)}
                placeholder="😀"
                className="modal-input text-center text-2xl"
                maxLength={4}
              />
            </FieldGroup>
            <FieldGroup label="Título" icon={<CheckSquare className="h-4 w-4" />}>
              <input
                value={form.title}
                onChange={e => update('title', e.target.value)}
                placeholder="¿Qué quieres lograr?"
                className="modal-input text-base"
                maxLength={200}
              />
            </FieldGroup>
          </div>

          {/* Descripción */}
          <FieldGroup label="Descripción" icon={<Info className="h-4 w-4" />}>
            <textarea
              value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="Describe tu objetivo con más detalle..."
              className="modal-input min-h-[80px] resize-y text-sm"
              maxLength={2000}
            />
          </FieldGroup>

          {/* Prioridad + Categoría */}
          <div className="grid grid-cols-2 gap-5">
            <FieldGroup label="Prioridad">
              <div className="grid grid-cols-3 gap-2">
                {(['low', 'medium', 'high'] as GoalPriority[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => update('priority', p)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      form.priority === p
                        ? p === 'high' ? 'bg-priority-high text-white shadow-lg shadow-priority-high/30'
                        : p === 'medium' ? 'bg-priority-medium text-white shadow-lg shadow-priority-medium/30'
                        : 'bg-priority-low text-white shadow-lg shadow-priority-low/30'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {p === 'high' ? 'Alta' : p === 'medium' ? 'Media' : 'Baja'}
                  </button>
                ))}
              </div>
            </FieldGroup>
            <FieldGroup label="Categoría" required>
              <select value={form.category} onChange={e => update('category', e.target.value as GoalCategory)} className="modal-input">
                <option value="daily">📅 Diarios</option>
                <option value="weekly">📆 Semanales</option>
                <option value="monthly">🗓️ Mensuales</option>
                <option value="yearly">📊 Anuales</option>
                <option value="general">⭐ General</option>
              </select>
            </FieldGroup>
          </div>

          {/* SECCIÓN 1: Fechas y Programación */}
          <CollapsibleSection
            title="Fechas y Programación"
            icon="📅"
            isOpen={showDatesSection}
            onToggle={() => setShowDatesSection(!showDatesSection)}
          >
            <div className="space-y-4">
              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Fecha inicio" icon={<CalendarDays className="h-4 w-4" />}>
                  <input type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)} className="modal-input" />
                </FieldGroup>
                <FieldGroup label="Fecha fin" icon={<CalendarDays className="h-4 w-4" />}>
                  <input type="date" value={form.endDate} onChange={e => update('endDate', e.target.value)} className="modal-input" />
                </FieldGroup>
              </div>

              {/* Programación */}
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup label="Programar para:" labelSize="xs">
                  <select value={form.scheduledType} onChange={e => update('scheduledType', e.target.value as 'today' | 'tomorrow' | 'specific')} className="modal-input">
                    <option value="today">🌟 Hoy (sin programar)</option>
                    <option value="tomorrow">☀️ Mañana</option>
                    <option value="specific">📅 Fecha específica</option>
                  </select>
                </FieldGroup>
                <FieldGroup label="Fecha específica:" labelSize="xs">
                  <input
                    type="date"
                    value={form.scheduledDate}
                    onChange={e => update('scheduledDate', e.target.value)}
                    disabled={form.scheduledType !== 'specific'}
                    className="modal-input disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </FieldGroup>
              </div>

              {/* Parte del día */}
              <FieldGroup label="Parte del día">
                <select value={form.dayPart} onChange={e => update('dayPart', e.target.value as DayPart)} className="modal-input">
                  <option value="none">Sin especificar</option>
                  <option value="morning">🌅 Mañana</option>
                  <option value="afternoon">☀️ Tarde</option>
                  <option value="evening">🌙 Noche</option>
                </select>
              </FieldGroup>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p className="text-xs text-primary">
                  Los objetivos programados no aparecerán en la lista de hoy hasta la fecha seleccionada.
                </p>
              </div>
            </div>
          </CollapsibleSection>

          {/* SECCIÓN 2: Duración y Esfuerzo */}
          <CollapsibleSection
            title="Duración y Esfuerzo"
            icon="⏱️"
            isOpen={showDurationSection}
            onToggle={() => setShowDurationSection(!showDurationSection)}
          >
            <div className="space-y-4">
              {/* Duración estimada */}
              <FieldGroup label="Duración estimada">
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <input type="number" min="0" value={form.estimatedHours} onChange={e => update('estimatedHours', e.target.value)} placeholder="0" className="modal-input pr-14" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">horas</span>
                  </div>
                  <div className="relative">
                    <input type="number" min="0" max="59" value={form.estimatedMinutes} onChange={e => update('estimatedMinutes', e.target.value)} placeholder="0" className="modal-input pr-14" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">min</span>
                  </div>
                </div>
              </FieldGroup>

              {/* Recompensa */}
              <FieldGroup label="Recompensa">
                <input value={form.reward} onChange={e => update('reward', e.target.value)} placeholder="¿Qué te darás si lo logras?" className="modal-input" maxLength={300} />
              </FieldGroup>
            </div>
          </CollapsibleSection>

          {/* SECCIÓN 3: Relaciones y Estructura */}
          <CollapsibleSection
            title="Relaciones y Estructura"
            icon="🔗"
            isOpen={showRelationsSection}
            onToggle={() => setShowRelationsSection(!showRelationsSection)}
          >
            <div className="space-y-4">
              {/* Objetivo Padre */}
              <FieldGroup label="Objetivo Padre (Opcional)">
                <select value={form.parentGoalId} onChange={e => update('parentGoalId', e.target.value)} className="modal-input">
                  <option value="">Seleccionar objetivo padre</option>
                  {parentGoals.map(g => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              </FieldGroup>

              {/* Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={form.recurring} 
                    onChange={e => update('recurring', e.target.checked)} 
                    className="mt-1 h-4 w-4 rounded border-2 border-input bg-background text-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0 cursor-pointer transition-all checked:bg-primary checked:border-primary" 
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground transition-colors">🔄 Hacer este objetivo recurrente</span>
                    <p className="text-xs text-muted-foreground mt-0.5">El objetivo se repetirá según la frecuencia establecida</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-xl hover:bg-muted/50 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={form.isParent} 
                    onChange={e => update('isParent', e.target.checked)} 
                    className="mt-1 h-4 w-4 rounded border-2 border-input bg-background text-primary focus:ring-2 focus:ring-primary/50 focus:ring-offset-0 cursor-pointer transition-all checked:bg-primary checked:border-primary" 
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground transition-colors">👨‍👩‍👧‍👦 Este objetivo es padre</span>
                    <p className="text-xs text-muted-foreground mt-0.5">Puede contener sub-objetivos relacionados</p>
                  </div>
                </label>
              </div>
            </div>
          </CollapsibleSection>

          {/* SECCIÓN 4: Checklist / Subobjetivos */}
          <CollapsibleSection
            title="Checklist de Subobjetivos"
            icon="✅"
            isOpen={showChecklist}
            onToggle={() => setShowChecklist(!showChecklist)}
            badge={form.subGoals.length > 0 ? form.subGoals.length : undefined}
            headerAction={
              <button
                onClick={e => { e.stopPropagation(); setShowFoldersModal(true); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-muted/60"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Carpetas {folders.length > 0 && <span className="font-semibold text-primary">({folders.length})</span>}
              </button>
            }
          >
            <div className="space-y-4">
              {form.subGoals.length > 0 && (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="subgoals-list">
                    {(provided, snapshot) => (
                      <div
                        className={`space-y-2 rounded-xl p-2 transition-colors ${
                          snapshot.isDraggingOver 
                            ? 'bg-primary/5 border-2 border-primary/30' 
                            : 'border border-transparent'
                        }`}
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                      >
                        {form.subGoals.map((sub, index) => (
                          <Draggable key={sub.id} draggableId={String(sub.id)} index={index}>
                            {(provided, snapshot) => {
                              const item = (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center gap-3 group/sub p-2 rounded-lg transition-all ${
                                  snapshot.isDragging
                                    ? 'bg-card border-2 border-primary shadow-xl'
                                    : 'hover:bg-muted/50 border-2 border-transparent'
                                }`}
                              >
                                <div
                                  {...provided.dragHandleProps}
                                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-grab active:cursor-grabbing"
                                  title="Arrastra para reordenar"
                                >
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <button
                                  onClick={() => toggleSubGoal(sub.id)}
                                  className={`h-5 w-5 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all ${
                                    sub.completed
                                      ? 'bg-primary border-primary shadow-lg shadow-primary/30'
                                      : 'border-input hover:border-primary hover:scale-110'
                                  }`}
                                >
                                  {sub.completed && (
                                    <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                                <input
                                  value={sub.title}
                                  onChange={e => update('subGoals', form.subGoals.map(s => s.id === sub.id ? { ...s, title: e.target.value } : s))}
                                  className={`flex-1 bg-transparent text-sm outline-none ${sub.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                                  maxLength={200}
                                />
                                {/* Folder selector */}
                                {folders.length > 0 && (
                                  <select
                                    value={sub.folderId ?? ''}
                                    onChange={e => update('subGoals', form.subGoals.map(s => s.id === sub.id ? { ...s, folderId: e.target.value ? Number(e.target.value) : undefined } : s))}
                                    className="text-xs bg-muted rounded-lg px-1.5 py-0.5 border-0 outline-none text-muted-foreground max-w-[90px] truncate"
                                  >
                                    <option value="">Sin carpeta</option>
                                    {folders.map(f => (
                                      <option key={f.id} value={f.id}>{f.icono || '📁'} {f.nombre}</option>
                                    ))}
                                  </select>
                                )}
                                {/* Priority dots */}
                                <div className="flex items-center gap-1.5">
                                  {(['low', 'medium', 'high'] as GoalPriority[]).map(p => (
                                    <button
                                      key={p}
                                      onClick={() => update('subGoals', form.subGoals.map(s => s.id === sub.id ? { ...s, priority: p } : s))}
                                      className={`h-3 w-3 rounded-full transition-all hover:scale-125 ${
                                        sub.priority === p ? priorityDot[p] + ' ring-2 ring-white/30' : 'bg-muted hover:bg-muted-foreground/40'
                                      }`}
                                      title={p === 'high' ? 'Alta' : p === 'medium' ? 'Media' : 'Baja'}
                                    />
                                  ))}
                                </div>
                                <button
                                  onClick={() => removeSubGoal(sub.id)}
                                  className="p-1 rounded-lg text-destructive opacity-0 group-hover/sub:opacity-100 hover:bg-destructive/10 transition-all"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              );
                              return snapshot.isDragging
                                ? createPortal(item, document.body)
                                : item;
                            }}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}

              {/* Add new subgoal */}
              <div className="flex items-center gap-2">
                <input
                  value={newSubGoalTitle}
                  onChange={e => setNewSubGoalTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSubGoal()}
                  placeholder="Escribe un nuevo subobjetivo..."
                  className="modal-input flex-1"
                  maxLength={200}
                />
                <button
                  onClick={addSubGoal}
                  disabled={!newSubGoalTitle.trim()}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Agregar
                </button>
              </div>
            </div>
          </CollapsibleSection>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-border bg-background px-6 py-4 rounded-b-2xl">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-5 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.title.trim()}
            className="rounded-xl bg-primary px-6 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105"
          >
            {isEditing ? '✓ Guardar Cambios' : '✓ Crear Objetivo'}
          </button>
        </div>
      <GoalFoldersModal
        open={showFoldersModal}
        onOpenChange={setShowFoldersModal}
        folders={folders}
        onFoldersChange={onFoldersChange}
      />
      </DialogContent>
    </Dialog>
  );
}

function CollapsibleSection({ title, icon, isOpen, onToggle, badge, headerAction, children }: {
  title: string;
  icon: string;
  isOpen: boolean;
  onToggle: () => void;
  badge?: number;
  headerAction?: React.ReactNode;
  children: React.ReactNode
}) {
  return (
    <div className="border border-input rounded-xl overflow-hidden bg-background">
      <div className="flex items-center">
        <button
          onClick={onToggle}
          className="flex-1 flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">{icon}</span>
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {badge !== undefined && badge > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {badge}
              </span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {headerAction && <div className="pr-3">{headerAction}</div>}
      </div>
      {isOpen && (
        <div className="px-4 pb-4 pt-4 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

function FieldGroup({ label, required, labelSize = 'sm', icon, children }: { label: string; required?: boolean; labelSize?: 'xs' | 'sm'; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className={`flex items-center gap-2 mb-2 font-semibold text-[hsl(200,80%,60%)] ${labelSize === 'xs' ? 'text-[11px] uppercase tracking-wider' : 'text-sm'}`}>
        {icon}
        {label}{required && <span className="text-[hsl(0,60%,50%)]">*</span>}
      </label>
      {children}
    </div>
  );
}
