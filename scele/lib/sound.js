/**
 * SCELE Notif — Signature Notification Sound
 * Generated via Web Audio API (no file needed)
 * 3-note ascending chime: C5 → E5 → G5 with harmonic overtones
 *
 * Fixes:
 * - Properly awaits AudioContext.resume() before scheduling tones
 * - Pre-warms AudioContext on first user interaction (required by mobile browsers)
 * - Falls back gracefully when audio cannot be played (background tabs etc.)
 */

let audioCtx = null;
let isWarmedUp = false;

function getAudioContext() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Pre-warm the AudioContext on the first user gesture.
 * Mobile browsers (iOS Safari, Chrome Android) require AudioContext to be
 * resumed inside a user-initiated event (click/tap/keydown). Once resumed,
 * subsequent playback works even without a gesture (e.g. from polling).
 *
 * We attach once and auto-remove after the first interaction.
 */
function warmUpAudio() {
  if (isWarmedUp) return;
  if (typeof window === 'undefined') return;

  const events = ['click', 'touchstart', 'keydown'];

  function onInteraction() {
    if (isWarmedUp) return;
    isWarmedUp = true;

    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Play a silent buffer to fully unlock audio on iOS Safari.
      // Without this, some iOS versions block subsequent Web Audio playback.
      const silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // ignore — best effort
    }

    // Remove all listeners after first interaction
    for (const evt of events) {
      document.removeEventListener(evt, onInteraction, true);
    }
  }

  for (const evt of events) {
    document.addEventListener(evt, onInteraction, { capture: true, passive: true });
  }
}

// Auto-install warmup listeners when this module is first imported
if (typeof window !== 'undefined') {
  warmUpAudio();
}

function playTone(ctx, frequency, startTime, duration, gainPeak = 0.4) {
  // Main oscillator
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Overtone for richness
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();

  // Master compressor
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value = 10;
  compressor.ratio.value = 4;

  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, startTime);
  // Slight pitch warmth
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.998, startTime + duration);

  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(frequency * 2.005, startTime); // slight detuned octave

  // Attack + decay envelope
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(gainPeak * 0.6, startTime + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  gain2.gain.setValueAtTime(0, startTime);
  gain2.gain.linearRampToValueAtTime(gainPeak * 0.12, startTime + 0.015);
  gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.6);

  osc.connect(gain);
  osc2.connect(gain2);
  gain.connect(compressor);
  gain2.connect(compressor);
  compressor.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
  osc2.start(startTime);
  osc2.stop(startTime + duration + 0.01);
}

export async function playNotificationSound(type = 'grade') {
  if (typeof window === 'undefined') return;
  if (!window.AudioContext && !window.webkitAudioContext) return;

  try {
    const ctx = getAudioContext();

    // Await resume — this is critical. Without await, tones are scheduled
    // on a suspended context and never play.
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Double-check: if still suspended (no user gesture yet), bail out
    if (ctx.state !== 'running') {
      console.warn('AudioContext not running — sound skipped (no user gesture yet)');
      return;
    }

    const now = ctx.currentTime;

    if (type === 'grade') {
      // Nilai update: C5 → E5 → G5 ascending chime (happy, energetic)
      playTone(ctx, 523.25, now + 0.00, 0.55, 0.38); // C5
      playTone(ctx, 659.25, now + 0.14, 0.55, 0.38); // E5
      playTone(ctx, 783.99, now + 0.28, 0.80, 0.42); // G5
    } else if (type === 'deadline') {
      // Deadline: G5 → E5 → C5 → C4 descending (urgent warning)
      playTone(ctx, 783.99, now + 0.00, 0.40, 0.35); // G5
      playTone(ctx, 659.25, now + 0.12, 0.40, 0.35); // E5
      playTone(ctx, 523.25, now + 0.24, 0.40, 0.35); // C5
      playTone(ctx, 261.63, now + 0.38, 0.80, 0.40); // C4
    } else if (type === 'event') {
      // New event/assignment: E5 → G5 → B5 ascending bright chime
      playTone(ctx, 659.25, now + 0.00, 0.50, 0.36); // E5
      playTone(ctx, 783.99, now + 0.14, 0.50, 0.36); // G5
      playTone(ctx, 987.77, now + 0.28, 0.75, 0.40); // B5
    } else {
      // Generic: single pleasant ding
      playTone(ctx, 659.25, now + 0.00, 0.70, 0.40); // E5
      playTone(ctx, 783.99, now + 0.18, 0.70, 0.35); // G5
    }
  } catch (e) {
    console.warn('Audio playback failed:', e);
  }
}

// Play a short preview — called from Settings/test button
export function previewSound(type = 'grade') {
  playNotificationSound(type);
}

