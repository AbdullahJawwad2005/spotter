import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function useCoachChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessage = { role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await supabase.functions.invoke('fitness-chat', {
        body: { messages: [...messages, userMsg] },
      });
      if (err) throw err;
      const reply = (data as { reply?: string })?.reply || 'No response.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Chat unavailable';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [messages]);

  const reset = useCallback(() => { setMessages([]); setError(null); }, []);

  return { messages, loading, error, sendMessage, reset };
}