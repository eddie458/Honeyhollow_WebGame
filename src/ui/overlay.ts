// Toasts, the hover tooltip, flying reward icons and the level-up burst.
import { el, ico } from './dom';

// ---------------------------------------------------------------- toasts --

export function toast(text: string, kind: 'info' | 'good' | 'bad' = 'info', iconName?: string, ms = 2800): void {
  const host = document.getElementById('toasts');
  if (!host) return;
  while (host.children.length >= 4) host.firstElementChild?.remove();
  const node = el('div', { class: `toast ${kind}`, role: 'status' }, iconName ? ico(iconName) : null, el('span', { text }));
  host.append(node);
  setTimeout(() => {
    node.classList.add('out');
    setTimeout(() => node.remove(), 350);
  }, ms);
}

// --------------------------------------------------------------- tooltip --

let tipNode: HTMLElement | null = null;

export function showTip(lines: (string | { bar: number })[], x: number, y: number): void {
  tipNode ??= document.getElementById('tooltip');
  if (!tipNode) return;
  tipNode.replaceChildren();
  lines.forEach((l, i) => {
    if (typeof l === 'string') {
      tipNode!.append(i === 0 ? el('b', { text: l }) : el('div', { text: l }));
    } else {
      tipNode!.append(el('div', { class: 'bar' }, el('div', { style: `width:${Math.round(Math.max(0, Math.min(1, l.bar)) * 100)}%` })));
    }
  });
  const w = 260;
  const left = Math.min(x, window.innerWidth - w - 24);
  const top = Math.min(y, window.innerHeight - 120);
  tipNode.style.left = `${left}px`;
  tipNode.style.top = `${top}px`;
  tipNode.classList.remove('hidden');
}

export function hideTip(): void {
  tipNode ??= document.getElementById('tooltip');
  tipNode?.classList.add('hidden');
}

// -------------------------------------------------------- flying rewards --

/** Animates an icon from a screen point to a HUD element, then calls done. */
export function flyTo(iconName: string, fromX: number, fromY: number, target: Element | null, done: () => void, reduced = false): void {
  const host = document.getElementById('fly');
  if (!host || !target || reduced) {
    done();
    return;
  }
  const r = target.getBoundingClientRect();
  const tx = r.left + Math.min(28, r.width / 2);
  const ty = r.top + r.height / 2;
  const node = el('div', { class: 'flyer' }, ico(iconName));
  node.style.left = `${fromX}px`;
  node.style.top = `${fromY}px`;
  host.append(node);
  const dx = tx - fromX;
  const dy = ty - fromY;
  const lift = Math.min(120, Math.abs(dy) * 0.4 + 40);
  const anim = node.animate(
    [
      { transform: 'translate(0,0) scale(1)' },
      { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - lift}px) scale(1.15)`, offset: 0.4 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.7)` },
    ],
    { duration: 620 + Math.random() * 160, easing: 'cubic-bezier(.45,.05,.55,.95)' },
  );
  anim.onfinish = () => {
    node.remove();
    done();
  };
  anim.oncancel = () => {
    node.remove();
    done();
  };
}

export function bumpHud(target: Element | null): void {
  if (!target) return;
  target.classList.remove('bump');
  void (target as HTMLElement).offsetWidth;
  target.classList.add('bump');
}

export function levelBurst(reduced: boolean): void {
  if (reduced) return;
  const host = el('div', { class: 'levelburst' });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const d = 160 + Math.random() * 120;
    const node = el('i', { style: `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;animation-delay:${Math.random() * 0.15}s` }, ico(i % 3 === 0 ? 'xp' : i % 3 === 1 ? 'star' : 'coin'));
    host.append(node);
  }
  document.body.append(host);
  setTimeout(() => host.remove(), 1500);
}
