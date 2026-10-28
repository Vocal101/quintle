// Controller: game state, input handling, persistence and the ?dev harness.
import {
  WORD_LENGTH, MAX_GUESSES, WIN_MESSAGES, dayIndex, solutionForDay, isValidGuess, evaluate,
  hardModeError, keyStates, newGameState, newStats, recordResult, normalizeStreak, shareText,
} from './game.js';
import * as store from './storage.js';
import * as ui from './ui.js';

const settings = Object.assign(
  { darkTheme: matchMedia('(prefers-color-scheme: dark)').matches, colorBlindTheme: false, helpShown: false },
  store.loadSettings() || {},
);
let stats = Object.assign(newStats(), store.loadStats() || {});
let game = null;
let current = '';      // letters typed into the active row
let busy = false;      // true while a row is being revealed
let pendingStats = null;
const dev = { answer: null }; // set by the ?dev harness to pin the answer

// ---------- State ----------

function loadDay(day, solution = solutionForDay(day)) {
  const saved = store.loadGameState();
  if (saved && saved.day === day && saved.solution === solution && Array.isArray(saved.boardState)) {
    game = saved;
  } else {
    game = newGameState(day, solution, saved ? !!saved.hardMode : false);
    store.saveGameState(game);
  }
  current = '';
  busy = false;
  clearTimeout(pendingStats);
  stats = normalizeStreak(stats, day);
  ui.clearToasts();
  ui.clearBoard();
  for (let r = 0; r < game.rowIndex; r++) ui.paintRow(r, game.boardState[r], game.evaluations[r]);
  ui.renderKeys(keyStates(game.boardState, game.evaluations));
  ui.setSwitch('hard-mode', game.hardMode);
  document.getElementById('puzzle-number').textContent = `#${day}`;
}

function saveSettings() {
  store.saveSettings(settings);
}

// ---------- Input ----------

function canType() {
  return game.gameStatus === 'IN_PROGRESS' && !busy && !ui.isDialogOpen();
}

function handleKey(key) {
  if (!canType()) return;
  if (key === 'enter') submit();
  else if (key === 'backspace') {
    if (!current) return;
    current = current.slice(0, -1);
    ui.setTile(game.rowIndex, current.length, '', 'empty');
  } else if (/^[a-z]$/.test(key) && current.length < WORD_LENGTH) {
    ui.setTile(game.rowIndex, current.length, key, 'tbd');
    ui.popTile(game.rowIndex, current.length);
    current += key;
  }
}

function reject(message) {
  ui.toast(message);
  ui.shakeRow(game.rowIndex);
}

async function submit() {
  if (current.length < WORD_LENGTH) return reject('Not enough letters');
  if (!isValidGuess(current)) return reject('Not in word list');
  if (game.hardMode) {
    const err = hardModeError(current, game.boardState, game.evaluations, game.rowIndex);
    if (err) return reject(err);
  }

  const row = game.rowIndex;
  const word = current;
  const evaluation = evaluate(word, game.solution);
  const won = word === game.solution;

  // Save before animating so a reload mid-reveal keeps the guess.
  game.boardState[row] = word;
  game.evaluations[row] = evaluation;
  game.rowIndex = row + 1;
  game.lastPlayedTs = Date.now();
  if (won || game.rowIndex === MAX_GUESSES) {
    game.gameStatus = won ? 'WIN' : 'FAIL';
    game.lastCompletedTs = Date.now();
    stats = recordResult(stats, game.day, won, game.rowIndex);
    store.saveStats(stats);
  }
  store.saveGameState(game);
  current = '';

  busy = true;
  const day = game.day;
  await ui.revealRow(row, word, evaluation);
  if (game.day !== day) return; // the day rolled over mid-animation
  ui.renderKeys(keyStates(game.boardState, game.evaluations));
  busy = false;

  if (game.gameStatus === 'WIN') {
    ui.toast(WIN_MESSAGES[row], 2000);
    await ui.bounceRow(row);
    pendingStats = setTimeout(() => showStats(), 300 * ui.timing.scale);
  } else if (game.gameStatus === 'FAIL') {
    ui.toast(game.solution.toUpperCase(), Infinity);
    pendingStats = setTimeout(() => showStats(), 2000 * ui.timing.scale);
  }
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  if (ui.isDialogOpen()) return;
  const key = e.key === 'Enter' ? 'enter' : e.key === 'Backspace' ? 'backspace' : e.key.toLowerCase();
  if (key === 'enter' || key === 'backspace' || /^[a-z]$/.test(key)) {
    // Enter on a focused header button should press that button, not submit.
    if (key === 'enter' && document.activeElement?.closest('header')) return;
    e.preventDefault();
    handleKey(key);
  }
});

// ---------- Panels ----------

function showStats() {
  clearTimeout(pendingStats);
  ui.clearToasts();
  ui.renderStats(stats, game, checkDay);
  ui.openPanel('stats-modal');
}

function onPanelClose(id) {
  if (id === 'stats-modal') ui.stopStatsTimer();
  if (id === 'help-modal' && !settings.helpShown) {
    settings.helpShown = true;
    saveSettings();
  }
}

document.getElementById('help-button').addEventListener('click', () => ui.openPanel('help-modal'));
document.getElementById('stats-button').addEventListener('click', showStats);
document.getElementById('settings-button').addEventListener('click', () => ui.openPanel('settings-page'));

document.getElementById('hard-mode').addEventListener('click', () => {
  if (!game.hardMode && game.rowIndex > 0) {
    ui.toast('Hard mode can only be enabled at the start of a round', 1500);
    return;
  }
  game.hardMode = !game.hardMode;
  ui.setSwitch('hard-mode', game.hardMode);
  store.saveGameState(game);
});

document.getElementById('dark-theme').addEventListener('click', () => {
  settings.darkTheme = !settings.darkTheme;
  ui.setSwitch('dark-theme', settings.darkTheme);
  ui.applyTheme(settings.darkTheme, settings.colorBlindTheme);
  saveSettings();
});

document.getElementById('high-contrast').addEventListener('click', () => {
  settings.colorBlindTheme = !settings.colorBlindTheme;
  ui.setSwitch('high-contrast', settings.colorBlindTheme);
  ui.applyTheme(settings.darkTheme, settings.colorBlindTheme);
  saveSettings();
});

// ---------- Share ----------

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

document.getElementById('share-button').addEventListener('click', async () => {
  const text = shareText({
    day: game.day,
    evaluations: game.evaluations,
    rowIndex: game.rowIndex,
    gameStatus: game.gameStatus,
    hardMode: game.hardMode,
    dark: settings.darkTheme,
    highContrast: settings.colorBlindTheme,
  });
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.share && navigator.canShare?.({ text }) !== false) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // the player closed the share sheet
    }
  }
  ui.toast(await copyText(text) ? 'Copied results to clipboard' : 'Share failed', 2000);
});

// ---------- Day rollover ----------

function checkDay() {
  const today = dayIndex();
  if (dev.answer) return;
  if (game && game.day !== today && !busy) {
    const statsOpen = !document.getElementById('stats-modal').hidden;
    loadDay(today);
    if (statsOpen) ui.renderStats(stats, game, checkDay);
  }
}

document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
window.addEventListener('focus', checkDay);
setInterval(checkDay, 30000);

// ---------- Start ----------

ui.buildBoard();
ui.buildKeyboard(handleKey);
ui.buildHelpExamples();
ui.initPanels(onPanelClose);
ui.applyTheme(settings.darkTheme, settings.colorBlindTheme);
ui.setSwitch('dark-theme', settings.darkTheme);
ui.setSwitch('high-contrast', settings.colorBlindTheme);
saveSettings();
loadDay(dayIndex());
store.saveStats(stats);

window.addEventListener('resize', ui.resizeBoard);
new ResizeObserver(ui.resizeBoard).observe(document.getElementById('board-container'));

if (!settings.helpShown) ui.openPanel('help-modal');
else if (game.gameStatus !== 'IN_PROGRESS') pendingStats = setTimeout(showStats, 500);

if ('serviceWorker' in navigator && !location.search.includes('dev') && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// ---------- Dev harness (only with ?dev in the URL) ----------

if (new URLSearchParams(location.search).has('dev')) {
  const type = (word) => { for (const ch of word) handleKey(ch); handleKey('enter'); };
  const until = (fn) => new Promise((resolve) => {
    const id = setInterval(() => { if (fn()) { clearInterval(id); resolve(); } }, 20);
  });
  window.T = {
    // Starts a fresh game for today with the given answer (not persisted across reloads).
    setAnswer(word) {
      word = word.toLowerCase();
      dev.answer = word;
      store.saveGameState(newGameState(game.day, word, game.hardMode));
      loadDay(game.day, word);
      return T.state();
    },
    setDay(index) {
      dev.answer = null;
      loadDay(index);
      return T.state();
    },
    async guess(word) { type(word.toLowerCase()); await until(() => !busy); return T.state(); },
    async win() { ui.closePanel(true); await T.guess(game.solution); return T.state(); },
    async lose() {
      ui.closePanel(true);
      const wrong = ['crane', 'pilot', 'dumpy', 'shown', 'vixen', 'gecko', 'fjord', 'blitz']
        .filter((w) => w !== game.solution && !game.boardState.includes(w));
      while (game.gameStatus === 'IN_PROGRESS') await T.guess(wrong.shift());
      return T.state();
    },
    resetStats() { stats = newStats(); store.saveStats(stats); return stats; },
    reset() { store.clearAll(); location.reload(); },
    instant(on = true) { ui.setMotionScale(on ? 0.01 : 1); },
    state() { return { game: structuredClone(game), stats: structuredClone(stats), settings: { ...settings }, current, busy }; },
  };
  console.info('Quintle dev harness: window.T', Object.keys(window.T));
}
