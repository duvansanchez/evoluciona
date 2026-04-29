"""Endpoints para recordatorios por correo."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from app.services.reminder_service import (
    load_config, save_config, sync_reminder_jobs, send_reminder,
    get_custom_reminders_with_next_run, create_custom_reminder,
    update_custom_reminder, delete_custom_reminder, send_custom_reminder,
)

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


class ReminderPartConfig(BaseModel):
    enabled: bool
    hour: int
    minute: int


class ReminderConfig(BaseModel):
    manana: ReminderPartConfig
    noche: ReminderPartConfig


class CustomReminderPayload(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    message: str = Field('', max_length=5000)
    date: str
    hour: int = Field(..., ge=0, le=23)
    minute: int = Field(..., ge=0, le=59)
    times: List[dict] = []
    recurrence: Literal['once', 'daily', 'weekly', 'monthly', 'yearly', 'multi_daily'] = 'once'
    enabled: bool = True
    recipient: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=2000)


class CustomReminderResponse(CustomReminderPayload):
    id: str
    created_at: str
    next_run_time: Optional[str] = None


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


@router.get("/custom", response_model=List[CustomReminderResponse])
def list_custom_reminders():
    """Obtener recordatorios personalizados configurados."""
    return get_custom_reminders_with_next_run()


@router.post("/custom", response_model=CustomReminderResponse)
def create_custom(body: CustomReminderPayload):
    """Crear un recordatorio personalizado por correo."""
    try:
        reminder = create_custom_reminder(body.model_dump())
        return next(item for item in get_custom_reminders_with_next_run() if item["id"] == reminder["id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/custom/{reminder_id}", response_model=CustomReminderResponse)
def patch_custom(reminder_id: str, body: CustomReminderPayload):
    """Actualizar un recordatorio personalizado."""
    try:
        reminder = update_custom_reminder(reminder_id, body.model_dump())
        return next(item for item in get_custom_reminders_with_next_run() if item["id"] == reminder["id"])
    except KeyError:
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/custom/{reminder_id}")
def remove_custom(reminder_id: str):
    """Eliminar un recordatorio personalizado."""
    if not delete_custom_reminder(reminder_id):
        raise HTTPException(status_code=404, detail="Recordatorio no encontrado")
    return {"ok": True, "id": reminder_id}


@router.post("/custom/{reminder_id}/test")
def test_custom(reminder_id: str):
    """Enviar inmediatamente un recordatorio personalizado de prueba."""
    ok = send_custom_reminder(reminder_id)
    if not ok:
        raise HTTPException(status_code=500, detail="No se pudo enviar el recordatorio personalizado")
    return {"ok": True, "message": "Recordatorio personalizado enviado"}
