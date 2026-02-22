"""
Servicios para frases (Phrases y PhraseCategories).
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.models import Phrase, PhraseCategory, PhraseSubcategory
from app.schemas.schemas import (
    PhraseCategoryCreate, PhraseCategoryUpdate,
    PhraseCreate, PhraseUpdate
)
from datetime import datetime
from typing import Optional, List, Tuple, Dict, Any


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
    def update_category(db: Session, category_id: str, category: PhraseCategoryUpdate) -> Optional[PhraseCategory]:
        """Actualizar categoría."""
        db_category = db.query(PhraseCategory).filter(PhraseCategory.id == category_id).first()
        if not db_category:
            return None
        
        update_data = category.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_category, field, value)
        
        db.commit()
        db.refresh(db_category)
        return db_category
    
    @staticmethod
    def delete_category(db: Session, category_id: str) -> bool:
        """Eliminar categoría y subcategorías."""
        db_category = db.query(PhraseCategory).filter(PhraseCategory.id == category_id).first()
        if not db_category:
            return False
        
        db.delete(db_category)
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
    def review_phrase(db: Session, phrase_id: str) -> Optional[Phrase]:
        """Registrar review de frase e incrementar contador."""
        db_phrase = db.query(Phrase).filter(Phrase.id == phrase_id).first()
        if not db_phrase:
            return None
        
        db_phrase.review_count += 1
        db_phrase.last_reviewed_at = datetime.utcnow().isoformat()
        
        db.commit()
        db.refresh(db_phrase)
        return db_phrase
