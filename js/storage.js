// localStorage wrapper. Storage can be blocked (private mode, disabled
// cookies), so every access is guarded and falls back to memory.
const PREFIX = 'quintle_';
const memory = {};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw !== null) return JSON.parse(raw);
  } catch { /* blocked or corrupt */ }
  return key in memory ? memory[key] : fallback;
}

function write(key, value) {
  memory[key] = value;
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* blocked or full */ }
}

export const loadGameState = () => read('gameState', null);
export const saveGameState = (s) => write('gameState', s);
export const loadStats = () => read('statistics', null);
export const saveStats = (s) => write('statistics', s);
export const loadSettings = () => read('settings', null);
export const saveSettings = (s) => write('settings', s);

export function clearAll() {
  for (const k of Object.keys(memory)) delete memory[k];
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k);
  } catch { /* blocked */ }
}
