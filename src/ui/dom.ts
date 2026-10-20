// Minimal DOM helpers (no framework). Text is always set via textContent, so
// player-provided strings (city/shop names) can never inject markup.
import { icon } from '../art/icons';

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined | ((e: Event) => void)>;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === 'class') {
        node.className = String(v);
      } else if (k === 'text') {
        node.textContent = String(v);
      } else if (k === 'html') {
        // Only ever used with our own static SVG icon markup.
        node.innerHTML = String(v);
      } else if (v === true) {
        node.setAttribute(k, '');
      } else {
        node.setAttribute(k, String(v));
      }
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

/** An inline SVG icon wrapped in a span. */
export function ico(name: string, cls = 'ico'): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = cls;
  s.innerHTML = icon(name);
  return s;
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function $(sel: string, root: ParentNode = document): HTMLElement {
  const n = root.querySelector(sel);
  if (!n) throw new Error(`Missing element ${sel}`);
  return n as HTMLElement;
}

export function button(label: string | Node, onClick: () => void, cls = 'btn', attrs?: Attrs): HTMLButtonElement {
  return el('button', { type: 'button', class: cls, onclick: (e: Event) => { e.stopPropagation(); onClick(); }, ...attrs }, label);
}
