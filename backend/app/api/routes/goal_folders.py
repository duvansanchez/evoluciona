"""
Endpoints para carpetas de subobjetivos.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.folder_schemas import GoalFolderCreate, GoalFolderUpdate, GoalFolderResponse
from app.services.folder_service import GoalFolderService
from typing import List

router = APIRouter(tags=["goal-folders"])


@router.get("/api/goal-folders", response_model=List[GoalFolderResponse])
def list_folders(db: Session = Depends(get_db)):
    return GoalFolderService.get_all(db)


@router.post("/api/goal-folders", response_model=GoalFolderResponse, status_code=201)
def create_folder(data: GoalFolderCreate, db: Session = Depends(get_db)):
    return GoalFolderService.create(db, data)


@router.patch("/api/goal-folders/{folder_id}", response_model=GoalFolderResponse)
def update_folder(folder_id: int, data: GoalFolderUpdate, db: Session = Depends(get_db)):
    folder = GoalFolderService.update(db, folder_id, data)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder


@router.delete("/api/goal-folders/{folder_id}", status_code=204)
def delete_folder(folder_id: int, db: Session = Depends(get_db)):
    if not GoalFolderService.delete(db, folder_id):
        raise HTTPException(status_code=404, detail="Folder not found")
