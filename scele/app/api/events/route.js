/**
 * GET /api/events?userId=xxx
 * Fetch upcoming calendar events from SCELE
 */
import { getUpcomingEvents } from '@/lib/moodle';
import { getUser, getDoneEvents } from '@/lib/storage';

export const maxDuration = 30;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return Response.json({ error: 'userId diperlukan' }, { status: 400 });
    }

    const user = await getUser(userId);
    if (!user) {
      return Response.json({ error: 'User tidak ditemukan. Silakan login ulang.' }, { status: 404 });
    }

    const [data, doneEvents] = await Promise.all([
      getUpcomingEvents(user.token),
      getDoneEvents(userId)
    ]);

    // Format events
    const events = (data.events || []).map((event) => {
      const now = Math.floor(Date.now() / 1000);
      const timeUntil = event.timestart - now;
      const hoursLeft = Math.floor(timeUntil / 3600);
      const daysLeft = Math.floor(hoursLeft / 24);

      let urgency = 'normal';
      if (timeUntil < 0) urgency = 'overdue';
      else if (hoursLeft < 24) urgency = 'critical';
      else if (daysLeft < 3) urgency = 'warning';

      let timeLeftText = '';
      if (timeUntil < 0) {
        timeLeftText = 'Sudah lewat';
      } else if (hoursLeft < 1) {
        timeLeftText = `${Math.floor(timeUntil / 60)} menit lagi`;
      } else if (hoursLeft < 24) {
        timeLeftText = `${hoursLeft} jam lagi`;
      } else {
        timeLeftText = `${daysLeft} hari lagi`;
      }

      return {
        id: event.id,
        name: event.name,
        description: event.description,
        courseName: event.course?.fullname || event.coursename || 'Unknown',
        courseId: event.courseid,
        timestart: event.timestart,
        timeduration: event.timeduration,
        eventtype: event.eventtype,
        modulename: event.modulename,
        url: event.url || event.action?.url || null,
        action: event.action || null,
        instance: event.instance || null,
        urgency,
        timeLeftText,
        hoursLeft: Math.max(0, hoursLeft),
        isDone: !!doneEvents[event.id],
      };
    });

    // Sort by time (soonest first)
    events.sort((a, b) => a.timestart - b.timestart);

    return Response.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error('Events error:', error.message);
    return Response.json(
      { error: error.message || 'Gagal mengambil data events' },
      { status: 500 }
    );
  }
}
