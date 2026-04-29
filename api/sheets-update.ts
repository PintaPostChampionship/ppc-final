import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSign } from 'node:crypto';

const SPREADSHEET_ID = '1DC64PmiKF7yerp59-PT0fnEGcU0xSW7Dm500PyBtJWg';
const SHEET_NAME = 'pagos_web';

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

interface SheetRow {
  profile_id: string;
  nombre: string;
  division: string;
  torneo: string;
  estado: string;
  fecha_autoreporte: string | null;
  fecha_validacion: string | null;
}

function validateStateTransition(currentStatus: string): boolean {
  return currentStatus === 'pendiente';
}

function findRow(rows: SheetRow[], profileId: string, torneo: string): SheetRow | undefined {
  return rows.find((r) => r.profile_id === profileId && r.torneo === torneo);
}

async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(credentials.private_key, 'base64url');
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function readSheet(token: string): Promise<SheetRow[]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as { values?: string[][] };
  if (!data.values || data.values.length < 2) return [];

  const rows = data.values.slice(1);
  return rows.map((row) => ({
    profile_id: row[0] ?? '',
    nombre: row[1] ?? '',
    division: row[2] ?? '',
    torneo: row[3] ?? '',
    estado: row[4] ?? '',
    fecha_autoreporte: row[5] ?? null,
    fecha_validacion: row[6] ?? null,
  }));
}

async function updateRow(token: string, rowNum: number, timestamp: string): Promise<void> {
  const range = `${SHEET_NAME}!E${rowNum}:F${rowNum}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [['pagado_sin_validar', timestamp]] }),
  });
  const data = (await res.json()) as { error?: { message: string } };
  if (data.error) throw new Error(`Sheets write error: ${data.error.message}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[sheets-update] Request received:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { profile_id, torneo } = (req.body ?? {}) as { profile_id?: string; torneo?: string };
  console.log('[sheets-update] Body:', { profile_id, torneo });

  if (!profile_id || !torneo) {
    return res.status(400).json({ error: 'Missing required fields: profile_id and torneo' });
  }

  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentialsJson) {
    console.error('[sheets-update] GOOGLE_SERVICE_ACCOUNT_JSON not found in env');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  let credentials: ServiceAccountCredentials;
  try {
    credentials = JSON.parse(credentialsJson) as ServiceAccountCredentials;
    console.log('[sheets-update] Credentials parsed, email:', credentials.client_email);
  } catch (e) {
    console.error('[sheets-update] Failed to parse credentials:', e);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    console.log('[sheets-update] Getting access token...');
    const token = await getAccessToken(credentials);
    console.log('[sheets-update] Token obtained');

    console.log('[sheets-update] Reading sheet...');
    const rows = await readSheet(token);
    console.log(`[sheets-update] Read ${rows.length} rows`);

    const targetRow = findRow(rows, profile_id, torneo);
    if (!targetRow) {
      console.log(`[sheets-update] Player not found: ${profile_id} / ${torneo}`);
      return res.status(400).json({ error: 'Player not found for this tournament' });
    }
    console.log(`[sheets-update] Found: ${targetRow.nombre}, estado: ${targetRow.estado}`);

    if (!validateStateTransition(targetRow.estado)) {
      console.log(`[sheets-update] Transition not allowed from: ${targetRow.estado}`);
      return res.status(400).json({ error: 'Payment already reported or validated' });
    }

    const rowIndex = rows.findIndex((r) => r.profile_id === profile_id && r.torneo === torneo);
    const rowNum = rowIndex + 2;
    const timestamp = new Date().toISOString();

    console.log(`[sheets-update] Updating row ${rowNum}...`);
    await updateRow(token, rowNum, timestamp);
    console.log('[sheets-update] Done!');

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[sheets-update] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
