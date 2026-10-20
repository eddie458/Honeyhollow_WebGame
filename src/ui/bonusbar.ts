// The bonus bar (combo meter): every reward pickup within 6 seconds of the
// previous one keeps the streak alive through 10 named stages. When the streak
// is about to end the bar glows red; when it ends the bonus is cashed out.
import { content } from '../sim/content';
import { bonusStage } from '../sim/actions';
import { el } from './dom';
import { t } from './i18n';

export class BonusBar {
  readonly node: HTMLElement;
  private label: HTMLElement;
  private fill: HTMLElement;
  private dots: HTMLElement[] = [];
  private pickups = 0;
  private last = 0;
  private timer: number | null = null;

  constructor(private onPayout: (pickups: number) => void, private onStage: (stage: number) => void) {
    this.label = el('div', { class: 'label', 'aria-live': 'polite' });
    this.fill = el('div');
    const dots = el('div', { class: 'stagedots', 'aria-hidden': 'true' });
    for (let i = 0; i < 10; i++) {
      const d = el('i');
      this.dots.push(d);
      dots.append(d);
    }
    this.node = el('div', { class: 'bonusbar hidden', role: 'status', 'aria-label': t('bonus.label') }, this.label, el('div', { class: 'meter' }, this.fill), dots);
  }

  /** Register one collected reward pickup. */
  pickup(): void {
    const b = content().balance.bonusBar;
    const now = performance.now();
    if (this.pickups > 0 && now - this.last > b.window * 1000) this.finish();
    const before = bonusStage(this.pickups);
    this.pickups++;
    this.last = now;
    const after = bonusStage(this.pickups);
    if (after > before) this.onStage(after);
    this.render();
    this.node.classList.remove('hidden', 'warn');
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), 200);
  }

  get count(): number {
    return this.pickups;
  }

  private tick(): void {
    const b = content().balance.bonusBar;
    const left = b.window * 1000 - (performance.now() - this.last);
    if (left <= 0) {
      this.finish();
      return;
    }
    this.node.classList.toggle('warn', left < b.warn * 1000);
  }

  private finish(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const n = this.pickups;
    this.pickups = 0;
    this.node.classList.remove('warn');
    if (bonusStage(n) > 0) {
      this.onPayout(n);
      this.node.classList.add('paid');
      setTimeout(() => {
        this.node.classList.remove('paid');
        if (this.pickups === 0) this.node.classList.add('hidden');
      }, 1400);
    } else {
      this.node.classList.add('hidden');
    }
  }

  private render(): void {
    const stages = content().balance.bonusBar.stages;
    const stage = bonusStage(this.pickups);
    let need = 0;
    for (let i = 0; i < stage; i++) need += stages[i]!;
    const nextSize = stages[stage] ?? stages[stages.length - 1]!;
    const into = this.pickups - need;
    this.fill.style.width = `${stage >= stages.length ? 100 : Math.round((into / nextSize) * 100)}%`;
    this.label.textContent = stage > 0 ? t(`bonus.stage${stage}`) : `${this.pickups}/${stages[0]}`;
    this.dots.forEach((d, i) => d.classList.toggle('on', i < stage));
  }
}
