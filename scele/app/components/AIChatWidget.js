'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Zap,
  BookOpen,
  Calendar,
  BarChart3,
  Clock,
  Lightbulb,
  ChevronDown,
} from 'lucide-react';

const QUICK_PROMPTS = [
  { icon: <Zap size={14} />, label: 'Deadline urgent', prompt: 'Apa saja deadline yang paling urgent saat ini? Prioritaskan untukku.' },
  { icon: <BarChart3 size={14} />, label: 'Analisis nilai', prompt: 'Analisis nilai-nilaiku di semua mata kuliah. Mana yang perlu ditingkatkan?' },
  { icon: <Calendar size={14} />, label: 'Study plan', prompt: 'Buatkan jadwal belajar untuk minggu ini berdasarkan deadline yang ada.' },
  { icon: <BookOpen size={14} />, label: 'Ringkasan', prompt: 'Berikan ringkasan lengkap kondisi kuliahku saat ini.' },
  { icon: <Clock size={14} />, label: 'Hari ini', prompt: 'Apa yang harus aku kerjakan hari ini?' },
  { icon: <Lightbulb size={14} />, label: 'Tips belajar', prompt: 'Kasih tips belajar efektif untuk matkul yang nilaiku rendah.' },
];

/**
 * Generate a simple unique ID
 */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function AIChatWidget({ userId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Lock background page scroll when chat is open
  useEffect(() => {
    if (isOpen) {
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
      };
    }
  }, [isOpen]);

  // Check scroll position for scroll-down indicator
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollDown(!isNearBottom);
  }, []);

  /**
   * Send a message and stream the AI response
   */
  async function sendMessage(text) {
    if (!text.trim() || isLoading) return;

    const userMessage = { id: uid(), role: 'user', content: text };
    const assistantMessage = { id: uid(), role: 'assistant', content: '' };

    // Add user message + empty assistant message
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    // Build message history for API (only role + content)
    const history = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, userId }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `API error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            updated[updated.length - 1] = { ...lastMsg, content: accumulated };
          }
          return updated;
        });
      }

      if (!accumulated.trim()) {
        throw new Error('AI tidak memberikan jawaban (respons kosong). Silakan coba lagi.');
      }
    } catch (err) {
      if (err.name === 'AbortError') return;

      setError(err.message || 'Gagal mendapat respons AI');
      // Remove the empty assistant message on error
      setMessages(prev => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1].role === 'assistant' && !updated[updated.length - 1].content) {
          updated.pop();
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }

  function handleSubmit(e) {
    e?.preventDefault?.();
    sendMessage(input);
  }

  function handleQuickPrompt(prompt) {
    sendMessage(prompt);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        sendMessage(input);
      }
    }
  }

  function handleRetry() {
    setError(null);
    // Get the last user message and retry
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      // Remove the failed assistant message
      setMessages(prev => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
          updated.pop();
        }
        return updated;
      });
      sendMessage(lastUserMsg.content);
    }
  }

  // Format markdown-like responses
  function formatMessage(content) {
    if (!content) return '';

    const lines = content.split('\n');
    let html = '';
    let inList = false;

    for (const line of lines) {
      // Bold
      let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Italic
      processed = processed.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
      // Inline code
      processed = processed.replace(/`(.*?)`/g, '<code>$1</code>');

      // Bullet points
      if (/^\s*[-•]\s/.test(processed)) {
        if (!inList) {
          html += '<ul>';
          inList = true;
        }
        html += `<li>${processed.replace(/^\s*[-•]\s/, '')}</li>`;
        continue;
      } else if (inList) {
        html += '</ul>';
        inList = false;
      }

      // Numbered list
      if (/^\s*\d+[.)]\s/.test(processed)) {
        html += `<div class="ai-list-item">${processed}</div>`;
        continue;
      }

      // Headers
      if (/^###\s/.test(processed)) {
        html += `<h4 class="ai-h4">${processed.replace(/^###\s/, '')}</h4>`;
        continue;
      }
      if (/^##\s/.test(processed)) {
        html += `<h3 class="ai-h3">${processed.replace(/^##\s/, '')}</h3>`;
        continue;
      }

      // Empty line
      if (processed.trim() === '') {
        html += '<br/>';
        continue;
      }

      html += `<p>${processed}</p>`;
    }

    if (inList) html += '</ul>';
    return html;
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        className={`ai-fab ${isOpen ? 'ai-fab--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="SCELE AI Assistant"
        aria-label="Toggle AI Chat"
      >
        <span className="ai-fab-icon">
          <Sparkles size={22} />
        </span>
        {!isOpen && messages.length === 0 && (
          <span className="ai-fab-pulse" />
        )}
      </button>

      {/* Chat Panel */}
      <div className={`ai-chat-panel ${isOpen ? 'ai-chat-panel--open' : ''}`}>
        {/* Header */}
        <div className="ai-chat-header">
          <div className="ai-chat-header-info">
            <div className="ai-chat-avatar">
              <Bot size={18} />
            </div>
            <div>
              <div className="ai-chat-title">SCELE AI</div>
              <div className="ai-chat-subtitle">
                {isLoading ? (
                  <span className="ai-typing-indicator">
                    <span></span><span></span><span></span>
                  </span>
                ) : 'Powered by Gemini'}
              </div>
            </div>
          </div>
          <button className="ai-chat-close" onClick={() => setIsOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div
          className="ai-chat-messages"
          ref={messagesContainerRef}
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <div className="ai-welcome">
              <div className="ai-welcome-icon">
                <Sparkles size={28} />
              </div>
              <h3>Halo! 👋</h3>
              <p>Aku SCELE AI, asisten pintar yang bisa bantu kamu soal kuliah. Tanya apa aja!</p>

              <div className="ai-quick-prompts">
                {QUICK_PROMPTS.map((qp, i) => (
                  <button
                    key={i}
                    className="ai-quick-btn"
                    onClick={() => handleQuickPrompt(qp.prompt)}
                  >
                    {qp.icon}
                    <span>{qp.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`ai-message ${msg.role === 'user' ? 'ai-message--user' : 'ai-message--assistant'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="ai-message-avatar">
                      <Bot size={14} />
                    </div>
                  )}
                  <div className="ai-message-bubble">
                    {msg.role === 'user' ? (
                      <p>{msg.content}</p>
                    ) : msg.content ? (
                      <div
                        className="ai-message-content"
                        dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                      />
                    ) : isLoading ? (
                      <span className="ai-typing-dots">
                        <span></span><span></span><span></span>
                      </span>
                    ) : (
                      <p style={{ opacity: 0.6, fontStyle: 'italic', margin: 0 }}>Gagal memuat pesan.</p>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="ai-message-avatar ai-message-avatar--user">
                      <User size={14} />
                    </div>
                  )}
                </div>
              ))}

              {error && (
                <div className="ai-error">
                  <p>⚠️ {error}</p>
                  <button onClick={handleRetry}>Coba lagi</button>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll down indicator */}
        {showScrollDown && (
          <button className="ai-scroll-down" onClick={() => scrollToBottom()}>
            <ChevronDown size={16} />
          </button>
        )}

        {/* Quick prompts strip (shown when conversation is active) */}
        {messages.length > 0 && !isLoading && (
          <div className="ai-quick-strip">
            {QUICK_PROMPTS.slice(0, 4).map((qp, i) => (
              <button
                key={i}
                className="ai-quick-chip"
                onClick={() => handleQuickPrompt(qp.prompt)}
              >
                {qp.icon}
                <span>{qp.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form
          className="ai-chat-input-form"
          onSubmit={handleSubmit}
        >
          <div className="ai-chat-input-wrapper">
            <textarea
              ref={inputRef}
              className="ai-chat-input"
              placeholder="Tanya seputar kuliah..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="ai-send-btn"
              disabled={isLoading || !input.trim()}
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="ai-backdrop"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
