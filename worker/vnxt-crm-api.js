// vnxt-crm-api: logins, sessions and per-owner data for the VersaNext CRM.
// Deployed as owner.js + this file concatenated. KV binding: KV. PIN hashes (salted PBKDF2) live only in KV.
const ORIGINS = ['https://crm.vnxt.app', 'https://austin-tss.github.io'];
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const rnd = n => hex(crypto.getRandomValues(new Uint8Array(n)));
async function pinHash(pin, salt) {
  const h1 = hex(await crypto.subtle.digest('SHA-256', enc.encode(pin)));
  const k = await crypto.subtle.importKey('raw', enc.encode(h1), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, k, 256));
}
const eq = (a, b) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const newPin = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0');
const pub = x => ({ u: x.u, name: x.name, role: x.role, title: x.title || (x.role === 'admin' ? 'Admin' : 'Account Manager') });
export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const okO = ORIGINS.includes(origin);
    const H = { 'Access-Control-Allow-Origin': okO ? origin : ORIGINS[0], 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
    const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { ...H, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: okO ? 204 : 403, headers: H });
    const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'GET' && path === '/') return json({ ok: true, service: 'vnxt-crm-api' });
    if (!okO) return json({ error: 'origin not allowed' }, 403);
    const KV = env.KV;
    const users = async () => (await KV.get('users', 'json')) || [];
    const getU = u => KV.get('user:' + u, 'json');
    let body = {};
    if (req.method === 'POST' || req.method === 'PUT') { const raw = await req.text(); if (raw.length > 2e6) return json({ error: 'too large' }, 413); try { body = raw ? JSON.parse(raw) : {}; } catch (e) { return json({ error: 'bad json' }, 400); } }
    if (path === '/login' && req.method === 'POST') {
      const u = String(body.u || '').toLowerCase().trim().slice(0, 40), pin = String(body.pin || '');
      if (!/^\d{4}$/.test(pin) || !u) return json({ error: 'Incorrect username or PIN.' }, 401);
      const fk = 'fail:' + u, fails = +(await KV.get(fk)) || 0;
      if (fails >= 5) return json({ error: 'Too many tries. Wait 15 minutes.' }, 429);
      const rec = await getU(u);
      const ok = rec && rec.active !== false && eq(await pinHash(pin, rec.salt), rec.hash);
      if (!ok) { await KV.put(fk, String(fails + 1), { expirationTtl: 900 }); return json({ error: 'Incorrect username or PIN.' }, 401); }
      await KV.delete(fk);
      const tok = rnd(32); await KV.put('sess:' + tok, u, { expirationTtl: 2592000 });
      return json({ token: tok, user: pub(rec) });
    }
    const tok = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const su = tok && /^[0-9a-f]{64}$/.test(tok) ? await KV.get('sess:' + tok) : null;
    const me = su ? await getU(su) : null;
    if (!me || me.active === false) return json({ error: 'signed out' }, 401);
    if (path === '/logout') { await KV.delete('sess:' + tok); return json({ ok: true }); }
    if (path === '/me') return json({ user: pub(me) });
    const list = await users();
    if (path === '/data' && req.method === 'GET') {
      const blobs = {}; const who = me.role === 'admin' ? list : [me.u];
      for (const u of who) blobs[u] = await KV.get('data:' + u, 'json');
      const fresh = !blobs[me.u];
      const v = VO.view(Object.fromEntries(Object.entries(blobs).map(([k, x]) => [k, x || {}])), me.u, me.role);
      return json({ data: fresh ? null : v, fresh, user: pub(me), team: me.role === 'admin' ? await Promise.all(list.map(async u => pub(await getU(u)))) : undefined });
    }
    if (path === '/data' && req.method === 'PUT') {
      if (!body.data || typeof body.data !== 'object') return json({ error: 'no data' }, 400);
      const parts = VO.split(body.data, me.u, me.role, list);
      for (const [o, w] of Object.entries(parts)) {
        if (o !== me.u) { const cur = (await KV.get('data:' + o, 'json')) || {}; VO.keepNew(cur, w, body.base); const keep = {}; for (const k in cur) if (!VO.REC.includes(k)) keep[k] = cur[k]; Object.assign(w, keep); }
        await KV.put('data:' + o, JSON.stringify(w));
      }
      return json({ ok: true });
    }
    if (path.startsWith('/team')) {
      if (me.role !== 'admin') return json({ error: 'admin only' }, 403);
      if (req.method === 'GET') return json({ team: await Promise.all(list.map(async u => pub(await getU(u)))) });
      if (path === '/team' && req.method === 'POST') {
        const u = String(body.u || '').toLowerCase().trim(), name = String(body.name || '').trim().slice(0, 60);
        if (!/^[a-z][a-z0-9._-]{1,30}$/.test(u) || !name) return json({ error: 'Username (letters/numbers) and name required.' }, 400);
        if (await getU(u)) return json({ error: 'That username is taken.' }, 409);
        const pin = newPin(), salt = rnd(16);
        await KV.put('user:' + u, JSON.stringify({ u, name, role: 'rep', title: 'Account Manager', salt, hash: await pinHash(pin, salt), active: true }));
        await KV.put('users', JSON.stringify([...list, u]));
        return json({ user: { u, name, role: 'rep', title: 'Account Manager' }, pin });
      }
      if (path === '/team/reset' && req.method === 'POST') {
        const rec = await getU(String(body.u || '')); if (!rec) return json({ error: 'No such user.' }, 404);
        if (rec.role === 'admin') return json({ error: 'Admin PIN is not reset here.' }, 400);
        const pin = newPin(); rec.salt = rnd(16); rec.hash = await pinHash(pin, rec.salt);
        await KV.put('user:' + rec.u, JSON.stringify(rec)); await KV.delete('fail:' + rec.u);
        return json({ user: pub(rec), pin });
      }
    }
    return json({ error: 'not found' }, 404);
  }
};
