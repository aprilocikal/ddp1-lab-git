"""
GET /py/calendar?userId=xxx&year=YYYY&month=M
Mirror of app/api/calendar/route.js
"""

import math
import time

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from services.moodle import get_monthly_events
from services.storage import get_user

router = APIRouter()


@router.get("/calendar")
async def calendar(
    userId: str = Query(...),
    year: int = Query(...),
    month: int = Query(...),
):
    if not userId or not year or not month:
        return JSONResponse({"error": "Parameter tidak lengkap"}, status_code=400)

    try:
        user = await get_user(userId)
        if not user:
            return JSONResponse({"error": "User tidak ditemukan"}, status_code=404)

        data = await get_monthly_events(user["token"], year, month)

        # Extract all events from the weekly view structure
        all_events: list = []
        if isinstance(data, dict) and data.get("weeks"):
            for week in data["weeks"]:
                for day in (week.get("days") or []):
                    day_events = day.get("events") or []
                    if day_events:
                        all_events.extend(day_events)

        now = int(time.time())
        events = []
        for event in all_events:
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

            course = event.get("course") or {}
            action = event.get("action") or None

            events.append(
                {
                    "id": event.get("id"),
                    "name": event.get("name"),
                    "description": event.get("description"),
                    "courseName": course.get("fullname") or event.get("coursename") or "Unknown",
                    "courseId": course.get("id") or event.get("courseid"),
                    "timestart": event.get("timestart"),
                    "timeduration": event.get("timeduration"),
                    "eventtype": event.get("eventtype"),
                    "modulename": event.get("modulename"),
                    "url": event.get("url") or (action.get("url") if action else None),
                    "action": action,
                    "instance": event.get("instance"),
                    "urgency": urgency,
                }
            )

        return JSONResponse({"events": events})

    except Exception as error:
        return JSONResponse({"error": str(error)}, status_code=500)
