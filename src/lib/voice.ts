/**
 * Browser TTS coach voice.
 *
 * Notes on browser quirks we work around:
 *  - Speech requires a user gesture to "unlock" audio (autoplay policy).
 *  - Voices load asynchronously — getVoices() can be empty for ~100-1000ms.
 *  - Chrome stops synthesis after ~15s; we resume() defensively.
 *  - In iframes, the parent must allow speech via the `allow="speaker"` attribute.
 */

let lastSpoken = "";
let lastTime = 0;
let unlocked = false;
let cachedVoice: SpeechSynthesisVoice | null = null;

const hasTTS = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  if (!hasTTS()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const preferred =
    voices.find((v) => /en[-_]US/i.test(v.lang) && /Google|Samantha|Natural|Neural/i.test(v.name)) ??
    voices.find((v) => /en[-_]US/i.test(v.lang)) ??
    voices.find((v) => /^en/i.test(v.lang)) ??
    voices[0];
  cachedVoice = preferred ?? null;
  return cachedVoice;
}

if (hasTTS()) {
  try {
    window.speechSynthesis.addEventListener?.("voiceschanged", () => {
      cachedVoice = null;
      pickVoice();
    });
  } catch {
    /* noop */
  }
}

/**
 * Unlock TTS. MUST be called from inside a user-gesture handler
 * (click/touchstart/keydown). Subsequent speak() calls will work.
 */
export function primeVoice() {
  if (!hasTTS()) {
    console.warn("[voice] speechSynthesis not available");
    return;
  }
  if (unlocked) return;
  try {
    // A real, audible-but-tiny utterance is the most reliable unlock signal
    // across Chromium / Safari / Firefox. Silent (volume=0) is ignored by some.
    const u = new SpeechSynthesisUtterance(".");
    u.volume = 0.01;
    u.rate = 1;
    // Don't cancel — that would wipe any speak() the caller queues right after.
    window.speechSynthesis.speak(u);
    unlocked = true;
    pickVoice();
    console.info("[voice] primed");
  } catch (e) {
    console.warn("[voice] prime failed", e);
  }
}

export function speak(text: string, opts: { force?: boolean } = {}) {
  if (!hasTTS()) return;
  const now = performance.now();
  if (!opts.force && text === lastSpoken && now - lastTime < 2500) return;
  if (!opts.force && now - lastTime < 400) return;
  lastSpoken = text;
  lastTime = now;

  try {
    const u = new SpeechSynthesisUtterance(text);
    // Use preferred voice if available, otherwise fall back to browser default
    const v = pickVoice();
    if (v) {
      u.voice = v;
      u.lang = v.lang || "en-US";
    }
    u.rate = 1.05;
    u.pitch = 1;
    u.volume = 1;
    u.onerror = (e) => console.warn("[voice] utterance error", e);

    if (opts.force) window.speechSynthesis.cancel();

    // Chrome bug: synthesis stops after ~15s. Resume defensively.
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();

    window.speechSynthesis.speak(u);
  } catch (e) {
    console.warn("[voice] speak failed", e);
  }
}

/** Stop anything currently being spoken. */
export function stopSpeaking() {
  if (!hasTTS()) return;
  try { window.speechSynthesis.cancel(); } catch { /* noop */ }
}

export function tone(freq = 660, ms = 90) {
  try {
    const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.value = 0.05;
    o.connect(g).connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, ms);
  } catch { /* noop */ }
}
