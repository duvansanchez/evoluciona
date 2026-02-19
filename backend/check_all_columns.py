#!/usr/bin/env python
# -*- coding: utf-8 -*-
from app.db.database import engine
from sqlalchemy import text

tables = ['frases', 'categorias', 'subcategorias', 'question', 'response']

with engine.connect() as conn:
    for table in tables:
        print(f"\n{'='*60}")
        print(f"Columnas en tabla '{table}':")
        print(f"{'='*60}")
        result = conn.execute(text(f"SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='{table}' ORDER BY ORDINAL_POSITION"))
        cols = result.fetchall()
        for col in cols:
            print(f"  {col[0]:30} | {col[1]}")
