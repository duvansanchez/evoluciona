"""
Schemas Pydantic para subobjetivos.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SubGoalBase(BaseModel):
    """Base para subobjetivos."""
    titulo: str = Field(..., min_length=1, max_length=255)
    completado: bool = False
    orden: Optional[int] = None
    tiempo_focus: Optional[int] = 0
    notas: Optional[str] = None
    folder_id: Optional[int] = None


class SubGoalCreate(SubGoalBase):
    """Schema para crear subobjetivo."""
    pass


class SubGoalUpdate(BaseModel):
    """Schema para actualizar subobjetivo."""
    titulo: Optional[str] = Field(None, min_length=1, max_length=255)
    completado: Optional[bool] = None
    orden: Optional[int] = None
    tiempo_focus: Optional[int] = None
    notas: Optional[str] = None
    folder_id: Optional[int] = None


class SubGoalResponse(SubGoalBase):
    """Schema para respuesta de subobjetivo."""
    id: int
    objetivo_id: int
    fecha_creacion: Optional[datetime] = None
    orden: Optional[int] = None
    folder_id: Optional[int] = None

    class Config:
        from_attributes = True


class SubGoalSkipDayResponse(BaseModel):
    """Respuesta para un subobjetivo saltado en una fecha."""
    subgoal_id: int
    fecha: str
