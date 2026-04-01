"""
Servicio para carpetas de subobjetivos.
"""

from sqlalchemy.orm import Session
from app.models.models import GoalFolder
from app.schemas.folder_schemas import GoalFolderCreate, GoalFolderUpdate
from typing import List, Optional
from datetime import datetime


class GoalFolderService:

    @staticmethod
    def get_all(db: Session) -> List[GoalFolder]:
        return db.query(GoalFolder).order_by(GoalFolder.nombre).all()

    @staticmethod
    def get(db: Session, folder_id: int) -> Optional[GoalFolder]:
        return db.query(GoalFolder).filter(GoalFolder.id == folder_id).first()

    @staticmethod
    def create(db: Session, data: GoalFolderCreate) -> GoalFolder:
        folder = GoalFolder(
            nombre=data.nombre,
            icono=data.icono,
            color=data.color,
            fecha_creacion=datetime.now(),
        )
        db.add(folder)
        db.commit()
        db.refresh(folder)
        return folder

    @staticmethod
    def update(db: Session, folder_id: int, data: GoalFolderUpdate) -> Optional[GoalFolder]:
        folder = GoalFolderService.get(db, folder_id)
        if not folder:
            return None
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(folder, key, value)
        db.commit()
        db.refresh(folder)
        return folder

    @staticmethod
    def delete(db: Session, folder_id: int) -> bool:
        folder = GoalFolderService.get(db, folder_id)
        if not folder:
            return False
        db.delete(folder)
        db.commit()
        return True
