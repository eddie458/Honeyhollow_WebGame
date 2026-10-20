// Modal dialogs: stackable, Esc/close button/backdrop to dismiss, focus is
// trapped inside and restored afterwards.
import { button, el, ico } from './dom';
import { t } from './i18n';

export interface DialogOpts {
  title: string;
  icon?: string;
  body: Node | Node[];
  actions?: { label: string; onClick: () => void; cls?: string; icon?: string; close?: boolean; disabled?: boolean }[];
  size?: 'normal' | 'mid' | 'wide';
  onClose?: () => void;
  /** Clicking the backdrop closes (default true). */
  dismissable?: boolean;
  id?: string;
}

export interface DialogHandle {
  close(): void;
  root: HTMLElement;
  body: HTMLElement;
  setBody(n: Node | Node[]): void;
}

const stack: { handle: DialogHandle; opts: DialogOpts; prevFocus: Element | null }[] = [];

export function openDialog(opts: DialogOpts): DialogHandle {
  const host = document.getElementById('dialogs')!;
  if (opts.id) {
    const existing = stack.find((d) => d.opts.id === opts.id);
    if (existing) existing.handle.close();
  }
  const body = el('div', { class: 'body' });
  const titleId = `dlg-${Math.random().toString(36).slice(2, 8)}`;
  const header = el('header', null, opts.icon ? ico(opts.icon) : null, el('h2', { id: titleId, text: opts.title }));
  const footer = el('footer');
  const dialog = el('div', { class: `dialog ${opts.size === 'wide' ? 'wide' : opts.size === 'mid' ? 'mid' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId }, header, body);
  const scrim = el('div', { class: 'scrim' }, dialog);
  let closed = false;
  const handle: DialogHandle = {
    root: scrim,
    body,
    close() {
      if (closed) return;
      closed = true;
      scrim.remove();
      const i = stack.findIndex((d) => d.handle === handle);
      const entry = stack[i];
      if (i >= 0) stack.splice(i, 1);
      opts.onClose?.();
      const prev = entry?.prevFocus;
      if (prev instanceof HTMLElement && document.contains(prev)) prev.focus();
    },
    setBody(n) {
      body.replaceChildren(...(Array.isArray(n) ? n : [n]));
    },
  };
  const x = el('button', { type: 'button', class: 'x', 'aria-label': t('a11y.closeDialog') }, ico('close'));
  x.addEventListener('click', () => handle.close());
  dialog.append(x);
  handle.setBody(opts.body);
  if (opts.actions?.length) {
    for (const a of opts.actions) {
      const b = button(a.icon ? el('span', null, ico(a.icon), a.label) : a.label, () => {
        a.onClick();
        if (a.close !== false) handle.close();
      }, `btn ${a.cls ?? ''}`);
      if (a.disabled) b.disabled = true;
      footer.append(b);
    }
    dialog.append(footer);
  }
  scrim.addEventListener('pointerdown', (e) => {
    if (e.target === scrim && opts.dismissable !== false) handle.close();
  });
  scrim.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') trapFocus(dialog, e);
  });
  stack.push({ handle, opts, prevFocus: document.activeElement });
  host.append(scrim);
  // focus the first actionable element (primary button preferred)
  requestAnimationFrame(() => {
    const first = (footer.querySelector('button:not([disabled])') ?? dialog.querySelector('button, input, [tabindex]')) as HTMLElement | null;
    first?.focus({ preventScroll: true });
  });
  return handle;
}

function trapFocus(root: HTMLElement, e: KeyboardEvent): void {
  const items = Array.from(root.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')).filter((n) => !n.hasAttribute('disabled'));
  if (items.length === 0) return;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function closeTopDialog(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  if (top.opts.dismissable === false) return true;
  top.handle.close();
  return true;
}

export function anyDialogOpen(): boolean {
  return stack.length > 0;
}

export function closeAllDialogs(): void {
  while (stack.length) stack[stack.length - 1]!.handle.close();
}

export function isOpen(id: string): boolean {
  return stack.some((d) => d.opts.id === id);
}

export function confirmDialog(title: string, text: string, yes: string, onYes: () => void, danger = false): void {
  openDialog({
    title,
    body: el('p', { text }),
    actions: [
      { label: t('dlg.cancel'), onClick: () => {}, cls: 'plain' },
      { label: yes, onClick: onYes, cls: danger ? 'red' : '' },
    ],
  });
}
