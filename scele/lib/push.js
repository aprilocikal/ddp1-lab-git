/**
 * Web Push notification helper
 * Uses VAPID protocol for iOS + Android support
 */
import webpush from 'web-push';

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return true;

  let pubKey = process.env.VAPID_PUBLIC_KEY || '';
  let privKey = process.env.VAPID_PRIVATE_KEY || '';
  let email = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

  // Sanitize: strip accidental "KEY=" prefix, wrapping quotes, and whitespace
  if (pubKey.includes('=')) {
    pubKey = pubKey.split('=').pop() || '';
  }
  if (privKey.includes('=')) {
    privKey = privKey.split('=').pop() || '';
  }

  pubKey = pubKey.trim().replace(/^["']|["']$/g, '');
  privKey = privKey.trim().replace(/^["']|["']$/g, '');
  email = email.trim().replace(/^["']|["']$/g, '');

  if (!pubKey || !privKey) {
    return false;
  }

  try {
    webpush.setVapidDetails(email, pubKey, privKey);
    vapidConfigured = true;
    return true;
  } catch (err) {
    console.warn('VAPID configuration warning:', err.message);
    return false;
  }
}

/**
 * Send a push notification to a subscription
 */
export async function sendNotification(subscription, payload) {
  if (!ensureVapidConfigured()) {
    console.warn('VAPID is not configured properly, skipping push notification');
    return { success: false, error: 'VAPID not configured' };
  }

  try {
    const data = JSON.stringify(payload);
    await webpush.sendNotification(subscription, data);
    return { success: true };
  } catch (error) {
    console.error('Push notification failed:', error.message);

    // If subscription is no longer valid (410 Gone), mark for removal
    if (error.statusCode === 410 || error.statusCode === 404) {
      return { success: false, expired: true };
    }

    return { success: false, expired: false, error: error.message };
  }
}

/**
 * Send notification about grade changes
 */
export async function notifyGradeChange(subscription, courseName, grade, courseId) {
  return sendNotification(subscription, {
    title: '📊 Nilai Baru!',
    body: `${courseName}: ${grade}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: `grade-${courseName}`,
    data: {
      type: 'grade',
      url: courseId ? `/course/${courseId}?name=${encodeURIComponent(courseName)}` : '/dashboard?tab=grades',
    },
  });
}

/**
 * Send notification about upcoming deadlines
 */
export async function notifyUpcomingDeadline(subscription, eventName, courseName, timeLeft, eventId) {
  return sendNotification(subscription, {
    title: `⏰ Deadline: ${eventName}`,
    body: `${courseName} — ${timeLeft}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: `deadline-${eventId}`,
    data: {
      type: 'deadline',
      url: '/dashboard?tab=events',
    },
  });
}
