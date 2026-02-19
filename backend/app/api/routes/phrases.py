"""
Endpoints para frases (Phrases y Categories).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import (
    PhraseCategoryCreate, PhraseCategoryUpdate, PhraseCategoryResponse,
    PhraseCreate, PhraseUpdate, PhraseResponse,
    PhrasesPaginatedResponse
)
from app.services.phrase_service import (
    PhraseCategoryService, PhraseService
)
from typing import List
import math

router = APIRouter(prefix="/api/phrases", tags=["phrases"])


# ==================== PHRASE CATEGORIES ====================

@router.get("/categories", response_model=PhrasesPaginatedResponse)
def list_categories(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Obtener categorías de frases."""
    categories, total = PhraseCategoryService.get_categories(db, page=page, page_size=page_size)
    pages = math.ceil(total / page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
        "items": categories
    }


@router.post("/categories", response_model=PhraseCategoryResponse)
def create_category(category: PhraseCategoryCreate, db: Session = Depends(get_db)):
    """Crear categoría de frase."""
    return PhraseCategoryService.create_category(db, category)


@router.patch("/categories/{category_id}", response_model=PhraseCategoryResponse)
def update_category(category_id: str, category: PhraseCategoryUpdate, db: Session = Depends(get_db)):
    """Actualizar categoría de frase."""
    db_category = PhraseCategoryService.update_category(db, category_id, category)
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    return db_category


@router.delete("/categories/{category_id}")
def delete_category(category_id: str, db: Session = Depends(get_db)):
    """Eliminar categoría de frase."""
    if not PhraseCategoryService.delete_category(db, category_id):
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}


# ==================== PHRASES ====================

@router.get("", response_model=PhrasesPaginatedResponse)
def list_phrases(
    category_id: str = Query(None),
    subcategory_id: str = Query(None),
    active: bool = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Obtener frases con filtros."""
    phrases, total = PhraseService.get_phrases(
        db,
        category_id=category_id,
        subcategory_id=subcategory_id,
        active=active,
        page=page,
        page_size=page_size
    )
    pages = math.ceil(total / page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
        "items": phrases
    }


@router.post("", response_model=PhraseResponse)
def create_phrase(phrase: PhraseCreate, db: Session = Depends(get_db)):
    """Crear frase."""
    db_phrase = PhraseService.create_phrase(db, phrase)
    if not db_phrase:
        raise HTTPException(status_code=404, detail="Category not found")
    return db_phrase


@router.patch("/{phrase_id}", response_model=PhraseResponse)
def update_phrase(phrase_id: str, phrase: PhraseUpdate, db: Session = Depends(get_db)):
    """Actualizar frase."""
    db_phrase = PhraseService.update_phrase(db, phrase_id, phrase)
    if not db_phrase:
        raise HTTPException(status_code=404, detail="Phrase not found")
    return db_phrase


@router.delete("/{phrase_id}")
def delete_phrase(phrase_id: str, db: Session = Depends(get_db)):
    """Eliminar frase."""
    if not PhraseService.delete_phrase(db, phrase_id):
        raise HTTPException(status_code=404, detail="Phrase not found")
    return {"message": "Phrase deleted"}


@router.post("/{phrase_id}/review", response_model=PhraseResponse)
def review_phrase(phrase_id: str, db: Session = Depends(get_db)):
    """Registrar review de frase."""
    db_phrase = PhraseService.review_phrase(db, phrase_id)
    if not db_phrase:
        raise HTTPException(status_code=404, detail="Phrase not found")
    return db_phrase
