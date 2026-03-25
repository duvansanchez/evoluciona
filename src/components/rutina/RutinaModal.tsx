import { useState, useEffect } from 'react';
import { X, Sun, Sunset, Moon, Target } from 'lucide-react';
import type { Rutina, GoalSimple } from '@/services/api';
import { rutinasAPI } from '@/services/api';

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rutina?: Rutina | null;
  defaultParteDia?: string;
  onSave: (data: {
    nombre: string;
    parte_dia: string;
    color?: string;
    descripcion?: string;
    objetivoIds: number[];
  }) => Promise<void>;
}

export default function RutinaModal({ open, onOpenChange, rutina, defaultParteDia, onSave }: Props) {
  const [nombre, setNombre] = useState('');
  const [parteDia, setParteDia] = useState<string>('morning');
  const [color, setColor] = useState<string>('blue');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);
  const [availableGoals, setAvailableGoals] = useState<GoalSimple[]>([]);
  const [selectedGoalIds, setSelectedGoalIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;
    if (rutina) {
      setNombre(rutina.nombre);
      setParteDia(rutina.parte_dia);
      setColor(rutina.color || 'blue');
      setDescripcion(rutina.descripcion || '');
      setSelectedGoalIds(new Set((rutina.objetivos ?? []).map(g => g.id)));
    } else {
      setNombre('');
      setParteDia(defaultParteDia || 'morning');
      setColor('blue');
      setDescripcion('');
      setSelectedGoalIds(new Set());
    }
    rutinasAPI.getRecurrenteGoals().then(setAvailableGoals).catch(() => {});
  }, [open, rutina]);

  const handleSave = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      await onSave({
        nombre: nombre.trim(),
        parte_dia: parteDia,
        color,
        descripcion: descripcion.trim() || undefined,
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
          </section>

          {/* Objetivos recurrentes */}
          {availableGoals.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Objetivos recurrentes
                </h3>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto rounded-xl border border-border bg-background p-2">
                {availableGoals.map(g => {
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
                        {g.frecuencia && (
                          <p className="text-[10px] text-muted-foreground capitalize">{g.frecuencia}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>
          )}

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
