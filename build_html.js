const fs = require('fs');
const raw = require('./brackets_clean.json');

// Slim down the embedded data — strip fields the browser doesn't need
const data = {
  meta: raw.meta,
  brackets: raw.brackets.map(b => ({
    id: b.id,
    name: b.name,
    displayName: b.displayName,
    score: b.score,
    rank: b.rank,
    champion: b.champion,
    contrarianism: b.contrarianism,
    picks: b.picks.map(p => ({
      propositionId: p.propositionId,
      roundAbbrev: p.roundAbbrev,
      round: p.round,
      pickedTeamAbbrev: p.pickedTeamAbbrev,
      pickedTeamName: p.pickedTeamName,
      result: p.result,
    })),
  })),
  teamStats: raw.teamStats.map(t => ({
    abbrev: t.abbrev, name: t.name, odds: t.odds,
    impliedProb: t.impliedProb, championCount: t.championCount,
    championPct: t.championPct, byRound: t.byRound,
  })),
  upsets: raw.upsets,
  darlings: raw.darlings,
  similarity: raw.similarity,
  mostDifferentPair: raw.mostDifferentPair,
  gridProps: raw.gridProps.map(p => ({ id: p.id, round: p.round, roundAbbrev: p.roundAbbrev, name: p.name })),
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SL World Cup 2026 · Bracket Group</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
:root {
  --bg: #1C1917; --card: #2A2520; --card2: #332E28;
  --cream: #E5DCD3; --muted: #9E8F85; --border: #3D3630;
  --gold: #C4A46B; --agree: #6EBF8B; --diff: #C0675A;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--cream); font-family: system-ui, -apple-system, sans-serif; margin: 0; }
a { color: var(--gold); }
.chip {
  display: inline-block; padding: 2px 7px; border-radius: 4px;
  font-family: ui-monospace, monospace; font-size: 11px; font-weight: 700;
  letter-spacing: 0.04em; color: #fff; white-space: nowrap; cursor: default;
  transition: opacity 0.12s;
}
.chip.dimmed { opacity: 0.18; }
.chip.lg { padding: 4px 10px; font-size: 13px; }
.tab { background: none; border: none; cursor: pointer; color: var(--muted); padding: 10px 18px; font-size: 14px; font-weight: 600; border-bottom: 2px solid transparent; transition: all 0.15s; }
.tab.active { color: var(--gold); border-bottom-color: var(--gold); }
.tab:hover:not(.active) { color: var(--cream); }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 18px 20px; }
.stat-val { font-size: 26px; font-weight: 700; color: var(--cream); }
.stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-top: 2px; }
.heat-cell { font-size: 11px; font-weight: 600; text-align: center; padding: 4px 6px; border-radius: 4px; }
.grid-table { border-collapse: separate; border-spacing: 2px; }
.grid-th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); padding: 4px 4px; text-align: center; white-space: nowrap; }
.grid-name { font-size: 12px; font-weight: 600; padding: 6px 10px; cursor: pointer; white-space: nowrap; border-radius: 6px; transition: background 0.1s; }
.grid-name:hover { background: var(--card2); }
.grid-name.selected { background: var(--gold); color: #1C1917; border-radius: 6px; }
.grid-cell { padding: 3px; text-align: center; position: relative; }
.grid-cell .agree-mark { position: absolute; top: 1px; right: 2px; font-size: 8px; }
.round-sep { width: 6px; }
.vs-row { border-bottom: 1px solid var(--border); }
.vs-row td { padding: 7px 10px; font-size: 13px; }
.upset-card { border-radius: 10px; border: 1px solid var(--border); overflow: hidden; }
.prob-bar-bg { height: 6px; border-radius: 3px; background: var(--border); overflow: hidden; display: flex; }
.scroll-x { overflow-x: auto; }
::-webkit-scrollbar { height: 6px; width: 6px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
section { max-width: 1200px; margin: 0 auto; padding: 24px 20px 60px; }
</style>
</head>
<body>
<!-- NAV -->
<div style="background:var(--card);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:50;">
  <div style="max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:0;padding:0 20px;">
    <span style="font-size:15px;font-weight:700;color:var(--gold);padding:12px 20px 12px 0;border-right:1px solid var(--border);margin-right:12px;white-space:nowrap;">⚽ SL WC 2026</span>
    <button class="tab active" id="tab-pulse" onclick="showView('pulse')">Pulse</button>
    <button class="tab" id="tab-grid" onclick="showView('grid')">The Matrix</button>
    <button class="tab" id="tab-spicy" onclick="showView('spicy')">Spicy Picks</button>
    <button class="tab" id="tab-versus" onclick="showView('versus')">Versus</button>
  </div>
</div>

<!-- PULSE -->
<section id="view-pulse">
  <div style="margin-bottom:24px;">
    <h1 style="font-size:28px;font-weight:800;color:var(--cream);margin:0 0 4px;">SL World Cup 2026</h1>
    <p style="color:var(--muted);margin:0;" id="pulse-subtitle"></p>
  </div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px;" id="stat-cards"></div>
  <div style="display:grid;grid-template-columns:340px 1fr;gap:20px;align-items:start;">
    <div class="card">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:14px;">Champion Picks</div>
      <div style="position:relative;height:260px;"><canvas id="champion-chart"></canvas></div>
    </div>
    <div class="card" style="overflow:hidden;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:14px;">Team Advancement — % of brackets picking each team to advance</div>
      <div class="scroll-x"><table id="heatmap-table" style="width:100%;border-collapse:collapse;"></table></div>
    </div>
  </div>
</section>

<!-- GRID -->
<section id="view-grid" class="hidden">
  <div style="margin-bottom:20px;">
    <h2 style="font-size:22px;font-weight:800;margin:0 0 8px;">The Matrix</h2>
    <p style="color:var(--muted);font-size:13px;margin:0 0 16px;">Each column is a bracket slot (R16 → Final). <span style="color:var(--agree);font-weight:600;">Green</span> = matches the base. <span style="color:var(--diff);font-weight:600;">Red</span> = went their own way. Rows sorted by how conventional each bracket is. Hover a chip to track a team.</p>
    <div style="display:flex;align-items:center;gap:10px;">
      <label style="font-size:12px;font-weight:600;color:var(--muted);white-space:nowrap;text-transform:uppercase;letter-spacing:.06em;">Compare vs</label>
      <select id="grid-base-select" style="background:var(--card);color:var(--cream);border:1px solid var(--border);border-radius:8px;padding:8px 14px;font-size:13px;min-width:240px;cursor:pointer;"></select>
    </div>
  </div>
  <div class="card scroll-x" id="grid-container"></div>
</section>

<!-- SPICY -->
<section id="view-spicy" class="hidden">
  <div style="margin-bottom:24px;">
    <h2 style="font-size:22px;font-weight:800;margin:0 0 4px;">Spicy Picks</h2>
    <p style="color:var(--muted);font-size:13px;margin:0;">R32 matchups ranked by upset factor — the bigger the gap in odds, the spicier the upset pick.</p>
  </div>
  <div id="upset-cards" style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:40px;"></div>

  <h3 style="font-size:16px;font-weight:700;margin:0 0 16px;color:var(--gold);">Deep Run Darlings</h3>
  <p style="color:var(--muted);font-size:13px;margin:-10px 0 16px;">Long-shot teams (+5000 or higher) that at least one bracket picked to go past the Round of 32.</p>
  <div id="darlings-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:40px;"></div>

  <h3 style="font-size:16px;font-weight:700;margin:0 0 16px;color:var(--gold);">Chaos Agents</h3>
  <p style="color:var(--muted);font-size:13px;margin:-10px 0 16px;">Brackets ranked by how often they went against the consensus pick.</p>
  <div id="contrarian-list" style="display:flex;flex-direction:column;gap:8px;max-width:600px;"></div>
</section>

<!-- VERSUS -->
<section id="view-versus" class="hidden">
  <div style="margin-bottom:24px;">
    <h2 style="font-size:22px;font-weight:800;margin:0 0 4px;">Versus</h2>
    <p style="color:var(--muted);font-size:13px;margin:0;">Head-to-head bracket comparison. Defaults to the two most different brackets.</p>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;max-width:700px;">
    <div>
      <label style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px;">Bracket A</label>
      <select id="vs-a" style="width:100%;background:var(--card);color:var(--cream);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:14px;"></select>
    </div>
    <div>
      <label style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px;">Bracket B</label>
      <select id="vs-b" style="width:100%;background:var(--card);color:var(--cream);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:14px;"></select>
    </div>
  </div>
  <div id="vs-summary" style="margin-bottom:20px;"></div>
  <div class="card scroll-x"><table id="vs-table" style="width:100%;border-collapse:collapse;"></table></div>
</section>

<script>
const DATA = ${JSON.stringify(data)};

// ---- Utilities ----
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function teamHue(abbrev) {
  let h = 0;
  for (const c of abbrev) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
function teamColor(abbrev) { return \`hsl(\${teamHue(abbrev)},52%,38%)\`; }
function teamColorBright(abbrev) { return \`hsl(\${teamHue(abbrev)},60%,50%)\`; }
function chip(abbrev, name, cls='') {
  return \`<span class="chip \${cls}" style="background:\${teamColor(abbrev)}" data-team="\${esc(abbrev)}" title="\${esc(name)}">\${esc(abbrev)}</span>\`;
}
function pct(n, total) { return total ? Math.round(n / total * 100) : 0; }
function heatColor(pctVal) {
  // 0% → var(--card2), 100% → var(--agree), intermediate → blend
  const t = pctVal / 100;
  const r = Math.round(51 + t * (110 - 51));
  const g = Math.round(46 + t * (191 - 46));
  const b = Math.round(40 + t * (139 - 40));
  const a = 0.15 + t * 0.75;
  return \`rgba(\${r},\${g},\${b},\${a})\`;
}
function fmtOdds(n) { return n ? \`+\${n.toLocaleString()}\` : '—'; }

// ---- Tab switching ----
const VIEWS = ['pulse','grid','spicy','versus'];
function showView(name) {
  VIEWS.forEach(v => {
    document.getElementById('view-' + v).classList.toggle('hidden', v !== name);
    document.getElementById('tab-' + v).classList.toggle('active', v === name);
  });
}

// ---- Precompute ----
const N = DATA.brackets.length;
// propId → index in gridProps
const gridPropIdx = {};
DATA.gridProps.forEach((p,i) => gridPropIdx[p.id] = i);
// bracketIdx → propId → teamAbbrev
const bPickMap = DATA.brackets.map(b => {
  const m = {};
  for (const p of b.picks) m[p.propositionId] = p.pickedTeamAbbrev;
  return m;
});
// teamStats map
const teamMap = {};
DATA.teamStats.forEach(t => teamMap[t.abbrev] = t);

// ---- Pulse ----
function initPulse() {
  const n = DATA.meta.totalBrackets;
  document.getElementById('pulse-subtitle').textContent =
    \`\${n} brackets · \${DATA.meta.groupName} · scraped \${new Date(DATA.meta.scrapedAt).toLocaleDateString()}\`;

  // Stat cards
  const champCounts = {};
  DATA.brackets.forEach(b => {
    champCounts[b.champion.abbrev] = (champCounts[b.champion.abbrev] || { abbrev: b.champion.abbrev, name: b.champion.name, count: 0 });
    champCounts[b.champion.abbrev].count++;
  });
  const sortedChamps = Object.values(champCounts).sort((a,b) => b.count - a.count);
  const topCount = sortedChamps[0].count;
  const topChamps = sortedChamps.filter(c => c.count === topCount).map(c => c.abbrev).join(' / ');

  // Boldest champion = highest odds pick as champion
  const boldest = DATA.brackets
    .filter(b => teamMap[b.champion.abbrev]?.odds)
    .sort((a,b) => (teamMap[b.champion.abbrev]?.odds || 0) - (teamMap[a.champion.abbrev]?.odds || 0))[0];

  // Avg similarity
  let totalSim = 0, pairs = 0;
  for (let i = 0; i < N; i++) for (let j = i+1; j < N; j++) { totalSim += DATA.similarity[i][j]; pairs++; }
  const avgAgree = pairs ? Math.round(totalSim / pairs) : 0;
  const consensusPct = Math.round(avgAgree / 31 * 100);

  document.getElementById('stat-cards').innerHTML = \`
    <div class="card">
      <div class="stat-val">\${topChamps}</div>
      <div class="stat-label">Most picked champion\${sortedChamps[0].count > 1 ? ' — ' + topCount + ' picks each' : ''}</div>
    </div>
    <div class="card">
      <div class="stat-val">\${boldest ? chip(boldest.champion.abbrev, boldest.champion.name) + ' <span style="font-size:16px;color:var(--gold);">' + fmtOdds(teamMap[boldest.champion.abbrev]?.odds) + '</span>' : '—'}</div>
      <div class="stat-label">Boldest champion pick · \${boldest ? esc(boldest.name.replace(/'s (1st|2nd|3rd) Bracket$/,'').replace(' Bracket','')) : '—'}</div>
    </div>
    <div class="card">
      <div class="stat-val">\${consensusPct}%</div>
      <div class="stat-label">Average pick agreement across all bracket pairs</div>
    </div>
  \`;

  // Donut chart
  const champTeams = DATA.teamStats.filter(t => t.championCount > 0);
  new Chart(document.getElementById('champion-chart'), {
    type: 'doughnut',
    data: {
      labels: champTeams.map(t => \`\${t.abbrev} (\${t.name})\`),
      datasets: [{
        data: champTeams.map(t => t.championCount),
        backgroundColor: champTeams.map(t => teamColor(t.abbrev)),
        borderColor: '#1C1917', borderWidth: 3,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#E5DCD3', boxWidth: 14, font: { size: 12 } } },
        tooltip: { callbacks: {
          label: ctx => \` \${ctx.label}: \${ctx.parsed} pick\${ctx.parsed !== 1 ? 's' : ''} (\${Math.round(ctx.parsed/n*100)}%)\`
        }}
      }
    }
  });

  // Heatmap table
  const rounds = ['R32','R16','QF','SF','F'];
  const roundLabels = {'R32':'→R16','R16':'→QF','QF':'→SF','SF':'→Final','F':'Champion'};
  // Sort teams by odds (favorites first), include all teams
  const allTeams = [...DATA.teamStats].sort((a,b) => (a.odds||999999) - (b.odds||999999));
  let heatHtml = \`<tr>\`;
  heatHtml += \`<th style="text-align:left;padding:6px 10px;font-size:11px;color:var(--muted);font-weight:600;">Team</th>\`;
  heatHtml += \`<th style="padding:6px 8px;font-size:10px;color:var(--muted);font-weight:600;text-align:center;">Odds</th>\`;
  rounds.forEach(r => {
    heatHtml += \`<th style="padding:6px 10px;font-size:10px;color:var(--muted);font-weight:600;text-align:center;white-space:nowrap;">\${roundLabels[r]}</th>\`;
  });
  heatHtml += \`</tr>\`;
  allTeams.forEach(t => {
    heatHtml += \`<tr>\`;
    heatHtml += \`<td style="padding:5px 10px;white-space:nowrap;">\${chip(t.abbrev, t.name)} <span style="font-size:12px;margin-left:4px;">\${esc(t.name)}</span></td>\`;
    heatHtml += \`<td style="padding:5px 8px;text-align:center;font-size:12px;color:var(--muted);font-family:ui-monospace,monospace;">\${fmtOdds(t.odds)}</td>\`;
    rounds.forEach(r => {
      const cnt = t.byRound?.[r] || 0;
      const p = pct(cnt, n);
      heatHtml += \`<td class="heat-cell" style="background:\${heatColor(p)};color:\${p > 40 ? '#fff' : 'var(--muted)'};">\${p > 0 ? p + '%' : ''}</td>\`;
    });
    heatHtml += \`</tr>\`;
  });
  document.getElementById('heatmap-table').innerHTML = heatHtml;
}

// ---- Grid ----
// Grid state — module-level so updateGridBorders can access consensus
let gridConsensus = [];
let gridSortedIndices = [];

function initGrid() {
  const gridProps = DATA.gridProps;
  const roundColors = { 2: '#3B5580', 3: '#3B6B5A', 4: '#6B5A2A', 5: '#7A3030' };
  const roundName = { 2: 'Round of 16', 3: 'Quarterfinals', 4: 'Semifinals', 5: 'Final' };

  // Consensus per slot
  gridConsensus = gridProps.map((prop, gi) => {
    const counts = {};
    DATA.brackets.forEach((b, bi) => {
      const t = bPickMap[bi]?.[prop.id];
      if (t) counts[t] = (counts[t] || 0) + 1;
    });
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best ? { abbrev: best[0], count: best[1], name: teamMap[best[0]]?.name || best[0] } : null;
  });

  // Grid contrarianism per bracket (vs consensus, only the 15 grid slots)
  const gridContrarianism = DATA.brackets.map((b, bi) =>
    gridProps.filter((prop, gi) => {
      const myT = bPickMap[bi]?.[prop.id];
      return myT && gridConsensus[gi] && myT !== gridConsensus[gi].abbrev;
    }).length
  );

  // Sort bracket indices: most conventional (fewest divergences) first
  gridSortedIndices = DATA.brackets.map((_, i) => i)
    .sort((a, b) => gridContrarianism[a] - gridContrarianism[b]);

  // Populate "Compare vs" select
  const sel = document.getElementById('grid-base-select');
  sel.innerHTML = '<option value="-1">Consensus — most popular pick per slot</option>';
  const optDivider = document.createElement('option');
  optDivider.disabled = true; optDivider.textContent = '─────────────────────';
  sel.appendChild(optDivider);
  gridSortedIndices.forEach(bi => {
    const b = DATA.brackets[bi];
    const shortName = b.name.replace(/'s (1st|2nd|3rd) Bracket$/, '').replace(' Bracket', '');
    const opt = document.createElement('option');
    opt.value = bi;
    opt.textContent = \`\${shortName} (\${b.champion.abbrev}) · \${gridContrarianism[bi]} off\`;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () => updateGridBorders(parseInt(sel.value)));

  // Round group header (row 1)
  let prevRound = null, groupStart = 0;
  const roundGroups = [];
  gridProps.forEach((p, i) => {
    if (p.round !== prevRound) {
      if (prevRound !== null) roundGroups.push({ round: prevRound, count: i - groupStart });
      groupStart = i; prevRound = p.round;
    }
  });
  roundGroups.push({ round: prevRound, count: gridProps.length - groupStart });

  let headerRow1 = '<tr><td style="min-width:160px;"></td>';
  roundGroups.forEach(g => {
    headerRow1 += \`<td colspan="\${g.count}" style="text-align:center;padding:6px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;background:\${roundColors[g.round]};border-radius:4px;color:#fff;">\${roundName[g.round]}</td>\`;
  });
  headerRow1 += '</tr>';

  // Consensus chip header (row 2) — replaces #1–#15
  let headerRow2 = '<tr><td style="padding:4px 10px;font-size:10px;color:var(--muted);">Bracket · diverges</td>';
  gridProps.forEach((prop, gi) => {
    const c = gridConsensus[gi];
    const agreePct = c ? Math.round(c.count / N * 100) : 0;
    const countColor = agreePct >= 80 ? 'var(--agree)' : agreePct >= 55 ? 'var(--muted)' : 'var(--diff)';
    headerRow2 += \`<td class="grid-th" style="min-width:48px;vertical-align:bottom;padding-bottom:6px;">
      \${c ? chip(c.abbrev, c.name) : ''}
      <div style="font-size:9px;color:\${countColor};margin-top:3px;">\${c ? c.count + '/' + N : ''}</div>
    </td>\`;
  });
  headerRow2 += '</tr>';

  // Data rows — sorted by conventionality, with border coloring baked in
  let dataRows = '';
  gridSortedIndices.forEach(bi => {
    const b = DATA.brackets[bi];
    const shortName = b.name.replace(/'s (1st|2nd|3rd) Bracket$/, '').replace(' Bracket', '');
    const nOff = gridContrarianism[bi];
    dataRows += \`<tr class="grid-row" data-bi="\${bi}">\`;
    dataRows += \`<td class="grid-name" id="gn-\${bi}" onclick="selectGridBase(\${bi})" style="min-width:160px;">
      \${esc(shortName)} \${chip(b.champion.abbrev, b.champion.name)}
      <span style="color:var(--muted);font-size:10px;font-weight:400;"> · \${nOff} off</span>
    </td>\`;
    gridProps.forEach((prop, gi) => {
      const abbrev = bPickMap[bi]?.[prop.id] || '?';
      const name = teamMap[abbrev]?.name || abbrev;
      const isConsensus = abbrev === gridConsensus[gi]?.abbrev;
      const borderColor = isConsensus ? 'var(--agree)' : 'var(--diff)';
      dataRows += \`<td class="grid-cell" id="gc-\${bi}-\${gi}" data-bi="\${bi}" data-gi="\${gi}">
        <span class="chip" style="background:\${teamColor(abbrev)};border-left:3px solid \${borderColor};" data-team="\${esc(abbrev)}" title="\${esc(name)}">\${esc(abbrev)}</span>
      </td>\`;
    });
    dataRows += '</tr>';
  });

  document.getElementById('grid-container').innerHTML =
    \`<table class="grid-table" style="min-width:max-content;">\${headerRow1}\${headerRow2}\${dataRows}</table>\`;

  // Hover: dim non-matching teams
  const container = document.getElementById('grid-container');
  container.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-team]');
    if (!el) return;
    const team = el.dataset.team;
    container.querySelectorAll('[data-team]').forEach(c => c.classList.toggle('dimmed', c.dataset.team !== team));
  });
  container.addEventListener('mouseout', e => {
    if (!e.target.closest('[data-team]')) return;
    container.querySelectorAll('[data-team]').forEach(c => c.classList.remove('dimmed'));
  });
}

function selectGridBase(bi) {
  const sel = document.getElementById('grid-base-select');
  sel.value = bi;
  updateGridBorders(bi);
}

function updateGridBorders(baseIdx) {
  document.querySelectorAll('.grid-name').forEach(el => el.classList.remove('selected'));
  if (baseIdx >= 0) document.getElementById('gn-' + baseIdx)?.classList.add('selected');

  DATA.brackets.forEach((b, bi) => {
    DATA.gridProps.forEach((prop, gi) => {
      const cell = document.getElementById(\`gc-\${bi}-\${gi}\`);
      const chipEl = cell?.querySelector('[data-team]');
      if (!chipEl) return;
      const myT = bPickMap[bi]?.[prop.id];
      let refT, borderColor;
      if (baseIdx === -1) {
        // vs consensus
        refT = gridConsensus[gi]?.abbrev;
        borderColor = myT === refT ? 'var(--agree)' : 'var(--diff)';
      } else if (bi === baseIdx) {
        // this is the base bracket — gold highlight
        borderColor = 'var(--gold)';
      } else {
        refT = bPickMap[baseIdx]?.[prop.id];
        borderColor = (myT && refT && myT === refT) ? 'var(--agree)' : 'var(--diff)';
      }
      chipEl.style.borderLeft = \`3px solid \${borderColor}\`;
    });
  });
}

// ---- Spicy ----
function initSpicy() {
  const n = DATA.meta.totalBrackets;
  // Upset cards (all 16, sorted by upsetFactor desc)
  let cardsHtml = '';
  DATA.upsets.forEach(u => {
    const spice = Math.min(1, Math.log10(u.upsetFactor) / 3); // 0–1
    const spiceR = Math.round(192 + spice * 63);
    const spiceG = Math.round(96 - spice * 64);
    const spiceB = Math.round(90 - spice * 60);
    const headerBg = \`rgba(\${spiceR},\${spiceG},\${spiceB},\${0.15 + spice * 0.35})\`;
    const pickersHtml = u.upsetPickers.map(p => \`<span style="font-size:11px;background:var(--card2);border:1px solid var(--border);border-radius:20px;padding:2px 8px;">\${esc(p)}</span>\`).join(' ');
    const favProb = Math.round(u.favorite.impliedProb * 100);
    const undProb = Math.round(u.underdog.impliedProb * 100);

    cardsHtml += \`
    <div class="upset-card">
      <div style="background:\${headerBg};padding:14px 16px;border-bottom:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);">R32 Upset</span>
          <span style="font-size:11px;font-weight:700;color:\${spice > 0.5 ? '#e87070' : 'var(--muted)'};">\${u.upsetFactor}× factor</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="text-align:center;">
            \${chip(u.favorite.abbrev, u.favorite.name, 'lg')}
            <div style="font-size:10px;color:var(--muted);margin-top:3px;">\${fmtOdds(u.favorite.odds)}</div>
          </div>
          <div style="flex:1;">
            <div class="prob-bar-bg">
              <div style="height:6px;background:var(--agree);border-radius:3px;width:\${favProb/(favProb+undProb)*100}%;"></div>
              <div style="height:6px;background:var(--diff);border-radius:0 3px 3px 0;width:\${undProb/(favProb+undProb)*100}%;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--muted);margin-top:2px;">
              <span>\${favProb}% implied</span><span>\${undProb}% implied</span>
            </div>
          </div>
          <div style="text-align:center;">
            \${chip(u.underdog.abbrev, u.underdog.name, 'lg')}
            <div style="font-size:10px;color:var(--diff);margin-top:3px;">\${fmtOdds(u.underdog.odds)}</div>
          </div>
        </div>
      </div>
      <div style="padding:12px 16px;">
        \${u.underdogPickCount === 0
          ? '<span style="font-size:12px;color:var(--muted);">Nobody picked this upset</span>'
          : \`<span style="font-size:12px;color:var(--muted);margin-right:8px;">\${u.underdogPickCount} of \${n} picked \${u.underdog.abbrev}:</span>\${pickersHtml}\`
        }
      </div>
    </div>\`;
  });
  document.getElementById('upset-cards').innerHTML = cardsHtml;

  // Darlings
  let darlingsHtml = '';
  if (DATA.darlings.length === 0) {
    darlingsHtml = '<p style="color:var(--muted);">No deep run darlings found.</p>';
  }
  DATA.darlings.forEach(d => {
    const pickerLines = d.pickers.map(p =>
      \`<div style="font-size:11px;padding:3px 0;border-bottom:1px solid var(--border);">
        \${esc(p.bracketName)} → <strong style="color:var(--cream);">\${p.deepestRound}</strong>\${p.isChampion ? ' 🏆' : ''}
      </div>\`
    ).join('');
    darlingsHtml += \`
    <div class="card">
      \${chip(d.abbrev, d.name, 'lg')}
      <div style="font-size:13px;font-weight:700;margin:8px 0 2px;">\${esc(d.name)}</div>
      <div style="font-size:12px;color:var(--gold);margin-bottom:10px;">\${fmtOdds(d.odds)}</div>
      \${pickerLines}
    </div>\`;
  });
  document.getElementById('darlings-grid').innerHTML = darlingsHtml;

  // Contrarianism ranking
  const sorted = [...DATA.brackets].sort((a,b) => b.contrarianism - a.contrarianism);
  const maxC = sorted[0].contrarianism;
  let contHtml = '';
  sorted.forEach((b, rank) => {
    const shortName = b.name.replace(/'s (1st|2nd|3rd) Bracket$/,'').replace(' Bracket','');
    const barPct = Math.round(b.contrarianism / maxC * 100);
    contHtml += \`
    <div class="card" style="display:flex;align-items:center;gap:14px;padding:12px 16px;">
      <span style="font-size:18px;font-weight:800;color:var(--muted);min-width:28px;">#\${rank+1}</span>
      <div style="flex:1;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
          <span style="font-size:13px;font-weight:600;">\${esc(shortName)}</span>
          <span style="font-size:12px;color:var(--muted);">\${b.contrarianism}/31 picks against consensus</span>
        </div>
        <div class="prob-bar-bg" style="height:8px;">
          <div style="height:8px;background:var(--gold);border-radius:3px;width:\${barPct}%;transition:width .5s;"></div>
        </div>
      </div>
      \${chip(b.champion.abbrev, b.champion.name)}
    </div>\`;
  });
  document.getElementById('contrarian-list').innerHTML = contHtml;
}

// ---- Versus ----
function initVersus() {
  const selA = document.getElementById('vs-a');
  const selB = document.getElementById('vs-b');
  DATA.brackets.forEach((b, i) => {
    const shortName = b.name.replace(/'s (1st|2nd|3rd) Bracket$/,'').replace(' Bracket','');
    selA.innerHTML += \`<option value="\${i}">\${esc(shortName)} (\${esc(b.champion.abbrev)})</option>\`;
    selB.innerHTML += \`<option value="\${i}">\${esc(shortName)} (\${esc(b.champion.abbrev)})</option>\`;
  });
  const [di, dj] = DATA.mostDifferentPair;
  selA.value = di;
  selB.value = dj;
  renderVersus();
  selA.addEventListener('change', renderVersus);
  selB.addEventListener('change', renderVersus);
}

function renderVersus() {
  const i = parseInt(document.getElementById('vs-a').value);
  const j = parseInt(document.getElementById('vs-b').value);
  const bA = DATA.brackets[i];
  const bB = DATA.brackets[j];
  const agreed = DATA.similarity[i]?.[j] ?? 0;

  const shortA = bA.name.replace(/'s (1st|2nd|3rd) Bracket$/,'').replace(' Bracket','');
  const shortB = bB.name.replace(/'s (1st|2nd|3rd) Bracket$/,'').replace(' Bracket','');
  const agreePct = Math.round(agreed / 31 * 100);

  document.getElementById('vs-summary').innerHTML = \`
    <div class="card" style="display:inline-flex;align-items:center;gap:20px;padding:14px 20px;">
      <div>\${chip(bA.champion.abbrev, bA.champion.name)} <span style="font-size:13px;margin-left:4px;font-weight:600;">\${esc(shortA)}</span></div>
      <div style="text-align:center;">
        <div style="font-size:22px;font-weight:800;color:\${agreePct > 60 ? 'var(--agree)' : agreePct < 35 ? 'var(--diff)' : 'var(--gold)'};">\${agreePct}%</div>
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;">\${agreed}/31 agree</div>
      </div>
      <div>\${chip(bB.champion.abbrev, bB.champion.name)} <span style="font-size:13px;margin-left:4px;font-weight:600;">\${esc(shortB)}</span></div>
    </div>
  \`;

  // Build comparison table grouped by round
  const rounds = [
    { key: 'R32', label: 'Round of 32' },
    { key: 'R16', label: 'Round of 16' },
    { key: 'QF',  label: 'Quarterfinals' },
    { key: 'SF',  label: 'Semifinals' },
    { key: 'F',   label: 'Final' },
  ];

  // Build prop order from bA's picks (should be same structure for all brackets)
  const propsByRound = {};
  bA.picks.forEach(p => {
    if (!propsByRound[p.roundAbbrev]) propsByRound[p.roundAbbrev] = [];
    propsByRound[p.roundAbbrev].push(p.propositionId);
  });

  let html = \`<thead><tr>
    <th style="text-align:left;padding:8px 14px;font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em;width:120px;">Round</th>
    <th style="text-align:center;padding:8px 14px;font-size:13px;font-weight:700;color:var(--cream);">\${esc(shortA)}</th>
    <th style="width:60px;"></th>
    <th style="text-align:center;padding:8px 14px;font-size:13px;font-weight:700;color:var(--cream);">\${esc(shortB)}</th>
  </tr></thead><tbody>\`;

  rounds.forEach(r => {
    const propIds = propsByRound[r.key] || [];
    if (!propIds.length) return;
    html += \`<tr><td colspan="4" style="padding:10px 14px 4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--gold);">\${r.label}</td></tr>\`;
    propIds.forEach(propId => {
      const pickA = bPickMap[i]?.[propId];
      const pickB = bPickMap[j]?.[propId];
      const agrees = pickA && pickB && pickA === pickB;
      const rowBg = agrees ? 'rgba(110,191,139,0.08)' : 'rgba(192,103,90,0.08)';
      const nameA = teamMap[pickA]?.name || pickA || '?';
      const nameB = teamMap[pickB]?.name || pickB || '?';
      html += \`<tr class="vs-row" style="background:\${rowBg};">
        <td style="padding:7px 14px;"></td>
        <td style="padding:7px 14px;text-align:center;">\${pickA ? chip(pickA, nameA) : '—'}</td>
        <td style="padding:7px 4px;text-align:center;font-size:14px;">\${agrees ? '<span style="color:var(--agree);">✓</span>' : '<span style="color:var(--diff);">✗</span>'}</td>
        <td style="padding:7px 14px;text-align:center;">\${pickB ? chip(pickB, nameB) : '—'}</td>
      </tr>\`;
    });
  });
  html += '</tbody>';
  document.getElementById('vs-table').innerHTML = html;
}

// ---- Init ----
window.addEventListener('DOMContentLoaded', () => {
  initPulse();
  initGrid();
  initSpicy();
  initVersus();
  showView('pulse');
});
</script>
</body>
</html>`;

fs.writeFileSync('./index.html', html);
const size = Math.round(fs.statSync('./index.html').size / 1024);
console.log(`Generated index.html (${size}KB)`);
