// Online features through the optional PHP API: accounts, cloud saves with a
// conflict check, friend codes and invite links, visiting friends, help,
// gifts, job requests and the weekly leaderboard. Without the API (or offline)
// everything here quietly stays in guest mode.
import charactersJson from '../data/characters.json';
import { api, apiAvailable, setCsrf, type ApiUser } from '../net/api';
import { readSave, saveVersion, wrapSave, WorldIndex, type GameState, type Gift, type HelpAction, type PendingHelp } from '../sim';
import { confirmDialog, openDialog, type DialogHandle } from '../ui/dialog';
import { button, el, ico } from '../ui/dom';
import { fmt, t } from '../ui/i18n';
import { toast } from '../ui/overlay';
import type { Neighbor } from '../ui/types';
import type { Controller } from './controller';
import { Franchises, type LotFranchise } from './franchises';
import type { Social, Visit } from './social';

interface Friend {
  id: number;
  username: string;
  avatar: string;
  cityName: string;
  level: number;
  helpsLeft: number;
  giftSent: boolean;
  wishlist: string[];
}

interface InboxHelp {
  id: number;
  from: number;
  objectId: number;
  action: HelpAction;
  at: number;
}

interface InboxGift {
  id: number;
  from: number;
  reward: Gift['reward'];
  at: number;
}

interface InboxJob {
  id: number;
  from: number;
  objectId: number;
  item: string;
  username?: string;
}

interface InboxStaffed {
  id: number;
  from: number;
  objectId: number;
}

const AVATARS = (charactersJson as { avatars: string[] }).avatars;
const USERNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;

export const GIFT_CHOICES: { id: string; icon: string }[] = [
  { id: 'energy', icon: 'energy' },
  { id: 'goods', icon: 'goods' },
  { id: 'coins', icon: 'coin' },
  { id: 'volunteer', icon: 'volunteer' },
  { id: 'wish', icon: 'collections' },
];

export class Online {
  user: ApiUser | null = null;
  friends: Friend[] = [];
  private dirty = false;
  private lastSave = 0;
  private lastInbox = 0;
  private saving = false;
  private conflictOpen = false;
  private pendingInvite: string | null = null;
  private jobs: InboxJob[] = [];
  readonly franchises: Franchises;

  constructor(private ctrl: Controller, private social: Social) {
    const self = this;
    this.franchises = new Franchises(ctrl, {
      get loggedIn() {
        return self.user !== null;
      },
      username: () => self.user?.username ?? '',
      avatar: () => self.user?.avatar ?? 'account',
      needsAccount: () => self.social.needsAccount(),
    });
    try {
      const code = new URL(location.href).searchParams.get('invite');
      if (code && /^[A-Z0-9-]{4,16}$/i.test(code)) this.pendingInvite = code.toUpperCase();
    } catch {
      /* ignore */
    }
  }

  get loggedIn(): boolean {
    return this.user !== null;
  }

  /** Called once after the game has started; never blocks play. */
  async init(): Promise<void> {
    const r = await api<{ user: ApiUser | null; csrf: string }>('session');
    if (!r.ok) {
      if (this.pendingInvite) toast(t('online.inviteNeedsServer'), 'info', 'friends', 5000);
      return;
    }
    setCsrf(r.csrf);
    if (r.user) {
      this.user = r.user;
      await this.syncOnLogin();
      await this.refresh();
    }
    if (this.pendingInvite) this.handleInvite();
  }

  tick(now: number): void {
    if (!this.user) return;
    if (this.dirty && !this.saving && now - this.lastSave > 60_000) void this.upload(false);
    if (now - this.lastInbox > 90_000 && !this.social.visiting) {
      this.lastInbox = now;
      void this.refresh();
    }
  }

  // ------------------------------------------------------------ cloud save

  cloudSave(_s: GameState, urgent = false): void {
    if (!this.user) return;
    this.dirty = true;
    if (urgent) void this.upload(true);
  }

  private async upload(keepalive: boolean, force = false): Promise<void> {
    if (!this.user || this.saving || this.conflictOpen || this.ctrl.asleep) return;
    this.saving = true;
    this.dirty = false;
    const prefs = this.ctrl.prefs;
    const now = this.ctrl.now();
    // Stamp the upload with this device and a counter, and remember it before
    // sending: an upload made while the page closes can land without its reply
    // ever arriving, and the next start must still recognise it as ours.
    prefs.cloudSeq += 1;
    this.ctrl.savePrefs();
    const save = { ...wrapSave(this.ctrl.state, now), device: prefs.deviceId, seq: prefs.cloudSeq };
    const body = { save, baseRev: prefs.cloudUser === this.user.id ? prefs.cloudRev : 0, force };
    const r = await api<{ rev: number }>('save_put', body, { keepalive });
    this.saving = false;
    this.lastSave = now;
    if (r.ok) {
      prefs.cloudRev = r.rev;
      prefs.cloudUser = this.user.id;
      this.ctrl.savePrefs();
      return;
    }
    if (r.error === 'conflict') {
      this.dirty = true;
      const info = r as unknown as { level: number; cityName: string; savedAt: number; rev: number; device?: string };
      if (info.device === prefs.deviceId && prefs.cloudUser === this.user.id) {
        // the newer cloud copy is one of our own uploads whose reply got lost
        prefs.cloudRev = info.rev;
        this.ctrl.savePrefs();
        this.lastSave = 0;
        return;
      }
      this.showConflict(info);
    } else if (r.error === 'sanity') {
      toast(t('online.saveRejected'), 'bad', 'warning', 6000);
    } else if (r.error === 'auth') {
      this.user = null;
      this.ctrl.refreshUi();
    } else {
      this.dirty = true; // offline: try again later
    }
  }

  /** After logging in: decide between the cloud save and this device's city. */
  private async syncOnLogin(): Promise<void> {
    if (!this.user) return;
    const r = await api<{ save: unknown; rev: number; savedAt: number }>('save_get');
    if (!r.ok) return;
    const prefs = this.ctrl.prefs;
    if (!r.save) {
      await this.upload(false, true);
      return;
    }
    if (prefs.cloudUser === this.user.id && prefs.cloudRev === r.rev) return; // this device is up to date
    const meta = r.save as { device?: unknown; seq?: unknown };
    if (prefs.cloudUser === this.user.id && meta.device === prefs.deviceId) {
      // The cloud holds this device's own upload (its reply was lost when the
      // page closed), so the city here is at least as new: adopt that revision
      // and send our latest if that upload wasn't it.
      prefs.cloudRev = r.rev;
      this.ctrl.savePrefs();
      if (meta.seq !== prefs.cloudSeq) await this.upload(false);
      return;
    }
    let cloud: GameState;
    try {
      cloud = readSave(r.save, this.ctrl.now());
    } catch {
      return;
    }
    if (prefs.cloudUser === this.user.id && prefs.cloudRev > 0 && prefs.cloudRev !== r.rev) {
      this.showConflict({ level: cloud.level, cityName: cloud.cityName, savedAt: r.savedAt, rev: r.rev }, cloud);
      return;
    }
    // first login on this device: offer the cloud city
    this.showConflict({ level: cloud.level, cityName: cloud.cityName, savedAt: r.savedAt, rev: r.rev }, cloud);
  }

  private showConflict(info: { level: number; cityName: string; savedAt: number; rev: number }, cloud?: GameState): void {
    if (this.conflictOpen || !this.user) return;
    this.conflictOpen = true;
    const local = this.ctrl.state;
    const when = info.savedAt ? new Date(info.savedAt).toLocaleString() : '';
    openDialog({
      title: t('online.conflictTitle'),
      icon: 'warning',
      dismissable: false,
      body: [
        el('p', { text: t('online.conflictBody') }),
        el('div', { class: 'row' }, ico('account'), el('div', { class: 'grow' }, el('div', { class: 't1', text: t('online.cloudCity') }), el('div', { class: 't2', text: `${info.cityName} · ${t('hud.level', { level: info.level })} · ${when}` }))),
        el('div', { class: 'row' }, ico('visit'), el('div', { class: 'grow' }, el('div', { class: 't1', text: t('online.localCity') }), el('div', { class: 't2', text: `${local.cityName} · ${t('hud.level', { level: local.level })}` }))),
      ],
      actions: [
        {
          label: t('online.keepLocal'),
          cls: 'plain',
          onClick: () => {
            this.conflictOpen = false;
            this.ctrl.prefs.cloudRev = info.rev;
            this.ctrl.prefs.cloudUser = this.user?.id ?? 0;
            void this.upload(false, true);
          },
        },
        {
          label: t('online.useCloud'),
          onClick: async () => {
            this.conflictOpen = false;
            let s = cloud;
            if (!s) {
              const r = await api<{ save: unknown; rev: number }>('save_get');
              if (r.ok && r.save) s = readSave(r.save, this.ctrl.now());
            }
            if (s) {
              this.ctrl.prefs.cloudRev = info.rev;
              this.ctrl.prefs.cloudUser = this.user?.id ?? 0;
              this.ctrl.savePrefs();
              this.ctrl.replaceState(s);
            }
          },
        },
      ],
    });
  }

  // ------------------------------------------------------- inbox / friends

  async refresh(): Promise<void> {
    if (!this.user) return;
    this.lastInbox = this.ctrl.now();
    const f = await api<{ friends: Friend[]; code: string }>('friends');
    if (f.ok) {
      this.friends = f.friends;
      if (this.user) this.user.friendCode = f.code;
    }
    const inbox = await api<{ helps: InboxHelp[]; gifts: InboxGift[]; jobs: InboxJob[]; staffed: InboxStaffed[] }>('inbox');
    if (inbox.ok) {
      const helps: PendingHelp[] = inbox.helps.map((h) => ({ id: `srv:${h.id}`, from: `user:${h.from}`, objectId: h.objectId, action: h.action, at: h.at }));
      if (helps.length) this.ctrl.dispatch({ t: 'addHelps', helps }, { quiet: true });
      const gifts: Gift[] = inbox.gifts.map((g) => ({ id: `srv:${g.id}`, from: this.nameOf(`user:${g.from}`), reward: g.reward, at: g.at }));
      if (gifts.length) {
        this.ctrl.dispatch({ t: 'addGifts', gifts }, { quiet: true });
        void api('gift_ack', { ids: inbox.gifts.map((g) => g.id) });
      }
      this.jobs = inbox.jobs;
      const filled: number[] = [];
      for (const s of inbox.staffed) {
        if (this.ctrl.dispatch({ t: 'staff', id: s.objectId, source: `user:${s.from}` }, { quiet: true })) {
          toast(t('online.staffed', { who: this.nameOf(`user:${s.from}`) }), 'good', 'hardhat');
        }
        filled.push(s.id);
      }
      if (filled.length) void api('staffed_ack', { ids: filled });
    }
    await this.franchises.refresh();
    this.ctrl.refreshUi();
  }

  friendNeighbors(): Neighbor[] {
    return this.friends.map((f) => ({
      key: `user:${f.id}`,
      name: f.username,
      town: f.cityName,
      avatar: f.avatar,
      level: f.level,
      npc: false,
      helpsLeft: f.helpsLeft,
      canGift: !f.giftSent,
    }));
  }

  nameOf(from: string): string {
    const id = Number(from.replace(/^user:/, ''));
    return this.friends.find((f) => f.id === id)?.username ?? t('online.aNeighbor');
  }

  avatarOf(from: string): string {
    const id = Number(from.replace(/^user:/, ''));
    return this.friends.find((f) => f.id === id)?.avatar ?? 'account';
  }

  ackHelp(id: string): void {
    if (!id.startsWith('srv:')) return;
    void api('help_ack', { ids: [Number(id.slice(4))] });
  }

  async visitFriend(id: number): Promise<void> {
    if (!this.user) return this.social.needsAccount();
    const r = await api<{ user: ApiUser; save: unknown; helpsLeft: number; helped: number[]; day: string; franchises?: (Omit<LotFranchise, 'goods'> & { lotId: number })[] }>('city', undefined, { query: { id } });
    if (!r.ok) {
      toast(t(r.offline ? 'online.offline' : 'online.cityUnavailable'), 'bad', 'warning');
      return;
    }
    let state: GameState;
    try {
      state = readSave(r.save, this.ctrl.now());
    } catch {
      toast(t('online.cityUnavailable'), 'bad', 'warning');
      return;
    }
    const helped = new Set(r.helped);
    for (const oid of helped) {
      const o = state.objects[oid];
      if (o) o.helpedAt = this.ctrl.now();
    }
    const lots = new Map<number, LotFranchise>();
    for (const f of r.franchises ?? []) lots.set(f.lotId, { item: f.item, stars: f.stars, pending: f.pending, mine: f.mine, ownerName: f.ownerName, ownerAvatar: f.ownerAvatar, goods: 0 });
    this.social.enter({
      key: `user:${id}`,
      userId: id,
      name: r.user.username,
      town: r.user.cityName,
      avatar: r.user.avatar,
      level: r.user.level,
      state,
      index: new WorldIndex(state),
      helped,
      day: r.day,
      left: r.helpsLeft,
      lots,
    });
  }

  async helpFriend(v: Visit, objectId: number, action: HelpAction, at: [number, number]): Promise<void> {
    if (v.userId === undefined) return;
    const r = await api<{ left: number; reward: Gift['reward'] }>('help', { hostId: v.userId, objectId, action });
    if (!r.ok) {
      if (r.error === 'limit') {
        v.left = 0;
        toast(t('visit.noHelps'), 'info', 'energy');
      } else toast(t(r.offline ? 'online.offline' : 'online.helpFailed'), 'bad', 'warning');
      return;
    }
    const key = `help:user:${v.userId}:${v.day}:${objectId}`;
    if (this.ctrl.dispatch({ t: 'helpReward', reward: r.reward, key, at }, { quiet: true })) {
      this.social.applyVisual(v, objectId, action);
      v.left = r.left;
      const f = this.friends.find((x) => x.id === v.userId);
      if (f) f.helpsLeft = r.left;
    }
  }

  // --------------------------------------------------------------- invites

  private handleInvite(): void {
    const code = this.pendingInvite;
    if (!code) return;
    if (!this.user) {
      openDialog({
        title: t('online.inviteTitle'),
        icon: 'friends',
        body: el('p', { text: t('online.inviteSignIn') }),
        actions: [
          { label: t('dlg.cancel'), cls: 'plain', onClick: () => (this.pendingInvite = null) },
          { label: t('account.signIn'), onClick: () => this.openAccount() },
        ],
      });
      return;
    }
    this.pendingInvite = null;
    try {
      const url = new URL(location.href);
      url.searchParams.delete('invite');
      history.replaceState(null, '', url.href);
    } catch {
      /* ignore */
    }
    if (code === this.user.friendCode) return;
    confirmDialog(t('online.inviteTitle'), t('online.inviteAdd', { code }), t('dlg.yes'), () => void this.addFriend(code));
  }

  async addFriend(code: string): Promise<boolean> {
    const r = await api<{ friend: Friend }>('friend_add', { code: code.trim().toUpperCase() });
    if (!r.ok) {
      toast(t(`online.friend_${r.error}`) === `online.friend_${r.error}` ? t('online.friendFailed') : t(`online.friend_${r.error}`), 'bad', 'friends');
      return false;
    }
    toast(t('online.friendAdded', { name: r.friend.username }), 'good', r.friend.avatar);
    await this.refresh();
    return true;
  }

  // ---------------------------------------------------------------- dialogs

  openNeighbors(): void {
    let handle: DialogHandle;
    const render = (): Node[] => {
      const out: Node[] = [];
      if (!this.user) {
        out.push(el('p', { text: apiAvailable() === false ? t('online.noServer') : t('online.needAccount') }));
        if (apiAvailable() !== false) out.push(el('div', { class: 'center' }, button(t('account.signIn'), () => {
          handle.close();
          this.openAccount();
        }, 'btn honey')));
      } else {
        const link = `${location.origin}${location.pathname}?invite=${this.user.friendCode}`;
        out.push(el('div', { class: 'section-title', text: t('online.yourCode') }), el('div', { class: 'code', text: this.user.friendCode }));
        out.push(
          el('div', { class: 'grid2', style: 'margin-top:8px' }, button(t('online.copyLink'), () => {
            void navigator.clipboard?.writeText(link).then(() => toast(t('online.copied'), 'good', 'check'));
          }, 'btn small plain'), button(t('online.copyCode'), () => {
            void navigator.clipboard?.writeText(this.user?.friendCode ?? '').then(() => toast(t('online.copied'), 'good', 'check'));
          }, 'btn small plain')),
        );
        const input = el('input', { class: 'textin', maxlength: '16', placeholder: t('online.codePlaceholder'), 'aria-label': t('online.addByCode') });
        out.push(el('div', { class: 'section-title', text: t('online.addByCode') }), el('div', { style: 'display:flex;gap:8px' }, input, button(t('online.add'), async () => {
          if (await this.addFriend(input.value)) handle.setBody(render());
        }, 'btn small')));
        out.push(el('div', { class: 'section-title', text: t('online.friends', { n: this.friends.length }) }));
        if (this.friends.length === 0) out.push(el('p', { class: 'muted', text: t('online.noFriends') }));
        for (const f of this.friends) {
          out.push(
            el(
              'div',
              { class: 'row' },
              ico(f.avatar),
              el('div', { class: 'grow' }, el('div', { class: 't1', text: `${f.username} · ${t('hud.level', { level: f.level })}` }), el('div', { class: 't2', text: `${f.cityName} · ${t('visit.helps', { n: f.helpsLeft })}` })),
              button(t('online.visit'), () => {
                handle.close();
                this.ctrl.visit(`user:${f.id}`);
              }, 'btn small'),
              button(f.giftSent ? t('online.giftSent') : t('online.gift'), () => this.openGiftPicker(f, () => handle.setBody(render())), 'btn small honey', f.giftSent ? { disabled: true } : undefined),
              button(ico('cancel'), () => confirmDialog(t('online.remove'), t('online.removeConfirm', { name: f.username }), t('online.remove'), async () => {
                await api('friend_remove', { userId: f.id });
                await this.refresh();
                handle.setBody(render());
              }, true), 'roundbtn', { 'aria-label': t('online.remove') }),
            ),
          );
        }
        if (this.jobs.length) {
          out.push(el('div', { class: 'section-title', text: t('online.jobs') }));
          for (const j of this.jobs) {
            out.push(el('div', { class: 'row' }, ico('hardhat'), el('div', { class: 'grow t1', text: t('online.jobFrom', { who: this.nameOf(`user:${j.from}`), item: t(`item.${j.item}`) }) }), button(t('online.takeJob'), async () => {
              const r = await api('job_fill', { requestId: j.id });
              if (r.ok) {
                toast(t('online.jobTaken'), 'good', 'hardhat');
                this.ctrl.dispatch({ t: 'grant', reward: { coins: 50, xp: 2 }, key: `job:${j.id}` }, { quiet: true });
              } else toast(t('online.jobGone'), 'info', 'hardhat');
              this.jobs = this.jobs.filter((x) => x.id !== j.id);
              handle.setBody(render());
            }, 'btn small honey')));
          }
        }
        out.push(
          el(
            'div',
            { class: 'center', style: 'margin-top:10px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap' },
            button(el('span', null, ico('leaderboard'), t('online.leaderboard')), () => this.openLeaderboard(), 'btn small plain'),
            button(el('span', null, ico('franchise'), t('franchise.hqTitle')), () => this.franchises.openHQ(), 'btn small plain'),
          ),
        );
      }
      out.push(el('div', { class: 'section-title', text: t('online.npcs') }));
      for (const n of this.social.neighbors().filter((x) => x.npc)) {
        out.push(el('div', { class: 'row' }, ico(n.avatar), el('div', { class: 'grow' }, el('div', { class: 't1', text: `${n.name} · ${t('hud.level', { level: n.level })}` }), el('div', { class: 't2', text: `${n.town} · ${t('visit.helps', { n: n.helpsLeft })}` })), button(t('online.visit'), () => {
          handle.close();
          this.ctrl.visit(n.key);
        }, 'btn small')));
      }
      return out;
    };
    handle = openDialog({ id: 'neighbors', title: t('tools.neighbors'), icon: 'friends', body: render(), size: 'mid' });
  }

  private openGiftPicker(f: Friend, done: () => void): void {
    const grid = el('div', { class: 'seeds' });
    const h = openDialog({ title: t('online.giftTo', { name: f.username }), icon: 'gift', body: grid });
    for (const g of GIFT_CHOICES) {
      if (g.id === 'wish' && f.wishlist.length === 0) continue;
      const card = el('button', { type: 'button', class: 'seed' }, ico(g.icon), el('div', { class: 'nm', text: t(`giftType.${g.id}`) }));
      card.addEventListener('click', async () => {
        const r = await api('gift_send', { toId: f.id, giftId: g.id });
        if (r.ok) {
          f.giftSent = true;
          toast(t('online.giftDone', { name: f.username }), 'good', 'gift');
          h.close();
          done();
        } else toast(t(r.error === 'limit' ? 'online.giftLimit' : 'online.giftFailed'), 'bad', 'gift');
      });
      grid.append(card);
    }
  }

  private async openLeaderboard(): Promise<void> {
    const r = await api<{ rows: { username: string; avatar: string; xp: number; level: number; me: boolean }[] }>('leaderboard');
    const body: Node[] = [el('p', { class: 'muted', text: t('online.leaderboardBody') })];
    if (!r.ok) body.push(el('p', { text: t('online.offline') }));
    else
      r.rows.forEach((row, i) => {
        body.push(el('div', { class: 'row', style: row.me ? 'background:#fff5d6' : '' }, el('b', { text: `${i + 1}.` }), ico(row.avatar), el('div', { class: 'grow' }, el('div', { class: 't1', text: row.username }), el('div', { class: 't2', text: t('hud.level', { level: row.level }) })), el('b', { text: `${fmt(row.xp)} XP` })));
      });
    openDialog({ title: t('online.leaderboard'), icon: 'leaderboard', body });
  }

  openAccount(): void {
    let handle: DialogHandle;
    let mode: 'signin' | 'signup' | 'recover' = 'signin';
    let avatar = this.ctrl.state.avatar || AVATARS[0]!;
    const render = (): Node[] => {
      if (apiAvailable() === false) {
        return [el('p', { text: t('account.guest') }), el('p', { class: 'muted', text: t('online.noServer') }), el('p', { class: 'muted', text: t('account.guestBackup') })];
      }
      if (this.user) return this.renderProfile(() => handle.setBody(render()), () => handle.close());
      const user = el('input', { class: 'textin', autocomplete: 'username', maxlength: '20', placeholder: t('account.username'), 'aria-label': t('account.username') });
      const pass = el('input', { class: 'textin', type: 'password', autocomplete: mode === 'signup' ? 'new-password' : 'current-password', maxlength: '200', placeholder: t('account.password'), 'aria-label': t('account.password') });
      const rec = el('input', { class: 'textin', maxlength: '40', placeholder: t('account.recoveryCode'), 'aria-label': t('account.recoveryCode') });
      const err = el('p', { class: 'muted', role: 'alert', style: 'color:var(--red-dark)' });
      const tabs = el(
        'div',
        { class: 'grid2' },
        button(t('account.signIn'), () => {
          mode = 'signin';
          handle.setBody(render());
        }, `btn small ${mode === 'signin' ? 'honey' : 'plain'}`),
        button(t('account.create'), () => {
          mode = 'signup';
          handle.setBody(render());
        }, `btn small ${mode === 'signup' ? 'honey' : 'plain'}`),
      );
      const out: Node[] = [el('p', { class: 'muted', text: t('account.why') }), tabs, el('div', { style: 'display:grid;gap:8px;margin-top:10px' }, user, pass, mode === 'recover' ? rec : null)];
      if (mode === 'signup') out.push(el('div', { class: 'section-title', text: t('account.avatar') }), this.avatarGrid(avatar, (a) => (avatar = a)));
      out.push(err);
      const submit = async () => {
        const u = user.value.trim();
        const p = pass.value;
        if (!USERNAME_RE.test(u)) return void (err.textContent = t('account.badUsername'));
        if (p.length < 8) return void (err.textContent = t('account.badPassword'));
        let r;
        if (mode === 'signup') r = await api<{ user: ApiUser; recoveryCode: string }>('register', { username: u, password: p, avatar, cityName: this.ctrl.state.cityName });
        else if (mode === 'recover') r = await api<{ user: ApiUser; recoveryCode: string }>('recover', { username: u, recoveryCode: rec.value.trim(), newPassword: p });
        else r = await api<{ user: ApiUser; recoveryCode?: string }>('login', { username: u, password: p });
        if (!r.ok) {
          err.textContent = t(`account.err_${r.error}`) === `account.err_${r.error}` ? t('account.err_generic') : t(`account.err_${r.error}`);
          return;
        }
        this.user = r.user;
        handle.close();
        if (mode !== 'signin' && r.recoveryCode) this.showRecovery(r.recoveryCode);
        toast(t('account.welcome', { name: r.user.username }), 'good', r.user.avatar);
        if (mode === 'signup') this.ctrl.dispatch({ t: 'setAvatar', avatar }, { quiet: true });
        await this.syncOnLogin();
        await this.refresh();
        if (this.pendingInvite) this.handleInvite();
      };
      out.push(el('div', { class: 'center' }, button(mode === 'signup' ? t('account.create') : mode === 'recover' ? t('account.reset') : t('account.signIn'), () => void submit(), 'btn honey')));
      if (mode === 'signin') out.push(el('p', { class: 'center' }, button(t('account.forgot'), () => {
        mode = 'recover';
        handle.setBody(render());
      }, 'btn small plain')));
      out.push(el('p', { class: 'muted center', text: t('account.noEmail') }));
      return out;
    };
    handle = openDialog({ id: 'account', title: t('tools.account'), icon: 'account', body: render(), size: 'mid' });
    if (apiAvailable() === null) {
      void api('session').then((r) => {
        if (r.ok && typeof (r as { csrf?: unknown }).csrf === 'string') setCsrf((r as unknown as { csrf: string }).csrf);
        handle.setBody(render());
      });
    }
  }

  private avatarGrid(current: string, pick: (a: string) => void): HTMLElement {
    const grid = el('div', { class: 'avatars', role: 'radiogroup', 'aria-label': t('account.avatar') });
    for (const a of AVATARS) {
      const b = button(ico(a), () => {
        for (const n of grid.querySelectorAll('.avatar')) n.classList.remove('on');
        b.classList.add('on');
        b.setAttribute('aria-checked', 'true');
        pick(a);
      }, `avatar${a === current ? ' on' : ''}`, { role: 'radio', 'aria-checked': a === current ? 'true' : 'false', 'aria-label': t(`avatar.${a}`) });
      grid.append(b);
    }
    return grid;
  }

  private renderProfile(rerender: () => void, close: () => void): Node[] {
    const u = this.user!;
    let avatar = u.avatar;
    const out: Node[] = [
      el('div', { class: 'row' }, ico(u.avatar), el('div', { class: 'grow' }, el('div', { class: 't1', text: u.username }), el('div', { class: 't2', text: t('online.yourCode') + ': ' + u.friendCode }))),
      el('div', { class: 'section-title', text: t('account.avatar') }),
      this.avatarGrid(avatar, (a) => (avatar = a)),
      el('div', { class: 'center', style: 'margin-top:8px' }, button(t('settings.save'), async () => {
        const r = await api<{ user: ApiUser }>('profile', { avatar, cityName: this.ctrl.state.cityName });
        if (r.ok) {
          this.user = r.user;
          this.ctrl.dispatch({ t: 'setAvatar', avatar }, { quiet: true });
          toast(t('msg.saved'), 'good', avatar);
          rerender();
        }
      }, 'btn small')),
    ];
    const oldPw = el('input', { class: 'textin', type: 'password', autocomplete: 'current-password', placeholder: t('account.oldPassword'), 'aria-label': t('account.oldPassword') });
    const newPw = el('input', { class: 'textin', type: 'password', autocomplete: 'new-password', placeholder: t('account.newPassword'), 'aria-label': t('account.newPassword') });
    out.push(
      el('div', { class: 'section-title', text: t('account.changePassword') }),
      el('div', { style: 'display:grid;gap:8px' }, oldPw, newPw),
      el('div', { class: 'center', style: 'margin-top:8px' }, button(t('account.changePassword'), async () => {
        if (newPw.value.length < 8) return toast(t('account.badPassword'), 'bad');
        const r = await api('password', { oldPassword: oldPw.value, newPassword: newPw.value });
        toast(r.ok ? t('account.passwordChanged') : t('account.err_badLogin'), r.ok ? 'good' : 'bad');
      }, 'btn small plain')),
      el('div', { class: 'section-title', text: t('settings.data') }),
      el(
        'div',
        { class: 'grid2' },
        button(t('account.signOut'), async () => {
          await this.upload(false);
          await api('logout', {});
          this.user = null;
          this.friends = [];
          this.franchises.clear();
          this.ctrl.prefs.cloudRev = 0;
          this.ctrl.prefs.cloudUser = 0;
          this.ctrl.savePrefs();
          this.ctrl.refreshUi();
          close();
          toast(t('account.signedOut'), 'info');
        }, 'btn plain'),
        button(t('account.delete'), () => this.deleteAccount(close), 'btn red'),
      ),
    );
    return out;
  }

  private deleteAccount(close: () => void): void {
    const pw = el('input', { class: 'textin', type: 'password', autocomplete: 'current-password', placeholder: t('account.password'), 'aria-label': t('account.password') });
    openDialog({
      title: t('account.delete'),
      icon: 'warning',
      body: [el('p', { text: t('account.deleteBody') }), pw],
      actions: [
        { label: t('dlg.cancel'), cls: 'plain', onClick: () => {} },
        {
          label: t('account.deleteConfirm'),
          cls: 'red',
          onClick: async () => {
            const r = await api('delete_account', { password: pw.value });
            if (!r.ok) return toast(t('account.err_badLogin'), 'bad');
            this.user = null;
            this.friends = [];
            this.franchises.clear();
            this.ctrl.prefs.cloudRev = 0;
            this.ctrl.prefs.cloudUser = 0;
            this.ctrl.savePrefs();
            this.ctrl.refreshUi();
            close();
            toast(t('account.deleted'), 'info');
          },
        },
      ],
    });
  }

  private showRecovery(code: string): void {
    openDialog({
      title: t('account.recoveryTitle'),
      icon: 'key',
      dismissable: false,
      body: [el('p', { text: t('account.recoveryBody') }), el('div', { class: 'code', text: code }), el('p', { class: 'muted', text: t('account.recoveryOnce') })],
      actions: [
        { label: t('online.copyCode'), cls: 'plain', close: false, onClick: () => void navigator.clipboard?.writeText(code).then(() => toast(t('online.copied'), 'good', 'check')) },
        { label: t('account.recoverySaved'), onClick: () => {} },
      ],
    });
  }

  /** Posts a job request for a community building (friends can fill one slot each). */
  async requestJob(objectId: number, item: string): Promise<void> {
    if (!this.user) return this.social.needsAccount();
    const r = await api('job_request', { objectId, item });
    toast(r.ok ? t('staff.posted') : t('online.offline'), r.ok ? 'good' : 'bad', 'hardhat');
  }

  /** Mirrors the wishlist to the server so friends can gift wishlist items. */
  syncWishlist(items: string[]): void {
    if (this.user) void api('wishlist', { items });
  }

  version(): number {
    return saveVersion();
  }
}
