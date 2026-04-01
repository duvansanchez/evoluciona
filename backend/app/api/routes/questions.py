"""
Endpoints para preguntas y sesiones diarias.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import get_db
from app.schemas.schemas import (
    QuestionCreate, QuestionUpdate, QuestionResponse,
    DailySessionCreate, DailySessionResponse,
    QuestionsPaginatedResponse, SingleResponseCreate,
    QuestionFeedbackCreate, QuestionFeedbackResponse, QuestionSkipDayResponse
)
from app.services.question_service import QuestionService, DailySessionService
from typing import List
import math
import calendar as cal_module
from datetime import date as date_type, timedelta


def _build_session_response(session, db: Session, date: str) -> dict:
    """Construye el dict de respuesta de sesión incluyendo las respuestas guardadas del día."""
    rows = db.execute(
        text("SELECT id, question_id, response, date FROM response WHERE CAST(date AS DATE) = :d ORDER BY id DESC"),
        {"d": date}
    ).fetchall()

    # Deduplicate: keep only the latest response per question_id
    seen: set = set()
    unique_rows = []
    for row in rows:
        qid = row[1]
        if qid not in seen:
            seen.add(qid)
            unique_rows.append(row)

    return {
        "id": session.id,
        "date": session.date,
        "total_questions": session.total_questions,
        "answered_questions": len(unique_rows),
        "completed_at": session.completed_at,
        "created_at": session.created_at or "",
        "responses": [
            {
                "id": str(row[0]),
                "question_id": str(row[1]),
                "response": row[2] or "",
                "answered_at": str(row[3]) if row[3] else "",
            }
            for row in unique_rows
        ],
    }

router = APIRouter(prefix="/api", tags=["questions"])


# ==================== QUESTIONS ====================

@router.get("/questions", response_model=QuestionsPaginatedResponse)
def list_questions(
    category: str = Query(None),
    active: bool = Query(None),
    frequency: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Obtener preguntas con filtros."""
    questions, total = QuestionService.get_questions(
        db,
        category=category,
        active=active,
        frequency=frequency,
        page=page,
        page_size=page_size
    )
    pages = math.ceil(total / page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
        "items": questions
    }


@router.post("/questions", response_model=QuestionResponse)
def create_question(question: QuestionCreate, db: Session = Depends(get_db)):
    """Crear pregunta."""
    return QuestionService.create_question(db, question)


@router.get("/questions/{question_id}", response_model=QuestionResponse)
def get_question(question_id: str, db: Session = Depends(get_db)):
    """Obtener pregunta por ID."""
    question = QuestionService.get_question(db, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@router.patch("/questions/{question_id}", response_model=QuestionResponse)
def update_question(question_id: str, question: QuestionUpdate, db: Session = Depends(get_db)):
    """Actualizar pregunta."""
    db_question = QuestionService.update_question(db, question_id, question)
    if not db_question:
        raise HTTPException(status_code=404, detail="Question not found")
    return db_question


@router.delete("/questions/{question_id}")
def delete_question(question_id: str, db: Session = Depends(get_db)):
    """Eliminar pregunta."""
    if not QuestionService.delete_question(db, question_id):
        raise HTTPException(status_code=404, detail="Question not found")
    return {"message": "Question deleted"}


# ==================== DAILY SESSIONS ====================

@router.get("/daily-sessions/calendar")
def get_calendar_summary(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db)
):
    """Retorna para cada día del mes si tiene respuestas guardadas y cuántas."""
    first_day = date_type(year, month, 1)
    last_day = date_type(year, month, cal_module.monthrange(year, month)[1])

    response_rows = db.execute(
        text("""
            SELECT CAST(date AS DATE) as dia, COUNT(DISTINCT question_id) as total
            FROM response
            WHERE CAST(date AS DATE) >= :start AND CAST(date AS DATE) <= :end
            GROUP BY CAST(date AS DATE)
        """),
        {"start": first_day.isoformat(), "end": last_day.isoformat()}
    ).fetchall()

    skip_rows = db.execute(
        text("""
            SELECT fecha as dia, COUNT(DISTINCT question_id) as total
            FROM question_skip_days
            WHERE fecha >= :start AND fecha <= :end
            GROUP BY fecha
        """),
        {"start": first_day.isoformat(), "end": last_day.isoformat()}
    ).fetchall()

    response_counts = {str(row[0]): row[1] for row in response_rows}
    skip_counts = {str(row[0]): row[1] for row in skip_rows}
    counts: dict[str, int] = {}
    for row in response_rows:
        counts[str(row[0])] = counts.get(str(row[0]), 0) + row[1]
    for row in skip_rows:
        counts[str(row[0])] = counts.get(str(row[0]), 0) + row[1]

    days = []
    cursor = first_day
    while cursor <= last_day:
        d = cursor.isoformat()
        response_count = response_counts.get(d, 0)
        skip_count = skip_counts.get(d, 0)

        status = "none"
        if response_count > 0 and skip_count > 0:
            status = "mixed"
        elif response_count > 0:
            status = "answered"
        elif skip_count > 0:
            status = "skipped"

        days.append({
            "date": d,
            "has_responses": d in counts,
            "response_count": counts.get(d, 0),
            "answered_count": response_count,
            "skipped_count": skip_count,
            "status": status,
        })
        cursor += timedelta(days=1)

    return {"year": year, "month": month, "days": days}


@router.get("/daily-sessions/{date}/history")
def get_history_session(date: str, db: Session = Depends(get_db)):
    """
    Retorna las respuestas de una fecha incluyendo datos de la pregunta
    (aunque esté desactivada), para la vista de historial.
    """
    rows = db.execute(
        text("""
            SELECT r.id, r.question_id, r.response, r.date,
                   q.text as question_text, q.type as question_type,
                   q.options as question_options, q.active as question_active,
                   q.categoria as question_category
            FROM response r
            LEFT JOIN question q ON q.id = r.question_id
            WHERE CAST(r.date AS DATE) = :d
            ORDER BY r.id DESC
        """),
        {"d": date}
    ).fetchall()

    skip_rows = db.execute(
        text("""
            SELECT s.id, s.question_id, s.fecha,
                   q.text as question_text, q.type as question_type,
                   q.options as question_options, q.active as question_active,
                   q.categoria as question_category
            FROM question_skip_days s
            LEFT JOIN question q ON q.id = s.question_id
            WHERE s.fecha = :d
            ORDER BY s.id DESC
        """),
        {"d": date}
    ).fetchall()

    # Deduplicate by question_id (keep latest)
    seen: set = set()
    entries = []
    for row in rows:
        qid = row[1]
        if qid not in seen:
            seen.add(qid)
            entries.append({
                "id": str(row[0]),
                "question_id": str(row[1]),
                "response": row[2] or "",
                "answered_at": str(row[3]) if row[3] else "",
                "question_text": row[4] or "",
                "question_type": row[5] or "text",
                "question_options": row[6],
                "question_active": bool(row[7]) if row[7] is not None else True,
                "question_category": row[8] or "",
                "skipped": False,
            })

    for row in skip_rows:
        qid = row[1]
        if qid not in seen:
            seen.add(qid)
            entries.append({
                "id": f"skip-{row[0]}",
                "question_id": str(row[1]),
                "response": "",
                "answered_at": row[2] or "",
                "question_text": row[3] or "",
                "question_type": row[4] or "text",
                "question_options": row[5],
                "question_active": bool(row[6]) if row[6] is not None else True,
                "question_category": row[7] or "",
                "skipped": True,
            })

    return {"date": date, "entries": entries}


@router.get("/daily-sessions/{date}", response_model=DailySessionResponse)
def get_daily_session(date: str, db: Session = Depends(get_db)):
    """
    Obtener sesión diaria para una fecha.
    Si no existe, crea una nueva con las preguntas activas.
    Formato de fecha: YYYY-MM-DD
    """
    session = DailySessionService.get_or_create_session(db, date)
    return _build_session_response(session, db, date)


@router.post("/daily-sessions/{date}/responses", response_model=DailySessionResponse)
def save_daily_responses(date: str, session_data: DailySessionCreate, db: Session = Depends(get_db)):
    """
    Guardar respuestas a una sesión diaria.
    Formato de fecha: YYYY-MM-DD
    """
    try:
        session = DailySessionService.save_responses(db, date, session_data)
        return _build_session_response(session, db, date)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/daily-sessions/{date}/responses/{question_id}")
def save_single_response(date: str, question_id: str, data: SingleResponseCreate, db: Session = Depends(get_db)):
    """
    Guardar o reemplazar la respuesta de una sola pregunta para un día dado.
    Formato de fecha: YYYY-MM-DD
    """
    try:
        DailySessionService.save_single_response(db, date, question_id, data.response)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/daily-sessions/{date}/feedbacks", response_model=List[QuestionFeedbackResponse])
def get_question_feedbacks(date: str, db: Session = Depends(get_db)):
    """Obtiene los feedbacks guardados para las preguntas de un día."""
    return DailySessionService.get_feedbacks_for_date(db, date)


@router.post("/daily-sessions/{date}/feedbacks/{question_id}", response_model=QuestionFeedbackResponse)
def save_question_feedback(
    date: str,
    question_id: str,
    data: QuestionFeedbackCreate,
    db: Session = Depends(get_db)
):
    """Crea o actualiza feedback libre de una pregunta para una fecha."""
    try:
        return DailySessionService.save_question_feedback(db, date, question_id, data.text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/daily-sessions/{date}/feedbacks/{question_id}")
def delete_question_feedback(date: str, question_id: str, db: Session = Depends(get_db)):
    """Elimina feedback libre de una pregunta para una fecha."""
    try:
        DailySessionService.delete_question_feedback(db, date, question_id)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/daily-sessions/{date}/skips", response_model=List[int])
def get_skipped_questions(date: str, db: Session = Depends(get_db)):
    """Obtiene IDs de preguntas saltadas para un día."""
    return DailySessionService.get_skipped_question_ids(db, date)


@router.post("/daily-sessions/{date}/skips/{question_id}", response_model=QuestionSkipDayResponse, status_code=201)
def skip_question_for_date(date: str, question_id: int, db: Session = Depends(get_db)):
    """Marcar una pregunta como saltada para una fecha."""
    skipped = DailySessionService.skip_question_for_date(db, question_id, date)
    if not skipped:
        raise HTTPException(status_code=404, detail="Active question not found")
    return QuestionSkipDayResponse(question_id=str(skipped.question_id), date=skipped.fecha)


@router.delete("/daily-sessions/{date}/skips/{question_id}")
def unskip_question_for_date(date: str, question_id: int, db: Session = Depends(get_db)):
    """Quitar el estado de saltada de una pregunta para una fecha."""
    removed = DailySessionService.unskip_question_for_date(db, question_id, date)
    if not removed:
        raise HTTPException(status_code=404, detail="Skipped question entry not found")
    return {"ok": True}
