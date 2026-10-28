// Checks js/words.js: exact counts, 5 lowercase letters, no duplicates.
import { SOLUTIONS, ALLOWED } from '../js/words.js';

let failed = 0;
const check = (ok, msg) => {
  if (ok) console.log('  ok  ' + msg);
  else { console.error('  FAIL ' + msg); failed++; }
};

check(SOLUTIONS.length === 2315, `SOLUTIONS has 2315 words (got ${SOLUTIONS.length})`);
check(ALLOWED.length === 10657, `ALLOWED has 10657 words (got ${ALLOWED.length})`);
check(SOLUTIONS[0] === 'cigar', `puzzle #0 is "cigar" (got "${SOLUTIONS[0]}")`);

const bad = [...SOLUTIONS, ...ALLOWED].filter((w) => !/^[a-z]{5}$/.test(w));
check(bad.length === 0, `every word is 5 lowercase a-z letters${bad.length ? ': ' + bad.slice(0, 5) : ''}`);

const dupes = (list) => list.filter((w, i) => list.indexOf(w) !== i);
check(new Set(SOLUTIONS).size === SOLUTIONS.length, `no duplicates in SOLUTIONS ${dupes(SOLUTIONS).slice(0, 5)}`);
check(new Set(ALLOWED).size === ALLOWED.length, `no duplicates in ALLOWED ${dupes(ALLOWED).slice(0, 5)}`);

const sol = new Set(SOLUTIONS);
const overlap = ALLOWED.filter((w) => sol.has(w));
check(overlap.length === 0, `no word in both lists${overlap.length ? ': ' + overlap.slice(0, 5) : ''}`);

const total = new Set([...SOLUTIONS, ...ALLOWED]).size;
check(total === 12972, `12972 valid guesses in total (got ${total})`);

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nword lists OK');
