"""
File-based JSON storage — replaces Redis for local/dev usage.
Mirrors lib/storage.js but stores data in python/data/*.json files.
"""

import asyncio
import hashlib
import json
import os
from pathlib import Path
from typing import Any, Optional

# Resolve data directory relative to this file
DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# File paths
_USERS_FILE = DATA_DIR / "users.json"
_SUBSCRIPTIONS_FILE = DATA_DIR / "subscriptions.json"
_CACHE_FILE = DATA_DIR / "cache.json"
_DONE_EVENTS_FILE = DATA_DIR / "done_events.json"

# Simple asyncio lock to serialise concurrent writes
_lock = asyncio.Lock()


def _read_json(path: Path) -> dict:
    """Read a JSON file; return empty dict if missing or malformed."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _write_json(path: Path, data: dict) -> None:
    """Write a dict to a JSON file (pretty-printed)."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ---- User Management ----

async def save_user(user_id: str, user_data: dict) -> None:
    async with _lock:
        users = _read_json(_USERS_FILE)
        users[user_id] = {**user_data, "updatedAt": _now_ms()}
        _write_json(_USERS_FILE, users)


async def get_user(user_id: str) -> Optional[dict]:
    async with _lock:
        users = _read_json(_USERS_FILE)
        return users.get(user_id)


async def get_all_users() -> dict:
    async with _lock:
        return _read_json(_USERS_FILE)


# ---- Subscription Management ----

async def save_subscription(user_id: str, subscription: Any) -> None:
    async with _lock:
        subs = _read_json(_SUBSCRIPTIONS_FILE)
        subs[user_id] = subscription
        _write_json(_SUBSCRIPTIONS_FILE, subs)


async def get_subscription(user_id: str) -> Optional[Any]:
    async with _lock:
        subs = _read_json(_SUBSCRIPTIONS_FILE)
        return subs.get(user_id)


async def remove_subscription(user_id: str) -> None:
    async with _lock:
        subs = _read_json(_SUBSCRIPTIONS_FILE)
        subs.pop(user_id, None)
        _write_json(_SUBSCRIPTIONS_FILE, subs)


async def get_all_subscriptions() -> dict:
    async with _lock:
        return _read_json(_SUBSCRIPTIONS_FILE)


# ---- Cache / Hash Management ----

def hash_data(data: Any) -> str:
    """SHA-256 of JSON-serialised data, mirroring createHash('sha256') in JS."""
    raw = json.dumps(data, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def get_cached_hash(user_id: str, key: str) -> Optional[str]:
    cache_key = f"{user_id}:{key}"
    async with _lock:
        cache = _read_json(_CACHE_FILE)
        return cache.get(cache_key)


async def set_cached_hash(user_id: str, key: str, hash_value: str) -> None:
    cache_key = f"{user_id}:{key}"
    async with _lock:
        cache = _read_json(_CACHE_FILE)
        cache[cache_key] = hash_value
        _write_json(_CACHE_FILE, cache)


# ---- Done Events Management ----

async def get_done_events(user_id: str) -> dict:
    async with _lock:
        done = _read_json(_DONE_EVENTS_FILE)
        raw = done.get(user_id, {})
        if isinstance(raw, str):
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return {}
        return raw


async def save_done_event(user_id: str, event_id: Any, is_done: bool) -> None:
    async with _lock:
        done = _read_json(_DONE_EVENTS_FILE)
        current: dict = {}
        raw = done.get(user_id, {})
        if isinstance(raw, str):
            try:
                current = json.loads(raw)
            except json.JSONDecodeError:
                current = {}
        else:
            current = dict(raw)

        event_key = str(event_id)
        if is_done:
            current[event_key] = True
        else:
            current.pop(event_key, None)

        done[user_id] = current
        _write_json(_DONE_EVENTS_FILE, done)


# ---- Helpers ----

def _now_ms() -> int:
    import time
    return int(time.time() * 1000)
