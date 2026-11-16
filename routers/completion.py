"""
POST /py/completion
Mirror of app/api/completion/route.js
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from services.moodle import set_activity_completion
from services.storage import get_user

router = APIRouter()


class CompletionBody(BaseModel):
    userId: str
    cmid: int
    completed: bool = False


@router.post("/completion")
async def completion(body: CompletionBody):
    if not body.userId or not body.cmid:
        return JSONResponse(
            {"error": "userId dan cmid diperlukan"}, status_code=400
        )

    try:
        user = await get_user(body.userId)
        if not user:
            return JSONResponse({"error": "User tidak ditemukan"}, status_code=404)

        data = await set_activity_completion(user["token"], body.cmid, body.completed)
        return JSONResponse({"success": True, "data": data})

    except Exception as error:
        return JSONResponse(
            {"error": str(error) or "Gagal update status completion"}, status_code=500
        )
