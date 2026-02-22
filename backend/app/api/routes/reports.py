"""
Endpoints para informes semanales.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.stats_service import build_weekly_report, get_previous_week_range, get_week_range
from app.services.email_service import build_html_report, send_weekly_report
from datetime import date

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("/send-weekly")
def send_weekly_email(
    week_of: str = Query(None, description="Fecha en la semana deseada (YYYY-MM-DD). Por defecto: semana anterior."),
    db: Session = Depends(get_db)
):
    """
    Genera y envia el informe semanal al Gmail configurado.
    - Sin parametros: usa la semana anterior (Lun-Dom).
    - Con week_of=YYYY-MM-DD: usa la semana que contiene esa fecha.
    """
    if week_of:
        try:
            ref = date.fromisoformat(week_of)
            from app.services.stats_service import get_week_range
            week_start, week_end = get_week_range(ref)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha invalido. Usar YYYY-MM-DD.")
    else:
        week_start, week_end = get_previous_week_range()

    data = build_weekly_report(db, week_start, week_end)
    html = build_html_report(data)
    subject = f"Informe Semanal - {data['week_label']}"
    ok = send_weekly_report(html, subject)

    if not ok:
        raise HTTPException(
            status_code=500,
            detail="No se pudo enviar el email. Verifica GMAIL_USER y GMAIL_APP_PASSWORD en .env"
        )
    return {
        "message": "Informe enviado correctamente",
        "week": data["week_label"],
        "days_completed": data["days_completed"],
        "total_responses": data["total_responses"],
    }


@router.get("/weekly-preview")
def preview_weekly_report(
    week_of: str = Query(None, description="Fecha en la semana deseada (YYYY-MM-DD). Por defecto: semana anterior."),
    db: Session = Depends(get_db)
):
    """
    Devuelve los datos del informe semanal en JSON (sin enviar email).
    Util para verificar que los datos son correctos antes de enviar.
    """
    if week_of:
        try:
            ref = date.fromisoformat(week_of)
            week_start, week_end = get_week_range(ref)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha invalido. Usar YYYY-MM-DD.")
    else:
        week_start, week_end = get_previous_week_range()

    return build_weekly_report(db, week_start, week_end)
