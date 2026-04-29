import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, CalendarDays, ChevronLeft, ChevronRight, Mail, Moon, Pencil, Plus, Save, Send, Sun, Trash2 } from 'lucide-react';
import { remindersAPI } from '@/services/api';
import type { CustomReminder, ReminderConfig } from '@/services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const DEFAULT_CONFIG: ReminderConfig = {
  manana: { enabled: false, hour: 8, minute: 0 },
  noche: { enabled: false, hour: 20, minute: 0 },
};

const DEFAULT_CUSTOM_FORM = {
  title: '',
  message: '',
  date: new Date().toISOString().slice(0, 10),
  hour: 9,
  minute: 0,
  times: [{ hour: 9, minute: 0 }],
  recurrence: 'once' as CustomReminder['recurrence'],
  enabled: true,
  recipient: '',
  notes: '',
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toTimeString(hour: number, minute: number) {
  return `${pad(hour)}:${pad(minute)}`;
}

function fromTimeString(t: string): { hour: number; minute: number } {
  const [h, m] = t.split(':').map(Number);
  return { hour: h, minute: m };
}

function recurrenceLabel(recurrence: CustomReminder['recurrence']) {
  if (recurrence === 'daily') return 'Todos los días';
  if (recurrence === 'multi_daily') return 'Más de 1 vez en el día';
  if (recurrence === 'weekly') return 'Cada semana';
  if (recurrence === 'monthly') return 'Cada mes';
  if (recurrence === 'yearly') return 'Cada año';
  return 'Una sola vez';
}

function recurrenceHelpText(recurrence: CustomReminder['recurrence']) {
  if (recurrence === 'once') return 'Será el día exacto en que se enviará este recordatorio.';
  if (recurrence === 'daily') return 'Será la fecha desde la que este recordatorio empezará a repetirse todos los días.';
  if (recurrence === 'multi_daily') return 'Será varias veces en ese mismo día, usando las horas que configures.';
  if (recurrence === 'weekly') return 'Se tomará este día de la semana como referencia para repetirlo cada semana.';
  if (recurrence === 'monthly') return 'Se tomará este día del mes como referencia para repetirlo cada mes.';
  return 'Se tomará este día y mes como referencia para repetirlo cada año.';
}

function recurrenceBadgeClass(recurrence: CustomReminder['recurrence'], enabled: boolean) {
  if (!enabled) return 'bg-muted text-muted-foreground';
  if (recurrence === 'daily') return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300';
  if (recurrence === 'weekly') return 'bg-blue-500/15 text-blue-600 dark:text-blue-300';
  if (recurrence === 'monthly') return 'bg-violet-500/15 text-violet-600 dark:text-violet-300';
  if (recurrence === 'yearly') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
  return 'bg-rose-500/15 text-rose-600 dark:text-rose-300';
}

const CALENDAR_DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const CALENDAR_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function toIsoDateLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonthGrid(month: Date) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

function occursOnDate(reminder: CustomReminder, date: Date) {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const base = new Date(`${reminder.date}T12:00:00`);
  base.setHours(0, 0, 0, 0);

  if (current < base) return false;
  if (reminder.recurrence === 'once') return toIsoDateLocal(current) === reminder.date;
  if (reminder.recurrence === 'daily') return true;
  if (reminder.recurrence === 'multi_daily') return toIsoDateLocal(current) === reminder.date;
  if (reminder.recurrence === 'weekly') return current.getDay() === base.getDay();
  if (reminder.recurrence === 'monthly') return current.getDate() === base.getDate();
  return current.getDate() === base.getDate() && current.getMonth() === base.getMonth();
}

interface FixedReminderCardProps {
  parte: 'manana' | 'noche';
  config: ReminderConfig['manana'];
  onChange: (cfg: ReminderConfig['manana']) => void;
  onTest: () => void;
  testing: boolean;
}

function FixedReminderCard({ parte, config, onChange, onTest, testing }: FixedReminderCardProps) {
  const isMorning = parte === 'manana';
  const Icon = isMorning ? Sun : Moon;
  const iconColor = isMorning ? 'text-amber-500' : 'text-indigo-500';
  const label = isMorning ? 'Recordatorio de mañana' : 'Recordatorio de noche';

  return (
    <div className={`rounded-2xl border p-5 transition-all ${config.enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background">
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">
              {isMorning ? 'Resumen automático para arrancar el día.' : 'Cierre diario con pendientes por correo.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => onChange({ ...config, enabled: !config.enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.enabled ? 'bg-primary' : 'bg-muted'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Hora de envío</label>
          <input
            type="time"
            disabled={!config.enabled}
            value={toTimeString(config.hour, config.minute)}
            onChange={e => {
              const { hour, minute } = fromTimeString(e.target.value);
              onChange({ ...config, hour, minute });
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
          />
        </div>
        <button
          onClick={onTest}
          disabled={testing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          {testing ? 'Enviando...' : 'Probar'}
        </button>
      </div>
    </div>
  );
}

export default function Recordatorios() {
  const [config, setConfig] = useState<ReminderConfig>(DEFAULT_CONFIG);
  const [customReminders, setCustomReminders] = useState<CustomReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingFixed, setSavingFixed] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_CUSTOM_FORM);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isTimesModalOpen, setIsTimesModalOpen] = useState(false);
  const [showDiscardChangesDialog, setShowDiscardChangesDialog] = useState(false);
  const [draggingReminderId, setDraggingReminderId] = useState<string | null>(null);
  const [dragTargetDate, setDragTargetDate] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      const [fixedConfig, custom] = await Promise.all([
        remindersAPI.getConfig(),
        remindersAPI.listCustom(),
      ]);
      setConfig(fixedConfig);
      setCustomReminders(custom);
    } catch (error) {
      console.error('Error loading reminders module:', error);
      setMessage({ ok: false, text: 'No se pudo cargar la configuración de recordatorios.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const sortedReminders = useMemo(
    () => [...customReminders].sort((a, b) => {
      const aPrimaryTime = a.recurrence === 'multi_daily' && a.times?.length ? toTimeString(a.times[0].hour, a.times[0].minute) : toTimeString(a.hour, a.minute);
      const bPrimaryTime = b.recurrence === 'multi_daily' && b.times?.length ? toTimeString(b.times[0].hour, b.times[0].minute) : toTimeString(b.hour, b.minute);
      const aTime = a.next_run_time || `${a.date}T${aPrimaryTime}:00`;
      const bTime = b.next_run_time || `${b.date}T${bPrimaryTime}:00`;
      return aTime.localeCompare(bTime);
    }),
    [customReminders],
  );

  const monthGrid = useMemo(() => getMonthGrid(calendarMonth), [calendarMonth]);

  const remindersByDate = useMemo(() => {
    const map: Record<string, CustomReminder[]> = {};
    monthGrid.forEach(day => {
      const key = toIsoDateLocal(day);
      const items = sortedReminders.filter(item => occursOnDate(item, day));
      if (items.length > 0) {
        map[key] = items.sort((a, b) => {
          const aPrimaryTime = a.recurrence === 'multi_daily' && a.times?.length ? toTimeString(a.times[0].hour, a.times[0].minute) : `${pad(a.hour)}:${pad(a.minute)}`;
          const bPrimaryTime = b.recurrence === 'multi_daily' && b.times?.length ? toTimeString(b.times[0].hour, b.times[0].minute) : `${pad(b.hour)}:${pad(b.minute)}`;
          return aPrimaryTime.localeCompare(bPrimaryTime);
        });
      }
    });
    return map;
  }, [monthGrid, sortedReminders]);

  const selectedDateReminders = remindersByDate[selectedDate] ?? [];
  const hasUnsavedFormChanges = useMemo(() => {
    const normalizedCurrent = JSON.stringify(form);
    const normalizedDefault = JSON.stringify({ ...DEFAULT_CUSTOM_FORM, date: selectedDate });
    if (editingId) {
      const editingItem = customReminders.find(item => item.id === editingId);
      if (!editingItem) return normalizedCurrent !== normalizedDefault;
      const baseline = JSON.stringify({
        title: editingItem.title,
        message: editingItem.message,
        date: editingItem.date,
        hour: editingItem.hour,
        minute: editingItem.minute,
        times: editingItem.times?.length ? editingItem.times : [{ hour: editingItem.hour, minute: editingItem.minute }],
        recurrence: editingItem.recurrence,
        enabled: editingItem.enabled,
        recipient: editingItem.recipient || '',
        notes: editingItem.notes || '',
      });
      return normalizedCurrent !== baseline;
    }
    return normalizedCurrent !== normalizedDefault;
  }, [customReminders, editingId, form, selectedDate]);

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...DEFAULT_CUSTOM_FORM, date: selectedDate });
  };

  const openCreateModalForDate = (date: string) => {
    setSelectedDate(date);
    setEditingId(null);
    setForm({ ...DEFAULT_CUSTOM_FORM, date });
    setIsReminderModalOpen(true);
  };

  const handleSaveFixed = async () => {
    setSavingFixed(true);
    setMessage(null);
    try {
      const updated = await remindersAPI.updateConfig(config);
      setConfig(updated);
      setMessage({ ok: true, text: 'Recordatorios automáticos actualizados.' });
    } catch (error: any) {
      setMessage({ ok: false, text: error?.message || 'No se pudieron guardar los recordatorios automáticos.' });
    } finally {
      setSavingFixed(false);
    }
  };

  const handleTestFixed = async (parte: 'manana' | 'noche') => {
    setTesting(parte);
    setMessage(null);
    try {
      await remindersAPI.testReminder(parte);
      setMessage({ ok: true, text: `Correo de prueba de ${parte === 'manana' ? 'mañana' : 'noche'} enviado.` });
    } catch (error: any) {
      setMessage({ ok: false, text: error?.message || 'No se pudo enviar el correo de prueba.' });
    } finally {
      setTesting(null);
    }
  };

  const handleEdit = (item: CustomReminder) => {
    setEditingId(item.id);
    setSelectedDate(item.date);
    setCalendarMonth(new Date(new Date(`${item.date}T12:00:00`).getFullYear(), new Date(`${item.date}T12:00:00`).getMonth(), 1));
    setForm({
      title: item.title,
      message: item.message,
      date: item.date,
      hour: item.hour,
      minute: item.minute,
      times: item.times?.length ? item.times : [{ hour: item.hour, minute: item.minute }],
      recurrence: item.recurrence,
      enabled: item.enabled,
      recipient: item.recipient || '',
      notes: item.notes || '',
    });
    setIsReminderModalOpen(true);
  };

  const handleSaveCustom = async () => {
    setSavingCustom(true);
    setMessage(null);
    try {
      if (editingId) {
        await remindersAPI.updateCustom(editingId, form);
        setMessage({ ok: true, text: 'Recordatorio personalizado actualizado.' });
      } else {
        await remindersAPI.createCustom(form);
        setMessage({ ok: true, text: 'Recordatorio personalizado creado.' });
      }
      resetForm();
      setIsReminderModalOpen(false);
      setCustomReminders(await remindersAPI.listCustom());
    } catch (error: any) {
      setMessage({ ok: false, text: error?.message || 'No se pudo guardar el recordatorio personalizado.' });
    } finally {
      setSavingCustom(false);
    }
  };

  const requestCloseReminderModal = () => {
    if (hasUnsavedFormChanges) {
      setShowDiscardChangesDialog(true);
      return;
    }
    setIsReminderModalOpen(false);
    resetForm();
  };

  const handleDeleteCustom = async (id: string) => {
    setMessage(null);
    try {
      await remindersAPI.deleteCustom(id);
      if (editingId === id) resetForm();
      setCustomReminders(await remindersAPI.listCustom());
      setMessage({ ok: true, text: 'Recordatorio eliminado.' });
    } catch (error: any) {
      setMessage({ ok: false, text: error?.message || 'No se pudo eliminar el recordatorio.' });
    }
  };

  const handleTestCustom = async (id: string) => {
    setTesting(id);
    setMessage(null);
    try {
      await remindersAPI.testCustom(id);
      setMessage({ ok: true, text: 'Correo de prueba del recordatorio enviado.' });
    } catch (error: any) {
      setMessage({ ok: false, text: error?.message || 'No se pudo enviar el recordatorio de prueba.' });
    } finally {
      setTesting(null);
    }
  };

  const moveReminderToDate = async (reminderId: string, nextDate: string) => {
    const reminder = customReminders.find(item => item.id === reminderId);
    if (!reminder || reminder.date === nextDate) return;
    setMessage(null);
    try {
      await remindersAPI.updateCustom(reminderId, {
        title: reminder.title,
        message: reminder.message,
        date: nextDate,
        hour: reminder.hour,
        minute: reminder.minute,
        times: reminder.times,
        recurrence: reminder.recurrence,
        enabled: reminder.enabled,
        recipient: reminder.recipient || '',
        notes: reminder.notes || '',
      });
      setCustomReminders(await remindersAPI.listCustom());
      setSelectedDate(nextDate);
      setMessage({ ok: true, text: 'Recordatorio movido a la nueva fecha.' });
    } catch (error: any) {
      setMessage({ ok: false, text: error?.message || 'No se pudo mover el recordatorio.' });
    } finally {
      setDraggingReminderId(null);
      setDragTargetDate(null);
    }
  };

  const anyEnabled = config.manana.enabled || config.noche.enabled || customReminders.some(item => item.enabled);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
            <Bell className="h-3.5 w-3.5" />
            Agenda por correo
          </div>
          <h1 className="mt-3 text-2xl md:text-3xl font-heading font-bold text-foreground">Recordatorios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Programa correos fijos y recordatorios personalizados con fecha, hora y recurrencia estilo agenda.
          </p>
        </div>
        <button
          onClick={handleSaveFixed}
          disabled={loading || savingFixed}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {savingFixed ? 'Guardando...' : 'Guardar recordatorios fijos'}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Automáticos del día</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FixedReminderCard
                parte="manana"
                config={config.manana}
                onChange={(cfg) => setConfig(prev => ({ ...prev, manana: cfg }))}
                onTest={() => handleTestFixed('manana')}
                testing={testing === 'manana'}
              />
              <FixedReminderCard
                parte="noche"
                config={config.noche}
                onChange={(cfg) => setConfig(prev => ({ ...prev, noche: cfg }))}
                onTest={() => handleTestFixed('noche')}
                testing={testing === 'noche'}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Agenda personalizada</h2>
              </div>
              <button
                onClick={() => openCreateModalForDate(selectedDate)}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Nuevo
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <button
                  onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground capitalize">
                    {CALENDAR_MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                  </p>
                  <p className="text-xs text-muted-foreground">Haz clic en un día para crear o revisar recordatorios</p>
                </div>
                <button
                  onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {CALENDAR_DAY_LABELS.map(label => <div key={label}>{label}</div>)}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-2">
                {monthGrid.map(day => {
                  const iso = toIsoDateLocal(day);
                  const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                  const isSelected = iso === selectedDate;
                  const isToday = iso === new Date().toISOString().slice(0, 10);
                  const dayReminders = remindersByDate[iso] ?? [];
                  const hasEnabled = dayReminders.some(item => item.enabled);

                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => {
                        setSelectedDate(iso);
                        if (!editingId) setForm(prev => ({ ...prev, date: iso }));
                      }}
                      onDoubleClick={() => openCreateModalForDate(iso)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (draggingReminderId) setDragTargetDate(iso);
                      }}
                      onDragLeave={() => {
                        if (dragTargetDate === iso) setDragTargetDate(null);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const reminderId = event.dataTransfer.getData('text/plain') || draggingReminderId;
                        if (reminderId) void moveReminderToDate(reminderId, iso);
                      }}
                      className={`min-h-[96px] rounded-xl border p-2 text-left transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card hover:bg-muted'
                      } ${dragTargetDate === iso ? 'ring-2 ring-primary/40 bg-primary/5' : ''} ${!isCurrentMonth ? 'opacity-45' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>{day.getDate()}</span>
                        {dayReminders.length > 0 ? (
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${hasEnabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {dayReminders.length}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 space-y-1">
                        {dayReminders.slice(0, 2).map(item => (
                          <div
                            key={`${iso}-${item.id}`}
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData('text/plain', item.id);
                              setDraggingReminderId(item.id);
                            }}
                            onDragEnd={() => {
                              setDraggingReminderId(null);
                              setDragTargetDate(null);
                            }}
                            className={`truncate rounded-md px-1.5 py-1 text-[10px] ${recurrenceBadgeClass(item.recurrence, item.enabled)}`}
                          >
                            {item.recurrence === 'multi_daily' && item.times?.length
                              ? `${item.times.length} horarios · ${item.title}`
                              : `${toTimeString(item.hour, item.minute)} · ${item.title}`}
                          </div>
                        ))}
                        {dayReminders.length > 2 ? (
                          <p className="text-[10px] text-muted-foreground">+{dayReminders.length - 2} más</p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
              Haz clic en un día del calendario o en <span className="font-medium text-foreground">Nuevo</span> para abrir el modal de creación/edición.
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Resumen</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado general</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground">
                  {anyEnabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
                  {anyEnabled ? 'Hay recordatorios activos' : 'No hay recordatorios activos'}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Qué puedes programar</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>Correos de una sola vez</li>
                  <li>Recordatorios diarios, semanales, mensuales o anuales</li>
                  <li>Mensajes libres a tu correo por agenda</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">
              {`Recordatorios del ${selectedDate}`}
            </h2>
            <div className="mt-4 space-y-3">
              {selectedDateReminders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                  No hay recordatorios para este día. Si quieres, selecciona la fecha y crea uno nuevo con esa fecha base.
                </div>
              ) : (
                selectedDateReminders.map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', item.id);
                      setDraggingReminderId(item.id);
                    }}
                    onDragEnd={() => {
                      setDraggingReminderId(null);
                      setDragTargetDate(null);
                    }}
                    className={`rounded-xl border p-4 ${item.enabled ? 'border-border bg-background' : 'border-border/60 bg-muted/20 opacity-75'} ${draggingReminderId === item.id ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${recurrenceBadgeClass(item.recurrence, item.enabled)}`}>
                            {recurrenceLabel(item.recurrence)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                          <div className={`mt-0.5 h-8 w-1 rounded-full ${item.enabled ? 'bg-primary/40' : 'bg-muted'}`} />
                          <div>
                            <p>{item.date} · {toTimeString(item.hour, item.minute)}</p>
                            {item.recurrence === 'multi_daily' && item.times?.length > 0 ? (
                              <p>{item.times.map(time => toTimeString(time.hour, time.minute)).join(' · ')}</p>
                            ) : null}
                            <p>{recurrenceLabel(item.recurrence)}</p>
                          </div>
                        </div>
                        {item.next_run_time && (
                          <p className="mt-1 text-[11px] text-primary">Siguiente envío: {new Date(item.next_run_time).toLocaleString('es-CO')}</p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">{recurrenceLabel(item.recurrence)}</p>
                        {item.message && <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{item.message}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleTestCustom(item.id)}
                          disabled={testing === item.id}
                          className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                          title="Enviar prueba"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCustom(item.id)}
                          className="rounded-lg border border-border p-2 text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {message && (
        <p className={`rounded-xl px-4 py-3 text-sm ${message.ok ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </p>
      )}

      <Dialog
        open={isReminderModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            requestCloseReminderModal();
            return;
          }
          setIsReminderModalOpen(open);
        }}
      >
        <DialogContent className="max-w-2xl border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar recordatorio' : 'Nuevo recordatorio'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Ajusta la agenda de este recordatorio.' : `Crear recordatorio para el ${form.date}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Título</label>
              <input
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: Revisar presupuesto"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Correo destino opcional</label>
              <input
                value={form.recipient}
                onChange={e => setForm(prev => ({ ...prev, recipient: e.target.value }))}
                placeholder="Si lo dejas vacío usa REPORT_RECIPIENT"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Fecha de inicio</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {recurrenceHelpText(form.recurrence)}
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Hora</label>
              <input
                type="time"
                value={toTimeString(form.hour, form.minute)}
                onChange={e => {
                  const { hour, minute } = fromTimeString(e.target.value);
                  setForm(prev => ({ ...prev, hour, minute }));
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Recurrencia</label>
              <select
                value={form.recurrence}
                onChange={e => {
                  const recurrence = e.target.value as CustomReminder['recurrence'];
                  setForm(prev => ({
                    ...prev,
                    recurrence,
                    times: recurrence === 'multi_daily'
                      ? (prev.times?.length ? prev.times : [{ hour: prev.hour, minute: prev.minute }])
                      : prev.times,
                  }));
                  if (recurrence === 'multi_daily') setIsTimesModalOpen(true);
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="once">Una sola vez</option>
                <option value="daily">Todos los días</option>
                <option value="multi_daily">Más de 1 vez en el día</option>
                <option value="weekly">Cada semana</option>
                <option value="monthly">Cada mes</option>
                <option value="yearly">Cada año</option>
              </select>
              {form.recurrence === 'multi_daily' ? (
                <button
                  type="button"
                  onClick={() => setIsTimesModalOpen(true)}
                  className="mt-2 text-[11px] font-medium text-primary hover:underline"
                >
                  Configurar horas: {form.times.map(time => toTimeString(time.hour, time.minute)).join(' · ')}
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
              <span className="text-sm text-foreground">Activo</span>
              <button
                onClick={() => setForm(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.enabled ? 'bg-primary' : 'bg-muted'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Mensaje del correo</label>
            <textarea
              value={form.message}
              onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
              rows={4}
              placeholder="Escribe lo que quieres que te recuerde este correo..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Notas opcionales</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
              placeholder="Contexto adicional o instrucciones para ti mismo"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={requestCloseReminderModal}
              className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveCustom}
              disabled={savingCustom || !form.title.trim() || !form.date}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {savingCustom ? 'Guardando...' : editingId ? 'Actualizar recordatorio' : 'Crear recordatorio'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDiscardChangesDialog} onOpenChange={setShowDiscardChangesDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Tienes cambios sin guardar en este recordatorio. Si sales ahora, se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDiscardChangesDialog(false);
                setIsReminderModalOpen(false);
                resetForm();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isTimesModalOpen} onOpenChange={setIsTimesModalOpen}>
        <DialogContent className="max-w-lg border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Más de 1 vez en el día</DialogTitle>
            <DialogDescription>
              Define las horas exactas en las que quieres que se recuerde este correo en esa fecha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {form.times.map((time, index) => (
              <div key={`${time.hour}-${time.minute}-${index}`} className="flex items-center gap-3">
                <input
                  type="time"
                  value={toTimeString(time.hour, time.minute)}
                  onChange={e => {
                    const { hour, minute } = fromTimeString(e.target.value);
                    setForm(prev => ({
                      ...prev,
                      times: prev.times.map((item, itemIndex) => itemIndex === index ? { hour, minute } : item),
                    }));
                  }}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => {
                    setForm(prev => ({
                      ...prev,
                      times: prev.times.length > 1 ? prev.times.filter((_, itemIndex) => itemIndex !== index) : prev.times,
                    }));
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Quitar
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                setForm(prev => ({
                  ...prev,
                  times: [...prev.times, { hour: 18, minute: 0 }],
                }));
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="h-4 w-4" />
              Agregar otra hora
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {loading && <p className="text-sm text-muted-foreground">Cargando configuración de recordatorios...</p>}
    </div>
  );
}
