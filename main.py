"""
FastAPI app entrypoint for SCELE Notif Python backend.
All routes are mounted under the /py prefix and /storage prefix.
"""

import os
import sys
from pathlib import Path

# Pastikan direktori ini selalu ada di sys.path agar import routers berjalan mulus
_base_dir = Path(__file__).resolve().parent
if str(_base_dir) not in sys.path:
    sys.path.insert(0, str(_base_dir))

# Fungsi pembaca file .env bawaan (tidak membutuhkan library eksternal)
def _load_env_file(filepath: Path) -> None:
    if not filepath.exists():
        return
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass

for _env_path in [
    _base_dir / ".env",
    _base_dir / ".env.local",
    _base_dir.parent / "scele" / ".env.local",
    _base_dir.parent / ".env",
]:
    _load_env_file(_env_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import (
    auth,
    calendar,
    completion,
    courses,
    events,
    grades,
    storage_api,
    user,
)

app = FastAPI(
    title="SCELE Notif Python Backend (DDP1)",
    description="Python backend untuk SCELE Notif — Moodle integration & storage",
    version="1.0.0",
)

# CORS — allow the Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all Moodle routers with /py prefix
app.include_router(auth.router, prefix="/py", tags=["Auth"])
app.include_router(events.router, prefix="/py", tags=["Events"])
app.include_router(grades.router, prefix="/py", tags=["Grades"])
app.include_router(courses.router, prefix="/py", tags=["Courses"])
app.include_router(calendar.router, prefix="/py", tags=["Calendar"])
app.include_router(completion.router, prefix="/py", tags=["Completion"])
app.include_router(user.router, prefix="/py", tags=["User"])

# Include Storage API for Next.js storage.js integration
app.include_router(storage_api.router, prefix="/storage", tags=["Storage"])
app.include_router(storage_api.router, prefix="/py/storage", tags=["Storage"])


@app.get("/")
async def root():
    return {
        "project": "SCELE Notif - DDP1 Python Backend",
        "status": "running",
        "docs": "/docs",
        "endpoints": [
            "/py/auth",
            "/py/events",
            "/py/grades",
            "/py/courses/{courseId}/contents",
            "/py/calendar",
            "/py/completion",
            "/py/user",
            "/storage/users",
            "/storage/subscriptions",
            "/storage/done-events",
        ],
    }


@app.get("/py/health")
async def health():
    return {"status": "ok", "service": "scele-notif-python-ddp1"}
