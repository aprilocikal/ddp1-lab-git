import { setActivityCompletion } from '@/lib/moodle';
import { getUser } from '@/lib/storage';

export const maxDuration = 30;

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, cmid, completed } = body;

    if (!userId || !cmid) {
      return Response.json({ error: 'userId dan cmid diperlukan' }, { status: 400 });
    }

    const user = await getUser(userId);
    if (!user) {
      return Response.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const data = await setActivityCompletion(user.token, cmid, completed);

    return Response.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Completion error:', error.message);
    return Response.json(
      { error: error.message || 'Gagal update status completion' },
      { status: 500 }
    );
  }
}
