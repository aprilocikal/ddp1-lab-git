"""
GET /py/user?userId=xxx
Mirror of app/api/user/route.js
"""

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from services.moodle import get_site_info
from services.storage import get_user

router = APIRouter()


@router.get("/user")
async def user(userId: str = Query(...)):
    if not userId:
        return JSONResponse({"error": "userId diperlukan"}, status_code=400)

    try:
        user_data = await get_user(userId)
        if not user_data or not user_data.get("token"):
            return JSONResponse(
                {"error": "User tidak ditemukan atau token tidak valid"}, status_code=404
            )

        site_info = await get_site_info(user_data["token"])

        return JSONResponse(
            {
                "success": True,
                "user": {
                    "userId": userId,
                    "username": site_info.get("username"),
                    "fullname": site_info.get("fullname"),
                    "sitename": site_info.get("sitename"),
                    "userpictureurl": site_info.get("userpictureurl"),
                },
            }
        )

    except Exception:
        return JSONResponse(
            {"error": "Gagal mengambil data user terbaru"}, status_code=500
        )
