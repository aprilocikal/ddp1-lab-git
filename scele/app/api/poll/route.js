/**
 * GET /api/poll?secret=xxx
 * Polling endpoint — called by Vercel Cron (or cron-job.org) every 15 minutes.
 * Checks for grade/event changes and sends push notifications.
 */
import { getCourses, getGrades, getUpcomingEvents } from '@/lib/moodle';
import { sendNotification } from '@/lib/push';
import {
  getAllUsers,
  getAllSubscriptions,
  removeSubscription,
  hashData,
  getCachedHash,
  setCachedHash,
} from '@/lib/storage';

export const maxDuration = 60; // Allow up to 60s for processing all users

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  // Verify cron secret (supports query param or Vercel Cron Auth header)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (secret !== cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[poll] 🚀 Starting poll cycle at', new Date().toISOString());

  const results = {
    processed: 0,
    notifications: 0,
    errors: 0,
    skipped: 0,
    details: [],
  };

  try {
    const users = await getAllUsers();
    const subscriptions = await getAllSubscriptions();

    const userIds = Object.keys(users);
    console.log(`[poll] Found ${userIds.length} users, ${Object.keys(subscriptions).length} subscriptions`);

    for (const [userId, user] of Object.entries(users)) {
      const subscription = subscriptions[userId];
      if (!subscription || !user.token) {
        results.skipped++;
        continue;
      }

      results.processed++;

      try {
        // Fetch current grades and events in parallel
        const [gradesData, eventsData] = await Promise.all([
          getGrades(user.token, userId).catch((err) => {
            console.error(`[poll] Grades fetch failed for user ${userId}:`, err.message);
            return null;
          }),
          getUpcomingEvents(user.token).catch((err) => {
            console.error(`[poll] Events fetch failed for user ${userId}:`, err.message);
            return null;
          }),
        ]);

        // ── Grade change detection (per-course comparison) ──────────────────
        if (gradesData?.grades) {
          const previousBulkHash = await getCachedHash(userId, 'grades');
          const currentBulkHash = hashData(gradesData.grades);

          if (previousBulkHash === null) {
            // First-time poll — seed the cache, don't send any notifications
            console.log(`[poll] User ${userId}: First-time grade seed (${gradesData.grades.length} courses)`);
            // Seed per-course hashes
            for (const grade of gradesData.grades) {
              const courseHash = hashData(grade);
              await setCachedHash(userId, `grade_course_${grade.courseid}`, courseHash);
            }
          } else if (previousBulkHash !== currentBulkHash) {
            // Something changed — figure out WHICH courses changed
            console.log(`[poll] User ${userId}: Grade change detected, checking per-course...`);

            const courses = await getCourses(user.token, userId).catch(() => []);
            const courseMap = {};
            for (const c of courses) {
              courseMap[c.id] = c.fullname;
            }

            for (const grade of gradesData.grades) {
              const courseHash = hashData(grade);
              const prevCourseHash = await getCachedHash(userId, `grade_course_${grade.courseid}`);

              if (prevCourseHash !== null && prevCourseHash !== courseHash) {
                // THIS specific course's grade changed → send notification
                const courseName = courseMap[grade.courseid] || `Course ${grade.courseid}`;
                console.log(`[poll] User ${userId}: Grade changed for "${courseName}"`);

                const result = await sendNotification(subscription, {
                  title: '📊 Nilai Update!',
                  body: `${courseName}: ${grade.grade || 'Nilai baru tersedia'}`,
                  icon: '/icons/icon-192.png',
                  badge: '/icons/icon-192.png',
                  tag: `grade-${grade.courseid}`,
                  data: {
                    type: 'grade',
                    url: `/course/${grade.courseid}?name=${encodeURIComponent(courseName)}`,
                  },
                });

                if (result.success) {
                  results.notifications++;
                  results.details.push(`grade:${courseName}`);
                }

                // Handle expired subscription
                if (result.expired) {
                  console.log(`[poll] User ${userId}: Subscription expired, removing`);
                  await removeSubscription(userId);
                  break; // No point sending more notifs to dead subscription
                }
              }

              // Update per-course hash
              await setCachedHash(userId, `grade_course_${grade.courseid}`, courseHash);
            }
          }

          // Always update bulk hash
          await setCachedHash(userId, 'grades', currentBulkHash);
        }

        // ── New event detection ─────────────────────────────────────────────
        if (eventsData?.events) {
          const currentIds = eventsData.events.map((e) => e.id);
          const currentHash = JSON.stringify(currentIds);
          const previousHash = await getCachedHash(userId, 'events_v2');

          if (previousHash === null) {
            // First-time — seed event IDs, no notifications
            console.log(`[poll] User ${userId}: First-time event seed (${currentIds.length} events)`);
          } else if (previousHash !== currentHash) {
            let previousIds = [];
            try {
              previousIds = JSON.parse(previousHash);
            } catch {
              // Ignore parse errors from old cache format
            }

            const prevSet = new Set(previousIds);
            const newEvents = eventsData.events.filter((e) => !prevSet.has(e.id));
            const now = Math.floor(Date.now() / 1000);

            console.log(`[poll] User ${userId}: ${newEvents.length} new event(s) detected`);

            for (const event of newEvents) {
              const hoursLeft = Math.floor((event.timestart - now) / 3600);
              const timeLeftText =
                hoursLeft > 24
                  ? `${Math.floor(hoursLeft / 24)} hari lagi`
                  : `${hoursLeft} jam lagi`;

              // Build deep-link URL: prefer direct SCELE link, fallback to events tab
              let eventUrl = '/dashboard?tab=events';
              if (event.url) {
                eventUrl = event.url;
              } else if (event.modulename === 'assign' && event.instance) {
                eventUrl = `https://scele.cs.ui.ac.id/mod/assign/view.php?id=${event.instance}`;
              } else if (event.modulename === 'quiz' && event.instance) {
                eventUrl = `https://scele.cs.ui.ac.id/mod/quiz/view.php?id=${event.instance}`;
              }

              console.log(`[poll] User ${userId}: Notifying new event "${event.name}" (${timeLeftText})`);

              const result = await sendNotification(subscription, {
                title: '📌 Tugas Baru Ditemukan!',
                body: `${event.name} — ${timeLeftText}`,
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                tag: `event-${event.id}`,
                data: { type: 'event', url: eventUrl },
              });

              if (result.success) {
                results.notifications++;
                results.details.push(`event:${event.name}`);
              }

              if (result.expired) {
                console.log(`[poll] User ${userId}: Subscription expired, removing`);
                await removeSubscription(userId);
                break;
              }
            }
          }

          await setCachedHash(userId, 'events_v2', currentHash);
        }
      } catch (userError) {
        console.error(`[poll] Error processing user ${userId}:`, userError.message);
        results.errors++;
      }
    }

    console.log(`[poll] ✅ Done — processed: ${results.processed}, notifs: ${results.notifications}, errors: ${results.errors}, skipped: ${results.skipped}`);

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    });
  } catch (error) {
    console.error('[poll] Fatal error:', error.message);
    return Response.json(
      { error: error.message || 'Polling gagal' },
      { status: 500 }
    );
  }
}
