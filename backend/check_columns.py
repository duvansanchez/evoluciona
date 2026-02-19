#!/usr/bin/env python
# -*- coding: utf-8 -*-
from app.db.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text("SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='objetivos' ORDER BY ORDINAL_POSITION"))
    cols = result.fetchall()
    print("Columnas en tabla 'objetivos':")
    for col in cols:
        print(f"  {col[0]:30} | {col[2]:20} | Nullable: {col[1]}")
