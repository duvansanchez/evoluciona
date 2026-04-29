"""
Servicios para frases (Phrases y PhraseCategories).
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.models import Phrase, PhraseCategory, PhraseSubcategory, PhraseReviewLog, ReviewPlan
from app.schemas.schemas import (
    PhraseCategoryCreate, PhraseCategoryUpdate,
    PhraseCreate, PhraseUpdate,
    PhraseSubcategoryCreate, PhraseSubcategoryUpdate,
)
from datetime import datetime, date, timedelta
from typing import Optional, List, Tuple, Dict, Any
import json


MONTHS_ES = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]


def get_phrase_report_range(mode: str, reference: date) -> tuple[date, date]:
    """Obtiene el rango semanal o mensual que contiene la fecha de referencia."""
    normalized = (mode or "weekly").lower()
    if normalized == "monthly":
        start = reference.replace(day=1)
        if reference.month == 12:
            end = reference.replace(year=reference.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            end = reference.replace(month=reference.month + 1, day=1) - timedelta(days=1)
        return start, end

    start = reference - timedelta(days=reference.weekday())
    end = start + timedelta(days=6)
    return start, end


def build_phrase_report_label(mode: str, start: date, end: date) -> str:
    """Etiqueta legible del periodo."""
    normalized = (mode or "weekly").lower()
    if normalized == "monthly":
        return f"Mes de {MONTHS_ES[start.month]} {start.year}"
    if start.month == end.month:
        return f"Semana del {start.day} al {end.day} de {MONTHS_ES[start.month]} {start.year}"
    return f"Semana del {start.day} de {MONTHS_ES[start.month]} al {end.day} de {MONTHS_ES[end.month]} {end.year}"


def build_phrase_report(db: Session, mode: str = "weekly", reference: Optional[date] = None) -> Dict[str, Any]:
    """Construye el informe semanal o mensual del módulo de frases."""
    ref = reference or date.today()
    period_start, period_end = get_phrase_report_range(mode, ref)
    period_start_str = period_start.isoformat()
    period_end_str = period_end.isoformat()

    all_phrases = db.query(Phrase).all()
    active_phrases = [phrase for phrase in all_phrases if phrase.activa]
    active_phrase_ids = {phrase.id for phrase in active_phrases}

    logs = db.query(PhraseReviewLog).filter(
        PhraseReviewLog.review_date >= period_start_str,
        PhraseReviewLog.review_date <= period_end_str,
    ).all()

    logs_in_active = [log for log in logs if log.phrase_id in active_phrase_ids]
    reviewed_active_ids = {log.phrase_id for log in logs_in_active}

    total_reviews = len(logs)
    review_days = sorted({log.review_date for log in logs})
    days_with_review = len(review_days)

    phrase_lookup = {phrase.id: phrase for phrase in all_phrases}
    category_lookup = {
        str(cat.id): cat.nombre
        for cat in db.query(PhraseCategory).all()
    }

    top_phrase_counts: Dict[int, int] = {}
    category_counts: Dict[str, int] = {}
    daily_counts: Dict[str, int] = {}
    plan_counts: Dict[str, int] = {}

    for log in logs:
        top_phrase_counts[log.phrase_id] = top_phrase_counts.get(log.phrase_id, 0) + 1
        daily_counts[log.review_date] = daily_counts.get(log.review_date, 0) + 1

        phrase = phrase_lookup.get(log.phrase_id)
        category_name = "Sin categoría"
        if phrase and phrase.categoria_id is not None:
            category_name = category_lookup.get(str(phrase.categoria_id), "Sin categoría")
        category_counts[category_name] = category_counts.get(category_name, 0) + 1

        if log.review_plan_id:
            plan = db.query(ReviewPlan).filter(ReviewPlan.id == log.review_plan_id).first()
            plan_name = plan.nombre if plan else f"Plan {log.review_plan_id}"
        else:
            plan_name = log.session_label or "Sin plan"
        plan_counts[plan_name] = plan_counts.get(plan_name, 0) + 1

    top_phrases = sorted(
        [
            {
                "id": phrase_id,
                "text": phrase_lookup.get(phrase_id).texto if phrase_lookup.get(phrase_id) else f"Frase {phrase_id}",
                "count": count,
                "author": phrase_lookup.get(phrase_id).autor if phrase_lookup.get(phrase_id) else None,
                "is_currently_active": (
                    phrase_lookup.get(phrase_id).activa if phrase_lookup.get(phrase_id) is not None else None
                ),
            }
            for phrase_id, count in top_phrase_counts.items()
        ],
        key=lambda item: item["count"],
        reverse=True,
    )[:10]

    unreviewed_phrases = [
        {
            "id": phrase.id,
            "text": phrase.texto,
            "author": phrase.autor,
            "category_name": category_lookup.get(str(phrase.categoria_id), "Sin categoría") if phrase.categoria_id else "Sin categoría",
        }
        for phrase in active_phrases
        if phrase.id not in reviewed_active_ids
    ]

    category_usage = sorted(
        [{"category_name": name, "count": count} for name, count in category_counts.items()],
        key=lambda item: item["count"],
        reverse=True,
    )

    daily_distribution = []
    cursor = period_start
    while cursor <= period_end:
        day_str = cursor.isoformat()
        daily_distribution.append({
            "date": day_str,
            "count": daily_counts.get(day_str, 0),
        })
        cursor += timedelta(days=1)

    all_review_dates = sorted({
        log.review_date
        for log in db.query(PhraseReviewLog.review_date).all()
        if log[0]
    })
    current_streak = 0
    cursor_day = date.today()
    review_date_set = set(all_review_dates)
    while cursor_day.isoformat() in review_date_set:
        current_streak += 1
        cursor_day -= timedelta(days=1)

    max_streak = 0
    streak = 0
    prev_day: Optional[date] = None
    for day_str in all_review_dates:
        day_obj = date.fromisoformat(day_str)
        if prev_day and day_obj == prev_day + timedelta(days=1):
            streak += 1
        else:
            streak = 1
        max_streak = max(max_streak, streak)
        prev_day = day_obj

    plans_used = sorted(
        [{"name": name, "count": count} for name, count in plan_counts.items()],
        key=lambda item: item["count"],
        reverse=True,
    )

    excluded_phrase_ids: set[int] = set()
    for plan in db.query(ReviewPlan).all():
        try:
            config = json.loads(plan.config) if plan.config else {}
        except (TypeError, ValueError):
            config = {}
        for phrase_id in config.get("excluded_phrase_ids", []) or []:
            try:
                excluded_phrase_ids.add(int(phrase_id))
            except (TypeError, ValueError):
                continue

    excluded_phrases = [
        {
            "id": phrase.id,
            "text": phrase.texto,
            "author": phrase.autor,
            "category_name": category_lookup.get(str(phrase.categoria_id), "Sin categoría") if phrase.categoria_id else "Sin categoría",
        }
        for phrase in active_phrases
        if phrase.id in excluded_phrase_ids
    ]

    ignored_cutoff = period_end - timedelta(days=30)
    ignored_phrases = [
        {
            "id": phrase.id,
            "text": phrase.texto,
            "author": phrase.autor,
            "last_reviewed_at": phrase.ultima_vez.isoformat() if phrase.ultima_vez else None,
            "days_since_last_review": None if not phrase.ultima_vez else max((period_end - phrase.ultima_vez.date()).days, 0),
        }
        for phrase in active_phrases
        if not phrase.ultima_vez or phrase.ultima_vez.date() <= ignored_cutoff
    ]

    active_phrases_count = len(active_phrases)
    reviewed_active_count = len(reviewed_active_ids)
    coverage_percent = round((reviewed_active_count / active_phrases_count) * 100) if active_phrases_count else 0

    return {
        "mode": (mode or "weekly").lower(),
        "period_start": period_start_str,
        "period_end": period_end_str,
        "period_label": build_phrase_report_label(mode, period_start, period_end),
        "total_reviews": total_reviews,
        "days_with_review": days_with_review,
        "top_phrases": top_phrases,
        "unreviewed_phrases": unreviewed_phrases,
        "category_usage": category_usage,
        "daily_distribution": daily_distribution,
        "streaks": {
            "current": current_streak,
            "max": max_streak,
        },
        "plans_used": plans_used,
        "excluded_phrases": excluded_phrases,
        "ignored_phrases": ignored_phrases,
        "coverage": {
            "active_phrases": active_phrases_count,
            "reviewed_active_phrases": reviewed_active_count,
            "percent": coverage_percent,
        },
    }


class PhraseCategoryService:
    """Servicio para categorías de frases."""
    
    @staticmethod
    def create_category(db: Session, category: PhraseCategoryCreate) -> PhraseCategory:
        """Crear categoría de frase."""
        db_category = PhraseCategory(
            nombre=category.name,
            descripcion=category.description,
            activa=category.active,
        )
        db.add(db_category)
        db.commit()
        db.refresh(db_category)
        return db_category
    
    @staticmethod
    def get_categories(db: Session, page: int = 1, page_size: int = 10) -> Tuple[List[PhraseCategory], int]:
        """Obtener categorías de frases."""
        query = db.query(PhraseCategory)
        total = query.count()
        categories = query.order_by(PhraseCategory.fecha_creacion.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return categories, total
    
    @staticmethod
    def get_categories_with_subcategories(db: Session) -> List[Dict[str, Any]]:
        """Obtener todas las categorías con sus subcategorías anidadas."""
        # Obtener todas las categorías activas
        categories = db.query(PhraseCategory).filter(PhraseCategory.activa == True).order_by(PhraseCategory.nombre).all()
        
        result = []
        for category in categories:
            # Obtener subcategorías de esta categoría
            subcategories = db.query(PhraseSubcategory).filter(
                PhraseSubcategory.categoria_id == category.id,
                PhraseSubcategory.activa == True
            ).order_by(PhraseSubcategory.nombre).all()
            
            # Construir la estructura completa
            cat_dict = {
                "id": str(category.id),
                "name": category.nombre,
                "description": category.descripcion,
                "active": category.activa,
                "created_at": category.fecha_creacion.isoformat() if category.fecha_creacion else None,
                "subcategories": [
                    {
                        "id": str(sub.id),
                        "name": sub.nombre,
                        "description": sub.descripcion,
                        "active": sub.activa,
                        "category_id": str(sub.categoria_id),
                        "created_at": sub.fecha_creacion.isoformat() if sub.fecha_creacion else None
                    }
                    for sub in subcategories
                ]
            }
            result.append(cat_dict)
        
        return result
    
    @staticmethod
    def get_category(db: Session, category_id: str) -> Optional[PhraseCategory]:
        """Obtener categoría por ID."""
        return db.query(PhraseCategory).filter(PhraseCategory.id == category_id).first()
    
    @staticmethod
    def get_all_categories_admin(db: Session) -> List[Dict[str, Any]]:
        """Obtener todas las categorías (activas e inactivas) con subcategorías y conteo de frases."""
        categories = db.query(PhraseCategory).order_by(PhraseCategory.nombre).all()
        result = []
        for category in categories:
            subcategories = db.query(PhraseSubcategory).filter(
                PhraseSubcategory.categoria_id == category.id
            ).order_by(PhraseSubcategory.nombre).all()
            phrase_count = db.query(Phrase).filter(Phrase.categoria_id == category.id).count()
            cat_dict = {
                "id": str(category.id),
                "name": category.nombre,
                "description": category.descripcion,
                "active": category.activa,
                "created_at": category.fecha_creacion.isoformat() if category.fecha_creacion else None,
                "phrase_count": phrase_count,
                "subcategories": [
                    {
                        "id": str(sub.id),
                        "name": sub.nombre,
                        "description": sub.descripcion,
                        "active": sub.activa,
                        "category_id": str(sub.categoria_id),
                        "created_at": sub.fecha_creacion.isoformat() if sub.fecha_creacion else None,
                        "phrase_count": db.query(Phrase).filter(Phrase.subcategoria_id == sub.id).count(),
                    }
                    for sub in subcategories
                ],
            }
            result.append(cat_dict)
        return result

    @staticmethod
    def update_category(db: Session, category_id: str, category: PhraseCategoryUpdate) -> Optional[PhraseCategory]:
        """Actualizar categoría usando SQL puro para evitar problemas de ORM con SQL Server."""
        exists = db.execute(
            text("SELECT id FROM categorias WHERE id = :id"), {"id": category_id}
        ).fetchone()
        if not exists:
            return None

        field_map = {'name': 'nombre', 'description': 'descripcion', 'active': 'activa'}
        update_data = category.model_dump(exclude_unset=True)
        if not update_data:
            return db.query(PhraseCategory).filter(PhraseCategory.id == category_id).first()

        set_parts = []
        params = {"cat_id": category_id}
        for field, value in update_data.items():
            col = field_map.get(field, field)
            param_key = f"p_{col}"
            set_parts.append(f"{col} = :{param_key}")
            params[param_key] = int(value) if isinstance(value, bool) else value

        sql = f"UPDATE categorias SET {', '.join(set_parts)} WHERE id = :cat_id"
        db.execute(text(sql), params)
        db.commit()
        return db.query(PhraseCategory).filter(PhraseCategory.id == category_id).first()

    @staticmethod
    def delete_category(db: Session, category_id: str) -> bool:
        """Eliminar categoría y subcategorías."""
        exists = db.execute(
            text("SELECT id FROM categorias WHERE id = :id"), {"id": category_id}
        ).fetchone()
        if not exists:
            return False
        db.execute(text("DELETE FROM subcategorias WHERE categoria_id = :id"), {"id": category_id})
        db.execute(text("DELETE FROM categorias WHERE id = :id"), {"id": category_id})
        db.commit()
        return True


class PhraseSubcategoryService:
    """Servicio para subcategorías de frases."""

    @staticmethod
    def create_subcategory(db: Session, data: PhraseSubcategoryCreate) -> PhraseSubcategory:
        """Crear subcategoría."""
        db_sub = PhraseSubcategory(
            categoria_id=int(data.category_id),
            nombre=data.name,
            descripcion=data.description,
            activa=data.active if data.active is not None else True,
        )
        db.add(db_sub)
        db.commit()
        db.refresh(db_sub)
        return db_sub

    @staticmethod
    def update_subcategory(db: Session, subcategory_id: str, data: PhraseSubcategoryUpdate) -> Optional[PhraseSubcategory]:
        """Actualizar subcategoría usando SQL puro."""
        exists = db.execute(
            text("SELECT id FROM subcategorias WHERE id = :id"), {"id": subcategory_id}
        ).fetchone()
        if not exists:
            return None

        field_map = {'name': 'nombre', 'description': 'descripcion', 'active': 'activa'}
        update_data = data.model_dump(exclude_unset=True)
        if not update_data:
            return db.query(PhraseSubcategory).filter(PhraseSubcategory.id == subcategory_id).first()

        set_parts = []
        params = {"sub_id": subcategory_id}
        for field, value in update_data.items():
            col = field_map.get(field, field)
            param_key = f"p_{col}"
            set_parts.append(f"{col} = :{param_key}")
            params[param_key] = int(value) if isinstance(value, bool) else value

        sql = f"UPDATE subcategorias SET {', '.join(set_parts)} WHERE id = :sub_id"
        db.execute(text(sql), params)
        db.commit()
        return db.query(PhraseSubcategory).filter(PhraseSubcategory.id == subcategory_id).first()

    @staticmethod
    def delete_subcategory(db: Session, subcategory_id: str) -> bool:
        """Eliminar subcategoría."""
        exists = db.execute(
            text("SELECT id FROM subcategorias WHERE id = :id"), {"id": subcategory_id}
        ).fetchone()
        if not exists:
            return False
        db.execute(text("DELETE FROM subcategorias WHERE id = :id"), {"id": subcategory_id})
        db.commit()
        return True


class PhraseService:
    """Servicio para frases."""
    
    @staticmethod
    def create_phrase(db: Session, phrase: PhraseCreate) -> Optional[Phrase]:
        """Crear frase."""
        # Verificar que la categoría existe
        category = db.query(PhraseCategory).filter(PhraseCategory.id == phrase.category_id).first()
        if not category:
            return None
        
        db_phrase = Phrase(
            texto=phrase.text,
            autor=phrase.author,
            categoria_id=phrase.category_id,
            subcategoria_id=phrase.subcategory_id,
            notas=phrase.notes,
            activa=phrase.active,
            fecha_creacion=datetime.now(),
        )
        db.add(db_phrase)
        db.commit()
        db.refresh(db_phrase)
        return db_phrase
    
    @staticmethod
    def get_phrases(
        db: Session,
        category_id: Optional[str] = None,
        subcategory_id: Optional[str] = None,
        active: Optional[bool] = None,
        page: int = 1,
        page_size: int = 10
    ) -> Tuple[List[Phrase], int]:
        """Obtener frases con filtros y paginación."""
        query = db.query(Phrase)
        
        if category_id:
            query = query.filter(Phrase.categoria_id == category_id)
        if subcategory_id:
            query = query.filter(Phrase.subcategoria_id == subcategory_id)
        if active is not None:
            query = query.filter(Phrase.activa == active)
        
        total = query.count()
        phrases = query.order_by(Phrase.fecha_creacion.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return phrases, total
    
    @staticmethod
    def get_phrase(db: Session, phrase_id: str) -> Optional[Phrase]:
        """Obtener frase por ID."""
        return db.query(Phrase).filter(Phrase.id == phrase_id).first()
    
    @staticmethod
    def update_phrase(db: Session, phrase_id: str, phrase: PhraseUpdate) -> Optional[Phrase]:
        """Actualizar frase usando SQL puro para evitar problemas de ORM con SQL Server."""
        exists = db.execute(
            text("SELECT id FROM frases WHERE id = :id"), {"id": phrase_id}
        ).fetchone()
        if not exists:
            return None

        field_map = {
            'text': 'texto',
            'author': 'autor',
            'category_id': 'categoria_id',
            'subcategory_id': 'subcategoria_id',
            'notes': 'notas',
            'active': 'activa',
        }

        update_data = phrase.model_dump(exclude_unset=True)
        if not update_data:
            return db.query(Phrase).filter(Phrase.id == phrase_id).first()

        set_parts = []
        params = {"phrase_id": phrase_id}
        for field, value in update_data.items():
            col = field_map.get(field, field)
            param_key = f"p_{col}"
            set_parts.append(f"{col} = :{param_key}")
            params[param_key] = int(value) if isinstance(value, bool) else value

        sql = f"UPDATE frases SET {', '.join(set_parts)} WHERE id = :phrase_id"
        db.execute(text(sql), params)
        db.commit()

        return db.query(Phrase).filter(Phrase.id == phrase_id).first()
    
    @staticmethod
    def delete_phrase(db: Session, phrase_id: str) -> bool:
        """Eliminar frase."""
        db_phrase = db.query(Phrase).filter(Phrase.id == phrase_id).first()
        if not db_phrase:
            return False
        
        db.delete(db_phrase)
        db.commit()
        return True
    
    @staticmethod
    def review_phrase(
        db: Session,
        phrase_id: str,
        review_plan_id: Optional[int] = None,
        session_label: Optional[str] = None,
    ) -> Optional[Phrase]:
        """Registrar review de frase, incrementando contador y guardando el evento."""
        db_phrase = db.query(Phrase).filter(Phrase.id == phrase_id).first()
        if not db_phrase:
            return None

        now = datetime.utcnow()

        db_phrase.total_repasos = (db_phrase.total_repasos or 0) + 1
        db_phrase.ultima_vez = now

        db.add(PhraseReviewLog(
            phrase_id=int(phrase_id),
            review_plan_id=review_plan_id,
            session_label=session_label,
            reviewed_at=now,
            review_date=now.date().isoformat(),
        ))

        db.commit()
        db.refresh(db_phrase)
        return db_phrase

    @staticmethod
    def get_review_logs(
        db: Session,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        review_plan_id: Optional[int] = None,
        page: int = 1,
        page_size: int = 100,
    ) -> Tuple[List[PhraseReviewLog], int]:
        """Obtener logs de repaso para futuras estadísticas e informes."""
        query = db.query(PhraseReviewLog)

        if start_date:
            query = query.filter(PhraseReviewLog.review_date >= start_date)
        if end_date:
            query = query.filter(PhraseReviewLog.review_date <= end_date)
        if review_plan_id is not None:
            query = query.filter(PhraseReviewLog.review_plan_id == review_plan_id)

        total = query.count()
        logs = query.order_by(PhraseReviewLog.reviewed_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
        return logs, total
