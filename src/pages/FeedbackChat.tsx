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
  type ChatAttachment,
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

const MAX_IMAGE_SIZE = 800; // max dimension in px for compression
const MAX_VIDEO_BYTES = 8 * 1024 * 1024; // 8MB max for videos

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let w = img.width;
      let h = img.height;
      if (w > MAX_IMAGE_SIZE || h > MAX_IMAGE_SIZE) {
        if (w > h) { h = Math.round(h * MAX_IMAGE_SIZE / w); w = MAX_IMAGE_SIZE; }
        else { w = Math.round(w * MAX_IMAGE_SIZE / h); h = MAX_IMAGE_SIZE; }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AttachmentPreview({ att, onRemove }: { att: ChatAttachment; onRemove?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="relative mt-1.5">
      {att.type === 'image' ? (
        <>
          <img
            src={att.data}
            alt={att.name}
            className="rounded-lg max-w-full max-h-48 cursor-pointer"
            onClick={() => setExpanded(true)}
          />
          {expanded && (
            <div
              className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
              onClick={() => setExpanded(false)}
            >
              <img src={att.data} alt={att.name} className="max-w-full max-h-full rounded-lg" />
            </div>
          )}
        </>
      ) : (
        <video
          src={att.data}
          controls
          className="rounded-lg max-w-full max-h-48"
          preload="metadata"
        />
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function HistoryAttachments({ chatHistory }: { chatHistory: string }) {
  try {
    const msgs: ChatMessage[] = JSON.parse(chatHistory);
    const attachments = msgs.flatMap(m => m.attachments ?? []);
    if (attachments.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-1">
        {attachments.map((att, i) => (
          <div key={i} className="relative">
            {att.type === 'image' ? (
              <img src={att.data} alt={att.name} className="rounded-md h-16 w-auto" />
            ) : (
              <video src={att.data} className="rounded-md h-16 w-auto" preload="metadata" />
            )}
          </div>
        ))}
      </div>
    );
  } catch {
    return null;
  }
}

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
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [uploadError, setUploadError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.id) {
      getUserFeedbacks(user.id).then(setPastFeedbacks);
    }
  }, [user?.id, feedbackSent]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadError('');

    for (const file of Array.from(files)) {
      try {
        if (file.type.startsWith('image/')) {
          const data = await compressImage(file);
          setPendingAttachments(prev => [...prev, {
            type: 'image',
            data,
            name: file.name,
            size: file.size,
          }]);
        } else if (file.type.startsWith('video/')) {
          if (file.size > MAX_VIDEO_BYTES) {
            setUploadError(`Video troppo grande (max ${MAX_VIDEO_BYTES / 1024 / 1024}MB). Usa un video piu corto.`);
            continue;
          }
          const data = await readFileAsDataURL(file);
          setPendingAttachments(prev => [...prev, {
            type: 'video',
            data,
            name: file.name,
            size: file.size,
          }]);
        }
      } catch {
        setUploadError('Errore nel caricamento del file.');
      }
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && pendingAttachments.length === 0) || loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text || (pendingAttachments.length > 0 ? `[${pendingAttachments.length} allegat${pendingAttachments.length === 1 ? 'o' : 'i'}]` : ''),
      timestamp: Date.now(),
      attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
    };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setPendingAttachments([]);
    setUploadError('');
    setLoading(true);

    try {
      // Send only text messages to AI (strip attachments for the API call)
      const textOnly = updated.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }));
      const reply = await chatWithAI(textOnly);
      const aiMsg: ChatMessage = { role: 'assistant', content: reply, timestamp: Date.now() };
      const withReply = [...updated, aiMsg];
      setMessages(withReply);

      if (isFeedbackReady(reply)) {
        setFeedbackReady(true);
      }
    } catch {
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: 'Si e verificato un errore imprevisto. Prova a riscrivere il messaggio.',
        timestamp: Date.now(),
      };
      setMessages([...updated, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendFeedback = async () => {
    if (!user?.id || !user.email) return;

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
    setPendingAttachments([]);
    setUploadError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleDirectSend = async () => {
    const text = input.trim();
    if (!user?.id || !user.email) return;
    if (!text && pendingAttachments.length === 0) return;

    const directMsg: ChatMessage = {
      role: 'user',
      content: text || `[${pendingAttachments.length} allegat${pendingAttachments.length === 1 ? 'o' : 'i'}]`,
      timestamp: Date.now(),
      attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
    };
    const category = detectCategory([directMsg]);
    await saveFeedback(user.id, user.email, text || 'Screenshot/video allegato', [directMsg], category);
    setInput('');
    setPendingAttachments([]);
    setFeedbackSent(true);
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 8rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))' }}>
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
                <HistoryAttachments chatHistory={fb.chatHistory} />
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

                <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 max-w-[85%]">
                  <p className="text-sm">
                    Ciao! Ti aiuto a scrivere il tuo feedback per Vector. Descrivi il problema, la richiesta o il suggerimento e ti guidero con alcune domande per renderlo chiaro e utile.
                  </p>
                </div>

                {/* Tip: screenshot e registrazioni schermo */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex gap-2.5 items-start">
                  <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Puoi condividere screenshot e registrazioni schermo!</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Usa il pulsante <span className="inline-flex items-center mx-0.5 align-middle"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></span> per allegare immagini, screenshot o video dalla galleria. Puoi anche registrare lo schermo e condividere il video per mostrarci un problema!
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    'Ho trovato un errore',
                    'Vorrei una nuova funzione',
                    'Ho bisogno di aiuto',
                    'Ho un suggerimento',
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
            {messages.map((msg, i) => {
              const isLastAiMsg =
                msg.role === 'assistant' && i === messages.length - 1;
              const hasAttachments = messages.some(
                m => m.attachments && m.attachments.length > 0,
              );
              const showQuickSend =
                isLastAiMsg &&
                hasAttachments &&
                !feedbackReady &&
                !feedbackSent &&
                !loading;

              return (
                <div key={i}>
                  <div
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-2.5 max-w-[85%] ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted rounded-bl-sm'
                      }`}
                    >
                      {msg.content && (
                        <p className="text-sm whitespace-pre-wrap">
                          {msg.role === 'assistant'
                            ? extractFeedbackMessage(msg.content)
                            : msg.content}
                        </p>
                      )}
                      {msg.attachments?.map((att, j) => (
                        <AttachmentPreview key={j} att={att} />
                      ))}
                    </div>
                  </div>
                  {showQuickSend && (
                    <div className="flex justify-start mt-2">
                      <button
                        onClick={handleSendFeedback}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Il file e sufficiente, invia cosi
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

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

          {/* Pending attachments preview */}
          {pendingAttachments.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 pt-1 border-t border-border">
              {pendingAttachments.map((att, i) => (
                <div key={i} className="relative shrink-0">
                  {att.type === 'image' ? (
                    <img src={att.data} alt={att.name} className="h-16 w-auto rounded-lg" />
                  ) : (
                    <div className="h-16 w-24 rounded-lg bg-muted flex items-center justify-center">
                      <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  )}
                  <button
                    onClick={() => removePendingAttachment(i)}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploadError && (
            <p className="text-xs text-red-600 dark:text-red-400 pb-1">{uploadError}</p>
          )}

          {/* Input area */}
          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex gap-2">
              {/* File upload button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-10 w-10 shrink-0 rounded-xl p-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || feedbackSent}
                title="Allega screenshot o video"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </Button>
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
                disabled={(!input.trim() && pendingAttachments.length === 0) || loading || feedbackSent}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
            {messages.length === 0 && (
              <button
                onClick={handleDirectSend}
                disabled={!input.trim() && pendingAttachments.length === 0}
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
