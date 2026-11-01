from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Sentinel API",
    description="AI Agent Security Infrastructure",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "project": "Sentinel",
        "message": "AI Agent Security Infrastructure",
        "status": "running"
    }

@app.get("/api/v1/health")
def health():
    return {
        "status": "healthy",
        "service": "sentinel-backend"
    }
