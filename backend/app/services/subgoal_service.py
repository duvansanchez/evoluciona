"""
Servicio para lógica de negocio de subobjetivos.
"""

from sqlalchemy.orm import Session
from app.models.subgoal import SubGoal
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
    def create_subgoal(db: Session, objetivo_id: int, subgoal: SubGoalCreate) -> SubGoal:
        """Crear nuevo subobjetivo."""
        # Obtener el máximo orden actual para este objetivo
        max_orden = db.query(SubGoal).filter(
            SubGoal.objetivo_id == objetivo_id
        ).count()
        
        db_subgoal = SubGoal(
            objetivo_id=objetivo_id,
            titulo=subgoal.titulo,
            completado=subgoal.completado,
            orden=subgoal.orden if subgoal.orden else max_orden + 1,
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
