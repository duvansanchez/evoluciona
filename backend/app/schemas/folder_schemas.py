"""
Schemas Pydantic para carpetas de subobjetivos.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class GoalFolderCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    icono: Optional[str] = None
    color: Optional[str] = None


class GoalFolderUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    icono: Optional[str] = None
    color: Optional[str] = None


class GoalFolderResponse(BaseModel):
    id: int
    nombre: str
    icono: Optional[str] = None
    color: Optional[str] = None
    fecha_creacion: Optional[datetime] = None

    class Config:
        from_attributes = True
