"""
Endpoints para subobjetivos (SubGoals).
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.subgoal_schemas import (
    SubGoalCreate, SubGoalUpdate, SubGoalResponse
)
from app.services.subgoal_service import SubGoalService
from typing import List

router = APIRouter(tags=["subgoals"])


@router.get("/api/goals/{goal_id}/subgoals", response_model=List[SubGoalResponse])
def list_subgoals(goal_id: int, db: Session = Depends(get_db)):
    """Obtener todos los subobjetivos de un objetivo."""
    subgoals = SubGoalService.get_subgoals_by_goal(db, goal_id)
    return subgoals


@router.post("/api/goals/{goal_id}/subgoals", response_model=SubGoalResponse, status_code=201)
def create_subgoal(goal_id: int, subgoal: SubGoalCreate, db: Session = Depends(get_db)):
    """Crear nuevo subobjetivo para un objetivo."""
    db_subgoal = SubGoalService.create_subgoal(db, goal_id, subgoal)
    return db_subgoal


@router.patch("/api/subgoals/{subgoal_id}", response_model=SubGoalResponse)
def update_subgoal(subgoal_id: int, subgoal: SubGoalUpdate, db: Session = Depends(get_db)):
    """Actualizar subobjetivo."""
    db_subgoal = SubGoalService.update_subgoal(db, subgoal_id, subgoal)
    if not db_subgoal:
        raise HTTPException(status_code=404, detail="SubGoal not found")
    return db_subgoal


@router.delete("/api/subgoals/{subgoal_id}", status_code=204)
def delete_subgoal(subgoal_id: int, db: Session = Depends(get_db)):
    """Eliminar subobjetivo."""
    if not SubGoalService.delete_subgoal(db, subgoal_id):
        raise HTTPException(status_code=404, detail="SubGoal not found")
    return


@router.post("/api/goals/{goal_id}/subgoals/reorder")
def reorder_subgoals(
    goal_id: int,
    ids: List[int] = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """Reordenar subobjetivos de un objetivo."""
    if not SubGoalService.reorder_subgoals(db, goal_id, ids):
        raise HTTPException(status_code=400, detail="Invalid subgoal IDs or goal ID")
    return {"message": "Subgoals reordered successfully"}
