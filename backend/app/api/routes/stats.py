"""
Endpoints de estadísticas y dashboard.
"""

import random
from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import get_db
from app.models.models import Phrase

router = APIRouter(prefix="/api/stats", tags=["stats"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _calc_streak(dates: list, today_str: str) -> int:
    """Cuenta días consecutivos hasta hoy (o ayer, para no romper a mitad de día)."""
    if not dates:
        return 0
    date_set = set(str(d) for d in dates)
    today = date.fromisoformat(today_str)
    yesterday = today - timedelta(days=1)

    # El streak puede arrancar hoy o ayer (si hoy aún no terminó)
    start = today if today_str in date_set else (yesterday if yesterday.isoformat() in date_set else None)
    if start is None:
        return 0

    streak = 0
    current = start
    while current.isoformat() in date_set:
        streak += 1
        current -= timedelta(days=1)
    return streak


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    """Datos completos para el dashboard de inicio."""
    today_str = date.today().isoformat()

    # ── Rachas ─────────────────────────────────────────────────────────────────

    rows = db.execute(text(
        "SELECT DISTINCT fecha FROM rutina_asignaciones WHERE completada = 1 ORDER BY fecha DESC"
    )).fetchall()
    racha_rutinas = _calc_streak([r[0] for r in rows], today_str)

    rows = db.execute(text(
        "SELECT DISTINCT CONVERT(VARCHAR(10), date, 120) as d "
        "FROM response WHERE date IS NOT NULL ORDER BY d DESC"
    )).fetchall()
    racha_preguntas = _calc_streak([r[0] for r in rows], today_str)

    rows = db.execute(text(
        "SELECT DISTINCT CONVERT(VARCHAR(10), fecha_completado, 120) as d "
        "FROM objetivos WHERE LOWER(categoria) = 'diario' AND completado = 1 "
        "AND fecha_completado IS NOT NULL ORDER BY d DESC"
    )).fetchall()
    racha_objetivos = _calc_streak([r[0] for r in rows], today_str)

    # ── Objetivos diarios hoy ─────────────────────────────────────────────────

    total_obj = db.execute(text("""
        SELECT COUNT(*) FROM objetivos
        WHERE LOWER(categoria) = 'diario'
          AND objetivo_padre_id IS NULL
          AND (
            (recurrente = 1 AND (completado = 0 OR CONVERT(VARCHAR(10), fecha_completado, 120) = :today))
            OR CONVERT(VARCHAR(10), fecha_creacion, 120) = :today
          )
    """), {"today": today_str}).scalar() or 0

    completados_obj = db.execute(text("""
        SELECT COUNT(*) FROM objetivos
        WHERE LOWER(categoria) = 'diario'
          AND objetivo_padre_id IS NULL
          AND completado = 1
          AND CONVERT(VARCHAR(10), fecha_completado, 120) = :today
          AND (recurrente = 1 OR CONVERT(VARCHAR(10), fecha_creacion, 120) = :today)
    """), {"today": today_str}).scalar() or 0

    # ── Rutinas hoy ───────────────────────────────────────────────────────────

    total_rutinas = db.execute(text(
        "SELECT COUNT(*) FROM rutina_asignaciones WHERE fecha = :today"
    ), {"today": today_str}).scalar() or 0

    completadas_rutinas = db.execute(text(
        "SELECT COUNT(*) FROM rutina_asignaciones WHERE fecha = :today AND completada = 1"
    ), {"today": today_str}).scalar() or 0

    # ── Preguntas hoy ─────────────────────────────────────────────────────────

    total_preguntas = db.execute(text(
        "SELECT COUNT(*) FROM question WHERE active = 1"
    )).scalar() or 0

    respondidas_hoy = db.execute(text(
        "SELECT COUNT(DISTINCT question_id) FROM response "
        "WHERE CONVERT(VARCHAR(10), date, 120) = :today"
    ), {"today": today_str}).scalar() or 0

    # ── Frase del día (misma todo el día, cambia cada día) ────────────────────

    frases = db.query(Phrase).filter(Phrase.activa == True).all()
    frase_del_dia = None
    if frases:
        random.seed(today_str)
        f = random.choice(frases)
        frase_del_dia = {"texto": f.texto, "autor": f.autor}

    return {
        "rachas": {
            "rutinas": racha_rutinas,
            "preguntas": racha_preguntas,
            "objetivos": racha_objetivos,
        },
        "hoy": {
            "objetivos": {"total": total_obj, "completados": completados_obj},
            "rutinas": {"total": total_rutinas, "completadas": completadas_rutinas},
            "preguntas": {"respondidas": respondidas_hoy, "total": total_preguntas},
        },
        "frase_del_dia": frase_del_dia,
        "today": today_str,
    }
