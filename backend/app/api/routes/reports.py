"""
Endpoints para informes semanales.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import WeeklyConclusion, DuvanConclusion
from app.schemas.schemas import (
    WeeklyConclusionResponse,
    WeeklyConclusionUpsert,
    DuvanConclusionCreate,
    DuvanConclusionResponse,
)
from app.services.stats_service import (
    build_monthly_report,
    build_weekly_report,
    get_month_range,
    get_previous_month_range,
    get_previous_week_range,
    get_week_range,
)
from app.services.email_service import build_html_report, build_markdown_report, send_weekly_report
from app.services.report_scheduler_service import (
    get_scheduler_state,
    update_scheduler_config,
    record_report_event,
    get_report_history,
)
from datetime import date

router = APIRouter(prefix="/api/reports", tags=["reports"])

ALLOWED_CONCLUSION_TYPES = {"emocional", "trabajo", "vida", "personas"}


class ReportScheduleUpdate(BaseModel):
    enabled: bool | None = None
    day_of_week: str | None = None
    hour: int | None = None
    minute: int | None = None


def _resolve_week_range(week_of: str | None, use_previous_default: bool = True):
    if week_of:
        try:
            ref = date.fromisoformat(week_of)
            return get_week_range(ref)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Formato de fecha invalido. Usar YYYY-MM-DD.") from exc
    if use_previous_default:
        return get_previous_week_range()
    return get_week_range(date.today())


def _resolve_month_range(month_of: str | None, use_previous_default: bool = True):
    if month_of:
        try:
            ref = date.fromisoformat(month_of)
            return get_month_range(ref)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Formato de fecha invalido. Usar YYYY-MM-DD.") from exc
    if use_previous_default:
        return get_previous_month_range()
    return get_month_range(date.today())


def _html_download_response(html: str, filename: str) -> Response:
    return Response(
        content=html,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _markdown_download_response(md: str, filename: str) -> Response:
    return Response(
        content=md.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _normalize_download_format(fmt: str | None) -> str:
    value = (fmt or "markdown").lower()
    if value == "md":
        return "markdown"
    if value in {"markdown", "html"}:
        return value
    raise HTTPException(status_code=400, detail="format must be html or markdown")


def _resolve_single_week(reference_date: str | None):
    try:
        ref = date.fromisoformat(reference_date) if reference_date else date.today()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Formato de fecha invalido. Usar YYYY-MM-DD.") from exc
    return get_week_range(ref)


def _format_week_label(week_start: date, week_end: date) -> str:
    months = [
        "",
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
    ]
    if week_start.month == week_end.month:
        return f"Semana del {week_start.day} al {week_end.day} de {months[week_start.month]} {week_start.year}"
    return f"Semana del {week_start.day} de {months[week_start.month]} al {week_end.day} de {months[week_end.month]} {week_end.year}"


def _serialize_weekly_conclusion(row: WeeklyConclusion | None, week_start: date, week_end: date) -> WeeklyConclusionResponse:
    return WeeklyConclusionResponse(
        id=row.id if row else None,
        week_start=week_start.isoformat(),
        week_end=week_end.isoformat(),
        period_label=_format_week_label(week_start, week_end),
        content=row.content if row else "",
        created_at=row.created_at if row else None,
        updated_at=row.updated_at if row else None,
    )


def _serialize_duvan_conclusion(row: DuvanConclusion) -> DuvanConclusionResponse:
    return DuvanConclusionResponse(
        id=row.id,
        conclusion_type=row.conclusion_type,
        content=row.content,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


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


@router.get("/weekly-conclusions", response_model=WeeklyConclusionResponse)
def get_weekly_conclusion(
    reference_date: str | None = Query(None, description="Fecha dentro de la semana deseada (YYYY-MM-DD)."),
    db: Session = Depends(get_db),
):
    """Obtiene la conclusion guardada para una semana concreta."""
    week_start, week_end = _resolve_single_week(reference_date)
    row = (
        db.query(WeeklyConclusion)
        .filter(WeeklyConclusion.week_start == week_start.isoformat())
        .first()
    )
    return _serialize_weekly_conclusion(row, week_start, week_end)


@router.get("/weekly-conclusions/history", response_model=list[WeeklyConclusionResponse])
def get_weekly_conclusions_history(
    limit: int = Query(8, ge=1, le=52),
    db: Session = Depends(get_db),
):
    """Lista las conclusiones semanales mas recientes."""
    rows = (
        db.query(WeeklyConclusion)
        .order_by(WeeklyConclusion.week_start.desc())
        .limit(limit)
        .all()
    )
    items: list[WeeklyConclusionResponse] = []
    for row in rows:
        week_start = date.fromisoformat(row.week_start)
        week_end = date.fromisoformat(row.week_end)
        items.append(_serialize_weekly_conclusion(row, week_start, week_end))
    return items


@router.put("/weekly-conclusions", response_model=WeeklyConclusionResponse)
def upsert_weekly_conclusion(
    payload: WeeklyConclusionUpsert,
    db: Session = Depends(get_db),
):
    """Crea o actualiza la conclusion de una semana."""
    week_start, week_end = _resolve_single_week(payload.reference_date)
    cleaned_content = payload.content.strip()
    if not cleaned_content:
        raise HTTPException(status_code=400, detail="La conclusion no puede estar vacia.")

    row = (
        db.query(WeeklyConclusion)
        .filter(WeeklyConclusion.week_start == week_start.isoformat())
        .first()
    )
    if row:
        row.week_end = week_end.isoformat()
        row.content = cleaned_content
    else:
        row = WeeklyConclusion(
            week_start=week_start.isoformat(),
            week_end=week_end.isoformat(),
            content=cleaned_content,
        )
        db.add(row)

    db.commit()
    db.refresh(row)
    return _serialize_weekly_conclusion(row, week_start, week_end)


@router.delete("/weekly-conclusions")
def delete_weekly_conclusion(
    reference_date: str | None = Query(None, description="Fecha dentro de la semana deseada (YYYY-MM-DD)."),
    db: Session = Depends(get_db),
):
    """Elimina la conclusion guardada para una semana."""
    week_start, week_end = _resolve_single_week(reference_date)
    row = (
        db.query(WeeklyConclusion)
        .filter(WeeklyConclusion.week_start == week_start.isoformat())
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="No existe una conclusion guardada para esa semana.")

    db.delete(row)
    db.commit()
    return {
        "message": "Conclusion semanal eliminada correctamente.",
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
    }


@router.get("/duvan-conclusions", response_model=list[DuvanConclusionResponse])
def get_duvan_conclusions(
    limit: int = Query(20, ge=1, le=200),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(DuvanConclusion)
        .order_by(DuvanConclusion.created_at.desc(), DuvanConclusion.id.desc())
        .limit(limit)
        .all()
    )
    return [_serialize_duvan_conclusion(row) for row in rows]


@router.post("/duvan-conclusions", response_model=DuvanConclusionResponse)
def create_duvan_conclusion(
    payload: DuvanConclusionCreate,
    db: Session = Depends(get_db),
):
    cleaned_content = payload.content.strip()
    if not cleaned_content:
        raise HTTPException(status_code=400, detail="La conclusion no puede estar vacia.")

    normalized_type = (payload.conclusion_type or "vida").strip().lower()
    if normalized_type not in ALLOWED_CONCLUSION_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de conclusion invalido. Usa: emocional, trabajo, vida o personas.")

    row = DuvanConclusion(
        conclusion_type=normalized_type,
        content=cleaned_content,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize_duvan_conclusion(row)


@router.delete("/duvan-conclusions/{conclusion_id}")
def delete_duvan_conclusion(
    conclusion_id: int,
    db: Session = Depends(get_db),
):
    row = db.query(DuvanConclusion).filter(DuvanConclusion.id == conclusion_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="No existe la conclusion solicitada.")

    db.delete(row)
    db.commit()
    return {"message": "Conclusion eliminada correctamente", "id": conclusion_id}


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
    week_start, week_end = _resolve_week_range(week_of, use_previous_default=True)

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
    week_start, week_end = _resolve_week_range(week_of, use_previous_default=True)

    return build_weekly_report(db, week_start, week_end)


@router.get("/download-weekly")
def download_weekly_report(
    week_of: str = Query(None, description="Fecha en la semana deseada (YYYY-MM-DD). Por defecto: semana anterior."),
    format: str = Query("markdown"),
    db: Session = Depends(get_db)
):
    """Descarga el informe semanal en HTML o Markdown."""
    week_start, week_end = _resolve_week_range(week_of, use_previous_default=True)
    data = build_weekly_report(db, week_start, week_end)
    normalized_format = _normalize_download_format(format)
    base_filename = f"informe-preguntas-semanal-desde-{week_start}-hasta-{week_end}"
    if normalized_format == "html":
        html = build_html_report(data)
        return _html_download_response(html, f"{base_filename}.html")
    md = build_markdown_report(data)
    return _markdown_download_response(md, f"{base_filename}.md")


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


@router.get("/monthly-preview")
def preview_monthly_report(
    month_of: str = Query(None, description="Fecha dentro del mes deseado (YYYY-MM-DD). Por defecto: mes anterior."),
    db: Session = Depends(get_db)
):
    """Devuelve los datos del informe mensual en JSON."""
    month_start, month_end = _resolve_month_range(month_of, use_previous_default=True)
    return build_monthly_report(db, month_start, month_end)


@router.get("/download-monthly")
def download_monthly_report(
    month_of: str = Query(None, description="Fecha dentro del mes deseado (YYYY-MM-DD). Por defecto: mes anterior."),
    format: str = Query("markdown"),
    db: Session = Depends(get_db)
):
    """Descarga el informe mensual en HTML o Markdown."""
    month_start, month_end = _resolve_month_range(month_of, use_previous_default=True)
    data = build_monthly_report(db, month_start, month_end)
    normalized_format = _normalize_download_format(format)
    base_filename = f"informe-preguntas-mensual-{month_start}_{month_end}"
    if normalized_format == "html":
        html = build_html_report(data)
        return _html_download_response(html, f"{base_filename}.html")
    md = build_markdown_report(data)
    return _markdown_download_response(md, f"{base_filename}.md")


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


@router.get("/download-current-week")
def download_current_week_report(
    format: str = Query("markdown"),
    db: Session = Depends(get_db)
):
    """Descarga el informe parcial acumulado de la semana actual en HTML o Markdown."""
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
    normalized_format = _normalize_download_format(format)
    base_filename = f"informe-preguntas-semanal-desde-{week_start}-hasta-{week_end}"
    if normalized_format == "html":
        html = build_html_report(data)
        return _html_download_response(html, f"{base_filename}.html")
    md = build_markdown_report(data)
    return _markdown_download_response(md, f"{base_filename}.md")


@router.get("/download-current-month")
def download_current_month_report(
    format: str = Query("markdown"),
    db: Session = Depends(get_db)
):
    """Descarga el informe parcial acumulado del mes actual en HTML o Markdown."""
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
    normalized_format = _normalize_download_format(format)
    base_filename = f"informe-preguntas-mes-actual-{today.isoformat()}"
    if normalized_format == "html":
        html = build_html_report(data)
        return _html_download_response(html, f"{base_filename}.html")
    md = build_markdown_report(data)
    return _markdown_download_response(md, f"{base_filename}.md")
