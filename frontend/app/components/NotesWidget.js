'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, X, Trash2, Pin, PinOff, Search, StickyNote } from 'lucide-react';

const NOTE_COLORS = [
  { name: 'default', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)' },
  { name: 'blue',    bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.25)' },
  { name: 'purple',  bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.25)' },
  { name: 'emerald', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)' },
  { name: 'amber',   bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)' },
  { name: 'rose',    bg: 'rgba(244,63,94,0.12)',   border: 'rgba(244,63,94,0.25)' },
];

const STORAGE_KEY = 'scele_notes';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveNotes(notes) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notes)); } catch { /* ignore */ }
}

function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/**
 * NotesWidget — Sticky-notes style note taking
 * 
 * Features:
 *   • Create, edit, delete notes
 *   • Pin important notes to top
 *   • Color-coded notes
 *   • Search/filter
 *   • Persisted in localStorage
 */
export default function NotesWidget() {
  const [notes, setNotes] = useState([]);
  const [editingNote, setEditingNote] = useState(null); // null = list view, object = editing
  const [searchQuery, setSearchQuery] = useState('');
  const titleRef = useRef(null);
  const contentRef = useRef(null);

  // Load from localStorage on mount
  useEffect(() => {
    setNotes(loadNotes());
  }, []);

  // Persist whenever notes change
  useEffect(() => {
    if (notes.length > 0 || localStorage.getItem(STORAGE_KEY)) {
      saveNotes(notes);
    }
  }, [notes]);

  // ── CRUD ──────────────────────────────────────────────
  function createNote() {
    const newNote = {
      id: generateId(),
      title: '',
      content: '',
      color: 'default',
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setEditingNote(newNote);
    // Focus title after render
    setTimeout(() => titleRef.current?.focus(), 50);
  }

  function saveCurrentNote() {
    if (!editingNote) return;

    const trimmedTitle = (editingNote.title || '').trim();
    const trimmedContent = (editingNote.content || '').trim();

    // Don't save completely empty notes
    if (!trimmedTitle && !trimmedContent) {
      setEditingNote(null);
      return;
    }

    const updated = {
      ...editingNote,
      title: trimmedTitle || 'Untitled',
      content: trimmedContent,
      updatedAt: Date.now(),
    };

    setNotes(prev => {
      const exists = prev.find(n => n.id === updated.id);
      if (exists) {
        return prev.map(n => n.id === updated.id ? updated : n);
      }
      return [updated, ...prev];
    });
    setEditingNote(null);
  }

  function deleteNote(id) {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (editingNote?.id === id) setEditingNote(null);
  }

  function togglePin(id) {
    setNotes(prev => prev.map(n =>
      n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n
    ));
    if (editingNote?.id === id) {
      setEditingNote(prev => ({ ...prev, pinned: !prev.pinned }));
    }
  }

  function setNoteColor(color) {
    if (!editingNote) return;
    setEditingNote(prev => ({ ...prev, color }));
  }

  // ── Filter & Sort ─────────────────────────────────────
  const filtered = notes
    .filter(n => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (n.title || '').toLowerCase().includes(q) ||
             (n.content || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      // Pinned first, then by updatedAt
      if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
      return b.updatedAt - a.updatedAt;
    });

  // ── Editor View ───────────────────────────────────────
  if (editingNote) {
    const colorObj = NOTE_COLORS.find(c => c.name === editingNote.color) || NOTE_COLORS[0];
    return (
      <div className="notes-editor" style={{ '--note-bg': colorObj.bg, '--note-border': colorObj.border }}>
        {/* Editor Header */}
        <div className="notes-editor-header">
          <button className="notes-back-btn" onClick={saveCurrentNote} type="button">
            <X size={18} />
            <span>Done</span>
          </button>
          <div className="notes-editor-actions">
            <button
              className={`notes-icon-btn ${editingNote.pinned ? 'notes-icon-btn--active' : ''}`}
              onClick={() => togglePin(editingNote.id)}
              title={editingNote.pinned ? 'Unpin' : 'Pin'}
              type="button"
            >
              {editingNote.pinned ? <PinOff size={16} /> : <Pin size={16} />}
            </button>
            <button
              className="notes-icon-btn notes-icon-btn--danger"
              onClick={() => deleteNote(editingNote.id)}
              title="Delete note"
              type="button"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Color Picker */}
        <div className="notes-color-picker">
          {NOTE_COLORS.map(c => (
            <button
              key={c.name}
              className={`notes-color-dot ${editingNote.color === c.name ? 'notes-color-dot--active' : ''}`}
              style={{ background: c.bg, borderColor: c.border }}
              onClick={() => setNoteColor(c.name)}
              title={c.name}
              type="button"
            />
          ))}
        </div>

        {/* Title Input */}
        <input
          ref={titleRef}
          className="notes-editor-title"
          type="text"
          placeholder="Note title..."
          value={editingNote.title}
          onChange={e => setEditingNote(prev => ({ ...prev, title: e.target.value }))}
        />

        {/* Content Textarea */}
        <textarea
          ref={contentRef}
          className="notes-editor-content"
          placeholder="Start writing..."
          value={editingNote.content}
          onChange={e => setEditingNote(prev => ({ ...prev, content: e.target.value }))}
          rows={8}
        />
      </div>
    );
  }

  // ── List View ─────────────────────────────────────────
  return (
    <div className="notes-container">
      {/* Search + Add bar */}
      <div className="notes-toolbar">
        <div className="notes-search">
          <Search size={14} className="notes-search-icon" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="notes-search-input"
          />
        </div>
        <button className="notes-add-btn" onClick={createNote} type="button">
          <Plus size={18} />
        </button>
      </div>

      {/* Notes Grid */}
      {filtered.length > 0 ? (
        <div className="notes-grid">
          {filtered.map(note => {
            const colorObj = NOTE_COLORS.find(c => c.name === note.color) || NOTE_COLORS[0];
            return (
              <button
                key={note.id}
                className="note-card"
                style={{ '--note-bg': colorObj.bg, '--note-border': colorObj.border }}
                onClick={() => setEditingNote({ ...note })}
                type="button"
              >
                {note.pinned && (
                  <div className="note-card-pin">
                    <Pin size={10} />
                  </div>
                )}
                <div className="note-card-title">{note.title || 'Untitled'}</div>
                {note.content && (
                  <div className="note-card-preview">
                    {note.content.length > 100 ? note.content.slice(0, 100) + '…' : note.content}
                  </div>
                )}
                <div className="note-card-date">{formatDate(note.updatedAt)}</div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon"><StickyNote size={48} strokeWidth={1.5} /></div>
          <div className="empty-state-text">
            {searchQuery ? 'No notes found' : 'No notes yet'}
          </div>
          {!searchQuery && (
            <button className="notes-empty-add" onClick={createNote} type="button">
              <Plus size={16} /> Create your first note
            </button>
          )}
        </div>
      )}
    </div>
  );
}
