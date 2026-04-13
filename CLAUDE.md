# Daily Questions — Contexto para Claude Code

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind + Radix UI + TanStack Query |
| Backend | FastAPI (Python) + SQLAlchemy |
| Base de datos | SQL Server (local, Windows Auth por defecto) |
| Tests frontend | Vitest |

## Puertos

- Frontend: `8081`
- Backend: `3001`

## Arrancar el proyecto

```bash
# Backend (desde ./backend/)
python main.py

# Frontend (desde raíz)
npm run dev -- --port 8081 --strictPort
```

## Estructura clave

```
backend/
  main.py                  # Punto de entrada FastAPI
  app/
    config.py              # Settings desde .env (DB, email, debug)
    api/routes/            # goals, subgoals, phrases, questions, reports
    models/models.py       # Modelos SQLAlchemy
    schemas/schemas.py     # Schemas Pydantic
    services/              # Lógica de negocio por dominio
    db/database.py         # Conexión SQL Server
src/                       # Frontend React
docs/proyect/              # Contratos API y guías de ejecución
```

## Convenciones

- API base URL: `http://localhost:3001/api`
- Fechas: ISO 8601 (`YYYY-MM-DD`)
- IDs: UUID o string (consistente en todo el backend)
- Sin autenticación por ahora (esquema preparado para `user_id` futuro)
- CORS: `allow_origins=["*"]` (desarrollo local)
- Zona horaria del scheduler: `America/Bogota`

## Base de datos

- Motor: SQL Server local, database `DailyQuestions`
- Auth: Windows Authentication por defecto (sin usuario/password en `.env`)
- Driver: `ODBC Driver 17 for SQL Server`

## Funcionalidades principales

- Objetivos (`goals`) con subobjetivos (`subgoals`)
- Frases con categorías y subcategorías
- Preguntas diarias (text, select, checkbox, radio) y sesiones de respuestas
- Informe semanal por email (Gmail SMTP, cada lunes 7 AM via APScheduler)

## Verificación rápida

```bash
curl -s "http://localhost:3001/health"
# → {"status":"ok","service":"daily-questions-api"}
```

## Variables de entorno

Hay dos `.env` separados, **no se pisan**:

| Archivo | Para quién | Qué contiene |
|---|---|---|
| `backend/.env` | FastAPI | DB_SERVER, DB_NAME, GMAIL_*, DEBUG |
| `.env` (raíz) | Vite (frontend) | `VITE_API_URL` |

`VITE_API_URL` por defecto es `http://localhost:3001/api`. Cambiarlo solo cuando se use un túnel o servidor remoto.

## Reglas de conducta

- Antes de recomendar herramientas o servicios externos, listar TODOS
  los requisitos (costos, prerrequisitos, limitaciones) antes de que
  el usuario tome una decisión.
- No dar recomendaciones a medias. Si no estoy seguro de todos los
  requisitos de una opción, investigar primero antes de sugerirla.
- Cuando el usuario use terminología imprecisa para referirse a elementos
  de UI (ej: "cuadrito de al lado" → sidebar, "cajita de arriba" → navbar,
  "el popup" → modal/dialog), corregirle el término correcto antes de
  proceder con la tarea.
- Ningun commit puede llevar que fue co autorizado por Claude, ninguno.

## Skills obligatorios — aplicar SIEMPRE
Antes de escribir cualquier código, consultar y aplicar las reglas de los skills instalados según el área:

| Área | Skills a aplicar |
|------|-----------------|
| Componentes React | `vercel-react-best-practices`, `vercel-composition-patterns` |
| Clases CSS / UI | `tailwind-css-patterns`, `tailwind-v4-shadcn` |
| Componentes shadcn/ui | `shadcn` |
| Tipos TypeScript | `typescript-advanced-types` |
| Tests con Vitest | `vitest` |

> Skills eliminados por irrelevantes: `seo`, `accessibility`, `bun`, `vite`, `frontend-design`, `nodejs-backend-patterns`, `nodejs-best-practices` (backend es Python/FastAPI, no Node.js).

**No es opcional.** Si tocás un componente React, aplicás los skills de React. Si escribís o modificás tests, aplicás `vitest`. Sin excepción.

## Git

No hacer `git commit` ni `git push` a menos que el usuario lo pida explícitamente.

## Convención de documentación

Los archivos `.md` de documentación del proyecto van en `docs/proyect/`. No crear archivos `.md` en la raíz ni en otras carpetas salvo que el usuario lo pida explícitamente.

## Docs de referencia

- Contrato API completo: `docs/proyect/backend-contrato-fastapi.md`
- Guía de ejecución local: `docs/proyect/guia-ejecucion-local.md`
