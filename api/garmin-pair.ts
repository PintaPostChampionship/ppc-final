import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from './lib/verifyAuth.js';

/**
 * /api/garmin-pair — Endpoint para vincular un reloj Garmin con una cuenta PPC
 *
 * POST /api/garmin-pair (action: "generate")
 *   → Genera un código de 6 dígitos válido por 10 min (requiere auth JWT)
 *   → Response: { code: "482951", expires_at: "..." }
 *
 * POST /api/garmin-pair (action: "validate", code: "482951")
 *   → Valida un código y devuelve el player ID + nombre (llamado desde Garmin)
 *   → Response: { player_id: "uuid", name: "Javier", nickname: "JFones" }
 *
 * GET /api/garmin-pair?code=482951
 *   → Página de confirmación OAuth para Garmin Connect (redirige a connectiq://oauth)
 */

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://tzmbznenarrpjayntyjt.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, key);
}

function generateCode(): string {
  // 6-digit numeric code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabase();

  // ── GET: OAuth redirect page for Garmin Connect ──
  // When the Garmin watch calls makeOAuthRequest, it opens this URL in the phone browser.
  // The user confirms, and we redirect to connectiq://oauth with the player data.
  if (req.method === 'GET') {
    return handleOAuthPage(req, res, supabase);
  }

  // ── POST: Generate or validate codes ──
  if (req.method === 'POST') {
    const { action, code } = req.body ?? {};

    if (action === 'generate') {
      return handleGenerate(req, res, supabase);
    }

    if (action === 'validate') {
      return handleValidate(res, supabase, code);
    }

    return res.status(400).json({ error: 'Unknown action. Use "generate" or "validate".' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ─── Generate a pairing code (requires auth) ─────────────────────────────────

async function handleGenerate(req: VercelRequest, res: VercelResponse, supabase: ReturnType<typeof getSupabase>) {
  const userId = await verifyAuth(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized — login required' });
  }

  // Invalidate any existing active codes for this user
  await supabase
    .from('garmin_pairing_codes')
    .delete()
    .eq('profile_id', userId)
    .is('consumed_at', null);

  // Generate unique code (retry if collision)
  let code = generateCode();
  let attempts = 0;
  while (attempts < 5) {
    const { error } = await supabase
      .from('garmin_pairing_codes')
      .insert({
        profile_id: userId,
        code,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (!error) break;

    // Collision — try another code
    code = generateCode();
    attempts++;
  }

  if (attempts >= 5) {
    return res.status(500).json({ error: 'Failed to generate unique code' });
  }

  return res.status(200).json({
    code,
    expires_in_seconds: 600,
    message: 'Abre la app PPC Tennis en tu reloj Garmin y selecciona "Vincular". Cuando te pida, ingresa este código.',
  });
}

// ─── Validate a code (called from Garmin) ────────────────────────────────────

async function handleValidate(res: VercelResponse, supabase: ReturnType<typeof getSupabase>, code: string) {
  if (!code || typeof code !== 'string' || code.length !== 6) {
    return res.status(400).json({ error: 'Invalid code format (must be 6 digits)' });
  }

  // Find active (non-consumed, non-expired) code
  const { data, error } = await supabase
    .from('garmin_pairing_codes')
    .select('id, profile_id, expires_at')
    .eq('code', code)
    .is('consumed_at', null)
    .maybeSingle();

  if (error || !data) {
    return res.status(404).json({ error: 'Code not found or already used' });
  }

  // Check expiration
  if (new Date((data as any).expires_at) < new Date()) {
    return res.status(410).json({ error: 'Code expired. Generate a new one from the web.' });
  }

  // Mark as consumed
  await supabase
    .from('garmin_pairing_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', (data as any).id);

  // Get player profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, nickname')
    .eq('id', (data as any).profile_id)
    .single();

  if (!profile) {
    return res.status(500).json({ error: 'Profile not found' });
  }

  // Mark profile as Garmin-paired
  await supabase
    .from('profiles')
    .update({ garmin_paired_at: new Date().toISOString() })
    .eq('id', (profile as any).id);

  const p = profile as any;
  const displayName = p.nickname || (p.name ? p.name.split(' ')[0] : 'Player');

  return res.status(200).json({
    player_id: p.id,
    name: displayName,
    full_name: p.name,
  });
}

// ─── OAuth redirect page for Garmin Connect ──────────────────────────────────
// Flow:
// 1. Garmin watch calls makeOAuthRequest with URL: /api/garmin-pair?step=auth
// 2. Phone opens this URL in browser → shows pairing UI
// 3. User enters code (generated from web) and clicks "Vincular"
// 4. Server validates → redirects to connectiq://oauth?player_id=xxx&name=yyy
//
// OR simpler flow:
// 1. User generates code in web
// 2. Garmin watch calls makeOAuthRequest with URL: /api/garmin-pair?step=auth&code=XXXXXX
//    (user enters code on watch first via number picker)
// 3. Server validates → redirects to resultUrl with player data

async function handleOAuthPage(req: VercelRequest, res: VercelResponse, supabase: ReturnType<typeof getSupabase>) {
  const { code, step } = req.query;

  // If code is provided directly (from Garmin number input), validate and redirect
  if (code && typeof code === 'string' && code.length === 6) {
    // Validate the code
    const { data, error } = await supabase
      .from('garmin_pairing_codes')
      .select('id, profile_id, expires_at')
      .eq('code', code)
      .is('consumed_at', null)
      .maybeSingle();

    if (error || !data) {
      return res.status(200).send(errorPage('Código no encontrado o ya usado. Genera uno nuevo desde la web.'));
    }

    if (new Date((data as any).expires_at) < new Date()) {
      return res.status(200).send(errorPage('Código expirado. Genera uno nuevo desde la web del PPC.'));
    }

    // Mark consumed
    await supabase
      .from('garmin_pairing_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', (data as any).id);

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, nickname')
      .eq('id', (data as any).profile_id)
      .single();

    if (!profile) {
      return res.status(200).send(errorPage('Perfil no encontrado.'));
    }

    // Mark as paired
    await supabase
      .from('profiles')
      .update({ garmin_paired_at: new Date().toISOString() })
      .eq('id', (profile as any).id);

    const p = profile as any;
    const displayName = p.nickname || (p.name ? p.name.split(' ')[0] : 'Player');

    // Redirect back to Garmin with player data
    // connectiq://oauth is the standard Garmin OAuth callback
    const redirectUrl = `https://localhost/garmin-pair-complete?player_id=${encodeURIComponent(p.id)}&name=${encodeURIComponent(displayName)}`;

    return res.status(200).send(successPage(displayName, redirectUrl));
  }

  // Show the pairing page (step=auth or no code)
  return res.status(200).send(pairingPage());
}

// ─── HTML pages ──────────────────────────────────────────────────────────────

function pairingPage(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PPC Tennis — Vincular Garmin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #064e3b; color: white; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 40px; max-width: 380px; width: 100%; text-align: center; border: 1px solid rgba(255,255,255,0.2); }
    h1 { font-size: 1.5rem; margin-bottom: 8px; }
    .subtitle { color: rgba(255,255,255,0.7); font-size: 0.9rem; margin-bottom: 24px; }
    .code-input { display: flex; gap: 6px; justify-content: center; margin: 20px 0; }
    .code-input input { width: 44px; height: 54px; text-align: center; font-size: 1.5rem; font-weight: bold; border: 2px solid rgba(255,255,255,0.3); border-radius: 12px; background: rgba(255,255,255,0.1); color: white; outline: none; }
    .code-input input:focus { border-color: #34d399; background: rgba(52,211,153,0.1); }
    .btn { display: block; width: 100%; padding: 14px; border: none; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 16px; transition: all 0.2s; }
    .btn-primary { background: white; color: #064e3b; }
    .btn-primary:hover { background: #d1fae5; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #fca5a5; font-size: 0.85rem; margin-top: 12px; display: none; }
    .loading { display: none; }
    .steps { text-align: left; margin: 20px 0; font-size: 0.85rem; color: rgba(255,255,255,0.8); }
    .steps li { margin-bottom: 8px; padding-left: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>⌚ Vincular Garmin</h1>
    <p class="subtitle">Conecta tu reloj Garmin con tu cuenta PPC Tennis</p>
    
    <ol class="steps">
      <li>En la web del PPC, ve a "Conectar Garmin"</li>
      <li>Genera un código de vinculación</li>
      <li>Ingresa el código aquí abajo</li>
    </ol>

    <div class="code-input" id="codeInput">
      <input type="tel" maxlength="1" inputmode="numeric" pattern="[0-9]" />
      <input type="tel" maxlength="1" inputmode="numeric" pattern="[0-9]" />
      <input type="tel" maxlength="1" inputmode="numeric" pattern="[0-9]" />
      <input type="tel" maxlength="1" inputmode="numeric" pattern="[0-9]" />
      <input type="tel" maxlength="1" inputmode="numeric" pattern="[0-9]" />
      <input type="tel" maxlength="1" inputmode="numeric" pattern="[0-9]" />
    </div>

    <button class="btn btn-primary" id="pairBtn" disabled>Vincular</button>
    <p class="error" id="errorMsg"></p>
    <p class="loading" id="loadingMsg">Verificando código...</p>
  </div>

  <script>
    const inputs = document.querySelectorAll('.code-input input');
    const btn = document.getElementById('pairBtn');
    const errorMsg = document.getElementById('errorMsg');
    const loadingMsg = document.getElementById('loadingMsg');

    // Auto-focus and auto-advance
    inputs.forEach((input, i) => {
      input.addEventListener('input', (e) => {
        const val = e.target.value;
        if (val && i < inputs.length - 1) inputs[i + 1].focus();
        checkComplete();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && i > 0) {
          inputs[i - 1].focus();
        }
      });
      // Handle paste
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\\D/g, '');
        for (let j = 0; j < Math.min(paste.length, 6); j++) {
          inputs[j].value = paste[j];
        }
        if (paste.length >= 6) inputs[5].focus();
        checkComplete();
      });
    });

    function checkComplete() {
      const code = Array.from(inputs).map(i => i.value).join('');
      btn.disabled = code.length < 6;
    }

    btn.addEventListener('click', async () => {
      const code = Array.from(inputs).map(i => i.value).join('');
      if (code.length !== 6) return;

      btn.disabled = true;
      errorMsg.style.display = 'none';
      loadingMsg.style.display = 'block';

      try {
        const resp = await fetch('/api/garmin-pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'validate', code })
        });
        const data = await resp.json();

        if (resp.ok && data.player_id) {
          // Success! Redirect to connectiq://oauth callback
          const params = new URLSearchParams({
            player_id: data.player_id,
            name: data.name || 'Player'
          });
          window.location.href = 'https://localhost/garmin-pair-complete?' + params.toString();
        } else {
          errorMsg.textContent = data.error || 'Código inválido';
          errorMsg.style.display = 'block';
          btn.disabled = false;
        }
      } catch (err) {
        errorMsg.textContent = 'Error de conexión. Intenta de nuevo.';
        errorMsg.style.display = 'block';
        btn.disabled = false;
      }
      loadingMsg.style.display = 'none';
    });

    inputs[0].focus();
  </script>
</body>
</html>`;
}

function successPage(name: string, redirectUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PPC Tennis — Vinculado!</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #064e3b; color: white; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 40px; max-width: 380px; width: 100%; text-align: center; border: 1px solid rgba(255,255,255,0.2); }
    h1 { font-size: 1.5rem; margin-bottom: 12px; }
    p { color: rgba(255,255,255,0.8); margin-bottom: 8px; }
    .name { font-size: 1.2rem; font-weight: bold; color: #34d399; }
    .info { font-size: 0.85rem; color: rgba(255,255,255,0.6); margin-top: 16px; }
  </style>
  <meta http-equiv="refresh" content="2;url=${redirectUrl}" />
</head>
<body>
  <div class="card">
    <h1>✅ ¡Vinculado!</h1>
    <p class="name">${name}</p>
    <p>Tu reloj Garmin está conectado con tu cuenta PPC.</p>
    <p class="info">Redirigiendo al reloj...</p>
  </div>
</body>
</html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PPC Tennis — Error</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, sans-serif; background: #064e3b; color: white; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 40px; max-width: 380px; width: 100%; text-align: center; border: 1px solid rgba(255,255,255,0.2); }
    h1 { font-size: 1.5rem; margin-bottom: 12px; color: #fca5a5; }
    p { color: rgba(255,255,255,0.8); }
  </style>
</head>
<body>
  <div class="card">
    <h1>❌ Error</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
