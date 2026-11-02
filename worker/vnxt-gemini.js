// vnxt-gemini: Gemini proxy for VersaNext CRM voice. Key lives only in env.GEMINI_API_KEY (Worker secret).
const ORIGINS = ['https://crm.vnxt.app', 'https://austin-tss.github.io'];
let ORIGIN = ORIGINS[1];
const MODEL = 'gemini-flash-latest';
const LIMIT = 30, WINDOW = 60000; // 30 requests / minute / IP: Workers Rate Limiting binding RL, in-memory fallback
const hits = new Map();
function cors(o) { return { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin', ...(o || {}) }; }
function json(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: cors({ 'Content-Type': 'application/json' }) }); }
function limited(ip) { const now = Date.now(); const a = (hits.get(ip) || []).filter(t => now - t < WINDOW); a.push(now); hits.set(ip, a); if (hits.size > 5000) hits.clear(); return a.length > LIMIT; }
function clip(s, n) { return String(s == null ? '' : s).slice(0, n); }
async function gemini(env, prompt) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } })
  });
  if (!r.ok) throw new Error('gemini ' + r.status);
  const j = await r.json();
  const txt = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  return JSON.parse(txt.replace(/^```(json)?|```$/g, '').trim());
}
const RULES = 'Rules: dates as YYYY-MM-DD (resolve relative dates like "next Tuesday" from today), times HH:MM 24h, datetime-local as YYYY-MM-DDTHH:MM, numbers as plain digits (no $ or commas; "three hundred" -> 300, "2k" -> 2000), phone as (XXX) XXX-XXXX, emails lowercase, select fields MUST use one of the option values exactly. Monthly fee is the recurring amount ("a month", "/mo", "monthly"); deposit is the upfront amount. Close % / probability is 0-100. Contact/name fields get the person name only (e.g. "Sarah", not "Sarah at Acme"); company/account/customer fields get the company name only. Only include fields the speaker actually gave a value for; never invent values. Notes/explanation/textarea fields get the full cleaned-up sentence.';
function fieldDesc(f) { return { id: clip(f.id, 60), label: clip(f.label, 80), type: clip(f.type, 20), current: clip(f.current, 200), options: Array.isArray(f.options) ? f.options.slice(0, 60).map(o => ({ value: clip(o.value, 80), text: clip(o.text, 80) })) : undefined }; }
async function handle(req, env) {
    const origin = req.headers.get('Origin') || '';
    ORIGIN = ORIGINS.includes(origin) ? origin : ORIGINS[1];
    if (req.method === 'OPTIONS') return new Response(null, { status: ORIGINS.includes(origin) ? 204 : 403, headers: cors() });
    if (req.method === 'GET') return json({ ok: true, service: 'vnxt-gemini' });
    if (req.method !== 'POST') return json({ error: 'method' }, 405);
    if (!ORIGINS.includes(origin)) return json({ error: 'origin not allowed' }, 403);
    const ip = req.headers.get('CF-Connecting-IP') || 'x';
    if (env.RL) { const r = await env.RL.limit({ key: ip }); if (!r.success) return json({ error: 'rate limited' }, 429); } else if (limited(ip)) return json({ error: 'rate limited' }, 429);
    const raw = await req.text(); if (raw.length > 30000) return json({ error: 'too large' }, 413);
    let b; try { b = JSON.parse(raw); } catch (e) { return json({ error: 'bad json' }, 400); }
    const t = clip(b.transcript, 1500).trim(); if (!t) return json({ error: 'no transcript' }, 400);
    const today = clip(b.today, 10) || new Date().toISOString().slice(0, 10), tz = clip(b.tz, 60) || 'America/New_York';
    try {
      if (Array.isArray(b.fields)) {
        const fields = b.fields.slice(0, 40).map(fieldDesc);
        const p = 'You fill web form fields in a sales CRM from what a sales rep said.\nToday is ' + today + ' (' + tz + '). Page: ' + clip(b.page, 40) + '.\nSpoken: ' + JSON.stringify(t) + '\nFields: ' + JSON.stringify(fields) + '\n' + RULES + '\nIf the sentence is clearly an app navigation/command (e.g. "show my customers", "move deal 1003 to proposal") and contains no field values, return {"command":true}. Otherwise return {"values":{"<field id>":"<value>", ...}}. JSON only.';
        const out = await gemini(env, p);
        if (out && out.command === true) return json({ command: true, src: 'gemini' });
        const ids = new Set(fields.map(f => f.id)), values = {};
        for (const [k, v] of Object.entries((out && out.values) || {})) if (ids.has(k) && v != null && v !== '') values[k] = String(v);
        return json({ values, src: 'gemini' });
      }
      if (b.field && typeof b.field === 'object') {
        const f = fieldDesc(b.field);
        const p = 'Turn what a sales rep said into the value for ONE form field.\nToday is ' + today + ' (' + tz + ').\nSpoken: ' + JSON.stringify(t) + '\nField: ' + JSON.stringify(f) + '\n' + RULES + '\nReturn {"value":"..."} (or {"value":null} if no value). JSON only.';
        const out = await gemini(env, p);
        return json({ value: out && out.value != null ? String(out.value) : null, src: 'gemini' });
      }
      return json({ error: 'need fields or field' }, 400);
    } catch (e) { return json({ error: 'upstream', detail: clip(e.message, 100) }, 502); }
  }

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const r = await handle(req, env);
    const h = new Headers(r.headers);
    h.set('Access-Control-Allow-Origin', ORIGINS.includes(origin) ? origin : ORIGINS[1]);
    return new Response(r.body, { status: r.status, headers: h });
  }
};
