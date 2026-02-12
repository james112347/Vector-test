import { db } from '../db/db';
import type { UserFeedback, FeedbackStatus } from '../db/schema';
import { supabase } from './supabase';
import { notifyNewFeedback } from './notifications';
import { getAppSettings } from './useAppSettings';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function getApiKey(): string | null {
  return import.meta.env.VITE_GROQ_API_KEY || null;
}

const SYSTEM_PROMPT = `Sei l'assistente di Vector, un'app per il monitoraggio dell'energia personale.
Il tuo compito e aiutare gli utenti a formulare feedback dettagliati e utili da inviare allo sviluppatore.

COME COMPORTARTI:
- Rispondi SEMPRE in italiano, in modo professionale e sobrio
- NON essere generico. Fai domande precise e mirate per raccogliere informazioni concrete
- Il tuo obiettivo e trasformare messaggi vaghi in segnalazioni chiare e strutturate

QUANDO L'UTENTE SEGNALA UN PROBLEMA (bug):
Chiedi sempre:
1. In quale pagina/sezione dell'app e successo?
2. Cosa stavi facendo esattamente quando si e verificato?
3. Cosa ti aspettavi che succedesse?
4. Cosa e successo invece?
5. Su quale dispositivo (telefono/computer, modello se possibile)?
6. Si ripete sempre o e successo solo una volta?

QUANDO L'UTENTE PROPONE UNA FUNZIONE (feature):
Chiedi:
1. Cosa vorresti poter fare nell'app?
2. In quale situazione ti sarebbe utile?
3. Come immagini che funzioni? (anche in modo semplice)

QUANDO L'UTENTE SUGGERISCE UN MIGLIORAMENTO:
Chiedi:
1. Quale parte dell'app vorresti migliorare?
2. Cosa non ti convince dell'attuale funzionamento?
3. Come vorresti che funzionasse invece?

QUANDO L'UTENTE CHIEDE AIUTO (supporto):
- Rispondi alla domanda con istruzioni chiare e pratiche
- Dopo aver aiutato, chiedi se il problema e risolto o se vuole inviare una segnalazione

REGOLE GENERALI:
- Fai una domanda alla volta, non sommergere l'utente
- Dopo 2-3 scambi, quando hai raccolto abbastanza dettagli, formula un riepilogo strutturato del feedback
- Nel riepilogo includi: tipo di segnalazione, descrizione del problema/proposta, dettagli raccolti
- Alla fine del riepilogo, aggiungi ESATTAMENTE questo tag: [FEEDBACK_PRONTO]
- NON aggiungere il tag finche non hai raccolto informazioni sufficienti
- Non inventare funzionalita che non esistono nell'app

FUNZIONALITA DELL'APP VECTOR:
- Registrazione giornaliera dei livelli di energia (fisica, mentale, emotiva) su scala 1-10
- Check-in rapidi con emoji
- Grafici settimanali dell'andamento energetico
- Insight e suggerimenti generati dall'IA
- Profilo utente con dati personali e stile di vita
- Integrazione Sahha per dati da wearable (passi, sonno, frequenza cardiaca)
- Impostazioni: tema chiaro/scuro, notifiche, aggiornamento automatico
- Dashboard amministratore per gestione utenti`;

/**
 * Main chat function. Tries Groq AI first, falls back to guided assistant.
 */
export async function chatWithAI(messages: ChatMessage[]): Promise<string> {
  // Try real AI first
  const apiKey = getApiKey();
  if (apiKey) {
    try {
      return await callGroqAPI(apiKey, messages);
    } catch (e) {
      console.warn('Groq API failed, using guided assistant:', e);
    }
  }

  // Fallback: guided assistant (always works, no API needed)
  return guidedAssistant(messages);
}

async function callGroqAPI(apiKey: string, messages: ChatMessage[]): Promise<string> {
  const apiMessages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: apiMessages,
      temperature: 0.4,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    console.error('Groq API error:', response.status, errBody);
    throw new Error(`Errore IA (${response.status})`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Nessuna risposta';
}

// ─── Guided assistant (offline, rule-based) ─────────────────────────

type FeedbackType = 'bug' | 'feature' | 'improvement' | 'support' | null;

interface GuidedStep {
  question: string;
  field: string;
}

const GUIDED_FLOWS: Record<string, GuidedStep[]> = {
  bug: [
    { question: 'In quale pagina o sezione dell\'app si e verificato il problema?', field: 'pagina' },
    { question: 'Cosa stavi facendo quando e successo?', field: 'azione' },
    { question: 'Cosa ti aspettavi che succedesse e cosa e successo invece?', field: 'risultato' },
    { question: 'Su quale dispositivo usi l\'app? (es. iPhone, Android, computer)', field: 'dispositivo' },
  ],
  feature: [
    { question: 'Cosa vorresti poter fare nell\'app che oggi non e possibile?', field: 'descrizione' },
    { question: 'In quale situazione ti sarebbe utile questa funzione?', field: 'contesto' },
    { question: 'Come immagini che funzioni? Anche una descrizione semplice va bene.', field: 'dettaglio' },
  ],
  improvement: [
    { question: 'Quale parte dell\'app vorresti migliorare?', field: 'area' },
    { question: 'Cosa non ti convince del funzionamento attuale?', field: 'problema' },
    { question: 'Come vorresti che funzionasse invece?', field: 'proposta' },
  ],
  support: [
    { question: 'Con quale funzione dell\'app hai bisogno di aiuto?', field: 'funzione' },
    { question: 'Cosa hai provato a fare e cosa e successo?', field: 'dettaglio' },
  ],
};

function detectFeedbackType(text: string): FeedbackType {
  const t = text.toLowerCase();
  if (/bug|errore|crash|non funziona|problema|rotto|blocca|si chiude/.test(t)) return 'bug';
  if (/nuova funzion|aggiung|vorrei poter|manca|sarebbe bello|aggiungere/.test(t)) return 'feature';
  if (/miglior|meglio|cambiare|modific|ottimizz|suggerim/.test(t)) return 'improvement';
  if (/aiuto|come si fa|non capisco|non riesco|spieg|help/.test(t)) return 'support';
  return null;
}

function guidedAssistant(messages: ChatMessage[]): string {
  const userMessages = messages.filter(m => m.role === 'user');
  const userCount = userMessages.length;

  // No messages yet - shouldn't happen, but handle it
  if (userCount === 0) {
    return 'Ciao! Dimmi cosa vorresti segnalare o chiedere riguardo a Vector.';
  }

  const firstUserText = userMessages[0].content;
  const lastUserText = userMessages[userMessages.length - 1].content;
  const feedbackType = detectFeedbackType(firstUserText);

  // First message: detect type and ask first question
  if (userCount === 1) {
    if (!feedbackType) {
      return 'Grazie per il messaggio. Per poterti aiutare al meglio, di che tipo di segnalazione si tratta?\n\n' +
        '- Un problema o errore (bug)\n' +
        '- Una nuova funzione che vorresti\n' +
        '- Un miglioramento a qualcosa di esistente\n' +
        '- Hai bisogno di aiuto con l\'app';
    }

    const flow = GUIDED_FLOWS[feedbackType];
    return `Capito, grazie. ${flow[0].question}`;
  }

  // Second message: if type wasn't clear before, try to detect it now
  const resolvedType = feedbackType || detectFeedbackType(lastUserText) || 'bug';
  const flow = GUIDED_FLOWS[resolvedType];

  // Calculate which step we're on (subtract 1 for the type detection step if needed)
  const answeredSteps = feedbackType ? userCount - 1 : userCount - 2;

  // Still have questions to ask
  if (answeredSteps < flow.length) {
    const nextStep = flow[answeredSteps];
    if (nextStep) {
      return nextStep.question;
    }
  }

  // All questions answered - build summary
  const typeLabels: Record<string, string> = {
    bug: 'Segnalazione bug',
    feature: 'Richiesta nuova funzione',
    improvement: 'Suggerimento di miglioramento',
    support: 'Richiesta di supporto',
  };

  const answers = userMessages.map(m => m.content);
  let summary = `Grazie per le informazioni. Ecco il riepilogo del tuo feedback:\n\n`;
  summary += `**Tipo:** ${typeLabels[resolvedType]}\n`;

  // Include all user answers as structured feedback
  const relevantAnswers = feedbackType ? answers.slice(1) : answers.slice(2);
  for (let i = 0; i < Math.min(relevantAnswers.length, flow.length); i++) {
    summary += `**${flow[i].field.charAt(0).toUpperCase() + flow[i].field.slice(1)}:** ${relevantAnswers[i]}\n`;
  }

  // Include the original message
  summary += `\n**Messaggio originale:** "${firstUserText}"`;
  summary += `\n\nSe e tutto corretto, premi "Invia all'amministratore". [FEEDBACK_PRONTO]`;

  return summary;
}

export function isFeedbackReady(text: string): boolean {
  return text.includes('[FEEDBACK_PRONTO]');
}

export function extractFeedbackMessage(text: string): string {
  return text.replace('[FEEDBACK_PRONTO]', '').trim();
}

export function detectCategory(messages: ChatMessage[]): UserFeedback['category'] {
  const allText = messages.map(m => m.content).join(' ').toLowerCase();
  if (/bug|errore|crash|non funziona|problema|rotto/.test(allText)) return 'bug';
  if (/nuova funzion|aggiung|vorrei poter|manca|sarebbe bello/.test(allText)) return 'feature';
  if (/miglior|meglio|cambiare|modific|ottimizz/.test(allText)) return 'improvement';
  if (/aiuto|come si fa|non capisco|non riesco|spieg/.test(allText)) return 'support';
  return 'other';
}

export async function saveFeedback(
  userId: number,
  userEmail: string,
  message: string,
  chatHistory: ChatMessage[],
  category: UserFeedback['category'],
): Promise<number> {
  const now = new Date();

  // Save locally
  const id = await db.feedbacks.add({
    userId,
    userEmail,
    category,
    message,
    chatHistory: JSON.stringify(chatHistory),
    status: 'sent',
    createdAt: now,
    updatedAt: now,
  });

  // Sync to Supabase (so admin receives it on any device)
  if (supabase) {
    await supabase.from('feedbacks').insert({
      user_email: userEmail,
      category,
      message,
      chat_history: chatHistory,
      status: 'sent',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }).then(({ error }) => {
      if (error) console.error('Supabase feedback sync error:', error);
    });
  }

  // Local notification (only useful if admin is on same device)
  if (getAppSettings().notificationsEnabled) {
    notifyNewFeedback(userEmail, category);
  }

  return id;
}

export async function getUserFeedbacks(userId: number): Promise<UserFeedback[]> {
  // Try Supabase first for cross-device access
  const user = await db.users.get(userId);
  if (supabase && user?.email) {
    const { data } = await supabase
      .from('feedbacks')
      .select('*')
      .eq('user_email', user.email)
      .order('created_at', { ascending: false });
    if (data && data.length > 0) {
      return data.map(mapSupabaseFeedback);
    }
  }
  return db.feedbacks.where('userId').equals(userId).reverse().sortBy('createdAt');
}

export async function getAllFeedbacks(): Promise<UserFeedback[]> {
  // Read from Supabase for admin (cross-device)
  if (supabase) {
    const { data } = await supabase
      .from('feedbacks')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      return data.map(mapSupabaseFeedback);
    }
  }
  return db.feedbacks.orderBy('createdAt').reverse().toArray();
}

export async function markFeedbackRead(id: number): Promise<void> {
  await db.feedbacks.update(id, { status: 'read' as FeedbackStatus, updatedAt: new Date() });
  if (supabase) {
    await supabase.from('feedbacks').update({
      status: 'read',
      updated_at: new Date().toISOString(),
    }).eq('id', id);
  }
}

export async function replyToFeedback(id: number, reply: string): Promise<void> {
  const now = new Date();
  await db.feedbacks.update(id, { adminReply: reply, status: 'read' as FeedbackStatus, updatedAt: now });
  if (supabase) {
    await supabase.from('feedbacks').update({
      admin_reply: reply,
      status: 'read',
      updated_at: now.toISOString(),
    }).eq('id', id);
  }
}

export async function getUnreadFeedbackCount(): Promise<number> {
  if (supabase) {
    const { count } = await supabase
      .from('feedbacks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent');
    return count ?? 0;
  }
  return db.feedbacks.where('status').equals('sent').count();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSupabaseFeedback(row: any): UserFeedback {
  return {
    id: row.id,
    userId: 0,
    userEmail: row.user_email,
    category: row.category,
    message: row.message,
    chatHistory: typeof row.chat_history === 'string' ? row.chat_history : JSON.stringify(row.chat_history ?? []),
    status: row.status,
    adminReply: row.admin_reply ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
