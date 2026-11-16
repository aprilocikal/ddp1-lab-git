import { createHash } from 'crypto';
import { Redis } from '@upstash/redis';

// ─── Storage Mode ─────────────────────────────────────────────────────────────
// STORAGE_MODE=redis   → use Upstash Redis (production / Vercel)
// STORAGE_MODE=python  → proxy to local Python FastAPI backend
// Default: redis if UPSTASH credentials exist, else python

const STORAGE_MODE = process.env.STORAGE_MODE ||
  (process.env.PYTHON_BACKEND_URL ? 'python' : 'redis');

const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

let _redisInstance = null;
function getRedis() {
  if (!_redisInstance) {
    _redisInstance = Redis.fromEnv();
  }
  return _redisInstance;
}

// ─── Python backend proxy helper ──────────────────────────────────────────────
async function pyFetch(path, options = {}) {
  const url = `${PYTHON_BACKEND_URL}/storage${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Storage error' }));
    throw new Error(err.detail || `Storage request failed: ${res.status}`);
  }
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ---- User Management ----
// ═══════════════════════════════════════════════════════════════════════════════

export async function saveUser(userId, userData) {
  const data = { ...userData, updatedAt: Date.now() };

  if (STORAGE_MODE === 'python') {
    try {
      await pyFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ userId, userData: data }),
      });
      return;
    } catch (e) {
      console.error('Python saveUser error:', e.message);
    }
  }

  try {
    const redis = getRedis();
    await redis.hset('scele_users', { [userId]: data });
  } catch (err) {
    console.warn('Redis saveUser failed, attempting Python fallback:', err.message);
    try {
      await pyFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ userId, userData: data }),
      });
    } catch (e) {
      console.error('Failed to save user in both Redis and Python:', e.message);
    }
  }
}

export async function getUser(userId) {
  if (STORAGE_MODE === 'python') {
    try {
      const result = await pyFetch(`/users/${userId}`);
      return result.data || null;
    } catch (e) {
      console.error('Python getUser error:', e.message);
      return null;
    }
  }

  try {
    const redis = getRedis();
    return await redis.hget('scele_users', userId);
  } catch (err) {
    // Graceful fallback to local Python backend when Redis is unreachable
    try {
      const result = await pyFetch(`/users/${userId}`);
      return result.data || null;
    } catch {
      return null;
    }
  }
}

export async function getAllUsers() {
  if (STORAGE_MODE === 'python') {
    try {
      const result = await pyFetch('/users');
      return result.data || {};
    } catch (e) {
      console.error('Python getAllUsers error:', e.message);
      return {};
    }
  }

  try {
    const redis = getRedis();
    const users = await redis.hgetall('scele_users');
    return users || {};
  } catch (err) {
    try {
      const result = await pyFetch('/users');
      return result.data || {};
    } catch {
      return {};
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ---- Subscription Management ----
// ═══════════════════════════════════════════════════════════════════════════════

export async function saveSubscription(userId, subscription) {
  if (STORAGE_MODE === 'python') {
    await pyFetch('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ userId, subscription }),
    });
    return;
  }

  const redis = getRedis();
  await redis.hset('scele_subscriptions', { [userId]: subscription });
}

export async function getSubscription(userId) {
  if (STORAGE_MODE === 'python') {
    const result = await pyFetch(`/subscriptions/${userId}`);
    return result.data || null;
  }

  const redis = getRedis();
  return await redis.hget('scele_subscriptions', userId);
}

export async function removeSubscription(userId) {
  if (STORAGE_MODE === 'python') {
    await pyFetch(`/subscriptions/${userId}`, { method: 'DELETE' });
    return;
  }

  const redis = getRedis();
  await redis.hdel('scele_subscriptions', userId);
}

export async function getAllSubscriptions() {
  if (STORAGE_MODE === 'python') {
    const result = await pyFetch('/subscriptions');
    return result.data || {};
  }

  const redis = getRedis();
  const subs = await redis.hgetall('scele_subscriptions');
  return subs || {};
}

// ═══════════════════════════════════════════════════════════════════════════════
// ---- Cache / Hash Management ----
// ═══════════════════════════════════════════════════════════════════════════════

export function hashData(data) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

export async function getCachedHash(userId, key) {
  if (STORAGE_MODE === 'python') {
    const cacheKey = `${userId}:${key}`;
    const result = await pyFetch(`/cache/${encodeURIComponent(cacheKey)}`).catch(() => ({ data: null }));
    return result.data ?? null;
  }

  const redis = getRedis();
  const cacheKey = `${userId}:${key}`;
  return await redis.hget('scele_cache', cacheKey);
}

export async function setCachedHash(userId, key, hash) {
  if (STORAGE_MODE === 'python') {
    const cacheKey = `${userId}:${key}`;
    await pyFetch('/cache', {
      method: 'POST',
      body: JSON.stringify({ key: cacheKey, hash }),
    });
    return;
  }

  const redis = getRedis();
  const cacheKey = `${userId}:${key}`;
  await redis.hset('scele_cache', { [cacheKey]: hash });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ---- Done Events Management ----
// ═══════════════════════════════════════════════════════════════════════════════

export async function getDoneEvents(userId) {
  if (STORAGE_MODE === 'python') {
    const result = await pyFetch(`/done-events/${userId}`).catch(() => ({ data: {} }));
    return result.data || {};
  }

  const redis = getRedis();
  const doneData = await redis.hget('scele_done_events', userId);
  if (!doneData) return {};
  if (typeof doneData === 'string') {
    try { return JSON.parse(doneData); } catch { return {}; }
  }
  return doneData;
}

export async function saveDoneEvent(userId, eventId, isDone) {
  if (STORAGE_MODE === 'python') {
    await pyFetch('/done-events', {
      method: 'POST',
      body: JSON.stringify({ userId, eventId, isDone }),
    });
    return;
  }

  const redis = getRedis();
  const current = await getDoneEvents(userId);
  if (isDone) {
    current[eventId] = true;
  } else {
    delete current[eventId];
  }
  await redis.hset('scele_done_events', { [userId]: JSON.stringify(current) });
}
