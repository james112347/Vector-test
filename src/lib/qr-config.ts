import { supabase } from './supabase';

let cachedQR: string | null | undefined = undefined;

/**
 * Get the Sahha QR code image (base64 data URL) from Supabase app_config.
 */
export async function getSahhaQR(): Promise<string | null> {
  if (cachedQR !== undefined) return cachedQR;

  if (!supabase) {
    cachedQR = null;
    return null;
  }

  try {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'sahha_qr_image')
      .single();
    const val: string | null = data?.value ?? null;
    cachedQR = val;
    return val;
  } catch {
    cachedQR = null;
    return null;
  }
}

/**
 * Save or update the Sahha QR code image (base64 data URL) in Supabase app_config.
 * Admin only.
 */
export async function saveSahhaQR(base64DataUrl: string): Promise<void> {
  if (!supabase) throw new Error('Supabase non configurato.');

  const { error } = await supabase
    .from('app_config')
    .upsert({ key: 'sahha_qr_image', value: base64DataUrl }, { onConflict: 'key' });

  if (error) throw new Error(`Errore salvataggio QR: ${error.message}`);
  cachedQR = base64DataUrl;
}

/**
 * Delete the Sahha QR code from Supabase app_config.
 * Admin only.
 */
export async function deleteSahhaQR(): Promise<void> {
  if (!supabase) return;

  await supabase
    .from('app_config')
    .delete()
    .eq('key', 'sahha_qr_image');

  cachedQR = null;
}
