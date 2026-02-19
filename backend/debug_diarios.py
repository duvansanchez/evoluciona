import pyodbc
from datetime import datetime

# Conectar a BD
conn = pyodbc.connect(
    'DRIVER={SQL Server};'
    'SERVER=localhost;'
    'DATABASE=DailyQuestions;'
    'Trusted_Connection=yes;'
    'TrustServerCertificate=yes;'
)
cursor = conn.cursor()

# Total diarios
cursor.execute("SELECT COUNT(*) FROM objetivos WHERE categoria='diario'")
total_diarios = cursor.fetchone()[0]
print(f"📊 Total objetivos diarios en BD: {total_diarios}")

# Analizar por recurrentes
cursor.execute("SELECT COUNT(*) FROM objetivos WHERE categoria='diario' AND recurrente=1")
recurrentes = cursor.fetchone()[0]
print(f"🔄 Objetivos diarios recurrentes: {recurrentes}")

# Analizar por programado_para
cursor.execute("""
    SELECT COUNT(*), programado_para 
    FROM objetivos 
    WHERE categoria='diario' 
    GROUP BY programado_para
    ORDER BY COUNT(*) DESC
""")
print(f"\n📅 Distribución por programado_para:")
for count, prog in cursor.fetchall():
    prog_str = str(prog) if prog else "NULL" 
    print(f"   {prog_str}: {count} objetivos")

# Analizar fechas futuras
today = datetime.now().date()
cursor.execute(f"""
    SELECT id, titulo, fecha_creacion, programado_para, recurrente
    FROM objetivos
    WHERE categoria='diario' 
    AND programado_para > '{today}'
""")
futuros_programados = cursor.fetchall()
print(f"\n🔮 Objetivos diarios programados para el FUTURO: {len(futuros_programados)}")
for row in futuros_programados:
    print(f"   ID {row[0]}: {row[1][:40]} -> programado_para={row[3]}")

# Analizar fechas creación futuras (raro pero posible)
cursor.execute(f"""
    SELECT id, titulo, fecha_creacion, recurrente
    FROM objetivos
    WHERE categoria='diario' 
    AND CAST(fecha_creacion AS DATE) > '{today}'
""")
futuros_creados = cursor.fetchall()
print(f"\n🆕 Objetivos diarios con fecha_creacion FUTURA: {len(futuros_creados)}")

print(f"\n✅ Deberían mostrarse hoy:")
esperados = total_diarios - len(futuros_programados) - len(futuros_creados)
print(f"   {total_diarios} total - {len(futuros_programados)} futuros - {len(futuros_creados)} no creados = {esperados}")

conn.close()
