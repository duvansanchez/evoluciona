#!/bin/bash
# Script para instalar y ejecutar el backend en desarrollo

set -e

echo "=========================================="
echo "Daily Questions API - Setup Script"
echo "=========================================="
echo ""

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 no está instalado"
    exit 1
fi

echo "✓ Python 3 encontrado"
echo ""

# Crear entorno virtual si no existe
if [ ! -d "venv" ]; then
    echo "Creando entorno virtual..."
    python3 -m venv venv
    echo "✓ Entorno virtual creado"
else
    echo "✓ Entorno virtual ya existe"
fi

echo ""

# Activar entorno virtual
source venv/bin/activate
echo "✓ Entorno virtual activado"
echo ""

# Instalar dependencias
echo "Instalando dependencias..."
pip install -q -r requirements.txt
echo "✓ Dependencias instaladas"
echo ""

# Configurar .env si no existe
if [ ! -f ".env" ]; then
    echo "Creando archivo .env..."
    cp .env.example .env
    echo "⚠ Edita .env con tus credenciales de SQL Server"
fi

echo ""
echo "=========================================="
echo "Setup completo!"
echo "=========================================="
echo ""
echo "Para iniciar el servidor:"
echo "  python -m uvicorn main:app --reload"
echo ""
echo "Documentación OpenAPI:"
echo "  http://localhost:8000/docs"
echo ""
