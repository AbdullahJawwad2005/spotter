/** Speak short coaching cues. Throttled so we don't talk over ourselves. */
let lastSpoken = "";
let lastTime = 0;

export function speak(text: string, opts: { force?: boolean } = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const now = performance.now();
  if (!opts.force && text === lastSpoken && now - lastTime < 2500) return;
  if (now - lastTime < 800 && !opts.force) return;
  lastSpoken = text;
  lastTime = now;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* noop */
  }
}

export function tone(freq = 660, ms = 90) {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
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