/**
 * GET /api/grades?userId=xxx
 * Fetch grades from SCELE for a user
 */
import { getCourses, getGrades } from '@/lib/moodle';
import { getUser } from '@/lib/storage';

export const maxDuration = 30;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return Response.json({ error: 'userId diperlukan' }, { status: 400 });
    }

    const user = await getUser(userId);
    if (!user) {
      return Response.json({ error: 'User tidak ditemukan. Silakan login ulang.' }, { status: 404 });
    }

    // Fetch courses and grades in parallel
    const [courses, gradesData] = await Promise.all([
      getCourses(user.token, userId),
      getGrades(user.token, userId),
    ]);

    // Map grades to courses
    const gradesByCourse = {};
    if (gradesData.grades) {
      for (const grade of gradesData.grades) {
        gradesByCourse[grade.courseid] = {
          grade: grade.grade,
          rawgrade: grade.rawgrade,
          rank: grade.rank,
        };
      }
    }

    // Combine course info with grades
    const courseList = courses
      .filter((c) => c.visible !== 0)
      .map((course) => ({
        id: course.id,
        fullname: course.fullname,
        shortname: course.shortname,
        category: course.category,
        startdate: course.startdate,
        enddate: course.enddate,
        progress: course.progress,
        grade: gradesByCourse[course.id] || null,
        courseimage: course.courseimage || null,
      }));

    return Response.json({
      success: true,
      courses: courseList,
    });
  } catch (error) {
    console.error('Grades error:', error.message);
    return Response.json(
      { error: error.message || 'Gagal mengambil data nilai' },
      { status: 500 }
    );
  }
}
