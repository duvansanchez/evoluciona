"""
Script para verificar qué objetivos se están renderizando y cuáles no.
"""
import pyodbc
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    """Obtiene conexión a la base de datos."""
    conn_str = (
        "DRIVER={ODBC Driver 18 for SQL Server};"
        "SERVER=localhost;"
        "DATABASE=DailyQuestions;"
        "Trusted_Connection=yes;"
        "TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str)

def main():
    conn = get_connection()
    cursor = conn.cursor()
    
    print("=" * 80)
    print("ANÁLISIS DE OBJETIVOS EN LA BASE DE DATOS")
    print("=" * 80)
    
    # Total de objetivos
    cursor.execute("SELECT COUNT(*) FROM objetivos")
    total = cursor.fetchone()[0]
    print(f"\n📊 Total de objetivos en la tabla: {total}")
    
    # Objetivos por categoría
    print("\n📁 Objetivos por categoría:")
    cursor.execute("""
        SELECT categoria, COUNT(*) as total
        FROM objetivos
        GROUP BY categoria
        ORDER BY total DESC
    """)
    for row in cursor.fetchall():
        categoria = row[0] or 'Sin categoría'
        print(f"  - {categoria}: {row[1]}")
    
    # Objetivos por prioridad
    print("\n⚡ Objetivos por prioridad:")
    cursor.execute("""
        SELECT prioridad, COUNT(*) as total
        FROM objetivos
        GROUP BY prioridad
        ORDER BY total DESC
    """)
    for row in cursor.fetchall():
        prioridad = row[0] or 'Sin prioridad'
        print(f"  - {prioridad}: {row[1]}")
    
    # Objetivos por estado de completado
    print("\n✅ Objetivos por estado:")
    cursor.execute("""
        SELECT 
            CASE WHEN completado = 1 THEN 'Completados' ELSE 'Pendientes' END as estado,
            COUNT(*) as total
        FROM objetivos
        GROUP BY completado
    """)
    for row in cursor.fetchall():
        print(f"  - {row[0]}: {row[1]}")
    
    # Objetivos con programado_para
    print("\n📅 Objetivos con campo 'programado_para':")
    cursor.execute("""
        SELECT programado_para, COUNT(*) as total
        FROM objetivos
        WHERE programado_para IS NOT NULL
        GROUP BY programado_para
        ORDER BY total DESC
    """)
    rows = cursor.fetchall()
    if rows:
        for row in rows:
            print(f"  - {row[0]}: {row[1]}")
    else:
        print("  - Ningún objetivo tiene 'programado_para' configurado")
    
    # Objetivos sin programado_para
    cursor.execute("""
        SELECT COUNT(*) 
        FROM objetivos
        WHERE programado_para IS NULL OR programado_para = ''
    """)
    sin_programado = cursor.fetchone()[0]
    print(f"  - Sin 'programado_para': {sin_programado}")
    
    # Mostrar algunos objetivos de ejemplo
    print("\n📝 Primeros 10 objetivos (para verificar):")
    cursor.execute("""
        SELECT TOP 10 
            id, 
            titulo, 
            categoria, 
            prioridad, 
            completado,
            programado_para
        FROM objetivos
        ORDER BY fecha_creacion DESC
    """)
    print(f"\n{'ID':<5} {'Título':<40} {'Categoría':<15} {'Prioridad':<10} {'Completado':<10} {'Programado':<15}")
    print("-" * 110)
    for row in cursor.fetchall():
        id_obj = row[0]
        titulo = (row[1][:37] + '...') if len(row[1]) > 40 else row[1]
        categoria = row[2] or 'N/A'
        prioridad = row[3] or 'N/A'
        completado = 'Sí' if row[4] else 'No'
        programado = row[5] or 'N/A'
        print(f"{id_obj:<5} {titulo:<40} {categoria:<15} {prioridad:<10} {completado:<10} {programado:<15}")
    
    print("\n" + "=" * 80)
    print("RECOMENDACIONES:")
    print("=" * 80)
    
    if sin_programado < total:
        print(f"\n⚠️  Hay {total - sin_programado} objetivos con 'programado_para' configurado.")
        print("   Esto podría estar filtrando objetivos si el frontend envía este parámetro.")
    
    print("\n✅ El frontend debería cargar todos los objetivos sin filtros.")
    print("   Verifica que no se esté enviando el parámetro 'scheduled_for' en la API.")
    
    conn.close()

if __name__ == "__main__":
    main()
