"""
Esquemas Pydantic para validación y serialización de datos.
"""

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List
from datetime import datetime


# ==================== GOALS ====================

class GoalBase(BaseModel):
    """Base para objetivos."""
    model_config = ConfigDict(populate_by_name=True)
    
    titulo: str = Field(..., min_length=1, max_length=255, alias="title")
    icono: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    prioridad: Optional[str] = None
    recurrente: Optional[bool] = False
    parte_dia: Optional[str] = None
    horas_estimadas: Optional[float] = None
    recompensa: Optional[str] = None
    es_padre: Optional[bool] = False
    objetivo_padre_id: Optional[int] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    programado_para: Optional[str] = None


class GoalCreate(GoalBase):
    """Crear objetivo."""
    pass


class GoalUpdate(BaseModel):
    """Actualizar objetivo."""
    titulo: Optional[str] = None
    icono: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    prioridad: Optional[str] = None
    recurrente: Optional[bool] = None
    parte_dia: Optional[str] = None
    horas_estimadas: Optional[float] = None
    recompensa: Optional[str] = None
    es_padre: Optional[bool] = None
    objetivo_padre_id: Optional[int] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    programado_para: Optional[str] = None
    completado: Optional[bool] = None
    fecha_completado: Optional[str] = None


class GoalFocusUpdate(BaseModel):
    """Actualizar focus de objetivo."""
    tiempo_focus: int = Field(..., ge=0)
    notas_adicionales: Optional[str] = None


class GoalResponse(BaseModel):
    """Respuesta de objetivo."""
    id: int
    user_id: int
    titulo: str
    icono: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    prioridad: Optional[str] = None
    completado: bool
    fecha_creacion: Optional[datetime] = None
    fecha_completado: Optional[datetime] = None
    objetivo_padre_id: Optional[int] = None
    es_padre: bool = False
    estado: Optional[str] = None
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    horas_estimadas: Optional[float] = None
    dificultad: Optional[int] = None
    etiquetas: Optional[str] = None
    recompensa: Optional[str] = None
    notas_adicionales: Optional[str] = None
    recurrente: bool = False
    frecuencia: Optional[str] = None
    fecha_proyeccion_comienzo: Optional[datetime] = None
    orden: int
    parte_dia: Optional[str] = None
    tiempo_focus: Optional[int] = None
    fecha_programada: Optional[datetime] = None
    programado_para: Optional[str] = None
    saltado_hoy: bool = False
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


# ==================== PHRASE CATEGORIES ====================

class PhraseSubcategoryBase(BaseModel):
    """Base para subcategoría de frases."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    active: Optional[bool] = True


class PhraseSubcategoryCreate(PhraseSubcategoryBase):
    """Crear subcategoría de frase."""
    category_id: str


class PhraseSubcategoryUpdate(BaseModel):
    """Actualizar subcategoría de frase."""
    name: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None


class PhraseSubcategoryResponse(PhraseSubcategoryBase):
    """Respuesta de subcategoría de frase."""
    id: str
    category_id: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class PhraseCategoryBase(BaseModel):
    """Base para categoría de frases."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    active: Optional[bool] = True


class PhraseCategoryCreate(PhraseCategoryBase):
    """Crear categoría de frase."""
    pass


class PhraseCategoryUpdate(BaseModel):
    """Actualizar categoría de frase."""
    name: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None


class PhraseCategoryResponse(PhraseCategoryBase):
    """Respuesta de categoría de frase."""
    id: str
    created_at: str
    
    class Config:
        from_attributes = True


class PhraseCategoryWithSubcategories(PhraseCategoryBase):
    """Categoría con subcategorías anidadas."""
    id: str
    created_at: str
    subcategories: List['PhraseSubcategoryResponse'] = []
    
    class Config:
        from_attributes = True


# ==================== PHRASES ====================

class PhraseBase(BaseModel):
    """Base para frase."""
    text: str = Field(..., min_length=1)
    author: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    notes: Optional[str] = None
    active: Optional[bool] = True


class PhraseCreate(PhraseBase):
    """Crear frase."""
    pass


class PhraseUpdate(BaseModel):
    """Actualizar frase."""
    text: Optional[str] = None
    author: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    notes: Optional[str] = None
    active: Optional[bool] = None


class PhraseResponse(BaseModel):
    """Respuesta de frase."""
    id: int
    user_id: Optional[int] = None
    texto: str
    autor: Optional[str] = None
    categoria_id: Optional[int] = None
    subcategoria_id: Optional[int] = None
    notas: Optional[str] = None
    activa: bool = True
    total_repasos: int = 0
    ultima_vez: Optional[datetime] = None
    fecha_creacion: Optional[datetime] = None
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class PhraseReviewCreate(BaseModel):
    """Registrar un repaso de frase."""
    review_plan_id: Optional[int] = None
    session_label: Optional[str] = None


class PhraseReviewLogResponse(BaseModel):
    """Respuesta de log de repaso de frase."""
    id: int
    phrase_id: int
    review_plan_id: Optional[int] = None
    session_label: Optional[str] = None
    review_date: str
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


# ==================== QUESTIONS ====================

class QuestionBase(BaseModel):
    """Base para pregunta."""
    text: str = Field(..., min_length=1)
    type: str = Field(...)
    options: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    is_required: Optional[bool] = False
    active: Optional[bool] = True


class QuestionCreate(QuestionBase):
    """Crear pregunta."""
    pass


class QuestionUpdate(BaseModel):
    """Actualizar pregunta."""
    text: Optional[str] = None
    type: Optional[str] = None
    options: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    is_required: Optional[bool] = None
    active: Optional[bool] = None


class QuestionResponse(BaseModel):
    """Respuesta de pregunta."""
    id: int
    text: str
    type: str
    options: Optional[str] = None
    active: bool = True
    created_at: Optional[datetime] = None
    assigned_user_id: Optional[int] = None
    descripcion: Optional[str] = None
    is_required: bool = False
    categoria: str
    frecuencia: Optional[str] = None
    
    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


# ==================== DAILY SESSIONS ====================

class QuestionResponseCreate(BaseModel):
    """Crear respuesta a pregunta."""
    question_id: str
    response: str  # Para multi-select, enviar como JSON string


class SingleResponseCreate(BaseModel):
    """Crear/actualizar una sola respuesta a una pregunta."""
    response: str


class QuestionFeedbackCreate(BaseModel):
    """Crear o actualizar feedback de una pregunta para una fecha."""
    text: str = Field(..., min_length=1, max_length=4000)


class QuestionFeedbackResponse(BaseModel):
    """Respuesta de feedback de pregunta."""
    id: int
    question_id: str
    date: str
    text: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


class QuestionSkipDayResponse(BaseModel):
    """Respuesta de pregunta saltada para una fecha."""
    question_id: str
    date: str


class QuestionResponseData(BaseModel):
    """Datos de respuesta a pregunta."""
    id: str
    question_id: str
    response: str
    answered_at: str
    
    class Config:
        from_attributes = True


class DailySessionCreate(BaseModel):
    """Crear sesión diaria."""
    responses: List[QuestionResponseCreate]


class DailySessionResponse(BaseModel):
    """Respuesta de sesión diaria."""
    id: str
    date: str
    total_questions: int
    answered_questions: int
    completed_at: Optional[str] = None
    responses: List[QuestionResponseData] = []
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== GOAL SIMPLE (para uso en Rutinas) ====================

class GoalSimpleResponse(BaseModel):
    id: int
    titulo: str
    icono: Optional[str] = None
    categoria: Optional[str] = None
    frecuencia: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== RUTINAS ====================

class RutinaBloqueCreate(BaseModel):
    nombre: str
    orden: int = 0
    hora_inicio: Optional[str] = None
    duracion_minutos: Optional[int] = None
    notas: Optional[str] = None


class RutinaBloqueResponse(BaseModel):
    id: int
    rutina_id: int
    nombre: str
    orden: int
    hora_inicio: Optional[str] = None
    duracion_minutos: Optional[int] = None
    notas: Optional[str] = None

    class Config:
        from_attributes = True


class RutinaCreate(BaseModel):
    nombre: str
    parte_dia: str
    color: Optional[str] = None
    categoria: Optional[str] = None
    descripcion: Optional[str] = None
    dias_semana: List[int] = []
    bloques: List[RutinaBloqueCreate] = []


class RutinaUpdate(BaseModel):
    nombre: Optional[str] = None
    parte_dia: Optional[str] = None
    color: Optional[str] = None
    categoria: Optional[str] = None
    descripcion: Optional[str] = None
    dias_semana: Optional[List[int]] = None
    bloques: Optional[List[RutinaBloqueCreate]] = None


class RutinaResponse(BaseModel):
    id: int
    nombre: str
    parte_dia: str
    color: Optional[str] = None
    categoria: Optional[str] = None
    descripcion: Optional[str] = None
    dias_semana: List[int] = []
    activa: bool
    fecha_creacion: Optional[datetime] = None
    bloques: List[RutinaBloqueResponse] = []
    objetivos: List[GoalSimpleResponse] = []

    class Config:
        from_attributes = True


class RutinaAsignacionCreate(BaseModel):
    fecha: str
    parte_dia: str
    rutina_id: int


class RutinaAsignacionUpdate(BaseModel):
    rutina_id: Optional[int] = None
    fecha: Optional[str] = None
    parte_dia: Optional[str] = None
    completada: Optional[bool] = None
    objetivo_ids: Optional[List[int]] = None


class RutinaAsignacionResponse(BaseModel):
    id: int
    fecha: str
    parte_dia: str
    rutina_id: int
    completada: bool
    es_automatica: bool = False
    objetivo_ids: List[int] = []
    rutina: RutinaResponse

    class Config:
        from_attributes = True


class DiaSemanaResponse(BaseModel):
    fecha: str
    asignaciones: List[RutinaAsignacionResponse]


# ==================== REVIEW PLANS ====================

class ReviewPlanConfig(BaseModel):
    """Configuración de una planificación de repaso."""
    shuffle: bool = False
    daily_limit: Optional[int] = None
    excluded_phrase_ids: List[int] = []


class ReviewPlanCreate(BaseModel):
    """Crear planificación de repaso."""
    name: str = Field(..., min_length=1, max_length=255)
    targets: List[str]


class ReviewPlanUpdate(BaseModel):
    """Actualizar configuración de una planificación de repaso."""
    config: ReviewPlanConfig


class ReviewPlanResponse(BaseModel):
    """Respuesta de planificación de repaso."""
    id: int
    name: str
    targets: List[str]
    config: ReviewPlanConfig = ReviewPlanConfig()
    domain_level: float = 0.0
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


# ==================== PAGINATION ====================

class PaginationParams(BaseModel):
    """Parámetros de paginación."""
    page: int = Field(1, ge=1)
    page_size: int = Field(10, ge=1, le=100)


class PaginatedResponse(BaseModel):
    """Respuesta paginada genérica."""
    total: int
    page: int
    page_size: int
    pages: int
    items: List[dict]


class GoalsPaginatedResponse(BaseModel):
    """Respuesta paginada para objetivos."""
    total: int
    page: int
    page_size: int
    pages: int
    items: List[GoalResponse]


class GoalSkipDayResponse(BaseModel):
    goal_id: int
    fecha: str
    reason: Optional[str] = None


class GoalSkipDayDetailResponse(BaseModel):
    goal_id: int
    fecha: str
    reason: Optional[str] = None


class GoalCompletionDayResponse(BaseModel):
    goal_id: int
    fecha: str
    completed_at: Optional[datetime] = None


class PhrasesPaginatedResponse(BaseModel):
    """Respuesta paginada para frases."""
    total: int
    page: int
    page_size: int
    pages: int
    items: List[PhraseResponse]


class QuestionsPaginatedResponse(BaseModel):
    """Respuesta paginada para preguntas."""
    total: int
    page: int
    page_size: int
    pages: int
    items: List[QuestionResponse]


class WeeklyConclusionUpsert(BaseModel):
    reference_date: Optional[str] = None
    content: str = Field(..., min_length=1)


class WeeklyConclusionResponse(BaseModel):
    id: Optional[int] = None
    week_start: str
    week_end: str
    period_label: str
    content: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


class DuvanConclusionCreate(BaseModel):
    conclusion_type: str = Field(default="vida")
    content: str = Field(..., min_length=1)


class DuvanConclusionResponse(BaseModel):
    id: int
    conclusion_type: str
    content: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }
