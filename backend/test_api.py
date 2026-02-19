"""
Tests básicos para los endpoints de la API.
Ejecutar: pytest test_api.py -v
"""

import pytest
from fastapi.testclient import TestClient
from uuid import uuid4
from main import app
from app.db.database import get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Usar SQLite en memoria para tests
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


class TestHealth:
    """Tests para health check."""
    
    def test_health_check(self):
        """Verificar que la API está activa."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


class TestGoals:
    """Tests para objetivos."""
    
    def test_create_goal(self):
        """Crear un objetivo."""
        goal_data = {
            "title": "Completar proyecto",
            "description": "Terminar el proyecto FastAPI",
            "category": "work",
            "priority": "high"
        }
        response = client.post("/api/goals", json=goal_data)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == goal_data["title"]
        assert data["id"]
    
    def test_list_goals(self):
        """Listar objetivos."""
        # Crear un objetivo
        goal_data = {
            "title": "Test Goal",
            "category": "daily"
        }
        client.post("/api/goals", json=goal_data)
        
        # Listar
        response = client.get("/api/goals")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
    
    def test_get_goal(self):
        """Obtener objetivo por ID."""
        # Crear un objetivo
        goal_data = {"title": "Test Goal"}
        create_response = client.post("/api/goals", json=goal_data)
        goal_id = create_response.json()["id"]
        
        # Obtener
        response = client.get(f"/api/goals/{goal_id}")
        assert response.status_code == 200
        assert response.json()["id"] == goal_id
    
    def test_get_nonexistent_goal(self):
        """Obtener objetivo que no existe."""
        response = client.get("/api/goals/nonexistent-id")
        assert response.status_code == 404


class TestPhrases:
    """Tests para frases."""
    
    def test_create_phrase_category(self):
        """Crear categoría de frases."""
        category_data = {
            "name": "Motivación",
            "description": "Frases motivacionales"
        }
        response = client.post("/api/phrases/categories", json=category_data)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == category_data["name"]
        assert data["id"]
    
    def test_list_phrase_categories(self):
        """Listar categorías de frases."""
        response = client.get("/api/phrases/categories")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
    
    def test_create_phrase(self):
        """Crear frase."""
        # Crear categoría primero
        cat_response = client.post(
            "/api/phrases/categories",
            json={"name": "Test Category"}
        )
        category_id = cat_response.json()["id"]
        
        # Crear frase
        phrase_data = {
            "text": "La perseverancia es la clave del éxito",
            "author": "Desconocido",
            "category_id": category_id
        }
        response = client.post("/api/phrases", json=phrase_data)
        assert response.status_code == 200
        data = response.json()
        assert data["text"] == phrase_data["text"]


class TestQuestions:
    """Tests para preguntas."""
    
    def test_create_question(self):
        """Crear pregunta."""
        question_data = {
            "title": "¿Cuál fue tu objetivo hoy?",
            "type": "text",
            "category": "general",
            "required": True,
            "order": 1
        }
        response = client.post("/api/questions", json=question_data)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == question_data["title"]
        assert data["id"]
    
    def test_create_question_with_options(self):
        """Crear pregunta con opciones."""
        question_data = {
            "title": "¿Completaste tu tarea?",
            "type": "select",
            "category": "goals",
            "options": [
                {"value": "yes", "label": "Sí", "order": 1},
                {"value": "no", "label": "No", "order": 2}
            ]
        }
        response = client.post("/api/questions", json=question_data)
        assert response.status_code == 200
        data = response.json()
        assert len(data["options"]) == 2
    
    def test_list_questions(self):
        """Listar preguntas."""
        response = client.get("/api/questions")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data


class TestDailySessions:
    """Tests para sesiones diarias."""
    
    def test_get_daily_session(self):
        """Obtener sesión diaria."""
        response = client.get("/api/daily-sessions/2024-02-19")
        assert response.status_code == 200
        data = response.json()
        assert data["date"] == "2024-02-19"
        assert "responses" in data
    
    def test_save_daily_responses(self):
        """Guardar respuestas diarias."""
        # Crear pregunta
        q_response = client.post(
            "/api/questions",
            json={"title": "Test Question", "type": "text"}
        )
        question_id = q_response.json()["id"]
        
        # Guardar respuestas
        session_data = {
            "responses": [
                {"question_id": question_id, "response": "Respuesta test"}
            ]
        }
        response = client.post(
            "/api/daily-sessions/2024-02-19/responses",
            json=session_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["answered_questions"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
