# Quintle

A daily five-letter word puzzle. You get six tries to find the hidden word, and after each guess the tiles show how close you were. Everyone gets the same word each day, and a new one arrives at midnight.

Plain HTML, CSS and JavaScript with no build step and nothing to install. It works offline once loaded and can be installed to a phone's home screen.

## Play online
**https://vocal101.github.io/quintle/** runs in the browser with nothing to install.

On a phone, use your browser's **Add to Home Screen** to install it like an app.

## Download and play offline
The game uses JavaScript modules, which browsers won't load from a double-clicked file, so it needs a tiny local web server:

1. At the top of this page, click the green **Code** button, then **Download ZIP**, and unzip it.
2. Open a terminal in the unzipped folder and run `python -m http.server 8774`.
3. Visit http://localhost:8774

If you use git: `git clone https://github.com/Vocal101/quintle.git`, then follow steps 2 and 3.

Progress, stats and settings save in your browser.

## How to play

- Type a five-letter word and press **Enter**. It has to be a real word.
- **Green**: the letter is in the word and in the right spot.
- **Yellow**: the letter is in the word but in a different spot.
- **Grey**: the letter isn't in the word.
- The on-screen keyboard keeps track of which letters you've learned about.
- Win in six guesses or fewer. Then share your result grid (it never gives away the word) and come back tomorrow.

### Settings

- **Hard Mode**: every hint you find has to be used in later guesses. Green letters must stay in place, and yellow letters must be included. It can only be switched on before your first guess of the day.
- **Dark Theme**
- **High Contrast Mode**: orange and blue instead of green and yellow, for colour-blind players.

### Controls

| Action | Input |
| --- | --- |
| Type a letter | A–Z keys or the on-screen keyboard |
| Delete a letter | Backspace |
| Submit a guess | Enter |
| Close a window | Esc, the X, or clicking outside it |

## For developers

```
js/game.js      rules: evaluation, hard mode, daily word, stats, share text (no DOM)
js/ui.js        board, keyboard, animations, toasts, dialogs
js/main.js      game controller, input, persistence, ?dev harness
js/storage.js   localStorage wrapper that tolerates blocked storage
js/words.js     word lists (generated)
sw.js           offline cache
```

Run the checks with Node 18 or newer:

```
node scripts/verify-words.mjs
node tests/game.test.mjs
```

`scripts/build-words.mjs` regenerates `js/words.js` from `scripts/raw/answers.txt` (2,315 answers in daily order) and `scripts/raw/allowed.txt` (10,657 extra accepted guesses). `scripts/make-icons.py` redraws the app icons (needs Pillow).

Open `index.html?dev` for a test harness in the console. `T.setAnswer('crane')` starts a game with that answer, `T.setDay(n)` loads puzzle `n`, `T.win()`, `T.lose()` and `T.guess(word)` play through the real input path, `T.instant()` speeds up animations, `T.state()` shows everything, `T.resetStats()` clears stats and `T.reset()` wipes all saved data. The service worker doesn't register in dev mode.

When you change any file, bump `VERSION` in `sw.js` so installed copies pick up the update.

### Deploying to GitHub Pages
Push to `main`, then in the repository go to **Settings → Pages**, set the source to **Deploy from a branch**, and pick `main` and `/ (root)`. The site goes live at `https://<user>.github.io/<repo>/` about a minute later.

## Credits

- Game design after the original daily word game by Josh Wardle. Quintle is an independent fan remake with no affiliation to the New York Times.
- Word lists are the original game's answer and guess lists, as collected publicly by cfreshman.
- Clear Sans font by Intel, Apache License 2.0 (`fonts/LICENSE.txt`).
- Icons from Google's Material Icons, Apache License 2.0.
