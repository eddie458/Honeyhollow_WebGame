// Tutorial guidance: a bobbing arrow that points at the next thing to click
// (a building, the Build button, a menu card) plus the goal giver's speech.
import { content } from '../sim/content';
import { sortedActiveGoals, taskDone } from '../sim/goals';
import { el, ico } from './dom';
import { t } from './i18n';

export interface HintResolver {
  /** Screen position (CSS px) of a hint target, or null if not visible. */
  locate(target: string): { x: number; y: number } | null;
  /** True while a dialog/popup covers the city. */
  busy(): boolean;
}

export class Hints {
  private arrow: HTMLElement;
  private bubble: HTMLElement;
  private text: HTMLElement;
  private who: HTMLElement;
  private portrait: HTMLElement;
  private target: string | null = null;
  private forced: string | null = null;
  private dismissedGoal: string | null = null;
  private goalId: string | null = null;
  private timer = 0;
  enabled = true;

  constructor(private resolver: HintResolver) {
    this.arrow = el('div', { class: 'hintarrow hidden', 'aria-hidden': 'true' });
    this.arrow.innerHTML = `<svg viewBox="0 0 64 64" width="56" height="56"><path d="M32 60 L10 34 h14 V6 h16 v28 h14z" fill="#ffd23f" stroke="#3b2a1e" stroke-width="4" stroke-linejoin="round"/></svg>`;
    this.text = el('div');
    this.who = el('div', { class: 'who' });
    this.portrait = el('div', { class: 'portrait' });
    const close = el('button', { type: 'button', class: 'close', 'aria-label': t('dlg.close') }, ico('close'));
    close.addEventListener('click', () => {
      this.dismissedGoal = this.goalId;
      this.hide();
    });
    this.bubble = el('div', { class: 'hintbubble hidden', role: 'note' }, this.portrait, el('div', { style: 'flex:1' }, this.who, this.text), close);
    document.body.append(this.arrow, this.bubble);
    this.timer = window.setInterval(() => this.position(), 120);
  }

  /** Point at a target chosen by the player ("Show me" in a goal). */
  force(target: string | null): void {
    this.forced = target;
    if (target) this.dismissedGoal = null;
  }

  /** Recomputes the current tutorial hint from the active goals. */
  update(state: Parameters<typeof sortedActiveGoals>[0], uiBusy: boolean): void {
    if (!this.enabled) return this.hide();
    let target = this.forced;
    let goalId: string | null = null;
    const goals = sortedActiveGoals(state);
    const tut = goals.find((g) => content().goals[g.id]?.tutorial);
    if (tut) {
      const def = content().goals[tut.id]!;
      const task = def.tasks.find((x) => !taskDone(state, tut, x));
      goalId = tut.id;
      if (!target && task?.hint) target = task.hint;
    }
    if (!target && !this.forced) return this.hide();
    this.goalId = goalId;
    if (goalId && goalId === this.dismissedGoal && !this.forced) return this.hide();
    this.target = target;
    if (goalId) {
      const def = content().goals[goalId]!;
      if (this.portrait.dataset.char !== def.char) {
        this.portrait.replaceChildren(ico(def.char));
        this.portrait.dataset.char = def.char;
      }
      this.who.textContent = `${t(`char.${def.char}`)} · ${t(`goal.${goalId}.title`)}`;
      this.text.textContent = t(`goal.${goalId}.text`);
    } else {
      this.text.textContent = '';
    }
    this.bubble.classList.toggle('hidden', !goalId || uiBusy);
    this.position();
  }

  hide(): void {
    this.target = null;
    this.arrow.classList.add('hidden');
    this.bubble.classList.add('hidden');
  }

  private position(): void {
    if (!this.target) return;
    if (this.resolver.busy()) this.bubble.classList.add('hidden');
    else if (this.goalId && this.goalId !== this.dismissedGoal && this.enabled && this.text.textContent) this.bubble.classList.remove('hidden');
    const p = this.resolver.locate(this.target);
    if (!p) {
      this.arrow.classList.add('hidden');
      return;
    }
    this.arrow.style.left = `${p.x - 28}px`;
    this.arrow.style.top = `${p.y - 62}px`;
    this.arrow.classList.remove('hidden');
  }

  destroy(): void {
    clearInterval(this.timer);
    this.arrow.remove();
    this.bubble.remove();
  }
}
