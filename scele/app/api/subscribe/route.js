/**
 * POST /api/subscribe — Save push subscription
 * DELETE /api/subscribe — Remove push subscription
 * GET /api/subscribe/vapid — Get VAPID public key
 */
import { saveSubscription, removeSubscription } from '@/lib/storage';

export async function POST(request) {
  try {
    const { userId, subscription } = await request.json();

    if (!userId || !subscription) {
      return Response.json(
        { error: 'userId dan subscription diperlukan' },
        { status: 400 }
      );
    }

    await saveSubscription(userId, subscription);

    return Response.json({
      success: true,
      message: 'Push subscription berhasil disimpan',
    });
  } catch (error) {
    console.error('Subscribe error:', error.message);
    return Response.json(
      { error: 'Gagal menyimpan subscription' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return Response.json({ error: 'userId diperlukan' }, { status: 400 });
    }

    await removeSubscription(userId);

    return Response.json({
      success: true,
      message: 'Push subscription berhasil dihapus',
    });
  } catch (error) {
    console.error('Unsubscribe error:', error.message);
    return Response.json(
      { error: 'Gagal menghapus subscription' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    return Response.json(
      { error: 'VAPID key belum dikonfigurasi' },
      { status: 500 }
    );
  }

  return Response.json({ vapidPublicKey });
}
