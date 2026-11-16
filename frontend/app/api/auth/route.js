/**
 * POST /api/auth
 * Login to SCELE and get Moodle token
 */
import { getToken, getSiteInfo } from '@/lib/moodle';
import { saveUser } from '@/lib/storage';

// Allow up to 30s for login (SCELE fetch + retry + Redis save).
// On Hobby plan this is capped at 10s by Vercel regardless.
export const maxDuration = 30;

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return Response.json(
        { error: 'Username dan password harus diisi' },
        { status: 400 }
      );
    }

    // Get Moodle token
    const token = await getToken(username, password);

    // Get user info
    const siteInfo = await getSiteInfo(token);

    const userId = String(siteInfo.userid);
    const userData = {
      userId,
      username: siteInfo.username,
      fullname: siteInfo.fullname,
      siteUrl: siteInfo.siteurl,
      token, // stored server-side only
    };

    // Save user data
    await saveUser(userId, userData);

    // Return user info (WITHOUT token for security)
    return Response.json({
      success: true,
      user: {
        userId,
        username: siteInfo.username,
        fullname: siteInfo.fullname,
        sitename: siteInfo.sitename,
        userpictureurl: siteInfo.userpictureurl,
      },
    });
  } catch (error) {
    console.error('Auth error:', error.message);

    // Translate raw network / fetch errors into friendly messages
    let userMessage = 'Login gagal. Periksa username/password.';
    const msg = (error.message || '').toLowerCase();

    if (
      msg.includes('fetch failed') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('tidak dapat terhubung')
    ) {
      userMessage =
        'Tidak dapat terhubung ke server SCELE. Coba lagi dalam beberapa saat.';
    } else if (
      msg.includes('timeout') ||
      msg.includes('aborted') ||
      msg.includes('tidak merespons')
    ) {
      userMessage =
        'Server SCELE tidak merespons (timeout). Coba lagi dalam beberapa saat.';
    } else if (
      msg.includes('tidak valid') ||
      msg.includes('unexpected token') ||
      msg.includes('invalid json')
    ) {
      userMessage =
        'Respons dari server SCELE tidak valid. Coba lagi nanti.';
    } else if (error.message) {
      // Use the original message if it's already user-friendly (e.g. from Moodle)
      userMessage = error.message;
    }

    return Response.json(
      { error: userMessage },
      { status: 401 }
    );
  }
}
