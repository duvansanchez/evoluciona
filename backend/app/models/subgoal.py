"""
Modelo para subobjetivos (tabla subobjetivos separada).
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text
)
from app.db.database import Base


class SubGoal(Base):
    """Modelo para subobjetivos (tabla separada subobjetivos)."""
    __tablename__ = "subobjetivos"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    objetivo_id = Column(Integer, ForeignKey("objetivos.id", ondelete="CASCADE"), nullable=False)
    titulo = Column(String(255), nullable=False)
    completado = Column(Boolean, default=False, nullable=False)
    fecha_creacion = Column(DateTime, nullable=True, default=datetime.utcnow)
    orden = Column(Integer, nullable=False, default=0)
    tiempo_focus = Column(Integer, nullable=True, default=0)  # Tiempo en segundos
    notas = Column(Text, nullable=True)
    folder_id = Column(Integer, ForeignKey("carpetas_subobjetivos.id", ondelete="SET NULL"), nullable=True)
