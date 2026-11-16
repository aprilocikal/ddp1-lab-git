import { getSiteInfo } from '@/lib/moodle';
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
    if (!user || !user.token) {
      return Response.json({ error: 'User tidak ditemukan atau token tidak valid' }, { status: 404 });
    }

    const siteInfo = await getSiteInfo(user.token);
    
    return Response.json({
      success: true,
      user: {
        userId,
        username: siteInfo.username,
        fullname: siteInfo.fullname,
        sitename: siteInfo.sitename,
        userpictureurl: siteInfo.userpictureurl,
      }
    });
  } catch (error) {
    console.error('User info error:', error.message);
    return Response.json(
      { error: 'Gagal mengambil data user terbaru' },
      { status: 500 }
    );
  }
}
