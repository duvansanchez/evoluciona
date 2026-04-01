"""
Servicio de recordatorios diarios por email.
Gestiona config, jobs del scheduler y generación del HTML.
"""

import json
import logging
from datetime import date
from pathlib import Path
from typing import Any, Dict
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

DEFAULT_CONFIG: Dict[str, Any] = {
    "manana": {"enabled": False, "hour": 8, "minute": 0},
    "noche":  {"enabled": False, "hour": 20, "minute": 0},
}

JOB_ID_MANANA = "reminder_manana"
JOB_ID_NOCHE  = "reminder_noche"

_config_path = Path(__file__).resolve().parents[2] / "data" / "reminder_config.json"


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
