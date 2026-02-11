/**
 * Supabase Edge Function: sahha-auth
 *
 * Proxy for Sahha account-level operations that require clientId/clientSecret.
 * Keeps secrets server-side, never exposed to the client.
 *
 * Required secrets (set via `supabase secrets set`):
 *   SAHHA_CLIENT_ID     - from Sahha Dashboard → Credentials
 *   SAHHA_CLIENT_SECRET - from Sahha Dashboard → Credentials
 *   SAHHA_API_URL       - https://sandbox-api.sahha.ai (or production)
 *   SUPABASE_URL        - (auto-provided)
 *   SUPABASE_SERVICE_ROLE_KEY - (auto-provided)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CLIENT_ID = Deno.env.get('SAHHA_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('SAHHA_CLIENT_SECRET') ?? '';
const API_URL = Deno.env.get('SAHHA_API_URL') ?? 'https://sandbox-api.sahha.ai';

interface RequestBody {
  action: 'register' | 'token';
  externalId: string;
}

async function getAccountToken(): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/oauth/account/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
  });
  if (!res.ok) {
    throw new Error(`Sahha account token error: ${res.status}`);
  }
  const data = await res.json();
  return data.accountToken;
}

Deno.serve(async (req: Request) => {
  // CORS headers
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
    const { action, externalId } = body;

    if (!externalId) {
      return new Response(JSON.stringify({ error: 'externalId required' }), {
        status: 400,
        headers,
      });
    }

    const accountToken = await getAccountToken();

    if (action === 'register') {
      // Register a new Sahha profile
      const res = await fetch(`${API_URL}/api/v1/oauth/profile/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `account ${accountToken}`,
        },
        body: JSON.stringify({ externalId }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return new Response(
          JSON.stringify({ error: `Sahha register failed: ${errText}` }),
          { status: res.status, headers },
        );
      }

      const tokenData = await res.json();

      // Save profile mapping in Supabase
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );

      // Find app user by external_id pattern (we use a UUID stored in profile)
      await supabase.from('sahha_profiles').upsert(
        {
          user_id: parseInt(externalId.split('-').pop() ?? '0', 10),
          external_id: externalId,
        },
        { onConflict: 'external_id' },
      );

      return new Response(JSON.stringify(tokenData), { status: 200, headers });
    }

    if (action === 'token') {
      // Get a profile token for an existing profile
      const res = await fetch(`${API_URL}/api/v1/oauth/profile/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `account ${accountToken}`,
        },
        body: JSON.stringify({ externalId }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return new Response(
          JSON.stringify({ error: `Sahha token failed: ${errText}` }),
          { status: res.status, headers },
        );
      }

      const tokenData = await res.json();
      return new Response(JSON.stringify(tokenData), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers,
    });
  } catch (err) {
    console.error('sahha-auth error:', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers },
    );
  }
});
