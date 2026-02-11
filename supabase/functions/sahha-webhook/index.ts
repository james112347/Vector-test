/**
 * Supabase Edge Function: sahha-webhook
 *
 * Receives webhook events from Sahha and stores them in Supabase tables.
 *
 * Required secrets (set via `supabase secrets set`):
 *   SAHHA_WEBHOOK_SECRET - HMAC-SHA256 key for signature verification
 *   SUPABASE_URL         - (auto-provided by Supabase)
 *   SUPABASE_SERVICE_ROLE_KEY - (auto-provided by Supabase)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WEBHOOK_SECRET = Deno.env.get('SAHHA_WEBHOOK_SECRET') ?? '';

async function verifySignature(
  body: string,
  signature: string,
): Promise<boolean> {
  if (!WEBHOOK_SECRET || !signature) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return computed === signature.toLowerCase();
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();

  // Verify HMAC signature
  const xSignature = req.headers.get('x-signature') ?? '';
  if (WEBHOOK_SECRET) {
    const valid = await verifySignature(rawBody, xSignature);
    if (!valid) {
      return new Response('Invalid signature', { status: 401 });
    }
  }

  const externalId = req.headers.get('x-external-id') ?? '';
  const eventType = req.headers.get('x-event-type') ?? '';

  if (!externalId) {
    return new Response('Missing x-external-id', { status: 400 });
  }

  // Init Supabase admin client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Resolve user_id from sahha_profiles
  const { data: profile } = await supabase
    .from('sahha_profiles')
    .select('user_id')
    .eq('external_id', externalId)
    .single();

  if (!profile) {
    console.error(`No profile found for externalId: ${externalId}`);
    return new Response('Profile not found', { status: 404 });
  }

  const userId = profile.user_id;
  const payload = JSON.parse(rawBody);

  try {
    if (eventType === 'ScoreCreatedIntegrationEvent') {
      // payload is a score or array of scores
      const scores = Array.isArray(payload) ? payload : [payload];
      const rows = scores.map((s: Record<string, unknown>) => ({
        user_id: userId,
        type: s.type,
        score: s.score,
        state: s.state,
        factors: s.factors,
        score_date_time: s.scoreDateTime,
      }));
      const { error } = await supabase.from('sahha_scores').insert(rows);
      if (error) throw error;
    } else if (eventType === 'BiomarkerCreatedIntegrationEvent') {
      const biomarkers = Array.isArray(payload) ? payload : [payload];
      const rows = biomarkers.map((b: Record<string, unknown>) => ({
        user_id: userId,
        sahha_id: b.id,
        type: b.type,
        category: b.category,
        value: String(b.value),
        unit: b.unit,
        aggregation: b.aggregation,
        periodicity: b.periodicity,
        start_date_time: b.startDateTime,
        end_date_time: b.endDateTime,
      }));
      // Upsert using sahha_id for idempotency
      const { error } = await supabase
        .from('sahha_biomarkers')
        .upsert(rows, { onConflict: 'sahha_id' });
      if (error) throw error;
    } else {
      console.log(`Unhandled event type: ${eventType}`);
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
    return new Response('Processing error', { status: 500 });
  }

  return new Response('OK', { status: 200 });
});
