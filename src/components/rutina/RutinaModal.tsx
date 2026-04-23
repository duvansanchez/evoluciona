import { useState, useEffect } from 'react';
import { X, Sun, Sunset, Moon, Target, Tag } from 'lucide-react';
import type { Rutina, GoalSimple } from '@/services/api';
import { goalsAPI, rutinasAPI } from '@/services/api';

const RUTINA_CATEGORIAS = [
  { value: 'Salud', emoji: '💪' },
  { value: 'Trabajo', emoji: '💼' },
  { value: 'Estudio', emoji: '📚' },
  { value: 'Personal', emoji: '🌱' },
  { value: 'Hogar', emoji: '🏠' },
  { value: 'Deporte', emoji: '🏃' },
  { value: 'Finanzas', emoji: '💰' },
  { value: 'Bienestar', emoji: '🧘' },
] as const;

const QUICK_GOAL_CATEGORIES = [
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'yearly', label: 'Anual' },
  { value: 'general', label: 'General' },
] as const;

const CATEGORY_TO_BACKEND: Record<string, string> = {
  daily: 'diario',
  weekly: 'semanal',
  monthly: 'mensual',
  yearly: 'anual',
  general: 'general',
};

const PARTES_DIA = [
  { value: 'morning', label: 'Mañana', icon: Sun, color: 'text-amber-500' },
  { value: 'afternoon', label: 'Tarde', icon: Sunset, color: 'text-orange-500' },
  { value: 'evening', label: 'Noche', icon: Moon, color: 'text-indigo-500' },
] as const;

const COLORS = [
  { value: 'blue', bg: 'bg-blue-500', ring: 'ring-blue-500' },
  { value: 'green', bg: 'bg-green-500', ring: 'ring-green-500' },
  { value: 'amber', bg: 'bg-amber-500', ring: 'ring-amber-500' },
  { value: 'purple', bg: 'bg-purple-500', ring: 'ring-purple-500' },
  { value: 'red', bg: 'bg-red-500', ring: 'ring-red-500' },
  { value: 'pink', bg: 'bg-pink-500', ring: 'ring-pink-500' },
  { value: 'cyan', bg: 'bg-cyan-500', ring: 'ring-cyan-500' },
];

const WEEK_DAYS = [
  { value: 0, label: 'Lun' },
  { value: 1, label: 'Mar' },
  { value: 2, label: 'Mie' },
  { value: 3, label: 'Jue' },
  { value: 4, label: 'Vie' },
  { value: 5, label: 'Sab' },
  { value: 6, label: 'Dom' },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rutina?: Rutina | null;
  defaultParteDia?: string;
  onSave: (data: {
    nombre: string;
    parte_dia: string;
    color?: string;
    categoria?: string;
    descripcion?: string;
    dias_semana: number[];
    objetivoIds: number[];
  }) => Promise<void>;
}

export default function RutinaModal({ open, onOpenChange, rutina, defaultParteDia, onSave }: Props) {
  const [nombre, setNombre] = useState('');
  const [parteDia, setParteDia] = useState<string>('morning');
  const [color, setColor] = useState<string>('blue');
  const [categoria, setCategoria] = useState<string>('');
  const [customCategoria, setCustomCategoria] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [descripcion, setDescripcion] = useState('');
  const [diasSemana, setDiasSemana] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [availableGoals, setAvailableGoals] = useState<GoalSimple[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = useState<Set<number>>(new Set());
  const [quickGoalTitle, setQuickGoalTitle] = useState('');
  const [quickGoalIcon, setQuickGoalIcon] = useState('');
  const [quickGoalDescription, setQuickGoalDescription] = useState('');
  const [quickGoalCategory, setQuickGoalCategory] = useState<string>('daily');
  const [quickSubgoalTitle, setQuickSubgoalTitle] = useState('');
  const [quickSubgoals, setQuickSubgoals] = useState<string[]>([]);
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [goalCreateError, setGoalCreateError] = useState<string | null>(null);

  const loadAvailableGoals = async () => {
    const goals = await rutinasAPI.getRecurrenteGoals();
    setAvailableGoals(goals);
  };

  useEffect(() => {
    if (!open) return;
    if (rutina) {
      setNombre(rutina.nombre);
      setParteDia(rutina.parte_dia);
      setColor(rutina.color || 'blue');
      setDescripcion(rutina.descripcion || '');
      setDiasSemana(new Set(rutina.dias_semana ?? []));
      setSelectedGoalIds(new Set((rutina.objetivos ?? []).map(g => g.id)));
      const cat = rutina.categoria || '';
      const isPreset = RUTINA_CATEGORIAS.some(c => c.value === cat);
      if (isPreset) {
        setCategoria(cat);
        setCustomCategoria('');
        setShowCustomInput(false);
      } else if (cat) {
        setCategoria('__custom__');
        setCustomCategoria(cat);
        setShowCustomInput(true);
      } else {
        setCategoria('');
        setCustomCategoria('');
        setShowCustomInput(false);
      }
    } else {
      setNombre('');
      setParteDia(defaultParteDia || 'morning');
      setColor('blue');
      setCategoria('');
      setCustomCategoria('');
      setShowCustomInput(false);
      setDescripcion('');
      setDiasSemana(new Set());
      setSelectedGoalIds(new Set());
    }
    setQuickGoalTitle('');
    setQuickGoalIcon('');
    setQuickGoalDescription('');
    setQuickGoalCategory('daily');
    setQuickSubgoalTitle('');
    setQuickSubgoals([]);
    setGoalCreateError(null);
    loadAvailableGoals().catch(() => {});
  }, [open, rutina]);

  const sortedAvailableGoals = [...availableGoals].sort((a, b) => {
    const aMatches = a.parte_dia === parteDia ? 1 : 0;
    const bMatches = b.parte_dia === parteDia ? 1 : 0;
    if (aMatches !== bMatches) return bMatches - aMatches;
    return a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' });
  });

  const addQuickSubgoal = () => {
    const title = quickSubgoalTitle.trim();
    if (!title) return;
    setQuickSubgoals(prev => [...prev, title]);
    setQuickSubgoalTitle('');
  };

  const resetQuickGoalForm = () => {
    setQuickGoalTitle('');
    setQuickGoalIcon('');
    setQuickGoalDescription('');
    setQuickGoalCategory('daily');
    setQuickSubgoalTitle('');
    setQuickSubgoals([]);
  };

  const handleCreateQuickGoal = async (keepTyping = false) => {
    if (!quickGoalTitle.trim()) return;

    setCreatingGoal(true);
    setGoalCreateError(null);
    try {
      const createdGoal = await goalsAPI.createGoal({
        title: quickGoalTitle.trim(),
        icono: quickGoalIcon.trim() || undefined,
        descripcion: quickGoalDescription.trim() || undefined,
        categoria: CATEGORY_TO_BACKEND[quickGoalCategory] || 'diario',
        recurrente: true,
        parte_dia: parteDia,
      });

      if (quickSubgoals.length > 0) {
        await Promise.all(
          quickSubgoals.map((title, index) =>
            goalsAPI.createSubGoal(createdGoal.id, {
              titulo: title,
              completado: false,
              orden: index,
            })
          )
        );
      }

      await loadAvailableGoals();
      setSelectedGoalIds(prev => {
        const next = new Set(prev);
        next.add(Number(createdGoal.id));
        return next;
      });
      if (!keepTyping) {
        resetQuickGoalForm();
      } else {
        setQuickGoalTitle('');
        setQuickGoalDescription('');
        setQuickSubgoalTitle('');
        setQuickSubgoals([]);
      }
    } catch (error) {
      setGoalCreateError(error instanceof Error ? error.message : 'No se pudo crear el objetivo recurrente.');
    } finally {
      setCreatingGoal(false);
    }
  };

  const handleSave = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    const resolvedCategoria = categoria === '__custom__'
      ? customCategoria.trim() || undefined
      : categoria || undefined;
    try {
      await onSave({
        nombre: nombre.trim(),
        parte_dia: parteDia,
        color,
        categoria: resolvedCategoria,
        descripcion: descripcion.trim() || undefined,
        dias_semana: Array.from(diasSemana).sort((a, b) => a - b),
        objetivoIds: Array.from(selectedGoalIds),
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {rutina ? 'Editar rutina' : 'Nueva rutina'}
          </h2>
          <button onClick={() => onOpenChange(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Info básica */}
          <section className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Nombre *
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Mañana productiva"
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Parte del día */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Parte del día *
              </label>
              <div className="flex gap-2">
                {PARTES_DIA.map(({ value, label, icon: Icon, color: iconColor }) => (
                  <button
                    key={value}
                    onClick={() => setParteDia(value)}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                      parteDia === value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${parteDia === value ? '' : iconColor}`} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Color
              </label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setColor(c.value)}
                    className={`w-7 h-7 rounded-full ${c.bg} transition-all ${
                      color === c.value ? `ring-2 ring-offset-2 ring-offset-background ${c.ring}` : 'opacity-60 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Categoría */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block flex items-center gap-1.5">
                <Tag className="h-3 w-3" />
                Categoría (opcional)
              </label>
              <div className="flex flex-wrap gap-2">
                {RUTINA_CATEGORIAS.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => {
                      setCategoria(cat.value);
                      setShowCustomInput(false);
                      setCustomCategoria('');
                    }}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      categoria === cat.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    {cat.value}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setCategoria('__custom__');
                    setShowCustomInput(true);
                  }}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    categoria === '__custom__'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  ✏️ Otra
                </button>
                {categoria && (
                  <button
                    type="button"
                    onClick={() => { setCategoria(''); setCustomCategoria(''); setShowCustomInput(false); }}
                    className="flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    ✕ Sin categoría
                  </button>
                )}
              </div>
              {showCustomInput && (
                <input
                  type="text"
                  value={customCategoria}
                  onChange={e => setCustomCategoria(e.target.value)}
                  placeholder="Ej: Meditación, Arte, Idiomas..."
                  maxLength={50}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
            </div>

            {/* Descripción */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Descripción (opcional)
              </label>
              <textarea
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                rows={2}
                placeholder="Breve descripción de esta rutina..."
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Repetir todas las semanas
              </label>
              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map(day => {
                  const selected = diasSemana.has(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => {
                        setDiasSemana(prev => {
                          const next = new Set(prev);
                          if (next.has(day.value)) next.delete(day.value);
                          else next.add(day.value);
                          return next;
                        });
                      }}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Si marcas dias, esta rutina aparecera automaticamente cada semana en esos dias.
              </p>
            </div>
          </section>

          {/* Objetivos recurrentes */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Objetivos recurrentes
              </h3>
            </div>

            <div className="rounded-xl border border-border bg-background p-3 space-y-3">
              <div className="grid gap-2 sm:grid-cols-[88px_1fr_auto]">
                <input
                  type="text"
                  value={quickGoalIcon}
                  onChange={e => setQuickGoalIcon(e.target.value)}
                  placeholder="🎯"
                  maxLength={4}
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-center text-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="text"
                  value={quickGoalTitle}
                  onChange={e => setQuickGoalTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void handleCreateQuickGoal(); }}
                  placeholder="Crear objetivo recurrente y vincularlo"
                  className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateQuickGoal()}
                  disabled={creatingGoal || !quickGoalTitle.trim()}
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {creatingGoal ? 'Creando...' : 'Crear'}
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
                <select
                  value={quickGoalCategory}
                  onChange={e => setQuickGoalCategory(e.target.value)}
                  className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {QUICK_GOAL_CATEGORIES.map(category => (
                    <option key={category.value} value={category.value}>{category.label}</option>
                  ))}
                </select>

                <textarea
                  value={quickGoalDescription}
                  onChange={e => setQuickGoalDescription(e.target.value)}
                  placeholder="Descripción rápida opcional"
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Subobjetivos rápidos</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={quickSubgoalTitle}
                    onChange={e => setQuickSubgoalTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQuickSubgoal(); } }}
                    placeholder="Agregar subobjetivo"
                    className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={addQuickSubgoal}
                    disabled={!quickSubgoalTitle.trim()}
                    className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </div>

                {quickSubgoals.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {quickSubgoals.map((subgoal, index) => (
                      <span
                        key={`${subgoal}-${index}`}
                        className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs text-foreground border border-border"
                      >
                        {subgoal}
                        <button
                          type="button"
                          onClick={() => setQuickSubgoals(prev => prev.filter((_, itemIndex) => itemIndex !== index))}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Enter en el titulo crea el objetivo. Se guarda como recurrente, con la misma parte del dia de la rutina, queda seleccionado automaticamente y puede llevar subobjetivos desde aqui mismo.
              </p>

              {goalCreateError && (
                <p className="text-xs text-destructive">{goalCreateError}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCreateQuickGoal(true)}
                  disabled={creatingGoal || !quickGoalTitle.trim()}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {creatingGoal ? 'Creando...' : 'Crear y seguir'}
                </button>
              </div>

              {availableGoals.length > 0 ? (
                <div className="space-y-1 max-h-40 overflow-y-auto rounded-xl border border-border bg-background p-2">
                  {sortedAvailableGoals.map(g => {
                    const checked = selectedGoalIds.has(g.id);
                    return (
                      <label
                        key={g.id}
                        className="flex items-center gap-3 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-muted transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedGoalIds(prev => {
                              const next = new Set(prev);
                              checked ? next.delete(g.id) : next.add(g.id);
                              return next;
                            });
                          }}
                          className="rounded border-border"
                        />
                        <span className="text-sm flex-shrink-0">{g.icono || '🎯'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{g.titulo}</p>
                          {(g.frecuencia || g.parte_dia) && (
                            <p className="text-[10px] text-muted-foreground capitalize">
                              {[g.frecuencia, g.parte_dia === 'morning' ? 'mañana' : g.parte_dia === 'afternoon' ? 'tarde' : g.parte_dia === 'evening' ? 'noche' : null].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No hay objetivos recurrentes creados todavia.</p>
              )}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !nombre.trim()}
            className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando...' : rutina ? 'Guardar cambios' : 'Crear rutina'}
          </button>
        </div>
      </div>
    </div>
  );
}
