/**
 * Estado de notificaciones basado en contador de intervalos diarios.
 *
 * Lógica:
 * - Hay 2 intervalos por día: mañana (< 13h) y tarde (>= 13h).
 * - Un contador entero (0–2) registra cuántos intervalos ya dispararon hoy.
 * - Si el contador < 2 Y el intervalo actual no ha disparado aún → lanzar.
 * - Al cerrar o ver la notificación → incrementar el contador y registrar el intervalo.
 * - Al cambiar de día → el contador se reinicia automáticamente a 0.
 */

const KEYS = {
  date: 'notifDate',
  count: 'notifIntervalCount',
  lastInterval: 'notifLastInterval',
};

const MAX_PER_DAY = 2;

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function getCurrentInterval(): 'morning' | 'afternoon' {
  return new Date().getHours() < 13 ? 'morning' : 'afternoon';
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 13) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function readState(): { count: number; lastInterval: string | null } {
  const today = getToday();
  const savedDate = localStorage.getItem(KEYS.date);

  if (savedDate !== today) {
    // Nuevo día → contador en cero
    return { count: 0, lastInterval: null };
  }

  return {
    count: parseInt(localStorage.getItem(KEYS.count) || '0', 10),
    lastInterval: localStorage.getItem(KEYS.lastInterval),
  };
}

/** Devuelve true si la notificación debe lanzarse en este momento. */
export function shouldShowNotification(): boolean {
  const { count, lastInterval } = readState();
  const current = getCurrentInterval();
  return count < MAX_PER_DAY && lastInterval !== current;
}

/** Registra que la notificación se mostró en el intervalo actual. */
export function markNotificationShown(): void {
  const today = getToday();
  const { count } = readState();
  const current = getCurrentInterval();

  localStorage.setItem(KEYS.date, today);
  localStorage.setItem(KEYS.count, String(Math.min(count + 1, MAX_PER_DAY)));
  localStorage.setItem(KEYS.lastInterval, current);
}

/** Devuelve true si la campana tiene notificaciones no vistas en el intervalo actual. */
export function isBellUnread(): boolean {
  return shouldShowNotification();
}

/** Registra que el usuario vio las notificaciones vía la campana. */
export function markBellRead(): void {
  markNotificationShown();
}
