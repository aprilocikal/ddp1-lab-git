import { getSubscription } from '@/lib/storage';
import { sendNotification } from '@/lib/push';

export async function POST(request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return Response.json({ error: 'userId diperlukan' }, { status: 400 });
    }

    const subscription = await getSubscription(userId);

    if (!subscription) {
      return Response.json({ error: 'User belum subscribe ke notifikasi' }, { status: 404 });
    }

    const result = await sendNotification(subscription, {
      title: '✅ Test Notifikasi Berhasil!',
      body: 'Jika kamu melihat ini, push notification kamu sudah aktif dan berjalan dengan baik.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `test-${Date.now()}`,
      data: { type: 'test', url: '/dashboard' },
    });

    if (result.success) {
      return Response.json({ success: true, message: 'Notifikasi berhasil dikirim!' });
    } else {
      return Response.json({ error: 'Gagal mengirim push (expired atau invalid)' }, { status: 500 });
    }
  } catch (error) {
    console.error('Test push error:', error);
    return Response.json({ error: 'Terjadi kesalahan saat mengirim notifikasi' }, { status: 500 });
  }
}
