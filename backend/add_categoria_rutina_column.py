"""
Script para agregar la columna 'categoria' a la tabla rutinas.
Ejecutar una sola vez para actualizar el esquema de la base de datos.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.db.database import get_engine
from sqlalchemy import text


def add_categoria_column():
    engine = get_engine()
    with engine.connect() as conn:
        # Verificar si la columna ya existe
        result = conn.execute(text("""
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'rutinas'
            AND COLUMN_NAME = 'categoria'
        """))
        column_exists = result.scalar()

        if column_exists:
            print("La columna 'categoria' ya existe en la tabla 'rutinas'. Nada que hacer.")
        else:
            print("Agregando columna 'categoria' a la tabla 'rutinas'...")
            conn.execute(text("""
                ALTER TABLE rutinas
                ADD categoria NVARCHAR(100) NULL
            """))
            conn.commit()
            print("Columna 'categoria' agregada exitosamente.")


if __name__ == "__main__":
    print("Iniciando migracion: columna 'categoria' en rutinas...")
    try:
        add_categoria_column()
        print("Migracion completada.")
    except Exception as e:
        print(f"Error en la migracion: {e}")
        sys.exit(1)
