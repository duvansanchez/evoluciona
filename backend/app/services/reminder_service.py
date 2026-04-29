"""
Servicio de recordatorios diarios por email.
Gestiona config, jobs del scheduler y generación del HTML.
"""

import json
import logging
from datetime import date, datetime
from uuid import uuid4
from pathlib import Path
from typing import Any, Dict, List
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger

logger = logging.getLogger(__name__)

DEFAULT_CONFIG: Dict[str, Any] = {
    "manana": {"enabled": False, "hour": 8, "minute": 0},
    "noche":  {"enabled": False, "hour": 20, "minute": 0},
}

JOB_ID_MANANA = "reminder_manana"
JOB_ID_NOCHE  = "reminder_noche"

_config_path = Path(__file__).resolve().parents[2] / "data" / "reminder_config.json"
_custom_reminders_path = Path(__file__).resolve().parents[2] / "data" / "custom_reminders.json"
CUSTOM_JOB_PREFIX = "custom_reminder_"
VALID_RECURRENCES = {"once", "daily", "weekly", "monthly", "yearly", "multi_daily"}


# ── Config ─────────────────────────────────────────────────────────────────────

def _ensure_dir() -> None:
    _config_path.parent.mkdir(parents=True, exist_ok=True)


def load_config() -> Dict[str, Any]:
    _ensure_dir()
    if not _config_path.exists():
        save_config(DEFAULT_CONFIG)
        return {k: dict(v) for k, v in DEFAULT_CONFIG.items()}
    with _config_path.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    result = {}
    for part in ("manana", "noche"):
        result[part] = {**DEFAULT_CONFIG[part], **raw.get(part, {})}
    return result


def load_custom_reminders() -> List[Dict[str, Any]]:
    _ensure_dir()
    if not _custom_reminders_path.exists():
        with _custom_reminders_path.open("w", encoding="utf-8") as f:
            json.dump([], f, indent=2, ensure_ascii=False)
        return []
    with _custom_reminders_path.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    if not isinstance(raw, list):
        return []
    return [_normalize_custom_reminder(item) for item in raw if isinstance(item, dict)]


def save_custom_reminders(reminders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    _ensure_dir()
    normalized = [_normalize_custom_reminder(item) for item in reminders]
    with _custom_reminders_path.open("w", encoding="utf-8") as f:
        json.dump(normalized, f, indent=2, ensure_ascii=False)
    return normalized


def _normalize_custom_reminder(reminder: Dict[str, Any]) -> Dict[str, Any]:
    reminder_id = str(reminder.get("id") or uuid4())
    title = str(reminder.get("title") or "").strip()
    if not title:
        raise ValueError("title es obligatorio")

    reminder_date = str(reminder.get("date") or "").strip()
    try:
        date.fromisoformat(reminder_date)
    except ValueError as exc:
        raise ValueError("date debe usar formato YYYY-MM-DD") from exc

    hour = int(reminder.get("hour", 8))
    minute = int(reminder.get("minute", 0))
    if not (0 <= hour <= 23):
        raise ValueError("hour debe estar entre 0 y 23")
    if not (0 <= minute <= 59):
        raise ValueError("minute debe estar entre 0 y 59")

    recurrence = str(reminder.get("recurrence") or "once").lower().strip()
    if recurrence not in VALID_RECURRENCES:
        raise ValueError("recurrence inválida")

    raw_times = reminder.get("times") or []
    normalized_times: List[Dict[str, int]] = []
    if recurrence == "multi_daily":
        if not isinstance(raw_times, list) or len(raw_times) == 0:
            raise ValueError("times es obligatorio para recurrence='multi_daily'")
        for item in raw_times:
            if not isinstance(item, dict):
                raise ValueError("times debe ser una lista de objetos {hour, minute}")
            item_hour = int(item.get("hour", 0))
            item_minute = int(item.get("minute", 0))
            if not (0 <= item_hour <= 23):
                raise ValueError("times.hour debe estar entre 0 y 23")
            if not (0 <= item_minute <= 59):
                raise ValueError("times.minute debe estar entre 0 y 59")
            normalized_times.append({"hour": item_hour, "minute": item_minute})
        normalized_times = sorted(normalized_times, key=lambda item: (item["hour"], item["minute"]))
    else:
        normalized_times = []

    recipient = str(reminder.get("recipient") or "").strip() or None
    notes = str(reminder.get("notes") or "").strip() or None

    return {
        "id": reminder_id,
        "title": title,
        "message": str(reminder.get("message") or "").strip(),
        "date": reminder_date,
        "hour": hour,
        "minute": minute,
        "times": normalized_times,
        "recurrence": recurrence,
        "enabled": bool(reminder.get("enabled", True)),
        "recipient": recipient,
        "notes": notes,
        "created_at": str(reminder.get("created_at") or datetime.now().isoformat()),
    }


def create_custom_reminder(payload: Dict[str, Any]) -> Dict[str, Any]:
    reminder = _normalize_custom_reminder({**payload, "id": str(uuid4()), "created_at": datetime.now().isoformat()})
    reminders = load_custom_reminders()
    reminders.append(reminder)
    save_custom_reminders(reminders)
    sync_reminder_jobs()
    return reminder


def update_custom_reminder(reminder_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    reminders = load_custom_reminders()
    existing = next((item for item in reminders if item["id"] == reminder_id), None)
    if not existing:
        raise KeyError("Recordatorio no encontrado")
    updated = _normalize_custom_reminder({**existing, **payload, "id": reminder_id, "created_at": existing.get("created_at")})
    next_items = [updated if item["id"] == reminder_id else item for item in reminders]
    save_custom_reminders(next_items)
    sync_reminder_jobs()
    return updated


def delete_custom_reminder(reminder_id: str) -> bool:
    reminders = load_custom_reminders()
    next_items = [item for item in reminders if item["id"] != reminder_id]
    if len(next_items) == len(reminders):
        return False
    save_custom_reminders(next_items)
    sync_reminder_jobs()
    return True


def save_config(config: Dict[str, Any]) -> Dict[str, Any]:
    _ensure_dir()
    # Validar rangos
    for part in ("manana", "noche"):
        cfg = config.get(part, {})
        h = int(cfg.get("hour", 8))
        m = int(cfg.get("minute", 0))
        if not (0 <= h <= 23):
            raise ValueError(f"hour fuera de rango en '{part}'")
        if not (0 <= m <= 59):
            raise ValueError(f"minute fuera de rango en '{part}'")
    with _config_path.open("w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    return config


# ── Email HTML ─────────────────────────────────────────────────────────────────

def _section(title: str, color: str, body: str) -> str:
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0"
           style="margin-bottom:20px;border:1px solid #e5e7eb;border-radius:10px;
                  overflow:hidden;border-collapse:separate;">
      <tr><td style="background:{color};padding:12px 16px;">
        <span style="color:white;font-weight:600;font-size:15px;">{title}</span>
      </td></tr>
      <tr><td style="padding:14px 16px;background:#fafafa;">{body}</td></tr>
    </table>"""


def build_reminder_html(parte: str) -> str:
    from app.db.database import get_session_factory
    from sqlalchemy import text

    today_str = date.today().isoformat()
    session_factory = get_session_factory()
    db = session_factory()

    try:
        # Objetivos diarios pendientes
        rows = db.execute(text("""
            SELECT titulo, icono FROM objetivos
            WHERE LOWER(categoria) = 'diario'
              AND completado = 0
              AND objetivo_padre_id IS NULL
              AND (
                recurrente = 1
                OR CONVERT(VARCHAR(10), fecha_creacion, 120) = :today
              )
            ORDER BY titulo
        """), {"today": today_str}).fetchall()
        objetivos = [{"titulo": r[0], "icono": r[1] or "🎯"} for r in rows]

        # Rutinas pendientes hoy
        rows = db.execute(text("""
            SELECT ra.parte_dia, r.nombre
            FROM rutina_asignaciones ra
            JOIN rutinas r ON r.id = ra.rutina_id
            WHERE ra.fecha = :today AND ra.completada = 0
            ORDER BY ra.parte_dia
        """), {"today": today_str}).fetchall()
        rutinas = [{"parte_dia": r[0], "nombre": r[1]} for r in rows]

        # Preguntas
        total_q = db.execute(text(
            "SELECT COUNT(*) FROM question WHERE active = 1"
        )).scalar() or 0
        respondidas = db.execute(text(
            "SELECT COUNT(DISTINCT question_id) FROM response "
            "WHERE CONVERT(VARCHAR(10), date, 120) = :today"
        ), {"today": today_str}).scalar() or 0
        pendientes_q = max(0, total_q - respondidas)

    finally:
        db.close()

    greeting = "Buenos días ☀️" if parte == "manana" else "Buenas noches 🌙"
    PARTE_LABELS = {"morning": "☀️ Mañana", "afternoon": "🌤️ Tarde", "evening": "🌙 Noche"}

    sections = ""

    if objetivos:
        items = "".join(
            f'<div style="padding:5px 0;font-size:14px;color:#374151;">'
            f'{o["icono"]} {o["titulo"]}</div>'
            for o in objetivos
        )
        sections += _section(
            f"🎯 Objetivos diarios pendientes ({len(objetivos)})",
            "#4f46e5", items
        )

    if rutinas:
        items = "".join(
            f'<div style="padding:5px 0;font-size:14px;color:#374151;">'
            f'{PARTE_LABELS.get(r["parte_dia"], r["parte_dia"])} — {r["nombre"]}</div>'
            for r in rutinas
        )
        sections += _section(
            f"📅 Rutinas pendientes ({len(rutinas)})",
            "#d97706", items
        )

    if pendientes_q > 0:
        sections += _section(
            "💬 Preguntas del día",
            "#7c3aed",
            f'<p style="font-size:14px;color:#374151;margin:0;">'
            f'Respondiste <strong>{respondidas}</strong> de <strong>{total_q}</strong> preguntas. '
            f'Quedan <strong>{pendientes_q}</strong> por responder.</p>'
        )

    if not sections:
        sections = (
            '<p style="font-size:15px;color:#374151;text-align:center;padding:20px 0;">'
            '¡Todo al día! 🎉 Buen trabajo hoy.</p>'
        )

    return f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:white;border-radius:16px;overflow:hidden;
                    box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#4f46e5;padding:28px 32px;">
            <h1 style="color:white;margin:0;font-size:22px;font-weight:700;">Evoluciona</h1>
            <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:14px;">
              {greeting} — {today_str}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;">
            {sections}
            <p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:8px;">
              Abre Evoluciona para registrar tu progreso.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def build_custom_reminder_html(reminder: Dict[str, Any]) -> str:
    title = reminder.get("title", "Recordatorio")
    message = (reminder.get("message") or "").replace("\n", "<br>")
    recurrence_labels = {
        "once": "Una sola vez",
        "daily": "Todos los días",
        "weekly": "Cada semana",
        "monthly": "Cada mes",
        "yearly": "Cada año",
    }
    recurrence = recurrence_labels.get(reminder.get("recurrence"), reminder.get("recurrence", "once"))
    notes = reminder.get("notes")
    notes_block = (
        f'<div style="margin-top:14px;font-size:13px;color:#6b7280;"><strong>Notas:</strong><br>{notes.replace("\n", "<br>")}</div>'
        if notes else ""
    )

    return f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#0f172a;padding:28px 32px;">
            <p style="margin:0;color:rgba(255,255,255,0.78);font-size:13px;letter-spacing:1px;text-transform:uppercase;">Recordatorio</p>
            <h1 style="color:white;margin:8px 0 0;font-size:24px;font-weight:700;">{title}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;">
            <div style="font-size:15px;color:#374151;line-height:1.7;">{message or 'Tienes un recordatorio pendiente en Evoluciona.'}</div>
            <div style="margin-top:18px;padding:14px 16px;border-radius:12px;background:#f8fafc;border:1px solid #e5e7eb;font-size:14px;color:#374151;line-height:1.7;">
              <div><strong>Fecha base:</strong> {reminder.get('date')}</div>
              <div><strong>Hora:</strong> {int(reminder.get('hour', 0)):02d}:{int(reminder.get('minute', 0)):02d}</div>
              <div><strong>Recurrencia:</strong> {recurrence}</div>
            </div>
            {notes_block}
            <p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:18px;">Abre Evoluciona para revisar este recordatorio.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


# ── Envío ──────────────────────────────────────────────────────────────────────

def send_reminder(parte: str) -> bool:
    from app.services.email_service import send_weekly_report
    label = "matutino ☀️" if parte == "manana" else "nocturno 🌙"
    subject = f"Recordatorio {label} — Evoluciona"
    try:
        html = build_reminder_html(parte)
        ok = send_weekly_report(html, subject)
        if ok:
            logger.info(f"[Reminder] Recordatorio '{parte}' enviado")
        else:
            logger.error(f"[Reminder] Falló el envío del recordatorio '{parte}'")
        return ok
    except Exception as e:
        logger.error(f"[Reminder] Error en recordatorio '{parte}': {e}", exc_info=True)
        return False


def send_custom_reminder(reminder_id: str) -> bool:
    from app.services.email_service import send_html_email
    reminders = load_custom_reminders()
    reminder = next((item for item in reminders if item["id"] == reminder_id), None)
    if not reminder:
        logger.error(f"[Reminder] Recordatorio personalizado no encontrado: {reminder_id}")
        return False
    try:
        html = build_custom_reminder_html(reminder)
        subject = f"Recordatorio — {reminder['title']}"
        ok = send_html_email(html, subject, reminder.get("recipient"))
        if ok:
            logger.info(f"[Reminder] Recordatorio personalizado '{reminder_id}' enviado")
            if reminder.get("recurrence") == "once":
                update_custom_reminder(reminder_id, {"enabled": False})
        else:
            logger.error(f"[Reminder] Falló el envío del recordatorio personalizado '{reminder_id}'")
        return ok
    except Exception as e:
        logger.error(f"[Reminder] Error en recordatorio personalizado '{reminder_id}': {e}", exc_info=True)
        return False


def _custom_job_id(reminder_id: str) -> str:
    return f"{CUSTOM_JOB_PREFIX}{reminder_id}"


def _custom_job_id_for_time(reminder_id: str, index: int) -> str:
    return f"{CUSTOM_JOB_PREFIX}{reminder_id}_{index}"


def _trigger_for_custom_reminder(reminder: Dict[str, Any]):
    base_date = date.fromisoformat(reminder["date"])
    hour = int(reminder["hour"])
    minute = int(reminder["minute"])
    recurrence = reminder["recurrence"]
    if recurrence == "once":
        run_at = datetime(base_date.year, base_date.month, base_date.day, hour, minute)
        return DateTrigger(run_date=run_at, timezone="America/Bogota")
    if recurrence == "daily":
        return CronTrigger(hour=hour, minute=minute, timezone="America/Bogota")
    if recurrence == "multi_daily":
        raise ValueError("multi_daily usa múltiples envíos en la fecha seleccionada")
    if recurrence == "weekly":
        weekday_names = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        return CronTrigger(day_of_week=weekday_names[base_date.weekday()], hour=hour, minute=minute, timezone="America/Bogota")
    if recurrence == "monthly":
        return CronTrigger(day=base_date.day, hour=hour, minute=minute, timezone="America/Bogota")
    return CronTrigger(month=base_date.month, day=base_date.day, hour=hour, minute=minute, timezone="America/Bogota")


# ── Scheduler ──────────────────────────────────────────────────────────────────

def sync_reminder_jobs() -> None:
    """Sincroniza los jobs del scheduler con la config guardada."""
    from app.services.report_scheduler_service import get_scheduler
    scheduler = get_scheduler()
    config = load_config()

    for parte, job_id in (("manana", JOB_ID_MANANA), ("noche", JOB_ID_NOCHE)):
        try:
            scheduler.remove_job(job_id)
        except Exception:
            pass

        cfg = config[parte]
        if cfg["enabled"]:
            scheduler.add_job(
                lambda p=parte: send_reminder(p),
                CronTrigger(hour=cfg["hour"], minute=cfg["minute"], timezone="America/Bogota"),
                id=job_id,
                replace_existing=True,
            )
            logger.info(
                f"[Reminder] Job '{job_id}' programado a las "
                f"{cfg['hour']:02d}:{cfg['minute']:02d}"
            )
        else:
            logger.info(f"[Reminder] Job '{job_id}' desactivado")

    existing_custom_jobs = [job.id for job in scheduler.get_jobs() if job.id.startswith(CUSTOM_JOB_PREFIX)]
    for job_id in existing_custom_jobs:
        try:
            scheduler.remove_job(job_id)
        except Exception:
            pass

    for reminder in load_custom_reminders():
        if not reminder.get("enabled", True):
            continue
        try:
            if reminder.get("recurrence") == "multi_daily":
                base_date = date.fromisoformat(reminder["date"])
                times = reminder.get("times") or []
                for index, time_item in enumerate(times):
                    job_id = _custom_job_id_for_time(reminder["id"], index)
                    scheduler.add_job(
                        lambda reminder_id=reminder["id"]: send_custom_reminder(reminder_id),
                        DateTrigger(
                            run_date=datetime(
                                base_date.year,
                                base_date.month,
                                base_date.day,
                                int(time_item["hour"]),
                                int(time_item["minute"]),
                            ),
                            timezone="America/Bogota",
                        ),
                        id=job_id,
                        replace_existing=True,
                    )
                    logger.info(f"[Reminder] Job personalizado '{job_id}' programado")
            else:
                job_id = _custom_job_id(reminder["id"])
                scheduler.add_job(
                    lambda reminder_id=reminder["id"]: send_custom_reminder(reminder_id),
                    _trigger_for_custom_reminder(reminder),
                    id=job_id,
                    replace_existing=True,
                )
                logger.info(f"[Reminder] Job personalizado '{job_id}' programado")
        except Exception as exc:
            logger.error(f"[Reminder] No se pudo programar recordatorio '{reminder['id']}': {exc}")


def get_custom_reminders_with_next_run() -> List[Dict[str, Any]]:
    from app.services.report_scheduler_service import get_scheduler
    scheduler = get_scheduler()
    items: List[Dict[str, Any]] = []
    for reminder in load_custom_reminders():
        matching_jobs = [job for job in scheduler.get_jobs() if job.id.startswith(f"{CUSTOM_JOB_PREFIX}{reminder['id']}")]
        next_run_candidates = [job.next_run_time for job in matching_jobs if job.next_run_time]
        next_run = min(next_run_candidates).isoformat() if next_run_candidates else None
        items.append({
            **reminder,
            "next_run_time": next_run,
        })
    return items
