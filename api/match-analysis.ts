import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/match-analysis
 *
 * Generates an AI analysis of a tennis match using Google Gemini (free tier).
 * Returns: { analysis: "..." }
 *
 * Requires GEMINI_API_KEY environment variable.
 */

interface AnalysisPayload {
  session_id: string;
  result: string;
  format: string;
  duration_secs: number;
  avg_hr: number;
  max_hr: number;
  calories: number;
  total_points: number;
  points_won_me: number;
  points_won_rival: number;
  rival_name: string;
  date: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const body = req.body as AnalysisPayload;
  if (!body || !body.session_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const {
    result, format, duration_secs, avg_hr, max_hr,
    calories, total_points, points_won_me, points_won_rival,
    rival_name, date,
  } = body;

  const durationMin = Math.round(duration_secs / 60);
  const winPct = total_points > 0 ? Math.round((points_won_me / total_points) * 100) : 0;

  const formatLabel = format === 'standard' ? 'Standard (best of 3)'
    : format === 'supertiebreak' ? 'Super Tiebreak (3rd set = STB)'
    : format === 'nextgen' ? 'NextGen (tiebreak at 3-3)'
    : format;

  const prompt = `Eres un analista de tenis amateur. Genera un analisis breve (max 150 palabras) en espanol de este partido. Se directo, usa datos concretos, y da 1-2 consejos accionables.

DATOS DEL PARTIDO:
- Resultado: ${result} (formato: ${formatLabel})
- Rival: ${rival_name}
- Duracion: ${durationMin} minutos
- Puntos totales: ${total_points} (ganados: ${points_won_me}, perdidos: ${points_won_rival}, ${winPct}% de efectividad)
- HR promedio: ${avg_hr} bpm | HR maxima: ${max_hr} bpm
- Calorias: ${calories}
- Fecha: ${new Date(date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}

FORMATO DE RESPUESTA (usa exactamente estas secciones, separadas por linea vacia):
Resumen: (1-2 frases del partido)

Lo positivo: (basado en los datos)

Area de mejora: (basado en los datos)

Consejo: (para el proximo partido)`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini error:', response.status, errorData);
      return res.status(502).json({ error: 'Error calling AI service' });
    }

    const data = await response.json();
    const analysis = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!analysis) {
      return res.status(502).json({ error: 'Empty response from AI' });
    }

    return res.status(200).json({ analysis });
  } catch (err) {
    console.error('Match analysis error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
