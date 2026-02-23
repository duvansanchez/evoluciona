"""
Modelos SQLAlchemy para la base de datos.
Mapean las tablas de SQL Server.
"""

from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, 
    ForeignKey, Text, Numeric, Float, Enum as SQLEnum, Unicode
)
from sqlalchemy.orm import relationship
from app.db.database import Base
import enum


class GoalCategory(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"
    GENERAL = "general"


class GoalPriority(str, enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class DayPart(str, enum.Enum):
    MORNING = "morning"
    AFTERNOON = "afternoon"
    EVENING = "evening"


class QuestionType(str, enum.Enum):
    TEXT = "text"
    SELECT = "select"
    CHECKBOX = "checkbox"
    RADIO = "radio"


class QuestionCategory(str, enum.Enum):
    PERSONAL = "personal"
    WORK = "work"
    HEALTH = "health"
    HABITS = "habits"
    GOALS = "goals"
    GENERAL = "general"


class Goal(Base):
    """Modelo para objetivos."""
    __tablename__ = "objetivos"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True)  # TODO: Será FK a User cuando autenticación esté implementada
    titulo = Column(String(255), nullable=False)
    icono = Column(Unicode(10), nullable=True)  # Unicode para soportar emojis
    descripcion = Column(Text, nullable=True)
    prioridad = Column(String(20), nullable=True)
    categoria = Column(String(100), nullable=True)
    completado = Column(Boolean, default=False)
    fecha_creacion = Column(DateTime, nullable=True)
    fecha_completado = Column(DateTime, nullable=True)
    objetivo_padre_id = Column(Integer, ForeignKey("objetivos.id"), nullable=True)
    es_padre = Column(Boolean, default=False)
    estado = Column(String(50), nullable=True)
    fecha_inicio = Column(DateTime, nullable=True)
    fecha_fin = Column(DateTime, nullable=True)
    horas_estimadas = Column(Float, nullable=True)
    dificultad = Column(Integer, nullable=True)
    etiquetas = Column(String(255), nullable=True)
    recompensa = Column(String(255), nullable=True)
    notas_adicionales = Column(Text, nullable=True)
    recurrente = Column(Boolean, default=False)
    frecuencia = Column(String(20), nullable=True)
    fecha_proyeccion_comienzo = Column(DateTime, nullable=True)
    orden = Column(Integer, nullable=False, default=0)
    parte_dia = Column(String(20), nullable=True)
    tiempo_focus = Column(Integer, nullable=True)
    fecha_programada = Column(DateTime, nullable=True)
    programado_para = Column(String(20), nullable=True)
    
    # Relaciones self-referenciadas
    subgoals = relationship(
        "Goal",
        back_populates="parent",
        remote_side=[id],
        foreign_keys=[objetivo_padre_id],
        cascade="all, delete-orphan",
        single_parent=True
    )
    parent = relationship("Goal", back_populates="subgoals", remote_side=[objetivo_padre_id])


class PhraseCategory(Base):
    """Modelo para categorías de frases."""
    __tablename__ = "categorias"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(String(500), nullable=True)
    activa = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime, nullable=True)
    
    # Relaciones
    phrases = relationship("Phrase", back_populates="category", foreign_keys="Phrase.categoria_id")




class Phrase(Base):
    """Modelo para frases inspiracionales."""
    __tablename__ = "frases"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True)
    texto = Column(String(1000), nullable=False)
    autor = Column(String(200), nullable=True)
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=True)
    subcategoria_id = Column(Integer, ForeignKey("subcategorias.id"), nullable=True)
    notas = Column(Text, nullable=True)
    activa = Column(Boolean, default=True)
    total_repasos = Column(Integer, default=0)
    ultima_vez = Column(DateTime, nullable=True)
    fecha_creacion = Column(DateTime, nullable=True)
    
    # Relaciones
    category = relationship("PhraseCategory", back_populates="phrases", foreign_keys=[categoria_id])
    subcategory = relationship("PhraseSubcategory", back_populates="phrases", foreign_keys=[subcategoria_id])


class Question(Base):
    """Modelo para preguntas diarias."""
    __tablename__ = "question"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    text = Column(String(500), nullable=False)
    type = Column(String(50), nullable=False)
    options = Column(Text, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, nullable=True)
    assigned_user_id = Column(Integer, nullable=True)
    descripcion = Column(String(500), nullable=True)
    is_required = Column(Boolean, nullable=False)
    categoria = Column(String(100), nullable=False)
    frecuencia = Column(String(20), nullable=True)
    
    # Relaciones
    responses = relationship("QuestionResponse", back_populates="question", foreign_keys="QuestionResponse.question_id")
    question_options = relationship("QuestionOption", back_populates="question", foreign_keys="QuestionOption.pregunta_id")




class QuestionResponse(Base):
    """Modelo para respuestas a preguntas."""
    __tablename__ = "response"

    id = Column(Integer, primary_key=True, autoincrement=True)
    question_id = Column(Integer, ForeignKey("question.id"), nullable=False)
    response = Column(Text, nullable=True)
    date = Column(DateTime, nullable=True)
    user_id = Column(Integer, nullable=True)
    start_time = Column(DateTime, nullable=True)
    response_time = Column(Integer, nullable=True)

    # Relaciones
    question = relationship("Question", back_populates="responses", foreign_keys=[question_id])


class PhraseSubcategory(Base):
    """Modelo para subcategorías de frases."""
    __tablename__ = "subcategorias"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True)
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=True)
    nombre = Column(String(100), nullable=False)
    fecha_creacion = Column(DateTime, nullable=True)
    activa = Column(Boolean, default=True)
    descripcion = Column(String(500), nullable=True)
    
    # Relaciones
    phrases = relationship("Phrase", back_populates="subcategory", foreign_keys="Phrase.subcategoria_id")


class QuestionOption(Base):
    """Modelo para opciones de preguntas."""
    __tablename__ = "question_option"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    pregunta_id = Column(Integer, ForeignKey("question.id"), nullable=False)
    valor = Column(String(255), nullable=False)
    etiqueta = Column(String(255), nullable=False)
    orden = Column(Integer, default=0)
    
    # Relaciones
    question = relationship("Question", back_populates="question_options", foreign_keys=[pregunta_id])


class DailyQuestionsSession(Base):
    """Modelo para sesiones diarias de preguntas."""
    __tablename__ = "daily_sessions"
    
    id = Column(String(36), primary_key=True)
    date = Column(String(10), nullable=False)
    completed_at = Column(String(30), nullable=True)
    total_questions = Column(Integer, default=0)
    answered_questions = Column(Integer, default=0)
    created_at = Column(String(30), nullable=True)
