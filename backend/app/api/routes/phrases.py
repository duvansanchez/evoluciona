"""
Endpoints para frases (Phrases y Categories).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import (
    PhraseCategoryCreate, PhraseCategoryUpdate, PhraseCategoryResponse,
    PhraseCreate, PhraseUpdate, PhraseResponse,
    PhrasesPaginatedResponse,
    PhraseSubcategoryCreate, PhraseSubcategoryUpdate, PhraseSubcategoryResponse,
    ReviewPlanCreate, ReviewPlanResponse,
)
from app.services.phrase_service import (
    PhraseCategoryService, PhraseSubcategoryService, PhraseService
)
from app.models.models import ReviewPlan
from typing import List
import math
import json
from datetime import datetime

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


@router.get("/categories-tree", response_model=List[dict])
def get_categories_tree(db: Session = Depends(get_db)):
    """Obtener categorías activas con subcategorías anidadas (para selector de frases)."""
    return PhraseCategoryService.get_categories_with_subcategories(db)


@router.get("/categories-admin", response_model=List[dict])
def get_categories_admin(db: Session = Depends(get_db)):
    """Obtener todas las categorías (activas e inactivas) con subcategorías y conteos para admin."""
    return PhraseCategoryService.get_all_categories_admin(db)


@router.post("/subcategories", response_model=dict)
def create_subcategory(data: PhraseSubcategoryCreate, db: Session = Depends(get_db)):
    """Crear subcategoría de frase."""
    sub = PhraseSubcategoryService.create_subcategory(db, data)
    return {
        "id": str(sub.id),
        "name": sub.nombre,
        "description": sub.descripcion,
        "active": sub.activa,
        "category_id": str(sub.categoria_id),
        "created_at": sub.fecha_creacion.isoformat() if sub.fecha_creacion else None,
        "phrase_count": 0,
    }


@router.patch("/subcategories/{subcategory_id}", response_model=dict)
def update_subcategory(subcategory_id: str, data: PhraseSubcategoryUpdate, db: Session = Depends(get_db)):
    """Actualizar subcategoría de frase."""
    sub = PhraseSubcategoryService.update_subcategory(db, subcategory_id, data)
    if not sub:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    return {
        "id": str(sub.id),
        "name": sub.nombre,
        "description": sub.descripcion,
        "active": sub.activa,
        "category_id": str(sub.categoria_id),
        "created_at": sub.fecha_creacion.isoformat() if sub.fecha_creacion else None,
    }


@router.delete("/subcategories/{subcategory_id}")
def delete_subcategory(subcategory_id: str, db: Session = Depends(get_db)):
    """Eliminar subcategoría de frase."""
    if not PhraseSubcategoryService.delete_subcategory(db, subcategory_id):
        raise HTTPException(status_code=404, detail="Subcategory not found")
    return {"message": "Subcategory deleted"}


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


# ==================== REVIEW PLANS ====================

def _plan_to_dict(plan: ReviewPlan) -> dict:
    return {
        "id": plan.id,
        "name": plan.nombre,
        "targets": json.loads(plan.targets),
        "created_at": plan.fecha_creacion.isoformat() if plan.fecha_creacion else None,
    }


@router.get("/review-plans", response_model=List[ReviewPlanResponse])
def list_review_plans(db: Session = Depends(get_db)):
    """Obtener todas las planificaciones de repaso."""
    plans = db.query(ReviewPlan).order_by(ReviewPlan.fecha_creacion.desc()).all()
    return [_plan_to_dict(p) for p in plans]


@router.post("/review-plans", response_model=ReviewPlanResponse)
def create_review_plan(data: ReviewPlanCreate, db: Session = Depends(get_db)):
    """Crear planificación de repaso."""
    plan = ReviewPlan(
        nombre=data.name,
        targets=json.dumps(data.targets),
        fecha_creacion=datetime.now(),
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _plan_to_dict(plan)


@router.delete("/review-plans/{plan_id}")
def delete_review_plan(plan_id: int, db: Session = Depends(get_db)):
    """Eliminar planificación de repaso."""
    plan = db.query(ReviewPlan).filter(ReviewPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Review plan not found")
    db.delete(plan)
    db.commit()
    return {"message": "Review plan deleted"}


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
