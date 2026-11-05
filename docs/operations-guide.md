# Operaciones: ejecución y comprobación

Los cambios se desarrollan en `prototipo-frontend-2.0`.

## Inicio local (PowerShell, desde la raíz)

Primera vez:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
```

Terminal del backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8001 --reload
```

Terminal del frontend:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1
```

Abrir `http://localhost:5173` y entrar en **Operaciones**. Si Vite elige otro puerto, el origen deberá añadirse a `CORS_ORIGINS` antes de arrancar el backend. Para Docker: `docker compose up --build`; frontend en `http://localhost:5174`, API en `http://localhost:8001` y almacenamiento PostgreSQL.

## Flujo funcional

1. Crear una política desde **Nueva política**: nombre `Tesorería`, máximo `100`, token `USDC`, operación `transfer`, destinatario `treasury.testnet`. La política se guarda y queda seleccionada.
2. Introducir agente `sentinel-agent`, monto `40`, destinatario `treasury.testnet` y pulsar **Evaluar operación**. Debe aprobarse por política y aparecer en el historial.
3. Cambiar monto a `150` y evaluar. Debe rechazarse por el control de monto. Las dos evaluaciones quedan persistidas.
4. Cambiar solo el token, destinatario o tipo por un valor no permitido. El control correspondiente debe fallar.
5. Usar búsqueda, decisión y fechas UTC; pulsar **Aplicar filtros**. Los indicadores reflejan todos los resultados filtrados; la tabla muestra la página actual.
6. Abrir un detalle con la flecha de su fila. Se consultan el resultado y la copia de la política utilizada. **Exportar página CSV** descarga solo las filas visibles.
7. Recargar la página o reiniciar el backend. Las políticas y operaciones permanecen almacenadas.

La interfaz distingue carga, errores de validación/conexión, historial vacío y búsqueda sin coincidencias. Los errores no se reemplazan con datos de demostración. Los reintentos de evaluación sin respuesta conservan la clave de idempotencia mientras se mantenga el mismo envío en esta sesión. Si se recarga la aplicación tras perder una respuesta, consultar primero el historial.

Los controles se evalúan por el backend. El frontend valida el formato, pero no decide el resultado. IA, firma y verificación blockchain aparecen como no disponibles/no realizadas. No hay botón de ejecución o firma porque el backend no dispone de esas funciones.

## Pruebas

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v
cd frontend
npm.cmd test
npm.cmd run build
npm.cmd run lint
```

Las pruebas de API crean bases temporales; no alteran los registros de la aplicación. Cubren decimales exactos, validación, rechazos por cada regla, historial y filtros, persistencia entre instancias, CORS e idempotencia concurrente. Las pruebas del frontend cubren la capa HTTP, construcción de consultas, validación decimal y exportación CSV con protección frente a fórmulas.
