import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PPC Tennis — Privacy Policy</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; color: #333; line-height: 1.6; }
    h1 { color: #065f46; }
    h2 { color: #064e3b; margin-top: 2em; }
    .updated { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Privacy Policy — PPC Tennis Scorer</h1>
  <p class="updated">Last updated: June 2026</p>

  <h2>What data we collect</h2>
  <p>The PPC Tennis Scorer Garmin app collects and transmits the following data when you use the "Go Live" feature:</p>
  <ul>
    <li><strong>Player ID</strong> — A unique identifier linking your Garmin watch to your PPC Tennis account.</li>
    <li><strong>Match score data</strong> — Points, games, and sets during a live match, transmitted to our server for real-time display.</li>
  </ul>
  <p>When used in "Amistoso" (offline) mode, no data is transmitted. The app records tennis activity data locally on your Garmin device (duration, heart rate) as part of standard Garmin activity tracking.</p>

  <h2>How we use it</h2>
  <p>Score data is used solely to display live match progress on the PPC Tennis website (ppctennis.vercel.app). Player IDs are used to authenticate and associate scores with the correct match.</p>

  <h2>Data storage</h2>
  <p>Match data is stored in our database (Supabase, hosted in AWS). Player IDs are stored locally on your Garmin device and in our database.</p>

  <h2>Data sharing</h2>
  <p>We do not sell or share your data with third parties. Match scores are visible to other PPC Tennis members on the website.</p>

  <h2>Data deletion</h2>
  <p>You can unpair your Garmin device at any time by resetting the app. To request deletion of your account data, contact us at the email below.</p>

  <h2>Contact</h2>
  <p>For privacy questions, contact: pintapostchampionship@gmail.com</p>
</body>
</html>`);
}
