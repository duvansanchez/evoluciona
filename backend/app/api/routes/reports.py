"""
Endpoints para informes semanales.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.stats_service import (
    build_monthly_report,
    build_weekly_report,
    get_month_range,
    get_previous_month_range,
    get_previous_week_range,
    get_week_range,
)
from app.services.email_service import build_html_report, send_weekly_report
from app.services.report_scheduler_service import (
    get_scheduler_state,
    update_scheduler_config,
    record_report_event,
    get_report_history,
)
from datetime import date

router = APIRouter(prefix="/api/reports", tags=["reports"])


class ReportScheduleUpdate(BaseModel):
    enabled: bool | None = None
    day_of_week: str | None = None
    hour: int | None = None
    minute: int | None = None


@router.get("/schedule")
def get_report_schedule():
    """Obtiene estado del scheduler y configuración de envío automático."""
    return get_scheduler_state()


@router.put("/schedule")
def update_report_schedule(payload: ReportScheduleUpdate):
    """Actualiza configuración del scheduler y reprograma el job en caliente."""
    changes = payload.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(status_code=400, detail="No hay cambios para actualizar")

    try:
        return update_scheduler_config(changes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/history")
def get_reports_history(limit: int = Query(5, ge=1, le=50)):
    """Obtiene historial reciente de envíos de informes."""
    return {"items": get_report_history(limit)}


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
        record_report_event(
            report_type="weekly_previous",
            status="failed",
            week_label=data["week_label"],
            source="manual",
            details={
                "days_completed": data["days_completed"],
                "total_responses": data["total_responses"],
            },
        )
        raise HTTPException(
            status_code=500,
            detail="No se pudo enviar el email. Verifica GMAIL_USER y GMAIL_APP_PASSWORD en .env"
        )

    record_report_event(
        report_type="weekly_previous",
        status="sent",
        week_label=data["week_label"],
        source="manual",
        details={
            "days_completed": data["days_completed"],
            "total_responses": data["total_responses"],
        },
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


@router.post("/send-current-week")
def send_current_week_email(db: Session = Depends(get_db)):
    """
    Envía un informe parcial con la data acumulada de la semana actual hasta hoy.
    """
    today = date.today()
    week_start, week_end = get_week_range(today)

    data = build_weekly_report(db, week_start, week_end)

    partial_days = [d for d in data["day_records"] if d["date"] <= today.isoformat()]
    days_total = len(partial_days)
    days_completed = sum(1 for d in partial_days if d["completed"])
    completion_rate = round((days_completed / days_total) * 100) if days_total else 0

    data["day_records"] = partial_days
    data["days_total"] = days_total
    data["days_completed"] = days_completed
    data["completion_rate"] = completion_rate
    data["week_label"] = f"{data['week_label']} (acumulado a {today.isoformat()})"

    html = build_html_report(data)
    subject = f"Informe Parcial - {data['week_label']}"
    ok = send_weekly_report(html, subject)

    if not ok:
        record_report_event(
            report_type="weekly_partial_current",
            status="failed",
            week_label=data["week_label"],
            source="manual",
            details={
                "days_completed": data["days_completed"],
                "total_responses": data["total_responses"],
            },
        )
        raise HTTPException(
            status_code=500,
            detail="No se pudo enviar el email. Verifica GMAIL_USER y GMAIL_APP_PASSWORD en .env"
        )

    record_report_event(
        report_type="weekly_partial_current",
        status="sent",
        week_label=data["week_label"],
        source="manual",
        details={
            "days_completed": data["days_completed"],
            "total_responses": data["total_responses"],
        },
    )

    return {
        "message": "Informe parcial enviado correctamente",
        "week": data["week_label"],
        "days_completed": data["days_completed"],
        "total_responses": data["total_responses"],
    }


@router.post("/send-monthly")
def send_monthly_email(
    month_of: str = Query(None, description="Fecha dentro del mes deseado (YYYY-MM-DD). Por defecto: mes anterior."),
    db: Session = Depends(get_db)
):
    """
    Genera y envía el informe mensual al Gmail configurado.
    - Sin parámetros: usa el mes anterior completo.
    - Con month_of=YYYY-MM-DD: usa el mes que contiene esa fecha.
    """
    if month_of:
        try:
            ref = date.fromisoformat(month_of)
            month_start, month_end = get_month_range(ref)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido. Usar YYYY-MM-DD.")
    else:
        month_start, month_end = get_previous_month_range()

    data = build_monthly_report(db, month_start, month_end)
    html = build_html_report(data)
    subject = f"Informe Mensual - {data['week_label']}"
    ok = send_weekly_report(html, subject)

    if not ok:
        record_report_event(
            report_type="monthly_previous",
            status="failed",
            week_label=data["week_label"],
            source="manual",
            details={
                "days_completed": data["days_completed"],
                "total_responses": data["total_responses"],
            },
        )
        raise HTTPException(
            status_code=500,
            detail="No se pudo enviar el email. Verifica GMAIL_USER y GMAIL_APP_PASSWORD en .env"
        )

    record_report_event(
        report_type="monthly_previous",
        status="sent",
        week_label=data["week_label"],
        source="manual",
        details={
            "days_completed": data["days_completed"],
            "total_responses": data["total_responses"],
        },
    )

    return {
        "message": "Informe mensual enviado correctamente",
        "week": data["week_label"],
        "days_completed": data["days_completed"],
        "total_responses": data["total_responses"],
    }


@router.post("/send-current-month")
def send_current_month_email(db: Session = Depends(get_db)):
    """
    Envía un informe parcial con la data acumulada del mes actual hasta hoy.
    """
    today = date.today()
    month_start, month_end = get_month_range(today)

    data = build_monthly_report(db, month_start, month_end)

    partial_days = [d for d in data["day_records"] if d["date"] <= today.isoformat()]
    days_total = len(partial_days)
    days_completed = sum(1 for d in partial_days if d["completed"])
    completion_rate = round((days_completed / days_total) * 100) if days_total else 0

    data["day_records"] = partial_days
    data["days_total"] = days_total
    data["days_completed"] = days_completed
    data["completion_rate"] = completion_rate
    data["week_label"] = f"{data['week_label']} (acumulado a {today.isoformat()})"

    html = build_html_report(data)
    subject = f"Informe Mensual Parcial - {data['week_label']}"
    ok = send_weekly_report(html, subject)

    if not ok:
        record_report_event(
            report_type="monthly_partial_current",
            status="failed",
            week_label=data["week_label"],
            source="manual",
            details={
                "days_completed": data["days_completed"],
                "total_responses": data["total_responses"],
            },
        )
        raise HTTPException(
            status_code=500,
            detail="No se pudo enviar el email. Verifica GMAIL_USER y GMAIL_APP_PASSWORD en .env"
        )

    record_report_event(
        report_type="monthly_partial_current",
        status="sent",
        week_label=data["week_label"],
        source="manual",
        details={
            "days_completed": data["days_completed"],
            "total_responses": data["total_responses"],
        },
    )

    return {
        "message": "Informe mensual parcial enviado correctamente",
        "week": data["week_label"],
        "days_completed": data["days_completed"],
        "total_responses": data["total_responses"],
    }
