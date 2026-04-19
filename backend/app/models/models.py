"""
Modelos SQLAlchemy para la base de datos.
Mapean las tablas de SQL Server.
"""

from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime,
    ForeignKey, Text, Numeric, Float, Enum as SQLEnum, Unicode, Table, UniqueConstraint
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
    skip_days = relationship("GoalSkipDay", back_populates="goal", cascade="all, delete-orphan")
    completion_days = relationship("GoalCompletionDay", back_populates="goal", cascade="all, delete-orphan")


class GoalSkipDay(Base):
    """Marca un objetivo recurrente como saltado para una fecha concreta."""
    __tablename__ = "objetivo_saltado_dias"
    __table_args__ = (
        UniqueConstraint("objetivo_id", "fecha", name="uq_objetivo_saltado_dia"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    objetivo_id = Column(Integer, ForeignKey("objetivos.id"), nullable=False)
    fecha = Column(String(10), nullable=False)  # YYYY-MM-DD
    fecha_creacion = Column(DateTime, nullable=True, default=datetime.now)

    goal = relationship("Goal", back_populates="skip_days")


class GoalCompletionDay(Base):
    """Historial diario de completado para objetivos recurrentes."""
    __tablename__ = "objetivo_completado_dias"
    __table_args__ = (
        UniqueConstraint("objetivo_id", "fecha", name="uq_objetivo_completado_dia"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    objetivo_id = Column(Integer, ForeignKey("objetivos.id"), nullable=False)
    fecha = Column(String(10), nullable=False)  # YYYY-MM-DD
    fecha_creacion = Column(DateTime, nullable=True, default=datetime.now)

    goal = relationship("Goal", back_populates="completion_days")


class GoalFolder(Base):
    """Modelo para carpetas reutilizables de subobjetivos."""
    __tablename__ = "carpetas_subobjetivos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), nullable=False)
    icono = Column(Unicode(10), nullable=True)
    color = Column(String(20), nullable=True)
    fecha_creacion = Column(DateTime, nullable=True, default=datetime.now)


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
    review_logs = relationship("PhraseReviewLog", back_populates="phrase", cascade="all, delete-orphan")


class PhraseReviewLog(Base):
    """Historial de repasos de frases para informes semanales/mensuales."""
    __tablename__ = "frase_repaso_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    phrase_id = Column(Integer, ForeignKey("frases.id"), nullable=False)
    review_plan_id = Column(Integer, ForeignKey("review_plans.id"), nullable=True)
    session_label = Column(String(255), nullable=True)
    reviewed_at = Column(DateTime, nullable=False, default=datetime.now)
    review_date = Column(String(10), nullable=False)  # YYYY-MM-DD

    phrase = relationship("Phrase", back_populates="review_logs", foreign_keys=[phrase_id])
    review_plan = relationship("ReviewPlan", foreign_keys=[review_plan_id])


class PhraseAudioPreference(Base):
    """Preferencias globales del modulo de audio para frases."""
    __tablename__ = "frase_audio_preferencias"

    id = Column(Integer, primary_key=True, autoincrement=True)
    selected_voice_name = Column(String(255), nullable=True)
    rate = Column(Float, nullable=False, default=1.0)
    pitch = Column(Float, nullable=False, default=1.0)
    pause_ms = Column(Integer, nullable=False, default=700)
    fecha_actualizacion = Column(DateTime, nullable=True, default=datetime.now, onupdate=datetime.now)


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


class QuestionFeedback(Base):
    """Feedback libre asociado a una pregunta en una fecha concreta."""
    __tablename__ = "question_feedback"
    __table_args__ = (
        UniqueConstraint("question_id", "fecha", name="uq_question_feedback_question_date"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    question_id = Column(Integer, ForeignKey("question.id"), nullable=False)
    fecha = Column(String(10), nullable=False)  # YYYY-MM-DD
    texto = Column(Text, nullable=False)
    fecha_creacion = Column(DateTime, nullable=True, default=datetime.now)
    fecha_actualizacion = Column(DateTime, nullable=True, default=datetime.now, onupdate=datetime.now)

    question = relationship("Question", foreign_keys=[question_id])


class QuestionSkipDay(Base):
    """Marca una pregunta como saltada para una fecha concreta."""
    __tablename__ = "question_skip_days"
    __table_args__ = (
        UniqueConstraint("question_id", "fecha", name="uq_question_skip_day_question_date"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    question_id = Column(Integer, ForeignKey("question.id"), nullable=False)
    fecha = Column(String(10), nullable=False)  # YYYY-MM-DD
    fecha_creacion = Column(DateTime, nullable=True, default=datetime.now)

    question = relationship("Question", foreign_keys=[question_id])


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


rutina_objetivos = Table(
    "rutina_objetivos",
    Base.metadata,
    Column("rutina_id", Integer, ForeignKey("rutinas.id"), primary_key=True),
    Column("objetivo_id", Integer, ForeignKey("objetivos.id"), primary_key=True),
)


class Rutina(Base):
    """Plantilla reutilizable de rutina."""
    __tablename__ = "rutinas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(255), nullable=False)
    parte_dia = Column(String(20), nullable=False)  # morning | afternoon | evening
    color = Column(String(30), nullable=True)
    descripcion = Column(Text, nullable=True)
    dias_semana = Column(Text, nullable=True)  # JSON: [0..6] where 0 = lunes
    activa = Column(Boolean, default=True)
    fecha_creacion = Column(DateTime, nullable=True)

    bloques = relationship(
        "RutinaBloque", back_populates="rutina",
        cascade="all, delete-orphan", order_by="RutinaBloque.orden"
    )
    asignaciones = relationship("RutinaAsignacion", back_populates="rutina")
    objetivos = relationship("Goal", secondary=rutina_objetivos)


class RutinaBloque(Base):
    """Actividad dentro de una rutina."""
    __tablename__ = "rutina_bloques"

    id = Column(Integer, primary_key=True, autoincrement=True)
    rutina_id = Column(Integer, ForeignKey("rutinas.id"), nullable=False)
    nombre = Column(String(255), nullable=False)
    orden = Column(Integer, nullable=False, default=0)
    hora_inicio = Column(String(5), nullable=True)   # "06:30"
    duracion_minutos = Column(Integer, nullable=True)
    notas = Column(Text, nullable=True)

    rutina = relationship("Rutina", back_populates="bloques")


class RutinaAsignacion(Base):
    """Asignación de una rutina a un día y parte del día específicos."""
    __tablename__ = "rutina_asignaciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fecha = Column(String(10), nullable=False)        # "2026-03-23"
    parte_dia = Column(String(20), nullable=False)
    rutina_id = Column(Integer, ForeignKey("rutinas.id"), nullable=False)
    completada = Column(Boolean, default=False)
    es_automatica = Column(Boolean, default=False)
    objetivo_ids = Column(Text, nullable=True)        # JSON: [1, 2, 3]
    fecha_creacion = Column(DateTime, nullable=True)

    rutina = relationship("Rutina", back_populates="asignaciones")


class ReviewPlan(Base):
    """Planificaciones de repaso de frases."""
    __tablename__ = "review_plans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(255), nullable=False)
    targets = Column(Text, nullable=False)  # JSON array de strings
    config = Column(Text, nullable=True)    # JSON: { shuffle, daily_limit, excluded_phrase_ids }
    fecha_creacion = Column(DateTime, nullable=True)


class WeeklyConclusion(Base):
    """Conclusiones semanales guardadas desde el modulo de progreso."""
    __tablename__ = "weekly_conclusions"
    __table_args__ = (
        UniqueConstraint("week_start", name="uq_weekly_conclusions_week_start"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    week_start = Column(String(10), nullable=False)  # YYYY-MM-DD
    week_end = Column(String(10), nullable=False)    # YYYY-MM-DD
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=True, default=datetime.now)
    updated_at = Column(DateTime, nullable=True, default=datetime.now, onupdate=datetime.now)
