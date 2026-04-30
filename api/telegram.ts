import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- Types ---

interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  text?: string;
  date: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// --- Config ---

const REPOS: Record<string, { owner: string; repo: string; workflow: string }> = {
  ppc: {
    owner: 'jifones',
    repo: 'ppc-final',
    workflow: 'kiro-remote.yml',
  },
  booking: {
    owner: 'jifones',
    repo: 'booking_ppc',
    workflow: 'kiro-remote.yml',
  },
};

// --- Telegram helpers ---

async function sendTelegram(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });
}

// --- GitHub helpers ---

async function dispatchWorkflow(
  repoKey: string,
  prompt: string,
  trustLevel: string,
  createPr: boolean
): Promise<{ ok: boolean; error?: string }> {
  const ghToken = process.env.GH_PAT_TOKEN;
  if (!ghToken) return { ok: false, error: 'GH_PAT_TOKEN not configured' };

  const repo = REPOS[repoKey];
  if (!repo) return { ok: false, error: `Repo "${repoKey}" not found` };

  const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/actions/workflows/${repo.workflow}/dispatches`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ghToken}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: {
        prompt,
        trust_level: trustLevel,
        create_pr: String(createPr),
      },
    }),
  });

  if (res.status === 204) return { ok: true };
  const body = await res.text();
  return { ok: false, error: `GitHub API ${res.status}: ${body}` };
}

// --- Parse message ---

interface ParsedCommand {
  repoKey: string;
  prompt: string;
  trustLevel: string;
  createPr: boolean;
}

function parseMessage(text: string): ParsedCommand | null {
  const trimmed = text.trim();

  // Check for repo prefix: "ppc: ..." or "booking: ..."
  const prefixMatch = trimmed.match(/^(ppc|booking)\s*:\s*(.+)/is);
  if (!prefixMatch) return null;

  const repoKey = prefixMatch[1].toLowerCase();
  let prompt = prefixMatch[2].trim();
  let trustLevel = 'all';
  let createPr = true;

  // Check for flags at the end
  if (/\s*--readonly\s*$/i.test(prompt)) {
    trustLevel = 'read-only';
    createPr = false;
    prompt = prompt.replace(/\s*--readonly\s*$/i, '').trim();
  }

  if (/\s*--nopr\s*$/i.test(prompt)) {
    createPr = false;
    prompt = prompt.replace(/\s*--nopr\s*$/i, '').trim();
  }

  return { repoKey, prompt, trustLevel, createPr };
}

// --- Handler ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const update = req.body as TelegramUpdate;
  const message = update?.message;

  if (!message?.text) {
    return res.status(200).json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text;

  // --- Auth check ---
  const allowedChatId = process.env.TELEGRAM_CHAT_ID;

  if (!allowedChatId) {
    // No chat ID configured — respond with the sender's ID so they can set it up
    await sendTelegram(
      chatId,
      `🔑 *Setup mode*\n\nTu Chat ID es: \`${chatId}\`\n\nAgrega este valor como \`TELEGRAM_CHAT_ID\` en Vercel y redeploya.`
    );
    return res.status(200).json({ ok: true });
  }

  if (String(chatId) !== allowedChatId) {
    // Unauthorized user
    return res.status(200).json({ ok: true });
  }

  // --- Commands ---

  if (text === '/start' || text === '/help') {
    await sendTelegram(
      chatId,
      `🤖 *Kiro Remote Bot*\n\n` +
        `Envía instrucciones con el prefijo del repo:\n\n` +
        `\`ppc: lista los últimos 5 partidos\`\n` +
        `\`booking: describe run_scheduler.py\`\n\n` +
        `*Flags opcionales:*\n` +
        `\`--readonly\` → solo lectura, sin PR\n` +
        `\`--nopr\` → permite cambios pero sin crear PR\n\n` +
        `*Ejemplos:*\n` +
        `\`ppc: cuántos jugadores hay registrados --readonly\`\n` +
        `\`booking: agrega un comentario en main.py\`\n` +
        `\`ppc: lista las tablas de supabase --readonly\``
    );
    return res.status(200).json({ ok: true });
  }

  if (text === '/status') {
    await sendTelegram(chatId, `✅ Bot activo\n\nRepos: ppc, booking`);
    return res.status(200).json({ ok: true });
  }

  // --- Parse and dispatch ---

  const parsed = parseMessage(text);

  if (!parsed) {
    await sendTelegram(
      chatId,
      `⚠️ Formato: \`ppc: tu instrucción\` o \`booking: tu instrucción\`\n\nEscribe /help para ver ejemplos.`
    );
    return res.status(200).json({ ok: true });
  }

  // Dispatch to GitHub
  const repoLabel = parsed.repoKey === 'ppc' ? 'ppc-final' : 'booking_ppc';
  await sendTelegram(
    chatId,
    `⏳ Enviando a *${repoLabel}*...\n\n` +
      `📝 _${parsed.prompt}_\n` +
      `🔒 Trust: ${parsed.trustLevel}\n` +
      `📦 PR: ${parsed.createPr ? 'sí' : 'no'}`
  );

  const result = await dispatchWorkflow(
    parsed.repoKey,
    parsed.prompt,
    parsed.trustLevel,
    parsed.createPr
  );

  if (result.ok) {
    await sendTelegram(
      chatId,
      `✅ *Workflow disparado* en ${repoLabel}\n\n` +
        `Revisa el progreso en:\nhttps://github.com/jifones/${repoLabel === 'ppc-final' ? 'ppc-final' : 'booking_ppc'}/actions`
    );
  } else {
    await sendTelegram(chatId, `❌ Error: ${result.error}`);
  }

  return res.status(200).json({ ok: true });
}
