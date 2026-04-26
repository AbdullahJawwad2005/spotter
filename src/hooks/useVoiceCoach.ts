import { useState, useCallback } from 'react';
import { speak, stopSpeaking, primeVoice } from '@/lib/voice';

let voiceEnabled = true;

export function useVoiceCoach() {
  const [enabled, setEnabled] = useState(voiceEnabled);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    voiceEnabled = next;
    if (!next) stopSpeaking();
  }, [enabled]);

  const say = useCallback((text: string) => {
    if (enabled) speak(text);
  }, [enabled]);

  const prime = useCallback(() => { primeVoice(); }, []);
  const stop = useCallback(() => { stopSpeaking(); }, []);

  return { enabled, toggle, say, prime, stop };
}