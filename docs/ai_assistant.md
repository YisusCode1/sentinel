# Motor de IA y asistente de Sentinel

## Arranque con Docker (PowerShell, desde la carpeta sentinel)

```powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose exec backend python -m app.cli agent create --name sentinel-demo
```

Si `.env` ya existe, conserva su contenido e incorpora las variables de `.env.example`.
La CLI imprime una API key una sola vez. Abre http://localhost:5174, introduce esa
clave y pulsa **Conectar agente**. Pulsa **Crear política demo**, evalúa 40 USDC
(permitida) y 150 USDC (rechazada), y usa **Consultar en el asistente**.
Pregunta: «Explica la decisión y sugiere reglas». Los datos provienen de la base de
ese agente. No se crean agentes ni políticas automáticamente al arrancar.

```powershell
Invoke-RestMethod http://localhost:8002/health
Invoke-RestMethod http://localhost:8001/api/v1/health
docker compose logs --tail 100 ai-engine backend
```

Los puertos publicados están limitados a localhost. El backend usa
`http://ai-engine:8002` dentro de la red de Compose. La base de datos es persistente.
Al iniciar, el backend crea el esquema si la base está vacía o ejecuta Alembic si
ya existe. La revisión `20261111_ai_analysis` agrega una columna JSON nullable y
conserva operaciones previas, que mostrarán «Sin análisis guardado».
La migración histórica anterior es específica de PostgreSQL; no debe ejecutarse
contra bases SQLite antiguas sin versión. La inicialización de SQLite nuevo sí está soportada.

## Proveedor y fallback

- `GEMINI_API_KEY`: clave de Gemini. `LLM_API_KEY` es un alias para la misma clave,
  no una clave OpenAI. Gemini es el proveedor implementado.
  En ejecución local, el motor también lee el `.env` de la raíz del repositorio.
- `GEMINI_MODEL=gemini-3.5-flash-lite`, `GEMINI_TIMEOUT_SECONDS=30`.
- `AI_DEMO_FALLBACK=true`: sin clave, ante clave inválida, timeout o respuesta
  malformada, los endpoints usan heurísticas deterministas marcadas como demo.
  `analysis_available=false` significa que no hubo análisis LLM válido;
  `model_used=deterministic-demo-v1` identifica las heurísticas.
- `AI_DEMO_FALLBACK=false`: devuelve análisis desconocido/chat no disponible.
- `INTERNAL_SERVICE_KEY`: secreto compartido obligatorio backend–motor IA.
  La clave de `.env.example` es exclusivamente para una demo local.
- `AI_ENGINE_TIMEOUT_SECONDS=40`: debe superar el timeout del proveedor.
- `DATABASE_URL` y `POSTGRES_PASSWORD`: mantén ambas credenciales consistentes.
- `VITE_API_BASE_URL`: URL del backend accesible por el navegador; no una URL
  interna de Docker. No se envían claves del proveedor al frontend.

`/health` informa presencia de configuración, modo y fallback. No consume cuota
ni comprueba que el proveedor acepte la clave (`provider_verified=false`).
La biblioteca `analyze_operation[_async]` mantiene su fallback conservador
original; `analyze_for_api` añade la demostración en la capa de servicio HTTP.
El motor de políticas sigue siendo el único responsable de aprobar/rechazar.

## Ejecución local sin Docker

Recomendado Python 3.12 y Node 22. Desde `sentinel`, crea un entorno e instala:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r ai-engine/requirements.txt -r backend/requirements.txt -r requirements-dev.txt
npm.cmd ci --prefix frontend
```

Terminal 1:

```powershell
$env:INTERNAL_SERVICE_KEY='sentinel-local-demo-change-before-deploy'
$env:AI_DEMO_FALLBACK='true'
cd ai-engine
..\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8002
```

Terminal 2 (base SQLite nueva de demostración, distinta de bases existentes):

```powershell
$env:INTERNAL_SERVICE_KEY='sentinel-local-demo-change-before-deploy'
$env:AI_ENGINE_URL='http://localhost:8002'
$env:DATABASE_URL='sqlite:///./sentinel-demo.db'
$env:SENTINEL_ENV='development'
cd backend
..\.venv\Scripts\python.exe -m app.init_db
..\.venv\Scripts\python.exe -m app.cli agent create --name sentinel-demo
..\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8001
```

Terminal 3: `npm.cmd run dev --prefix frontend -- --port 5174`.
Conserva la API key de la terminal 2 para conectar la interfaz.

## Verificación

Ejecutar las suites por separado porque ambos servicios tienen un paquete `app`:

```powershell
cd ai-engine
..\.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider -k 'not live_gemini'
cd ../backend
..\.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
cd ../frontend
npm.cmd run build
npm.cmd run lint
```

Prueba del proveedor real, opcional y con cuota: configura `GEMINI_API_KEY` y ejecuta
`python -m pytest tests/test_analyzer.py -k live_gemini` desde `ai-engine`.
Demo de consola sin red: `python demo_cli.py --mock` en esa misma carpeta.
Los tests de integración usan SQLite aislado y transporte HTTP en proceso con los
endpoints reales; prueban autenticación, aislamiento, persistencia, chat y fallos.
No sustituyen una validación del despliegue PostgreSQL/Docker ni del proveedor real.

## Resultado de verificación local

- Suite IA: 182 tests aprobados; la prueba individual de análisis Gemini real
  también pasó con Gemini 3.5 Flash-Lite y una clave configurada localmente.
- Una consulta real del asistente devolvió `mode=llm`; una llamada previa recibió
  un error transitorio del proveedor y activó el modo demo, como está previsto.
- Backend: 6 tests aprobados, incluyendo migración, aislamiento y un recorrido
  HTTP real entre dos procesos Uvicorn con base SQLite temporal.
- Frontend: `npm run build` y `npm run lint` correctos.
- Docker/PostgreSQL no se ejecutó en este entorno; Docker no estaba disponible.
