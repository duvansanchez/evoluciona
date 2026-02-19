"""
Servicios para preguntas y sesiones diarias.
"""

from sqlalchemy.orm import Session
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
        """Actualizar pregunta."""
        db_question = db.query(Question).filter(Question.id == question_id).first()
        if not db_question:
            return None
        
        update_data = question.model_dump(exclude_unset=True)
        
        for field, value in update_data.items():
            if field == "text":
                setattr(db_question, "text", value)
            elif field == "descripcion":
                setattr(db_question, "descripcion", value)
            elif field == "type":
                setattr(db_question, "type", value)
            elif field == "options":
                setattr(db_question, "options", value)
            elif field == "categoria":
                setattr(db_question, "categoria", value)
            elif field == "is_required":
                setattr(db_question, "is_required", value)
            elif field == "active":
                setattr(db_question, "active", value)
        
        db.commit()
        db.refresh(db_question)
        return db_question
    
    @staticmethod
    def delete_question(db: Session, question_id: str) -> bool:
        """Eliminar pregunta y sus opciones."""
        db_question = db.query(Question).filter(Question.id == question_id).first()
        if not db_question:
            return False
        
        db.delete(db_question)
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
        """Guardar respuestas a una sesión diaria."""
        # Obtener o crear sesión
        session = DailySessionService.get_or_create_session(db, date)
        
        # Eliminar respuestas previas para esta sesión
        db.query(QuestionResponse).filter(
            QuestionResponse.session_id == session.id
        ).delete()
        
        # Guardar nuevas respuestas
        answered_count = 0
        for response_data in session_data.responses:
            response = QuestionResponse(
                session_id=session.id,
                question_id=response_data.question_id,
                response=response_data.response,
                answered_at=datetime.utcnow().isoformat(),
            )
            db.add(response)
            answered_count += 1
        
        # Actualizar contador
        session.answered_questions = answered_count
        session.completed_at = datetime.utcnow().isoformat()
        
        db.commit()
        db.refresh(session)
        return session
    
    @staticmethod
    def get_active_questions(db: Session) -> List[Question]:
        """Obtener preguntas activas ordenadas."""
        return db.query(Question).filter(
            Question.active == True
        ).order_by(Question.order).all()
