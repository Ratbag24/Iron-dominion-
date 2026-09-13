// Entry point: the start menu, then the game itself.

import { Game } from './client/game.js';

const state = {
  faction: 'vanguard',
  difficulty: 'normal',
  seed: 1,
};

let game = null;

function bindOptionGroup(id, key) {
  const group = document.getElementById(id);
  group.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.opt');
    if (!btn) return;
    for (const b of group.querySelectorAll('.opt')) b.classList.remove('active');
    btn.classList.add('active');
    state[key] = btn.dataset.value;
  });
}

function startGame() {
  const menu = document.getElementById('menu');
  const loading = document.getElementById('loading');
  const seedField = document.getElementById('seed-input');

  const raw = (seedField.value || '1').trim();
  // Any text works as a seed; hash non-numeric input so words are usable too.
  let seed = Number(raw);
  if (!Number.isFinite(seed)) {
    seed = 0;
    for (let i = 0; i < raw.length; i++) seed = (seed * 31 + raw.charCodeAt(i)) >>> 0;
  }
  state.seed = seed >>> 0;

  menu.classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');
  loading.classList.remove('hidden');

  // Let the browser paint the loading state before the heavy work starts.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (game) game.destroy();
    try {
      game = new Game(
        document.getElementById('game-canvas'),
        document.getElementById('overlay'),
        {
          seed: state.seed,
          faction: state.faction,
          enemyFaction: state.faction === 'vanguard' ? 'legion' : 'vanguard',
          difficulty: state.difficulty,
        }
      );
      window.game = game; // handy for debugging and for the smoke test
      game.start();
      game.flashMessage('Build metal extractors on the marked spots');
    } catch (err) {
      loading.textContent = 'FAILED TO START: ' + err.message;
      console.error(err);
      throw err;
    }
    loading.classList.add('hidden');
  }));
}

function init() {
  bindOptionGroup('opt-faction', 'faction');
  bindOptionGroup('opt-difficulty', 'difficulty');

  document.getElementById('btn-random-seed').onclick = () => {
    document.getElementById('seed-input').value = String(Math.floor(Math.random() * 99999) + 1);
  };
  document.getElementById('btn-start').onclick = startGame;
  document.getElementById('btn-again').onclick = () => {
    document.getElementById('gameover').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
  };

  document.getElementById('seed-input').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') startGame();
  });
}

init();
