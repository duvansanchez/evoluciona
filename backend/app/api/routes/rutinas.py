"""
Endpoints para rutinas diarias.
"""

import json
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import Rutina, RutinaBloque, RutinaAsignacion, Goal
from app.services.email_service import build_html_rutina_report, send_weekly_report
from app.services.goal_service import GoalService
from app.services.report_scheduler_service import record_report_event
from app.services.rutina_report_service import build_rutina_report
from app.schemas.schemas import (
    RutinaCreate, RutinaUpdate, RutinaResponse,
    RutinaAsignacionCreate, RutinaAsignacionUpdate, RutinaAsignacionResponse,
    DiaSemanaResponse,
)
from typing import List

router = APIRouter(prefix="/api/rutinas", tags=["rutinas"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _rutina_to_dict(r: Rutina) -> dict:
    return {
        "id": r.id,
        "nombre": r.nombre,
        "parte_dia": r.parte_dia,
        "color": r.color,
        "descripcion": r.descripcion,
        "dias_semana": json.loads(r.dias_semana) if r.dias_semana else [],
        "activa": r.activa,
        "fecha_creacion": r.fecha_creacion,
        "bloques": [
            {
                "id": b.id,
                "rutina_id": b.rutina_id,
                "nombre": b.nombre,
                "orden": b.orden,
                "hora_inicio": b.hora_inicio,
                "duracion_minutos": b.duracion_minutos,
                "notas": b.notas,
            }
            for b in sorted(r.bloques, key=lambda x: x.orden)
        ],
        "objetivos": [
            {
                "id": g.id,
                "titulo": g.titulo,
                "icono": g.icono,
                "categoria": g.categoria,
                "frecuencia": g.frecuencia,
            }
            for g in r.objetivos
        ],
    }


def _asignacion_to_dict(a: RutinaAsignacion) -> dict:
    return {
        "id": a.id,
        "fecha": a.fecha,
        "parte_dia": a.parte_dia,
        "rutina_id": a.rutina_id,
        "completada": a.completada,
        "es_automatica": a.es_automatica,
        "objetivo_ids": json.loads(a.objetivo_ids) if a.objetivo_ids else [],
        "rutina": _rutina_to_dict(a.rutina),
    }


def _replace_bloques(db: Session, rutina: Rutina, bloques_data: list):
    """Elimina bloques existentes y crea los nuevos."""
    for b in list(rutina.bloques):
        db.delete(b)
    db.flush()
    for i, b in enumerate(bloques_data):
        db.add(RutinaBloque(
            rutina_id=rutina.id,
            nombre=b.nombre,
            orden=b.orden if b.orden is not None else i,
            hora_inicio=b.hora_inicio,
            duracion_minutos=b.duracion_minutos,
            notas=b.notas,
        ))


def _weekday_index(iso_date: str) -> int:
    return datetime.strptime(iso_date, "%Y-%m-%d").date().weekday()


def _ensure_weekly_assignments(db: Session, fechas: list[str]) -> None:
    if not fechas:
        return

    rutinas = db.query(Rutina).filter(Rutina.activa == True, Rutina.dias_semana.isnot(None)).all()
    existing_assignments = (
        db.query(RutinaAsignacion)
        .filter(RutinaAsignacion.fecha.in_(fechas))
        .all()
    )
    occupied_slots = {(assignment.fecha, assignment.parte_dia) for assignment in existing_assignments}

    created = False
    for rutina in rutinas:
        weekly_days = json.loads(rutina.dias_semana) if rutina.dias_semana else []
        if not weekly_days:
            continue

        for fecha in fechas:
            if _weekday_index(fecha) not in weekly_days:
                continue
            slot = (fecha, rutina.parte_dia)
            if slot in occupied_slots:
                continue

            db.add(RutinaAsignacion(
                fecha=fecha,
                parte_dia=rutina.parte_dia,
                rutina_id=rutina.id,
                completada=False,
                es_automatica=True,
                fecha_creacion=datetime.now(),
            ))
            occupied_slots.add(slot)
            created = True

    if created:
        db.commit()


# ── Rutinas (plantillas) ──────────────────────────────────────────────────────

@router.get("", response_model=List[RutinaResponse])
def list_rutinas(db: Session = Depends(get_db)):
    """Listar todas las rutinas activas."""
    rutinas = db.query(Rutina).filter(Rutina.activa == True).order_by(Rutina.fecha_creacion.desc()).all()
    return [_rutina_to_dict(r) for r in rutinas]


@router.post("", response_model=RutinaResponse, status_code=201)
def create_rutina(data: RutinaCreate, db: Session = Depends(get_db)):
    """Crear una nueva rutina con sus bloques."""
    rutina = Rutina(
        nombre=data.nombre,
        parte_dia=data.parte_dia,
        color=data.color,
        descripcion=data.descripcion,
        dias_semana=json.dumps(data.dias_semana or []),
        activa=True,
        fecha_creacion=datetime.now(),
    )
    db.add(rutina)
    db.flush()

    for i, b in enumerate(data.bloques):
        db.add(RutinaBloque(
            rutina_id=rutina.id,
            nombre=b.nombre,
            orden=b.orden if b.orden is not None else i,
            hora_inicio=b.hora_inicio,
            duracion_minutos=b.duracion_minutos,
            notas=b.notas,
        ))

    db.commit()
    db.refresh(rutina)
    return _rutina_to_dict(rutina)


@router.get("/semana", response_model=List[DiaSemanaResponse])
def get_semana(
    fecha_inicio: str = Query(..., description="Lunes de la semana (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    """Obtener las asignaciones de rutinas para una semana (7 días desde fecha_inicio)."""
    try:
        inicio = datetime.strptime(fecha_inicio, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="fecha_inicio debe tener formato YYYY-MM-DD")

    fechas = [(inicio + timedelta(days=i)).isoformat() for i in range(7)]

    _ensure_weekly_assignments(db, fechas)

    asignaciones = (
        db.query(RutinaAsignacion)
        .filter(RutinaAsignacion.fecha.in_(fechas))
        .all()
    )

    asig_por_fecha: dict = {f: [] for f in fechas}
    for a in asignaciones:
        asig_por_fecha[a.fecha].append(_asignacion_to_dict(a))

    return [{"fecha": f, "asignaciones": asig_por_fecha[f]} for f in fechas]


@router.get("/objetivos-recurrentes")
def get_objetivos_recurrentes(db: Session = Depends(get_db)):
    """Listar objetivos recurrentes disponibles para asociar a una rutina."""
    GoalService.reset_stale_recurring_goals(db)
    goals = (
        db.query(Goal)
        .filter(Goal.recurrente == True)
        .order_by(Goal.titulo)
        .all()
    )
    return [
        {
            "id": g.id,
            "titulo": g.titulo,
            "icono": g.icono,
            "categoria": g.categoria,
            "frecuencia": g.frecuencia,
            "parte_dia": g.parte_dia,
        }
        for g in goals
    ]


@router.get("/historial")
def get_historial(
    fecha_desde: str = Query(..., description="Fecha de inicio (YYYY-MM-DD)"),
    fecha_hasta: str = Query(..., description="Fecha de fin (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    """Obtener todas las asignaciones en un rango de fechas."""
    asignaciones = (
        db.query(RutinaAsignacion)
        .filter(
            RutinaAsignacion.fecha >= fecha_desde,
            RutinaAsignacion.fecha <= fecha_hasta,
        )
        .order_by(RutinaAsignacion.fecha)
        .all()
    )
    return [_asignacion_to_dict(a) for a in asignaciones]


def _parse_reference_date(reference_date: str | None) -> date | None:
    if not reference_date:
        return None
    try:
        return date.fromisoformat(reference_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="reference_date debe usar formato YYYY-MM-DD") from exc


@router.get("/report")
def get_rutina_report(
    mode: str = Query("weekly"),
    reference_date: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Obtener informe semanal o mensual del modulo de rutinas."""
    normalized_mode = (mode or "weekly").lower()
    if normalized_mode not in {"weekly", "monthly"}:
        raise HTTPException(status_code=400, detail="Mode must be weekly or monthly")
    return build_rutina_report(db, normalized_mode, _parse_reference_date(reference_date))


@router.post("/report/send-email")
def send_rutina_report_email(
    mode: str = Query("weekly"),
    reference_date: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Enviar el informe de rutinas por Gmail."""
    normalized_mode = (mode or "weekly").lower()
    if normalized_mode not in {"weekly", "monthly"}:
        raise HTTPException(status_code=400, detail="Mode must be weekly or monthly")

    data = build_rutina_report(db, normalized_mode, _parse_reference_date(reference_date))
    html = build_html_rutina_report(data)
    mode_label = "Semanal" if normalized_mode == "weekly" else "Mensual"
    subject = f"Informe de Rutinas {mode_label} - {data['period_label']}"
    ok = send_weekly_report(html, subject)

    report_type = f"rutinas_{normalized_mode}"
    if not ok:
        record_report_event(
            report_type=report_type,
            status="failed",
            week_label=data["period_label"],
            source="manual",
            details={
                "total_assignments": data["total_assignments"],
                "completed_assignments": data["completed_assignments"],
                "completion_rate": data["completion_rate"],
            },
        )
        raise HTTPException(
            status_code=500,
            detail="No se pudo enviar el informe de rutinas. Verifica GMAIL_USER y GMAIL_APP_PASSWORD en .env",
        )

    record_report_event(
        report_type=report_type,
        status="sent",
        week_label=data["period_label"],
        source="manual",
        details={
            "total_assignments": data["total_assignments"],
            "completed_assignments": data["completed_assignments"],
            "completion_rate": data["completion_rate"],
        },
    )
    return {
        "message": "Informe de rutinas enviado correctamente",
        "period_label": data["period_label"],
        "total_assignments": data["total_assignments"],
        "completed_assignments": data["completed_assignments"],
        "completion_rate": data["completion_rate"],
    }


@router.get("/report/download")
def download_rutina_report(
    mode: str = Query("weekly"),
    reference_date: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Descargar el informe de rutinas en HTML."""
    normalized_mode = (mode or "weekly").lower()
    if normalized_mode not in {"weekly", "monthly"}:
        raise HTTPException(status_code=400, detail="Mode must be weekly or monthly")

    data = build_rutina_report(db, normalized_mode, _parse_reference_date(reference_date))
    html = build_html_rutina_report(data)
    if normalized_mode == "weekly":
        filename = f"informe-rutinas-semanal-desde-{data['period_start']}-hasta-{data['period_end']}.html"
    else:
        filename = f"informe-rutinas-{normalized_mode}-{data['period_start']}_{data['period_end']}.html"
    return Response(
        content=html,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{rutina_id}", response_model=RutinaResponse)
def get_rutina(rutina_id: int, db: Session = Depends(get_db)):
    r = db.query(Rutina).filter(Rutina.id == rutina_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    return _rutina_to_dict(r)


@router.patch("/{rutina_id}", response_model=RutinaResponse)
def update_rutina(rutina_id: int, data: RutinaUpdate, db: Session = Depends(get_db)):
    r = db.query(Rutina).filter(Rutina.id == rutina_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")

    if data.nombre is not None:
        r.nombre = data.nombre
    if data.parte_dia is not None:
        r.parte_dia = data.parte_dia
    if data.color is not None:
        r.color = data.color
    if data.descripcion is not None:
        r.descripcion = data.descripcion
    if data.dias_semana is not None:
        r.dias_semana = json.dumps(data.dias_semana)
    if data.bloques is not None:
        _replace_bloques(db, r, data.bloques)

    db.query(RutinaAsignacion).filter(
        RutinaAsignacion.rutina_id == r.id,
        RutinaAsignacion.es_automatica == True,
        RutinaAsignacion.fecha >= date.today().isoformat(),
    ).delete(synchronize_session=False)

    db.commit()
    db.refresh(r)
    return _rutina_to_dict(r)


@router.delete("/{rutina_id}", status_code=204)
def delete_rutina(rutina_id: int, db: Session = Depends(get_db)):
    r = db.query(Rutina).filter(Rutina.id == rutina_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    db.delete(r)
    db.commit()


@router.post("/{rutina_id}/objetivos/{objetivo_id}", status_code=204)
def add_objetivo_to_rutina(rutina_id: int, objetivo_id: int, db: Session = Depends(get_db)):
    """Asociar un objetivo recurrente a una rutina."""
    r = db.query(Rutina).filter(Rutina.id == rutina_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    g = db.query(Goal).filter(Goal.id == objetivo_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Objetivo no encontrado")
    if g not in r.objetivos:
        r.objetivos.append(g)
        db.commit()


@router.delete("/{rutina_id}/objetivos/{objetivo_id}", status_code=204)
def remove_objetivo_from_rutina(rutina_id: int, objetivo_id: int, db: Session = Depends(get_db)):
    """Desasociar un objetivo recurrente de una rutina."""
    r = db.query(Rutina).filter(Rutina.id == rutina_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rutina no encontrada")
    g = db.query(Goal).filter(Goal.id == objetivo_id).first()
    if g and g in r.objetivos:
        r.objetivos.remove(g)
        db.commit()


# ── Asignaciones ──────────────────────────────────────────────────────────────

@router.post("/asignaciones", response_model=RutinaAsignacionResponse, status_code=201)
def create_asignacion(data: RutinaAsignacionCreate, db: Session = Depends(get_db)):
    """Asignar una rutina a un día y parte del día. Si ya existe una, la reemplaza."""
    existing = (
        db.query(RutinaAsignacion)
        .filter(
            RutinaAsignacion.fecha == data.fecha,
            RutinaAsignacion.parte_dia == data.parte_dia,
        )
        .first()
    )
    if existing:
        existing.rutina_id = data.rutina_id
        existing.completada = False
        existing.es_automatica = False
        db.commit()
        db.refresh(existing)
        return _asignacion_to_dict(existing)

    asignacion = RutinaAsignacion(
        fecha=data.fecha,
        parte_dia=data.parte_dia,
        rutina_id=data.rutina_id,
        completada=False,
        es_automatica=False,
        fecha_creacion=datetime.now(),
    )
    db.add(asignacion)
    db.commit()
    db.refresh(asignacion)
    return _asignacion_to_dict(asignacion)


@router.patch("/asignaciones/{asignacion_id}", response_model=RutinaAsignacionResponse)
def update_asignacion(asignacion_id: int, data: RutinaAsignacionUpdate, db: Session = Depends(get_db)):
    a = db.query(RutinaAsignacion).filter(RutinaAsignacion.id == asignacion_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")

    next_fecha = data.fecha if data.fecha is not None else a.fecha
    next_parte_dia = data.parte_dia if data.parte_dia is not None else a.parte_dia

    if data.fecha is not None or data.parte_dia is not None:
        conflicting = (
            db.query(RutinaAsignacion)
            .filter(
                RutinaAsignacion.id != a.id,
                RutinaAsignacion.fecha == next_fecha,
                RutinaAsignacion.parte_dia == next_parte_dia,
            )
            .first()
        )
        if conflicting:
            raise HTTPException(status_code=409, detail="Ya existe una rutina asignada en ese dia y parte del dia")

    if data.rutina_id is not None:
        a.rutina_id = data.rutina_id
    if data.fecha is not None:
        a.fecha = data.fecha
    if data.parte_dia is not None:
        a.parte_dia = data.parte_dia
    if data.completada is not None:
        a.completada = data.completada
    if data.objetivo_ids is not None:
        a.objetivo_ids = json.dumps(data.objetivo_ids)

    db.commit()
    db.refresh(a)
    return _asignacion_to_dict(a)


@router.delete("/asignaciones/{asignacion_id}", status_code=204)
def delete_asignacion(asignacion_id: int, db: Session = Depends(get_db)):
    a = db.query(RutinaAsignacion).filter(RutinaAsignacion.id == asignacion_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    db.delete(a)
    db.commit()
