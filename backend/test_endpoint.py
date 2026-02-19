#!/usr/bin/env python
# -*- coding: utf-8 -*-
from app.api.routes.goals import list_goals
from app.db.database import SessionLocal
from fastapi import Query
import json
from datetime import datetime

def json_serializer(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError (f"Type {type(obj)} not serializable")

# Simular la llamada al endpoint
db = SessionLocal()
try:
    response = list_goals(
        category=None,
        completed=None,
        scheduled_for=None,
        page=1,
        page_size=2,
        db=db
    )
    # Convertir a dict para serialización
    response_dict = response.model_dump()
    print(json.dumps(response_dict, indent=2, default=json_serializer))
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
