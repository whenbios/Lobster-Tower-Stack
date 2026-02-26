const GAME_ID = 'f76cb221-2ca5-4325-995a-f3e649282ee3';
const API_BASE = 'https://api.play.fun';

async function getAuthHeader(env, method, path) {
  const resp = await fetch(`${API_BASE}/user/hmac-signature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, path, apiKey: env.PLAYFUN_KEY, secretKey: env.PLAYFUN_SECRET })
  });
  const { data } = await resp.json();
  return data.signature;
}

export default {
  async fetch(request, env) {
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

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!playerId || !uuidRegex.test(playerId) || score === undefined || score < 0 || score > 100) {
      return new Response(JSON.stringify({ error: 'Invalid score or playerId' }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    try {
      const path = '/play/dev/batch-save-points';
      const authHeader = await getAuthHeader(env, 'POST', path);

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
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
