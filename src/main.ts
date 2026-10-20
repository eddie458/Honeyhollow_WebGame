// Boot: draw the art, load (or create) the city, fast-forward the time spent
// away, then start Phaser and the HUD.
import '@fontsource-variable/fredoka';
import './styles/main.css';
import Phaser from 'phaser';
import { SpriteBank } from './art/atlas';
import { generateAll, generateLights } from './art/index';
import { Controller } from './game/controller';
import { CityScene } from './render/CityScene';
import { loadLocalSave, loadPrefs } from './save/storage';
import { advance, createNewGame } from './sim';
import { awaySummary } from './game/away';
import { guardTabs } from './game/tabguard';
import { setupEvents } from './game/events';
import { t } from './ui/i18n';
import { openWelcomeBack } from './ui/panels';
import { toast } from './ui/overlay';

async function boot(): Promise<void> {
  const bar = document.getElementById('boot-fill');
  const msg = document.getElementById('boot-msg');
  const setProgress = (p: number) => {
    if (bar) bar.style.width = `${Math.round(p * 100)}%`;
    if (msg) msg.textContent = t('app.loadingArt', { pct: Math.round(p * 100) });
  };
  if (msg) msg.textContent = t('app.loading');
  setupEvents();
  const prefs = loadPrefs();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // The atlas is drawn at 1x so the game starts fast; sprites on screen are
  // redrawn sharper when the camera (or a high-DPI screen) needs more detail.
  const res = 1;
  try {
    await Promise.race([document.fonts.load('600 16px "Fredoka Variable"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* fall back to system font */
  }
  const bank = new SpriteBank(res);
  const t0 = performance.now();
  await generateAll(bank, setProgress);
  console.info(`[honeyhollow] art generated in ${Math.round(performance.now() - t0)} ms (res ${res}, ${bank.frames.size + 0} frames pending pack)`);

  const now = Date.now();
  const loaded = loadLocalSave(now);
  const firstRun = !loaded.state;
  const saved = loaded.state ?? createNewGame(now);
  const state = advance(saved, now);
  const away = firstRun ? [] : awaySummary(saved, state);

  const ctrl = new Controller(state, prefs, bank);
  ctrl.mountUi(document.getElementById('app')!);
  // one city, one tab: a newer tab sends this one to sleep
  guardTabs(() => ctrl.sleep());

  const w = window.innerWidth;
  const h = window.innerHeight;
  let game: Phaser.Game;
  try {
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      backgroundColor: '#6aae3c',
      scale: { mode: Phaser.Scale.NONE, width: Math.round(w * dpr), height: Math.round(h * dpr), zoom: 1 / dpr },
      // mipmaps keep zoomed-out views smooth instead of shimmering
      render: { antialias: true, powerPreference: 'high-performance', roundPixels: false, mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
      input: { activePointers: 3 },
      banner: false,
      audio: { noAudio: true },
      disableContextMenu: true,
    });
  } catch {
    if (msg) msg.textContent = t('app.noWebgl');
    return;
  }
  game.registry.set('dpr', dpr);
  const tScene = performance.now();
  const scene = new CityScene(bank, (sc) => {
    console.info(`[honeyhollow] scene ready in ${Math.round(performance.now() - tScene)} ms`);
    // time from opening the page to a playable city (see the Performance panel)
    performance.mark('honeyhollow-playable');
    ctrl.attachScene(sc);
    ctrl.applyPrefs();
    ctrl.start(firstRun);
    document.getElementById('boot')?.classList.add('done');
    setTimeout(() => document.getElementById('boot')?.remove(), 700);
    if (away.length) setTimeout(() => openWelcomeBack(away), 600);
    if (loaded.error === 'restoredBackup') toast(t('msg.imported'), 'info');
    // night layers (lit windows, lamps) are drawn in the background once the game runs
    void generateLights(bank).then(() => sc.addArt(bank.pack('lit')));
    // after the first visit the game also starts offline (real builds only)
    if (import.meta.env.PROD && 'serviceWorker' in navigator) void navigator.serviceWorker.register('sw.js').catch(() => {});
    // Testing aid for `npm run dev` only. Vite turns import.meta.env.DEV into
    // `false` for production builds, so this import (and its chunk) is dropped.
    if (import.meta.env.DEV) void import('./dev/timeSkip').then((m) => m.mountTimeSkip(ctrl));
  });
  game.scene.add('city', scene, true);

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      game.scale.resize(Math.round(window.innerWidth * dpr), Math.round(window.innerHeight * dpr));
      game.scale.setZoom(1 / dpr);
    }, 60);
  });
  (window as unknown as { honeyhollow?: unknown }).honeyhollow = { ctrl, game };
}

void boot();
