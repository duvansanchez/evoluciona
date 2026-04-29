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


def get_month_range(reference: date) -> tuple[date, date]:
    """Retorna (primer_dia, ultimo_dia) del mes que contiene 'reference'."""
    month_start = reference.replace(day=1)
    if reference.month == 12:
        next_month_start = reference.replace(year=reference.year + 1, month=1, day=1)
    else:
        next_month_start = reference.replace(month=reference.month + 1, day=1)
    month_end = next_month_start - timedelta(days=1)
    return month_start, month_end


def get_previous_month_range() -> tuple[date, date]:
    """Retorna (primer_dia, ultimo_dia) del mes anterior a hoy."""
    today = date.today()
    current_month_start = today.replace(day=1)
    previous_month_end = current_month_start - timedelta(days=1)
    return get_month_range(previous_month_end)


def build_monthly_report(db: Session, month_start: date, month_end: date) -> Dict[str, Any]:
    """
    Construye el informe mensual completo.
    """
    report = _build_period_report(db, month_start, month_end)
    report["week_label"] = _month_label(month_start, month_end)
    report["report_title"] = "Informe Mensual"
    return report


def build_weekly_report(db: Session, week_start: date, week_end: date) -> Dict[str, Any]:
    """
    Construye el informe semanal completo.
    week_start: lunes
    week_end: domingo
    """
    report = _build_period_report(db, week_start, week_end)
    report["week_label"] = _week_label(week_start, week_end)
    report["report_title"] = "Informe Semanal"
    return report


def _build_period_report(db: Session, period_start: date, period_end: date) -> Dict[str, Any]:
    """
    Construye un informe para cualquier rango de fechas inclusivo.
    """
    # --- Respuestas agrupadas por dia (fuente de verdad para completitud) ---
    daily_counts_rows = db.execute(
        text("""
            SELECT CAST(date AS DATE) as dia, COUNT(DISTINCT question_id) as answered
            FROM response
            WHERE CAST(date AS DATE) >= :start AND CAST(date AS DATE) <= :end
            GROUP BY CAST(date AS DATE)
        """),
        {"start": period_start.isoformat(), "end": period_end.isoformat()}
    ).fetchall()
    daily_counts = {str(row[0]): row[1] for row in daily_counts_rows}

    skipped_counts_rows = db.execute(
        text("""
            SELECT fecha as dia, COUNT(DISTINCT question_id) as skipped
            FROM question_skip_days
            WHERE fecha >= :start AND fecha <= :end
            GROUP BY fecha
        """),
        {"start": period_start.isoformat(), "end": period_end.isoformat()}
    ).fetchall()
    skipped_counts = {str(row[0]): row[1] for row in skipped_counts_rows}

    # Total de preguntas activas (referencia para calcular completitud)
    total_active = db.execute(
        text("SELECT COUNT(*) FROM question WHERE active = 1")
    ).scalar() or 1

    days_total = (period_end - period_start).days + 1
    days_completed = 0

    # Construir registro dia a dia
    day_records = []
    cursor = period_start
    while cursor <= period_end:
        answered = daily_counts.get(cursor.isoformat(), 0)
        skipped = skipped_counts.get(cursor.isoformat(), 0)
        completed = (answered + skipped) > 0
        if completed:
            days_completed += 1
        day_records.append({
            "date": cursor.isoformat(),
            "weekday": cursor.strftime("%a"),
            "completed": completed,
            "answered": answered,
            "skipped": skipped,
            "total": total_active,
        })
        cursor += timedelta(days=1)

    # --- Preguntas activas + preguntas con actividad historica en el periodo ---
    questions = db.execute(
        text("""
            SELECT q.id, q.text, q.type, q.options, q.categoria, q.active
            FROM question q
            WHERE q.active = 1
               OR EXISTS (
                    SELECT 1
                    FROM response r
                    WHERE r.question_id = q.id
                      AND CAST(r.date AS DATE) >= :start
                      AND CAST(r.date AS DATE) <= :end
               )
               OR EXISTS (
                    SELECT 1
                    FROM question_feedback f
                    WHERE f.question_id = q.id
                      AND f.fecha >= :start
                      AND f.fecha <= :end
               )
               OR EXISTS (
                    SELECT 1
                    FROM question_skip_days s
                    WHERE s.question_id = q.id
                      AND s.fecha >= :start
                      AND s.fecha <= :end
               )
            ORDER BY q.active DESC, q.id ASC
        """),
        {"start": period_start.isoformat(), "end": period_end.isoformat()}
    ).fetchall()

    # --- Respuestas del periodo ---
    responses = db.execute(
        text("""
            SELECT r.question_id, r.response, CAST(r.date AS DATE) as dia
            FROM response r
            WHERE CAST(r.date AS DATE) >= :start
              AND CAST(r.date AS DATE) <= :end
        """),
        {"start": period_start.isoformat(), "end": period_end.isoformat()}
    ).fetchall()

    feedback_rows = db.execute(
        text("""
            SELECT question_id, fecha, texto
            FROM question_feedback
            WHERE fecha >= :start
              AND fecha <= :end
        """),
        {"start": period_start.isoformat(), "end": period_end.isoformat()}
    ).fetchall()

    skip_rows = db.execute(
        text("""
            SELECT question_id, fecha
            FROM question_skip_days
            WHERE fecha >= :start
              AND fecha <= :end
        """),
        {"start": period_start.isoformat(), "end": period_end.isoformat()}
    ).fetchall()

    # Agrupar respuestas por pregunta
    resp_by_question: Dict[int, List[Dict]] = {}
    for row in responses:
        qid = row[0]
        if qid not in resp_by_question:
            resp_by_question[qid] = []
        resp_by_question[qid].append({"response": row[1], "date": str(row[2])})

    feedbacks_by_question: Dict[int, List[Dict[str, str]]] = {}
    for row in feedback_rows:
        qid = row[0]
        if qid not in feedbacks_by_question:
            feedbacks_by_question[qid] = []
        feedbacks_by_question[qid].append({
            "date": str(row[1]),
            "text": row[2] or "",
        })

    skips_by_question: Dict[int, List[Dict[str, str]]] = {}
    skips_by_date: Dict[str, List[int]] = {}
    for row in skip_rows:
        qid = row[0]
        skip_date = str(row[1])
        if qid not in skips_by_question:
            skips_by_question[qid] = []
        skips_by_question[qid].append({"date": skip_date})
        if skip_date not in skips_by_date:
            skips_by_date[skip_date] = []
        skips_by_date[skip_date].append(qid)

    # --- Agregar estadisticas por pregunta ---
    question_stats = []
    for q in questions:
        qid, qtext, qtype, qoptions, qcategory, qactive = q
        q_responses = resp_by_question.get(qid, [])
        q_feedbacks = feedbacks_by_question.get(qid, [])
        q_skips = skips_by_question.get(qid, [])
        total = len(q_responses)

        stat: Dict[str, Any] = {
            "id": qid,
            "text": qtext,
            "type": qtype,
            "category": qcategory,
            "is_currently_active": bool(qactive),
            "total_responses": total,
            "feedbacks": q_feedbacks,
            "feedback_count": len(q_feedbacks),
            "skips": q_skips,
            "skip_count": len(q_skips),
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
    total_skips = sum(len(v) for v in skips_by_question.values())
    avg_completion = round(days_completed / days_total * 100)

    return {
        "week_start": period_start.isoformat(),
        "week_end": period_end.isoformat(),
        "days_total": days_total,
        "days_completed": days_completed,
        "completion_rate": avg_completion,
        "total_responses": total_responses,
        "total_skips": total_skips,
        "skipped_days": [
            {"date": skip_date, "count": len(question_ids)}
            for skip_date, question_ids in sorted(skips_by_date.items())
        ],
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


def _month_label(start: date, end: date) -> str:
    MONTHS = [
        "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ]
    return f"Mes de {MONTHS[start.month]} {start.year}"
