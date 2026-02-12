import { supabase } from './supabase';
import { db } from '../db/db';
import type { FoodLog } from '../db/schema';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'llama-3.2-90b-vision-preview';

// --- Reuse API key logic from ai.ts ---

let cachedApiKey: string | null | undefined = undefined;

async function getApiKey(): Promise<string | null> {
  if (cachedApiKey !== undefined) return cachedApiKey;

  const envKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
  if (envKey && envKey !== 'your_groq_api_key_here') {
    cachedApiKey = envKey;
    return cachedApiKey;
  }

  if (supabase) {
    try {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'groq_api_key')
        .single();
      const key = data?.value || null;
      cachedApiKey = key;
      return key;
    } catch {
      console.warn('Could not fetch Groq API key from Supabase');
    }
  }

  cachedApiKey = null;
  return null;
}

// --- Types ---

export interface FoodItem {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodAnalysis {
  foods: FoodItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealType: 'colazione' | 'pranzo' | 'cena' | 'spuntino';
  confidence: 'alta' | 'media' | 'bassa';
  healthTip: string;
}

// --- Image compression ---

const MAX_IMAGE_SIZE = 1024; // max dimension in px
const JPEG_QUALITY = 0.7;

export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_IMAGE_SIZE) / width);
            width = MAX_IMAGE_SIZE;
          } else {
            width = Math.round((width * MAX_IMAGE_SIZE) / height);
            height = MAX_IMAGE_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas non supportato')); return; }
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Errore nel caricamento dell\'immagine'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Errore nella lettura del file'));
    reader.readAsDataURL(file);
  });
}

// Small thumbnail for storage
const THUMB_SIZE = 256;
const THUMB_QUALITY = 0.5;

export function createThumbnail(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > THUMB_SIZE || height > THUMB_SIZE) {
        if (width > height) {
          height = Math.round((height * THUMB_SIZE) / width);
          width = THUMB_SIZE;
        } else {
          width = Math.round((width * THUMB_SIZE) / height);
          height = THUMB_SIZE;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas non supportato')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', THUMB_QUALITY));
    };
    img.onerror = () => reject(new Error('Errore thumbnail'));
    img.src = dataUrl;
  });
}

// --- AI Analysis ---

function buildFoodPrompt(): string {
  const hour = new Date().getHours();
  const suggestedMeal = hour < 11 ? 'colazione' : hour < 15 ? 'pranzo' : hour < 18 ? 'spuntino' : 'cena';

  return `Sei un nutrizionista esperto italiano. Analizza questa foto di cibo e fornisci una stima dettagliata e precisa delle calorie e dei macronutrienti.

ISTRUZIONI:
- Identifica OGNI alimento visibile nella foto
- Stima la porzione basandoti sulle proporzioni visive (piatto, posate, mani come riferimento)
- Calcola calorie e macronutrienti per ogni alimento separatamente
- Sii il piu preciso possibile, usa i valori nutrizionali standard italiani
- Se non riesci a identificare il cibo con certezza, indica confidenza "bassa"

Rispondi SOLO con JSON valido in questa struttura esatta:
{
  "foods": [
    {
      "name": "nome dell'alimento in italiano",
      "portion": "quantita stimata (es. '150g', '1 fetta', '200ml')",
      "calories": 0,
      "protein": 0.0,
      "carbs": 0.0,
      "fat": 0.0
    }
  ],
  "totalCalories": 0,
  "totalProtein": 0.0,
  "totalCarbs": 0.0,
  "totalFat": 0.0,
  "mealType": "${suggestedMeal}",
  "confidence": "alta|media|bassa",
  "healthTip": "un consiglio nutrizionale breve e specifico basato su questo pasto"
}

REGOLE:
- Tutti i valori numerici in grammi (proteine, carboidrati, grassi) e kcal (calorie)
- Il totale deve essere la somma esatta dei singoli alimenti
- "confidence": "alta" se il cibo e chiaramente visibile, "media" se parzialmente visibile, "bassa" se incerto
- Se la foto NON contiene cibo, rispondi con: {"foods": [], "totalCalories": 0, "totalProtein": 0, "totalCarbs": 0, "totalFat": 0, "mealType": "${suggestedMeal}", "confidence": "bassa", "healthTip": "Non riesco a identificare cibo in questa immagine. Prova a scattare una foto piu chiara."}
- Rispondi SOLO con JSON, nessun testo prima o dopo
- Scrivi tutto in italiano`;
}

export async function analyzeFoodImage(imageDataUrl: string): Promise<FoodAnalysis> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error('Chiave API non configurata. Configura VITE_GROQ_API_KEY.');

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: buildFoodPrompt() },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Errore API: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Nessuna risposta dall\'IA');

  // Extract JSON from response (handle potential markdown wrapping)
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  const parsed = JSON.parse(jsonStr) as FoodAnalysis;

  if (!parsed.foods || typeof parsed.totalCalories !== 'number') {
    throw new Error('Risposta IA incompleta');
  }

  return parsed;
}

// --- Save & query food logs ---

export async function saveFoodLog(
  userId: number,
  analysis: FoodAnalysis,
  thumbnail?: string,
): Promise<number> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);

  const log: FoodLog = {
    userId,
    date,
    time,
    imageData: thumbnail,
    foodItems: JSON.stringify(analysis.foods),
    totalCalories: analysis.totalCalories,
    totalProtein: analysis.totalProtein,
    totalCarbs: analysis.totalCarbs,
    totalFat: analysis.totalFat,
    mealType: analysis.mealType,
    aiConfidence: analysis.confidence,
    createdAt: now,
  };

  return await db.foodLogs.add(log);
}

export async function getTodayFoodLogs(userId: number): Promise<FoodLog[]> {
  const today = new Date().toISOString().slice(0, 10);
  return db.foodLogs
    .where('[userId+date]')
    .equals([userId, today])
    .sortBy('time');
}

export async function getRecentFoodLogs(userId: number, days: number = 7): Promise<FoodLog[]> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  const start = startDate.toISOString().slice(0, 10);

  return db.foodLogs
    .where('[userId+date]')
    .between([userId, start], [userId, '\uffff'])
    .reverse()
    .sortBy('date');
}

export async function deleteFoodLog(id: number): Promise<void> {
  await db.foodLogs.delete(id);
}

export function getTodayCalorieSummary(logs: FoodLog[]): {
  total: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: number;
} {
  return {
    total: logs.reduce((s, l) => s + l.totalCalories, 0),
    protein: logs.reduce((s, l) => s + l.totalProtein, 0),
    carbs: logs.reduce((s, l) => s + l.totalCarbs, 0),
    fat: logs.reduce((s, l) => s + l.totalFat, 0),
    meals: logs.length,
  };
}
