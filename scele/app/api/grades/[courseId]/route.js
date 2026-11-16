import { getCourseGradeItems } from '@/lib/moodle';
import { getUser } from '@/lib/storage';

export async function GET(request, { params }) {
  try {
    const p = await params;
    const { courseId } = p;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return Response.json({ error: 'userId diperlukan' }, { status: 400 });
    }

    const user = await getUser(userId);
    if (!user) {
      return Response.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const data = await getCourseGradeItems(user.token, courseId, userId);
    
    // Moodle returns { usergrades: [ { courseid, gradeitems: [...] } ] }
    let items = [];
    if (data.usergrades && data.usergrades.length > 0) {
      items = data.usergrades[0].gradeitems || [];
      // Filter out items that are hidden or just empty categories
      items = items.filter(item => item.itemtype !== 'category' && item.itemtype !== 'course');
    }

    return Response.json({
      success: true,
      items,
    });
  } catch (error) {
    console.error('Course grades error:', error.message);
    return Response.json(
      { error: 'Gagal mengambil detail nilai mata kuliah' },
      { status: 500 }
    );
  }
}
