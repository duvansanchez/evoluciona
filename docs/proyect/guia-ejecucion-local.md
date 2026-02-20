# Guía rápida para correr el proyecto (local)

## 1) Rutas del proyecto

- Raíz del proyecto:
  - `C:\Repositorios\Daily Question Lovable`
- Backend real:
  - `C:\Repositorios\Daily Question Lovable\backend`
- Frontend:
  - `C:\Repositorios\Daily Question Lovable`

## 2) Puertos obligatorios

- Frontend: `8081`
- Backend: `3001`

## 3) Levantar Backend REAL (FastAPI)

### Opción A: Git Bash

```bash
cd "/c/Repositorios/Daily Question Lovable/backend"
python main.py
```

### Opción B: PowerShell

```powershell
cd "C:\Repositorios\Daily Question Lovable\backend"
python main.py
```

## 4) Levantar Frontend (Vite)

### Git Bash / PowerShell

```bash
cd "/c/Repositorios/Daily Question Lovable"
npm run dev -- --port 8081 --strictPort
```

## 5) Verificación rápida

### Backend

```bash
curl -s "http://localhost:3001/health"
```

Respuesta esperada (backend real):

```json
{"status":"ok","service":"daily-questions-api"}
```

### Endpoint frases (debe existir en backend real)

```bash
curl -i "http://localhost:3001/api/phrases?page=1&page_size=5"
```

Respuesta esperada: `HTTP/1.1 200 OK`

### Frontend

Abrir:

- `http://localhost:8081/`

## 6) Si el puerto ya está ocupado (Windows)

### Ver PID en 3001

```powershell
netstat -ano | findstr :3001
```

### Matar proceso

```powershell
taskkill /PID <PID> /F
```

## 7) Modo de prueba (solo si el real falla)

Este modo NO es persistente y NO tiene todas las rutas.

### Git Bash

```bash
cd "/c/Repositorios/Daily Question Lovable/backend"
python mock_server.py
```

Health esperado en mock:

```json
{"status":"ok","mode":"in-memory"}
```

## 8) Orden recomendado cada vez

1. Backend real en 3001
2. Validar `/health`
3. Frontend en 8081
4. Abrir `http://localhost:8081/`
