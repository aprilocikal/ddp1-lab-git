/**
 * Web Push notification helper
 * Uses VAPID protocol for iOS + Android support
 */
import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

// Configure VAPID
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/**
 * Send a push notification to a subscription
 */
export async function sendNotification(subscription, payload) {
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
 * Send notification about upcoming events
 */
export async function notifyUpcomingEvent(subscription, eventName, courseName, timeLeft, eventUrl) {
  return sendNotification(subscription, {
    title: '⏰ Deadline Mendekat!',
    body: `${eventName} (${courseName}) — ${timeLeft}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: `event-${eventName}`,
    data: {
      type: 'event',
      url: eventUrl || '/dashboard?tab=events',
    },
  });
}

export { VAPID_PUBLIC_KEY };
