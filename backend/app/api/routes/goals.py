"""
Endpoints para objetivos (Goals) y subobjetivos (SubGoals).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import (
    GoalCreate, GoalUpdate, GoalResponse, GoalFocusUpdate,
    GoalsPaginatedResponse
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
