// DOM rendering: board, keyboard, toasts, modals and the stats panel.
import { WORD_LENGTH, MAX_GUESSES, ordinal, formatCountdown, msUntilNextDay } from './game.js';

const $ = (sel) => document.querySelector(sel);

// Animation speed factor shared by CSS (--motion) and JS timers.
export const timing = {
  scale: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.4 : 1,
};
export const wait = (ms) => new Promise((r) => setTimeout(r, ms * timing.scale));

export function setMotionScale(scale) {
  timing.scale = scale;
  document.documentElement.style.setProperty('--motion', String(scale));
}

// ---------- Board ----------

const rows = [];

export function buildBoard() {
  const board = $('#board');
  board.textContent = '';
  rows.length = 0;
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', `Row ${r + 1}`);
    const tiles = [];
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.setAttribute('role', 'img');
      row.appendChild(tile);
      tiles.push(tile);
    }
    board.appendChild(row);
    rows.push({ el: row, tiles });
  }
  clearBoard();
  resizeBoard();
}

function labelTile(tile, c) {
  const letter = tile.textContent;
  const state = tile.dataset.state;
  const pos = `${ordinal(c + 1)} letter`;
  tile.setAttribute('aria-label', letter
    ? `${pos}, ${letter.toUpperCase()}${state === 'tbd' ? '' : ', ' + state}`
    : `${pos}, empty`);
}

export function setTile(r, c, letter, state) {
  const tile = rows[r].tiles[c];
  tile.textContent = letter || '';
  tile.dataset.state = state;
  labelTile(tile, c);
}

export function clearBoard() {
  rows.forEach((row, r) => {
    row.el.classList.remove('invalid');
    row.tiles.forEach((t, c) => { delete t.dataset.animation; setTile(r, c, '', 'empty'); });
  });
}

// Draws a row without animation (used when restoring a saved game).
export function paintRow(r, word, evaluation) {
  for (let c = 0; c < WORD_LENGTH; c++) {
    const letter = word[c] || '';
    setTile(r, c, letter, evaluation ? evaluation[c] : letter ? 'tbd' : 'empty');
  }
}

export function popTile(r, c) {
  const tile = rows[r].tiles[c];
  delete tile.dataset.animation;
  void tile.offsetWidth; // restart the animation
  tile.dataset.animation = 'pop';
}

export function shakeRow(r) {
  const row = rows[r].el;
  row.classList.remove('invalid');
  void row.offsetWidth;
  row.classList.add('invalid');
  setTimeout(() => row.classList.remove('invalid'), 600 * timing.scale + 50);
}

// Flips each tile in turn, revealing its color at the halfway point.
// Resolves once the last tile has finished.
export async function revealRow(r, word, evaluation) {
  const { tiles } = rows[r];
  const flips = tiles.map((tile, c) => (async () => {
    await wait(300 * c);
    tile.dataset.animation = 'flip-in';
    await wait(250);
    setTile(r, c, word[c], evaluation[c]);
    tile.dataset.animation = 'flip-out';
    await wait(250);
    delete tile.dataset.animation;
  })());
  await Promise.all(flips);
}

export async function bounceRow(r) {
  const { tiles } = rows[r];
  await Promise.all(tiles.map(async (tile, c) => {
    await wait(100 * c);
    tile.dataset.animation = 'bounce';
    await wait(1000);
    delete tile.dataset.animation;
  }));
}

// Fits the board between header and keyboard, keeping tiles square.
export function resizeBoard() {
  const container = $('#board-container');
  const board = $('#board');
  const h = container.clientHeight;
  const w = container.clientWidth;
  const width = Math.min(Math.floor(h * (5 / 6)), 350, w);
  board.style.width = `${width}px`;
  board.style.height = `${6 * Math.floor(width / 5)}px`;
}

// ---------- Keyboard ----------

const KEY_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['-spacer', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '-spacer'],
  ['enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'backspace'],
];
const BACKSPACE_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H7.07L2.4 12l4.66-7H22v14zm-11.59-2L14 13.41 17.59 17 19 15.59 15.41 12 19 8.41 17.59 7 14 10.59 10.41 7 9 8.41 12.59 12 9 15.59z"/></svg>';
const keyEls = {};

export function buildKeyboard(onKey) {
  const kb = $('#keyboard');
  kb.textContent = '';
  for (const keys of KEY_ROWS) {
    const row = document.createElement('div');
    row.className = 'key-row';
    for (const key of keys) {
      if (key === '-spacer') {
        const s = document.createElement('div');
        s.className = 'half';
        row.appendChild(s);
        continue;
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.key = key;
      if (key === 'enter') {
        b.textContent = 'enter';
        b.className = 'one-and-a-half';
        b.setAttribute('aria-label', 'enter');
      } else if (key === 'backspace') {
        b.innerHTML = BACKSPACE_ICON;
        b.className = 'one-and-a-half';
        b.setAttribute('aria-label', 'backspace');
      } else {
        b.textContent = key;
        b.setAttribute('aria-label', `add ${key.toUpperCase()}`);
        keyEls[key] = b;
      }
      b.addEventListener('click', (e) => {
        // Drop focus after a pointer click so a later physical Enter
        // submits the guess instead of re-pressing this key.
        if (e.detail > 0) b.blur();
        onKey(key);
      });
      row.appendChild(b);
    }
    kb.appendChild(row);
  }
}

export function renderKeys(states) {
  for (const [key, el] of Object.entries(keyEls)) {
    const s = states[key];
    if (s) el.dataset.state = s;
    else delete el.dataset.state;
    el.setAttribute('aria-label', `add ${key.toUpperCase()}${s ? ', ' + s : ''}`);
  }
}

// ---------- Toasts ----------

export function toast(message, duration = 1000) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  $('#toaster').prepend(el);
  if (duration !== Infinity) {
    setTimeout(() => {
      el.classList.add('fade');
      setTimeout(() => el.remove(), 300);
    }, duration);
  }
  return el;
}

export function clearToasts() {
  $('#toaster').textContent = '';
}

// ---------- Modals and the settings page ----------

let openDialog = null; // { root, opener }

export const isDialogOpen = () => openDialog !== null;

function focusables(root) {
  return [...root.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.disabled && el.offsetParent !== null);
}

export function openPanel(id) {
  if (openDialog) closePanel(true);
  const root = document.getElementById(id);
  root.hidden = false;
  root.classList.remove('closing');
  openDialog = { root, opener: document.activeElement };
  // Focus the dialog itself so screen readers enter it without a
  // focus ring appearing on the close button.
  const dialog = root.querySelector('[role="dialog"]') || root;
  dialog.tabIndex = -1;
  dialog.focus({ preventScroll: true });
}

export function closePanel(immediate = false) {
  if (!openDialog) return;
  const { root, opener } = openDialog;
  openDialog = null;
  const done = () => { root.hidden = true; root.classList.remove('closing'); };
  if (immediate) done();
  else {
    root.classList.add('closing');
    setTimeout(done, 200 * timing.scale);
  }
  if (opener && document.contains(opener) && opener !== document.body) opener.focus({ preventScroll: true });
}

export function initPanels(onClose) {
  for (const id of ['help-modal', 'stats-modal', 'settings-page']) {
    const root = document.getElementById(id);
    root.querySelector('.close').addEventListener('click', () => { closePanel(); onClose(id); });
    if (root.classList.contains('overlay')) {
      root.addEventListener('mousedown', (e) => {
        if (e.target === root) { closePanel(); onClose(id); }
      });
    }
  }
  document.addEventListener('keydown', (e) => {
    if (!openDialog) return;
    if (e.key === 'Escape') {
      const id = openDialog.root.id;
      closePanel();
      onClose(id);
      e.preventDefault();
    } else if (e.key === 'Tab') {
      const items = focusables(openDialog.root);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !openDialog.root.contains(document.activeElement))) {
        last.focus(); e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus(); e.preventDefault();
      }
    }
  });
}

export function buildHelpExamples() {
  for (const row of document.querySelectorAll('.example-row')) {
    const word = row.dataset.word;
    const mark = Number(row.dataset.mark);
    row.setAttribute('role', 'img');
    row.setAttribute('aria-label', `${word.toUpperCase()}: ${word[mark].toUpperCase()} is ${row.dataset.state}`);
    [...word].forEach((ch, i) => {
      const t = document.createElement('div');
      t.className = 'tile';
      t.textContent = ch;
      t.dataset.state = i === mark ? row.dataset.state : 'tbd';
      t.setAttribute('aria-hidden', 'true');
      row.appendChild(t);
    });
  }
}

// ---------- Stats ----------

let timerId = null;

export function renderStats(stats, game, onNewDay) {
  $('#stat-played').textContent = stats.gamesPlayed;
  $('#stat-win').textContent = stats.winPercentage;
  $('#stat-streak').textContent = stats.currentStreak;
  $('#stat-max').textContent = stats.maxStreak;

  const dist = $('#guess-distribution');
  dist.textContent = '';
  if (stats.gamesPlayed === 0) {
    const nd = document.createElement('div');
    nd.className = 'no-data';
    nd.textContent = 'No Data';
    dist.appendChild(nd);
  } else {
    const max = Math.max(1, ...[1, 2, 3, 4, 5, 6].map((i) => stats.guesses[i]));
    for (let i = 1; i <= MAX_GUESSES; i++) {
      const count = stats.guesses[i];
      const c = document.createElement('div');
      c.className = 'graph-container';
      c.innerHTML = `<div class="guess">${i}</div><div class="graph"><div class="graph-bar"><div class="num-guesses"></div></div></div>`;
      const bar = c.querySelector('.graph-bar');
      bar.style.width = `${Math.max(7, Math.round((count / max) * 100))}%`;
      bar.querySelector('.num-guesses').textContent = count;
      if (game.gameStatus === 'WIN' && game.rowIndex === i) bar.classList.add('highlight');
      c.setAttribute('aria-label', `${i} guess${i > 1 ? 'es' : ''}: ${count}`);
      dist.appendChild(c);
    }
  }

  const over = game.gameStatus !== 'IN_PROGRESS';
  $('#stats-footer').hidden = !over;
  clearInterval(timerId);
  if (over) {
    const tick = () => {
      const ms = msUntilNextDay();
      $('#timer').textContent = formatCountdown(ms);
      if (ms < 1000) setTimeout(onNewDay, 1000);
    };
    tick();
    timerId = setInterval(tick, 1000);
  }
}

export function stopStatsTimer() {
  clearInterval(timerId);
}

// ---------- Settings ----------

export function setSwitch(id, on) {
  document.getElementById(id).setAttribute('aria-checked', String(on));
}

export function applyTheme(dark, highContrast) {
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.classList.toggle('high-contrast', highContrast);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#121213' : '#ffffff');
}
