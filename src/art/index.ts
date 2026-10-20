// Generates every procedural sprite into a SpriteBank (with progress callback).
import manifestJson from '../data/asset-manifest.json';
import { content } from '../sim/content';
import type { SpriteBank } from './atlas';
import { drawBuildingSet, type BuildingParams } from './buildings';
import { drawDeco } from './decor';
import { ICONS, iconDataUrl, PORTRAITS } from './icons';
import { citizenLooks, drawCitizen, drawVehicle, VEHICLE_KINDS } from './people';
import { drawProp } from './props';
import { CROP_ART, drawConstruction, drawLawnLot, drawPlot, drawRoad, drawSeaLot, drawSidewalk, drawWildLot, frameFor } from './terrain';
import { Iso } from './iso';
import { drawBoat, drawEmptyLot, drawGreatHive, drawLighthouse, drawObservatory, drawPier, drawRail, drawSkyGarden, drawStation, drawTrain } from './special';

export interface ManifestEntry {
  gen?: 'building' | 'deco' | 'special';
  params?: BuildingParams;
  name?: string;
}

export interface OverrideEntry {
  image?: string;
  atlas?: string;
  atlasImage?: string;
  frame?: string;
  anchor?: [number, number];
  res?: number;
}

export const manifest = manifestJson as unknown as {
  sprites: Record<string, ManifestEntry>;
  overrides: Record<string, OverrideEntry>;
};

export const LAWN_VARIANTS = 3;
export const WILD_VARIANTS = 4;
export const SEA_VARIANTS = 2;
export const CITIZENS = citizenLooks();

// Yield to the browser between batches without requestAnimationFrame/setTimeout,
// which are heavily throttled in background tabs (art would take 10s+ there).
const channel = typeof MessageChannel === 'function' ? new MessageChannel() : null;
const waiting: (() => void)[] = [];
if (channel) channel.port1.onmessage = () => waiting.shift()?.();
const nextFrame = () =>
  new Promise<void>((r) => {
    if (!channel) return void setTimeout(r, 0);
    waiting.push(r);
    channel.port2.postMessage(0);
  });

type Job = () => void | Promise<void>;

export async function generateAll(bank: SpriteBank, onProgress: (p: number) => void): Promise<void> {
  const jobs: Job[] = [];
  const skip = (key: string) => key in manifest.overrides;

  for (let i = 0; i < LAWN_VARIANTS; i++) jobs.push(() => drawLawnLot(bank, `lot.lawn.${i}`, i));
  for (let i = 0; i < WILD_VARIANTS; i++) jobs.push(() => drawWildLot(bank, `lot.wild.${i}`, i));
  for (let i = 0; i < SEA_VARIANTS; i++) {
    jobs.push(() => drawSeaLot(bank, `lot.sea.${i}`, false, i));
    jobs.push(() => drawSeaLot(bank, `lot.shore.${i}`, true, i));
  }
  for (let m = 0; m < 16; m++) if (!skip(`road.${m}`)) jobs.push(() => drawRoad(bank, `road.${m}`, m));
  if (!skip('sidewalk')) jobs.push(() => drawSidewalk(bank, 'sidewalk'));
  jobs.push(() => drawPlot(bank, 'plot.empty', null, 0));
  jobs.push(() => drawPlot(bank, 'crop.withered', null, 4));
  for (const crop of content().cropList) {
    const art = CROP_ART[crop.id] ?? CROP_ART.strawberry!;
    jobs.push(() => {
      drawPlot(bank, `crop.${crop.id}.1`, art, 1);
      drawPlot(bank, `crop.${crop.id}.2`, art, 2);
      drawPlot(bank, `crop.${crop.id}.3`, art, 3);
    });
  }
  // construction sites for every footprint in use (both rotations)
  const sizes = new Set<string>();
  for (const it of content().itemList) {
    if (!it.clicks) continue;
    sizes.add(`${it.size[0]}x${it.size[1]}`);
    sizes.add(`${it.size[1]}x${it.size[0]}`);
  }
  for (const s of sizes) {
    const [w, d] = s.split('x').map(Number) as [number, number];
    jobs.push(() => {
      for (let st = 1; st <= 3; st++) drawConstruction(bank, `construct.${s}.${st}`, w, d, st);
    });
  }
  // items from the manifest
  for (const [key, entry] of Object.entries(manifest.sprites)) {
    if (skip(key)) continue;
    const id = key.replace(/^item\./, '');
    const def = content().items[id];
    if (!def) continue;
    if (entry.gen === 'building' && entry.params) {
      const params = entry.params;
      jobs.push(() => drawBuildingSet(bank, key, def.size, params));
      // Upgraded looks: an extra floor at level 2, plus a flag and a bigger prop at level 3.
      if (def.upgrades?.length) {
        const l2: BuildingParams = { ...params, floors: (params.floors ?? 1) + 1, trim: params.trim ?? '#fff6d8' };
        const l3: BuildingParams = { ...l2, flag: params.flag ?? '#ffd23f', propSize: Math.round((params.propSize ?? 26) * 1.2), tall: (params.tall ?? 0) + 6 };
        if (!skip(`${key}.L2`)) jobs.push(() => drawBuildingSet(bank, `${key}.L2`, def.size, l2));
        if (!skip(`${key}.L3`)) jobs.push(() => drawBuildingSet(bank, `${key}.L3`, def.size, l3));
      }
    } else if (entry.gen === 'deco') {
      jobs.push(() => drawDeco(bank, `${key}.0`, entry.name ?? id, def.size[0], def.size[1]));
    } else if (entry.gen === 'special') {
      jobs.push(() => drawSpecial(bank, key, entry.name ?? id));
    }
  }
  // citizens and vehicles
  CITIZENS.forEach((look, i) => {
    jobs.push(() => {
      for (const dir of [0, 1] as const) for (let f = 0; f < 3; f++) drawCitizen(bank, `citizen.${i}.${dir}.${f}`, look, dir, f);
    });
  });
  for (const k of VEHICLE_KINDS) jobs.push(() => {
    drawVehicle(bank, `vehicle.${k}.0`, k, 0);
    drawVehicle(bank, `vehicle.${k}.1`, k, 1);
  });
  jobs.push(() => drawSaleSign(bank));
  jobs.push(() => {
    drawBoat(bank, 'boat');
    drawRail(bank, 'rail');
    drawTrain(bank, 'train.0', 0);
    drawTrain(bank, 'train.1', 1);
  });
  jobs.push(() => drawGlow(bank));
  // icons (rasterised SVG) for overlays, doobers and collectibles
  const iconNames = [...Object.keys(ICONS), ...Object.keys(PORTRAITS)];
  for (let i = 0; i < iconNames.length; i += 12) {
    const chunk = iconNames.slice(i, i + 12);
    jobs.push(async () => {
      await Promise.all(chunk.map((n) => rasterIcon(bank, n)));
    });
  }

  let done = 0;
  let lastYield = performance.now();
  for (const job of jobs) {
    await job();
    done++;
    if (performance.now() - lastYield > 30) {
      onProgress(done / jobs.length);
      await nextFrame();
      lastYield = performance.now();
    }
  }
  onProgress(1);
}

/**
 * Draws the night layers (lit windows, lamps) in small slices after the game
 * has started, so they never delay the first frame. Resolves when all are in
 * the bank's pending list, ready for pack().
 */
export async function generateLights(bank: SpriteBank): Promise<void> {
  let slice = performance.now();
  for (const key of bank.withLights) {
    bank.drawLit(key);
    if (performance.now() - slice > 6) {
      await nextFrame();
      slice = performance.now();
    }
  }
}

function drawSpecial(bank: SpriteBank, key: string, name: string): void {
  switch (name) {
    case 'pier':
      drawPier(bank, `${key}.0`, 1);
      drawPier(bank, `${key}.L2.0`, 2);
      drawPier(bank, `${key}.L3.0`, 3);
      return;
    case 'station':
      return drawStation(bank, `${key}.0`);
    case 'greathive':
      return drawGreatHive(bank, `${key}.0`);
    case 'skygarden':
      return drawSkyGarden(bank, `${key}.0`);
    case 'lighthouse':
      return drawLighthouse(bank, `${key}.0`);
    case 'observatory':
      return drawObservatory(bank, `${key}.0`);
    case 'emptylot':
      return drawEmptyLot(bank, `${key}.0`);
    default:
      return;
  }
}

const ICON_SIZE = 48;

function rasterIcon(bank: SpriteBank, name: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    const px = Math.round(ICON_SIZE * bank.res);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = px;
      canvas.height = px;
      canvas.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0, px, px);
      bank.addCanvas(`icon.${name}`, canvas, px / 2, px / 2);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = iconDataUrl(name, px);
  });
}

function drawSaleSign(bank: SpriteBank): void {
  bank.draw('sign.sale', 50, 60, 25, 56, (c) => {
    c.fillStyle = 'rgba(25,35,15,0.25)';
    c.beginPath();
    c.ellipse(27, 56, 10, 3.5, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#7a4e2d';
    c.fillRect(23.5, 22, 3, 34);
    c.beginPath();
    c.roundRect(6, 6, 38, 24, 5);
    c.fillStyle = '#fff4e0';
    c.fill();
    c.strokeStyle = '#7a4e2d';
    c.lineWidth = 2.5;
    c.stroke();
    drawProp(c, 'star', 17, 18, 13);
    // arrow pointing out
    c.fillStyle = '#2a9d8f';
    c.beginPath();
    c.moveTo(28, 13);
    c.lineTo(38, 18);
    c.lineTo(28, 23);
    c.closePath();
    c.fill();
  });
}

function drawGlow(bank: SpriteBank): void {
  const f = frameFor(1, 1, 4, 4, 4);
  bank.draw('glow.blue', f.W, f.H, f.ax, f.ay, (c) => {
    const iso = new Iso(c, f.ax, f.ay);
    const [sx, sy] = iso.p(0.5, 0.5);
    const g = c.createRadialGradient(sx, sy, 2, sx, sy, 34);
    g.addColorStop(0, 'rgba(90,170,255,0.75)');
    g.addColorStop(1, 'rgba(90,170,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(sx, sy, 34, 17, 0, 0, Math.PI * 2);
    c.fill();
  });
  bank.draw('glow.gold', 64, 64, 32, 32, (c) => {
    const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,240,150,0.95)');
    g.addColorStop(1, 'rgba(255,240,150,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
  bank.draw('dot', 8, 8, 4, 4, (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(4, 4, 3.5, 0, Math.PI * 2);
    c.fill();
  });
  // A soft cone of light pointing right from its anchor (headlights, the
  // lighthouse beam); the scene rotates and stretches it. Stacked cones of
  // shrinking width give it soft edges.
  bank.draw('light.beam', 128, 48, 0, 24, (c) => {
    for (const [spread, alpha] of [[22, 0.18], [15, 0.28], [8, 0.4]] as const) {
      const g = c.createLinearGradient(0, 0, 128, 0);
      g.addColorStop(0, `rgba(255,246,214,${alpha})`);
      g.addColorStop(1, 'rgba(255,246,214,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, 24 - 3);
      c.lineTo(128, 24 - spread);
      c.lineTo(128, 24 + spread);
      c.lineTo(0, 24 + 3);
      c.closePath();
      c.fill();
    }
  });
}
