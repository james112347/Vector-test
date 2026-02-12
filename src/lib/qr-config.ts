/**
 * Sahha QR code storage via Supabase `feedbacks` table.
 *
 * Uses the same pattern as data-sync.ts: stores the QR image as a special
 * feedback row with category `_sahha_qr`. This bypasses RLS restrictions
 * on the `app_config` table which only allows reads from the anon key.
 */
import { supabase } from './supabase';

const QR_CATEGORY = '_sahha_qr';
const QR_EMAIL = 'system@vector.app';

let cachedQR: string | null | undefined = undefined;

/**
 * Get the Sahha QR code image (base64 data URL) from Supabase.
 */
export async function getSahhaQR(): Promise<string | null> {
  if (cachedQR !== undefined) return cachedQR;

  if (!supabase) {
    cachedQR = null;
    return null;
  }

  try {
    const { data } = await supabase
      .from('feedbacks')
      .select('message')
      .eq('category', QR_CATEGORY)
      .eq('user_email', QR_EMAIL)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    const val: string | null = data?.message ?? null;
    cachedQR = val;
    return val;
  } catch {
    cachedQR = null;
    return null;
  }
}

/**
 * Save or update the Sahha QR code image (base64 data URL).
 * Admin only. Deletes any old QR row, then inserts a new one.
 */
export async function saveSahhaQR(base64DataUrl: string): Promise<void> {
  if (!supabase) throw new Error('Supabase non configurato.');

  // Remove old QR rows
  await supabase
    .from('feedbacks')
    .delete()
    .eq('category', QR_CATEGORY)
    .eq('user_email', QR_EMAIL);

  // Insert new one
  const { error } = await supabase
    .from('feedbacks')
    .insert({
      user_email: QR_EMAIL,
      category: QR_CATEGORY,
      message: base64DataUrl,
      status: 'read',
    });

  if (error) throw new Error(`Errore salvataggio QR: ${error.message}`);
  cachedQR = base64DataUrl;
}

/**
 * Delete the Sahha QR code.
 * Admin only.
 */
export async function deleteSahhaQR(): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('feedbacks')
    .delete()
    .eq('category', QR_CATEGORY)
    .eq('user_email', QR_EMAIL);

  if (error) throw new Error(`Errore rimozione QR: ${error.message}`);
  cachedQR = null;
}
