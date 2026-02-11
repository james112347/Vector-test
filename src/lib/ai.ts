import type { EnergyLog, UserProfile } from '../db/schema';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function getApiKey(): string | null {
  return import.meta.env.VITE_GROQ_API_KEY || null;
}

export function isAIAvailable(): boolean {
  const key = getApiKey();
  return !!key && key !== 'your_groq_api_key_here';
}

interface AIInsight {
  emoji: string;
  title: string;
  body: string;
}

export interface AIAnalysis {
  summary: string;
  insights: AIInsight[];
  suggestion: string;
}

function buildPrompt(profile: UserProfile, logs: EnergyLog[]): string {
  const goalLabels: Record<string, string> = {
    more_energy: 'avere piu energia',
    better_sleep: 'dormire meglio',
    fitness: 'migliorare la forma fisica',
    stress: 'gestire lo stress',
    general_wellness: 'benessere generale',
  };

  const activityLabels: Record<string, string> = {
    sedentary: 'sedentario',
    light: 'leggera',
    moderate: 'moderata',
    active: 'attiva',
    very_active: 'molto attiva',
  };

  const logsSummary = logs.map(l => {
    const avg = Math.round(((l.physical + l.mental + l.emotional) / 3) * 10) / 10;
    return `${l.date}: fisica=${l.physical} mentale=${l.mental} emotiva=${l.emotional} media=${avg}${l.workHoursToday ? ` ore_lavoro=${l.workHoursToday}` : ''}${l.notes ? ` note="${l.notes}"` : ''}`;
  }).join('\n');

  return `Sei un coach di benessere personale italiano. Analizza i dati energetici di questo utente e fornisci insight utili e personalizzati.

PROFILO UTENTE:
- Nome: ${profile.name}
- Eta: ${new Date().getFullYear() - profile.birthYear} anni
- Obiettivo: ${goalLabels[profile.goal] || profile.goal}
- Attivita fisica: ${activityLabels[profile.activityLevel] || profile.activityLevel}
- Ore di sonno: ${profile.sleepHours}h/notte
- Ore lavoro/studio giornaliere: ${profile.dailyWorkHours ?? 8}h
- Caffeina: ${profile.caffeineDaily} tazzine/giorno

REGISTRAZIONI ENERGIA (ultimi giorni, scala 1-10):
${logsSummary}

Rispondi in formato JSON valido con questa struttura esatta:
{
  "summary": "Una frase che riassume lo stato energetico generale dell'utente",
  "insights": [
    {"emoji": "emoji", "title": "titolo breve", "body": "spiegazione in 1-2 frasi"},
    {"emoji": "emoji", "title": "titolo breve", "body": "spiegazione in 1-2 frasi"},
    {"emoji": "emoji", "title": "titolo breve", "body": "spiegazione in 1-2 frasi"}
  ],
  "suggestion": "Un consiglio pratico e specifico per oggi, basato sui dati e sull'obiettivo dell'utente"
}

REGOLE:
- Rispondi SOLO con JSON valido, nessun testo prima o dopo
- Massimo 3 insight
- Sii specifico e basati sui dati reali, non generico
- Usa il nome dell'utente
- Scrivi in italiano
- Gli emoji devono essere singoli emoji unicode`;
}

export async function generateInsights(
  profile: UserProfile,
  logs: EnergyLog[],
): Promise<AIAnalysis> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Chiave API Groq non configurata');
  }

  if (logs.length === 0) {
    throw new Error('Nessun dato energetico disponibile');
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'user',
          content: buildPrompt(profile, logs),
        },
      ],
      temperature: 0.7,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Errore API Groq: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Nessuna risposta dall\'IA');
  }

  const parsed = JSON.parse(content) as AIAnalysis;

  if (!parsed.summary || !parsed.insights || !parsed.suggestion) {
    throw new Error('Risposta IA incompleta');
  }

  return parsed;
}

// Cache in sessionStorage to avoid repeated API calls
const CACHE_KEY = 'vector_ai_insights';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 ore

interface CachedInsight {
  data: AIAnalysis;
  timestamp: number;
  logCount: number;
}

export function getCachedInsights(logCount: number): AIAnalysis | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedInsight = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL) return null;
    if (cached.logCount !== logCount) return null;
    return cached.data;
  } catch {
    return null;
  }
}

export function cacheInsights(data: AIAnalysis, logCount: number): void {
  try {
    const cached: CachedInsight = { data, timestamp: Date.now(), logCount };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // sessionStorage full, ignore
  }
}
