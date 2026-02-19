"""
Script para seed inicial de la base de datos.
Ejecutar: python -m app.seed
"""

from app.db.database import SessionLocal, init_db
from app.models.models import (
    PhraseCategory, PhraseSubcategory, Phrase,
    Question, QuestionOption
)
from uuid import uuid4


def seed_database():
    """Crear datos iniciales si no existen."""
    init_db()
    db = SessionLocal()
    
    try:
        # Verificar si ya hay datos
        if db.query(PhraseCategory).first():
            print("Database already seeded. Skipping...")
            return
        
        print("Seeding database...")
        
        # Crear categorías de frases
        categories_data = [
            {"name": "Motivación", "description": "Frases para motivarse"},
            {"name": "Productividad", "description": "Frases sobre productividad"},
            {"name": "Bienestar", "description": "Frases sobre bienestar"},
        ]
        
        categories = {}
        for cat_data in categories_data:
            category = PhraseCategory(
                id=str(uuid4()),
                name=cat_data["name"],
                description=cat_data["description"],
                active=True
            )
            db.add(category)
            categories[cat_data["name"]] = category
        
        db.flush()
        
        # Crear subcategorías de frases
        subcategories_data = [
            {"category_name": "Motivación", "name": "Éxito", "description": "Frases sobre el éxito"},
            {"category_name": "Motivación", "name": "Perseverancia", "description": "Frases sobre perseverancia"},
            {"category_name": "Productividad", "name": "Tiempo", "description": "Frases sobre gestión del tiempo"},
            {"category_name": "Bienestar", "name": "Salud Mental", "description": "Frases sobre salud mental"},
        ]
        
        subcategories = {}
        for subcat_data in subcategories_data:
            subcategory = PhraseSubcategory(
                id=str(uuid4()),
                category_id=categories[subcat_data["category_name"]].id,
                name=subcat_data["name"],
                description=subcat_data["description"],
                active=True
            )
            db.add(subcategory)
            subcategories[subcat_data["name"]] = subcategory
        
        db.flush()
        
        # Crear frases de ejemplo
        phrases_data = [
            {
                "text": "El éxito no es final, el fracaso no es fatal: lo que cuenta es el coraje de continuar.",
                "author": "Winston Churchill",
                "category_name": "Motivación",
                "subcategory_name": "Éxito"
            },
            {
                "text": "No importa cuántas veces caigas, lo importante es cuántas veces te levantes.",
                "author": "Desconocido",
                "category_name": "Motivación",
                "subcategory_name": "Perseverancia"
            },
            {
                "text": "El tiempo es nuestro recurso más valioso. Úsalo sabiamente.",
                "author": "Desconocido",
                "category_name": "Productividad",
                "subcategory_name": "Tiempo"
            },
        ]
        
        for phrase_data in phrases_data:
            phrase = Phrase(
                id=str(uuid4()),
                text=phrase_data["text"],
                author=phrase_data["author"],
                category_id=categories[phrase_data["category_name"]].id,
                subcategory_id=subcategories[phrase_data["subcategory_name"]].id,
                active=True,
                review_count=0
            )
            db.add(phrase)
        
        db.flush()
        
        # Crear preguntas de ejemplo
        questions_data = [
            {
                "title": "¿Cuál fue tu enfoque principal hoy?",
                "type": "text",
                "category": "general",
                "required": True,
                "order": 1
            },
            {
                "title": "¿Completaste tus objetivos principales?",
                "type": "select",
                "category": "goals",
                "required": True,
                "order": 2,
                "options": [
                    {"value": "yes", "label": "Sí", "order": 1},
                    {"value": "partial", "label": "Parcialmente", "order": 2},
                    {"value": "no", "label": "No", "order": 3},
                ]
            },
            {
                "title": "¿Cómo estuvo tu salud hoy?",
                "type": "select",
                "category": "health",
                "required": False,
                "order": 3,
                "options": [
                    {"value": "excellent", "label": "Excelente", "order": 1},
                    {"value": "good", "label": "Bueno", "order": 2},
                    {"value": "fair", "label": "Regular", "order": 3},
                    {"value": "poor", "label": "Malo", "order": 4},
                ]
            },
        ]
        
        for q_data in questions_data:
            question = Question(
                id=str(uuid4()),
                title=q_data["title"],
                type=q_data["type"],
                category=q_data["category"],
                required=q_data["required"],
                active=True,
                order=q_data["order"]
            )
            db.add(question)
            db.flush()
            
            # Agregar opciones si las hay
            if "options" in q_data:
                for opt_data in q_data["options"]:
                    option = QuestionOption(
                        id=str(uuid4()),
                        question_id=question.id,
                        value=opt_data["value"],
                        label=opt_data["label"],
                        order=opt_data["order"]
                    )
                    db.add(option)
        
        db.commit()
        print("Database seeded successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
