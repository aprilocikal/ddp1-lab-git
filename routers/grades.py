"""
GET /py/grades?userId=xxx
Mirror of app/api/grades/route.js
"""

import asyncio

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from services.moodle import get_courses, get_grades
from services.storage import get_user

router = APIRouter()


@router.get("/grades")
async def grades(userId: str = Query(...)):
    if not userId:
        return JSONResponse({"error": "userId diperlukan"}, status_code=400)

    try:
        user = await get_user(userId)
        if not user:
            return JSONResponse(
                {"error": "User tidak ditemukan. Silakan login ulang."}, status_code=404
            )

        token = user["token"]
        courses_list, grades_data = await asyncio.gather(
            get_courses(token, userId),
            get_grades(token, userId),
        )

        # Map grades by courseId
        grades_by_course: dict = {}
        if isinstance(grades_data, dict) and grades_data.get("grades"):
            for grade in grades_data["grades"]:
                grades_by_course[grade["courseid"]] = {
                    "grade": grade.get("grade"),
                    "rawgrade": grade.get("rawgrade"),
                    "rank": grade.get("rank"),
                }

        # Combine course info with grades, exclude hidden courses
        course_list = []
        for course in (courses_list or []):
            if course.get("visible") == 0:
                continue
            course_list.append(
                {
                    "id": course.get("id"),
                    "fullname": course.get("fullname"),
                    "shortname": course.get("shortname"),
                    "category": course.get("category"),
                    "startdate": course.get("startdate"),
                    "enddate": course.get("enddate"),
                    "progress": course.get("progress"),
                    "grade": grades_by_course.get(course["id"]),
                    "courseimage": course.get("courseimage"),
                }
            )

        return JSONResponse({"success": True, "courses": course_list})

    except Exception as error:
        return JSONResponse(
            {"error": str(error) or "Gagal mengambil data nilai"}, status_code=500
        )
