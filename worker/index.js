const GAME_ID = 'f76cb221-2ca5-4325-995a-f3e649282ee3';
const API_BASE = 'https://api.play.fun';

async function hmacSignature(secretKey, method, path) {
  const timestamp = Math.floor(Date.now() / 1000);
  const dataToSign = `${method.toLowerCase()}\n${path.toLowerCase()}\n${timestamp}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dataToSign));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return { signature: hex, timestamp };
}

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const { playerId, score } = body;

    if (!playerId || score === undefined || score < 0 || score > 100) {
      return new Response(JSON.stringify({ error: 'Invalid score or playerId' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const path = '/play/dev/batch-save-points';
    const { signature, timestamp } = await hmacSignature(env.PLAYFUN_SECRET, 'POST', path);
    const authHeader = `HMAC-SHA256 apiKey=${env.PLAYFUN_KEY}, signature=${signature}, timestamp=${timestamp}`;

    const resp = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameApiKey: GAME_ID,
        points: [{ playerId: String(playerId), points: String(score) }]
      })
    });

    const result = await resp.json();
    return new Response(JSON.stringify(result), {
      status: resp.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
};
