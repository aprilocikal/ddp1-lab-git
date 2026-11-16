import { getMonthlyEvents } from '@/lib/moodle';
import { getUser } from '@/lib/storage';

export const maxDuration = 30;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const year = searchParams.get('year');
    const month = searchParams.get('month'); // 1-12

    if (!userId || !year || !month) {
      return Response.json({ error: 'Parameter tidak lengkap' }, { status: 400 });
    }

    const user = await getUser(userId);
    if (!user) {
      return Response.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const data = await getMonthlyEvents(user.token, parseInt(year), parseInt(month));
    
    // Moodle's monthly view returns a complex object. Let's extract all events from it.
    let allEvents = [];
    if (data && data.weeks) {
      data.weeks.forEach(week => {
        week.days.forEach(day => {
          if (day.events && day.events.length > 0) {
            allEvents = allEvents.concat(day.events);
          }
        });
      });
    }

    // Format events similar to upcoming events for consistency
    const events = allEvents.map((event) => {
      const now = Math.floor(Date.now() / 1000);
      const timeUntil = event.timestart - now;
      const hoursLeft = Math.floor(timeUntil / 3600);
      const daysLeft = Math.floor(hoursLeft / 24);

      let urgency = 'normal';
      if (timeUntil < 0) urgency = 'overdue';
      else if (hoursLeft < 24) urgency = 'critical';
      else if (daysLeft < 3) urgency = 'warning';

      return {
        id: event.id,
        name: event.name,
        description: event.description,
        courseName: event.course?.fullname || event.coursename || 'Unknown',
        courseId: event.course?.id || event.courseid,
        timestart: event.timestart,
        timeduration: event.timeduration,
        eventtype: event.eventtype,
        modulename: event.modulename,
        url: event.url || event.action?.url || null,
        action: event.action || null,
        instance: event.instance || null,
        urgency
      };
    });

    return Response.json({ events });
  } catch (error) {
    console.error('Calendar API Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
