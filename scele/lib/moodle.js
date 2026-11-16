/**
 * Moodle REST API Helper for SCELE
 * Handles authentication and data fetching from scele.cs.ui.ac.id
 */

const SCELE_BASE = process.env.SCELE_BASE_URL || 'https://scele.cs.ui.ac.id';

/**
 * Timeout duration for each fetch attempt (ms).
 * Vercel Hobby maxDuration = 10s (Pro = 60s). Keep each attempt well within
 * that limit so there is still time for the retry + Redis save.
 */
const FETCH_TIMEOUT_MS = 8_000;

/**
 * Maximum number of retry attempts for transient network failures.
 * With 1 retry: worst case ≈ 8s + 0.5s backoff + 8s = ~16.5s.
 * On Hobby this means the retry rarely fires before the 10s wall,
 * but on Pro (maxDuration=60) it works perfectly.
 */
const MAX_RETRIES = 1;

/**
 * Fetch wrapper with per-request timeout and automatic retries.
 * Translates raw network errors (e.g. "fetch failed") into a user-friendly
 * message so the login page never shows a cryptic string.
 */
async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;

      // Don't retry on the last attempt
      if (attempt < retries) {
        // Exponential back-off: 500ms, 1000ms, …
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }
  }

  // All attempts exhausted — throw a friendly error
  if (lastError?.name === 'AbortError') {
    throw new Error(
      'Server SCELE tidak merespons (timeout). Coba lagi dalam beberapa saat.'
    );
  }

  throw new Error(
    'Tidak dapat terhubung ke server SCELE. Periksa koneksi internet atau coba lagi nanti.'
  );
}

/**
 * Get Moodle token by authenticating with username/password
 */
export async function getToken(username, password) {
  const res = await fetchWithRetry(`${SCELE_BASE}/login/token.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username,
      password,
      service: 'moodle_mobile_app',
    }),
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      'Respons dari server SCELE tidak valid. Coba lagi dalam beberapa saat.'
    );
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data.token;
}

/**
 * Call a Moodle web service function
 */
async function callMoodle(token, wsfunction, params = {}) {
  const body = new URLSearchParams({
    wstoken: token,
    wsfunction,
    moodlewsrestformat: 'json',
    ...params,
  });

  const res = await fetchWithRetry(`${SCELE_BASE}/webservice/rest/server.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(
      'Respons dari server SCELE tidak valid. Coba lagi dalam beberapa saat.'
    );
  }

  if (data.exception) {
    throw new Error(`Moodle Error: ${data.message}`);
  }

  return data;
}

/**
 * Get site info and user details
 */
export async function getSiteInfo(token) {
  return callMoodle(token, 'core_webservice_get_site_info');
}

/**
 * Get all courses the user is enrolled in
 */
export async function getCourses(token, userId) {
  return callMoodle(token, 'core_enrol_get_users_courses', {
    userid: userId,
  });
}

/**
 * Get grade overview for all courses
 */
export async function getGrades(token, userId) {
  return callMoodle(token, 'gradereport_overview_get_course_grades', {
    userid: userId,
  });
}

/**
 * Get detailed grade items for a specific course
 */
export async function getCourseGradeItems(token, courseId, userId) {
  return callMoodle(token, 'gradereport_user_get_grade_items', {
    courseid: courseId,
    userid: userId,
  });
}

/**
 * Get upcoming calendar events
 */
export async function getUpcomingEvents(token) {
  return callMoodle(token, 'core_calendar_get_calendar_upcoming_view');
}

/**
 * Get monthly calendar events
 */
export async function getMonthlyEvents(token, year, month) {
  return callMoodle(token, 'core_calendar_get_calendar_monthly_view', {
    year,
    month,
  });
}

/**
 * Get course contents (for assignment details etc.)
 */
export async function getCourseContents(token, courseId) {
  return callMoodle(token, 'core_course_get_contents', {
    courseid: courseId,
  });
}

/**
 * Manually update activity completion status
 */
export async function setActivityCompletion(token, cmid, completed) {
  return callMoodle(token, 'core_completion_update_activity_completion_status_manually', {
    cmid: cmid,
    completed: completed ? 1 : 0,
  });
}
