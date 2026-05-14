"""
Servicios para objetivos (Goals).
"""

from sqlalchemy.orm import Session
from app.models.models import Goal, GoalSkipDay, GoalCompletionDay
from app.models.subgoal import SubGoal
from app.schemas.schemas import GoalCreate, GoalUpdate
from datetime import datetime, timedelta
from typing import Optional, List, Tuple


class GoalService:
    """Servicio para objetivos."""

    @staticmethod
    def _resolve_schedule(programado_para: Optional[str], fecha_programada: Optional[str]) -> tuple[Optional[str], Optional[datetime]]:
        normalized = (programado_para or '').strip().lower()

        if normalized in {'tomorrow', 'manana', 'mañana'}:
            target_date = datetime.now() + timedelta(days=1)
            return 'mañana', target_date.replace(hour=0, minute=0, second=0, microsecond=0)

        if normalized == 'fecha_especifica' and fecha_programada:
            return 'fecha_especifica', datetime.fromisoformat(str(fecha_programada))

        if normalized and len(normalized) == 10 and normalized.count('-') == 2:
            return 'fecha_especifica', datetime.fromisoformat(normalized)

        return programado_para, None

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
        
        schedule_type, schedule_date = GoalService._resolve_schedule(goal.programado_para, goal.fecha_programada)

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
            fecha_programada=schedule_date,
            programado_para=schedule_type,
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
    def get_all_goals_with_subgoals(db: Session) -> List[dict]:
        """Devuelve todos los objetivos con subobjetivos embebidos en solo 2 queries.
        Elimina el problema N+1 de cargar subobjetivos uno a uno.
        """
        GoalService.reset_stale_recurring_goals(db)

        goals = (
            db.query(Goal)
            .order_by(Goal.fecha_creacion.desc())
            .all()
        )
        if not goals:
            return []

        goal_ids = [g.id for g in goals]
        subgoals = (
            db.query(SubGoal)
            .filter(SubGoal.objetivo_id.in_(goal_ids))
            .order_by(SubGoal.orden.asc(), SubGoal.id.asc())
            .all()
        )

        subs_by_goal: dict = {}
        for sub in subgoals:
            subs_by_goal.setdefault(sub.objetivo_id, []).append({
                "id": sub.id,
                "objetivo_id": sub.objetivo_id,
                "titulo": sub.titulo,
                "completado": sub.completado,
                "fecha_completado": sub.fecha_completado.isoformat() if sub.fecha_completado else None,
                "recurrente": sub.recurrente,
                "activa": sub.activa,
                "fecha_creacion": sub.fecha_creacion.isoformat() if sub.fecha_creacion else None,
                "orden": sub.orden,
                "tiempo_focus": sub.tiempo_focus or 0,
                "notas": sub.notas,
                "folder_id": sub.folder_id,
            })

        result = []
        for g in goals:
            result.append({
                "id": g.id,
                "user_id": g.user_id,
                "titulo": g.titulo,
                "icono": g.icono,
                "descripcion": g.descripcion,
                "categoria": g.categoria,
                "prioridad": g.prioridad,
                "completado": g.completado,
                "fecha_creacion": g.fecha_creacion.isoformat() if g.fecha_creacion else None,
                "fecha_completado": g.fecha_completado.isoformat() if g.fecha_completado else None,
                "objetivo_padre_id": g.objetivo_padre_id,
                "es_padre": g.es_padre,
                "estado": g.estado,
                "fecha_inicio": g.fecha_inicio.isoformat() if g.fecha_inicio else None,
                "fecha_fin": g.fecha_fin.isoformat() if g.fecha_fin else None,
                "horas_estimadas": g.horas_estimadas,
                "dificultad": g.dificultad,
                "etiquetas": g.etiquetas,
                "recompensa": g.recompensa,
                "notas_adicionales": g.notas_adicionales,
                "recurrente": g.recurrente,
                "frecuencia": g.frecuencia,
                "fecha_proyeccion_comienzo": g.fecha_proyeccion_comienzo.isoformat() if g.fecha_proyeccion_comienzo else None,
                "orden": g.orden,
                "parte_dia": g.parte_dia,
                "tiempo_focus": g.tiempo_focus,
                "fecha_programada": g.fecha_programada.isoformat() if g.fecha_programada else None,
                "programado_para": g.programado_para,
                "saltado_hoy": False,
                "subobjetivos": subs_by_goal.get(g.id, []),
            })
        return result

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

        if 'programado_para' in update_data or 'fecha_programada' in update_data:
            schedule_type, schedule_date = GoalService._resolve_schedule(
                update_data.get('programado_para'),
                update_data.get('fecha_programada'),
            )
            update_data['programado_para'] = schedule_type
            update_data['fecha_programada'] = schedule_date

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
    def get_skipped_goal_entries(db: Session, fecha: str) -> List[GoalSkipDay]:
        """Obtener entradas de objetivos saltados con motivo para una fecha."""
        return (
            db.query(GoalSkipDay)
            .filter(GoalSkipDay.fecha == fecha)
            .all()
        )

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
    def skip_goal_for_date(db: Session, goal_id: int, fecha: str, reason: Optional[str] = None) -> Optional[GoalSkipDay]:
        """Persistir que un objetivo recurrente fue saltado en una fecha."""
        goal = db.query(Goal).filter(Goal.id == goal_id).first()
        if not goal or not goal.recurrente:
            return None

        cleaned_reason = reason.strip() if isinstance(reason, str) else None
        if cleaned_reason == "":
            cleaned_reason = None

        existing = db.query(GoalSkipDay).filter(
            GoalSkipDay.objetivo_id == goal_id,
            GoalSkipDay.fecha == fecha,
        ).first()
        if existing:
            existing.motivo = cleaned_reason
            db.commit()
            db.refresh(existing)
            return existing

        skip_day = GoalSkipDay(
            objetivo_id=goal_id,
            fecha=fecha,
            motivo=cleaned_reason,
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

