from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routes import mission, pathfinding

app = FastAPI(
    title="Disaster Response Drone Engine",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pathfinding.router)
app.include_router(mission.router)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "drone-pathfinder"}
