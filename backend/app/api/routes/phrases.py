"""
Endpoints para frases (Phrases y Categories).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.schemas import (
    PhraseCategoryCreate, PhraseCategoryUpdate, PhraseCategoryResponse,
    PhraseCreate, PhraseUpdate, PhraseResponse,
    PhrasesPaginatedResponse, PaginatedResponse,
    PhraseSubcategoryCreate, PhraseSubcategoryUpdate, PhraseSubcategoryResponse,
    ReviewPlanCreate, ReviewPlanUpdate, ReviewPlanResponse,
    PhraseReviewCreate, PhraseReviewLogResponse,
)
from app.services.phrase_service import (
    PhraseCategoryService, PhraseSubcategoryService, PhraseService, build_phrase_report
)
from app.services.email_service import build_html_phrase_report, send_weekly_report
from app.services.tts_service import (
    TTSServiceError,
    get_tts_status,
    synthesize_text,
    get_audio_preferences,
    update_audio_preferences,
)
from app.services.report_scheduler_service import record_report_event
from app.models.models import ReviewPlan, Phrase as PhraseModel
from sqlalchemy import or_, and_
from typing import List
import math
import json
from datetime import datetime, date

DOMAIN_CAP = 30  # repasos necesarios para considerar una frase al 100% dominada

router = APIRouter(prefix="/api/phrases", tags=["phrases"])


class PhraseAudioRequest(BaseModel):
    text: str
    rate: float | None = None
    pitch: float | None = None


class PhraseAudioPreferencesPayload(BaseModel):
    selected_voice_name: str | None = None
    rate: float | None = None
    pitch: float | None = None
    pause_ms: int | None = None


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


def _category_to_dict(cat) -> dict:
    return {
        "id": str(cat.id),
        "name": cat.nombre,
        "description": cat.descripcion,
        "active": cat.activa,
        "created_at": cat.fecha_creacion.isoformat() if cat.fecha_creacion else None,
    }


@router.post("/categories", response_model=PhraseCategoryResponse)
def create_category(category: PhraseCategoryCreate, db: Session = Depends(get_db)):
    """Crear categoría de frase."""
    return _category_to_dict(PhraseCategoryService.create_category(db, category))


@router.patch("/categories/{category_id}", response_model=PhraseCategoryResponse)
def update_category(category_id: str, category: PhraseCategoryUpdate, db: Session = Depends(get_db)):
    """Actualizar categoría de frase."""
    db_category = PhraseCategoryService.update_category(db, category_id, category)
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    return _category_to_dict(db_category)


@router.delete("/categories/{category_id}")
def delete_category(category_id: str, db: Session = Depends(get_db)):
    """Eliminar categoría de frase."""
    if not PhraseCategoryService.delete_category(db, category_id):
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}


# ==================== REVIEW PLANS ====================

_DEFAULT_PLAN_CONFIG = {"shuffle": False, "daily_limit": None, "excluded_phrase_ids": []}


def _plan_to_dict(plan: ReviewPlan) -> dict:
    try:
        config = json.loads(plan.config) if plan.config else _DEFAULT_PLAN_CONFIG
    except (ValueError, TypeError):
        config = _DEFAULT_PLAN_CONFIG
    return {
        "id": plan.id,
        "name": plan.nombre,
        "targets": json.loads(plan.targets),
        "config": config,
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


@router.patch("/review-plans/{plan_id}", response_model=ReviewPlanResponse)
def update_review_plan(plan_id: int, data: ReviewPlanUpdate, db: Session = Depends(get_db)):
    """Actualizar configuración de una planificación de repaso."""
    plan = db.query(ReviewPlan).filter(ReviewPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Review plan not found")
    plan.config = json.dumps(data.config.model_dump())
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
def review_phrase(
    phrase_id: str,
    data: PhraseReviewCreate | None = None,
    db: Session = Depends(get_db)
):
    """Registrar review de frase."""
    payload = data or PhraseReviewCreate()
    db_phrase = PhraseService.review_phrase(
        db,
        phrase_id,
        review_plan_id=payload.review_plan_id,
        session_label=payload.session_label,
    )
    if not db_phrase:
        raise HTTPException(status_code=404, detail="Phrase not found")
    return db_phrase


@router.get("/review-logs", response_model=PaginatedResponse)
def list_review_logs(
    start_date: str = Query(None),
    end_date: str = Query(None),
    review_plan_id: int = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Obtener historial de repasos de frases para futuros informes."""
    logs, total = PhraseService.get_review_logs(
        db,
        start_date=start_date,
        end_date=end_date,
        review_plan_id=review_plan_id,
        page=page,
        page_size=page_size,
    )
    pages = math.ceil(total / page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
        "items": logs,
    }


@router.get("/report", response_model=dict)
def get_phrase_report(
    mode: str = Query("weekly"),
    reference_date: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Obtener informe semanal o mensual del modulo de frases."""
    normalized_mode = (mode or "weekly").lower()
    if normalized_mode not in {"weekly", "monthly"}:
        raise HTTPException(status_code=400, detail="Mode must be weekly or monthly")

    parsed_reference: date | None = None
    if reference_date:
        try:
            parsed_reference = date.fromisoformat(reference_date)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="reference_date must use YYYY-MM-DD") from exc

    return build_phrase_report(db, normalized_mode, parsed_reference)


@router.get("/audio/status", response_model=dict)
def get_phrase_audio_status():
    """Retorna el proveedor de audio disponible para el repaso auditivo."""
    return get_tts_status()


@router.get("/audio/preferences", response_model=dict)
def get_phrase_audio_preferences(db: Session = Depends(get_db)):
    """Retorna las preferencias persistidas del audio de frases."""
    prefs = get_audio_preferences(db)
    return {
        "selected_voice_name": prefs.selected_voice_name,
        "rate": prefs.rate,
        "pitch": prefs.pitch,
        "pause_ms": prefs.pause_ms,
        "updated_at": prefs.fecha_actualizacion.isoformat() if prefs.fecha_actualizacion else None,
    }


@router.patch("/audio/preferences", response_model=dict)
def patch_phrase_audio_preferences(payload: PhraseAudioPreferencesPayload, db: Session = Depends(get_db)):
    """Actualiza las preferencias persistidas del audio de frases."""
    prefs = update_audio_preferences(
        db,
        selected_voice_name=payload.selected_voice_name,
        rate=payload.rate,
        pitch=payload.pitch,
        pause_ms=payload.pause_ms,
    )
    return {
        "selected_voice_name": prefs.selected_voice_name,
        "rate": prefs.rate,
        "pitch": prefs.pitch,
        "pause_ms": prefs.pause_ms,
        "updated_at": prefs.fecha_actualizacion.isoformat() if prefs.fecha_actualizacion else None,
    }


@router.post("/audio/generate")
def generate_phrase_audio(payload: PhraseAudioRequest):
    """Genera audio MP3 usando el proveedor TTS activo."""
    try:
        audio_bytes = synthesize_text(payload.text, rate=payload.rate, pitch=payload.pitch)
    except TTSServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return StreamingResponse(
        iter([audio_bytes]),
        media_type="audio/mpeg",
        headers={"Content-Disposition": 'inline; filename="phrase-audio.mp3"'},
    )


@router.get("/report/download")
def download_phrase_report(
    mode: str = Query("weekly"),
    reference_date: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Descarga el informe de frases del periodo como archivo HTML."""
    normalized_mode = (mode or "weekly").lower()
    if normalized_mode not in {"weekly", "monthly"}:
        raise HTTPException(status_code=400, detail="Mode must be weekly or monthly")

    parsed_reference: date | None = None
    if reference_date:
        try:
            parsed_reference = date.fromisoformat(reference_date)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="reference_date must use YYYY-MM-DD") from exc

    data = build_phrase_report(db, normalized_mode, parsed_reference)
    html = build_html_phrase_report(data)
    if normalized_mode == "weekly":
        filename = f"informe-frases-semanal-desde-{data['period_start']}-hasta-{data['period_end']}.html"
    else:
        period = data.get("period_label", reference_date or "informe")
        filename = f"informe-frases-mensual-{period}.html"

    return Response(
        content=html,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/report/send-email", response_model=dict)
def send_phrase_report_email(
    mode: str = Query("weekly"),
    reference_date: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Enviar el informe de frases del periodo actual al Gmail configurado."""
    normalized_mode = (mode or "weekly").lower()
    if normalized_mode not in {"weekly", "monthly"}:
        raise HTTPException(status_code=400, detail="Mode must be weekly or monthly")

    parsed_reference: date | None = None
    if reference_date:
        try:
            parsed_reference = date.fromisoformat(reference_date)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="reference_date must use YYYY-MM-DD") from exc

    data = build_phrase_report(db, normalized_mode, parsed_reference)
    html = build_html_phrase_report(data)
    mode_label = "Semanal" if normalized_mode == "weekly" else "Mensual"
    subject = f"Informe de Frases {mode_label} - {data['period_label']}"
    ok = send_weekly_report(html, subject)

    report_type = "phrases_weekly" if normalized_mode == "weekly" else "phrases_monthly"

    if not ok:
        record_report_event(
            report_type=report_type,
            status="failed",
            week_label=data["period_label"],
            source="manual",
            details={
                "mode": normalized_mode,
                "total_reviews": data["total_reviews"],
                "days_with_review": data["days_with_review"],
            },
        )
        raise HTTPException(
            status_code=500,
            detail="No se pudo enviar el email. Verifica GMAIL_USER y GMAIL_APP_PASSWORD en .env"
        )

    record_report_event(
        report_type=report_type,
        status="sent",
        week_label=data["period_label"],
        source="manual",
        details={
            "mode": normalized_mode,
            "total_reviews": data["total_reviews"],
            "days_with_review": data["days_with_review"],
        },
    )

    return {
        "message": "Informe de frases enviado correctamente",
        "period": data["period_label"],
        "mode": normalized_mode,
        "total_reviews": data["total_reviews"],
        "days_with_review": data["days_with_review"],
    }
