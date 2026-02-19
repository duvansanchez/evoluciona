@echo off
REM Script para instalar y ejecutar el backend en desarrollo (Windows)

echo ==========================================
echo Daily Questions API - Setup Script
echo ==========================================
echo.

REM Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python no esta instalado o no esta en PATH
    exit /b 1
)

echo ^✓ Python encontrado
echo.

REM Crear entorno virtual si no existe
if not exist venv (
    echo Creando entorno virtual...
    python -m venv venv
    echo ^✓ Entorno virtual creado
) else (
    echo ^✓ Entorno virtual ya existe
)

echo.

REM Activar entorno virtual
call venv\Scripts\activate.bat
echo ^✓ Entorno virtual activado
echo.

REM Instalar dependencias
echo Instalando dependencias...
pip install -q -r requirements.txt
echo ^✓ Dependencias instaladas
echo.

REM Configurar .env si no existe
if not exist .env (
    echo Creando archivo .env...
    copy .env.example .env
    echo ^⚠ Edita .env con tus credenciales de SQL Server
)

echo.
echo ==========================================
echo Setup completo!
echo ==========================================
echo.
echo Para iniciar el servidor:
echo   python -m uvicorn main:app --reload
echo.
echo Documentacion OpenAPI:
echo   http://localhost:8000/docs
echo.
pause
