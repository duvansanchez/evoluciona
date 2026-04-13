"""
Punto de entrada de la aplicación FastAPI.
"""
import sys
import logging

# Configurar logging antes de cualquier importación
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

print("[1] Iniciando importaciones...", flush=True)

try:
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    print("[OK] FastAPI importado", flush=True)

    from fastapi.middleware.cors import CORSMiddleware
    print("[OK] CORS middleware importado", flush=True)
    
    from app.config import settings
    print("[OK] Config importada", flush=True)
    
    from app.api import api_router
    print("[OK] API router importado", flush=True)

    from app.services.report_scheduler_service import initialize_scheduler
    print("[OK] Scheduler service importado", flush=True)

    # Importar modelos para que se registren en Base.metadata antes de create_all
    import app.models.models  # noqa: F401
    import app.models.subgoal  # noqa: F401
    from app.db.database import init_db, get_engine
    init_db()
    print("[OK] Tablas de BD verificadas/creadas", flush=True)

    # Migraciones: agregar columnas si no existen
    try:
        from sqlalchemy import text
        with get_engine().connect() as conn:
            conn.execute(text("""
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'review_plans') AND name = N'config'
                )
                ALTER TABLE review_plans ADD config NVARCHAR(MAX) NULL
            """))
            conn.execute(text("""
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'rutina_asignaciones') AND name = N'objetivo_ids'
                )
                ALTER TABLE rutina_asignaciones ADD objetivo_ids NVARCHAR(MAX) NULL
            """))
            conn.execute(text("""
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'subobjetivos') AND name = N'folder_id'
                )
                ALTER TABLE subobjetivos ADD folder_id INT NULL
            """))
            conn.execute(text("""
                IF OBJECT_ID(N'objetivo_saltado_dias', N'U') IS NULL
                CREATE TABLE objetivo_saltado_dias (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    objetivo_id INT NOT NULL,
                    fecha NVARCHAR(10) NOT NULL,
                    fecha_creacion DATETIME NULL,
                    CONSTRAINT uq_objetivo_saltado_dia UNIQUE (objetivo_id, fecha),
                    CONSTRAINT fk_objetivo_saltado_dias_objetivo
                        FOREIGN KEY (objetivo_id) REFERENCES objetivos(id) ON DELETE CASCADE
                )
            """))
            conn.execute(text("""
                IF OBJECT_ID(N'objetivo_completado_dias', N'U') IS NULL
                CREATE TABLE objetivo_completado_dias (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    objetivo_id INT NOT NULL,
                    fecha NVARCHAR(10) NOT NULL,
                    fecha_creacion DATETIME NULL,
                    CONSTRAINT uq_objetivo_completado_dia UNIQUE (objetivo_id, fecha),
                    CONSTRAINT fk_objetivo_completado_dias_objetivo
                        FOREIGN KEY (objetivo_id) REFERENCES objetivos(id) ON DELETE CASCADE
                )
            """))
            conn.execute(text("""
                IF OBJECT_ID(N'question_feedback', N'U') IS NULL
                CREATE TABLE question_feedback (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    question_id INT NOT NULL,
                    fecha NVARCHAR(10) NOT NULL,
                    texto NVARCHAR(MAX) NOT NULL,
                    fecha_creacion DATETIME NULL,
                    fecha_actualizacion DATETIME NULL,
                    CONSTRAINT uq_question_feedback_question_date UNIQUE (question_id, fecha),
                    CONSTRAINT fk_question_feedback_question
                        FOREIGN KEY (question_id) REFERENCES question(id) ON DELETE CASCADE
                )
            """))
            conn.execute(text("""
                IF OBJECT_ID(N'question_skip_days', N'U') IS NULL
                CREATE TABLE question_skip_days (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    question_id INT NOT NULL,
                    fecha NVARCHAR(10) NOT NULL,
                    fecha_creacion DATETIME NULL,
                    CONSTRAINT uq_question_skip_day_question_date UNIQUE (question_id, fecha),
                    CONSTRAINT fk_question_skip_day_question
                        FOREIGN KEY (question_id) REFERENCES question(id) ON DELETE CASCADE
                )
            """))
            conn.execute(text("""
                IF OBJECT_ID(N'frase_repaso_logs', N'U') IS NULL
                CREATE TABLE frase_repaso_logs (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    phrase_id INT NOT NULL,
                    review_plan_id INT NULL,
                    session_label NVARCHAR(255) NULL,
                    reviewed_at DATETIME NOT NULL,
                    review_date NVARCHAR(10) NOT NULL,
                    CONSTRAINT fk_frase_repaso_logs_phrase
                        FOREIGN KEY (phrase_id) REFERENCES frases(id) ON DELETE CASCADE,
                    CONSTRAINT fk_frase_repaso_logs_plan
                        FOREIGN KEY (review_plan_id) REFERENCES review_plans(id) ON DELETE SET NULL
                )
            """))
            conn.execute(text("""
                IF OBJECT_ID(N'frase_audio_preferencias', N'U') IS NULL
                CREATE TABLE frase_audio_preferencias (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    selected_voice_name NVARCHAR(255) NULL,
                    rate FLOAT NOT NULL DEFAULT 1.0,
                    pitch FLOAT NOT NULL DEFAULT 1.0,
                    pause_ms INT NOT NULL DEFAULT 700,
                    fecha_actualizacion DATETIME NULL
                )
            """))
            conn.execute(text("""
                IF OBJECT_ID(N'weekly_conclusions', N'U') IS NULL
                CREATE TABLE weekly_conclusions (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    week_start NVARCHAR(10) NOT NULL,
                    week_end NVARCHAR(10) NOT NULL,
                    content NVARCHAR(MAX) NOT NULL,
                    created_at DATETIME NULL,
                    updated_at DATETIME NULL,
                    CONSTRAINT uq_weekly_conclusions_week_start UNIQUE (week_start)
                )
            """))
            conn.commit()
        print("[OK] Migraciones verificadas", flush=True)
    except Exception as mig_err:
        print(f"[WARN] Migracion omitida: {mig_err}", flush=True)

except Exception as e:
    print(f"[ERROR] Error en importaciones: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("[2] Creando aplicacion FastAPI...", flush=True)

# Crear aplicación
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="API para Daily Questions - Gestión de objetivos, frases y preguntas diarias"
)

print("[3] Configurando CORS...", flush=True)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Handler global: garantiza headers CORS incluso en respuestas de error 500
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers={"Access-Control-Allow-Origin": "*"},
    )

print("[4] Incluyendo routers...", flush=True)

# Incluir rutas
app.include_router(api_router)

print("[5] Registrando endpoints de salud...", flush=True)

@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "daily-questions-api"}


@app.get("/docs-redirect")
def docs_redirect():
    """Redirección a documentación OpenAPI."""
    return {"docs": "/docs", "redoc": "/redoc"}


print("[OK] Aplicacion FastAPI configurada exitosamente", flush=True)


# ---------------------------------------------------------------------------
# Scheduler: envia el informe semanal cada lunes a las 7:00 AM
# ---------------------------------------------------------------------------

def _scheduled_weekly_report():
    """Job que corre el scheduler: genera y envia el informe de la semana anterior."""
    try:
        from app.db.database import get_session_factory
        from app.services.stats_service import get_previous_week_range, build_weekly_report
        from app.services.email_service import build_html_report, send_weekly_report
        from app.services.report_scheduler_service import record_report_event

        session_factory = get_session_factory()
        db = session_factory()
        try:
            week_start, week_end = get_previous_week_range()
            data = build_weekly_report(db, week_start, week_end)
            html = build_html_report(data)
            subject = f"Informe Semanal - {data['week_label']}"
            ok = send_weekly_report(html, subject)
            if ok:
                record_report_event(
                    report_type="weekly_previous",
                    status="sent",
                    week_label=data["week_label"],
                    source="automatic",
                    details={
                        "days_completed": data["days_completed"],
                        "total_responses": data["total_responses"],
                    },
                )
                logger.info(f"[Scheduler] Informe enviado: {data['week_label']}")
            else:
                record_report_event(
                    report_type="weekly_previous",
                    status="failed",
                    week_label=data["week_label"],
                    source="automatic",
                    details={
                        "days_completed": data["days_completed"],
                        "total_responses": data["total_responses"],
                    },
                )
                logger.error("[Scheduler] Error enviando el informe semanal")
        finally:
            db.close()
    except Exception as exc:
        logger.error(f"[Scheduler] Error en job semanal: {exc}", exc_info=True)


scheduler_state = initialize_scheduler(_scheduled_weekly_report)
cfg = scheduler_state["config"]
if cfg["enabled"]:
    logger.info(
        f"[Scheduler] Iniciado - informe semanal {cfg['day_of_week']} {cfg['hour']:02d}:{cfg['minute']:02d} "
        f"({scheduler_state['timezone']})"
    )
else:
    logger.info("[Scheduler] Iniciado en modo deshabilitado")

# Recordatorios diarios
try:
    from app.services.reminder_service import sync_reminder_jobs
    sync_reminder_jobs()
    logger.info("[Reminder] Jobs de recordatorios sincronizados")
except Exception as rem_err:
    logger.warning(f"[Reminder] No se pudieron inicializar los jobs: {rem_err}")


if __name__ == "__main__":
    import uvicorn
    
    print("\n" + "="*60, flush=True)
    print("INICIANDO SERVIDOR FASTAPI", flush=True)
    print("="*60, flush=True)
    print("URL: http://0.0.0.0:3001", flush=True)
    print("Documentacion: http://localhost:3001/docs", flush=True)
    print("="*60 + "\n", flush=True)
    
    try:
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=3001,
            reload=settings.DEBUG,
            log_level="info",
            access_log=True
        )
    except KeyboardInterrupt:
        print("\nServidor detenido por el usuario", flush=True)
    except Exception as e:
        print(f"[ERROR] Error al ejecutar servidor: {e}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)
