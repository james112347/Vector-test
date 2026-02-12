import { db } from '../db/db';
import type { UserFeedback, FeedbackStatus } from '../db/schema';

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
Il tuo compito e aiutare gli utenti a formulare feedback chiari e utili sull'app.

REGOLE:
- Rispondi SEMPRE in italiano
- Sii cordiale, breve e professionale
- Aiuta l'utente a chiarire il suo feedback: chiedi dettagli se necessario
- Classifica il feedback in: bug (problema tecnico), feature (nuova funzionalita), improvement (miglioramento), support (aiuto), other (altro)
- Quando il feedback e chiaro e completo, rispondi includendo ESATTAMENTE questo tag alla fine: [FEEDBACK_PRONTO]
- Prima del tag, scrivi un breve riepilogo del feedback formulato
- Se l'utente chiede aiuto sull'uso dell'app, assistilo e poi chiedi se vuole inviare un feedback
- Non inventare funzionalita che non esistono nell'app
- L'app include: registrazione energia giornaliera (fisica/mentale/emotiva), check-in rapidi, grafici settimanali, insight IA, integrazione Sahha per dati wearable, dashboard admin`;

export async function chatWithAI(messages: ChatMessage[]): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('IA non disponibile. Scrivi il tuo feedback e lo invieremo direttamente.');
  }

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
      model: 'llama-3.3-70b-versatile',
      messages: apiMessages,
      temperature: 0.6,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    throw new Error(`Errore IA (${response.status})`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Nessuna risposta';
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
  return db.feedbacks.add({
    userId,
    userEmail,
    category,
    message,
    chatHistory: JSON.stringify(chatHistory),
    status: 'sent',
    createdAt: now,
    updatedAt: now,
  });
}

export async function getUserFeedbacks(userId: number): Promise<UserFeedback[]> {
  return db.feedbacks.where('userId').equals(userId).reverse().sortBy('createdAt');
}

export async function getAllFeedbacks(): Promise<UserFeedback[]> {
  return db.feedbacks.orderBy('createdAt').reverse().toArray();
}

export async function markFeedbackRead(id: number): Promise<void> {
  await db.feedbacks.update(id, { status: 'read' as FeedbackStatus, updatedAt: new Date() });
}

export async function replyToFeedback(id: number, reply: string): Promise<void> {
  await db.feedbacks.update(id, { adminReply: reply, status: 'read' as FeedbackStatus, updatedAt: new Date() });
}

export async function getUnreadFeedbackCount(): Promise<number> {
  return db.feedbacks.where('status').equals('sent').count();
}
