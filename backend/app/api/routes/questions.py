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
    QuestionsPaginatedResponse, SingleResponseCreate
)
from app.services.question_service import QuestionService, DailySessionService
from typing import List
import math


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
