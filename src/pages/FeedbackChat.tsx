import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuthState } from '../contexts/AuthContext';
import {
  chatWithAI,
  isFeedbackReady,
  extractFeedbackMessage,
  detectCategory,
  saveFeedback,
  getUserFeedbacks,
  type ChatMessage,
} from '../lib/feedback';
import type { UserFeedback } from '../db/schema';

const categoryLabels: Record<string, string> = {
  bug: 'Bug',
  feature: 'Nuova funzione',
  improvement: 'Miglioramento',
  support: 'Supporto',
  other: 'Altro',
};

const categoryColors: Record<string, string> = {
  bug: 'bg-red-500/10 text-red-600 dark:text-red-400',
  feature: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  improvement: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  support: 'bg-green-500/10 text-green-600 dark:text-green-400',
  other: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

export default function FeedbackChat() {
  const { user } = useAuthState();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedbackReady, setFeedbackReady] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [pastFeedbacks, setPastFeedbacks] = useState<UserFeedback[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (user?.id) {
      getUserFeedbacks(user.id).then(setPastFeedbacks);
    }
  }, [user?.id, feedbackSent]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const reply = await chatWithAI(updated);
      const aiMsg: ChatMessage = { role: 'assistant', content: reply, timestamp: Date.now() };
      const withReply = [...updated, aiMsg];
      setMessages(withReply);

      if (isFeedbackReady(reply)) {
        setFeedbackReady(true);
      }
    } catch (e) {
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: `Mi dispiace, c'e stato un errore. Puoi comunque scrivere il tuo feedback e inviarlo direttamente.`,
        timestamp: Date.now(),
      };
      setMessages([...updated, errMsg]);
      setFeedbackReady(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSendFeedback = async () => {
    if (!user?.id || !user.email) return;

    // Extract the final feedback from the last AI message or user's last message
    const lastAiMsg = [...messages].reverse().find(m => m.role === 'assistant');
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const feedbackText = lastAiMsg
      ? extractFeedbackMessage(lastAiMsg.content)
      : lastUserMsg?.content || '';

    const category = detectCategory(messages);

    await saveFeedback(user.id, user.email, feedbackText, messages, category);
    setFeedbackSent(true);
  };

  const startNew = () => {
    setMessages([]);
    setFeedbackReady(false);
    setFeedbackSent(false);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Send directly without AI
  const handleDirectSend = async () => {
    const text = input.trim();
    if (!text || !user?.id || !user.email) return;
    const directMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    const category = detectCategory([directMsg]);
    await saveFeedback(user.id, user.email, text, [directMsg], category);
    setInput('');
    setFeedbackSent(true);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold">Feedback & Assistenza</h1>
          <p className="text-xs text-muted-foreground">
            L'IA ti aiuta a formulare il tuo feedback
          </p>
        </div>
        <div className="flex gap-2">
          {pastFeedbacks.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? 'Chat' : `Storico (${pastFeedbacks.length})`}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>
      </div>

      {showHistory ? (
        /* Feedback History */
        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
          {pastFeedbacks.map(fb => (
            <Card key={fb.id}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${categoryColors[fb.category]}`}>
                    {categoryLabels[fb.category]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(fb.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm">{fb.message}</p>
                {fb.adminReply && (
                  <div className="rounded-lg bg-primary/5 border border-primary/10 p-2.5 mt-2">
                    <p className="text-[10px] font-medium text-primary mb-1">Risposta admin</p>
                    <p className="text-xs">{fb.adminReply}</p>
                  </div>
                )}
                {fb.status === 'sent' && !fb.adminReply && (
                  <p className="text-[10px] text-muted-foreground italic">In attesa di risposta</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : feedbackSent ? (
        /* Success state */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-bold">Feedback inviato!</p>
              <p className="text-sm text-muted-foreground mt-1">
                L'amministratore lo ricevera e potra risponderti.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" size="sm" onClick={startNew}>
                Nuovo feedback
              </Button>
              <Button size="sm" onClick={() => navigate(-1)}>
                Torna indietro
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Chat area */
        <>
          <div className="flex-1 overflow-y-auto space-y-3 pb-3">
            {/* Welcome + Informativa */}
            {messages.length === 0 && (
              <div className="space-y-3">
                {/* Informativa */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs font-semibold text-primary">Perche lasciare un feedback?</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Il tuo feedback e fondamentale per migliorare Vector. Ogni segnalazione ci aiuta a
                    correggere problemi, aggiungere funzioni utili e rendere l'app piu efficace per il
                    tuo benessere. L'assistente IA ti aiutera a formulare il messaggio nel modo migliore.
                  </p>
                </div>

                {/* AI greeting */}
                <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 max-w-[85%]">
                  <p className="text-sm">
                    Ciao! Sono l'assistente di Vector. Dimmi cosa vorresti segnalare o migliorare e ti aiutero a formulare il feedback. Puoi anche chiedermi aiuto sull'uso dell'app!
                  </p>
                </div>

                {/* Quick suggestions */}
                <div className="flex flex-wrap gap-2">
                  {[
                    'Ho trovato un problema',
                    'Vorrei una nuova funzione',
                    'Ho bisogno di aiuto',
                    'Suggerimento per migliorare',
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`rounded-2xl px-4 py-2.5 max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">
                    {msg.role === 'assistant'
                      ? extractFeedbackMessage(msg.content)
                      : msg.content}
                  </p>
                </div>
              </div>
            ))}

            {/* Loading */}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Feedback ready - send button */}
            {feedbackReady && !feedbackSent && (
              <div className="flex justify-center pt-2">
                <Button onClick={handleSendFeedback} className="gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Invia all'amministratore
                </Button>
              </div>
            )}

            <div ref={scrollRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Scrivi il tuo messaggio..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                disabled={loading || feedbackSent}
              />
              <Button
                size="sm"
                className="h-10 w-10 shrink-0 rounded-xl p-0"
                onClick={sendMessage}
                disabled={!input.trim() || loading || feedbackSent}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
            {messages.length === 0 && (
              <button
                onClick={handleDirectSend}
                disabled={!input.trim()}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                Oppure invia direttamente senza assistenza IA
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
