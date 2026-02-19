"""
Servicios para objetivos (Goals).
"""

from sqlalchemy.orm import Session
from app.models.models import Goal
from app.schemas.schemas import GoalCreate, GoalUpdate
from datetime import datetime
from typing import Optional, List, Tuple


class GoalService:
    """Servicio para objetivos."""
    
    @staticmethod
    def create_goal(db: Session, goal: GoalCreate) -> Goal:
        """Crear nuevo objetivo."""
        # Validar parent_goal_id si está presente
        objetivo_padre_id = None
        if goal.objetivo_padre_id:
            # Verificar que el goal padre exista
            parent_exists = db.query(Goal).filter(Goal.id == goal.objetivo_padre_id).first()
            if parent_exists:
                objetivo_padre_id = goal.objetivo_padre_id
        
        db_goal = Goal(
            user_id=1,  # Default user_id, asegúrate de que el usuario con ID 1 existe en la DB
            titulo=goal.titulo,
            descripcion=goal.descripcion,
            categoria=goal.categoria,
            prioridad=goal.prioridad,
            recurrente=goal.recurrente,
            parte_dia=goal.parte_dia,
            horas_estimadas=goal.horas_estimadas,
            recompensa=goal.recompensa,
            es_padre=goal.es_padre,
            objetivo_padre_id=objetivo_padre_id,
            fecha_inicio=goal.fecha_inicio,
            fecha_fin=goal.fecha_fin,
            programado_para=goal.programado_para,
            fecha_creacion=datetime.now(),  # Asignar fecha de creación automáticamente
        )
        db.add(db_goal)
        db.commit()
        db.refresh(db_goal)
        return db_goal
    
    @staticmethod
    def get_goals(
        db: Session,
        category: Optional[str] = None,
        completed: Optional[bool] = None,
        scheduled_for: Optional[str] = None,
        page: int = 1,
        page_size: int = 10
    ) -> Tuple[List[Goal], int]:
        """Obtener objetivos con filtros y paginación."""
        query = db.query(Goal)
        
        if category:
            query = query.filter(Goal.categoria == category)
        if completed is not None:
            query = query.filter(Goal.completado == completed)
        if scheduled_for:
            query = query.filter(Goal.programado_para == scheduled_for)
        
        total = query.count()
        # SQL Server requiere ORDER BY cuando usas OFFSET/LIMIT
        goals = query.order_by(Goal.fecha_creacion.desc()).offset((page - 1) * page_size).limit(page_size).all()
        
        return goals, total
    
    @staticmethod
    def get_goal(db: Session, goal_id: int) -> Optional[Goal]:
        """Obtener objetivo por ID."""
        return db.query(Goal).filter(Goal.id == goal_id).first()
    
    @staticmethod
    def update_goal(db: Session, goal_id: int, goal: GoalUpdate) -> Optional[Goal]:
        """Actualizar objetivo."""
        db_goal = db.query(Goal).filter(Goal.id == goal_id).first()
        if not db_goal:
            return None
        
        # Actualizar si completado
        if goal.completado is not None and goal.completado and not db_goal.completado:
            status_data = {
                'completado': True,
                'fecha_completado': datetime.utcnow().isoformat()
            }
        else:
            status_data = {}
        
        update_data = goal.model_dump(exclude_unset=True)
        update_data.update(status_data)
        
        for field, value in update_data.items():
            setattr(db_goal, field, value)
        
        db.commit()
        db.refresh(db_goal)
        return db_goal
    
    @staticmethod
    def delete_goal(db: Session, goal_id: int) -> bool:
        """Eliminar objetivo y subobjetivos."""
        db_goal = db.query(Goal).filter(Goal.id == goal_id).first()
        if not db_goal:
            return False
        
        db.delete(db_goal)
        db.commit()
        return True
    
    @staticmethod
    def update_goal_focus(db: Session, goal_id: int, tiempo_focus: int, notas_adicionales: Optional[str] = None) -> Optional[Goal]:
        """Actualizar tiempo de focus de objetivo."""
        db_goal = db.query(Goal).filter(Goal.id == goal_id).first()
        if not db_goal:
            return None
        
        db_goal.tiempo_focus = tiempo_focus
        if notas_adicionales is not None:
            db_goal.notas_adicionales = notas_adicionales
        
        db.commit()
        db.refresh(db_goal)
        return db_goal

