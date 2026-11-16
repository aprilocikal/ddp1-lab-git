"""
Storage API Router — /storage/*
Dipakai oleh lib/storage.js (Next.js) saat STORAGE_MODE=python.
Semua endpoint adalah proxy ke services/storage.py (file JSON lokal).
"""
import logging
from typing import Any, Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from services import storage

logger = logging.getLogger(__name__)
router = APIRouter()


# ══════════════════════════════════════════════════════════════════════════════
# User endpoints
# ══════════════════════════════════════════════════════════════════════════════

class SaveUserBody(BaseModel):
    userId: str
    userData: dict


@router.post("/users")
async def save_user(body: SaveUserBody):
    await storage.save_user(body.userId, body.userData)
    return {"success": True}


@router.get("/users")
async def get_all_users():
    data = await storage.get_all_users()
    return {"data": data}


@router.get("/users/{user_id}")
async def get_user(user_id: str):
    data = await storage.get_user(user_id)
    return {"data": data}


# ══════════════════════════════════════════════════════════════════════════════
# Subscription endpoints
# ══════════════════════════════════════════════════════════════════════════════

class SaveSubscriptionBody(BaseModel):
    userId: str
    subscription: Any


@router.post("/subscriptions")
async def save_subscription(body: SaveSubscriptionBody):
    await storage.save_subscription(body.userId, body.subscription)
    return {"success": True}


@router.get("/subscriptions")
async def get_all_subscriptions():
    data = await storage.get_all_subscriptions()
    return {"data": data}


@router.get("/subscriptions/{user_id}")
async def get_subscription(user_id: str):
    data = await storage.get_subscription(user_id)
    return {"data": data}


@router.delete("/subscriptions/{user_id}")
async def remove_subscription(user_id: str):
    await storage.remove_subscription(user_id)
    return {"success": True}


# ══════════════════════════════════════════════════════════════════════════════
# Cache endpoints
# ══════════════════════════════════════════════════════════════════════════════

class SetCacheBody(BaseModel):
    key: str
    hash: str


@router.post("/cache")
async def set_cache(body: SetCacheBody):
    # key format: "userId:cacheKey"
    parts = body.key.split(":", 1)
    if len(parts) == 2:
        await storage.set_cached_hash(parts[0], parts[1], body.hash)
    return {"success": True}


@router.get("/cache/{cache_key:path}")
async def get_cache(cache_key: str):
    # cache_key format: "userId:key" (URL-decoded by FastAPI)
    parts = cache_key.split(":", 1)
    if len(parts) == 2:
        data = await storage.get_cached_hash(parts[0], parts[1])
        return {"data": data}
    return {"data": None}


# ══════════════════════════════════════════════════════════════════════════════
# Done events endpoints
# ══════════════════════════════════════════════════════════════════════════════

class SaveDoneEventBody(BaseModel):
    userId: str
    eventId: Any
    isDone: bool


@router.post("/done-events")
async def save_done_event(body: SaveDoneEventBody):
    await storage.save_done_event(body.userId, body.eventId, body.isDone)
    return {"success": True}


@router.get("/done-events/{user_id}")
async def get_done_events(user_id: str):
    data = await storage.get_done_events(user_id)
    return {"data": data}
