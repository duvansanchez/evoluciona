"""
Servicio de estadisticas: agrega respuestas semanales para el informe.
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date, timedelta
from typing import List, Dict, Any
import json


def get_week_range(reference: date) -> tuple[date, date]:
    """Retorna (lunes, domingo) de la semana que contiene 'reference'."""
    monday = reference - timedelta(days=reference.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def get_previous_week_range() -> tuple[date, date]:
    """Retorna (lunes, domingo) de la semana anterior a hoy."""
    today = date.today()
    last_monday = today - timedelta(days=today.weekday() + 7)
    last_sunday = last_monday + timedelta(days=6)
    return last_monday, last_sunday


def build_weekly_report(db: Session, week_start: date, week_end: date) -> Dict[str, Any]:
    """
    Construye el informe semanal completo.
    week_start: lunes
    week_end: domingo
    """
    # --- Sesiones del periodo ---
    sessions_rows = db.execute(
        text("""
            SELECT date, answered_questions, total_questions, completed_at
            FROM daily_sessions
            WHERE date >= :start AND date <= :end
        """),
        {"start": week_start.isoformat(), "end": week_end.isoformat()}
    ).fetchall()

    sessions_by_date = {row[0]: row for row in sessions_rows}
    days_total = 7
    days_completed = len([r for r in sessions_rows if r[1] and r[1] > 0])

    # Construir registro dia a dia
    day_records = []
    cursor = week_start
    while cursor <= week_end:
        ds = sessions_by_date.get(cursor.isoformat())
        day_records.append({
            "date": cursor.isoformat(),
            "weekday": cursor.strftime("%a"),
            "completed": bool(ds and ds[1] and ds[1] > 0),
            "answered": ds[1] if ds else 0,
            "total": ds[2] if ds else 0,
        })
        cursor += timedelta(days=1)

    # --- Preguntas activas ---
    questions = db.execute(
        text("SELECT id, text, type, options, categoria FROM question WHERE active = 1")
    ).fetchall()

    # --- Respuestas del periodo ---
    responses = db.execute(
        text("""
            SELECT r.pregunta_id, r.respuesta, CAST(r.fecha AS DATE) as dia
            FROM response r
            WHERE CAST(r.fecha AS DATE) >= :start
              AND CAST(r.fecha AS DATE) <= :end
        """),
        {"start": week_start.isoformat(), "end": week_end.isoformat()}
    ).fetchall()

    # Agrupar respuestas por pregunta
    resp_by_question: Dict[int, List[Dict]] = {}
    for row in responses:
        qid = row[0]
        if qid not in resp_by_question:
            resp_by_question[qid] = []
        resp_by_question[qid].append({"response": row[1], "date": str(row[2])})

    # --- Agregar estadisticas por pregunta ---
    question_stats = []
    for q in questions:
        qid, qtext, qtype, qoptions, qcategory = q
        q_responses = resp_by_question.get(qid, [])
        total = len(q_responses)

        stat: Dict[str, Any] = {
            "id": qid,
            "text": qtext,
            "type": qtype,
            "category": qcategory,
            "total_responses": total,
        }

        if qtype in ("radio", "select"):
            counts: Dict[str, int] = {}
            for r in q_responses:
                val = r["response"] or "Sin respuesta"
                counts[val] = counts.get(val, 0) + 1
            stat["distribution"] = sorted(
                [{"label": k, "count": v, "pct": round(v / total * 100) if total else 0}
                 for k, v in counts.items()],
                key=lambda x: x["count"], reverse=True
            )

        elif qtype == "checkbox":
            counts: Dict[str, int] = {}
            for r in q_responses:
                try:
                    selected = json.loads(r["response"])
                    if isinstance(selected, list):
                        for item in selected:
                            counts[item] = counts.get(item, 0) + 1
                except Exception:
                    val = r["response"] or "Sin respuesta"
                    counts[val] = counts.get(val, 0) + 1
            stat["distribution"] = sorted(
                [{"label": k, "count": v, "pct": round(v / max(total, 1) * 100)}
                 for k, v in counts.items()],
                key=lambda x: x["count"], reverse=True
            )

        else:  # text
            stat["text_responses"] = [
                {"date": r["date"], "response": r["response"]}
                for r in q_responses
            ]

        question_stats.append(stat)

    total_responses = sum(len(v) for v in resp_by_question.values())
    avg_completion = round(days_completed / days_total * 100)

    return {
        "week_label": _week_label(week_start, week_end),
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "days_total": days_total,
        "days_completed": days_completed,
        "completion_rate": avg_completion,
        "total_responses": total_responses,
        "day_records": day_records,
        "questions": question_stats,
    }


def _week_label(start: date, end: date) -> str:
    MONTHS = [
        "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ]
    if start.month == end.month:
        return f"Semana del {start.day} al {end.day} de {MONTHS[start.month]} {start.year}"
    return f"Semana del {start.day} de {MONTHS[start.month]} al {end.day} de {MONTHS[end.month]} {end.year}"
