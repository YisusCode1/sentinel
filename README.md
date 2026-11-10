# 🛡️ Sentinel — AI Agent Security Infrastructure

**Sentinel** es una infraestructura de seguridad en tiempo real para agentes autónomos en Web3 y blockchain. Combina un **Motor de Políticas Determinista** (la única autoridad para aprobar o rechazar transacciones) con un **Asesor de Riesgo basado en IA (Google Gemini)** para detectar anomalías contextuales y comportamientos sospechosos antes de la ejecución de operaciones.

---

## 🚀 Arquitectura del Sistema

El ecosistema Sentinel está compuesto por 4 servicios desacoplados y contenerizados:

```
┌─────────────────────────────────────────────────────────────┐
│                      Navegador Web                          │
│               Frontend (React 19 + TypeScript)              │
│                     http://localhost:5173                   │
└──────────────────────────────┬──────────────────────────────┘
                               │  Peticiones HTTP públicas
                               │  Header: X-API-Key (en memoria)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               Backend API Gateway (FastAPI)                 │
│                     http://localhost:8001                   │
│                                                             │
│  • Resuelve identidad del agente desde X-API-Key            │
│  • Valida permisos de políticas en base de datos            │
│  • Orquesta evaluación (IA -> Policy Engine -> Auditoría)   │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
 Red Docker    │ HTTP /analyze                │ PostgreSQL
 interna       │ Header: X-Internal-Key       │ psycopg v3
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      AI Engine (FastAPI)     │ │   Base de Datos Relacional  │
│    http://ai-engine:8002     │ │   PostgreSQL 16 Alpine      │
│                              │ │   localhost:5432            │
│ • Google Gemini (2.5 Flash)  │ │                             │
│ • Sanitizador de prompts     │ │ • Tablas: agents,           │
│ • Score consultivo (0-100)   │ │   agent_api_keys,           │
│ • Fallback a 'unknown'       │ │   policies, operations      │
└──────────────────────────────┘ └────────────────────────────┘
```

---

## 📋 Novedades y Contrato de Conectividad (v3.0)

1. **Autenticación Estricta por `X-API-Key`**:
   - El frontend ya no envía `agent_id` en el cuerpo de la petición. El backend extrae la identidad del agente directamente de la cabecera `X-API-Key`.
   - Se configuró Pydantic con `extra="forbid"`, rechazando cualquier campo no autorizado con código `422`.
   - Cero persistencia insegura: las credenciales nunca se guardan en `localStorage` ni en variables públicas del bundle.
2. **Policy Engine como Autoridad Absoluta**:
   - La IA de Gemini funciona estrictamente como un **asesor de riesgo**.
   - Solo el **Policy Engine** aprueba (`approved`) o rechaza (`rejected`) operaciones evaluando límites de monto, listas blancas de destinatarios, tokens y operaciones permitidas.
3. **Fallback Resiliente de IA (`unknown`)**:
   - Si el microservicio `ai-engine` falla, no tiene clave configurada o sufre un timeout, el backend captura la excepción y retorna un análisis seguro con estado `unknown`, permitiendo que el Policy Engine decida basándose en las reglas deterministas sin interrumpir el servicio.
4. **Cero Simulación Blockchain & Sin Idempotencia CORS**:
   - Se eliminaron las firmas criptográficas y verificaciones simuladas.
   - Se eliminó el uso de `Idempotency-Key`, permitiendo una comunicación CORS limpia con las cabeceras `["X-API-Key", "Content-Type"]`.

---

## ⚡ Despliegue en 1 Solo Clic (Docker Compose)

### Requisitos Previos
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y en ejecución.
- Clave de API de Google Gemini (obtenida gratis en [Google AI Studio](https://aistudio.google.com/)).

### Pasos de Inicio Rápido

1. **Configurar Variables de Entorno**:
   Copia el archivo de ejemplo en la raíz del proyecto:
   ```bash
   cp .env.example .env
   ```
   Abre `.env` y coloca tu API Key de Gemini:
   ```env
   GEMINI_API_KEY=tu_clave_real_de_gemini_aqui
   INTERNAL_SERVICE_KEY=sentinel_secret_hackathon_2026
   VITE_API_BASE_URL=http://localhost:8001
   ```

2. **Ejecutar el Comando Maestro**:
   - **En Windows**: Haz doble clic en `start.bat` o ejecuta en la terminal:
     ```cmd
     start.bat
     ```
   - **En Linux / macOS / Terminal**:
     ```bash
     docker compose up --build
     ```

Docker Compose levantará automáticamente los 4 servicios con sus respectivas dependencias y healthchecks.

---

## 🌐 Matriz de Puertos y Red

| Servicio | Contenedor | Red Interna Docker | Puerto Expuesto en Host | Healthcheck Endpoint |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend UI** | `sentinel-frontend` | `http://frontend:5173` | **`http://localhost:5173`** | `GET /` |
| **Backend API** | `sentinel-backend` | `http://backend:8000` | **`http://localhost:8001`** | `GET /api/v1/health` |
| **AI Engine** | `sentinel-ai-engine` | `http://ai-engine:8002` | **`http://localhost:8002`** | `GET /health` |
| **Base de Datos** | `sentinel-db` | `db:5432` | `localhost:5432` | `pg_isready` |

---

## 🩺 Verificación de Salud (Healthchecks)

Puedes certificar que los microservicios están vivos y respondiendo ejecutando estos 3 comandos:

```bash
# 1. Verificar AI Engine (Puerto 8002)
curl -s http://localhost:8002/health

# 2. Verificar Backend Gateway (Puerto 8001)
curl -s http://localhost:8001/api/v1/health

# 3. Verificar Frontend (Puerto 5173)
curl -I http://localhost:5173/
```

---

## 🎮 Guía de Prueba para Evaluadores y Jurados

1. **Abrir la Aplicación**:
   Accede a [http://localhost:5173](http://localhost:5173) en tu navegador.

2. **Ingresar la API Key del Agente**:
   Dirígete a la pestaña **Configuración** e introduce la clave del agente de demostración precargada:
   ```text
   sntl_live_Pc_iquErpgMzgQfXTRtX9XYtyqhDh6KeBkhUKMgB4YA
   ```
   *(La clave se guardará en memoria volátil de tu sesión de navegador).*

3. **Ejecutar Casos de Demostración a 1 Clic**:
   Ve a la pestaña **Operaciones**. Encontrarás una barra con 4 escenarios listos para probar:
   - 🟢 **Legítima**: Transferencia permitida de USDC que cumple todas las reglas (evaluada y aprobada con score bajo de riesgo).
   - 🔴 **Exceso de Límite**: Intento de transferir un monto superior al límite de la política (rechazado por el Policy Engine).
   - 🟡 **Destinatario Sospechoso**: Destinatario no incluido en la lista blanca de la política (rechazado inmediatamente).
   - 🟣 **Operación No Permitida**: Llamada a métodos o contratos no autorizados (ej. swap o stake no habilitado).

4. **Inspección de Resultados**:
   - **Pipeline de Seguridad**: Observa el recorrido visual (*Autenticación* $\rightarrow$ *Policy Engine* $\rightarrow$ *Asesor de IA*).
   - **Medidor Radial de Riesgo (0-100)**: Visualiza el puntaje de anomalía y la justificación generada por Gemini.
   - **Explorador NEAR**: Haz clic en los enlaces a cuentas de NEAR testnet para verificar su formato.

---

## 🛠️ Ejecución Local Alternativa (Sin Docker)

Si prefieres ejecutar los servicios directamente en tu máquina local:

```bash
# 1. AI Engine (Terminal 1)
cd ai-engine
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload

# 2. Backend (Terminal 2 - SQLite local automático)
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 3. Frontend (Terminal 3)
cd frontend
npm run dev
```

*(Si corres el backend en el puerto 8000, recuerda configurar `VITE_API_BASE_URL=http://localhost:8000` en `frontend/.env`).*

---

## 🧪 Pruebas Automatizadas

El proyecto cuenta con un 100% de éxito en sus suites de tests automatizados:

```bash
# Ejecutar tests del Frontend (24 pruebas)
npm --prefix frontend test

# Ejecutar tests del Backend (9 pruebas de integración y seguridad)
python -m unittest discover -s backend/tests -p "test_*.py"
```

---

## 📄 Licencia
Proyecto desarrollado para el Hackathon Sentinel 2026. Licencia MIT.
