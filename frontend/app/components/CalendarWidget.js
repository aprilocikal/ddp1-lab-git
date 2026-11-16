'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, FileText, ExternalLink } from 'lucide-react';

export default function CalendarWidget({ userId }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11

  useEffect(() => {
    // Immediately hydrate from cached events so calendar displays dots instantly
    try {
      const cached = localStorage.getItem('scele_events');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEvents(parsed);
        }
      }
    } catch (e) {}

    if (!userId) return;

    async function fetchMonthlyEvents() {
      setLoading(true);
      try {
        const res = await fetch(`/api/calendar?userId=${userId}&year=${year}&month=${month + 1}`);
        if (res.ok) {
          const data = await res.json();
          const monthly = data.events || [];
          setEvents((prev) => {
            const map = new Map();
            // Start with monthly events
            monthly.forEach((e) => map.set(e.id, e));
            // Keep any upcoming events that fall in this month
            prev.forEach((e) => {
              if (!map.has(e.id)) map.set(e.id, e);
            });
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.error('Failed to fetch calendar:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMonthlyEvents();
  }, [userId, year, month]);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  // getDay(): 0=Sunday … 6=Saturday
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Build 42-cell grid (6 rows × 7 cols)
  const calendarDays = [];

  // Previous month trailing days
  for (let i = 0; i < firstDayIndex; i++) {
    const day = daysInPrevMonth - firstDayIndex + 1 + i;
    calendarDays.push({
      day,
      isCurrentMonth: false,
      date: new Date(year, month - 1, day),
    });
  }
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({
      day: i,
      isCurrentMonth: true,
      isToday: isCurrentMonth && today.getDate() === i,
      date: new Date(year, month, i),
    });
  }
  // Next month leading days
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({
      day: i,
      isCurrentMonth: false,
      date: new Date(year, month + 1, i),
    });
  }

  // Consistent date key helper
  function getDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  // Map events to date keys
  const eventDates = {};
  events.forEach((e) => {
    if (!e.timestart) return;
    const d = new Date(e.timestart * 1000);
    const key = getDateKey(d);
    if (!eventDates[key]) eventDates[key] = [];
    eventDates[key].push(e);
  });

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));

  const handleDateClick = (cell) => {
    setSelectedDate(cell.date);
    if (!cell.isCurrentMonth) {
      setCurrentDate(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
    }
  };

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayNames = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

  const selectedDateKey = getDateKey(selectedDate);
  const selectedEvents = eventDates[selectedDateKey] || [];

  const selectedDateFormatted = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // Shared grid style for perfect alignment between header and cells
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '2px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Calendar Card */}
      <div style={{ background: '#fff', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', margin: 0 }}>
            {monthNames[month]} {year}
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={prevMonth} style={{ background: '#f8fafc', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '0.375rem', color: '#64748b', display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={20} />
            </button>
            <button onClick={nextMonth} style={{ background: '#f8fafc', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: '0.375rem', color: '#64748b', display: 'flex', alignItems: 'center' }}>
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Day name labels — same grid as calendar cells */}
        <div style={{ ...gridStyle, marginBottom: '4px' }}>
          {dayNames.map((day) => (
            <div key={day} style={{
              fontSize: '0.625rem',
              fontWeight: 700,
              color: '#9ca3af',
              letterSpacing: '0.05em',
              paddingBottom: '0.5rem',
              textAlign: 'center',
            }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid — aligned cells with dots */}
        <div style={gridStyle}>
          {calendarDays.map((cell, index) => {
            const dateKey = getDateKey(cell.date);
            const dayEvents = eventDates[dateKey] || [];
            const isSelected = selectedDateKey === dateKey;
            const hasCritical = dayEvents.some((e) => e.urgency === 'critical');
            const hasEvents = dayEvents.length > 0 && cell.isCurrentMonth;
            const dotColor = hasCritical ? '#ef4444' : '#8b5cf6';

            return (
              <div
                key={index}
                onClick={() => handleDateClick(cell)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2px 0',
                  cursor: 'pointer',
                  userSelect: 'none',
                  minHeight: '44px',
                }}
              >
                {/* Day number */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  fontSize: '0.8125rem',
                  fontWeight: isSelected ? 700 : (cell.isToday ? 600 : 500),
                  color: isSelected ? '#fff' : cell.isToday ? '#10b981' : cell.isCurrentMonth ? '#334155' : '#cbd5e1',
                  background: isSelected ? '#111827' : cell.isToday ? '#ecfdf5' : 'transparent',
                  boxShadow: isSelected ? '0 4px 12px rgba(17,24,39,0.2)' : 'none',
                  transition: 'all 0.15s ease',
                }}>
                  {cell.day}
                </div>

                {/* Event dot(s) */}
                <div style={{ height: '6px', display: 'flex', alignItems: 'center', gap: '2px', marginTop: '2px' }}>
                  {hasEvents && (
                    <>
                      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: dotColor }} />
                      {dayEvents.length > 1 && (
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: dotColor, opacity: 0.45 }} />
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.6875rem', color: '#64748b' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6' }} />
            Assignment
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.6875rem', color: '#64748b' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
            Urgent (&lt;24h)
          </div>
        </div>
      </div>

      {/* Timeline — selected date detail */}
      <div style={{ padding: '0 0.25rem' }}>
        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={16} />
          {selectedDateFormatted}
        </h4>

        {selectedEvents.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '1.25rem' }}>
            <div style={{ position: 'absolute', left: '7px', top: '10px', bottom: '10px', width: '2px', background: '#e2e8f0', borderRadius: '2px' }} />

            {selectedEvents.map((event, i) => {
              const eventDate = new Date(event.timestart * 1000);
              const timeStr = eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              const isUrgent = event.urgency === 'critical';
              const dotColor = isUrgent ? '#ef4444' : '#3b82f6';
              const bgColor = isUrgent ? '#fef2f2' : '#eff6ff';

              // Build SCELE link from event URL
              const sceleUrl = event.url || null;

              return (
                <div key={event.id} style={{ position: 'relative', marginBottom: i === selectedEvents.length - 1 ? 0 : '1.5rem' }}>
                  <div style={{ position: 'absolute', left: '-1.25rem', top: '0.375rem', width: '12px', height: '12px', borderRadius: '50%', background: dotColor, border: '3px solid #fff', boxShadow: '0 0 0 1px #e2e8f0', transform: 'translateX(-2px)', zIndex: 2 }} />
                  <div style={{ background: '#fff', borderRadius: '12px', padding: '1rem', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: dotColor, background: bgColor, padding: '0.125rem 0.5rem', borderRadius: '6px' }}>
                        {timeStr}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isUrgent && <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#ef4444' }}>Urgent</span>}
                        {sceleUrl && (
                          <a
                            href={sceleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: '#3b82f6', display: 'flex', alignItems: 'center' }}
                            title="Buka di SCELE"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem', lineHeight: 1.3 }}>
                      {event.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: event.description ? '0.75rem' : 0 }}>
                      <FileText size={12} />
                      {event.courseName}
                    </div>
                    {event.description && (
                      <div
                        style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5, background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #f1f5f9', wordBreak: 'break-word', overflowWrap: 'anywhere', overflow: 'hidden' }}
                        dangerouslySetInnerHTML={{ __html: event.description }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af', border: '1px dashed #e2e8f0', borderRadius: '16px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌴</div>
            <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>No events on this date.</p>
            <p style={{ fontSize: '0.75rem' }}>You can relax!</p>
          </div>
        )}
      </div>
    </div>
  );
}
