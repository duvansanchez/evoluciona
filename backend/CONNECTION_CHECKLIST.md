# ✅ Checklist: Conexión a SQL Server

Sigue estos pasos para conectar el backend a tu BD SQL Server actual.

---

## 📋 Paso 1: Preparación

- [ ] SQL Server está corriendo
  ```bash
  # Windows: Services → SQL Server (MSSQLSERVER)
  # Linux: sudo systemctl status mssql-server
  ```

- [ ] Credenciales de acceso disponibles
  ```
  Servidor: _______________
  BD: _______________
  Usuario (si aplica): _______________
  Contraseña (si aplica): _______________
  ```

- [ ] Backend clonado y dependencias instaladas
  ```bash
  pip install -r requirements.txt
  ```

---

## 🔧 Paso 2: Configurar .env

```bash
# Copiar template
cp .env.example .env

# Editar .env
```

### Opción A: Windows Authentication (Recomendado)

```env
DB_SERVER=DESKTOP-ABC123      # Tu nombre de máquina o IP
DB_NAME=DailyQuestions
DB_USER=                      # DEJAR VACÍO
DB_PASSWORD=                  # DEJAR VACÍO
DB_DRIVER=ODBC Driver 17 for SQL Server
```

**Verificar nombre de servidor:**
```powershell
# PowerShell
$env:computername
# O: Settings → System → About
```

---

### Opción B: SQL Server Authentication

```env
DB_SERVER=localhost\SQLEXPRESS   # O tu servidor
DB_NAME=DailyQuestions
DB_USER=sa                      # Username
DB_PASSWORD=tu_contraseña       # Password segura
DB_DRIVER=ODBC Driver 17 for SQL Server
```

**Verificar credenciales:**
```bash
sqlcmd -S localhost\SQLEXPRESS -U sa -P <password>
1> SELECT 1
2> GO
```

---

## 🔍 Paso 3: Validar Conexión

### Test 1: Verificar Driver ODBC

```bash
# Python
python -c "import pyodbc; print(pyodbc.drivers())"
```

**Esperado:**
```
['ODBC Driver 17 for SQL Server', ...]
```

❌ Si no aparece:
```bash
# Windows: Descargar desde Microsoft
# https://learn.microsoft.com/es-es/sql/connect/odbc/download-odbc-driver-for-sql-server

# Linux (Ubuntu):
curl https://packages.microsoft.com/keys/microsoft.asc | sudo apt-key add -
curl https://packages.microsoft.com/config/ubuntu/20.04/prod.list | sudo tee /etc/apt/sources.list.d/msprod.list
sudo apt-get update
sudo apt-get install msodbcsql17
```

---

### Test 2: Verificar conexión direct

```bash
# Script: backend/scripts/test_connection.py
python -m scripts.test_connection
```

O manualmente:

```python
import pyodbc

connection_string = (
    'Driver={ODBC Driver 17 for SQL Server};'
    'Server=DESKTOP-ABC123;'
    'Database=DailyQuestions;'
    'Trusted_Connection=yes;'
)

try:
    conn = pyodbc.connect(connection_string)
    cursor = conn.cursor()
    cursor.execute("SELECT 1")
    print("✓ Conexión exitosa!")
    conn.close()
except Exception as e:
    print(f"✗ Error: {e}")
```

---

### Test 3: Verificar estructura de tablas

```python
from app.db.database import SessionLocal
from sqlalchemy import inspect

db = SessionLocal()
inspector = inspect(db.get_bind())
tables = inspector.get_table_names()

print("Tablas existentes:")
for table in tables:
    print(f"  - {table}")

db.close()
```

❓ ¿Esperadas las tablas `questions` y `responses`?
- ✅ Sí → Migración será necesaria
- ❌ No → Crear nuevas tablas (ver Paso 4)

---

## 🗄️ Paso 4: Primera inicialización

### Opción A: Crear tablas nuevas (Recomendado si BD está vacía)

```bash
# El script seed() crea todas las tablas automáticamente
python -c "from app.seed import seed_database; seed_database()"
```

Verificar:
```python
from app.models.models import Goal, Question, Phrase
from app.db.database import SessionLocal

db = SessionLocal()
print(f"Goals: {db.query(Goal).count()}")
print(f"Questions: {db.query(Question).count()}")
print(f"Phrases: {db.query(Phrase).count()}")
db.close()
```

---

### Opción B: Migrar datos existentes

Si ya tienes tablas `questions` y `responses`:

```bash
# Ver: backend/MIGRATION.md para scripts SQL específicos
python -m scripts.migrate_legacy_data
```

⚠️ **IMPORTANTE:** Hacer backup primero
```sql
BACKUP DATABASE DailyQuestions 
TO DISK = 'C:\Backups\DailyQuestions_backup.bak';
```

---

## 🚀 Paso 5: Ejecutar servidor

```bash
# Desarrollo
python -m uvicorn main:app --reload

# Producción
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

**Esperado:**
```
Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

---

## 📊 Paso 6: Validar endpoints

Abrir en navegador: `http://localhost:8000/docs`

### Tests manuales en Swagger UI

#### 1. Crear objetivo
```
POST /api/goals
{
  "title": "Test Objetivo",
  "category": "daily",
  "priority": "high"
}
```

✅ Esperado: 200 OK + Goal creado

---

#### 2. Listar objetivos
```
GET /api/goals?page=1&page_size=10
```

✅ Esperado: 200 OK + Array con goals

---

#### 3. Crear pregunta con opciones
```
POST /api/questions
{
  "title": "¿Completaste tu tarea?",
  "type": "select",
  "category": "goals",
  "options": [
    {"value": "yes", "label": "Sí", "order": 1},
    {"value": "no", "label": "No", "order": 2}
  ]
}
```

✅ Esperado: 200 OK + Question con options

---

#### 4. Obtener sesión diaria
```
GET /api/daily-sessions/2024-02-19
```

✅ Esperado: 200 OK + Session para esa fecha

---

## 🧪 Paso 7: Ejecutar tests completos

```bash
# Todos los tests
pytest test_api.py -v

# Test específico
pytest test_api.py::TestGoals::test_create_goal -v
```

✅ Esperado: Todos en ✅ PASSED

---

## 🐛 Troubleshooting

### Error: "Cannot open database"

```
[WIN32] Error: [Microsoft][ODBC Driver 17 for SQL Server]
[SQL Server]Cannot open database "DailyQuestions"
```

**Solución:**
```sql
-- Verificar en SSMS
SELECT name FROM sys.databases WHERE name = 'DailyQuestions'

-- Si no existe, crear
CREATE DATABASE DailyQuestions;
```

---

### Error: "Connection refused"

```
[WIN32] Error: [Microsoft][ODBC Driver 17 for SQL Server]
[SQL Server]TCP Provider: No such host or object.
```

**Solución:**
```bash
# 1. Verificar servidor
ping DESKTOP-ABC123

# 2. Verificar puerto (por defecto 1433)
netstat -ano | grep 1433

# 3. Verificar SQL Server está corriendo (Windows)
Get-Service MSSQLSERVER

# 4. Reiniciar SQL Server
Restart-Service MSSQLSERVER
```

---

### Error: "Login failed for user"

```
[WIN32] Error: [Microsoft][ODBC Driver 17 for SQL Server]
[SQL Server]Login failed for user 'sa'.
```

**Solución:**
```bash
# Verificar contraseña
sqlcmd -S localhost\SQLEXPRESS -U sa -P <password>

# Si olvidaste contraseña, reset en SSMS:
# 1. Security → Logins → sa
# 2. Cambiar contraseña
```

---

### Error: "No such driver"

```
pyodbc.ProgrammingError: ('01000', "[01000] [unixODBC][Driver Manager]
Can't open lib 'ODBC Driver 17 for SQL Server'")
```

**Solución:**
```bash
# Reinstalar driver
pip uninstall pyodbc
pip install pyodbc

# Verificar driver está lisible
odbcinst -j

# Si falta en Linux:
sudo apt-get install odbc-postgresql
```

---

### Error: "Database already exists"

Si las tablas existen pero con esquema diferente:

```sql
-- En SSMS, ir a BD y:
-- 1. Drop existing tables (cuidado con datos!)
DROP TABLE IF EXISTS question_responses;
DROP TABLE IF EXISTS question_options;
DROP TABLE IF EXISTS questions;

-- 2. O mejor: renombrar
EXEC sp_rename 'questions', 'questions_old';
EXEC sp_rename 'question_responses', 'question_responses_old';

-- 3. Luego ejecutar seed
```

```bash
python -c "from app.seed import seed_database; seed_database()"
```

---

## ✅ Checklist Final

- [ ] Driver ODBC instalado y funcionando
- [ ] .env configurado con credenciales correctas
- [ ] Conexión directa probada (test_connection.py)
- [ ] Tablas creadas (seed ejecutado)
- [ ] Servidor ejecutando sin errores
- [ ] Swagger UI accesible (/docs)
- [ ] Tests pasando (pytest test_api.py -v)
- [ ] Endpoints respondiendo (manual Swagger test)
- [ ] Datos en BD (verificar con queries)

---

## 🎉 Status: Listo para Desarrollo

Si completaste todos los pasos:

✅ Backend conectado a BD SQL Server  
✅ API funcionando  
✅ Tests verdes  
✅ Data sincronizada  

**Próximo paso:** Conectar frontend React a los endpoints

```javascript
// En React:
const API_BASE = "http://localhost:8000/api";

// Crear objetivo:
fetch(`${API_BASE}/goals`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "Mi objetivo",
    category: "daily"
  })
});
```

---

## 📞 Soporte

Si algo no funciona:

1. **Revisar log de errores:**
   ```bash
   # El servidor FastAPI muestra errores en consola
   # Buscar línea que empiece con "ERROR"
   ```

2. **Revisar archivo de configuración:**
   ```bash
   # .env debe estar sin espacios adicionales
   # DB_SERVER=localhost (sin comillas)
   ```

3. **Validar manualmente con Python:**
   ```python
   from app.config import settings
   print(settings.DATABASE_URL)
   # Debe mostrar string de conexión correcta
   ```

4. **Consultar documentos:**
   - `README.md` - Guía general
   - `DEVELOPMENT.md` - Desarrollo
   - `MIGRATION.md` - Migración de datos
   - `ARCHITECTURE.md` - Arquitectura

---

**Última actualización:** 19 Feb 2026  
**Versión:** 1.0.0 MVP
