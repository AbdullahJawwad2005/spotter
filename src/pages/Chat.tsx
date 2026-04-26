import { useEffect, useRef, useState } from 'react';
import { Navigation } from '@/components/app/Navigation';
import { Button } from '@/components/ui/button';
import { useCoachChat } from '@/hooks/useCoachChat';
import { Send, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const suggestedPrompts = [
  "What's a good beginner upper body workout?",
  'How do I fix my squat depth?',
  'Best exercises for building bigger arms?',
  'How many rest days should I take per week?',
];

export default function Chat() {
  const { messages, loading, error, sendMessage, clearChat } = useCoachChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'AI Coach — Spotter';
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || loading) return;
      sendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <img src="/SpotterLogo.png" alt="Spotter" className="h-16 w-16 object-contain mb-6 rounded-2xl" />
            <h1 className="text-3xl font-display tracking-tight mb-3">Your AI Fitness Coach</h1>
            <p className="text-muted-foreground max-w-md mb-8">
              Ask me anything about workouts, form, nutrition, recovery, or building your
              perfect training program.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="text-left px-4 py-3 rounded-xl border border-border bg-card hover:bg-muted transition-colors text-sm"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary inline mr-2" />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
            <div className="flex justify-end mb-2">
              <Button variant="ghost" size="sm" onClick={clearChat} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear chat
              </Button>
            </div>
            {messages.map((message, i) => (
              <div key={i} className={cn("flex", message.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  "max-w-[85%] px-4 py-3 rounded-2xl",
                  message.role === 'user'
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card border border-border rounded-bl-md"
                )}>
                  {message.role === 'assistant' && !message.content && loading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            {error && (
              <div className="text-center text-sm text-destructive">{error}</div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="sticky bottom-0 pt-4 bg-background">
          <div className="relative border border-border rounded-xl bg-card overflow-hidden focus-within:ring-2 focus-within:ring-primary/20">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your fitness coach anything..."
              className="min-h-[56px] max-h-[200px] resize-none border-0 bg-transparent px-4 py-4 pr-14 w-full text-sm focus:outline-none"
              disabled={loading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || loading}
              className="absolute right-2 bottom-2 h-9 w-9 rounded-lg"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
