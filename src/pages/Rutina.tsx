import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, Sun, Sunset, Moon,
  CheckCircle2, Circle, X, Pencil, Trash2, BookOpen,
} from 'lucide-react';
import { rutinasAPI } from '@/services/api';
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

  // Modal crear/editar rutina
  const [showRutinaModal, setShowRutinaModal] = useState(false);
  const [editingRutina, setEditingRutina] = useState<Rutina | null>(null);
  const [defaultParteDia, setDefaultParteDia] = useState<string>('morning');

  // Picker de asignación (selector de rutina para una celda)
  const [picker, setPicker] = useState<{ fecha: string; parte_dia: string } | null>(null);

  // Detalle de asignación expandido
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Confirmar eliminar rutina
  const [deletingRutinaId, setDeletingRutinaId] = useState<number | null>(null);

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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
  }, [activeView, historialMonth]);

  // ── Helpers de estado local ─────────────────────────────────────────────────

  const getAsignacion = (fecha: string, parte_dia: string): RutinaAsignacion | undefined =>
    semana.find(d => d.fecha === fecha)?.asignaciones.find(a => a.parte_dia === parte_dia);

  const updateSemanaLocal = (asignacion: RutinaAsignacion) => {
    setSemana(prev => prev.map(dia => {
      if (dia.fecha !== asignacion.fecha) return dia;
      const existing = dia.asignaciones.find(a => a.parte_dia === asignacion.parte_dia);
      return {
        ...dia,
        asignaciones: existing
          ? dia.asignaciones.map(a => a.parte_dia === asignacion.parte_dia ? asignacion : a)
          : [...dia.asignaciones, asignacion],
      };
    }));
  };

  const removeAsignacionLocal = (fecha: string, parte_dia: string) => {
    setSemana(prev => prev.map(dia => ({
      ...dia,
      asignaciones: dia.fecha === fecha
        ? dia.asignaciones.filter(a => a.parte_dia !== parte_dia)
        : dia.asignaciones,
    })));
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleAsignar = async (rutinaId: number) => {
    if (!picker) return;
    try {
      const asignacion = await rutinasAPI.createAsignacion({
        fecha: picker.fecha,
        parte_dia: picker.parte_dia,
        rutina_id: rutinaId,
      });
      updateSemanaLocal(asignacion);
    } catch (e) {
      console.error(e);
    }
    setPicker(null);
  };

  const handleToggleCompleta = async (asignacion: RutinaAsignacion) => {
    try {
      const updated = await rutinasAPI.updateAsignacion(asignacion.id, {
        completada: !asignacion.completada,
      });
      updateSemanaLocal(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleQuitarAsignacion = async (asignacion: RutinaAsignacion) => {
    try {
      await rutinasAPI.deleteAsignacion(asignacion.id);
      removeAsignacionLocal(asignacion.fecha, asignacion.parte_dia);
      if (expandedId === asignacion.id) setExpandedId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const syncObjetivos = async (rutina: Rutina, newIds: number[]) => {
    const currentIds = new Set((rutina.objetivos ?? []).map(g => g.id));
    const toAdd = newIds.filter(id => !currentIds.has(id));
    const toRemove = [...currentIds].filter(id => !newIds.includes(id));
    await Promise.all([
      ...toAdd.map(id => rutinasAPI.addObjetivo(rutina.id, id)),
      ...toRemove.map(id => rutinasAPI.removeObjetivo(rutina.id, id)),
    ]);
  };

  const handleSaveRutina = async (data: { nombre: string; parte_dia: string; color?: string; descripcion?: string; objetivoIds: number[] }) => {
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
    } else {
      const created = await rutinasAPI.createRutina(rutinaData);
      if (objetivoIds.length > 0) await syncObjetivos(created, objetivoIds);
      const fresh = await rutinasAPI.getRutinas();
      setRutinas(fresh);
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

  return (
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
              const asignacion = getAsignacion(iso, parte);
              const today = isToday(iso);

              return (
                <div
                  key={iso}
                  className={`border-l border-border p-1.5 min-h-[80px] ${today ? 'bg-primary/5' : ''}`}
                >
                  {asignacion ? (
                    <div className="h-full flex flex-col gap-1">
                      {/* Tarjeta de asignación */}
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
                        {(asignacion.rutina.objetivos ?? []).length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-1 pl-4">
                            {asignacion.rutina.objetivos.length} objetivo{asignacion.rutina.objetivos.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleCompleta(asignacion)}
                          title={asignacion.completada ? 'Marcar pendiente' : 'Marcar completada'}
                          className="flex-1 flex items-center justify-center p-1 rounded hover:bg-muted transition-colors"
                        >
                          {asignacion.completada
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            : <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                          }
                        </button>
                        <button
                          onClick={() => handleQuitarAsignacion(asignacion)}
                          title="Quitar asignación"
                          className="p-1 rounded hover:bg-destructive/10 transition-colors"
                        >
                          <X className="h-3 w-3 text-destructive/60" />
                        </button>
                      </div>

                      {/* Detalle expandible */}
                      {expandedId === asignacion.id && (asignacion.rutina.objetivos ?? []).length > 0 && (
                        <div className="rounded-lg bg-muted/50 p-2 space-y-1 animate-fade-in">
                          {asignacion.rutina.objetivos.map(g => (
                            <div key={g.id} className="flex items-center gap-1.5">
                              <span className="text-[10px] flex-shrink-0">{g.icono || '🎯'}</span>
                              <p className="text-[10px] text-foreground truncate">{g.titulo}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => { setDefaultParteDia(parte); setPicker({ fecha: iso, parte_dia: parte }); }}
                      className="w-full h-full min-h-[64px] flex items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
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
                                <div
                                  key={a.id}
                                  title={`${a.rutina.nombre}`}
                                  className={`flex items-center gap-1 rounded px-1 py-0.5 ${
                                    a.completada ? 'bg-green-500/15' : 'bg-red-500/10'
                                  }`}
                                >
                                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${COLOR_BG[a.rutina.color || 'blue']}`} />
                                  <p className="text-[9px] truncate text-foreground leading-tight flex-1">{a.rutina.nombre}</p>
                                  {a.completada && <CheckCircle2 className="h-2.5 w-2.5 text-green-500 flex-shrink-0" />}
                                </div>
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
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Mis Rutinas</h2>
          <span className="text-xs text-muted-foreground">({rutinas.length})</span>
        </div>

        {rutinas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No hay rutinas guardadas</p>
            <p className="text-xs text-muted-foreground mt-1">Crea tu primera rutina con el botón de arriba</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rutinas.map(rutina => {
              const parte = PARTES.find(p => p.value === rutina.parte_dia);
              const PartIcon = parte?.icon ?? Sun;
              return (
                <div
                  key={rutina.id}
                  className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3"
                >
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <div className={`w-3 h-full min-h-[40px] rounded-full flex-shrink-0 ${COLOR_BG[rutina.color || 'blue']}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-tight">{rutina.nombre}</p>
                      <div className={`flex items-center gap-1 mt-1 ${parte?.colorClass}`}>
                        <PartIcon className="h-3 w-3" />
                        <span className="text-xs font-medium">{parte?.label}</span>
                      </div>
                      {rutina.descripcion && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rutina.descripcion}</p>
                      )}
                    </div>
                  </div>

                  {/* Objetivos recurrentes */}
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

                  {/* Acciones */}
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
            })}
          </div>
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

      {/* ── Modales ────────────────────────────────────────────────────────── */}
      <RutinaModal
        open={showRutinaModal}
        onOpenChange={setShowRutinaModal}
        rutina={editingRutina}
        defaultParteDia={defaultParteDia}
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
  );
}
