'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ChevronLeft, ClipboardList, BookOpen, ExternalLink, Clock, CheckCircle2, Circle, Plus, Trash2, X } from 'lucide-react';
import BubbleTabs from '../../components/BubbleTabs';

// Module type config
const MOD_CONFIG = {
  assign:   { label: 'Assignment', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  quiz:     { label: 'Quiz',       color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  resource: { label: 'Resource',   color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  url:      { label: 'Link',       color: '#0891b2', bg: 'rgba(8,145,178,0.1)' },
  forum:    { label: 'Forum',      color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
  page:     { label: 'Page',       color: '#475569', bg: 'rgba(71,85,105,0.1)' },
  folder:   { label: 'Folder',     color: '#92400e', bg: 'rgba(146,64,14,0.1)' },
  workshop: { label: 'Workshop',   color: '#be185d', bg: 'rgba(190,24,93,0.1)' },
  choice:   { label: 'Choice',     color: '#0f766e', bg: 'rgba(15,118,110,0.1)' },
};

function getModConfig(modname) {
  return MOD_CONFIG[modname] || { label: modname, color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
}

function formatDate(timestamp) {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function GradeItem({ item, onDelete }) {
  const hasGrade = item.gradeformatted && item.gradeformatted !== '-';
  const hasFeedback = typeof item.feedback === 'string' && item.feedback.trim().length > 0;
  const rawGrade = parseFloat(item.graderaw);
  const maxGrade = parseFloat(item.grademax);
  const percentage = (!isNaN(rawGrade) && !isNaN(maxGrade) && maxGrade > 0)
    ? (rawGrade / maxGrade) * 100
    : 0;

  const scoreColor = !hasGrade ? '#9ca3af'
    : percentage >= 85 ? '#059669'
    : percentage >= 70 ? '#3b82f6'
    : percentage >= 55 ? '#d97706'
    : '#ef4444';

  return (
    <div className="detail-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>
            {item.itemname || 'Item'}
          </div>
          {item.percentageformatted && item.percentageformatted !== '-' && (
            <div style={{ fontSize: '0.6875rem', color: '#9ca3af', fontFamily: 'monospace', marginTop: '0.25rem' }}>
              {item.percentageformatted}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: scoreColor }}>
            {hasGrade ? item.gradeformatted : '—'}
          </span>
          <span style={{ fontSize: '0.6875rem', color: '#9ca3af', marginLeft: '0.25rem' }}>
            / {item.grademax}
          </span>
        </div>
      </div>

      {item.isManual && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.625rem' }}>
          <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#d97706', background: 'rgba(217,119,6,0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>Manual</span>
          <button onClick={() => onDelete(item.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
            <Trash2 size={12} /> Hapus
          </button>
        </div>
      )}

      {/* Score bar */}
      {hasGrade && (
        <div style={{ height: '3px', background: '#f1f5f9', borderRadius: '2px', marginTop: '0.625rem', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(percentage, 100)}%`, background: scoreColor, borderRadius: '2px', transition: 'width 0.8s ease' }} />
        </div>
      )}

      {hasFeedback && (
        <div style={{ marginTop: '0.625rem', padding: '0.5rem 0.625rem', background: '#f8fafc', borderRadius: '6px', borderLeft: '3px solid #e2e8f0', fontSize: '0.75rem', color: '#475569', lineHeight: 1.5 }}
          dangerouslySetInnerHTML={{ __html: item.feedback }} />
      )}
    </div>
  );
}

function ModuleItem({ mod }) {
  const cfg = getModConfig(mod.modname);
  const dueDate = mod.dates?.find(d => d.datetype === 'duedate');
  const isCompleted = mod.completiondata?.state === 1;

  return (
    <div className="detail-card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
      <div style={{ width: 36, height: 36, minWidth: 36, borderRadius: '8px', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isCompleted
          ? <CheckCircle2 size={18} color={cfg.color} />
          : <Circle size={18} color={cfg.color} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>
            {mod.name}
          </div>
          <span style={{ fontSize: '0.625rem', fontWeight: 600, color: cfg.color, background: cfg.bg, padding: '0.15rem 0.4rem', borderRadius: '4px', whiteSpace: 'nowrap' }}>
            {cfg.label}
          </span>
        </div>
        {dueDate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem', fontSize: '0.6875rem', color: '#9ca3af' }}>
            <Clock size={11} />
            <span>Deadline: {formatDate(dueDate.timestamp)}</span>
          </div>
        )}
      </div>
      {mod.url && (
        <a href={mod.url} target="_blank" rel="noopener noreferrer" style={{ color: '#9ca3af', marginTop: '0.125rem' }}>
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}

function CoursePageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params?.id || '';
  const router = useRouter();
  const initialName = searchParams.get('name') || '';

  const [courseName, setCourseName] = useState(initialName || 'Course');
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('nilai');

  // Look up course fullname from cached courses if searchParams is empty
  useEffect(() => {
    if (initialName) {
      setCourseName(initialName);
      return;
    }
    try {
      const cached = localStorage.getItem('scele_courses');
      if (cached) {
        const list = JSON.parse(cached);
        const found = list.find((c) => String(c.id) === String(courseId));
        if (found) setCourseName(found.fullname || found.shortname || 'Course');
      }
    } catch (e) {}
  }, [courseId, initialName]);

  const [gradeItems, setGradeItems] = useState([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [gradesFetched, setGradesFetched] = useState(false);

  const [sections, setSections] = useState([]);
  const [contentsLoading, setContentsLoading] = useState(false);
  const [contentsFetched, setContentsFetched] = useState(false);

  const [manualGrades, setManualGrades] = useState([]);
  const [showAddGrade, setShowAddGrade] = useState(false);
  const [newGrade, setNewGrade] = useState({ name: '', grade: '', max: '100' });

  // Load manual grades from localStorage
  useEffect(() => {
    if (user && courseId) {
      const stored = localStorage.getItem(`scele_manual_grades_${user.userId}_${courseId}`);
      if (stored) {
        try {
          setManualGrades(JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [user, courseId]);

  const saveManualGrades = (grades) => {
    setManualGrades(grades);
    if (user && courseId) {
      localStorage.setItem(`scele_manual_grades_${user.userId}_${courseId}`, JSON.stringify(grades));
    }
  };

  const handleAddManualGrade = (e) => {
    e.preventDefault();
    if (!newGrade.name || !newGrade.grade || !newGrade.max) return;
    
    const newItem = {
      id: `manual_${Date.now()}`,
      itemname: newGrade.name,
      graderaw: parseFloat(newGrade.grade),
      grademax: parseFloat(newGrade.max),
      gradeformatted: parseFloat(newGrade.grade).toFixed(2),
      isManual: true,
      timestamp: Date.now()
    };
    
    saveManualGrades([...manualGrades, newItem]);
    setShowAddGrade(false);
    setNewGrade({ name: '', grade: '', max: '100' });
  };

  const handleDeleteManualGrade = (id) => {
    saveManualGrades(manualGrades.filter(g => g.id !== id));
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('scele_user') || sessionStorage.getItem('scele_user');
    if (!storedUser) { router.push('/'); return; }
    const userData = JSON.parse(storedUser);
    setUser(userData);
    fetchGrades(courseId, userData.userId);
  }, [courseId, router]);

  async function fetchGrades(cId, uId) {
    setGradesLoading(true);
    try {
      const res = await fetch(`/api/grades/${cId}?userId=${uId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setGradeItems(data.items || []);
      }
    } catch (e) { console.error(e); }
    finally { setGradesLoading(false); setGradesFetched(true); }
  }

  async function fetchContents(uId) {
    if (contentsFetched) return;
    setContentsLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/contents?userId=${uId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setSections(data.sections || []);
      }
    } catch (e) { console.error(e); }
    finally { setContentsLoading(false); setContentsFetched(true); }
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    if (tab === 'konten' && user && !contentsFetched) {
      fetchContents(user.userId);
    }
  }

  // Clean course name (remove "[Reg]", year, class info)
  const cleanCourseName = String(courseName || 'Course')
    .replace(/^\[Reg\]\s*/i, '')
    .replace(/\s+Gasal\s+\d{4}\/\d{4}.*/i, '')
    .replace(/\s+\([A-H,]+\).*/i, '')
    .trim() || 'Course';

  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: '4rem' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', background: '#fff', minHeight: '100vh', position: 'relative' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 100%), url(https://enrollment-api.ui.ac.id/uploads/20250922072406_Edited-9722.jpg) center/cover',
        padding: '3rem 1.25rem 2rem',
      }}>
        <button
          onClick={() => router.back()}
          onPointerDown={e => {
            e.currentTarget.style.transform = 'scale(0.90)';
            e.currentTarget.style.transition = 'transform 0.08s cubic-bezier(0.4,0,1,1)';
          }}
          onPointerUp={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.transition = 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1)';
          }}
          onPointerCancel={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.transition = 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1)';
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', borderRadius: '8px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer', marginBottom: '1.25rem', backdropFilter: 'blur(8px)', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', willChange: 'transform', transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1)' }}
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', lineHeight: 1.3, marginBottom: '0.25rem' }}>
          {cleanCourseName}
        </h1>
        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace' }}>
          {courseName.match(/Gasal \d{4}\/\d{4}/)?.[0] || ''}
        </p>
      </div>

      {/* Section Nav — sticky top, dark glassmorphism like dashboard */}
      <div style={{ padding: '0.5rem 1rem', position: 'sticky', top: 0, zIndex: 10, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid #f1f5f9' }}>
        <BubbleTabs
          tabs={[
            { 
              key: 'nilai', 
              label: (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                  <ClipboardList size={14} /> Grades
                </div>
              ) 
            },
            { 
              key: 'konten', 
              label: (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                  <BookOpen size={14} /> Content & Schedule
                </div>
              ) 
            },
          ]}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      </div>

      <div style={{ padding: '1.25rem' }}>
        {/* NILAI TAB */}
        {activeTab === 'nilai' && (
          gradesLoading ? (
            <LoadingState />
          ) : (gradeItems.length > 0 || manualGrades.length > 0) ? (() => {
            const allGrades = [...gradeItems, ...manualGrades];
            // Calculate average from graded items only
            const graded = allGrades.filter(item =>
              item.graderaw !== null && item.graderaw !== undefined &&
              item.graderaw !== '' && parseFloat(item.grademax) > 0 &&
              item.gradeformatted && item.gradeformatted !== '-'
            );
            const avgPct = graded.length > 0
              ? graded.reduce((sum, item) => sum + (parseFloat(item.graderaw) / parseFloat(item.grademax)) * 100, 0) / graded.length
              : null;
            const avgColor = avgPct === null ? '#9ca3af'
              : avgPct >= 85 ? '#059669'
              : avgPct >= 70 ? '#3b82f6'
              : avgPct >= 55 ? '#d97706'
              : '#ef4444';
            const avgLabel = avgPct === null ? '—'
              : avgPct >= 85 ? 'Excellent'
              : avgPct >= 70 ? 'Good'
              : avgPct >= 55 ? 'Fair'
              : 'Needs Improvement';

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {/* Average summary card */}
                <div style={{
                  background: `linear-gradient(135deg, ${avgColor}15, ${avgColor}08)`,
                  border: `1px solid ${avgColor}30`,
                  borderRadius: '14px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.375rem',
                }}>
                  <div>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                      Average Grade
                    </div>
                    <div style={{ fontSize: '0.75rem', color: avgColor, fontWeight: 600 }}>
                      {avgLabel} · {graded.length} of {allGrades.length} items graded
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: avgColor, lineHeight: 1 }}>
                      {avgPct !== null ? avgPct.toFixed(1) : '—'}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '0.125rem' }}>%</div>
                  </div>
                </div>

                {/* Add Manual Grade Button (Sleek, at the top) */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.25rem', marginBottom: '0.125rem' }}>
                  <button 
                    onClick={() => setShowAddGrade(true)}
                    style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', padding: '0.25rem' }}
                  >
                    <Plus size={14} /> Tambah Manual
                  </button>
                </div>

                {/* Grade items */}
                {allGrades.map(item => <GradeItem key={item.id} item={item} onDelete={handleDeleteManualGrade} />)}
              </div>
            );
          })() : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <EmptyState text="No grades available for this course yet." />
              <button 
                onClick={() => setShowAddGrade(true)}
                style={{ width: '100%', padding: '0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#475569', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', cursor: 'pointer' }}
              >
                <Plus size={16} /> Tambah Nilai Manual
              </button>
            </div>
          )
        )}

        {/* KONTEN TAB */}
        {activeTab === 'konten' && (
          contentsLoading ? (
            <LoadingState />
          ) : sections.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {sections.map(section => (
                <div key={section.id}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.625rem' }}>
                    {section.name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {section.modules.map(mod => <ModuleItem key={mod.id} mod={mod} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="No content available for this course yet." />
          )
        )}
      </div>

      {/* Add Manual Grade Modal */}
      {showAddGrade && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: 360, padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>Tambah Nilai Manual</h3>
              <button onClick={() => setShowAddGrade(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddManualGrade} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.375rem' }}>Nama Kuis / Tugas</label>
                <input 
                  type="text" 
                  required
                  value={newGrade.name}
                  onChange={e => setNewGrade({...newGrade, name: e.target.value})}
                  placeholder="Contoh: Kuis 1 (Kertas)"
                  style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.375rem' }}>Nilai</label>
                  <input 
                    type="number" 
                    required
                    step="any"
                    value={newGrade.grade}
                    onChange={e => setNewGrade({...newGrade, grade: e.target.value})}
                    placeholder="85"
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.375rem' }}>Maks. Nilai</label>
                  <input 
                    type="number" 
                    required
                    step="any"
                    value={newGrade.max}
                    onChange={e => setNewGrade({...newGrade, max: e.target.value})}
                    style={{ width: '100%', padding: '0.625rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  />
                </div>
              </div>
              
              <button type="submit" style={{ marginTop: '0.5rem', width: '100%', padding: '0.75rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
                Simpan Nilai
              </button>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default function CoursePage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <span className="spinner" />
      </div>
    }>
      <CoursePageInner />
    </Suspense>
  );
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.5rem' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />
      ))}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af' }}>
      <BookOpen size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
      <p style={{ fontSize: '0.875rem' }}>{text}</p>
    </div>
  );
}
