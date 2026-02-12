/**
 * Supabase Edge Function: send-reset-email
 *
 * Generates a password reset token and sends a reset link via email (Resend).
 *
 * Required secrets (set via `supabase secrets set`):
 *   RESEND_API_KEY     - API key from resend.com (free tier: 100 emails/day)
 *   APP_URL            - e.g. https://james112347.github.io/Vector-test
 *   SUPABASE_URL       - (auto-provided)
 *   SUPABASE_SERVICE_ROLE_KEY - (auto-provided)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://james112347.github.io/Vector-test';

interface RequestBody {
  action: 'request' | 'validate' | 'reset';
  email?: string;
  token?: string;
  passwordHash?: string;
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
}

Deno.serve(async (req: Request) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const supabase = getSupabase();

    // === REQUEST: Generate token and send email ===
    if (body.action === 'request') {
      const email = body.email?.trim().toLowerCase();
      if (!email) {
        return new Response(JSON.stringify({ error: 'Email richiesta' }), {
          status: 400,
          headers,
        });
      }

      // Check user exists
      const { data: user } = await supabase
        .from('app_users')
        .select('id, email')
        .eq('email', email)
        .single();

      if (!user) {
        // Don't reveal whether email exists - always return success
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }

      // Generate token
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Invalidate any existing tokens for this email
      await supabase
        .from('password_resets')
        .update({ used: true })
        .eq('email', email)
        .eq('used', false);

      // Store token
      const { error: insertError } = await supabase.from('password_resets').insert({
        email,
        token,
        expires_at: expiresAt.toISOString(),
      });

      if (insertError) {
        console.error('Token insert error:', insertError);
        return new Response(JSON.stringify({ error: 'Errore interno' }), {
          status: 500,
          headers,
        });
      }

      // Send email via Resend
      const resetLink = `${APP_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Vector App <onboarding@resend.dev>',
          to: [email],
          subject: 'Reset password - Vector',
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #1e40af;">Vector - Reset Password</h2>
              <p>Hai richiesto il reset della tua password.</p>
              <p>Clicca il pulsante qui sotto per impostare una nuova password:</p>
              <a href="${resetLink}"
                 style="display: inline-block; background: #1e40af; color: white; padding: 12px 24px;
                        text-decoration: none; border-radius: 8px; margin: 16px 0; font-weight: 600;">
                Reimposta password
              </a>
              <p style="color: #666; font-size: 13px;">
                Se non hai richiesto tu il reset, puoi ignorare questa email.
                <br>Il link scade tra 1 ora.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="color: #999; font-size: 11px;">Vector - Energy Tracker</p>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.error('Resend error:', errText);
        return new Response(JSON.stringify({ error: 'Errore invio email' }), {
          status: 500,
          headers,
        });
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    // === VALIDATE: Check if token is valid ===
    if (body.action === 'validate') {
      const { token, email } = body;
      if (!token || !email) {
        return new Response(JSON.stringify({ valid: false }), { status: 200, headers });
      }

      const { data } = await supabase
        .from('password_resets')
        .select('*')
        .eq('token', token)
        .eq('email', email.toLowerCase())
        .eq('used', false)
        .single();

      const valid = !!data && new Date(data.expires_at) > new Date();
      return new Response(JSON.stringify({ valid }), { status: 200, headers });
    }

    // === RESET: Validate token and update password hash ===
    if (body.action === 'reset') {
      const { token, email, passwordHash } = body;
      if (!token || !email || !passwordHash) {
        return new Response(JSON.stringify({ error: 'Dati mancanti' }), {
          status: 400,
          headers,
        });
      }

      // Validate token
      const { data: resetRecord } = await supabase
        .from('password_resets')
        .select('*')
        .eq('token', token)
        .eq('email', email.toLowerCase())
        .eq('used', false)
        .single();

      if (!resetRecord || new Date(resetRecord.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Link scaduto o non valido. Richiedi un nuovo reset.' }),
          { status: 400, headers },
        );
      }

      // Update password hash in app_users
      const { error: updateError } = await supabase
        .from('app_users')
        .update({
          password_hash: passwordHash,
          updated_at: new Date().toISOString(),
        })
        .eq('email', email.toLowerCase());

      if (updateError) {
        console.error('Update password error:', updateError);
        return new Response(JSON.stringify({ error: 'Errore aggiornamento password' }), {
          status: 500,
          headers,
        });
      }

      // Mark token as used
      await supabase
        .from('password_resets')
        .update({ used: true })
        .eq('token', token);

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Azione non valida' }), {
      status: 400,
      headers,
    });
  } catch (err) {
    console.error('send-reset-email error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers },
    );
  }
});
