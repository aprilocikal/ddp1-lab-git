/**
 * POST /api/ai/chat
 * AI Chat endpoint using Vercel AI SDK + Google Gemini
 * Streams responses with full SCELE context (grades, events, courses)
 */
import { streamText, createTextStreamResponse } from 'ai';
import { google } from '@ai-sdk/google';
import { getUser } from '@/lib/storage';
import { getCourses, getGrades, getUpcomingEvents } from '@/lib/moodle';

export const maxDuration = 60;

// In-memory cache for user SCELE context (5 min TTL) to make chat responses instant
const contextCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fetch all SCELE data for a user to provide as AI context
 */
async function fetchUserContext(userId) {
  const cached = contextCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const user = await getUser(userId);
  if (!user) return null;

  try {
    // Race with a 3.5s timeout so SCELE API slowness never blocks or kills the AI response
    const fetchPromise = Promise.allSettled([
      getCourses(user.token, userId),
      getGrades(user.token, userId),
      getUpcomingEvents(user.token),
    ]);

    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), 3500));
    const raceResult = await Promise.race([fetchPromise, timeoutPromise]);

    let courses = { status: 'rejected' };
    let gradesData = { status: 'rejected' };
    let eventsData = { status: 'rejected' };

    if (raceResult !== 'TIMEOUT') {
      [courses, gradesData, eventsData] = raceResult;
    } else {
      console.warn('SCELE context fetch timed out after 3.5s, responding with user info');
    }

    // Process courses
    const courseList = courses.status === 'fulfilled'
      ? courses.value.filter(c => c.visible !== 0).map(c => ({
          id: c.id,
          fullname: c.fullname,
          shortname: c.shortname,
          progress: c.progress,
        }))
      : [];

    // Process grades
    const gradeMap = {};
    if (gradesData.status === 'fulfilled' && gradesData.value.grades) {
      for (const g of gradesData.value.grades) {
        gradeMap[g.courseid] = {
          grade: g.grade,
          rawgrade: g.rawgrade,
          rank: g.rank,
        };
      }
    }

    // Merge grades into courses
    const coursesWithGrades = courseList.map(c => ({
      ...c,
      grade: gradeMap[c.id] || null,
    }));

    // Process events
    const now = Math.floor(Date.now() / 1000);
    const events = eventsData.status === 'fulfilled'
      ? (eventsData.value.events || []).map(e => {
          const timeUntil = e.timestart - now;
          const hoursLeft = Math.floor(timeUntil / 3600);
          const daysLeft = Math.floor(hoursLeft / 24);

          let urgency = 'normal';
          if (timeUntil < 0) urgency = 'overdue';
          else if (hoursLeft < 24) urgency = 'critical';
          else if (daysLeft < 3) urgency = 'warning';

          let timeLeftText = '';
          if (timeUntil < 0) timeLeftText = 'Sudah lewat';
          else if (hoursLeft < 1) timeLeftText = `${Math.floor(timeUntil / 60)} menit lagi`;
          else if (hoursLeft < 24) timeLeftText = `${hoursLeft} jam lagi`;
          else timeLeftText = `${daysLeft} hari lagi`;

          return {
            name: e.name,
            courseName: e.course?.fullname || e.coursename || '',
            timestart: e.timestart,
            date: new Date(e.timestart * 1000).toLocaleString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            modulename: e.modulename,
            urgency,
            timeLeftText,
          };
        }).sort((a, b) => a.timestart - b.timestart)
      : [];

    const data = {
      fullname: user.fullname || '',
      username: user.username || '',
      courses: coursesWithGrades,
      events,
      currentTime: new Date().toLocaleString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      }),
    };

    contextCache.set(userId, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    console.error('Failed to fetch SCELE context:', err);
    return {
      fullname: user.fullname || '',
      username: user.username || '',
      courses: [],
      events: [],
      currentTime: new Date().toLocaleString('id-ID'),
    };
  }
}

/**
 * Build system prompt with user's real SCELE data
 */
function buildSystemPrompt(context) {
  const coursesText = context.courses.length > 0
    ? context.courses.map(c => {
        const grade = c.grade
          ? `Nilai: ${c.grade.grade || '-'} (Raw: ${c.grade.rawgrade || '-'})`
          : 'Belum ada nilai';
        return `  • ${c.fullname} (${c.shortname}) — ${grade}, Progress: ${c.progress ?? '-'}%`;
      }).join('\n')
    : '  Tidak ada data courses.';

  const eventsText = context.events.length > 0
    ? context.events.map(e => {
        const urgencyEmoji = {
          critical: '🔴',
          warning: '🟡',
          overdue: '⚫',
          normal: '🟢',
        }[e.urgency] || '⚪';
        return `  ${urgencyEmoji} ${e.name} — ${e.courseName}\n     📅 ${e.date} (${e.timeLeftText})\n     Tipe: ${e.modulename || 'event'}`;
      }).join('\n')
    : '  Tidak ada upcoming assignments/deadlines.';

  return `Kamu adalah SCELE AI Assistant, asisten cerdas yang membantu mahasiswa Fakultas Ilmu Komputer UI (Fasilkom UI) mengelola kuliah mereka di platform SCELE (scele.cs.ui.ac.id).

## Identitas
- Nama: SCELE AI
- Platform: SCELE Notif — web app untuk monitoring nilai, deadline, dan jadwal kuliah
- Universitas: Universitas Indonesia, Fakultas Ilmu Komputer

## Data Mahasiswa Real-time
Nama: ${context.fullname}
Username: ${context.username}
Waktu sekarang: ${context.currentTime}

### 📚 Courses & Nilai:
${coursesText}

### 📋 Upcoming Deadlines & Events:
${eventsText}

## Kemampuan
1. **Deadline Summarizer** — Rangkum deadline yang paling urgent, beri rekomendasi prioritas
2. **Grade Analyzer** — Analisis tren nilai, estimasi grade akhir, saran improvement
3. **Smart Reminders** — Ingatkan deadline yang dekat, kasih warning
4. **Study Planner** — Bantu bikin jadwal belajar berdasarkan deadline & course load
5. **General Q&A** — Jawab pertanyaan seputar kuliah, jadwal, dan SCELE

## Rules
- Jawab dalam Bahasa Indonesia campur Inggris (seperti mahasiswa Fasilkom biasa ngomong)
- Keep responses concise dan actionable, jangan bertele-tele
- Pakai emoji secukupnya biar friendly 😊
- Kalau ditanya soal nilai/deadline, gunakan DATA REAL di atas, jangan mengada-ada
- Kalau data tidak tersedia, bilang jujur dan sarankan refresh dashboard
- Format pesan dengan markdown sederhana (bold, bullet points, dll)
- Kalau diminta study plan, sesuaikan dengan deadline yang ada
- Selalu semangatin mahasiswa, jangan judgmental 💪`;
}

export async function POST(request) {
  try {
    const { messages, userId } = await request.json();

    if (!userId) {
      return Response.json({ error: 'userId diperlukan' }, { status: 400 });
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return Response.json(
        { error: 'GOOGLE_GENERATIVE_AI_API_KEY belum disetel di Environment Variables hosting/Vercel.' },
        { status: 500 }
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'messages diperlukan' }, { status: 400 });
    }

    // Fetch real SCELE data for context
    const context = await fetchUserContext(userId);
    if (!context) {
      return Response.json(
        { error: 'User tidak ditemukan. Silakan login ulang.' },
        { status: 404 }
      );
    }

    const systemPrompt = buildSystemPrompt(context);

    const result = streamText({
      model: google('gemini-3.5-flash-lite'),
      system: systemPrompt,
      messages,
      maxTokens: 1024,
      temperature: 0.7,
    });

    return createTextStreamResponse({ stream: result.textStream });
  } catch (error) {
    console.error('AI Chat error:', error);
    return Response.json(
      { error: error.message || 'AI gagal merespons' },
      { status: 500 }
    );
  }
}
