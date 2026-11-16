'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Smartphone, BellRing, AlertCircle, Volume2 } from 'lucide-react';
import { previewSound } from '@/lib/sound';

export default function NotificationBanner({ userId, onSubscribed }) {
  const [status, setStatus] = useState('idle'); // idle, subscribing, subscribed, error, unsupported
  const [errorMsg, setErrorMsg] = useState('');
  const [bannerVisible, setBannerVisible] = useState(true);

  // Check if notifications are supported
  const isSupported = typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  // Check if already on home screen (standalone mode)
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );

  // On mount: detect if already subscribed (permission granted + existing push sub)
  useEffect(() => {
    if (!isSupported) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission !== 'granted') return;

    // Check if there's already an active push subscription
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) {
          setStatus('already_subscribed');
          // Resync to server just in case the server database was wiped (like our Redis migration)
          if (userId) {
            fetch('/api/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, subscription: sub }),
            }).catch(() => {});
          }
        }
      })
      .catch(() => {/* ignore */});
  }, [isSupported, userId]);

  async function handleSubscribe() {
    if (!isSupported) {
      setStatus('unsupported');
      return;
    }

    setStatus('subscribing');
    setErrorMsg('');

    try {
      // 1. Request notification permission (must be from user gesture!)
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setErrorMsg('Notification permission denied. Open Settings to enable.');
        setStatus('error');
        return;
      }

      // 2. Get VAPID public key from server
      const vapidRes = await fetch('/api/subscribe');
      if (!vapidRes.ok) throw new Error('Failed to fetch VAPID key');
      const { vapidPublicKey } = await vapidRes.json();

      if (!vapidPublicKey) {
        setErrorMsg('Server is not configured for push notifications.');
        setStatus('error');
        return;
      }

      // 3. Get or register service worker explicitly
      let swRegistration = await navigator.serviceWorker.getRegistration();
      if (!swRegistration) {
        swRegistration = await navigator.serviceWorker.register('/sw.js');
      }

      // Pastikan SW ready
      swRegistration = await Promise.race([
        navigator.serviceWorker.ready,
        Promise.resolve(swRegistration), // fallback langsung ke objek registrasi yang didapat
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Service Worker timed out. Try reloading the page.')), 10000)
        ),
      ]);

      // 4. Subscribe to push
      const subscription = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // 5. Send subscription to backend
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subscription }),
      });

      if (res.ok) {
        setStatus('subscribed');
        previewSound('grade'); // play signature sound on first activation
        onSubscribed?.();
      } else {
        throw new Error('Failed to save subscription');
      }
    } catch (err) {
      console.error('Subscribe error:', err);
      setErrorMsg(err.message || 'Failed to enable notifications');
      setStatus('error');
    }
  }

  // Helper: convert base64 VAPID key to Uint8Array
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Auto-dismiss subscribed banner after 5s
  useEffect(() => {
    if (status !== 'subscribed') return;
    setBannerVisible(true);
    const fadeTimer = setTimeout(() => setBannerVisible(false), 5000);
    return () => clearTimeout(fadeTimer);
  }, [status]);

  if (status === 'already_subscribed') return null;

  if (status === 'subscribed') {
    if (!bannerVisible) return null;
    return (
      <div
        className="alert alert-success"
        style={{
          animation: 'notifBannerIn 0.35s cubic-bezier(0.34,1.56,0.64,1), notifBannerOut 0.4s ease 4.6s forwards',
        }}
      >
        <CheckCircle size={18} />
        <span style={{ flex: 1 }}>Notifications active! You will get pinged when grades update or deadlines approach.</span>
        <button
          onClick={() => previewSound('grade')}
          title="Preview notification sound"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#059669', display: 'flex', padding: '0.125rem' }}
        >
          <Volume2 size={18} />
        </button>
      </div>
    );
  }

  return (
    <>
      {!isStandalone && (
        <div className="pwa-install-hint">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.25rem' }}>
            <Smartphone size={24} />
          </div>
          For notifications on iPhone, add to Home Screen first:<br />
          Safari → Share (⬆) → &quot;Add to Home Screen&quot;
        </div>
      )}

      <div className="notif-banner">
        <div className="notif-banner-icon">
          <BellRing size={28} className="text-accent-blue" />
        </div>
        <div className="notif-banner-content">
          <div className="notif-banner-title">Enable Notifications</div>
          <div className="notif-banner-text">
            Get instant pings when grades update or deadlines approach
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSubscribe}
          disabled={status === 'subscribing' || !isSupported}
        >
          {status === 'subscribing' ? (
            <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
          ) : (
            'Enable'
          )}
        </button>
      </div>

      {status === 'error' && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {status === 'unsupported' && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={18} />
          <span>Browser ini tidak mendukung push notification. Gunakan Safari dan tambahkan ke Home Screen.</span>
        </div>
      )}
    </>
  );
}
