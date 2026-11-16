"""
POST /py/auth
Mirror of app/api/auth/route.js
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from services.moodle import get_token, get_site_info
from services.storage import save_user

router = APIRouter()


class AuthBody(BaseModel):
    username: str
    password: str


@router.post("/auth")
async def auth(body: AuthBody):
    username = (body.username or "").strip()
    password = body.password or ""

    if not username or not password:
        return JSONResponse(
            {"error": "Username dan password harus diisi"}, status_code=400
        )

    try:
        token = await get_token(username, password)
        site_info = await get_site_info(token)

        user_id = str(site_info["userid"])
        user_data = {
            "userId": user_id,
            "username": site_info["username"],
            "fullname": site_info["fullname"],
            "siteUrl": site_info["siteurl"],
            "token": token,  # stored server-side only
        }

        await save_user(user_id, user_data)

        return JSONResponse(
            {
                "success": True,
                "user": {
                    "userId": user_id,
                    "username": site_info["username"],
                    "fullname": site_info["fullname"],
                    "sitename": site_info.get("sitename"),
                    "userpictureurl": site_info.get("userpictureurl"),
                },
            }
        )

    except Exception as error:
        msg = str(error).lower()
        user_message = "Login gagal. Periksa username/password."

        if any(
            kw in msg
            for kw in ("fetch failed", "econnrefused", "enotfound", "tidak dapat terhubung", "connect")
        ):
            user_message = (
                "Tidak dapat terhubung ke server SCELE. Coba lagi dalam beberapa saat."
            )
        elif any(kw in msg for kw in ("timeout", "aborted", "tidak merespons", "timed out")):
            user_message = (
                "Server SCELE tidak merespons (timeout). Coba lagi dalam beberapa saat."
            )
        elif any(kw in msg for kw in ("tidak valid", "unexpected token", "invalid json", "json")):
            user_message = "Respons dari server SCELE tidak valid. Coba lagi nanti."
        elif str(error):
            user_message = str(error)

        return JSONResponse({"error": user_message}, status_code=401)
