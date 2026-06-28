const fs = require('fs');
const raw = require('./brackets_raw.json');

// --- Odds ---
const NAME_TO_ABBREV = {
  'France': 'FRA', 'Argentina': 'ARG', 'England': 'ENG', 'Spain': 'ESP',
  'Brazil': 'BRA', 'Portugal': 'POR', 'Netherlands': 'NED', 'Germany': 'GER',
  'Norway': 'NOR', 'Colombia': 'COL', 'USA': 'USA', 'Morocco': 'MAR',
  'Mexico': 'MEX', 'Belgium': 'BEL', 'Japan': 'JPN', 'Switzerland': 'SUI',
  'Senegal': 'SEN', 'Ecuador': 'ECU', 'Ivory Coast': 'CIV', 'Croata': 'CRO',
  'Egypt': 'EGY', 'Canada': 'CAN', 'Sweden': 'SWE', 'Ghana': 'GHA',
  'Australia': 'AUS', 'Austria': 'AUT', 'Algeria': 'ALG', 'Paraguay': 'PAR',
  'DR Congo': 'COD', 'Cape Verde': 'CPV', 'Bosnia & Herzeogvina': 'BIH',
  'South Africa': 'RSA',
};

const oddsLines = fs.readFileSync('./odds.txt', 'utf8').trim().split('\n');
const abbrevToOdds = {};
for (const line of oddsLines) {
  const m = line.match(/^(.+?)\s+\+(\d+)$/);
  if (m) {
    const abbrev = NAME_TO_ABBREV[m[1].trim()];
    if (abbrev) abbrevToOdds[abbrev] = parseInt(m[2], 10);
  }
}

function impliedProb(odds) {
  return 100 / (odds + 100);
}

// --- Build proposition + outcome lookup maps ---
const outcomeToTeam = {};
const propToMatchup = {};

const ROUND_NAMES = { 1: 'R32', 2: 'R16', 3: 'QF', 4: 'SF', 5: 'F' };
const ROUND_LABELS = {
  1: 'Round of 32', 2: 'Round of 16', 3: 'Quarterfinals', 4: 'Semifinals', 5: 'Final',
};
const POINTS_BY_PERIOD = { 1: 25, 2: 50, 3: 100, 4: 200, 5: 400 };

for (const prop of raw.propositions) {
  const teams = prop.possibleOutcomes.map(o => {
    outcomeToTeam[o.id] = { abbrev: o.abbrev, name: o.description };
    return { id: o.id, abbrev: o.abbrev, name: o.description };
  });
  propToMatchup[prop.id] = {
    id: prop.id, name: prop.name, date: prop.date,
    teams, actualOutcomeIds: prop.actualOutcomeIds || [],
  };
}

const sortedProps = Object.values(propToMatchup).sort((a, b) => a.date - b.date);
const roundSizes = [16, 8, 4, 2, 1];
let idx = 0;
for (let round = 1; round <= 5; round++) {
  for (let i = 0; i < roundSizes[round - 1]; i++) {
    if (sortedProps[idx]) {
      sortedProps[idx].round = round;
      sortedProps[idx].roundLabel = ROUND_LABELS[round];
      sortedProps[idx].roundAbbrev = ROUND_NAMES[round];
      sortedProps[idx].points = POINTS_BY_PERIOD[round];
      idx++;
    }
  }
}
for (const prop of sortedProps) propToMatchup[prop.id] = prop;

// --- Parse brackets ---
const brackets = [];
for (const [entryId, entry] of Object.entries(raw.entryDetails)) {
  const picks = entry.picks.picks || [];
  if (picks.length === 0) continue;

  const resolvedPicks = picks.map(pick => {
    const prop = propToMatchup[pick.propositionId] || {};
    const outcomeId = pick.outcomesPicked?.[0]?.outcomeId;
    const team = outcomeToTeam[outcomeId] || { abbrev: '?', name: 'Unknown' };
    const actual = prop.actualOutcomeIds?.[0];
    const correct = actual ? actual === outcomeId : null;
    return {
      propositionId: pick.propositionId,
      matchup: prop.name || pick.propositionId,
      round: prop.round,
      roundLabel: prop.roundLabel,
      roundAbbrev: prop.roundAbbrev,
      points: prop.points,
      pickedOutcomeId: outcomeId,
      pickedTeamAbbrev: team.abbrev,
      pickedTeamName: team.name,
      result: pick.outcomesPicked?.[0]?.result || 'UNDECIDED',
      correct,
    };
  });

  const byRound = {};
  for (const pick of resolvedPicks) {
    const r = pick.roundAbbrev || 'unknown';
    if (!byRound[r]) byRound[r] = [];
    byRound[r].push(pick);
  }

  const finalPick = entry.picks.finalPick;
  const championOutcomeId = finalPick?.outcomesPicked?.[0]?.outcomeId;
  const champion = outcomeToTeam[championOutcomeId] || { abbrev: '?', name: 'Unknown' };

  brackets.push({
    id: entryId,
    name: entry.meta.name,
    displayName: entry.meta.member.displayName,
    score: entry.meta.score.overallScore,
    rank: entry.meta.score.rank,
    champion,
    championOutcomeId,
    picks: resolvedPicks,
    picksByRound: byRound,
  });
}

const totalBrackets = brackets.length;

// --- Team stats with odds ---
const teamPickCounts = {};
const teamChampionCounts = {};

for (const b of brackets) {
  const champ = b.champion.abbrev;
  teamChampionCounts[champ] = (teamChampionCounts[champ] || 0) + 1;
  for (const pick of b.picks) {
    const t = pick.pickedTeamAbbrev;
    if (!teamPickCounts[t]) teamPickCounts[t] = { abbrev: t, name: pick.pickedTeamName, byRound: {} };
    teamPickCounts[t].byRound[pick.roundAbbrev] = (teamPickCounts[t].byRound[pick.roundAbbrev] || 0) + 1;
  }
}

const teamStats = Object.values(teamPickCounts).map(t => ({
  ...t,
  odds: abbrevToOdds[t.abbrev] || null,
  impliedProb: abbrevToOdds[t.abbrev] ? impliedProb(abbrevToOdds[t.abbrev]) : null,
  championCount: teamChampionCounts[t.abbrev] || 0,
  championPct: ((teamChampionCounts[t.abbrev] || 0) / totalBrackets * 100).toFixed(1),
})).sort((a, b) => b.championCount - a.championCount);

// --- Bracket pick lookup: bracketId → propId → outcomeId ---
const bracketPickMap = {};
for (const b of brackets) {
  bracketPickMap[b.id] = {};
  for (const pick of b.picks) {
    bracketPickMap[b.id][pick.propositionId] = pick.pickedOutcomeId;
  }
}

// --- Consensus picks (most common outcome per proposition) ---
const allPropIds = sortedProps.map(p => p.id);
const consensusPick = {}; // propId → most common outcomeId
for (const propId of allPropIds) {
  const counts = {};
  for (const b of brackets) {
    const o = bracketPickMap[b.id]?.[propId];
    if (o) counts[o] = (counts[o] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  consensusPick[propId] = sorted[0]?.[0] || null;
}

// --- Contrarianism per bracket ---
for (const b of brackets) {
  let contrarian = 0;
  for (const propId of allPropIds) {
    const myPick = bracketPickMap[b.id]?.[propId];
    if (myPick && myPick !== consensusPick[propId]) contrarian++;
  }
  b.contrarianism = contrarian;
}

// --- Similarity matrix ---
const similarity = brackets.map((bi, i) =>
  brackets.map((bj, j) => {
    if (i === j) return 31;
    let matches = 0;
    for (const propId of allPropIds) {
      if (bracketPickMap[bi.id]?.[propId] === bracketPickMap[bj.id]?.[propId]) matches++;
    }
    return matches;
  })
);

// Find most different pair (default for Versus view)
let minSim = 32, minI = 0, minJ = 1;
for (let i = 0; i < brackets.length; i++) {
  for (let j = i + 1; j < brackets.length; j++) {
    if (similarity[i][j] < minSim) { minSim = similarity[i][j]; minI = i; minJ = j; }
  }
}

// --- R32 upset analysis ---
const r32Props = sortedProps.filter(p => p.round === 1);
const upsets = r32Props.map(prop => {
  const [t1, t2] = prop.teams;
  const odds1 = abbrevToOdds[t1.abbrev] || 99999;
  const odds2 = abbrevToOdds[t2.abbrev] || 99999;
  const [favorite, underdog] = odds1 < odds2
    ? [{ ...t1, odds: odds1 }, { ...t2, odds: odds2 }]
    : [{ ...t2, odds: odds2 }, { ...t1, odds: odds1 }];
  const upsetFactor = Math.round(underdog.odds / favorite.odds);
  const underdogOutcomeId = prop.teams.find(t => t.abbrev === underdog.abbrev)?.id;
  const upsetPickers = brackets
    .filter(b => bracketPickMap[b.id]?.[prop.id] === underdogOutcomeId)
    .map(b => b.name.replace(/'s (1st|2nd|3rd) Bracket$/, '').replace(" Bracket", ''));
  return {
    propId: prop.id,
    matchup: prop.name,
    favorite: { abbrev: favorite.abbrev, name: favorite.name, odds: favorite.odds, impliedProb: impliedProb(favorite.odds) },
    underdog: { abbrev: underdog.abbrev, name: underdog.name, odds: underdog.odds, impliedProb: impliedProb(underdog.odds) },
    upsetFactor,
    underdogPickCount: upsetPickers.length,
    upsetPickers,
    favoritePickCount: totalBrackets - upsetPickers.length,
  };
}).sort((a, b) => b.upsetFactor - a.upsetFactor);

// --- Deep run darlings: high-odds teams picked past R32 ---
const DARLING_ODDS_THRESHOLD = 5000;
const darlings = [];
for (const [abbrev, odds] of Object.entries(abbrevToOdds)) {
  if (odds < DARLING_ODDS_THRESHOLD) continue;
  const team = teamPickCounts[abbrev];
  if (!team) continue;
  const pickers = [];
  for (const b of brackets) {
    const advRounds = [];
    for (const pick of b.picks) {
      if (pick.pickedTeamAbbrev === abbrev && pick.round > 1) {
        advRounds.push(pick.roundAbbrev);
      }
    }
    if (advRounds.length > 0) {
      pickers.push({
        bracketName: b.name.replace(/'s (1st|2nd|3rd) Bracket$/, '').replace(" Bracket", ''),
        deepestRound: advRounds[advRounds.length - 1],
        isChampion: b.champion.abbrev === abbrev,
      });
    }
  }
  if (pickers.length > 0) {
    darlings.push({ abbrev, name: team.name, odds, impliedProb: impliedProb(odds), pickers });
  }
}
darlings.sort((a, b) => b.odds - a.odds);

// --- Proposition grid data (for Grid view columns) ---
// Build ordered slot list: R16, QF, SF, F (skip R32 — too many cols)
const gridProps = sortedProps.filter(p => p.round >= 2);

const output = {
  meta: {
    groupName: raw.entryDetails[Object.keys(raw.entryDetails)[0]]?.picks?.challengeGroups?.[0]?.groupSettings?.name || 'SL World Cup 2026',
    totalBrackets,
    scrapedAt: new Date().toISOString(),
  },
  brackets,
  teamStats,
  propositions: sortedProps,
  upsets,
  darlings,
  similarity,
  mostDifferentPair: [minI, minJ],
  gridProps,
};

fs.writeFileSync('./brackets_clean.json', JSON.stringify(output, null, 2));
console.log(`Parsed ${totalBrackets} complete brackets`);
console.log('\nTop champion picks:');
teamStats.slice(0, 8).forEach(t => console.log(`  ${t.abbrev} (${t.name}): ${t.championCount} picks (${t.championPct}%) odds:+${t.odds}`));
console.log('\nTop upsets picked:');
upsets.slice(0, 5).forEach(u => console.log(`  ${u.matchup} — ${u.underdog.abbrev}+${u.underdog.odds} vs ${u.favorite.abbrev}+${u.favorite.odds} | factor:${u.upsetFactor}x | ${u.underdogPickCount} pickers: ${u.upsetPickers.join(', ')}`));
console.log('\nDeep run darlings:', darlings.map(d => `${d.abbrev}+${d.odds} (${d.pickers.length} brackets)`).join(', '));
console.log('\nMost different pair:', brackets[minI].name, 'vs', brackets[minJ].name, `(${minSim}/31 agree)`);
