"""
GET /py/events?userId=xxx
Mirror of app/api/events/route.js
"""

import math
import time

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from services.moodle import get_upcoming_events
from services.storage import get_user, get_done_events

router = APIRouter()


@router.get("/events")
async def events(userId: str = Query(...)):
    if not userId:
        return JSONResponse({"error": "userId diperlukan"}, status_code=400)

    try:
        user = await get_user(userId)
        if not user:
            return JSONResponse(
                {"error": "User tidak ditemukan. Silakan login ulang."}, status_code=404
            )

        data, done_events = await _gather_events_data(user["token"], userId)

        now = int(time.time())
        raw_events = data.get("events", []) if isinstance(data, dict) else []

        formatted = []
        for event in raw_events:
            time_until = event.get("timestart", 0) - now
            hours_left = math.floor(time_until / 3600)
            days_left = math.floor(hours_left / 24)

            urgency = "normal"
            if time_until < 0:
                urgency = "overdue"
            elif hours_left < 24:
                urgency = "critical"
            elif days_left < 3:
                urgency = "warning"

            if time_until < 0:
                time_left_text = "Sudah lewat"
            elif hours_left < 1:
                time_left_text = f"{math.floor(time_until / 60)} menit lagi"
            elif hours_left < 24:
                time_left_text = f"{hours_left} jam lagi"
            else:
                time_left_text = f"{days_left} hari lagi"

            course = event.get("course") or {}
            action = event.get("action") or None

            formatted.append(
                {
                    "id": event.get("id"),
                    "name": event.get("name"),
                    "description": event.get("description"),
                    "courseName": course.get("fullname") or event.get("coursename") or "Unknown",
                    "courseId": event.get("courseid"),
                    "timestart": event.get("timestart"),
                    "timeduration": event.get("timeduration"),
                    "eventtype": event.get("eventtype"),
                    "modulename": event.get("modulename"),
                    "url": event.get("url") or (action.get("url") if action else None),
                    "action": action,
                    "instance": event.get("instance"),
                    "urgency": urgency,
                    "timeLeftText": time_left_text,
                    "hoursLeft": max(0, hours_left),
                    "isDone": bool(done_events.get(str(event.get("id")))),
                }
            )

        # Sort by timestart ascending (soonest first)
        formatted.sort(key=lambda e: e.get("timestart") or 0)

        return JSONResponse({"success": True, "events": formatted})

    except Exception as error:
        return JSONResponse(
            {"error": str(error) or "Gagal mengambil data events"}, status_code=500
        )


async def _gather_events_data(token: str, user_id: str):
    import asyncio
    return await asyncio.gather(
        get_upcoming_events(token),
        get_done_events(user_id),
    )
