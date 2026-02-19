# Guía de Desarrollo - Backend FastAPI

## Visión General

Este backend está diseñado con una arquitectura modular y limpia:

- **Capas separadas:** DB, Servicios, API
- **Sin monolito:** Cada módulo es independiente
- **Escalable:** Fácil agregar nuevos módulos
- **Testeable:** Servicios desacoplados de rutas
- **SQL Server:** Integrado con base de datos existente

## Principios de Arquitectura

### 1. Capas

```
API (routes) → Servicios → Modelos ORM → Base de Datos
     ↓
  Schemas (Pydantic)
```

**API (routes):**
- Endpoints FastAPI
- Validación de entrada vía Pydantic
- Errores HTTP apropiados

**Servicios:**
- Lógica de negocios
- Interacción con BD vía SQLAlchemy
- Reutilizable en múltiples endpoints

**Modelos ORM:**
- Mapeo a tablas SQL Server
- Definición de relaciones
- Constraints y validaciones DB

**Schemas Pydantic:**
- Validación de requests
- Serialización de responses
- Documentación automática

### 2. Estructura de Carpetas

```
app/
├── api/routes/              # Endpoints organizados por módulo
│   ├── goals.py            # CRUD de objetivos
│   ├── phrases.py          # CRUD de frases
│   └── questions.py        # CRUD de preguntas
├── db/                     # Configuración de BD
│   └── database.py
├── models/                 # Modelos SQLAlchemy
│   └── models.py
├── schemas/                # Esquemas Pydantic
│   └── schemas.py
├── services/               # Lógica de negocios
│   ├── goal_service.py
│   ├── phrase_service.py
│   └── question_service.py
├── config.py              # Variables de configuración
└── seed.py                # Seed inicial de datos
```

## Convenciones de Código

### Naming

```python
# Clases
class GoalService:       # PascalCase para clases
class PhraseCategoryCreate:  # Esquemas Pydantic

# Funciones/métodos
def create_goal():       # snake_case
def get_goals():

# Variables
goal_id = "uuid"         # snake_case
category_name = "Work"   # snake_case

# Constantes
MAX_PAGE_SIZE = 100      # UPPER_SNAKE_CASE
DEFAULT_PAGE = 1
```

### Docstrings

```python
def create_goal(db: Session, goal: GoalCreate) -> Goal:
    """
    Crear nuevo objetivo.
    
    Args:
        db: Sesión de base de datos
        goal: Datos del objetivo a crear
    
    Returns:
        Goal: Objetivo recién creado
    
    Raises:
        ValueError: Si los datos son inválidos
    """
```

## Agregar un Nuevo Módulo

### Ejemplo: Agregar "Projects"

#### 1. Crear modelo en `app/models/models.py`

```python
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String(36), primary_key=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(String(30), default=...)
    
    # Relaciones
    goals = relationship("Goal")
```

#### 2. Crear schemas en `app/schemas/schemas.py`

```python
class ProjectCreate(BaseModel):
    title: str
    description: Optional[str] = None

class ProjectResponse(ProjectCreate):
    id: str
    created_at: str
    
    class Config:
        from_attributes = True
```

#### 3. Crear servicio en `app/services/project_service.py`

```python
class ProjectService:
    @staticmethod
    def create_project(db: Session, project: ProjectCreate) -> Project:
        db_project = Project(id=str(uuid4()), **project.dict())
        db.add(db_project)
        db.commit()
        db.refresh(db_project)
        return db_project
    
    @staticmethod
    def get_projects(db: Session, page: int = 1, page_size: int = 10):
        query = db.query(Project)
        total = query.count()
        projects = query.offset((page - 1) * page_size).limit(page_size).all()
        return projects, total
```

#### 4. Crear rutas en `app/api/routes/projects.py`

```python
from fastapi import APIRouter, Depends
from app.services.project_service import ProjectService

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.post("", response_model=ProjectResponse)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    return ProjectService.create_project(db, project)

@router.get("")
def list_projects(page: int = 1, db: Session = Depends(get_db)):
    projects, total = ProjectService.get_projects(db, page=page)
    return {"total": total, "items": projects}
```

#### 5. Registrar rutas en `app/api/__init__.py`

```python
from app.api.routes import projects

api_router.include_router(projects.router)
```

## Patrones Comunes

### Paginación

```python
def list_items(
    db: Session,
    page: int = 1,
    page_size: int = 10
) -> Tuple[List[Item], int]:
    query = db.query(Item)
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total

# En endpoint:
items, total = ItemService.list_items(db, page=page, page_size=page_size)
pages = math.ceil(total / page_size)
return {
    "total": total,
    "page": page,
    "page_size": page_size,
    "pages": pages,
    "items": items
}
```

### Filtros

```python
def get_items(
    db: Session,
    status: Optional[str] = None,
    category: Optional[str] = None
) -> List[Item]:
    query = db.query(Item)
    
    if status:
        query = query.filter(Item.status == status)
    if category:
        query = query.filter(Item.category == category)
    
    return query.all()
```

### Timestamps ISO 8601

```python
from datetime import datetime

# Crear
created_at = datetime.utcnow().isoformat()

# En modelo
created_at = Column(String(30), 
    default=lambda: datetime.utcnow().isoformat())

# En actualización
updated_at = datetime.utcnow().isoformat()
```

### Manejo de errores

```python
@router.get("/{item_id}")
def get_item(item_id: str, db: Session = Depends(get_db)):
    item = ItemService.get_item(db, item_id)
    if not item:
        raise HTTPException(
            status_code=404,
            detail="Item not found"
        )
    return item
```

## Testing

### Ejecutar tests

```bash
# Todos
pytest test_api.py -v

# Clase específica
pytest test_api.py::TestGoals -v

# Función específica
pytest test_api.py::TestGoals::test_create_goal -v
```

### Escribir nuevos tests

```python
class TestNewModule:
    def test_create_item(self):
        # Arrange
        item_data = {"title": "Test"}
        
        # Act
        response = client.post("/api/items", json=item_data)
        
        # Assert
        assert response.status_code == 200
        assert response.json()["title"] == "Test"
```

## Debugging

### Logs

```python
import logging

logger = logging.getLogger(__name__)

logger.info(f"Creating goal: {goal.title}")
logger.error(f"Error: {str(e)}", exc_info=True)
```

### Debug mode

En `.env`:

```
DEBUG=True
```

En `main.py`, los logs de SQL se mostrarán.

### Database inspection

```python
# En un endpoint o script
from app.db.database import SessionLocal
from app.models.models import Goal

db = SessionLocal()
goals = db.query(Goal).all()
for goal in goals:
    print(f"{goal.id}: {goal.title}")
db.close()
```

## Performance

### Índices

Agregar en modelos según sea necesario:

```python
class Goal(Base):
    id = Column(String(36), primary_key=True, index=True)
    created_at = Column(String(30), index=True)
    user_id = Column(String(36), ForeignKey("users.id"), index=True)
```

### Lazy loading vs Eager loading

```python
# Lazy (default) - carga relaciones bajo demanda
goals = db.query(Goal).all()
for goal in goals:
    print(goal.subgoals)  # Ejecuta query separada para cada goal

# Eager
from sqlalchemy.orm import joinedload
goals = db.query(Goal).options(joinedload(Goal.subgoals)).all()
```

### Paginación

Siempre paginar listas grandes:

```python
# ✓ Bien
goals = query.offset(0).limit(10).all()

# ✗ Malo - puede cargar miles de registros
goals = query.all()
```

## Deployement (Producción)

### Configuración

1. Crear `.env` con configuración específica:

```
DEBUG=False
DB_SERVER=prod-server
DB_NAME=DailyQuestions_Prod
```

2. Usar CORS restringido:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://tu-dominio.com"],
    ...
)
```

3. Usar Gunicorn en lugar de uvicorn:

```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
```

## Mejoras futuras

- [ ] Caché con Redis
- [ ] Endpoints de búsqueda avanzada
- [ ] Webhooks
- [ ] Rate limiting
- [ ] API versioning (/api/v1/goals)
- [ ] Audit logging
- [ ] Soft deletes para datos importantes
