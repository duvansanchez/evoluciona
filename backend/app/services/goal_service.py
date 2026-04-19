"""
Servicios para objetivos (Goals).
"""

from sqlalchemy.orm import Session
from app.models.models import Goal, GoalSkipDay, GoalCompletionDay
from app.models.subgoal import SubGoal
from app.schemas.schemas import GoalCreate, GoalUpdate
from datetime import datetime
from typing import Optional, List, Tuple


class GoalService:
    """Servicio para objetivos."""

    @staticmethod
    def reset_stale_recurring_goals(db: Session, today_key: Optional[str] = None) -> None:
        """Reiniciar el estado actual de recurrentes viejos, conservando el historial diario."""
        today_key = today_key or datetime.now().strftime("%Y-%m-%d")
        stale_goals = (
            db.query(Goal)
            .filter(
                Goal.recurrente == True,
                Goal.completado == True,
                Goal.fecha_completado.isnot(None),
            )
            .all()
        )

        dirty = False
        for goal in stale_goals:
            completed_key = goal.fecha_completado.strftime("%Y-%m-%d") if goal.fecha_completado else None
            if completed_key and completed_key != today_key:
                goal.completado = False
                goal.fecha_completado = None
                db.query(SubGoal).filter(
                    SubGoal.objetivo_id == goal.id,
                    SubGoal.completado == True,
                ).update({SubGoal.completado: False}, synchronize_session=False)
                dirty = True

        if dirty:
            db.commit()
    
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
            icono=goal.icono,
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
        skip_date: Optional[str] = None,
        page: int = 1,
        page_size: int = 10
    ) -> Tuple[List[Goal], int]:
        """Obtener objetivos con filtros y paginación."""
        GoalService.reset_stale_recurring_goals(db)
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

        if skip_date:
            skipped_goal_ids = {
                row.objetivo_id
                for row in db.query(GoalSkipDay.objetivo_id).filter(GoalSkipDay.fecha == skip_date).all()
            }
            for goal in goals:
                setattr(goal, "saltado_hoy", goal.id in skipped_goal_ids)
        
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
        
        update_data = goal.model_dump(exclude_unset=True)
        
        # Si se actualiza "completado", manejar fecha_completado
        if 'completado' in update_data:
            if update_data['completado'] is True:
                # Si está marcado como completado y no viene fecha_completado, usar la actual
                if 'fecha_completado' not in update_data:
                    update_data['fecha_completado'] = datetime.utcnow().isoformat()
            else:
                # Si está marcado como incompleto, limpiar fecha_completado
                update_data['fecha_completado'] = None
        
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

    @staticmethod
    def get_skipped_goal_ids(db: Session, fecha: str) -> List[int]:
        """Obtener IDs de objetivos saltados para una fecha."""
        return [
            row.objetivo_id
            for row in db.query(GoalSkipDay.objetivo_id).filter(GoalSkipDay.fecha == fecha).all()
        ]

    @staticmethod
    def get_completed_goal_entries(db: Session, fecha: str) -> List[GoalCompletionDay]:
        """Obtener historial de completado diario para objetivos recurrentes."""
        return (
            db.query(GoalCompletionDay)
            .filter(GoalCompletionDay.fecha == fecha)
            .all()
        )

    @staticmethod
    def complete_goal_for_date(db: Session, goal_id: int, fecha: str) -> Optional[GoalCompletionDay]:
        """Persistir completado diario para un objetivo recurrente."""
        goal = db.query(Goal).filter(Goal.id == goal_id).first()
        if not goal or not goal.recurrente:
            return None

        existing = db.query(GoalCompletionDay).filter(
            GoalCompletionDay.objetivo_id == goal_id,
            GoalCompletionDay.fecha == fecha,
        ).first()
        if existing:
            return existing

        completed_at = datetime.now()
        completion_day = GoalCompletionDay(
            objetivo_id=goal_id,
            fecha=fecha,
            fecha_creacion=completed_at,
        )
        db.add(completion_day)
        goal.completado = True
        goal.fecha_completado = completed_at
        db.commit()
        db.refresh(completion_day)
        return completion_day

    @staticmethod
    def uncomplete_goal_for_date(db: Session, goal_id: int, fecha: str) -> bool:
        """Eliminar el completado diario de un objetivo recurrente."""
        existing = db.query(GoalCompletionDay).filter(
            GoalCompletionDay.objetivo_id == goal_id,
            GoalCompletionDay.fecha == fecha,
        ).first()
        if not existing:
            return False

        goal = db.query(Goal).filter(Goal.id == goal_id).first()
        db.delete(existing)
        if goal:
            goal.completado = False
            goal.fecha_completado = None
        db.commit()
        return True

    @staticmethod
    def skip_goal_for_date(db: Session, goal_id: int, fecha: str) -> Optional[GoalSkipDay]:
        """Persistir que un objetivo recurrente fue saltado en una fecha."""
        goal = db.query(Goal).filter(Goal.id == goal_id).first()
        if not goal or not goal.recurrente:
            return None

        existing = db.query(GoalSkipDay).filter(
            GoalSkipDay.objetivo_id == goal_id,
            GoalSkipDay.fecha == fecha,
        ).first()
        if existing:
            return existing

        skip_day = GoalSkipDay(
            objetivo_id=goal_id,
            fecha=fecha,
            fecha_creacion=datetime.now(),
        )
        db.add(skip_day)
        db.commit()
        db.refresh(skip_day)
        return skip_day

    @staticmethod
    def unskip_goal_for_date(db: Session, goal_id: int, fecha: str) -> bool:
        """Eliminar el salto diario de un objetivo."""
        existing = db.query(GoalSkipDay).filter(
            GoalSkipDay.objetivo_id == goal_id,
            GoalSkipDay.fecha == fecha,
        ).first()
        if not existing:
            return False

        db.delete(existing)
        db.commit()
        return True

