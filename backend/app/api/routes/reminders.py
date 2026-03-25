"""
Endpoints para configuración de recordatorios diarios.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.reminder_service import load_config, save_config, sync_reminder_jobs, send_reminder

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


class ReminderPartConfig(BaseModel):
    enabled: bool
    hour: int
    minute: int


class ReminderConfig(BaseModel):
    manana: ReminderPartConfig
    noche: ReminderPartConfig


@router.get("/config")
def get_config():
    """Obtener configuración actual de recordatorios."""
    return load_config()


@router.put("/config")
def update_config(body: ReminderConfig):
    """Actualizar configuración y reprogramar jobs."""
    try:
        saved = save_config(body.model_dump())
        sync_reminder_jobs()
        return saved
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/test/{parte}")
def test_reminder(parte: str):
    """Enviar recordatorio de prueba (manana o noche)."""
    if parte not in ("manana", "noche"):
        raise HTTPException(status_code=400, detail="parte debe ser 'manana' o 'noche'")
    ok = send_reminder(parte)
    if not ok:
        raise HTTPException(status_code=500, detail="Error enviando el recordatorio. Revisa GMAIL_USER y GMAIL_APP_PASSWORD en .env")
    return {"ok": True, "message": f"Recordatorio '{parte}' enviado"}
