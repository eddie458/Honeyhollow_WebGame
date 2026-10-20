// Developer-only "skip time" button for `npm run dev`. main.ts imports this
// module only when import.meta.env.DEV is true, so production builds never
// contain it. The text is English-only on purpose: it is a testing tool, not
// game UI, and keeping it out of the strings file keeps it out of the build.
import type { Controller } from '../game/controller';
import { awaySummary } from '../game/away';
import { advance, cropStage, dayKey, shipReady, trainReady, type GameState } from '../sim';
import { shiftTime } from '../sim/timeskip';
import { button, el } from '../ui/dom';
import { toast } from '../ui/overlay';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const STEPS: { label: string; ms: number }[] = [
  { label: '5 min', ms: 5 * MIN },
  { label: '15 min', ms: 15 * MIN },
  { label: '1 hour', ms: HOUR },
  { label: '4 hours', ms: 4 * HOUR },
  { label: '8 hours', ms: 8 * HOUR },
  { label: '1 day', ms: DAY },
];

/** Time-of-day previews (hour of the day; null = back to the Day and night setting). */
const HOURS: { label: string; hour: number | null }[] = [
  { label: 'Auto', hour: null },
  { label: 'Dawn', hour: 6.2 },
  { label: 'Noon', hour: 12 },
  { label: 'Dusk', hour: 19.6 },
  { label: 'Night', hour: 23 },
];

const ICON =
  '<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">' +
  '<path d="M8 15 L31 32 L8 49 Z M33 15 L56 32 L33 49 Z" fill="#7ecbe8" stroke="#3b2a1e" stroke-width="4" stroke-linejoin="round"/></svg>';

const CSS = `
.devskip { position: relative; }
.devskip > .roundbtn { border-style: dashed; }
.devskip-tag {
  position: absolute; left: 50%; bottom: -7px; transform: translateX(-50%);
  padding: 0 5px; border-radius: 6px; background: var(--ink); color: #fff;
  font-size: 10px; font-weight: 700; letter-spacing: 0.5px; line-height: 15px; pointer-events: none;
}
.devskip-menu {
  position: fixed; z-index: 90; width: 256px; max-width: calc(100vw - 80px); max-height: calc(100vh - 16px); overflow: auto;
  padding: 10px 12px 12px; background: var(--cream); border: 3px solid var(--ink); border-radius: 14px; box-shadow: var(--shadow);
  color: var(--ink); text-align: left;
}
.devskip-menu[hidden] { display: none; }
.devskip-menu h3 { margin: 0 0 8px; font-size: 16px; }
.devskip-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.devskip-grid button {
  padding: 7px 2px; border: 2px solid var(--ink); border-radius: 10px; background: #fff;
  color: var(--ink); font: 600 14px var(--font); cursor: pointer;
}
.devskip-grid button:hover { background: var(--honey-light); }
.devskip-grid button:active { transform: translateY(1px); }
.devskip-menu p { margin: 8px 0 0; font-size: 12px; line-height: 1.35; color: var(--ink-soft); }
.devskip-menu h3 + .devskip-hours, .devskip-menu p + h3 { margin-top: 10px; }
.devskip-hours { grid-template-columns: repeat(5, 1fr); }
.devskip-hours button { font-size: 12px; padding: 6px 0; }
`;

export function mountTimeSkip(ctrl: Controller): void {
  const row = ctrl.hud.root.querySelector('.iconrow');
  if (!row || row.querySelector('.devskip')) return;
  document.head.append(el('style', { text: CSS }));

  const menu = el(
    'div',
    { class: 'devskip-menu interactive', id: 'devskip-menu', role: 'group', 'aria-label': 'Skip time', hidden: true },
    el('h3', { text: 'Skip time (dev only)' }),
    el(
      'div',
      { class: 'devskip-grid' },
      ...STEPS.map((st) =>
        button(`+${st.label}`, () => {
          close();
          skip(ctrl, st.label, st.ms);
        }, ''),
      ),
    ),
    el('p', {
      text: 'Ages every timer as if you had been away. Long skips can wither ripe crops unless "Crops never wither" is on in Settings. +1 day also starts a new day (daily bonus, neighbor visits and help limits).',
    }),
    el('h3', { text: 'Preview time of day' }),
    el(
      'div',
      { class: 'devskip-grid devskip-hours' },
      ...HOURS.map((h) =>
        button(h.label, () => {
          ctrl.scene.previewHour(h.hour);
          toast(h.hour === null ? 'Time of day follows the Day and night setting again.' : `Previewing ${h.label.toLowerCase()}.`, 'info');
        }, ''),
      ),
    ),
  );
  const toggle = button(el('span', { class: 'ico', html: ICON }), () => (menu.hidden ? open() : close()), 'roundbtn', {
    'aria-label': 'Skip time (developer tool)',
    title: 'Skip time (dev only)',
    'aria-expanded': 'false',
    'aria-controls': 'devskip-menu',
  });
  const wrap = el('div', { class: 'devskip' }, toggle, el('span', { class: 'devskip-tag', text: 'DEV' }));
  row.append(wrap);
  // the menu lives on the page itself so no HUD panel can cover it
  document.body.append(menu);

  function open(): void {
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    const r = toggle.getBoundingClientRect();
    menu.style.right = `${Math.max(8, innerWidth - r.left + 10)}px`;
    menu.style.top = `${Math.max(8, Math.min(r.top, innerHeight - menu.offsetHeight - 8))}px`;
  }
  function close(): void {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as Node;
    if (!menu.hidden && !wrap.contains(t) && !menu.contains(t)) close();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) close();
  });
}

/** Ages the player's city by `ms` and reports what finished meanwhile. */
function skip(ctrl: Controller, label: string, ms: number): void {
  if (ctrl.visiting) {
    toast('Go home first: the time skip only works in your own city.', 'bad');
    return;
  }
  const now = ctrl.now();
  const before = advance(ctrl.state, now);
  const after = advance(shiftTime(before, ms), now);
  ctrl.state = after;
  ctrl.index.rebind(after);
  // A new day: the NPC neighbors drop by with gifts and help, as after a reload.
  if (ms >= DAY) ctrl.dispatch({ t: 'npcDaily', day: dayKey(now, ctrl.tz), helps: true }, { quiet: true });
  ctrl.saveNow();
  ctrl.pushScene(false);
  ctrl.refreshUi();
  const lines = [...awaySummary(before, ctrl.state, ms), ...extraLines(before, ctrl.state)];
  toast(lines.length ? `Skipped ${label}: ${lines.join(', ')}.` : `Skipped ${label}. Nothing new finished yet.`, 'good', undefined, 6000);
}

/** Things the regular welcome-back summary leaves out. */
function extraLines(before: GameState, after: GameState): string[] {
  let withered = 0;
  let boats = 0;
  for (const k in after.objects) {
    const a = after.objects[k]!;
    const b = before.objects[k];
    if (!b) continue;
    if (a.crop && cropStage(after, a, after.now) === 'withered' && cropStage(before, b, before.now) !== 'withered') withered++;
    (a.ships ?? []).forEach((_, i) => {
      if (shipReady(a, i, after.now) && !shipReady(b, i, before.now)) boats++;
    });
  }
  const lines: string[] = [];
  if (withered) lines.push(withered === 1 ? '1 crop withered' : `${withered} crops withered`);
  if (boats) lines.push(boats === 1 ? '1 boat is back' : `${boats} boats are back`);
  if (trainReady(after, after.now) && !trainReady(before, before.now)) lines.push('the train is back');
  return lines;
}
