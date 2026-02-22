"""
Servicios para preguntas y sesiones diarias.
"""

from sqlalchemy.orm import Session
from sqlalchemy import text, or_
from app.models.models import Question, QuestionResponse, QuestionOption, DailyQuestionsSession
from app.schemas.schemas import QuestionCreate, QuestionUpdate
from datetime import datetime
from typing import Optional, List, Tuple
import json


class QuestionService:
    """Servicio para preguntas."""
    
    @staticmethod
    def create_question(db: Session, question: QuestionCreate) -> Question:
        """Crear pregunta."""
        db_question = Question(
            text=question.text,
            descripcion=question.descripcion,
            type=question.type,
            categoria=question.categoria,
            is_required=question.is_required,
            active=question.active,
            options=question.options,
        )
        db.add(db_question)
        db.commit()
        db.refresh(db_question)
        return db_question
    
    @staticmethod
    def get_questions(
        db: Session,
        category: Optional[str] = None,
        active: Optional[bool] = None,
        frequency: Optional[str] = None,
        page: int = 1,
        page_size: int = 10
    ) -> Tuple[List[Question], int]:
        """Obtener preguntas con filtros y paginación."""
        query = db.query(Question)
        
        if category:
            query = query.filter(Question.categoria == category)
        if active is not None:
            query = query.filter(Question.active == active)
        if frequency:
            daily_variants = ('diaria', 'diario', 'daily')
            if frequency.lower() in daily_variants:
                query = query.filter(
                    or_(
                        Question.frecuencia.in_(daily_variants),
                        Question.frecuencia == None,
                        Question.frecuencia == '',
                    )
                )
            else:
                query = query.filter(Question.frecuencia == frequency)
        
        total = query.count()
        questions = query.order_by(Question.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return questions, total
    
    @staticmethod
    def get_question(db: Session, question_id: str) -> Optional[Question]:
        """Obtener pregunta por ID."""
        return db.query(Question).filter(Question.id == question_id).first()
    
    @staticmethod
    def update_question(db: Session, question_id: str, question: QuestionUpdate) -> Optional[Question]:
        """Actualizar pregunta usando SQL puro para evitar problemas de ORM con SQL Server."""
        exists = db.execute(
            text("SELECT id FROM question WHERE id = :id"), {"id": question_id}
        ).fetchone()
        if not exists:
            return None

        field_map = {
            'text': 'text',
            'descripcion': 'descripcion',
            'type': 'type',
            'options': 'options',
            'categoria': 'categoria',
            'is_required': 'is_required',
            'active': 'active',
        }

        update_data = question.model_dump(exclude_unset=True)
        if not update_data:
            return db.query(Question).filter(Question.id == question_id).first()

        set_parts = []
        params = {"question_id": question_id}
        for field, value in update_data.items():
            col = field_map.get(field, field)
            param_key = f"p_{col}"
            set_parts.append(f"{col} = :{param_key}")
            params[param_key] = int(value) if isinstance(value, bool) else value

        sql = f"UPDATE question SET {', '.join(set_parts)} WHERE id = :question_id"
        db.execute(text(sql), params)
        db.commit()

        return db.query(Question).filter(Question.id == question_id).first()
    
    @staticmethod
    def delete_question(db: Session, question_id: str) -> bool:
        """Eliminar pregunta junto con sus opciones y respuestas relacionadas."""
        # Verificar que existe
        exists = db.execute(
            text("SELECT id FROM question WHERE id = :qid"), {"qid": question_id}
        ).fetchone()
        if not exists:
            return False

        # Usar SQL puro para evitar que el ORM cargue relaciones con columnas incorrectas
        db.execute(text("DELETE FROM question_option WHERE pregunta_id = :qid"), {"qid": question_id})
        db.execute(text("DELETE FROM response WHERE question_id = :qid"), {"qid": question_id})
        db.execute(text("DELETE FROM question WHERE id = :qid"), {"qid": question_id})
        db.commit()
        return True


class DailySessionService:
    """Servicio para sesiones diarias de preguntas."""
    
    @staticmethod
    def get_or_create_session(db: Session, date: str) -> DailyQuestionsSession:
        """Obtener o crear sesión diaria."""
        session = db.query(DailyQuestionsSession).filter(
            DailyQuestionsSession.date == date
        ).first()
        
        if session:
            return session
        
        # Crear nueva sesión
        # Contar preguntas activas
        total_questions = db.query(Question).filter(Question.active == True).count()
        
        session = DailyQuestionsSession(
            date=date,
            total_questions=total_questions,
            answered_questions=0,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session
    
    @staticmethod
    def get_session(db: Session, date: str) -> Optional[DailyQuestionsSession]:
        """Obtener sesión por fecha."""
        return db.query(DailyQuestionsSession).filter(
            DailyQuestionsSession.date == date
        ).first()
    
    @staticmethod
    def save_responses(db: Session, date: str, session_data: DailySessionCreate) -> DailyQuestionsSession:
        """Guardar respuestas a una sesión diaria usando SQL puro."""
        session = DailySessionService.get_or_create_session(db, date)

        # Eliminar respuestas previas del día usando SQL puro (evita mismatch ORM)
        db.execute(
            text("DELETE FROM response WHERE CAST(fecha AS DATE) = :date"),
            {"date": date}
        )

        # Insertar respuestas con los nombres reales de columna
        answered_count = 0
        now = datetime.utcnow()
        for response_data in session_data.responses:
            db.execute(
                text("INSERT INTO response (pregunta_id, respuesta, fecha) VALUES (:qid, :resp, :fecha)"),
                {
                    "qid": int(response_data.question_id),
                    "resp": response_data.response,
                    "fecha": now,
                }
            )
            answered_count += 1

        # Actualizar sesión
        db.execute(
            text("UPDATE daily_sessions SET answered_questions = :count, completed_at = :completed WHERE id = :sid"),
            {"count": answered_count, "completed": now.isoformat(), "sid": session.id}
        )
        db.commit()
        db.refresh(session)
        return session
    
    @staticmethod
    def get_active_questions(db: Session) -> List[Question]:
        """Obtener preguntas activas ordenadas."""
        return db.query(Question).filter(
            Question.active == True
        ).order_by(Question.order).all()
