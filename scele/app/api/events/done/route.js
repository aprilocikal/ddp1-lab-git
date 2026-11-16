import { saveDoneEvent } from '@/lib/storage';

export async function POST(request) {
  try {
    const { userId, eventId, isDone } = await request.json();

    if (!userId || !eventId) {
      return Response.json(
        { error: 'userId dan eventId diperlukan' },
        { status: 400 }
      );
    }

    await saveDoneEvent(userId, eventId, isDone);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Save done event error:', error.message);
    return Response.json(
      { error: 'Gagal menyimpan status' },
      { status: 500 }
    );
  }
}
