import { useEffect, useState } from 'react';
import { Bell, BellOff, Moon, Send, Sun, Save } from 'lucide-react';
import { remindersAPI } from '@/services/api';
import type { ReminderConfig } from '@/services/api';

const DEFAULT_CONFIG: ReminderConfig = {
  manana: { enabled: false, hour: 8, minute: 0 },
  noche:  { enabled: false, hour: 20, minute: 0 },
};

function pad(n: number) { return String(n).padStart(2, '0'); }

function toTimeString(hour: number, minute: number) {
  return `${pad(hour)}:${pad(minute)}`;
}

function fromTimeString(t: string): { hour: number; minute: number } {
  const [h, m] = t.split(':').map(Number);
  return { hour: h, minute: m };
}

interface ReminderCardProps {
  parte: 'manana' | 'noche';
  config: ReminderConfig['manana'];
  onChange: (cfg: ReminderConfig['manana']) => void;
  onTest: () => void;
  testing: boolean;
}

function ReminderCard({ parte, config, onChange, onTest, testing }: ReminderCardProps) {
  const isMorning = parte === 'manana';
  const Icon = isMorning ? Sun : Moon;
  const iconColor = isMorning ? 'text-amber-500' : 'text-indigo-500';
  const label = isMorning ? 'Recordatorio de mañana' : 'Recordatorio de noche';
  const defaultTime = isMorning ? '08:00' : '20:00';

  return (
    <div className={`rounded-xl border p-5 transition-all ${config.enabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Icon className={`h-5 w-5 ${iconColor}`} />
          <span className="text-sm font-semibold text-foreground">{label}</span>
        </div>
        <button
          onClick={() => onChange({ ...config, enabled: !config.enabled })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.enabled ? 'bg-primary' : 'bg-muted'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Hora */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Hora de envío</label>
          <input
            type="time"
            disabled={!config.enabled}
            value={toTimeString(config.hour, config.minute)}
            onChange={e => {
              const { hour, minute } = fromTimeString(e.target.value);
              onChange({ ...config, hour, minute });
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </div>
        <div className="pt-5">
          <button
            onClick={onTest}
            disabled={testing}
            title="Enviar correo de prueba ahora"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {testing ? 'Enviando...' : 'Probar'}
          </button>
        </div>
      </div>

      {config.enabled && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Se enviará a <strong>{toTimeString(config.hour, config.minute)}</strong> todos los días con tus pendientes del día.
        </p>
      )}
    </div>
  );
}

export default function Progress() {
  const [config, setConfig] = useState<ReminderConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState<'manana' | 'noche' | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    remindersAPI.getConfig()
      .then(setConfig)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await remindersAPI.updateConfig(config);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // silencioso
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (parte: 'manana' | 'noche') => {
    setTesting(parte);
    setTestMsg(null);
    try {
      await remindersAPI.testReminder(parte);
      setTestMsg({ ok: true, text: '✓ Correo de prueba enviado, revisa tu bandeja.' });
    } catch (e: any) {
      setTestMsg({ ok: false, text: `✗ ${e.message}` });
    } finally {
      setTesting(null);
      setTimeout(() => setTestMsg(null), 5000);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-heading font-bold text-foreground">Progreso</h1>
        <p className="text-sm text-muted-foreground mt-1">Configuración y estadísticas</p>
      </div>

      {/* Recordatorios */}
      <section className="max-w-lg">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Recordatorios por correo</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Recibe un correo diario con tus objetivos, rutinas y preguntas pendientes del día.
        </p>

        {loading ? (
          <div className="space-y-3">
            <div className="h-32 rounded-xl bg-muted animate-pulse" />
            <div className="h-32 rounded-xl bg-muted animate-pulse" />
          </div>
        ) : (
          <div className="space-y-3">
            <ReminderCard
              parte="manana"
              config={config.manana}
              onChange={cfg => setConfig(prev => ({ ...prev, manana: cfg }))}
              onTest={() => handleTest('manana')}
              testing={testing === 'manana'}
            />
            <ReminderCard
              parte="noche"
              config={config.noche}
              onChange={cfg => setConfig(prev => ({ ...prev, noche: cfg }))}
              onTest={() => handleTest('noche')}
              testing={testing === 'noche'}
            />

            {testMsg && (
              <p className={`text-xs px-3 py-2 rounded-lg ${testMsg.ok ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                {testMsg.text}
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                {!config.manana.enabled && !config.noche.enabled
                  ? <span className="flex items-center gap-1"><BellOff className="h-3 w-3" /> Sin recordatorios activos</span>
                  : `${[config.manana.enabled && 'mañana', config.noche.enabled && 'noche'].filter(Boolean).join(' y ')} activado`
                }
              </p>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  saved
                    ? 'bg-green-500 text-white'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                } disabled:opacity-50`}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
