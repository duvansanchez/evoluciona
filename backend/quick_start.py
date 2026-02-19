#!/usr/bin/env python3
"""
🚀 Backend Daily Questions - Punto de Partida Rápido

Este script ayuda a iniciarse con el backend.
Ejecutar: python quick_start.py
"""

import os
import sys
from pathlib import Path

# Colores para terminal
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header():
    print(f"""
{Colors.BOLD}{Colors.CYAN}
╔═══════════════════════════════════════════════════════╗
║         🚀 DAILY QUESTIONS API - Quick Start          ║
║                    FastAPI Backend                     ║
╚═══════════════════════════════════════════════════════╝
{Colors.ENDC}
    """)

def print_section(title):
    print(f"\n{Colors.BOLD}{Colors.BLUE}▶ {title}{Colors.ENDC}\n")

def print_success(msg):
    print(f"{Colors.GREEN}✓ {msg}{Colors.ENDC}")

def print_info(msg):
    print(f"{Colors.CYAN}ℹ {msg}{Colors.ENDC}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.ENDC}")

def print_error(msg):
    print(f"{Colors.RED}✗ {msg}{Colors.ENDC}")

def check_file_exists(path, name):
    if Path(path).exists():
        print_success(f"{name}")
        return True
    else:
        print_error(f"{name} no encontrado")
        return False

def main():
    print_header()
    
    print_section("📋 Verificación del Proyecto")
    
    files_to_check = [
        ("main.py", "Punto de entrada"),
        ("app/config.py", "Configuración"),
        ("app/models/models.py", "Modelos"),
        ("app/schemas/schemas.py", "Esquemas"),
        ("app/services/goal_service.py", "Servicios"),
        ("app/api/routes/goals.py", "Rutas"),
        ("requirements.txt", "Dependencias"),
        (".env.example", "Template .env"),
    ]
    
    all_good = True
    for file_path, name in files_to_check:
        if not check_file_exists(file_path, name):
            all_good = False
    
    if all_good:
        print_success("Estructura del proyecto completa ✓")
    else:
        print_error("Algunos archivos faltan")
        return
    
    # Verificar Python
    print_section("🐍 Verificación de Python")
    version = sys.version_info
    if version.major >= 3 and version.minor >= 9:
        print_success(f"Python {version.major}.{version.minor} encontrado")
    else:
        print_error(f"Python 3.9+ requerido (tienes {version.major}.{version.minor})")
        return
    
    # Verificar venv
    print_section("📦 Verificación de Entorno Virtual")
    if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        print_success("Entorno virtual activado")
    else:
        print_warning("Entorno virtual no detectado")
        print_info("Crea uno con: python -m venv venv")
        print_info("Luego activa: source venv/bin/activate (Linux/Mac) o venv\\Scripts\\activate (Windows)")
    
    # Verificar .env
    print_section("🔧 Configuración")
    if Path(".env").exists():
        print_success(".env encontrado")
    else:
        print_warning(".env no encontrado")
        print_info("Crea uno con: cp .env.example .env")
        print_info("Luego edita con tus credenciales de SQL Server")
    
    # Menu de opciones
    print_section("🎯 Opciones")
    
    options = [
        ("1", "Instalar dependencias", "pip install -r requirements.txt"),
        ("2", "Crear .env", "cp .env.example .env"),
        ("3", "Inicializar BD", "python -c \"from app.seed import seed_database; seed_database()\""),
        ("4", "Ejecutar servidor", "python -m uvicorn main:app --reload"),
        ("5", "Ejecutar tests", "pytest test_api.py -v"),
        ("6", "Ver documentación", "Ver README.md"),
        ("0", "Salir", ""),
    ]
    
    for code, desc, cmd in options:
        if cmd:
            print(f"  {Colors.BOLD}{code}{Colors.ENDC}. {desc}")
            if cmd != "Ver README.md":
                print(f"     {Colors.CYAN}$ {cmd}{Colors.ENDC}")
        else:
            print(f"  {code}. {desc}")
    
    # Instrucciones finales
    print_section("📚 Documentación")
    
    docs = [
        ("README.md", "Guía de instalación y uso"),
        ("DEVELOPMENT.md", "Guía para desarrolladores"),
        ("ARCHITECTURE.md", "Arquitectura del sistema"),
        ("MIGRATION.md", "Migración de datos legacy"),
        ("CONNECTION_CHECKLIST.md", "Checklist para conectarse a BD"),
        ("ENTREGA.md", "Resumen de lo entregado"),
    ]
    
    for file_name, description in docs:
        if Path(file_name).exists():
            print_success(f"{file_name}: {description}")
    
    print_section("🌐 URLs Importantes")
    
    print(f"  {Colors.BOLD}Servidor:{Colors.ENDC}")
    print(f"    {Colors.CYAN}http://localhost:8000{Colors.ENDC}")
    
    print(f"\n  {Colors.BOLD}Documentación API:{Colors.ENDC}")
    print(f"    {Colors.CYAN}http://localhost:8000/docs{Colors.ENDC} (Swagger UI)")
    print(f"    {Colors.CYAN}http://localhost:8000/redoc{Colors.ENDC} (ReDoc)")
    
    print(f"\n  {Colors.BOLD}Health Check:{Colors.ENDC}")
    print(f"    {Colors.CYAN}GET http://localhost:8000/health{Colors.ENDC}")
    
    # Próximos pasos
    print_section("⚡ Próximos Pasos Recomendados")
    
    steps = [
        "1. Ejecutar: pip install -r requirements.txt",
        "2. Editar: .env (agregar credenciales SQL Server)",
        "3. Ejecutar: python -c \"from app.seed import seed_database; seed_database()\"",
        "4. Ejecutar: python -m uvicorn main:app --reload",
        "5. Visitar: http://localhost:8000/docs",
        "6. Probar endpoints en Swagger UI",
        "7. Conectar frontend React",
    ]
    
    for i, step in enumerate(steps, 1):
        print(f"  {step}")
    
    print_section("✅ Status")
    print(f"{Colors.GREEN}{Colors.BOLD}")
    print("""
╔══════════════════════════════════════════════════╗
║  Backend listo para comenzar desarrollo 🚀      ║  
║  FastAPI + SQLAlchemy + SQL Server              ║
║  Arquitectura moderna y escalable                ║
╚══════════════════════════════════════════════════╝
    """)
    print(Colors.ENDC)
    
    print("Para más información, ver:")
    print(f"  • {Colors.UNDERLINE}README.md{Colors.ENDC} - Documentación completa")
    print(f"  • {Colors.UNDERLINE}DEVELOPMENT.md{Colors.ENDC} - Guía de desarrollo")
    print(f"  • {Colors.UNDERLINE}ARCHITECTURE.md{Colors.ENDC} - Diagrama de arquitectura")
    
    print(f"\n{Colors.YELLOW}¿Necesitas ayuda?{Colors.ENDC}")
    print(f"  1. Lee CONNECTION_CHECKLIST.md para conectarte a BD")
    print(f"  2. Revisa los docstrings en el código")
    print(f"  3. Ejecuta los tests: pytest test_api.py -v")
    
    print(f"\n{Colors.CYAN}¡Listo para empezar! 🎉{Colors.ENDC}\n")

if __name__ == "__main__":
    main()
