/**
 * Estado de notificaciones basado en dos intervalos diarios.
 *
 * Intervalos:
 *  - morning: antes de las 13h
 *  - afternoon: 13h en adelante
 *
 * Cada intervalo se registra de forma independiente por día.
 * El punto rojo de la campana aparece cuando el intervalo actual NO ha sido visto.
 */

const KEYS = {
  date: 'notifDate',
  morningRead: 'notifMorningRead',
  afternoonRead: 'notifAfternoonRead',
};

export const OPEN_WELCOME_MODAL_EVENT = 'evoluciona:open-welcome-modal';

function getToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function readState(): { morningRead: boolean; afternoonRead: boolean } {
  const today = getToday();
  const savedDate = localStorage.getItem(KEYS.date);

  if (savedDate !== today) {
    return { morningRead: false, afternoonRead: false };
  }

  return {
    morningRead: localStorage.getItem(KEYS.morningRead) === 'true',
    afternoonRead: localStorage.getItem(KEYS.afternoonRead) === 'true',
  };
}

/** Devuelve true si el intervalo actual NO ha sido visto hoy. */
export function isBellUnread(): boolean {
  const { morningRead, afternoonRead } = readState();
  const current = getCurrentInterval();
  return current === 'morning' ? !morningRead : !afternoonRead;
}

/** Devuelve si cada recordatorio fue leído hoy. */
export function getReadState(): { morningRead: boolean; afternoonRead: boolean } {
  return readState();
}

/** @deprecated Usar markBellRead() en su lugar. Alias para compatibilidad. */
export function markNotificationShown(): void {
  markBellRead();
}

/** @deprecated Usar isBellUnread() en su lugar. Alias para compatibilidad. */
export function shouldShowNotification(): boolean {
  return isBellUnread();
}

/** Registra que el usuario vio el recordatorio del intervalo actual. */
export function markBellRead(): void {
  const today = getToday();
  const current = getCurrentInterval();
  localStorage.setItem(KEYS.date, today);
  if (current === 'morning') {
    localStorage.setItem(KEYS.morningRead, 'true');
  } else {
    localStorage.setItem(KEYS.afternoonRead, 'true');
  }
}

export function requestWelcomeModalOpen(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_WELCOME_MODAL_EVENT));
}
