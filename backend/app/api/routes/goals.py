"""
Endpoints para objetivos (Goals) y subobjetivos (SubGoals).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import (
    GoalCreate, GoalUpdate, GoalResponse, GoalFocusUpdate,
    GoalsPaginatedResponse, GoalSkipDayResponse, GoalCompletionDayResponse
)
from app.services.goal_service import GoalService
from typing import List
import math

router = APIRouter(prefix="/api/goals", tags=["goals"])


# ==================== GOALS ====================

@router.post("", response_model=GoalResponse)
def create_goal(goal: GoalCreate, db: Session = Depends(get_db)):
    """Crear nuevo objetivo."""
    db_goal = GoalService.create_goal(db, goal)
    return db_goal


@router.get("", response_model=GoalsPaginatedResponse)
def list_goals(
    category: str = Query(None),
    completed: bool = Query(None),
    scheduled_for: str = Query(None),
    skip_date: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Obtener lista de objetivos con paginación."""
    goals, total = GoalService.get_goals(
        db,
        category=category,
        completed=completed,
        scheduled_for=scheduled_for,
        skip_date=skip_date,
        page=page,
        page_size=page_size
    )
    pages = math.ceil(total / page_size)
    return GoalsPaginatedResponse(
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        items=goals
    )


@router.get("/skips", response_model=List[int])
def list_skipped_goals(
    fecha: str = Query(..., description="Fecha YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """Obtener IDs de objetivos saltados para una fecha."""
    return GoalService.get_skipped_goal_ids(db, fecha)


@router.get("/completions", response_model=List[GoalCompletionDayResponse])
def list_completed_goals(
    fecha: str = Query(..., description="Fecha YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """Obtener completados diarios de objetivos recurrentes para una fecha."""
    entries = GoalService.get_completed_goal_entries(db, fecha)
    return [
        GoalCompletionDayResponse(goal_id=entry.objetivo_id, fecha=entry.fecha, completed_at=entry.fecha_creacion)
        for entry in entries
    ]


@router.get("/{goal_id}", response_model=GoalResponse)
def get_goal(goal_id: int, db: Session = Depends(get_db)):
    """Obtener objetivo por ID."""
    goal = GoalService.get_goal(db, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.patch("/{goal_id}", response_model=GoalResponse)
def update_goal(goal_id: int, goal: GoalUpdate, db: Session = Depends(get_db)):
    """Actualizar objetivo."""
    db_goal = GoalService.update_goal(db, goal_id, goal)
    if not db_goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return db_goal


@router.delete("/{goal_id}")
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    """Eliminar objetivo."""
    if not GoalService.delete_goal(db, goal_id):
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"message": "Goal deleted"}


@router.patch("/{goal_id}/focus", response_model=GoalResponse)
def update_goal_focus(goal_id: int, focus: GoalFocusUpdate, db: Session = Depends(get_db)):
    """Actualizar tiempo de focus de objetivo."""
    db_goal = GoalService.update_goal_focus(
        db, goal_id, focus.tiempo_focus, focus.notas_adicionales
    )
    if not db_goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return db_goal


@router.post("/{goal_id}/skip", response_model=GoalSkipDayResponse, status_code=201)
def skip_goal_for_date(
    goal_id: int,
    fecha: str = Query(..., description="Fecha YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """Marcar un objetivo recurrente como saltado para una fecha."""
    skipped = GoalService.skip_goal_for_date(db, goal_id, fecha)
    if not skipped:
        raise HTTPException(status_code=404, detail="Recurring goal not found")
    return GoalSkipDayResponse(goal_id=skipped.objetivo_id, fecha=skipped.fecha)


@router.post("/{goal_id}/complete", response_model=GoalCompletionDayResponse, status_code=201)
def complete_goal_for_date(
    goal_id: int,
    fecha: str = Query(..., description="Fecha YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """Marcar un objetivo recurrente como completado para una fecha."""
    completed = GoalService.complete_goal_for_date(db, goal_id, fecha)
    if not completed:
        raise HTTPException(status_code=404, detail="Recurring goal not found")
    return GoalCompletionDayResponse(goal_id=completed.objetivo_id, fecha=completed.fecha, completed_at=completed.fecha_creacion)


@router.delete("/{goal_id}/skip")
def unskip_goal_for_date(
    goal_id: int,
    fecha: str = Query(..., description="Fecha YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """Quitar el estado de saltado de un objetivo para una fecha."""
    removed = GoalService.unskip_goal_for_date(db, goal_id, fecha)
    if not removed:
        raise HTTPException(status_code=404, detail="Skipped goal entry not found")
    return {"message": "Goal skip removed"}


@router.delete("/{goal_id}/complete")
def uncomplete_goal_for_date(
    goal_id: int,
    fecha: str = Query(..., description="Fecha YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """Quitar el completado diario de un objetivo recurrente."""
    removed = GoalService.uncomplete_goal_for_date(db, goal_id, fecha)
    if not removed:
        raise HTTPException(status_code=404, detail="Goal completion entry not found")
    return {"message": "Goal completion removed"}
