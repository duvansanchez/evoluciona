#!/usr/bin/env python
# -*- coding: utf-8 -*-
from app.db.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME"))
    tables = result.fetchall()
    print("Tablas en la BD:")
    for table in tables:
        print(f"  - {table[0]}")
