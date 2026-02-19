# Daily Questions API - Backend

Backend basado en FastAPI para la aplicación Daily Questions. Sistema modular para gestionar objetivos, frases inspiracionales y preguntas diarias.

## Requisitos

- Python 3.9+
- SQL Server 2019+ (o compatible)
- pip o conda

## Instalación

### 1. Crear entorno virtual

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Configurar base de datos

Copiar `.env.example` a `.env` y configurar:

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales de SQL Server:

```
DB_SERVER=your_server_name
DB_NAME=DailyQuestions
DB_USER=your_username
DB_PASSWORD=your_password
DB_DRIVER=ODBC Driver 17 for SQL Server
```

**Nota:** Si usas Windows Authentication, dejar USER y PASSWORD vacíos.

### 4. Inicializar base de datos

```bash
# Crear tablas
python -m app.seed
```

## Ejecutar aplicación

```bash
# Desarrollo (con auto-reload)
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Producción
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

La API estará disponible en `http://localhost:8000`

## Documentación

- **OpenAPI/Swagger:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Health check:** http://localhost:8000/health

## Estructura del proyecto

```
backend/
├── app/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── goals.py          # Endpoints de objetivos
│   │   │   ├── phrases.py        # Endpoints de frases
│   │   │   └── questions.py      # Endpoints de preguntas
│   │   └── __init__.py
│   ├── db/
│   │   ├── database.py           # Configuración y sesiones
│   │   └── __init__.py
│   ├── models/
│   │   ├── models.py             # Modelos SQLAlchemy
│   │   └── __init__.py
│   ├── schemas/
│   │   ├── schemas.py            # Esquemas Pydantic
│   │   └── __init__.py
│   ├── services/
│   │   ├── goal_service.py       # Lógica de objetivos
│   │   ├── phrase_service.py     # Lógica de frases
│   │   ├── question_service.py   # Lógica de preguntas
│   │   └── __init__.py
│   ├── config.py                 # Configuración centralizada
│   ├── seed.py                   # Script de seed inicial
│   └── __init__.py
├── main.py                       # Punto de entrada
├── requirements.txt              # Dependencias
├── .env.example                  # Variables de entorno (ejemplo)
└── README.md                     # Este archivo
```

## Módulos API

### Goals (Objetivos)

```
POST   /api/goals                    # Crear objetivo
GET    /api/goals                    # Listar objetivos (con filtros)
GET    /api/goals/{goal_id}          # Obtener objetivo
PATCH  /api/goals/{goal_id}          # Actualizar objetivo
DELETE /api/goals/{goal_id}          # Eliminar objetivo
PATCH  /api/goals/{goal_id}/focus    # Actualizar tiempo de focus
```

### SubGoals (Subobjetivos)

```
POST   /api/goals/{goal_id}/subgoals           # Crear subobjetivo
PATCH  /api/subgoals/{subgoal_id}              # Actualizar subobjetivo
DELETE /api/subgoals/{subgoal_id}              # Eliminar subobjetivo
PATCH  /api/subgoals/{subgoal_id}/focus       # Actualizar tiempo de focus
```

### Phrases (Frases)

```
GET    /api/phrases                    # Listar frases (con filtros)
POST   /api/phrases                    # Crear frase
PATCH  /api/phrases/{phrase_id}        # Actualizar frase
DELETE /api/phrases/{phrase_id}        # Eliminar frase
POST   /api/phrases/{phrase_id}/review # Registrar review
```

### Phrase Categories (Categorías de frases)

```
GET    /api/phrases/categories             # Listar categorías
POST   /api/phrases/categories             # Crear categoría
PATCH  /api/phrases/categories/{id}        # Actualizar categoría
DELETE /api/phrases/categories/{id}        # Eliminar categoría
```

### Phrase Subcategories (Subcategorías de frases)

```
GET    /api/phrases/subcategories              # Listar subcategorías
POST   /api/phrases/subcategories              # Crear subcategoría
PATCH  /api/phrases/subcategories/{id}        # Actualizar subcategoría
DELETE /api/phrases/subcategories/{id}        # Eliminar subcategoría
```

### Questions (Preguntas diarias)

```
GET    /api/questions                    # Listar preguntas
POST   /api/questions                    # Crear pregunta
GET    /api/questions/{question_id}      # Obtener pregunta
PATCH  /api/questions/{question_id}      # Actualizar pregunta
DELETE /api/questions/{question_id}      # Eliminar pregunta
```

### Daily Sessions (Sesiones diarias)

```
GET    /api/daily-sessions/{date}             # Obtener sesión del día
POST   /api/daily-sessions/{date}/responses   # Guardar respuestas
```

## Filtros y paginación

La mayoría de endpoints que retornan listas soportan:

- `page` (par defecto 1)
- `page_size` (por defecto 10, máximo 100)

Ejemplo:

```
GET /api/goals?category=daily&completed=false&page=1&page_size=20
```

## Convenciones

- **Fechas:** Formato ISO 8601 `YYYY-MM-DD`
- **Timestamps:** Formato ISO 8601 con zona horaria
- **IDs:** Strings (UUIDs v4)
- **Respuestas:** JSON

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| DB_SERVER | Servidor SQL Server | localhost |
| DB_NAME | Nombre de la base de datos | DailyQuestions |
| DB_USER | Usuario (opcional) | - |
| DB_PASSWORD | Contraseña (opcional) | - |
| DB_DRIVER | Driver ODBC | ODBC Driver 17 for SQL Server |
| DEBUG | Modo debug | False |

## Mejoras futuras

- Autenticación y roles
- Estadísticas y progreso
- Soporte para medios (audios, imágenes)
- Notificaciones
- Exportación de datos
- Backup automático

## Troubleshooting

### Conexión a SQL Server

Si hay problemas de conexión:

1. Verificar que SQL Server esté corriendo
2. Verificar credenciales en `.env`
3. Verificar que el driver ODBC esté instalado: `odbc_driver_list()`
4. En Windows, probar Windows Authentication (dejar USER/PASSWORD vacíos)

### CORS

Para desarrollo local, CORS está permitido desde cualquier origen. En producción, actualizar:

```python
# main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://tu-dominio.com"],
    ...
)
```

## Licencia

MIT

## Contacto

Para preguntas o reportar bugs, contactar al equipo de desarrollo.
