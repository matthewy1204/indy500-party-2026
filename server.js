// Indy 500 Party — local server (Node.js, zero deps)
// Usage: node server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const STATE_FILE = path.join(__dirname, 'indy-state.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ────────────────────────────────────────────────────────────
// Config — edit these for your party
// ────────────────────────────────────────────────────────────
const CONFIG = {
  partyName: "Lucas's Indy 500 Party",
  raceDate: "Sunday · May 24, 2026 · 12:45 p.m. ET",
  raceSub: "110th Running · Greatest Spectacle in Racing",
  venmoHandle: "@LilNeutyVert",
  zelleContact: "Lucas@hunden.com",
  randomPoolBuyIn: 10,
  chickenDinnerBuyIn: 10,
  adminPin: "indy2026",
};

// ────────────────────────────────────────────────────────────
// 2026 Indianapolis 500 starting grid (post-qualifying, May 17 2026)
// Pre-race odds baked from Practice 7 section-time data (May 18 2026)
// ────────────────────────────────────────────────────────────
const INDY_FIELD = [
  { pos: 1,  car: "10", name: "Alex Palou",          team: "Chip Ganassi Racing",  engine: "Honda", preRace: "4-1"   },
  { pos: 2,  car: "20", name: "Alexander Rossi",     team: "Ed Carpenter Racing",  engine: "Chevy", preRace: "18-1"  },
  { pos: 3,  car: "12", name: "David Malukas",       team: "Team Penske",          engine: "Chevy", preRace: "14-1"  },
  { pos: 4,  car: "60", name: "Felix Rosenqvist",    team: "Meyer Shank Racing",   engine: "Honda", preRace: "25-1"  },
  { pos: 5,  car: "14", name: "Santino Ferrucci",    team: "AJ Foyt Racing",       engine: "Chevy", preRace: "12-1"  },
  { pos: 6,  car: "5",  name: "Pato O'Ward",         team: "Arrow McLaren",        engine: "Chevy", preRace: "6-1"   },
  { pos: 7,  car: "8",  name: "Kyffin Simpson",      team: "Chip Ganassi Racing",  engine: "Honda", preRace: "25-1"  },
  { pos: 8,  car: "23", name: "Conor Daly",          team: "Dreyer & Reinbold",    engine: "Chevy", preRace: "50-1"  },
  { pos: 9,  car: "3",  name: "Scott McLaughlin",    team: "Team Penske",          engine: "Chevy", preRace: "10-1"  },
  { pos: 10, car: "9",  name: "Scott Dixon",         team: "Chip Ganassi Racing",  engine: "Honda", preRace: "7-1"   },
  { pos: 11, car: "76", name: "Rinus VeeKay",        team: "Juncos Hollinger",     engine: "Chevy", preRace: "20-1"  },
  { pos: 12, car: "75", name: "Takuma Sato",         team: "RLL Racing",           engine: "Honda", preRace: "15-1"  },
  { pos: 13, car: "33", name: "Ed Carpenter",        team: "Ed Carpenter Racing",  engine: "Chevy", preRace: "40-1"  },
  { pos: 14, car: "06", name: "Helio Castroneves",   team: "Meyer Shank Racing",   engine: "Honda", preRace: "18-1"  },
  { pos: 15, car: "21", name: "Christian Rasmussen", team: "Ed Carpenter Racing",  engine: "Chevy", preRace: "30-1"  },
  { pos: 16, car: "66", name: "Marcus Armstrong",    team: "Meyer Shank Racing",   engine: "Chevy", preRace: "25-1"  },
  { pos: 17, car: "28", name: "Marcus Ericsson",     team: "Andretti Global",      engine: "Honda", preRace: "16-1"  },
  { pos: 18, car: "7",  name: "Christian Lundgaard", team: "Arrow McLaren",        engine: "Chevy", preRace: "22-1"  },
  { pos: 19, car: "26", name: "Will Power",          team: "Andretti Global",      engine: "Honda", preRace: "9-1"   },
  { pos: 20, car: "6",  name: "Nolan Siegel",        team: "Arrow McLaren",        engine: "Chevy", preRace: "50-1"  },
  { pos: 21, car: "45", name: "Louis Foster",        team: "RLL Racing",           engine: "Honda", preRace: "60-1"  },
  { pos: 22, car: "31", name: "Ryan Hunter-Reay",    team: "Arrow McLaren",        engine: "Chevy", preRace: "40-1"  },
  { pos: 23, car: "2",  name: "Josef Newgarden",     team: "Team Penske",          engine: "Chevy", preRace: "5-1"   },
  { pos: 24, car: "18", name: "Romain Grosjean",     team: "Dale Coyne Racing",    engine: "Honda", preRace: "35-1"  },
  { pos: 25, car: "27", name: "Kyle Kirkwood",       team: "Andretti Global",      engine: "Honda", preRace: "9-1"   },
  { pos: 26, car: "11", name: "Katherine Legge",     team: "HMD w/ AJ Foyt",       engine: "Chevy", preRace: "100-1" },
  { pos: 27, car: "47", name: "Mick Schumacher",     team: "RLL Racing",           engine: "Honda", preRace: "80-1"  },
  { pos: 28, car: "15", name: "Graham Rahal",        team: "RLL Racing",           engine: "Honda", preRace: "50-1"  },
  { pos: 29, car: "19", name: "Dennis Hauger",       team: "Dale Coyne Racing",    engine: "Honda", preRace: "60-1"  },
  { pos: 30, car: "51", name: "Jacob Abel",          team: "Abel Motorsports",     engine: "Chevy", preRace: "150-1" },
  { pos: 31, car: "77", name: "Sting Ray Robb",      team: "Juncos Hollinger",     engine: "Chevy", preRace: "80-1"  },
  { pos: 32, car: "4",  name: "Caio Collet",         team: "AJ Foyt Racing",       engine: "Chevy", preRace: "100-1" },
  { pos: 33, car: "24", name: "Jack Harvey",         team: "Dreyer & Reinbold",    engine: "Chevy", preRace: "150-1" },
];

// ────────────────────────────────────────────────────────────
// State — in-memory + persisted to JSON
// ────────────────────────────────────────────────────────────
let state = {
  randomPool: {
    players: [],          // [{name, assignedPos}]
    drawn: false,
  },
  chickenDinner: {
    picks: [],            // [{name, winPos, lastPos}]
  },
  results: {
    winnerPos: null,      // 1..33
    lastPos: null,        // 1..33
    declared: false,
  },
  oddsOverride: {},       // { pos: "3-1" }
  withdrawn: [],          // [pos numbers]
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

function computeStandings() {
  const { winnerPos, lastPos, declared } = state.results;
  if (!declared) return [];
  const standings = state.chickenDinner.picks.map(p => {
    const winCorrect = p.winPos === winnerPos;
    const lastCorrect = p.lastPos === lastPos;
    const points = (winCorrect ? 1 : 0) + (lastCorrect ? 1 : 0);
    return { ...p, winCorrect, lastCorrect, points };
  });
  standings.sort((a, b) => b.points - a.points);
  return standings;
}

function computeRandomWinner() {
  if (!state.results.declared || !state.results.winnerPos) return null;
  const winningEntry = state.randomPool.players.find(p => p.assignedPos === state.results.winnerPos);
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
        config: {
          partyName: CONFIG.partyName,
          raceDate: CONFIG.raceDate,
          raceSub: CONFIG.raceSub,
          venmoHandle: CONFIG.venmoHandle,
          zelleContact: CONFIG.zelleContact,
          randomPoolBuyIn: CONFIG.randomPoolBuyIn,
          chickenDinnerBuyIn: CONFIG.chickenDinnerBuyIn,
        },
        field: INDY_FIELD,
        state,
        standings: computeStandings(),
        randomWinner: computeRandomWinner(),
      });
    }

    if (pathname === '/api/random/add' && method === 'POST') {
      if (state.randomPool.drawn) return send(res, 400, { error: 'pool already drawn — reset first' });
      const body = await readJsonBody(req);
      const name = (body.name || '').trim();
      if (!name) return send(res, 400, { error: 'name required' });
      if (state.randomPool.players.find(p => p.name.toLowerCase() === name.toLowerCase())) return send(res, 400, { error: 'name already added' });
      state.randomPool.players.push({ name, assignedPos: null });
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
      const available = INDY_FIELD.filter(c => !state.withdrawn.includes(c.pos)).map(c => c.pos);
      const shuffled = shuffle(available);
      state.randomPool.players.forEach((p, i) => {
        p.assignedPos = shuffled[i % shuffled.length];
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
      const winPos = parseInt(body.winPos, 10);
      const lastPos = parseInt(body.lastPos, 10);
      if (!name) return send(res, 400, { error: 'name required' });
      if (!winPos || !lastPos) return send(res, 400, { error: 'pick a winner and a last-place car' });
      if (winPos === lastPos) return send(res, 400, { error: 'winner and last-place must be different cars' });
      const validPositions = INDY_FIELD.map(c => c.pos);
      if (!validPositions.includes(winPos) || !validPositions.includes(lastPos)) return send(res, 400, { error: 'invalid position' });

      const existing = state.chickenDinner.picks.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
      const entry = { name, winPos, lastPos, submittedAt: new Date().toISOString() };
      if (existing >= 0) state.chickenDinner.picks[existing] = entry;
      else state.chickenDinner.picks.push(entry);
      saveState();
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/picks/remove' && method === 'POST') {
      if (!checkAdmin(req)) return send(res, 401, { error: 'admin only' });
      const body = await readJsonBody(req);
      state.chickenDinner.picks = state.chickenDinner.picks.filter(p => p.name !== body.name);
      saveState();
      return send(res, 200, { ok: true });
    }

    if (pathname === '/api/admin/results' && method === 'POST') {
      if (!checkAdmin(req)) return send(res, 401, { error: 'admin only' });
      const body = await readJsonBody(req);
      state.results.winnerPos = parseInt(body.winnerPos, 10) || null;
      state.results.lastPos = parseInt(body.lastPos, 10) || null;
      state.results.declared = !!(state.results.winnerPos && state.results.lastPos);
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

    if (pathname === '/api/admin/withdrawn' && method === 'POST') {
      if (!checkAdmin(req)) return send(res, 401, { error: 'admin only' });
      const body = await readJsonBody(req);
      state.withdrawn = (body.positions || []).map(n => parseInt(n, 10)).filter(Boolean);
      saveState();
      return send(res, 200, { ok: true, withdrawn: state.withdrawn });
    }

    if (pathname === '/api/admin/reset-all' && method === 'POST') {
      if (!checkAdmin(req)) return send(res, 401, { error: 'admin only' });
      state = {
        randomPool: { players: [], drawn: false },
        chickenDinner: { picks: [] },
        results: { winnerPos: null, lastPos: null, declared: false },
        oddsOverride: {},
        withdrawn: [],
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
  console.log('\n🏁 Indy 500 Party server running');
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
