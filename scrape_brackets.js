const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const GROUP_URL = 'https://fantasy.espn.com/games/mens-knockout-bracket-challenge-2026/group?id=e424e774-de4f-4c9a-8c4f-56308cbd52fd';
const CHALLENGE_ID = 284;
const EDGE_PROFILE = path.join(process.env.HOME, 'Library/Application Support/Microsoft Edge/Default');
const OUT_FILE = path.join(__dirname, 'brackets_raw.json');

async function run() {
  console.log('Launching Edge with your existing profile...');
  const context = await chromium.launchPersistentContext(EDGE_PROFILE, {
    channel: 'msedge',
    headless: false,
    args: ['--no-first-run', '--no-default-browser-check'],
  });

  const page = await context.newPage();
  const captured = {};

  const captureJson = async (response) => {
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('json')) {
      try {
        const body = await response.json();
        captured[response.url()] = body;
      } catch (_) {}
    }
  };
  page.on('response', captureJson);

  // Load group page to get auth cookies + entry list
  console.log('Loading group page...');
  await page.goto(GROUP_URL, { waitUntil: 'load', timeout: 60000 });
  // Wait until the group API response has been captured
  await page.waitForFunction(() => true, null, { timeout: 500 }).catch(() => {});
  await page.waitForTimeout(6000);

  // Extract entry IDs and group data from captured responses
  const groupKey = Object.keys(captured).find(k => k.includes(`challenges/${CHALLENGE_ID}/groups`));
  if (!groupKey) {
    console.error('Could not find group API response. Are you logged in to ESPN?');
    await context.close();
    return;
  }

  const groupData = captured[groupKey];
  const GROUP_ID = 'e424e774-de4f-4c9a-8c4f-56308cbd52fd';
  let entries = groupData.entries || [];

  // Paginate until we have all entries
  let offset = entries.length;
  while (entries.length < groupData.completedEntriesCount || offset < entries.length + 10) {
    console.log(`Fetching entries at offset ${offset}...`);
    const pageUrl = `https://gambit-api.fantasy.espn.com/apis/v1/challenges/${CHALLENGE_ID}/groups/${GROUP_ID}/?platform=chui&view=chui_default_group&filter=${encodeURIComponent(JSON.stringify({ filterSortId: { value: 0 }, limit: 30, offset }))}`;
    const page2 = await page.evaluate(async (url) => {
      const r = await fetch(url, { credentials: 'include' });
      return r.json();
    }, pageUrl);
    const newEntries = page2.entries || [];
    if (newEntries.length === 0) break;
    entries = entries.concat(newEntries);
    offset += newEntries.length;
    if (newEntries.length < 30) break;
  }

  console.log(`Found ${entries.length} total entries. Fetching individual brackets...`);

  // Get auth cookies for direct API calls
  const cookies = await context.cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  // Fetch each entry's full bracket via the API directly
  const entryDetails = {};
  for (const entry of entries) {
    const url = `https://gambit-api.fantasy.espn.com/apis/v1/challenges/${CHALLENGE_ID}/entries/${entry.id}/?platform=chui&view=chui_default`;
    console.log(`  Fetching: ${entry.name} (${entry.member.displayName})`);
    try {
      const resp = await page.evaluate(async ({ url, cookieHeader }) => {
        const r = await fetch(url, {
          credentials: 'include',
          headers: { 'Cookie': cookieHeader }
        });
        return r.json();
      }, { url, cookieHeader });
      entryDetails[entry.id] = { meta: entry, picks: resp };
    } catch (e) {
      console.error(`  Error fetching ${entry.name}:`, e.message);
    }
    await page.waitForTimeout(300); // polite rate limit
  }

  // Fetch ALL propositions (no period filter) to resolve team names
  console.log('\nFetching all propositions...');
  const allPropsUrl = `https://gambit-api.fantasy.espn.com/apis/v1/propositions/?challengeId=${CHALLENGE_ID}&platform=chui&view=chui_default`;
  const allProps = await page.evaluate(async (url) => {
    const r = await fetch(url, { credentials: 'include' });
    return r.json();
  }, allPropsUrl);
  console.log(`  Got ${allProps.length} propositions`);

  const output = {
    group: groupData,
    entryDetails,
    challengeInfo: captured[Object.keys(captured).find(k => k.includes('challenges/mens-knockout'))],
    propositions: allProps,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nSaved ${Object.keys(entryDetails).length} bracket entries to ${OUT_FILE}`);
  await context.close();
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
