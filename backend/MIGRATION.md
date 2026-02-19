# Mapeo Legacy → Nueva Versión

Este documento mapea la estructura y lógica del backend viejo (Flask) al nuevo (FastAPI), para facilitar migración de datos y comprensión de cambios.

## 📊 Mapeo de Tablas

### Tablas Existentes (Esperadas)

| Tabla Legacy | Nueva Tabla | Cambios | Notas |
|---|---|---|---|
| `question` | `questions` | Renamed | + campos: `order`, `active`, `category` |
| `question_option` | `question_options` | Renamed | + campos: `order` |
| `response` | `question_responses` | Renamed | + campo: `answered_at` |
| Esperada | `goals` | NUEVA | Creada para objetivos |
| Esperada | `subgoals` | NUEVA | Creada para subobjetivos |
| Esperada | `phrase_categories` | NUEVA | Categorías de frases |
| Esperada | `phrase_subcategories` | NUEVA | Subcategorías de frases |
| Esperada | `phrases` | NUEVA | Frases inspiracionales |
| Esperada | `daily_sessions` | NUEVA | Sesiones diarias |

**Nota:** Si las tablas `questions` y `responses` existen en la BD actual con otros nombres, actualizar la configuración.

---

## 🔄 Mapeo de Endpoints

### Questions (Preguntas)

**Legacy (Flask):**
```
GET  /api/questions                        # Listar
POST /api/questions                        # Crear
GET  /api/questions/<id>                   # Obtener
PUT  /api/questions/<id>                   # Actualizar
DEL  /api/questions/<id>                   # Eliminar
```

**Nueva (FastAPI):**
```
GET  /api/questions                        # Listar (+ filtros)
POST /api/questions                        # Crear (+ opciones)
GET  /api/questions/{id}                   # Obtener
PATCH /api/questions/{id}                  # Actualizar
DELETE /api/questions/{id}                 # Eliminar
```

### Responses (Respuestas)

**Legacy (Flask):**
Probablemente en endpoint `/api/responses` o `/api/questions/<id>/responses`

**Nueva (FastAPI):**
```
GET    /api/daily-sessions/{date}                  # Obtener sesión
POST   /api/daily-sessions/{date}/responses        # Guardar respuestas
```

---

## 📋 Mapeo de Modelos

### Question (Pregunta)

**Legacy (esperado):**
```python
{
    "id": int,
    "title": str,
    "description": str,
    "type": str,  # "text", "select_single", "select_multiple"
}
```

**Nuevo:**
```python
{
    "id": str,  # UUID
    "title": str,
    "description": str,
    "type": str,  # "text", "select", "checkbox", "radio"
    "category": str,  # Nuevo: "personal", "work", "health", "habits", "goals", "general"
    "required": bool,  # Nuevo: default False
    "active": bool,  # Nuevo: default True
    "order": int,  # Nuevo: para ordenar en sesión diaria
    "created_at": str,  # ISO 8601
    "updated_at": str,  # ISO 8601
}
```

**Migration Script:**
```sql
-- Agregar columnas si no existen
ALTER TABLE questions ADD category VARCHAR(50) DEFAULT 'general';
ALTER TABLE questions ADD required BIT DEFAULT 0;
ALTER TABLE questions ADD active BIT DEFAULT 1;
ALTER TABLE questions ADD order INT DEFAULT 0;
ALTER TABLE questions ADD created_at VARCHAR(30);
ALTER TABLE questions ADD updated_at VARCHAR(30);

-- Convertir IDs int a string (si es necesario)
-- Considerar crear tabla nueva y copiar datos
```

### Response (Respuesta)

**Legacy (esperado):**
```python
{
    "id": int,
    "question_id": int,
    "response": str,  # JSON o texto simple
    "created_at": datetime,
}
```

**Nuevo:**
```python
{
    "id": str,  # UUID
    "session_id": str,  # UUID - NUEVO
    "question_id": str,  # UUID (migrado de int)
    "response": str,  # JSON serializado
    "answered_at": str,  # ISO 8601 - Nuevo nombre
}
```

**Migration Script:**
```sql
-- Crear tabla nueva
CREATE TABLE daily_sessions (
    id VARCHAR(36) PRIMARY KEY,
    date VARCHAR(10) NOT NULL UNIQUE,
    total_questions INT,
    answered_questions INT,
    completed_at VARCHAR(30),
    created_at VARCHAR(30)
);

-- Crear tabla nueva de respuestas
CREATE TABLE question_responses (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) FOREIGN KEY,
    question_id VARCHAR(36),
    response TEXT,
    answered_at VARCHAR(30)
);

-- Migrar datos
INSERT INTO daily_sessions (id, date, created_at)
SELECT 
    CONVERT(VARCHAR(36), NEWID()),
    CONVERT(VARCHAR(10), created_at, 121),
    CONVERT(VARCHAR(30), created_at, 126)
FROM responses
GROUP BY CONVERT(VARCHAR(10), created_at, 121);

INSERT INTO question_responses (id, session_id, question_id, response, answered_at)
SELECT 
    CONVERT(VARCHAR(36), NEWID()),
    s.id,
    r.question_id,
    r.response,
    CONVERT(VARCHAR(30), r.created_at, 126)
FROM responses r
JOIN daily_sessions s ON CONVERT(VARCHAR(10), r.created_at, 121) = s.date;
```

---

## 🔀 Cambios de Lógica

### Types de Questions

**Legacy:**
```
- "text"
- "select_single"
- "select_multiple"
```

**Nuevo:**
```
- "text"
- "select"           # Single select
- "checkbox"        # Multiple select
- "radio"           # Single select (radio button UI hint)
```

**Conversión:**
```python
type_mapping = {
    "text": "text",
    "select_single": "select",
    "select_multiple": "checkbox",
    "select": "select",  # En caso de que exista
}
```

### Almacenamiento de Opciones

**Legacy:**
Probablemente strings separados por separador (coma, pipe, etc.)

**Nuevo:**
Tabla separada `question_options` con estructura:
```python
{
    "id": str,
    "question_id": str,
    "value": str,       # Identificador
    "label": str,       # Texto mostrado
    "order": int,       # Orden de aparición
}
```

**Script de migración:**
```sql
-- Ejemplo: si las opciones están como "Sí|No|Quizás"
DECLARE @question_id VARCHAR(36) = 'some-id';
DECLARE @options VARCHAR(MAX) = 'Sí|No|Quizás';
DECLARE @order INT = 0;

-- Esto requeriría procedimiento almacenado o script Python
-- Ver: app/scripts/migrate_options.py
```

---

## 🔄 Cambios de API

### Eliminados/Cambiados

| Endpoint Legacy | Razón | Reemplazo |
|---|---|---|
| Cualquier endpoint HTML | SSR eliminado | API JSON only |
| Rutas con sesiones | Auth no implementado | Sin sesiones |
| Endpoints de estadísticas | Fuera de alcance MVP | Será agregado después |
| Soporte para audios | Fuera de alcance MVP | Será agregado después |

### Nuevos

| Endpoint | Propósito |
|---|---|
| `/api/goals/*` | Gestión de objetivos |
| `/api/subgoals/*` | Gestión de subobjetivos |
| `/api/phrases/*` | Gestión de frases |
| `/api/daily-sessions/*` | Sesiones diarias |

---

## 📋 Scripts de Migración

### Migration SQL Server

Crear archivo: `backend/migrations/001_initial_schema.sql`

```sql
-- Crear tablas nuevas
CREATE TABLE goals (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    priority VARCHAR(20) DEFAULT 'medium',
    recurring BIT DEFAULT 0,
    day_part VARCHAR(50),
    estimated_hours INT,
    estimated_minutes INT,
    reward VARCHAR(255),
    is_parent BIT DEFAULT 0,
    parent_goal_id VARCHAR(36),
    start_date VARCHAR(10),
    end_date VARCHAR(10),
    scheduled_for VARCHAR(10),
    completed BIT DEFAULT 0,
    completed_at VARCHAR(30),
    focus_time_seconds INT DEFAULT 0,
    focus_notes TEXT,
    skipped BIT DEFAULT 0,
    created_at VARCHAR(30) DEFAULT GETDATE(),
    FOREIGN KEY (parent_goal_id) REFERENCES goals(id)
);

-- ... más tablas en migrations/
```

### Migration Python (automática)

El script `app/seed.py` crea automáticamente las tablas si no existen:

```bash
python -m app.seed
```

---

## 🔍 Validación de Migración

### Verificar datos migrados

```python
# Script: backend/scripts/validate_migration.py
from app.db.database import SessionLocal
from app.models.models import Question, QuestionResponse

db = SessionLocal()

# Contar questions
q_count = db.query(Question).count()
print(f"Questions: {q_count}")

# Contar responses
r_count = db.query(QuestionResponse).count()
print(f"Responses: {r_count}")

# Verificar estructura
q = db.query(Question).first()
if q:
    print(f"Sample question: {q.title}")
    print(f"Type: {q.type}")
    print(f"Category: {q.category}")
    print(f"Options: {len(q.options)}")

db.close()
```

---

## ⚠️ Breaking Changes

| Cambio | Impacto | Solución |
|---|---|---|
| IDs int → UUID | Frontend debe adaptar | Usar strings en frontend |
| SSR eliminado | No hay templates HTML | Todo es JSON API |
| No sesiones | Session-based auth no existe | Preparar para JWT |
| Nuevos campos | Questions tienen más info | Actualizar schemas frontend |
| Tipos de preguntas | Cambio en nomenclatura | Mapear en migración |

---

## 📈 Plan de Migración

### Fase 1: Preparación
- [ ] Backup BD actual
- [ ] Revisar estructura actual vs esperada
- [ ] Crear scripts de migración personalizados

### Fase 2: Migración de Datos
- [ ] Ejecutar scripts SQL de migración
- [ ] Validar integridad de datos
- [ ] Crear seed de datos de ejemplo

### Fase 3: Testing
- [ ] Verificar endpoints con datos migrados
- [ ] Tests de filtros y paginación
- [ ] Tests de respuestas diarias

### Fase 4: Go Live
- [ ] Actualizar frontend
- [ ] Actualizar documentación
- [ ] Monitorear logs en producción

---

## 🔗 Referencias

- **Contrato del backend:** `backend-contrato-fastapi.md`
- **Guía de migración:** `guia-migracion-backend-nueva-version.md`
- **Defectos de legacy:** `defectos-version-vieja.md`
- **Código legacy:** https://github.com/duvansanchez/daily-questions-app.git

---

## 💾 Backup de datos

Antes de cualquier migración:

```bash
# SQL Server - Full backup
BACKUP DATABASE DailyQuestions
TO DISK = 'C:\Backups\DailyQuestions_backup.bak';

# Export a CSV (PowerShell en Windows)
sqlcmd -S server -U user -P password -d DailyQuestions ^
  -Q "SELECT * FROM questions" -o backup_questions.csv
```

---

**Última actualización:** 19 Feb 2026  
**Versión:** 1.0.0 MVP
