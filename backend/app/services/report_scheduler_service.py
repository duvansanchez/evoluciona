"""
Servicio para gestionar la programación del informe semanal.
Permite persistir configuración y reprogramar APScheduler en caliente.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Callable, Dict, Any
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger


DEFAULT_SCHEDULE: Dict[str, Any] = {
    "enabled": True,
    "day_of_week": "mon",
    "hour": 7,
    "minute": 0,
}

VALID_DAYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
JOB_ID = "weekly_report"

_scheduler = BackgroundScheduler(timezone="America/Bogota")
_job_callable: Callable[[], None] | None = None
_config_path = Path(__file__).resolve().parents[2] / "data" / "report_schedule.json"
_history_path = Path(__file__).resolve().parents[2] / "data" / "report_history.json"


def _ensure_parent_dir() -> None:
    _config_path.parent.mkdir(parents=True, exist_ok=True)


def _load_history() -> list[Dict[str, Any]]:
    _ensure_parent_dir()
    if not _history_path.exists():
        return []

    with _history_path.open("r", encoding="utf-8") as file:
        raw = json.load(file)

    if not isinstance(raw, list):
        return []
    return raw


def _save_history(items: list[Dict[str, Any]]) -> None:
    _ensure_parent_dir()
    with _history_path.open("w", encoding="utf-8") as file:
        json.dump(items, file, indent=2, ensure_ascii=False)


def record_report_event(
    report_type: str,
    status: str,
    week_label: str,
    source: str,
    details: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    history = _load_history()
    event = {
        "timestamp": datetime.now().isoformat(),
        "type": report_type,
        "status": status,
        "week_label": week_label,
        "source": source,
        "details": details or {},
    }
    history.append(event)
    _save_history(history[-50:])
    return event


def get_report_history(limit: int = 10) -> list[Dict[str, Any]]:
    parsed_limit = max(1, min(int(limit), 50))
    history = _load_history()
    return list(reversed(history))[:parsed_limit]


def _validate_config(config: Dict[str, Any]) -> Dict[str, Any]:
    day_of_week = str(config.get("day_of_week", DEFAULT_SCHEDULE["day_of_week"]).lower())
    if day_of_week not in VALID_DAYS:
        raise ValueError("day_of_week inválido. Usa: mon,tue,wed,thu,fri,sat,sun")

    try:
        hour = int(config.get("hour", DEFAULT_SCHEDULE["hour"]))
        minute = int(config.get("minute", DEFAULT_SCHEDULE["minute"]))
    except (TypeError, ValueError):
        raise ValueError("hour y minute deben ser enteros")

    if hour < 0 or hour > 23:
        raise ValueError("hour debe estar entre 0 y 23")
    if minute < 0 or minute > 59:
        raise ValueError("minute debe estar entre 0 y 59")

    enabled = bool(config.get("enabled", DEFAULT_SCHEDULE["enabled"]))

    return {
        "enabled": enabled,
        "day_of_week": day_of_week,
        "hour": hour,
        "minute": minute,
    }


def load_schedule_config() -> Dict[str, Any]:
    _ensure_parent_dir()
    if not _config_path.exists():
        save_schedule_config(DEFAULT_SCHEDULE)
        return dict(DEFAULT_SCHEDULE)

    with _config_path.open("r", encoding="utf-8") as file:
        raw = json.load(file)

    merged = {**DEFAULT_SCHEDULE, **(raw or {})}
    validated = _validate_config(merged)
    if validated != merged:
        save_schedule_config(validated)
    return validated


def save_schedule_config(config: Dict[str, Any]) -> Dict[str, Any]:
    validated = _validate_config(config)
    _ensure_parent_dir()
    with _config_path.open("w", encoding="utf-8") as file:
        json.dump(validated, file, indent=2, ensure_ascii=False)
    return validated


def _upsert_scheduler_job(config: Dict[str, Any]) -> None:
    if _job_callable is None:
        return

    try:
        _scheduler.remove_job(JOB_ID)
    except Exception:
        pass

    if not config["enabled"]:
        return

    _scheduler.add_job(
        _job_callable,
        CronTrigger(day_of_week=config["day_of_week"], hour=config["hour"], minute=config["minute"]),
        id=JOB_ID,
        replace_existing=True,
    )


def initialize_scheduler(job_callable: Callable[[], None]) -> Dict[str, Any]:
    global _job_callable
    _job_callable = job_callable

    if not _scheduler.running:
        _scheduler.start()

    config = load_schedule_config()
    _upsert_scheduler_job(config)
    return get_scheduler_state()


def update_scheduler_config(changes: Dict[str, Any]) -> Dict[str, Any]:
    current = load_schedule_config()
    updated = {**current, **changes}
    saved = save_schedule_config(updated)
    _upsert_scheduler_job(saved)
    return get_scheduler_state()


def get_scheduler() -> BackgroundScheduler:
    """Retorna la instancia compartida del scheduler."""
    return _scheduler


def get_scheduler_state() -> Dict[str, Any]:
    config = load_schedule_config()
    job = _scheduler.get_job(JOB_ID)
    next_run = None
    if job and job.next_run_time:
        next_run = job.next_run_time.isoformat()

    return {
        "timezone": "America/Bogota",
        "running": _scheduler.running,
        "config": config,
        "job_id": JOB_ID,
        "next_run_time": next_run,
    }
