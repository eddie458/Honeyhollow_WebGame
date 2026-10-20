// Browser storage for guest saves and preferences. Every access is wrapped in
// try/catch because storage can be unavailable (private mode, blocked, full).
import { DAY_NIGHT_MODES, type DayNightMode } from '../render/daylight';
import { readSave, SaveError, wrapSave, type GameState } from '../sim';

const SAVE_KEY = 'honeyhollow.save';
const BACKUP_KEY = 'honeyhollow.save.backup';
const PREFS_KEY = 'honeyhollow.prefs';

export interface Prefs {
  sound: boolean;
  music: boolean;
  volume: number;
  reducedMotion: boolean;
  colorblind: boolean;
  /** Sharp zoom: redraw on-screen art at the zoom's resolution. */
  highRes: boolean;
  hints: boolean;
  /** Day and night: follow the clock, a fast cycle, or always day/night. */
  dayNight: DayNightMode;
  /** Cloud revision this device last synced (logged-in players). */
  cloudRev: number;
  cloudUser: number;
  /** Random id of this browser, stamped on its cloud uploads. */
  deviceId: string;
  /** Number of the last cloud upload this device sent. */
  cloudSeq: number;
}

function newDeviceId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function defaultPrefs(): Prefs {
  const rm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { sound: true, music: true, volume: 0.7, reducedMotion: rm, colorblind: false, highRes: true, hints: true, dayNight: 'clock', cloudRev: 0, cloudUser: 0, deviceId: newDeviceId(), cloudSeq: 0 };
}

export function loadPrefs(): Prefs {
  const base = defaultPrefs();
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      sound: typeof p.sound === 'boolean' ? p.sound : base.sound,
      music: typeof p.music === 'boolean' ? p.music : base.music,
      volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : base.volume,
      reducedMotion: typeof p.reducedMotion === 'boolean' ? p.reducedMotion : base.reducedMotion,
      colorblind: typeof p.colorblind === 'boolean' ? p.colorblind : base.colorblind,
      highRes: typeof p.highRes === 'boolean' ? p.highRes : base.highRes,
      hints: typeof p.hints === 'boolean' ? p.hints : base.hints,
      dayNight: DAY_NIGHT_MODES.includes(p.dayNight as DayNightMode) ? (p.dayNight as DayNightMode) : base.dayNight,
      cloudRev: typeof p.cloudRev === 'number' ? p.cloudRev : 0,
      cloudUser: typeof p.cloudUser === 'number' ? p.cloudUser : 0,
      deviceId: typeof p.deviceId === 'string' && /^[0-9a-f]{16}$/.test(p.deviceId) ? p.deviceId : base.deviceId,
      cloudSeq: typeof p.cloudSeq === 'number' && p.cloudSeq >= 0 ? p.cloudSeq : 0,
    };
  } catch {
    return base;
  }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable - preferences just won't persist */
  }
}

export function loadLocalSave(now: number): { state: GameState | null; error?: string } {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return { state: null, error: 'storage' };
  }
  if (!raw) return { state: null };
  try {
    return { state: readSave(JSON.parse(raw), now) };
  } catch (e) {
    // Try the backup copy before giving up.
    try {
      const bak = localStorage.getItem(BACKUP_KEY);
      if (bak) return { state: readSave(JSON.parse(bak), now), error: 'restoredBackup' };
    } catch {
      /* fall through */
    }
    return { state: null, error: e instanceof SaveError ? e.code : 'corrupt' };
  }
}

let lastBackup = 0;

export function writeLocalSave(state: GameState, now: number): boolean {
  try {
    const json = JSON.stringify(wrapSave(state, now));
    if (now - lastBackup > 5 * 60_000) {
      const prev = localStorage.getItem(SAVE_KEY);
      if (prev) localStorage.setItem(BACKUP_KEY, prev);
      lastBackup = now;
    }
    localStorage.setItem(SAVE_KEY, json);
    return true;
  } catch {
    return false;
  }
}

export function clearLocalSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(BACKUP_KEY);
  } catch {
    /* ignore */
  }
}

/** Offers the save as a downloadable .json file. */
export function exportSave(state: GameState, now: number): void {
  const blob = new Blob([JSON.stringify(wrapSave(state, now), null, 1)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = state.cityName.replace(/[^\w-]+/g, '-').slice(0, 30) || 'city';
  const d = new Date(now);
  a.href = url;
  a.download = `honeyhollow-${safe}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Asks the player for a save file; resolves with the parsed state. */
export function pickSaveFile(now: number): Promise<GameState> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return reject(new SaveError('format'));
      if (f.size > 2_000_000) return reject(new SaveError('format'));
      f.text()
        .then((txt) => resolve(readSave(JSON.parse(txt), now)))
        .catch((e) => reject(e instanceof SaveError ? e : new SaveError('format')));
    };
    input.click();
  });
}
