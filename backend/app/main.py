import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, connect_database
from .routes import router


def create_app(database_url: str | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        url = database_url or os.getenv("DATABASE_URL")
        if not url:
            data_dir = Path(__file__).resolve().parent.parent / "data"
            data_dir.mkdir(exist_ok=True)
            url = f"sqlite:///{(data_dir / 'sentinel.db').as_posix()}"
        engine, session_factory = connect_database(url)
        Base.metadata.create_all(engine)
        app.state.session_factory = session_factory
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(title="Sentinel API", description="AI Agent Security Infrastructure", version="0.2.0", lifespan=lifespan)
    origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174")
    app.add_middleware(CORSMiddleware, allow_origins=[origin.strip() for origin in origins.split(",")], allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Idempotency-Key"])
    app.include_router(router)

    @app.get("/")
    def root():
        return {"project": "Sentinel", "message": "AI Agent Security Infrastructure", "status": "running"}

    @app.get("/api/v1/health")
    def health():
        return {"status": "healthy", "service": "sentinel-backend"}

    return app


app = create_app()
