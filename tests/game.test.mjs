// Run with: node tests/game.test.mjs
import assert from 'node:assert/strict';
import {
  evaluate, isValidGuess, hardModeError, ordinal, keyStates, dayIndex, solutionForDay,
  formatCountdown, msUntilNextDay, newStats, recordResult, normalizeStreak, shareText,
} from '../js/game.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.error('  FAIL ' + name + '\n       ' + e.message); }
}

const A = 'absent', P = 'present', C = 'correct';

console.log('evaluate');
test('ABBEY / KEBAB', () => assert.deepEqual(evaluate('kebab', 'abbey'), [A, P, C, P, P]));
test('CRANE / EERIE', () => assert.deepEqual(evaluate('eerie', 'crane'), [A, A, P, A, C]));
test('win is all correct', () => assert.deepEqual(evaluate('cigar', 'cigar'), [C, C, C, C, C]));
test('triple letter guess vs one copy', () => assert.deepEqual(evaluate('eeeee', 'crane'), [A, A, A, A, C]));
test('triple letter guess vs two copies', () => assert.deepEqual(evaluate('lolly', 'allow'), [P, P, C, A, A]));
test('present letters capped by answer count', () => assert.deepEqual(evaluate('speed', 'abide'), [A, A, P, A, P]));
test('case-insensitive', () => assert.deepEqual(evaluate('CIGAR', 'cigar'), [C, C, C, C, C]));
test('no matches', () => assert.deepEqual(evaluate('lynch', 'atoms'), [A, A, A, A, A]));

console.log('word list');
test('answers are valid guesses', () => assert.ok(isValidGuess('cigar')));
test('extra guesses are valid', () => assert.ok(isValidGuess('aahed')));
test('junk is not valid', () => assert.ok(!isValidGuess('xxxxx')));
test('uppercase accepted', () => assert.ok(isValidGuess('CRANE')));

console.log('hard mode');
test('ordinals', () => assert.deepEqual([1, 2, 3, 4, 5, 11, 22].map(ordinal), ['1st', '2nd', '3rd', '4th', '5th', '11th', '22nd']));
const board = ['crane', '', '', '', '', ''];
const evals = [evaluate('crane', 'cigar'), null, null, null, null, null]; // C correct, R present, A present
test('green must stay in place', () => assert.equal(hardModeError('boast', board, evals, 1), '1st letter must be C'));
test('yellow must be used', () => assert.equal(hardModeError('chasm', board, evals, 1), 'Guess must contain R'));
test('green checked before yellow', () => assert.equal(hardModeError('xxxxx', board, evals, 1), '1st letter must be C'));
test('valid hard mode guess', () => assert.equal(hardModeError('cigar', board, evals, 1), null));
test('no hints on first row', () => assert.equal(hardModeError('zzzzz', board, evals, 0), null));
test('duplicate hint letters need duplicates', () => {
  const b2 = ['sleep', '', '', '', '', ''];
  const e2 = [evaluate('sleep', 'eerie'), null, null, null, null, null]; // e present x2
  assert.equal(hardModeError('ebony', b2, e2, 1), 'Guess must contain E');
  assert.equal(hardModeError('eerie', b2, e2, 1), null);
});

console.log('keyboard state');
test('never downgrades', () => {
  const s = keyStates(['abbey', 'babes'], [evaluate('abbey', 'kebab'), evaluate('babes', 'kebab')]);
  assert.equal(s.b, C);
  assert.equal(s.y, A);
});

console.log('daily puzzle');
test('puzzle 0 is June 19, 2021', () => assert.equal(dayIndex(new Date(2021, 5, 19, 13)), 0));
test('puzzle 1 is the next day', () => assert.equal(dayIndex(new Date(2021, 5, 20, 0, 0, 1)), 1));
test('late evening is the same day', () => assert.equal(dayIndex(new Date(2021, 5, 19, 23, 59)), 0));
test('across a DST change', () => assert.equal(dayIndex(new Date(2022, 2, 14)) - dayIndex(new Date(2022, 2, 12)), 2));
test('first answers in original order', () => assert.deepEqual([0, 1, 2].map(solutionForDay), ['cigar', 'rebut', 'sissy']));
test('list wraps around', () => assert.equal(solutionForDay(2315), 'cigar'));
test('countdown format', () => assert.equal(formatCountdown(3723000), '01:02:03'));
test('time to midnight', () => assert.equal(msUntilNextDay(new Date(2024, 0, 1, 23, 0, 0)), 3600000));

console.log('statistics');
test('win builds a streak', () => {
  let s = newStats();
  s = recordResult(s, 10, true, 3);
  s = recordResult(s, 11, true, 4);
  assert.equal(s.currentStreak, 2);
  assert.equal(s.maxStreak, 2);
  assert.equal(s.gamesPlayed, 2);
  assert.equal(s.winPercentage, 100);
  assert.equal(s.guesses[3], 1);
});
test('same day never counted twice', () => {
  let s = recordResult(newStats(), 10, true, 3);
  s = recordResult(s, 10, true, 3);
  assert.equal(s.gamesPlayed, 1);
});
test('loss resets streak', () => {
  let s = recordResult(newStats(), 10, true, 3);
  s = recordResult(s, 11, false, 6);
  assert.equal(s.currentStreak, 0);
  assert.equal(s.maxStreak, 1);
  assert.equal(s.guesses.fail, 1);
  assert.equal(s.winPercentage, 50);
});
test('skipped day restarts streak at 1', () => {
  let s = recordResult(newStats(), 10, true, 3);
  s = recordResult(s, 12, true, 3);
  assert.equal(s.currentStreak, 1);
});
test('missed day shows streak 0', () => {
  const s = recordResult(newStats(), 10, true, 3);
  assert.equal(normalizeStreak(s, 11).currentStreak, 1);
  assert.equal(normalizeStreak(s, 12).currentStreak, 0);
});

console.log('share');
const rows = [evaluate('crane', 'cigar'), evaluate('cigar', 'cigar'), null, null, null, null];
test('light mode win', () => assert.equal(
  shareText({ day: 1234, evaluations: rows, rowIndex: 2, gameStatus: 'WIN', hardMode: false, dark: false, highContrast: false }),
  'Quintle 1,234 2/6\n\n🟩🟨🟨⬜⬜\n🟩🟩🟩🟩🟩'));
test('dark hard mode', () => assert.equal(
  shareText({ day: 5, evaluations: rows, rowIndex: 2, gameStatus: 'WIN', hardMode: true, dark: true, highContrast: false }),
  'Quintle 5 2/6*\n\n🟩🟨🟨⬛⬛\n🟩🟩🟩🟩🟩'));
test('high contrast loss', () => {
  const lost = Array(6).fill(evaluate('crane', 'cigar'));
  assert.equal(
    shareText({ day: 5, evaluations: lost, rowIndex: 6, gameStatus: 'FAIL', hardMode: false, dark: false, highContrast: true }).split('\n')[0],
    'Quintle 5 X/6');
  assert.ok(shareText({ day: 5, evaluations: lost, rowIndex: 6, gameStatus: 'FAIL', hardMode: false, dark: false, highContrast: true }).includes('🟧🟦🟦⬜⬜'));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
