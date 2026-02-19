"""
Integración de todas las rutas de la API.
"""

from fastapi import APIRouter
from app.api.routes import goals, phrases, questions, subgoals

# Crear router principal
api_router = APIRouter()

# Incluir rutas
api_router.include_router(goals.router)
api_router.include_router(phrases.router)
api_router.include_router(questions.router)
api_router.include_router(subgoals.router)
