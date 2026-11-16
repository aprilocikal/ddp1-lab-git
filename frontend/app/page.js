'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GraduationCap, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // `checking` = true while we verify localStorage so we never flash the form
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  // Redirect automatically if already logged in — run synchronously before paint
  useEffect(() => {
    const storedUser = localStorage.getItem('scele_user') || sessionStorage.getItem('scele_user');
    if (storedUser) {
      // replace so back-button won't return to login
      router.replace('/dashboard');
    } else {
      setChecking(false); // no session found, show the form
    }
  }, [router]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let res;
      try {
        res = await fetch('/api/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password }),
        });
      } catch {
        // Network-level failure (e.g. Vercel cold start, DNS, offline)
        setError('Tidak dapat terhubung ke server. Periksa koneksi internet dan coba lagi.');
        setLoading(false);
        return;
      }

      let data;
      try {
        data = await res.json();
      } catch {
        setError('Server mengembalikan respons yang tidak valid. Coba lagi.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Login gagal');
      }

      // Simpan user info berdasarkan preferensi "Ingat Saya"
      if (rememberMe) {
        localStorage.setItem('scele_user', JSON.stringify(data.user));
      } else {
        sessionStorage.setItem('scele_user', JSON.stringify(data.user));
      }
      
      // Redirect ke dashboard
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // While checking auth or redirecting, show a smooth splash screen
  if (checking) {
    return (
      <main className="login-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="login-bubble login-bubble-1" aria-hidden="true" />
        <div className="login-bubble login-bubble-2" aria-hidden="true" />
        <div className="login-logo stagger-item" style={{ animation: 'slideUp 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <div className="login-logo-icon" style={{ margin: '0 auto 1.5rem', width: 64, height: 64 }}>
            <GraduationCap size={40} color="#0f172a" strokeWidth={1.5} />
          </div>
          <h1>SCELE Notif</h1>
          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
            <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3, borderColor: 'rgba(15,23,42,0.1)', borderTopColor: '#0f172a' }} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="login-page">
      {/* Floating bubble elements */}
      <div className="login-bubble login-bubble-1" aria-hidden="true" />
      <div className="login-bubble login-bubble-2" aria-hidden="true" />
      <div className="login-bubble login-bubble-3" aria-hidden="true" />
      <div className="login-bubble login-bubble-4" aria-hidden="true" />
      <div className="login-bubble login-bubble-5" aria-hidden="true" />
      <div className="login-bubble login-bubble-6" aria-hidden="true" />

      <div className="login-logo stagger-item">
        <div className="login-logo-icon"><GraduationCap size={36} color="#0f172a" strokeWidth={1.5} /></div>
        <h1>SCELE Notif</h1>
        <p>Monitor grades & deadlines without the hassle</p>
      </div>

      <div className="login-form stagger-item">
        <form className="login-card" onSubmit={handleLogin}>
          {error && (
            <div className="alert alert-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="input-group">
            <label className="input-label" htmlFor="username">Username SSO UI</label>
            <input
              id="username"
              type="text"
              className="input"
              placeholder="e.g.: aprilo.cikal"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="password">Password SSO UI</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <input
              id="remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#0f172a' }}
            />
            <label htmlFor="remember" className="input-label" style={{ cursor: 'pointer', margin: 0 }}>
              Remember me
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-lg"
            style={{ marginTop: '0.5rem', background: '#0f172a', color: 'white', fontWeight: 600 }}
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" />
            ) : (
              'Login with SCELE'
            )}
          </button>
        </form>
      </div>
      
      <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '300px' }} className="stagger-item">
        Passwords are not stored on the server. They are only used once to obtain Moodle access tokens.
      </p>
    </main>
  );
}
