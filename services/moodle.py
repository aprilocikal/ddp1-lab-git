"""
Moodle REST API Helper for SCELE
Mirror of lib/moodle.js
"""

import asyncio
import os
from pathlib import Path
from typing import Any, Optional

import httpx

# Fungsi pembaca file .env bawaan (pure Python standard library)
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

# Load environment variables dari file .env atau .env.local
_cur_dir = Path(__file__).resolve().parent
for _p in [
    _cur_dir.parent / ".env",
    _cur_dir.parent / ".env.local",
    _cur_dir.parent.parent / "scele" / ".env.local",
    _cur_dir.parent.parent / ".env.local",
]:
    _load_env_file(_p)

SCELE_BASE = os.getenv("SCELE_BASE_URL", "https://scele.cs.ui.ac.id")
FETCH_TIMEOUT_S = 8.0
MAX_RETRIES = 1


async def _fetch_with_retry(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    **kwargs,
) -> httpx.Response:
    """Fetch with timeout and 1 retry, mirroring fetchWithRetry in moodle.js."""
    last_error: Optional[Exception] = None

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await client.request(
                method,
                url,
                timeout=FETCH_TIMEOUT_S,
                **kwargs,
            )
            return response
        except (httpx.TimeoutException, httpx.ConnectError) as err:
            last_error = err
            if attempt < MAX_RETRIES:
                await asyncio.sleep(0.5 * (2 ** attempt))

    # All attempts exhausted
    if isinstance(last_error, httpx.TimeoutException):
        raise ValueError(
            "Server SCELE tidak merespons (timeout). Coba lagi dalam beberapa saat."
        )
    raise ValueError(
        "Tidak dapat terhubung ke server SCELE. Periksa koneksi internet atau coba lagi nanti."
    )


async def get_token(username: str, password: str) -> str:
    """POST ke {SCELE_BASE}/login/token.php dan kembalikan token."""
    async with httpx.AsyncClient() as client:
        response = await _fetch_with_retry(
            client,
            "POST",
            f"{SCELE_BASE}/login/token.php",
            data={
                "username": username,
                "password": password,
                "service": "moodle_mobile_app",
            },
        )
    try:
        data = response.json()
    except Exception:
        raise ValueError(
            "Respons dari server SCELE tidak valid. Coba lagi dalam beberapa saat."
        )

    if data.get("error"):
        raise ValueError(data["error"])

    return data["token"]


async def _call_moodle(token: str, wsfunction: str, params: dict[str, Any] = {}) -> Any:
    """Call a Moodle web service function."""
    payload = {
        "wstoken": token,
        "wsfunction": wsfunction,
        "moodlewsrestformat": "json",
        **params,
    }

    async with httpx.AsyncClient() as client:
        response = await _fetch_with_retry(
            client,
            "POST",
            f"{SCELE_BASE}/webservice/rest/server.php",
            data=payload,
        )

    try:
        data = response.json()
    except Exception:
        raise ValueError(
            "Respons dari server SCELE tidak valid. Coba lagi dalam beberapa saat."
        )

    if isinstance(data, dict) and data.get("exception"):
        raise ValueError(f"Moodle Error: {data.get('message', 'Unknown error')}")

    return data


async def get_site_info(token: str) -> dict:
    """Get site info and user details (core_webservice_get_site_info)."""
    return await _call_moodle(token, "core_webservice_get_site_info")


async def get_courses(token: str, user_id: str) -> list:
    """Get all courses the user is enrolled in (core_enrol_get_users_courses)."""
    return await _call_moodle(token, "core_enrol_get_users_courses", {"userid": user_id})


async def get_grades(token: str, user_id: str) -> dict:
    """Get grade overview for all courses (gradereport_overview_get_course_grades)."""
    return await _call_moodle(
        token, "gradereport_overview_get_course_grades", {"userid": user_id}
    )


async def get_course_grade_items(token: str, course_id: Any, user_id: str) -> dict:
    """Get detailed grade items for a specific course (gradereport_user_get_grade_items)."""
    return await _call_moodle(
        token,
        "gradereport_user_get_grade_items",
        {"courseid": course_id, "userid": user_id},
    )


async def get_upcoming_events(token: str) -> dict:
    """Get upcoming calendar events (core_calendar_get_calendar_upcoming_view)."""
    return await _call_moodle(token, "core_calendar_get_calendar_upcoming_view")


async def get_monthly_events(token: str, year: int, month: int) -> dict:
    """Get monthly calendar events (core_calendar_get_calendar_monthly_view)."""
    return await _call_moodle(
        token,
        "core_calendar_get_calendar_monthly_view",
        {"year": year, "month": month},
    )


async def get_course_contents(token: str, course_id: Any) -> list:
    """Get course contents (core_course_get_contents)."""
    return await _call_moodle(
        token, "core_course_get_contents", {"courseid": course_id}
    )


async def set_activity_completion(token: str, cmid: int, completed: bool) -> dict:
    """Manually update activity completion status."""
    return await _call_moodle(
        token,
        "core_completion_update_activity_completion_status_manually",
        {"cmid": cmid, "completed": 1 if completed else 0},
    )
