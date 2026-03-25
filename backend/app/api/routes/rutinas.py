"""
Endpoints para rutinas diarias.
"""

import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.models import Rutina, RutinaBloque, RutinaAsignacion, Goal
from app.schemas.schemas import (
    RutinaCreate, RutinaUpdate, RutinaResponse,
    RutinaAsignacionCreate, RutinaAsignacionUpdate, RutinaAsignacionResponse,
    DiaSemanaResponse,
)
from typing import List
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/rutinas", tags=["rutinas"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _rutina_to_dict(r: Rutina) -> dict:
    return {
        "id": r.id,
        "nombre": r.nombre,
        "parte_dia": r.parte_dia,
        "color": r.color,
        "descripcion": r.descripcion,
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
    goals = (
        db.query(Goal)
        .filter(Goal.recurrente == True, Goal.completado == False)
        .order_by(Goal.titulo)
        .all()
    )
    return [
        {"id": g.id, "titulo": g.titulo, "icono": g.icono, "categoria": g.categoria, "frecuencia": g.frecuencia}
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
    if data.bloques is not None:
        _replace_bloques(db, r, data.bloques)

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
        db.commit()
        db.refresh(existing)
        return _asignacion_to_dict(existing)

    asignacion = RutinaAsignacion(
        fecha=data.fecha,
        parte_dia=data.parte_dia,
        rutina_id=data.rutina_id,
        completada=False,
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

    if data.rutina_id is not None:
        a.rutina_id = data.rutina_id
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
