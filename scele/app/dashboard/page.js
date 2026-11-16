'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CourseCard from '../components/CourseCard';
import EventCard from '../components/EventCard';
import CalendarWidget from '../components/CalendarWidget';
import NotificationBanner from '../components/NotificationBanner';
import BubbleTabs from '../components/BubbleTabs';
import NotesWidget from '../components/NotesWidget';
import AIChatWidget from '../components/AIChatWidget';
import { RefreshCw, BookOpen, PartyPopper, LogOut, Bell } from 'lucide-react';
import { playNotificationSound } from '@/lib/sound';

// Poll interval: 5 minutes
const POLL_INTERVAL_MS = 5 * 60 * 1000;

// Key for tracking known event IDs in localStorage
const KNOWN_EVENTS_KEY = 'scele_known_event_ids';

function getKnownEventIds() {
  try {
    return JSON.parse(localStorage.getItem(KNOWN_EVENTS_KEY) || '[]');
  } catch { return []; }
}

function setKnownEventIds(ids) {
  try {
    localStorage.setItem(KNOWN_EVENTS_KEY, JSON.stringify(ids));
  } catch { /* ignore */ }
}

/**
 * Show a local browser notification for a new event.
 * Works when the user has granted Notification permission.
 */
function showLocalNotification(event) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const eventDate = new Date(event.timestart * 1000);
    const timeStr = eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

    // Build deep-link URL
    let targetUrl = null;
    if (event.url) {
      targetUrl = event.url;
    } else if (event.action?.url) {
      targetUrl = event.action.url;
    } else if (event.modulename === 'assign' && event.instance) {
      targetUrl = `https://scele.cs.ui.ac.id/mod/assign/view.php?id=${event.instance}`;
    } else if (event.modulename === 'quiz' && event.instance) {
      targetUrl = `https://scele.cs.ui.ac.id/mod/quiz/view.php?id=${event.instance}`;
    }

    const notif = new Notification(`📋 ${event.name}`, {
      body: `${event.courseName || 'SCELE'}\n${dateStr} ${timeStr} — ${event.timeLeftText || ''}`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `event-${event.id}`,
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
      if (targetUrl) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    };
  } catch (err) {
    console.error('Local notification failed:', err);
  }
}

function DashboardContent() {
  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('grades');
  const router = useRouter();
  const searchParams = useSearchParams();
  const pollTimerRef = useRef(null);

  // Initialize active tab from URL query param (e.g., /dashboard?tab=events)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['grades', 'events', 'calendar', 'notes'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const storedUser = localStorage.getItem('scele_user') || sessionStorage.getItem('scele_user');
    if (!storedUser) {
      router.replace('/');
      return;
    }

    const userData = JSON.parse(storedUser);
    setUser(userData);

    // ── Step 1: Instantly hydrate from cache ──────────────────────────────
    const cachedCourses = localStorage.getItem('scele_courses');
    const cachedEvents  = localStorage.getItem('scele_events');

    if (cachedCourses) {
      try { setCourses(JSON.parse(cachedCourses)); } catch { /* ignore */ }
    }
    if (cachedEvents) {
      try { setEvents(JSON.parse(cachedEvents)); } catch { /* ignore */ }
    }

    // If we have cache, don't show the skeleton — background refresh instead
    const hasCache = !!cachedCourses;
    if (hasCache) setLoading(false);

    // ── Step 2: Background fetch to update cache ──────────────────────────
    fetchData(userData.userId, !hasCache);

    // ── Step 3: Start polling for new events ──────────────────────────────
    pollTimerRef.current = setInterval(() => {
      pollForNewEvents(userData.userId);
    }, POLL_INTERVAL_MS);

    // Listen for service worker push messages to play sound
    let handler;
    if ('serviceWorker' in navigator) {
      handler = (event) => {
        if (event.data?.type === 'PLAY_SOUND') {
          playNotificationSound(event.data.soundType || 'generic');
        }
      };
      navigator.serviceWorker.addEventListener('message', handler);
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (handler && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handler);
      }
    };
  }, [router]);

  /**
   * Poll for new events and fire local notifications for any new ones.
   */
  async function pollForNewEvents(userId) {
    try {
      const res = await fetch(`/api/events?userId=${userId}`);
      if (!res.ok) return;

      const data = await res.json();
      const freshEvents = data.events || [];

      if (freshEvents.length === 0) return;

      // Check against known event IDs
      const knownIds = getKnownEventIds();
      const knownSet = new Set(knownIds);
      const newEvents = freshEvents.filter(e => !knownSet.has(e.id));

      if (newEvents.length > 0) {
        try { playNotificationSound('event'); } catch { /* ignore */ }

        for (const event of newEvents) {
          showLocalNotification(event);
        }

        const allIds = freshEvents.map(e => e.id);
        setKnownEventIds(allIds);

        setEvents(freshEvents);
        try { localStorage.setItem('scele_events', JSON.stringify(freshEvents)); } catch { /* ignore */ }
      }
    } catch (err) {
      console.error('Poll for events failed:', err);
    }
  }

  async function fetchData(userId, showSpinner = false) {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);

    try {
      const [gradesRes, eventsRes, userRes] = await Promise.all([
        fetch(`/api/grades?userId=${userId}`),
        fetch(`/api/events?userId=${userId}`),
        fetch(`/api/user?userId=${userId}`),
      ]);

      if (gradesRes.ok) {
        const gradesData = await gradesRes.json();
        const courseList = gradesData.courses || [];
        setCourses(courseList);
        try { localStorage.setItem('scele_courses', JSON.stringify(courseList)); } catch { /* ignore */ }
      }

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        const eventList = eventsData.events || [];
        setEvents(eventList);
        try { localStorage.setItem('scele_events', JSON.stringify(eventList)); } catch { /* ignore */ }

        const knownIds = getKnownEventIds();
        if (knownIds.length === 0) {
          setKnownEventIds(eventList.map(e => e.id));
        }
      }

      if (userRes.ok) {
        const userData = await userRes.json();
        if (userData.success && userData.user) {
          setUser(prevUser => ({ ...prevUser, ...userData.user }));
          if (localStorage.getItem('scele_user')) {
            localStorage.setItem('scele_user', JSON.stringify(userData.user));
          } else if (sessionStorage.getItem('scele_user')) {
            sessionStorage.setItem('scele_user', JSON.stringify(userData.user));
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('scele_user');
    localStorage.removeItem('scele_courses');
    localStorage.removeItem('scele_events');
    localStorage.removeItem(KNOWN_EVENTS_KEY);
    sessionStorage.removeItem('scele_user');
    router.replace('/');
  }

  async function handleTestNotification() {
    try {
      const res = await fetch('/api/test-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Gagal mengirim notifikasi test');
      }
    } catch (err) {
      console.error('Test notification failed:', err);
      alert('Gagal mengirim notifikasi test');
    }
  }

  if (!user) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'slideUp 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <div style={{ background: 'white', padding: '1.25rem', borderRadius: '1.25rem', boxShadow: '0 8px 32px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
            <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderColor: 'rgba(15,23,42,0.1)', borderTopColor: '#0f172a' }} />
          </div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>SCELE Notif</h2>
          <p style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.25rem' }}>Preparing your dashboard...</p>
        </div>
      </div>
    );
  }

  // Parse clean first name (remove NIM numbers)
  const cleanName = user.fullname
    ? user.fullname.replace(/[-–]?\s*\d{10,}.*$/i, '').trim()
    : '';
  const firstName = cleanName.split(' ')[0] || cleanName;

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 20 ? 'Good evening' : 'Good night';

  const courseCount = courses.length;
  const eventCount = events.length;

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '3rem' }}>
      <div className="container dashboard">
        {/* Hero Header Card */}
        <div className="hero-header stagger-item">
          <div className="hero-header-bg" />
          <div className="hero-header-content">
            <div className="hero-avatar">
              {user.userpictureurl ? (
                <img src={user.userpictureurl} alt={cleanName} referrerPolicy="no-referrer" />
              ) : (
                <span>{cleanName.charAt(0)}</span>
              )}
            </div>
            <div className="hero-info">
              <div className="hero-greeting">{greeting},</div>
              <div className="hero-name">{firstName} 👋</div>
              <div className="hero-username">@{user.username}</div>
            </div>
            <div className="hero-actions">
              <button
                className="icon-btn hero-btn"
                onClick={handleTestNotification}
                title="Test Push Notification"
              >
                <Bell size={16} />
              </button>
              <button
                className="icon-btn hero-btn"
                onClick={() => fetchData(user.userId, false)}
                title="Refresh"
                disabled={refreshing || loading}
              >
                <span className={refreshing || loading ? 'spinner' : ''} style={refreshing || loading ? { width: 16, height: 16, borderWidth: 2 } : {}}>
                  {!(refreshing || loading) && <RefreshCw size={16} />}
                </span>
              </button>
              <button
                className="icon-btn hero-btn"
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Notification Banner */}
        <div className="stagger-item">
          <NotificationBanner userId={user.userId} />
        </div>

        {/* Tabs — iPhone Camera-style bubble selector */}
        <div className="stagger-item">
          <BubbleTabs
            tabs={[
              { key: 'grades', label: courseCount ? `Courses (${courseCount})` : 'Courses' },
              { key: 'events', label: eventCount ? `Assignments (${eventCount})` : 'Assignments' },
              { key: 'calendar', label: 'Calendar' },
              { key: 'notes', label: 'Notes' },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        {/* Content */}
        <div className="dashboard-content">
          {/* Grades Tab */}
          <div style={{ display: activeTab === 'grades' ? 'block' : 'none' }}>
            {loading && courses.length === 0 ? (
              <div className="stagger-item">
                {[1, 2, 3].map(i => (
                  <div key={i} className="course-card skeleton" style={{ height: 100 }} />
                ))}
              </div>
            ) : courses.length > 0 ? (
              <div className="courses-grid-responsive">
                {courses.map(course => (
                  <CourseCard key={course.id} course={course} userId={user.userId} />
                ))}
              </div>
            ) : (
              <div className="empty-state stagger-item">
                <div className="empty-state-icon"><BookOpen size={48} strokeWidth={1.5} /></div>
                <div className="empty-state-text">No active courses</div>
              </div>
            )}
          </div>

          {/* Events Tab */}
          <div style={{ display: activeTab === 'events' ? 'block' : 'none' }}>
            <div className="stagger-item">
              {events.length > 0 ? (
                <div className="events-grid-responsive">
                  {events.map(event => (
                    <EventCard key={event.id} event={event} userId={user.userId} />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon"><PartyPopper size={48} strokeWidth={1.5} /></div>
                  <div className="empty-state-text">No upcoming assignments/deadlines</div>
                </div>
              )}
            </div>
          </div>

          {/* Calendar Tab */}
          <div style={{ display: activeTab === 'calendar' ? 'block' : 'none' }} className="stagger-item">
            <CalendarWidget userId={user.userId} />
          </div>

          {/* Notes Tab */}
          <div style={{ display: activeTab === 'notes' ? 'block' : 'none' }} className="stagger-item">
            <NotesWidget />
          </div>
        </div>

        {/* AI Chat Widget */}
        <AIChatWidget userId={user.userId} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
