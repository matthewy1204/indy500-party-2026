// Derby Party — local server (Node.js, zero deps)
// Usage: node server.js

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const STATE_FILE = path.join(__dirname, 'derby-state.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ────────────────────────────────────────────────────────────
// Config — edit these for your party
// ────────────────────────────────────────────────────────────
const CONFIG = {
  partyName: "Lucas's Derby Party",
  derbyDate: "Saturday, May 2, 2026 — 6:57 p.m. ET",
  venmoHandle: "@LilNeutyVert", // change to your real handle
  zelleContact: "Lucas@hunden.com",
  // Buy-ins per game (informational only; actual collection happens in person)
  randomPoolBuyIn: 10,
  bestWorstBuyIn: 10,
  adminPin: "derby2026", // change this
};

// ────────────────────────────────────────────────────────────
// 2026 Kentucky Derby field (post draw, with morning line odds)
// ────────────────────────────────────────────────────────────
const DERBY_FIELD = [
  { post: 1,  name: "Renegade",        jockey: "Irad Ortiz Jr.",     trainer: "Todd Pletcher",      ml: "4-1"  },
  { post: 2,  name: "Albus",            jockey: "Manny Franco",        trainer: "Riley Mott",         ml: "30-1" },
  { post: 3,  name: "Intrepido",        jockey: "Hector Berrios",      trainer: "Jeff Mullins",       ml: "50-1" },
  { post: 4,  name: "Litmus Test",      jockey: "Martin Garcia",       trainer: "Bob Baffert",        ml: "30-1" },
  { post: 5,  name: "Right to Party",   jockey: "Christopher Elliott", trainer: "Kenny McPeek",       ml: "30-1" },
  { post: 6,  name: "Commandment",      jockey: "Luis Saez",           trainer: "Brad Cox",           ml: "6-1"  },
  { post: 7,  name: "Danon Bourbon",    jockey: "Atsuya Nishimura",    trainer: "Manabu Ikezoe",      ml: "20-1" },
  { post: 8,  name: "So Happy",         jockey: "Mike Smith",          trainer: "Mark Glatt",         ml: "15-1" },
  { post: 9,  name: "The Puma",         jockey: "Javier Castellano",   trainer: "Gustavo Delgado",    ml: "10-1" },
  { post: 10, name: "Wonder Dean (JPN)", jockey: "Cristian Demuro",    trainer: "Daisuke Takayanagi", ml: "30-1" },
  { post: 11, name: "Incredibolt",      jockey: "Jaime Torres",        trainer: "Riley Mott",         ml: "20-1" },
  { post: 12, name: "Chief Wallabee",   jockey: "Junior Alvarado",     trainer: "Bill Mott",          ml: "8-1"  },
  { post: 13, name: "Silent Tactic",    jockey: "Cristian Torres",     trainer: "Mark Casse",         ml: "20-1" },
  { post: 14, name: "Potente",          jockey: "Juan Hernandez",      trainer: "Bob Baffert",        ml: "20-1" },
  { post: 15, name: "Emerging Market",  jockey: "Flavien Prat",        trainer: "Chad Brown",         ml: "15-1" },
  { post: 16, name: "Pavlovian",        jockey: "Edwin Maldonado",     trainer: "Doug O'Neill",       ml: "30-1" },
  { post: 17, name: "Six Speed",        jockey: "Brian Hernandez Jr.", trainer: "Bhupat Seemar",      ml: "50-1" },
  { post: 18, name: "Further Ado",      jockey: "John Velazquez",      trainer: "Brad Cox",           ml: "6-1"  },
  { post: 19, name: "Golden Tempo",     jockey: "Jose Ortiz",          trainer: "Cherie DeVaux",      ml: "30-1" },
  { post: 20, name: "Fulleffort",       jockey: "Tyler Gaffalione",    trainer: "Brad Cox",           ml: "20-1" },
];

// ────────────────────────────────────────────────────────────
// State — in-memory + persisted to JSON
// ────────────────────────────────────────────────────────────
let state = {
  randomPool: {
    players: [],          // [{name, assignedPost}]
    drawn: false,
  },
  bestWorst: {
    picks: [],            // [{name, winPost, lastPost}]
  },
  results: {
    winnerPost: null,     // 1..20
    lastPost: null,       // 1..20
    declared: false,
  },
  oddsOverride: {},       // { post: "4-1" }
  scratched: [],          // [post numbers]
  liveOdds: {},           // { post: "4-1", ... } from last fetch
  liveOddsUpdatedAt: null,
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      state = { ...state, ...data };
      console.log('[state] loaded from disk');
    }
  } catch (e) {
    console.warn('[state] could not load:', e.message);
  }
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.warn('[state] could not save:', e.message);
  }
}

loadState();

// ────────────────────────────────────────────────────────────
// Live odds fetcher — scrapes TwinSpires
// ────────────────────────────────────────────────────────────
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(new URL(res.headers.location, url).toString()));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchLiveOdds() {
  const url = 'https://www.twinspires.com/kentuckyderby/odds/';
  try {
    const html = await fetchUrl(url);
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                     .replace(/<style[\s\S]*?<\/style>/gi, '')
                     .replace(/<[^>]+>/g, '\n')
                     .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
                     .replace(/\n\s*\n/g, '\n');

    const newOdds = {};
    for (const horse of DERBY_FIELD) {
      const re = new RegExp(escapeRegex(horse.name) + '[\\s\\S]{1,400}?(\\d{1,3}-\\d{1,3})(?:/1)?', 'i');
      const m = text.match(re);
      if (m) {
        newOdds[horse.post] = m[1];
      }
    }
    if (Object.keys(newOdds).length >= 10) {
      state.liveOdds = newOdds;
      state.liveOddsUpdatedAt = new Date().toISOString();
      saveState();
      console.log(`[odds] updated ${Object.keys(newOdds).length}/${DERBY_FIELD.length} horses from TwinSpires`);
      return { ok: true, source: 'twinspires', count: Object.keys(newOdds).length };
    }
    return { ok: false, error: `parsed only ${Object.keys(newOdds).length} horses` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

setInterval(() => { fetchLiveOdds().catch(()=>{}); }, 5 * 60 * 1000);
fetchLiveOdds().catch(()=>{});

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function sendFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) { send(res, 404, { error: 'not found' }); return; }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function checkAdmin(req) {
  const pin = req.headers['x-admin-pin'];
  return pin === CONFIG.adminPin;
}

function computeBestWorstStandings() {
  const { winnerPost, lastPost, declared } = state.results;
  if (!declared) return [];
  const standings = state.bestWorst.picks.map(p => {
    const winCorrect = p.winPost === winnerPost;
    const lastCorrect = p.lastPost === lastPost;
    const points = (winCorrect ? 1 : 0) + (lastCorrect ? 1 : 0);
    return { ...p, winCorrect, lastCorrect, points };
  });
  standings.sort((a, b) => b.points - a.points);
  return standings;
}

function computeRandomWinner() {
  if (!state.results.declared || !state.results.winnerPost) return null;
  const winningEntry = state.randomPool.players.find(p => p.assignedPost === state.results.winnerPost);
  return winningEntry || null;
}

// ────────────────────────────────────────────────────────────
// Server
// ────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  try {
    if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      return sendFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html; charset=utf-8');
    }
    if (method === 'GET' && pathname.startsWith('/public/')) {
      const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
      const fp = path.join(__dirname, safe);
      if (!fp.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'forbidden' });
      const ext = path.extname(fp).toLowerCase();
      const ct = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml' }[ext] || 'application/octet-stream';
      return sendFile(res, fp, ct);
    }

    if (pathname === '/api/state' && method === 'GET') {
      return send(res, 200, {
        config: { partyName: CONFIG.partyName, derbyDate: CONFIG.derbyDate, venmoHandle: CONFIG.venmoHandle, zelleContact: CONFIG.zelleContact, randomPoolBuyIn: CONFIG.randomPoolBuyIn, bestWorstBuyIn: CONFIG.bestWorstBuyIn },
        field: DERBY_FIELD,
        state,
        bestWorstStandings: computeBestWorstStandings(),
        randomWinner: computeRandomWinner(),
      });
    }

    if (pathname === '/api/odds/refresh' && method === 'POST') {
      const result = await fetchLiveOdds();
      return send(res, 200, { ...result, liveOdds: state.liveOdds, updatedAt: state.liveOddsUpdatedAt });
    }

    if (pathname === '/api/random/add' && method === 'POST') {
      if (state.randomPool.drawn) return send(res, 400, { error: 'pool already drawn — reset first' });
      const body = await readJsonBody(req);
      const name = (body.name || '').trim();
      if (!name) return send(res, 400, { error: 'name required' });
      if (state.randomPool.players.find(p => p.name.toLowerCase() === name.toLowerCase())) return send(res, 400, { error: 'name already added' });
      state.randomPool.players.push({ name, assignedPost: null });
      saveState();
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/random/remove' && method === 'POST') {
      if (state.randomPool.drawn) return send(res, 400, { error: 'pool already drawn — reset first' });
      const body = await readJsonBody(req);
      state.randomPool.players = state.randomPool.players.filter(p => p.name !== body.name);
      saveState();
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/random/draw' && method === 'POST') {
      if (!checkAdmin(req)) return send(res, 401, { error: 'admin only' });
      if (state.randomPool.players.length === 0) return send(res, 400, { error: 'no players' });
      const available = DERBY_FIELD.filter(h => !state.scratched.includes(h.post)).map(h => h.post);
      const shuffled = shuffle(available);
      state.randomPool.players.forEach((p, i) => {
        p.assignedPost = shuffled[i % shuffled.length];
      });
      state.randomPool.drawn = true;
      saveState();
      return send(res, 200, { ok: true, players: state.randomPool.players });
    }

    if (pathname === '/api/random/reset' && method === 'POST') {
      if (!checkAdmin(req)) return send(res, 401, { error: 'admin only' });
      state.randomPool = { players: [], drawn: false };
      saveState();
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/picks/submit' && method === 'POST') {
      const body = await readJsonBody(req);
      const name = (body.name || '').trim();
      const winPost = parseInt(body.winPost, 10);
      const lastPost = parseInt(body.lastPost, 10);
      if (!name) return send(res, 400, { error: 'name required' });
      if (!winPost || !lastPost) return send(res, 400, { error: 'pick a winner and a last-place horse' });
      if (winPost === lastPost) return send(res, 400, { error: 'winner and last-place must be different horses' });
      const validPosts = DERBY_FIELD.map(h => h.post);
      if (!validPosts.includes(winPost) || !validPosts.includes(lastPost)) return send(res, 400, { error: 'invalid post' });

      const existing = state.bestWorst.picks.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
      const entry = { name, winPost, lastPost, submittedAt: new Date().toISOString() };
      if (existing >= 0) state.bestWorst.picks[existing] = entry;
      else state.bestWorst.picks.push(entry);
      saveState();
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/picks/remove' && method === 'POST') {
      if (!checkAdmin(req)) return send(res, 401, { error: 'admin only' });
      const body = await readJsonBody(req);
      state.bestWorst.picks = state.bestWorst.picks.filter(p => p.name !== body.name);
      saveState();
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/admin/results' && method === 'POST') {
      if (!checkAdmin(req)) return send(res, 401, { error: 'admin only' });
      const body = await readJsonBody(req);
      state.results.winnerPost = parseInt(body.winnerPost, 10) || null;
      state.results.lastPost = parseInt(body.lastPost, 10) || null;
      state.results.declared = !!(state.results.winnerPost && state.results.lastPost);
      saveState();
      return send(res, 200, { ok: true, results: state.results });
    }

    if (pathname === '/api/admin/odds' && method === 'POST') {
      if (!checkAdmin(req)) return send(res, 401, { error: 'admin only' });
      const body = await readJsonBody(req);
      state.oddsOverride = body.odds || {};
      saveState();
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/admin/scratch' && method === 'POST') {
      if (!checkAdmin(req)) return send(res, 401, { error: 'admin only' });
      const body = await readJsonBody(req);
      state.scratched = (body.posts || []).map(n => parseInt(n, 10)).filter(Boolean);
      saveState();
      return send(res, 200, { ok: true, scratched: state.scratched });
    }

    if (pathname === '/api/admin/reset-all' && method === 'POST') {
      if (!checkAdmin(req)) return send(res, 401, { error: 'admin only' });
      state = {
        randomPool: { players: [], drawn: false },
        bestWorst: { picks: [] },
        results: { winnerPost: null, lastPost: null, declared: false },
        oddsOverride: {},
        scratched: [],
        liveOdds: state.liveOdds,
        liveOddsUpdatedAt: state.liveOddsUpdatedAt,
      };
      saveState();
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log('\n🌹 Derby Party server running');
  console.log(`   Local:    http://localhost:${PORT}`);
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name]) {
      if (i.family === 'IPv4' && !i.internal) {
        console.log(`   Network:  http://${i.address}:${PORT}    ← share this with guests on your WiFi`);
      }
    }
  }
  console.log(`\n   Admin PIN: ${CONFIG.adminPin}\n`);
});
