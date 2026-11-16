"""
GET /py/courses/{courseId}/contents?userId=xxx
Mirror of app/api/courses/[courseId]/contents/route.js
"""

from fastapi import APIRouter, Path, Query
from fastapi.responses import JSONResponse

from services.moodle import get_course_contents
from services.storage import get_user

router = APIRouter()

MOD_ICONS = {
    "assign": "📝",
    "quiz": "📊",
    "resource": "📄",
    "url": "🔗",
    "forum": "💬",
    "page": "📃",
    "folder": "📁",
    "label": None,
    "choice": "🗳️",
    "feedback": "📋",
    "workshop": "🛠️",
}


@router.get("/courses/{courseId}/contents")
async def course_contents(
    courseId: str = Path(...),
    userId: str = Query(...),
):
    if not userId:
        return JSONResponse({"error": "userId diperlukan"}, status_code=400)

    try:
        user = await get_user(userId)
        if not user:
            return JSONResponse({"error": "User tidak ditemukan"}, status_code=404)

        sections = await get_course_contents(user["token"], courseId)

        cleaned = []
        for section in (sections or []):
            mods = section.get("modules") or []
            if not mods:
                continue

            filtered_mods = []
            for mod in mods:
                modname = mod.get("modname", "")
                # Keep label only if it has a description
                if modname == "label" and not mod.get("description"):
                    continue

                contents = [
                    {
                        "filename": c.get("filename"),
                        "fileurl": c.get("fileurl"),
                        "filesize": c.get("filesize"),
                    }
                    for c in (mod.get("contents") or [])
                    if c.get("type") == "file"
                ]

                filtered_mods.append(
                    {
                        "id": mod.get("id"),
                        "name": mod.get("name"),
                        "modname": modname,
                        "modplural": mod.get("modplural"),
                        "url": mod.get("url"),
                        "description": mod.get("description"),
                        "dates": mod.get("dates") or [],
                        "completiondata": mod.get("completiondata"),
                        "contents": contents,
                    }
                )

            cleaned.append(
                {
                    "id": section.get("id"),
                    "name": section.get("name"),
                    "summary": section.get("summary") or "",
                    "modules": filtered_mods,
                }
            )

        return JSONResponse({"success": True, "sections": cleaned})

    except Exception as error:
        return JSONResponse(
            {"error": "Gagal mengambil konten mata kuliah"}, status_code=500
        )
