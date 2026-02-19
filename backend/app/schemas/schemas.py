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


class GoalFocusUpdate(BaseModel):
    """Actualizar focus de objetivo."""
    tiempo_focus: int = Field(..., ge=0)
    notas_adicionales: Optional[str] = None


class GoalResponse(BaseModel):
    """Respuesta de objetivo."""
    id: int
    user_id: int
    titulo: str
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
    created_at: str
    
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
