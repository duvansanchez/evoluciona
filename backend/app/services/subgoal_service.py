"""
Servicio para lógica de negocio de subobjetivos.
"""

from sqlalchemy.orm import Session
from app.models.subgoal import SubGoal, SubGoalSkipDay
from app.models.models import Goal
from app.schemas.subgoal_schemas import SubGoalCreate, SubGoalUpdate
from typing import List, Optional


class SubGoalService:
    """Servicio para gestionar subobjetivos."""
    
    @staticmethod
    def get_subgoals_by_goal(db: Session, objetivo_id: int) -> List[SubGoal]:
        """Obtener todos los subobjetivos de un objetivo específico."""
        # Ordenar por: completado ASC (no completos primero), luego orden ASC, luego id ASC
        return db.query(SubGoal).filter(
            SubGoal.objetivo_id == objetivo_id
        ).order_by(
            SubGoal.completado.asc(),
            SubGoal.orden.asc(),
            SubGoal.id.asc()
        ).all()
    
    @staticmethod
    def get_subgoal(db: Session, subgoal_id: int) -> Optional[SubGoal]:
        """Obtener subobjetivo por ID."""
        return db.query(SubGoal).filter(SubGoal.id == subgoal_id).first()

    @staticmethod
    def get_skipped_subgoal_ids(db: Session, fecha: str) -> List[int]:
        """Obtener IDs de subobjetivos saltados para una fecha."""
        rows = db.query(SubGoalSkipDay.subobjetivo_id).filter(
            SubGoalSkipDay.fecha == fecha
        ).all()
        return [row[0] for row in rows]

    @staticmethod
    def get_skipped_subgoal_entries(db: Session, fecha: str) -> List[SubGoalSkipDay]:
        """Obtener entradas de subobjetivos saltados con motivo para una fecha."""
        return (
            db.query(SubGoalSkipDay)
            .filter(SubGoalSkipDay.fecha == fecha)
            .all()
        )

    @staticmethod
    def skip_subgoal_for_date(db: Session, subgoal_id: int, fecha: str, reason: Optional[str] = None) -> Optional[SubGoalSkipDay]:
        """Marcar un subobjetivo como saltado en una fecha si su objetivo padre es recurrente."""
        subgoal = SubGoalService.get_subgoal(db, subgoal_id)
        if not subgoal:
            return None

        parent_goal = db.query(Goal).filter(Goal.id == subgoal.objetivo_id).first()
        if not parent_goal or not parent_goal.recurrente:
            return None

        cleaned_reason = reason.strip() if isinstance(reason, str) else None
        if cleaned_reason == "":
            cleaned_reason = None

        existing = db.query(SubGoalSkipDay).filter(
            SubGoalSkipDay.subobjetivo_id == subgoal_id,
            SubGoalSkipDay.fecha == fecha
        ).first()
        if existing:
            existing.motivo = cleaned_reason
            db.commit()
            db.refresh(existing)
            return existing

        skipped = SubGoalSkipDay(subobjetivo_id=subgoal_id, fecha=fecha, motivo=cleaned_reason)
        db.add(skipped)
        db.commit()
        db.refresh(skipped)
        return skipped

    @staticmethod
    def unskip_subgoal_for_date(db: Session, subgoal_id: int, fecha: str) -> bool:
        """Quitar el estado de saltado de un subobjetivo para una fecha."""
        skipped = db.query(SubGoalSkipDay).filter(
            SubGoalSkipDay.subobjetivo_id == subgoal_id,
            SubGoalSkipDay.fecha == fecha
        ).first()
        if not skipped:
            return False

        db.delete(skipped)
        db.commit()
        return True
    
    @staticmethod
    def create_subgoal(db: Session, objetivo_id: int, subgoal: SubGoalCreate) -> SubGoal:
        """Crear nuevo subobjetivo."""
        # Si no se especifica orden, obtener el máximo orden actual + 1
        if subgoal.orden is not None:
            orden = subgoal.orden
        else:
            max_orden = db.query(SubGoal).filter(
                SubGoal.objetivo_id == objetivo_id
            ).count()
            orden = max_orden
        
        db_subgoal = SubGoal(
            objetivo_id=objetivo_id,
            titulo=subgoal.titulo,
            completado=subgoal.completado,
            orden=orden,
            tiempo_focus=subgoal.tiempo_focus or 0,
            notas=subgoal.notas
        )
        db.add(db_subgoal)
        db.commit()
        db.refresh(db_subgoal)
        return db_subgoal
    
    @staticmethod
    def update_subgoal(db: Session, subgoal_id: int, subgoal: SubGoalUpdate) -> Optional[SubGoal]:
        """Actualizar subobjetivo."""
        db_subgoal = SubGoalService.get_subgoal(db, subgoal_id)
        if not db_subgoal:
            return None
        
        update_data = subgoal.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_subgoal, key, value)
        
        db.commit()
        db.refresh(db_subgoal)
        return db_subgoal
    
    @staticmethod
    def delete_subgoal(db: Session, subgoal_id: int) -> bool:
        """Eliminar subobjetivo."""
        db_subgoal = SubGoalService.get_subgoal(db, subgoal_id)
        if not db_subgoal:
            return False
        
        db.delete(db_subgoal)
        db.commit()
        return True
    
    @staticmethod
    def reorder_subgoals(db: Session, objetivo_id: int, subgoal_ids: List[int]) -> bool:
        """Reordenar subobjetivos."""
        # Verificar que todos los IDs pertenezcan al objetivo
        subgoals = db.query(SubGoal).filter(
            SubGoal.id.in_(subgoal_ids),
            SubGoal.objetivo_id == objetivo_id
        ).all()
        
        if len(subgoals) != len(subgoal_ids):
            return False
        
        # Actualizar orden según la lista
        for idx, subgoal_id in enumerate(subgoal_ids):
            subgoal = next((s for s in subgoals if s.id == subgoal_id), None)
            if subgoal:
                subgoal.orden = idx + 1
        
        db.commit()
        return True
