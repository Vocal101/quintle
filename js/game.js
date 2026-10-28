// Pure game rules: no DOM, no storage. Everything here is covered by tests/game.test.mjs.
import { SOLUTIONS, ALLOWED } from './words.js';

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;
export const GAME_NAME = 'Quintle';

export const WIN_MESSAGES = ['Genius', 'Magnificent', 'Impressive', 'Splendid', 'Great', 'Phew'];

const VALID = new Set([...SOLUTIONS, ...ALLOWED]);
const DAY_MS = 86400000;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Puzzle #0 is June 19, 2021 in the player's local time zone.
const EPOCH = new Date(2021, 5, 19);

export function dayIndex(date = new Date()) {
  // Rounding absorbs the 23/25-hour days around DST changes.
  return Math.round((startOfDay(date) - EPOCH) / DAY_MS);
}

export function solutionForDay(index) {
  const n = SOLUTIONS.length;
  return SOLUTIONS[((index % n) + n) % n];
}

export function msUntilNextDay(date = new Date()) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return next - date;
}

export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

export function isValidGuess(word) {
  return VALID.has(word.toLowerCase());
}

// Two-pass evaluation: exact matches first consume their letters, then
// remaining letters are "present" only while unconsumed copies are left.
export function evaluate(guess, answer) {
  guess = guess.toLowerCase();
  answer = answer.toLowerCase();
  const result = Array(WORD_LENGTH).fill('absent');
  const remaining = {};
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) result[i] = 'correct';
    else remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'correct') continue;
    const ch = guess[i];
    if (remaining[ch] > 0) {
      result[i] = 'present';
      remaining[ch]--;
    }
  }
  return result;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Returns the hard mode error message for a guess, or null if it uses every
// revealed hint. Greens are checked first (by position), then yellows.
export function hardModeError(guess, boardState, evaluations, rowIndex) {
  guess = guess.toLowerCase();
  for (let pos = 0; pos < WORD_LENGTH; pos++) {
    for (let r = 0; r < rowIndex; r++) {
      if (evaluations[r]?.[pos] === 'correct' && guess[pos] !== boardState[r][pos]) {
        return `${ordinal(pos + 1)} letter must be ${boardState[r][pos].toUpperCase()}`;
      }
    }
  }
  const required = new Map();
  for (let r = 0; r < rowIndex; r++) {
    const counts = new Map();
    for (let i = 0; i < WORD_LENGTH; i++) {
      const state = evaluations[r]?.[i];
      if (state === 'correct' || state === 'present') {
        const ch = boardState[r][i];
        counts.set(ch, (counts.get(ch) || 0) + 1);
      }
    }
    for (const [ch, c] of counts) required.set(ch, Math.max(required.get(ch) || 0, c));
  }
  for (const [ch, need] of required) {
    const have = [...guess].filter((g) => g === ch).length;
    if (have < need) return `Guess must contain ${ch.toUpperCase()}`;
  }
  return null;
}

const RANK = { absent: 1, present: 2, correct: 3 };

// Best known state per letter; never downgrades.
export function keyStates(boardState, evaluations) {
  const states = {};
  boardState.forEach((word, r) => {
    const ev = evaluations[r];
    if (!word || !ev) return;
    [...word].forEach((ch, i) => {
      if (!states[ch] || RANK[ev[i]] > RANK[states[ch]]) states[ch] = ev[i];
    });
  });
  return states;
}

export function newGameState(day, solution, hardMode = false) {
  return {
    day,
    boardState: Array(MAX_GUESSES).fill(''),
    evaluations: Array(MAX_GUESSES).fill(null),
    rowIndex: 0,
    solution,
    gameStatus: 'IN_PROGRESS',
    hardMode,
    lastPlayedTs: null,
    lastCompletedTs: null,
  };
}

export function newStats() {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    guesses: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, fail: 0 },
    winPercentage: 0,
    averageGuesses: 0,
    lastWonDay: null,
    lastCountedDay: null,
  };
}

// Records a finished game. Returns the stats unchanged if this day was
// already counted, so a reload can never count a game twice.
export function recordResult(stats, day, won, guessCount) {
  if (stats.lastCountedDay === day) return stats;
  const s = structuredClone(stats);
  s.gamesPlayed++;
  if (won) {
    s.gamesWon++;
    s.guesses[guessCount]++;
    s.currentStreak = s.lastWonDay === day - 1 ? s.currentStreak + 1 : 1;
    s.maxStreak = Math.max(s.maxStreak, s.currentStreak);
    s.lastWonDay = day;
  } else {
    s.guesses.fail++;
    s.currentStreak = 0;
  }
  s.lastCountedDay = day;
  s.winPercentage = Math.round((s.gamesWon / s.gamesPlayed) * 100);
  let sum = 0;
  for (let i = 1; i <= MAX_GUESSES; i++) sum += i * s.guesses[i];
  s.averageGuesses = s.gamesWon ? Math.round(sum / s.gamesWon) : 0;
  return s;
}

// A missed day breaks the streak even before the next game is finished.
export function normalizeStreak(stats, today) {
  if (stats.currentStreak > 0 && (stats.lastWonDay === null || today - stats.lastWonDay > 1)) {
    return { ...stats, currentStreak: 0 };
  }
  return stats;
}

export function shareText({ day, evaluations, rowIndex, gameStatus, hardMode, dark, highContrast }) {
  const score = gameStatus === 'WIN' ? rowIndex : 'X';
  const glyph = {
    correct: highContrast ? '🟧' : '🟩',
    present: highContrast ? '🟦' : '🟨',
    absent: dark ? '⬛' : '⬜',
  };
  const grid = evaluations
    .slice(0, rowIndex)
    .map((row) => row.map((s) => glyph[s]).join(''))
    .join('\n');
  return `${GAME_NAME} ${day.toLocaleString('en-US')} ${score}/${MAX_GUESSES}${hardMode ? '*' : ''}\n\n${grid}`;
}
