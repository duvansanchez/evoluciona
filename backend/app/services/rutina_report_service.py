"""
Servicio para construir informes semanales y mensuales del modulo de rutinas.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from app.models.models import Goal, GoalCompletionDay, GoalSkipDay, Rutina, RutinaAsignacion, rutina_objetivos
from app.services.stats_service import get_month_range, get_week_range


MONTHS_ES = [
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

DAY_PART_LABELS = {
    "morning": "Manana",
    "afternoon": "Tarde",
    "evening": "Noche",
}


def _bucket_routine_progress(completed_count: int, total_goals: int, assignment_completed: bool) -> int:
    if total_goals <= 0:
        return 100 if assignment_completed else 0

    if completed_count >= total_goals:
        return 100

    raw_progress = (completed_count / total_goals) * 100
    return int(raw_progress // 25) * 25


def _routine_progress_label(progress_percent: int) -> str:
    if progress_percent >= 100:
        return "Completo"
    if progress_percent >= 75:
        return "Alto"
    if progress_percent >= 50:
        return "Medio"
    if progress_percent >= 25:
        return "Bajo"
    return "Nada"


def _build_routine_day_evaluation(
    *,
    completed_count: int,
    skipped_count: int,
    pending_count: int,
    total_goals: int,
    assignment_completed: bool,
) -> dict[str, Any]:
    if skipped_count > 0 and pending_count == 0:
        return {
            "progress_percent": None,
            "progress_label": "Neutral por saltos",
            "is_neutral": True,
        }

    progress_percent = _bucket_routine_progress(completed_count, total_goals, assignment_completed)
    return {
        "progress_percent": progress_percent,
        "progress_label": _routine_progress_label(progress_percent),
        "is_neutral": False,
    }


def build_rutina_report_label(mode: str, start: date, end: date) -> str:
    normalized = (mode or "weekly").lower()
    if normalized == "monthly":
        return f"Mes de {MONTHS_ES[start.month]} {start.year}"
    if start.month == end.month:
        return f"Semana del {start.day} al {end.day} de {MONTHS_ES[start.month]} {start.year}"
    return f"Semana del {start.day} de {MONTHS_ES[start.month]} al {end.day} de {MONTHS_ES[end.month]} {end.year}"


def get_rutina_report_range(mode: str, reference: date) -> tuple[date, date]:
    normalized = (mode or "weekly").lower()
    if normalized == "monthly":
        return get_month_range(reference)
    return get_week_range(reference)


def build_rutina_report(db: Session, mode: str = "weekly", reference: Optional[date] = None) -> Dict[str, Any]:
    ref = reference or date.today()
    period_start, period_end = get_rutina_report_range(mode, ref)
    period_start_str = period_start.isoformat()
    period_end_str = period_end.isoformat()

    assignments = (
        db.query(RutinaAsignacion)
        .filter(
            RutinaAsignacion.fecha >= period_start_str,
            RutinaAsignacion.fecha <= period_end_str,
        )
        .all()
    )

    active_routines = db.query(Rutina).filter(Rutina.activa == True).all()
    active_routine_ids = {rutina.id for rutina in active_routines}

    by_date: dict[str, list[RutinaAsignacion]] = defaultdict(list)
    by_routine: dict[int, list[RutinaAsignacion]] = defaultdict(list)
    by_day_part: dict[str, list[RutinaAsignacion]] = defaultdict(list)

    for assignment in assignments:
        by_date[assignment.fecha].append(assignment)
        by_routine[assignment.rutina_id].append(assignment)
        by_day_part[assignment.parte_dia].append(assignment)

    total_assignments = len(assignments)
    completed_assignments = sum(1 for assignment in assignments if assignment.completada)
    completion_rate = round((completed_assignments / total_assignments) * 100) if total_assignments else 0
    days_with_routines = len(by_date)
    completed_days = sum(
        1
        for daily_assignments in by_date.values()
        if daily_assignments and all(assignment.completada for assignment in daily_assignments)
    )
    assigned_routine_ids = {assignment.rutina_id for assignment in assignments}

    routine_lookup = {rutina.id: rutina for rutina in active_routines}
    top_routines = sorted(
        [
            {
                "id": rutina_id,
                "name": (
                    by_routine[rutina_id][0].rutina.nombre
                    if by_routine[rutina_id] and by_routine[rutina_id][0].rutina
                    else routine_lookup.get(rutina_id).nombre
                    if routine_lookup.get(rutina_id)
                    else f"Rutina {rutina_id}"
                ),
                "day_part": (
                    by_routine[rutina_id][0].rutina.parte_dia
                    if by_routine[rutina_id] and by_routine[rutina_id][0].rutina
                    else routine_lookup.get(rutina_id).parte_dia
                    if routine_lookup.get(rutina_id)
                    else None
                ),
                "day_part_label": DAY_PART_LABELS.get(
                    (
                        by_routine[rutina_id][0].rutina.parte_dia
                        if by_routine[rutina_id] and by_routine[rutina_id][0].rutina
                        else routine_lookup.get(rutina_id).parte_dia
                        if routine_lookup.get(rutina_id)
                        else None
                    ),
                    "Sin parte del dia",
                ),
                "assigned": len(items),
                "completed": sum(1 for item in items if item.completada),
                "completion_rate": round((sum(1 for item in items if item.completada) / len(items)) * 100) if items else 0,
            }
            for rutina_id, items in by_routine.items()
        ],
        key=lambda item: (item["assigned"], item["completed"], item["name"]),
        reverse=True,
    )

    day_part_usage = []
    for day_part in ("morning", "afternoon", "evening"):
        items = by_day_part.get(day_part, [])
        assigned = len(items)
        completed = sum(1 for item in items if item.completada)
        day_part_usage.append(
            {
                "day_part": day_part,
                "label": DAY_PART_LABELS.get(day_part, day_part),
                "assigned": assigned,
                "completed": completed,
                "completion_rate": round((completed / assigned) * 100) if assigned else 0,
            }
        )

    day_records = []
    cursor = period_start
    while cursor <= period_end:
        iso = cursor.isoformat()
        items = by_date.get(iso, [])
        assigned = len(items)
        completed = sum(1 for item in items if item.completada)
        daily_parts: dict[str, list[RutinaAsignacion]] = defaultdict(list)
        for item in items:
            daily_parts[item.parte_dia].append(item)
        day_records.append(
            {
                "date": iso,
                "weekday": cursor.strftime("%a"),
                "assigned": assigned,
                "completed": completed,
                "completion_rate": round((completed / assigned) * 100) if assigned else 0,
                "day_parts": [
                    {
                        "day_part": part,
                        "label": DAY_PART_LABELS.get(part, part),
                        "assigned": len(part_items),
                        "completed": sum(1 for item in part_items if item.completada),
                    }
                    for part, part_items in sorted(daily_parts.items())
                ],
            }
        )
        cursor += timedelta(days=1)

    streaks = _build_completion_streaks(db)
    coverage_reviewed = len(assigned_routine_ids & active_routine_ids)
    coverage_total = len(active_routine_ids)
    goal_completion_data = _build_goal_completion_log(db, period_start_str, period_end_str)
    routine_breakdown = _build_routine_breakdown(db, assignments, period_start_str, period_end_str, routine_lookup)

    return {
        "mode": (mode or "weekly").lower(),
        "period_start": period_start_str,
        "period_end": period_end_str,
        "period_label": build_rutina_report_label(mode, period_start, period_end),
        "total_assignments": total_assignments,
        "completed_assignments": completed_assignments,
        "completion_rate": completion_rate,
        "days_with_routines": days_with_routines,
        "completed_days": completed_days,
        "top_routines": top_routines[:10],
        "day_part_usage": day_part_usage,
        "daily_distribution": day_records,
        "streaks": streaks,
        "goal_completion_summary": goal_completion_data["summary"],
        "goal_completion_log": goal_completion_data["log"],
        "routine_breakdown": routine_breakdown,
        "coverage": {
            "active_routines": coverage_total,
            "assigned_active_routines": coverage_reviewed,
            "percent": round((coverage_reviewed / coverage_total) * 100) if coverage_total else 0,
        },
    }


def _build_completion_streaks(db: Session) -> Dict[str, int]:
    assignments = (
        db.query(RutinaAsignacion)
        .order_by(RutinaAsignacion.fecha.asc())
        .all()
    )

    if not assignments:
        return {"current": 0, "max": 0}

    by_date: dict[str, list[RutinaAsignacion]] = defaultdict(list)
    for assignment in assignments:
        by_date[assignment.fecha].append(assignment)

    sorted_days = sorted(by_date.keys())
    max_streak = 0
    current_window = 0
    previous_date: date | None = None

    for day_str in sorted_days:
        day = date.fromisoformat(day_str)
        day_completed = all(item.completada for item in by_date[day_str])

        if not day_completed:
            current_window = 0
            previous_date = day
            continue

        if previous_date and (day - previous_date).days == 1 and current_window > 0:
            current_window += 1
        else:
            current_window = 1

        max_streak = max(max_streak, current_window)
        previous_date = day

    current_streak = 0
    previous_day: date | None = None
    for day_str in reversed(sorted_days):
        day = date.fromisoformat(day_str)
        day_completed = all(item.completada for item in by_date[day_str])
        if not day_completed:
            break
        if previous_day and (previous_day - day).days != 1:
            break
        current_streak += 1
        previous_day = day

    return {"current": current_streak, "max": max_streak}


def _build_goal_completion_log(db: Session, period_start: str, period_end: str) -> Dict[str, Any]:
    linked_goals = (
        db.query(Goal.id, Goal.titulo, Goal.icono)
        .join(rutina_objetivos, rutina_objetivos.c.objetivo_id == Goal.id)
        .distinct()
        .all()
    )
    linked_goal_ids = {row.id for row in linked_goals}

    if not linked_goal_ids:
        return {
            "summary": {
                "total_completions": 0,
                "days_with_completions": 0,
                "distinct_goals": 0,
            },
            "log": [],
        }

    linked_goal_lookup = {
        row.id: {
            "title": row.titulo,
            "icon": row.icono,
        }
        for row in linked_goals
    }

    routine_links = (
        db.query(rutina_objetivos.c.objetivo_id, Rutina.nombre)
        .join(Rutina, Rutina.id == rutina_objetivos.c.rutina_id)
        .all()
    )
    goal_routine_names: dict[int, list[str]] = defaultdict(list)
    for goal_id, routine_name in routine_links:
        if routine_name and routine_name not in goal_routine_names[goal_id]:
            goal_routine_names[goal_id].append(routine_name)

    completion_rows = (
        db.query(GoalCompletionDay)
        .filter(
            GoalCompletionDay.objetivo_id.in_(linked_goal_ids),
            GoalCompletionDay.fecha >= period_start,
            GoalCompletionDay.fecha <= period_end,
        )
        .order_by(GoalCompletionDay.fecha.asc(), GoalCompletionDay.fecha_creacion.asc())
        .all()
    )

    if not completion_rows:
        return {
            "summary": {
                "total_completions": 0,
                "days_with_completions": 0,
                "distinct_goals": 0,
            },
            "log": [],
        }

    by_date: dict[str, list[dict[str, Any]]] = defaultdict(list)
    distinct_goal_ids: set[int] = set()

    for row in completion_rows:
        goal_meta = linked_goal_lookup.get(row.objetivo_id)
        if not goal_meta:
            continue
        distinct_goal_ids.add(row.objetivo_id)
        by_date[row.fecha].append(
            {
                "id": row.objetivo_id,
                "title": goal_meta["title"],
                "icon": goal_meta["icon"],
                "completed_at": row.fecha_creacion.isoformat() if row.fecha_creacion else None,
                "routine_names": goal_routine_names.get(row.objetivo_id, []),
            }
        )

    log = [
        {
            "date": day,
            "count": len(items),
            "goals": items,
        }
        for day, items in sorted(by_date.items())
    ]

    return {
        "summary": {
            "total_completions": len(completion_rows),
            "days_with_completions": len(log),
            "distinct_goals": len(distinct_goal_ids),
        },
        "log": log,
    }


def _build_routine_breakdown(
    db: Session,
    assignments: list[RutinaAsignacion],
    period_start: str,
    period_end: str,
    routine_lookup: dict[int, Rutina],
) -> list[dict[str, Any]]:
    if not assignments:
        return []

    by_routine: dict[int, list[RutinaAsignacion]] = defaultdict(list)
    routine_goal_ids: set[int] = set()

    for assignment in assignments:
        by_routine[assignment.rutina_id].append(assignment)
        routine = assignment.rutina or routine_lookup.get(assignment.rutina_id)
        for goal in (routine.objetivos if routine else []):
            routine_goal_ids.add(goal.id)

    completions = (
        db.query(GoalCompletionDay)
        .filter(
            GoalCompletionDay.objetivo_id.in_(routine_goal_ids) if routine_goal_ids else False,
            GoalCompletionDay.fecha >= period_start,
            GoalCompletionDay.fecha <= period_end,
        )
        .all()
    ) if routine_goal_ids else []

    skips = (
        db.query(GoalSkipDay)
        .filter(
            GoalSkipDay.objetivo_id.in_(routine_goal_ids) if routine_goal_ids else False,
            GoalSkipDay.fecha >= period_start,
            GoalSkipDay.fecha <= period_end,
        )
        .all()
    ) if routine_goal_ids else []

    completion_keys = {(row.objetivo_id, row.fecha) for row in completions}
    skip_keys = {(row.objetivo_id, row.fecha) for row in skips}

    breakdown: list[dict[str, Any]] = []

    for routine_id, items in sorted(by_routine.items(), key=lambda pair: len(pair[1]), reverse=True):
        routine = items[0].rutina if items and items[0].rutina else routine_lookup.get(routine_id)
        routine_goals = list(routine.objetivos) if routine else []
        goal_count = len(routine_goals)

        day_entries: list[dict[str, Any]] = []
        failed_days = 0
        neutral_days = 0
        total_progress_percent = 0
        progress_day_count = 0

        for assignment in sorted(items, key=lambda item: item.fecha, reverse=True):
            goal_statuses: list[dict[str, Any]] = []
            completed_count = 0
            skipped_count = 0
            pending_count = 0

            for goal in routine_goals:
                key = (goal.id, assignment.fecha)
                if key in completion_keys:
                    status = "completed"
                    completed_count += 1
                elif key in skip_keys:
                    status = "skipped"
                    skipped_count += 1
                else:
                    status = "pending"
                    pending_count += 1

                goal_statuses.append(
                    {
                        "id": goal.id,
                        "title": goal.titulo,
                        "icon": goal.icono,
                        "status": status,
                    }
                )

            evaluation = _build_routine_day_evaluation(
                completed_count=completed_count,
                skipped_count=skipped_count,
                pending_count=pending_count,
                total_goals=goal_count,
                assignment_completed=assignment.completada,
            )
            progress_percent = evaluation["progress_percent"]

            if evaluation["is_neutral"]:
                neutral_days += 1
            else:
                total_progress_percent += progress_percent
                progress_day_count += 1

            if not evaluation["is_neutral"] and progress_percent < 100:
                failed_days += 1

            day_entries.append(
                {
                    "date": assignment.fecha,
                    "completed_assignment": assignment.completada,
                    "progress_percent": progress_percent,
                    "progress_label": evaluation["progress_label"],
                    "is_neutral": evaluation["is_neutral"],
                    "goal_count": goal_count,
                    "completed_count": completed_count,
                    "skipped_count": skipped_count,
                    "pending_count": pending_count,
                    "goals": goal_statuses,
                }
            )

        breakdown.append(
            {
                "id": routine_id,
                "name": routine.nombre if routine else f"Rutina {routine_id}",
                "day_part": routine.parte_dia if routine else None,
                "day_part_label": DAY_PART_LABELS.get(routine.parte_dia if routine else None, "Sin parte del dia"),
                "assigned": len(items),
                "completed": sum(1 for item in items if item.completada),
                "failed_days": failed_days,
                "neutral_days": neutral_days,
                "linked_goals": goal_count,
                "average_progress_percent": round(total_progress_percent / progress_day_count) if progress_day_count else 0,
                "days": day_entries,
            }
        )

    return breakdown
