'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react';

/**
 * Build a SCELE URL for this event.
 * Moodle events may include `url` or `action.url`.
 * We also construct a fallback from the event's modulename + instance.
 */
function getSceleUrl(event) {
  if (event.url) return event.url;
  if (event.action?.url) return event.action.url;

  const base = 'https://scele.cs.ui.ac.id';
  if (event.modulename === 'assign' && event.instance) {
    return `${base}/mod/assign/view.php?id=${event.instance}`;
  }
  if (event.modulename === 'quiz' && event.instance) {
    return `${base}/mod/quiz/view.php?id=${event.instance}`;
  }
  if (event.courseId) {
    return `${base}/course/view.php?id=${event.courseId}`;
  }
  return null;
}

export default function EventCard({ event, userId }) {
  const [done, setDone] = useState(event.isDone || false);

  useEffect(() => {
    setDone(event.isDone || false);
  }, [event.isDone]);

  async function toggleDone(e) {
    e.stopPropagation();
    e.preventDefault();
    const next = !done;

    // 1. Optimistic Local Update
    setDone(next);

    // 2. Sync cross-device done status
    if (userId) {
      fetch('/api/events/done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, eventId: event.id, isDone: next }),
      }).catch(() => {});
    }

    // 3. Extract Course Module ID (cmid) from URL
    const url = event.url || (event.action && event.action.url) || '';
    let cmid = null;
    try {
      if (url.includes('id=')) {
        cmid = new URL(url).searchParams.get('id');
      }
    } catch { /* ignore */ }

    // 4. Sync to Moodle Web
    if (cmid && userId) {
      try {
        await fetch('/api/completion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, cmid, completed: next }),
        });
      } catch (err) {
        console.error('Failed to sync completion to Moodle', err);
      }
    }
  }

  function getEventIcon(modulename, eventtype) {
    if (modulename === 'assign' || eventtype === 'due') return { icon: '📝', type: 'type-assign' };
    if (modulename === 'quiz') return { icon: '📋', type: 'type-quiz' };
    if (eventtype === 'course') return { icon: '📚', type: 'type-event' };
    return { icon: '📌', type: 'type-default' };
  }

  const { icon, type } = getEventIcon(event.modulename, event.eventtype);

  const eventDate = new Date(event.timestart * 1000);
  const dateStr = eventDate.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const timeStr = eventDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Thorough clean of course name: strip [Reg], start year "2026-2027 Gasal", end year, and class
  const cleanCourseName = (event.courseName || '')
    .replace(/^\[Reg\]\s*/i, '')
    .replace(/^\d{4}[-/]\d{4}\s*(Gasal|Genap)?\s*/i, '')
    .replace(/\s*(Gasal|Genap)\s*\d{4}[-/]\d{4}.*/i, '')
    .replace(/\s*\([A-H,\s]+\)/i, '')
    .trim() || event.courseName || 'SCELE';

  const sceleUrl = getSceleUrl(event);

  function handleCardClick() {
    if (sceleUrl) {
      window.open(sceleUrl, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div
      className={`event-card urgency-${event.urgency} stagger-item`}
      style={{
        ...(done ? { opacity: 0.52, filter: 'grayscale(0.3)' } : {}),
        cursor: sceleUrl ? 'pointer' : 'default',
      }}
      onClick={handleCardClick}
      role={sceleUrl ? 'link' : undefined}
      title={sceleUrl ? 'Klik untuk buka di SCELE' : undefined}
    >
      {/* Done toggle */}
      <button
        onClick={toggleDone}
        className="btn-check"
        title={done ? 'Tandai belum selesai' : 'Tandai selesai'}
        style={{ color: done ? '#10b981' : '#cbd5e1' }}
      >
        {done
          ? <CheckCircle2 size={22} strokeWidth={2.5} />
          : <Circle size={22} strokeWidth={1.75} />
        }
      </button>

      {/* Module type icon */}
      <div className={`event-icon ${type}`}>
        {icon}
      </div>

      {/* Main Details */}
      <div className="event-details">
        {/* Top row: Name + Status badge */}
        <div className="event-top-row">
          <div
            className="event-name"
            title={event.name}
            style={done ? { textDecoration: 'line-through', color: '#94a3b8' } : {}}
          >
            {event.name}
          </div>
          <div className={`event-time-badge urgency-${event.urgency} ${done ? 'badge-done' : ''}`}>
            {done ? '✓ Done' : (event.timeLeftText || 'Upcoming')}
          </div>
        </div>

        {/* Bottom meta row: Course + Date/Time + Link indicator */}
        <div className="event-meta-row">
          <span className="event-course" title={cleanCourseName}>
            {cleanCourseName}
          </span>
          <span className="event-meta-dot">•</span>
          <span className="event-date">
            {dateStr}, {timeStr}
          </span>
          {sceleUrl && (
            <span className="event-link-hint">
              <ExternalLink size={12} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
