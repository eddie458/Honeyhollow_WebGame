// All icons as small hand-written SVGs (64x64 viewBox). The same designs are
// used inline in the HTML HUD and rasterised into the sprite atlas for
// in-world overlays and doobers. Signs and icons never rely on words.

const O = '#3b2a1e';
const S = `stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const s2 = `stroke="${O}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;

const coinG = `<defs><radialGradient id="cg" cx="40%" cy="35%" r="65%"><stop offset="0" stop-color="#fff2a8"/><stop offset=".55" stop-color="#f6c033"/><stop offset="1" stop-color="#d99a14"/></radialGradient></defs>`;

export const ICONS: Record<string, string> = {
  // ---- resources
  coin: `${coinG}<circle cx="32" cy="32" r="24" fill="url(#cg)" ${S}/><circle cx="32" cy="32" r="16" fill="none" stroke="#d99a14" stroke-width="3"/><path d="M32 22 l3 7 7 1 -5 5 1 7 -6 -3.5 -6 3.5 1 -7 -5 -5 7 -1z" fill="#fff2a8" stroke="#c9890f" stroke-width="1.5"/>`,
  xp: `<path d="M32 6 l7.6 16.2 17.6 2 -13 12.1 3.6 17.4 -15.8 -8.9 -15.8 8.9 3.6 -17.4 -13 -12.1 17.6 -2z" fill="#3b8fe0" ${S}/><path d="M32 14 l4.5 9.5 -9 0z" fill="#9fd0ff"/>`,
  energy: `<path d="M37 4 L14 36 h15 l-5 24 L50 26 H35 l6 -22z" fill="#ffd23f" ${S}/><path d="M33 10 l-12 18" stroke="#fff6b0" stroke-width="3" stroke-linecap="round"/>`,
  goods: `<rect x="10" y="16" width="44" height="38" rx="4" fill="#c48a4a" ${S}/><path d="M10 28 h44 M22 16 v38 M42 16 v38" stroke="#8a5a2b" stroke-width="3"/><rect x="10" y="12" width="44" height="8" rx="3" fill="#d9a066" ${S}/>`,
  population: `<circle cx="24" cy="22" r="9" fill="#f6d3b3" ${S}/><path d="M9 52 q2 -18 15 -18 q13 0 15 18z" fill="#4ecdc4" ${S}/><circle cx="42" cy="24" r="8" fill="#e8b48a" ${S}/><path d="M30 54 q2 -16 12 -16 q11 0 13 16z" fill="#ff8a3d" ${S}/>`,
  happy: `<circle cx="32" cy="32" r="24" fill="#7ed957" ${S}/><circle cx="24" cy="27" r="3" fill="${O}"/><circle cx="40" cy="27" r="3" fill="${O}"/><path d="M21 37 q11 12 22 0" fill="none" ${S}/>`,
  content: `<circle cx="32" cy="32" r="24" fill="#ffd23f" ${S}/><circle cx="24" cy="27" r="3" fill="${O}"/><circle cx="40" cy="27" r="3" fill="${O}"/><path d="M22 40 h20" fill="none" ${S}/>`,
  sad: `<circle cx="32" cy="32" r="24" fill="#ff8a65" ${S}/><circle cx="24" cy="27" r="3" fill="${O}"/><circle cx="40" cy="27" r="3" fill="${O}"/><path d="M21 44 q11 -10 22 0" fill="none" ${S}/><path d="M43 31 q2 5 0 7" stroke="#5fb2dc" stroke-width="3" fill="none"/>`,
  permit: `<rect x="12" y="8" width="40" height="48" rx="4" fill="#fff8e7" ${S}/><path d="M20 20 h24 M20 28 h24 M20 36 h14" stroke="#b9b2a2" stroke-width="3" stroke-linecap="round"/><circle cx="42" cy="46" r="9" fill="#e8574a" ${S}/><path d="M38 46 l3 3 5 -6" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  volunteer: `<path d="M12 40 q0 -22 20 -22 q20 0 20 22z" fill="#ffd23f" ${S}/><rect x="8" y="38" width="48" height="8" rx="4" fill="#f2b705" ${S}/><path d="M32 18 v20" stroke="#e0a500" stroke-width="4"/><path d="M22 52 q10 6 20 0" fill="none" ${s2}/>`,
  reputation: `<path d="M32 54 C8 38 10 16 24 14 c5 -1 8 3 8 6 c0 -3 3 -7 8 -6 c14 2 16 24 -8 40z" fill="#ff5d7a" ${S}/><path d="M22 22 q-4 4 -3 9" stroke="#ffc2d0" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  level: `<path d="M32 4 l8.2 17.4 19 2.2 -14 13 3.9 18.8 -17.1 -9.6 -17.1 9.6 3.9 -18.8 -14 -13 19 -2.2z" fill="#ffd23f" ${S}/>`,
  brick: `<rect x="8" y="22" width="48" height="22" rx="3" fill="#c8583c" ${S}/><path d="M8 33 h48 M24 22 v11 M40 33 v11" stroke="#8a3a26" stroke-width="2.5"/>`,
  paint: `<path d="M14 24 h36 v26 a6 6 0 0 1 -6 6 h-24 a6 6 0 0 1 -6 -6z" fill="#8a96a3" ${S}/><path d="M14 24 q18 -10 36 0" fill="#5c7cfa" ${S}/><path d="M24 30 q2 8 0 12" stroke="#5c7cfa" stroke-width="5" stroke-linecap="round"/>`,
  toolkit: `<rect x="8" y="24" width="48" height="28" rx="4" fill="#e8574a" ${S}/><path d="M24 24 v-6 h16 v6" fill="none" ${S}/><rect x="28" y="34" width="8" height="6" fill="#ffd23f" ${s2}/>`,
  key: `<circle cx="20" cy="32" r="11" fill="#f2c94c" ${S}/><circle cx="20" cy="32" r="4" fill="#c99a2e"/><path d="M30 29 h24 v7 h-4 v6 h-6 v-6 h-14z" fill="#f2c94c" ${S}/>`,
  // ---- ui
  build: `<path d="M10 30 L32 12 L54 30 V54 H10z" fill="#f3e3bf" ${S}/><path d="M6 32 L32 9 L58 32" fill="none" stroke="#c8483c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><rect x="26" y="38" width="12" height="16" fill="#7a4e2d" ${s2}/><circle cx="48" cy="46" r="12" fill="#2a9d8f" ${S}/><path d="M48 39 v14 M41 46 h14" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
  move: `<path d="M32 6 l8 9 h-5 v14 h14 v-5 l9 8 -9 8 v-5 h-14 v14 h5 l-8 9 -8 -9 h5 v-14 h-14 v5 l-9 -8 9 -8 v5 h14 v-14 h-5z" fill="#4ecdc4" ${S}/>`,
  rotate: `<path d="M46 20 a18 18 0 1 0 4 18" fill="none" stroke="${O}" stroke-width="9" stroke-linecap="round"/><path d="M46 20 a18 18 0 1 0 4 18" fill="none" stroke="#b98cf0" stroke-width="5" stroke-linecap="round"/><path d="M38 8 l14 10 -14 8z" fill="#b98cf0" ${S}/>`,
  store: `<path d="M8 26 l24 -12 24 12 v26 l-24 8 -24 -8z" fill="#d9a066" ${S}/><path d="M8 26 l24 10 24 -10 M32 36 v24" fill="none" ${S}/><path d="M32 4 v18 m-7 -7 l7 7 7 -7" stroke="#2a9d8f" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  sell: `<path d="M30 8 h22 a4 4 0 0 1 4 4 v22 l-26 26 -26 -26z" fill="#ffd23f" ${S}/><circle cx="45" cy="19" r="4" fill="#fff" ${s2}/><path d="M26 30 q6 -4 9 1 q2 5 -5 6 q-7 1 -5 6 q3 5 9 1 M30 26 v4 M30 43 v4" stroke="${O}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  cancel: `<circle cx="32" cy="32" r="24" fill="#e8574a" ${S}/><path d="M22 22 l20 20 M42 22 l-20 20" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`,
  close: `<path d="M18 18 l28 28 M46 18 l-28 28" stroke="${O}" stroke-width="7" stroke-linecap="round"/>`,
  check: `<circle cx="32" cy="32" r="24" fill="#5cb043" ${S}/><path d="M20 33 l8 8 16 -18" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  settings: `<path d="M27 6 h10 l2 8 6 3 7 -4 7 7 -4 7 3 6 8 2 v10 l-8 2 -3 6 4 7 -7 7 -7 -4 -6 3 -2 8 h-10 l-2 -8 -6 -3 -7 4 -7 -7 4 -7 -3 -6 -8 -2 v-10 l8 -2 3 -6 -4 -7 7 -7 7 4 6 -3z" fill="#9aa6b8" ${S} transform="scale(.82) translate(7 7)"/><circle cx="32" cy="32" r="8" fill="#fff8e7" ${S}/>`,
  goals: `<path d="M16 8 v50" stroke="${O}" stroke-width="5" stroke-linecap="round"/><path d="M18 10 h30 l-7 9 7 9 h-30z" fill="#e8574a" ${S}/>`,
  collections: `<rect x="8" y="10" width="48" height="44" rx="5" fill="#b98cf0" ${S}/><rect x="14" y="16" width="14" height="14" rx="3" fill="#fff8e7" ${s2}/><rect x="36" y="16" width="14" height="14" rx="3" fill="#fff8e7" ${s2}/><rect x="14" y="34" width="14" height="14" rx="3" fill="#fff8e7" ${s2}/><rect x="36" y="34" width="14" height="14" rx="3" fill="#ffd23f" ${s2}/>`,
  inventory: `<rect x="8" y="22" width="48" height="32" rx="4" fill="#d9a066" ${S}/><path d="M6 22 h52 l-4 -10 h-44z" fill="#c48a4a" ${S}/><rect x="26" y="30" width="12" height="6" rx="2" fill="#7a4e2d"/>`,
  gift: `<rect x="10" y="28" width="44" height="28" rx="3" fill="#b98cf0" ${S}/><rect x="6" y="20" width="52" height="10" rx="3" fill="#cfb0ff" ${S}/><path d="M32 20 v36" stroke="#ffd23f" stroke-width="7"/><path d="M32 20 c-14 -14 -22 0 0 0 c22 0 14 -14 0 0" fill="#ffd23f" ${s2}/>`,
  mail: `<rect x="6" y="14" width="52" height="36" rx="4" fill="#fff8e7" ${S}/><path d="M6 16 l26 20 26 -20" fill="none" ${S}/>`,
  daily: `<rect x="8" y="12" width="48" height="44" rx="5" fill="#fff8e7" ${S}/><path d="M8 24 h48" stroke="${O}" stroke-width="3"/><rect x="8" y="12" width="48" height="12" rx="5" fill="#e8574a" ${S}/><path d="M20 6 v10 M44 6 v10" stroke="${O}" stroke-width="4" stroke-linecap="round"/><path d="M32 30 l3.5 7 7.5 1 -5.5 5 1.5 7.5 -7 -3.8 -7 3.8 1.5 -7.5 -5.5 -5 7.5 -1z" fill="#ffd23f" ${s2}/>`,
  music: `<path d="M24 46 V14 l26 -6 v32" fill="none" stroke="${O}" stroke-width="4" stroke-linejoin="round"/><ellipse cx="18" cy="47" rx="8" ry="6" fill="#2a9d8f" ${S}/><ellipse cx="44" cy="41" rx="8" ry="6" fill="#2a9d8f" ${S}/>`,
  sound: `<path d="M10 24 h10 l14 -12 v40 l-14 -12 h-10z" fill="#4ecdc4" ${S}/><path d="M42 22 q6 10 0 20 M48 16 q10 16 0 32" fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`,
  zoomIn: `<circle cx="28" cy="28" r="18" fill="#fff8e7" ${S}/><path d="M41 41 l14 14" stroke="${O}" stroke-width="7" stroke-linecap="round"/><path d="M20 28 h16 M28 20 v16" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`,
  zoomOut: `<circle cx="28" cy="28" r="18" fill="#fff8e7" ${S}/><path d="M41 41 l14 14" stroke="${O}" stroke-width="7" stroke-linecap="round"/><path d="M20 28 h16" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`,
  expand: `<path d="M6 16 l16 -6 20 6 16 -6 v38 l-16 6 -20 -6 -16 6z" fill="#7ed957" ${S}/><path d="M22 10 v38 M42 16 v38" stroke="${O}" stroke-width="2.5"/><circle cx="46" cy="44" r="12" fill="#2a9d8f" ${S}/><path d="M46 37 v14 M39 44 h14" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
  account: `<circle cx="32" cy="22" r="12" fill="#f6d3b3" ${S}/><path d="M10 56 q2 -22 22 -22 q20 0 22 22z" fill="#5c7cfa" ${S}/>`,
  friends: `<circle cx="22" cy="22" r="10" fill="#f6d3b3" ${S}/><circle cx="44" cy="24" r="9" fill="#c98e62" ${S}/><path d="M4 56 q2 -20 18 -20 q16 0 18 20z" fill="#ffd23f" ${S}/><path d="M30 56 q2 -18 14 -18 q13 0 16 18z" fill="#4ecdc4" ${S}/>`,
  visit: `<path d="M8 30 L32 10 L56 30 V56 H8z" fill="#fff8e7" ${S}/><rect x="26" y="38" width="12" height="18" fill="#2a9d8f" ${s2}/><path d="M4 32 L32 8 L60 32" fill="none" stroke="#2a9d8f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  help: `<path d="M8 40 q6 -10 16 -6 l10 4 q6 2 4 7 q-2 4 -8 2 l-8 -2" fill="#f6d3b3" ${S}/><path d="M56 26 q-6 10 -16 6 l-10 -4 q-6 -2 -4 -7 q2 -4 8 -2 l8 2" fill="#e8b48a" ${S}/>`,
  lock: `<rect x="12" y="28" width="40" height="30" rx="5" fill="#f2c94c" ${S}/><path d="M20 28 v-8 a12 12 0 0 1 24 0 v8" fill="none" stroke="${O}" stroke-width="5"/><circle cx="32" cy="41" r="4" fill="${O}"/><path d="M32 43 v6" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`,
  info: `<circle cx="32" cy="32" r="24" fill="#5c7cfa" ${S}/><circle cx="32" cy="20" r="4" fill="#fff"/><path d="M32 29 v16" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`,
  warning: `<path d="M32 6 L60 56 H4z" fill="#ffd23f" ${S}/><path d="M32 22 v16" stroke="${O}" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="47" r="3.5" fill="${O}"/>`,
  ship: `<path d="M6 38 h52 l-8 16 h-36z" fill="#e8574a" ${S}/><rect x="16" y="24" width="30" height="14" fill="#fff8e7" ${S}/><path d="M24 24 v-12 h10 v12" fill="#ffd23f" ${S}/><path d="M4 58 q7 -4 14 0 t14 0 14 0 14 0" fill="none" stroke="#3fa7d6" stroke-width="3"/>`,
  train: `<rect x="8" y="22" width="30" height="24" rx="3" fill="#c8483c" ${S}/><rect x="34" y="12" width="22" height="34" rx="3" fill="#2a9d8f" ${S}/><rect x="39" y="17" width="12" height="10" fill="#8fd3f4" ${s2}/><path d="M14 22 v-10 h8 v10" fill="#2b2b35" ${s2}/><circle cx="18" cy="50" r="6" fill="#2b2b35" ${s2}/><circle cx="46" cy="50" r="6" fill="#2b2b35" ${s2}/>`,
  wonder: `<path d="M32 4 l6 18 18 2 -14 11 5 18 -15 -10 -15 10 5 -18 -14 -11 18 -2z" fill="#ffd23f" ${S}/><circle cx="12" cy="12" r="3" fill="#ffd23f"/><circle cx="54" cy="50" r="3" fill="#ffd23f"/>`,
  sparkle: `<path d="M32 4 q3 25 28 28 q-25 3 -28 28 q-3 -25 -28 -28 q25 -3 28 -28z" fill="#fff6b0" stroke="#f2c94c" stroke-width="2.5"/>`,
  upgrade: `<path d="M32 6 l20 22 h-12 v26 h-16 v-26 h-12z" fill="#5cb043" ${S}/>`,
  star: `<path d="M32 4 l8.2 17.4 19 2.2 -14 13 3.9 18.8 -17.1 -9.6 -17.1 9.6 3.9 -18.8 -14 -13 19 -2.2z" fill="#ffd23f" ${S}/>`,
  starEmpty: `<path d="M32 4 l8.2 17.4 19 2.2 -14 13 3.9 18.8 -17.1 -9.6 -17.1 9.6 3.9 -18.8 -14 -13 19 -2.2z" fill="#e8dcc4" ${S}/>`,
  trophy: `<path d="M18 8 h28 v14 a14 14 0 0 1 -28 0z" fill="#ffd23f" ${S}/><path d="M18 12 h-8 q0 14 10 14 M46 12 h8 q0 14 -10 14" fill="none" ${S}/><path d="M28 36 h8 v10 h-8z" fill="#f2b705" ${S}/><rect x="18" y="46" width="28" height="10" rx="2" fill="#a5703f" ${S}/>`,
  leaderboard: `<rect x="6" y="30" width="16" height="26" fill="#9aa6b8" ${S}/><rect x="24" y="16" width="16" height="40" fill="#ffd23f" ${S}/><rect x="42" y="38" width="16" height="18" fill="#d9a066" ${S}/>`,
  franchise: `<path d="M8 28 L32 10 L56 28 V56 H8z" fill="#ffd23f" ${S}/><path d="M8 28 h48" stroke="${O}" stroke-width="3"/><path d="M18 40 l6 -6 6 6 6 -6 6 6 6 -6" fill="none" stroke="#e8574a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  event: `<path d="M32 58 q-22 -12 -14 -32 q6 8 10 4 q-4 -14 8 -24 q2 14 12 18 q12 10 2 26 q-6 8 -18 8z" fill="#ff8a3d" ${S}/><path d="M32 52 q-8 -6 -2 -16 q4 6 8 2 q6 8 -6 14z" fill="#ffd23f"/>`,
  fullscreen: `<path d="M10 24 v-14 h14 M40 10 h14 v14 M54 40 v14 h-14 M24 54 h-14 v-14" fill="none" stroke="${O}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  // ---- world overlays
  moneybag: `<path d="M22 16 q10 -6 20 0 l-4 6 h-12z" fill="#c9a26b" ${S}/><path d="M26 22 q-18 10 -16 26 q2 10 22 10 q20 0 22 -10 q2 -16 -16 -26z" fill="#d9b67a" ${S}/><circle cx="32" cy="42" r="9" fill="url(#cg)" ${s2}/><path d="M32 36 v12 M29 39 h6" stroke="#c9890f" stroke-width="2.5" stroke-linecap="round"/>${coinG}`,
  needGoods: `<circle cx="32" cy="32" r="27" fill="#fff8e7" ${S}/><rect x="17" y="22" width="30" height="24" rx="3" fill="#c48a4a" ${S}/><path d="M17 31 h30 M27 22 v24 M37 22 v24" stroke="#8a5a2b" stroke-width="2.5"/>`,
  rentReady: `<circle cx="32" cy="32" r="27" fill="#fff8e7" ${S}/>${coinG}<circle cx="32" cy="32" r="16" fill="url(#cg)" ${s2}/><path d="M32 24 l2.5 5 5.5 .8 -4 3.8 1 5.4 -5 -2.6 -5 2.6 1 -5.4 -4 -3.8 5.5 -.8z" fill="#fff2a8"/>`,
  profitReady: `<circle cx="32" cy="32" r="27" fill="#fff8e7" ${S}/><path d="M32 14 l5 11 12 1.5 -9 8 2.5 12 -10.5 -6 -10.5 6 2.5 -12 -9 -8 12 -1.5z" fill="#3b8fe0" ${s2}/>`,
  balloons: `<path d="M22 34 q4 10 10 24 M42 30 q-4 12 -10 28 M32 26 v32" stroke="${O}" stroke-width="1.5" fill="none"/><ellipse cx="20" cy="22" rx="10" ry="13" fill="#ff5d7a" ${s2}/><ellipse cx="44" cy="20" rx="10" ry="13" fill="#4ecdc4" ${s2}/><ellipse cx="32" cy="14" rx="10" ry="13" fill="#ffd23f" ${s2}/><path d="M16 14 q2 -4 6 -4" stroke="#fff" stroke-width="2.5" fill="none"/>`,
  hardhat: `<circle cx="32" cy="32" r="27" fill="#fff8e7" ${S}/><path d="M14 40 q0 -20 18 -20 q18 0 18 20z" fill="#ffd23f" ${S}/><rect x="10" y="38" width="44" height="7" rx="3.5" fill="#f2b705" ${S}/>`,
  hammer: `<circle cx="32" cy="32" r="27" fill="#fff8e7" ${S}/><path d="M24 46 l14 -14" stroke="#a5703f" stroke-width="7" stroke-linecap="round"/><path d="M30 18 l10 -6 12 12 -6 10z" fill="#9aa6b8" ${S}/>`,
  noRoad: `<circle cx="32" cy="32" r="27" fill="#fff8e7" stroke="#e8574a" stroke-width="5"/><path d="M20 46 l8 -28 h8 l8 28z" fill="#6b6e73" ${s2}/><path d="M32 22 v4 M32 31 v4 M32 40 v4" stroke="#fff" stroke-width="2"/><path d="M14 50 L50 14" stroke="#e8574a" stroke-width="6" stroke-linecap="round"/>`,
  ripe: `<circle cx="32" cy="32" r="27" fill="#fff8e7" ${S}/><path d="M32 12 q2.5 15 18 18 q-15.5 2.5 -18 18 q-2.5 -15.5 -18 -18 q15.5 -3 18 -18z" fill="#ffd23f" stroke="#f2b705" stroke-width="2"/>`,
  withered: `<circle cx="32" cy="32" r="27" fill="#fff8e7" ${S}/><path d="M32 48 q-2 -16 8 -26 M32 34 q-10 -6 -14 -2" fill="none" stroke="#8b6a3e" stroke-width="4" stroke-linecap="round"/><ellipse cx="42" cy="20" rx="6" ry="3" fill="#a3804d" transform="rotate(-30 42 20)"/>`,
  helpMark: `<circle cx="32" cy="32" r="27" fill="#e3f2ff" stroke="#2f6db5" stroke-width="4"/><path d="M32 50 C14 38 15 22 25 20 c4 -1 7 2 7 5 c0 -3 3 -6 7 -5 c10 2 11 18 -7 30z" fill="#5aa9ff" ${S}/>`,
  shipReady: `<circle cx="32" cy="32" r="27" fill="#fff8e7" ${S}/><path d="M14 34 h36 l-6 12 h-24z" fill="#e8574a" ${s2}/><rect x="22" y="22" width="20" height="12" fill="#c48a4a" ${s2}/>`,
  // ---- parts used as pickups
  part: `<circle cx="32" cy="32" r="24" fill="#9aa6b8" ${S}/><path d="M22 32 h20 M32 22 v20" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
};

// --------------------------------------------------------- collectibles --

const C: Record<string, string> = {
  berry_basket: `<path d="M10 30 h44 l-6 24 h-32z" fill="#d9a066" ${S}/><path d="M16 30 q16 -26 32 0" fill="none" stroke="${O}" stroke-width="4"/><circle cx="22" cy="28" r="5" fill="#e8384f" ${s2}/><circle cx="32" cy="26" r="5" fill="#e8384f" ${s2}/><circle cx="42" cy="28" r="5" fill="#e8384f" ${s2}/><path d="M14 40 h36 M18 48 h28" stroke="#a5703f" stroke-width="2.5"/>`,
  jam_jar: `<rect x="16" y="20" width="32" height="36" rx="6" fill="#d7263d" ${S}/><rect x="14" y="12" width="36" height="10" rx="3" fill="#fff8e7" ${S}/><path d="M14 14 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 4 0" fill="#ff8fb1"/><rect x="22" y="30" width="20" height="14" rx="3" fill="#fff8e7" ${s2}/>`,
  berry_pie: `<ellipse cx="32" cy="40" rx="26" ry="12" fill="#d9954a" ${S}/><ellipse cx="32" cy="36" rx="24" ry="10" fill="#b22d4a" ${s2}/><path d="M14 32 l36 8 M14 40 l36 -8 M22 28 l20 16 M42 28 l-20 16" stroke="#f0c070" stroke-width="3"/>`,
  garden_gloves: `<path d="M18 56 v-26 q-6 -4 -4 -10 l6 6 v-16 q0 -4 4 -4 t4 4 v12 v-14 q0 -4 4 -4 t4 4 v14 v-10 q0 -4 4 -4 t4 4 v26 q0 10 -10 14z" fill="#7ed957" ${S}/><path d="M18 46 h24" stroke="#5cb043" stroke-width="3"/>`,
  watering_can: `<rect x="14" y="26" width="28" height="26" rx="4" fill="#4ecdc4" ${S}/><path d="M42 34 l16 -12" stroke="${O}" stroke-width="6" stroke-linecap="round"/><path d="M42 34 l16 -12" stroke="#4ecdc4" stroke-width="3" stroke-linecap="round"/><path d="M20 26 q8 -14 16 0" fill="none" stroke="${O}" stroke-width="4"/>`,
  corn_cob: `<path d="M32 6 q14 6 12 28 q-2 18 -12 24 q-10 -6 -12 -24 q-2 -22 12 -28z" fill="#f6d34a" ${S}/><path d="M26 18 h12 M24 26 h16 M24 34 h16 M26 42 h12" stroke="#e0b52e" stroke-width="2"/><path d="M20 30 q-6 16 12 28 q-16 -2 -16 -20z M44 30 q6 16 -12 28 q16 -2 16 -20z" fill="#7ed957" ${s2}/>`,
  wheat_sheaf: `<path d="M32 58 v-30 M32 40 l-12 -20 M32 40 l12 -20" stroke="#c9a64a" stroke-width="4" stroke-linecap="round"/><ellipse cx="32" cy="18" rx="5" ry="10" fill="#e9c46a" ${s2}/><ellipse cx="18" cy="16" rx="5" ry="9" fill="#e9c46a" ${s2} transform="rotate(-25 18 16)"/><ellipse cx="46" cy="16" rx="5" ry="9" fill="#e9c46a" ${s2} transform="rotate(25 46 16)"/><rect x="24" y="40" width="16" height="6" fill="#c8483c" ${s2}/>`,
  straw_hat: `<ellipse cx="32" cy="42" rx="28" ry="10" fill="#f6e3a1" ${S}/><path d="M18 40 q0 -22 14 -22 q14 0 14 22z" fill="#f6e3a1" ${S}/><path d="M18 36 h28" stroke="#e8574a" stroke-width="5"/>`,
  pitchfork: `<path d="M32 60 v-34" stroke="#a5703f" stroke-width="6" stroke-linecap="round"/><path d="M18 8 v14 q0 6 14 6 q14 0 14 -6 v-14 M32 8 v20" fill="none" stroke="#8a96a3" stroke-width="4" stroke-linecap="round"/>`,
  scarecrow: `<path d="M10 30 h44" stroke="#a5703f" stroke-width="5" stroke-linecap="round"/><path d="M32 30 v28" stroke="#a5703f" stroke-width="5"/><circle cx="32" cy="22" r="10" fill="#f6e3a1" ${S}/><path d="M18 14 h28 l-4 -8 h-20z" fill="#7a4e2d" ${S}/><circle cx="28" cy="22" r="1.8" fill="${O}"/><circle cx="36" cy="22" r="1.8" fill="${O}"/><path d="M28 27 q4 3 8 0" stroke="${O}" stroke-width="2" fill="none"/><path d="M20 32 h24 l-4 16 h-16z" fill="#e8574a" ${S}/>`,
  teapot: `<ellipse cx="30" cy="38" rx="18" ry="15" fill="#4ecdc4" ${S}/><path d="M48 36 q10 -2 12 -12" stroke="${O}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M48 36 q10 -2 12 -12" stroke="#4ecdc4" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M12 32 q-8 4 0 14" fill="none" ${S}/><ellipse cx="30" cy="23" rx="10" ry="4" fill="#3bb3aa" ${s2}/><circle cx="30" cy="18" r="3" fill="#ffd23f" ${s2}/>`,
  slippers: `<path d="M8 40 q0 -14 14 -14 h10 q4 0 4 6 v14 q-6 6 -20 6 q-8 0 -8 -12z" fill="#ff8fb1" ${S}/><path d="M28 30 q8 -2 8 8" fill="#fff8e7" ${s2}/><path d="M30 46 q0 -14 14 -14 h6 q6 0 6 6 v12 q-6 6 -18 6 q-8 0 -8 -10z" fill="#ff6f9a" ${S}/>`,
  house_key: `<circle cx="20" cy="22" r="12" fill="#f2c94c" ${S}/><path d="M14 18 l6 -6 6 6 v8 h-12z" fill="#fff8e7" ${s2}/><path d="M28 30 l22 22 M40 42 l6 -6 M46 48 l6 -6" stroke="${O}" stroke-width="7" stroke-linecap="round"/><path d="M28 30 l22 22 M40 42 l6 -6 M46 48 l6 -6" stroke="#f2c94c" stroke-width="4" stroke-linecap="round"/>`,
  quilt: `<rect x="10" y="10" width="44" height="44" rx="4" fill="#fff8e7" ${S}/><rect x="10" y="10" width="22" height="22" fill="#ff8fb1"/><rect x="32" y="32" width="22" height="22" fill="#ff8fb1"/><rect x="32" y="10" width="22" height="22" fill="#4ecdc4"/><rect x="10" y="32" width="22" height="22" fill="#ffd23f"/><rect x="10" y="10" width="44" height="44" rx="4" fill="none" ${S} stroke-dasharray="4 3"/>`,
  fern: `<path d="M20 44 h24 l-4 14 h-16z" fill="#d9744a" ${S}/><path d="M32 44 q-4 -20 -18 -28 M32 44 q2 -24 0 -36 M32 44 q6 -20 18 -28" fill="none" stroke="#3f9a3a" stroke-width="4" stroke-linecap="round"/><path d="M22 26 l-6 2 M20 22 l-4 -4 M32 20 l-5 -2 M32 14 l5 -2 M42 26 l6 2 M44 22 l4 -4" stroke="#7ed957" stroke-width="3" stroke-linecap="round"/>`,
  rolling_pin: `<rect x="14" y="24" width="36" height="16" rx="8" fill="#e9c08a" ${S}/><path d="M4 32 h10 M50 32 h10" stroke="${O}" stroke-width="7" stroke-linecap="round"/><path d="M4 32 h10 M50 32 h10" stroke="#a5703f" stroke-width="4" stroke-linecap="round"/>`,
  whisk: `<path d="M32 60 v-20" stroke="#a5703f" stroke-width="7" stroke-linecap="round"/><path d="M32 40 q-16 -12 0 -34 q16 22 0 34 M32 40 q-6 -14 0 -34 q6 20 0 34" fill="none" stroke="#8a96a3" stroke-width="3"/>`,
  flour_sack: `<path d="M16 20 q16 -10 32 0 q6 18 -2 36 h-28 q-8 -18 -2 -36z" fill="#fff8e7" ${S}/><path d="M22 16 q10 -6 20 0" stroke="#a5703f" stroke-width="4" fill="none"/><path d="M26 34 q6 -10 12 0 q-6 10 -12 0z" fill="#e9c46a" ${s2}/>`,
  cupcake: `<path d="M16 34 h32 l-5 22 h-22z" fill="#4ecdc4" ${S}/><path d="M14 34 q0 -12 10 -12 q2 -10 8 -10 q6 0 8 10 q10 0 10 12z" fill="#ffc2d9" ${S}/><circle cx="32" cy="10" r="4" fill="#d7263d" ${s2}/>`,
  pretzel: `<path d="M20 50 q-14 -6 -10 -22 q4 -14 22 -4 q18 -10 22 4 q4 16 -10 22 M24 50 l18 -24 M40 50 l-18 -24" fill="none" stroke="${O}" stroke-width="10" stroke-linecap="round"/><path d="M20 50 q-14 -6 -10 -22 q4 -14 22 -4 q18 -10 22 4 q4 16 -10 22 M24 50 l18 -24 M40 50 l-18 -24" fill="none" stroke="#c97a3a" stroke-width="6" stroke-linecap="round"/>`,
  tulip: `<path d="M32 58 v-26" stroke="#3f9a3a" stroke-width="4"/><path d="M32 46 q-12 -2 -14 -12 q10 0 14 8" fill="#7ed957" ${s2}/><path d="M18 14 l7 6 7 -10 7 10 7 -6 v12 q0 12 -14 12 q-14 0 -14 -12z" fill="#ff5d7a" ${S}/>`,
  daisy: `<path d="M32 58 v-22" stroke="#3f9a3a" stroke-width="4"/>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<ellipse cx="32" cy="14" rx="5" ry="10" fill="#ffffff" ${s2} transform="rotate(${a} 32 26)"/>`).join('')}<circle cx="32" cy="26" r="7" fill="#ffd23f" ${s2}/>`,
  rose: `<path d="M32 58 v-24" stroke="#3f9a3a" stroke-width="4"/><circle cx="32" cy="24" r="16" fill="#e8384f" ${S}/><path d="M32 14 q10 4 6 12 q-6 6 -12 0 q-2 -6 6 -6" fill="none" stroke="#a3172e" stroke-width="2.5"/><path d="M32 46 q10 -2 12 -10 q-10 0 -12 6" fill="#7ed957" ${s2}/>`,
  sunflower: `<path d="M32 60 v-22" stroke="#3f9a3a" stroke-width="4"/>${[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => `<ellipse cx="32" cy="12" rx="4" ry="9" fill="#ffd23f" ${s2} transform="rotate(${a} 32 24)"/>`).join('')}<circle cx="32" cy="24" r="9" fill="#7a4e2d" ${s2}/>`,
  lavender: `<path d="M24 58 l6 -40 M34 58 l2 -44 M42 58 l-4 -38" stroke="#3f9a3a" stroke-width="3" stroke-linecap="round"/>${[[30, 20], [29, 26], [31, 32], [36, 14], [36, 20], [36, 26], [38, 22], [39, 28], [40, 34]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="4" fill="#b98cf0" stroke="${O}" stroke-width="1.2"/>`).join('')}<rect x="20" y="44" width="24" height="6" rx="2" fill="#ff8fb1" ${s2}/>`,
  spinning_top: `<path d="M8 28 q24 -18 48 0 l-24 30z" fill="#ff6b6b" ${S}/><path d="M14 30 q18 -10 36 0" stroke="#ffd23f" stroke-width="5" fill="none"/><path d="M32 6 v14" stroke="${O}" stroke-width="6" stroke-linecap="round"/><path d="M32 6 v14" stroke="#a5703f" stroke-width="3" stroke-linecap="round"/>`,
  yoyo: `<circle cx="34" cy="38" r="20" fill="#5c7cfa" ${S}/><circle cx="34" cy="38" r="8" fill="#ffd23f" ${s2}/><path d="M34 38 Q20 10 10 4" stroke="${O}" stroke-width="2" fill="none"/>`,
  toy_blocks: `<rect x="6" y="32" width="24" height="24" rx="3" fill="#ff6b6b" ${S}/><rect x="32" y="32" width="24" height="24" rx="3" fill="#4ecdc4" ${S}/><rect x="19" y="8" width="24" height="24" rx="3" fill="#ffd23f" ${S}/><circle cx="18" cy="44" r="5" fill="#fff8e7"/><path d="M38 38 l12 12 M50 38 l-12 12" stroke="#fff8e7" stroke-width="3"/><path d="M31 14 l6 12 h-12z" fill="#fff8e7"/>`,
  rubber_duck: `<path d="M10 40 q0 16 22 16 q22 0 22 -16 q0 -8 -10 -8 h-14 q-20 0 -20 8z" fill="#ffd23f" ${S}/><circle cx="40" cy="22" r="12" fill="#ffd23f" ${S}/><path d="M50 22 l10 2 -10 4z" fill="#ff8a3d" ${s2}/><circle cx="43" cy="19" r="2.2" fill="${O}"/>`,
  kite: `<path d="M34 4 l22 22 -22 22 -22 -22z" fill="#ff5d7a" ${S}/><path d="M34 4 v44 M12 26 h44" stroke="${O}" stroke-width="2"/><path d="M34 4 l22 22 h-22z" fill="#ffd23f"/><path d="M34 48 q-6 4 -2 8 q4 4 -2 8" stroke="${O}" stroke-width="2" fill="none"/>`,
  milkshake: `<path d="M18 22 h28 l-5 34 h-18z" fill="#ffc2d9" ${S}/><path d="M16 22 q4 -12 16 -12 q12 0 16 12z" fill="#fffaf0" ${S}/><circle cx="32" cy="8" r="4" fill="#d7263d" ${s2}/><path d="M40 4 l-6 18" stroke="#e8574a" stroke-width="3"/>`,
  ketchup: `<path d="M24 16 h16 v6 q8 4 8 12 v18 q0 6 -6 6 h-20 q-6 0 -6 -6 v-18 q0 -8 8 -12z" fill="#d7263d" ${S}/><path d="M28 16 v-8 h8 v8" fill="#fff8e7" ${s2}/><path d="M24 36 q8 -6 16 0 q-8 8 -16 0z" fill="#7ed957" ${s2}/>`,
  jukebox: `<path d="M10 58 v-30 q0 -22 22 -22 q22 0 22 22 v30z" fill="#ff8a3d" ${S}/><path d="M18 34 q0 -16 14 -16 q14 0 14 16 v8 h-28z" fill="#ffd23f" ${s2}/><rect x="18" y="46" width="28" height="8" rx="2" fill="#5c7cfa" ${s2}/>`,
  pie_slice: `<path d="M8 44 L52 22 q6 12 4 26z" fill="#ffd9a0" ${S}/><path d="M8 44 L52 22" stroke="#c97a3a" stroke-width="6" stroke-linecap="round"/><path d="M20 44 q8 -6 14 -8" stroke="#ff8fb1" stroke-width="3" fill="none"/><circle cx="46" cy="16" r="5" fill="#d7263d" ${s2}/>`,
  neon_sign: `<rect x="6" y="14" width="52" height="36" rx="8" fill="#2b2b35" ${S}/><path d="M32 20 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1z" fill="none" stroke="#ff6fa3" stroke-width="3"/><path d="M32 20 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1z" fill="none" stroke="#ffd1e6" stroke-width="1"/>`,
  ribbon_scissors: `<path d="M4 20 h56" stroke="#e8574a" stroke-width="8"/><circle cx="20" cy="48" r="8" fill="none" ${S}/><circle cx="40" cy="48" r="8" fill="none" ${S}/><path d="M24 42 l14 -28 M36 42 l-14 -28" stroke="#8a96a3" stroke-width="5" stroke-linecap="round"/>`,
  gavel: `<rect x="14" y="10" width="30" height="16" rx="4" fill="#a5703f" ${S} transform="rotate(-30 29 18)"/><path d="M32 26 l18 26" stroke="${O}" stroke-width="7" stroke-linecap="round"/><path d="M32 26 l18 26" stroke="#c97a3a" stroke-width="4" stroke-linecap="round"/><rect x="8" y="50" width="26" height="8" rx="3" fill="#7a4e2d" ${s2}/>`,
  medal: `<path d="M20 4 l12 22 12 -22" fill="none" stroke="#5c7cfa" stroke-width="8"/><circle cx="32" cy="40" r="16" fill="#ffd23f" ${S}/><path d="M32 30 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" fill="#fff2a8" ${s2}/>`,
  megaphone: `<path d="M12 26 l30 -14 v40 l-30 -14z" fill="#e8574a" ${S}/><rect x="6" y="24" width="10" height="16" rx="3" fill="#fff8e7" ${s2}/><path d="M48 24 q6 8 0 16 M54 18 q10 14 0 28" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>`,
  golden_key: `<circle cx="18" cy="32" r="12" fill="#ffd23f" ${S}/><circle cx="18" cy="32" r="5" fill="#f2b705"/><path d="M30 28 h28 v8 h-4 v8 h-7 v-8 h-17z" fill="#ffd23f" ${S}/><path d="M8 14 l4 4 M18 8 v5 M28 14 l-4 4" stroke="#f2b705" stroke-width="2.5" stroke-linecap="round"/>`,
  anchor: `<circle cx="32" cy="12" r="6" fill="none" ${S}/><path d="M32 18 v38 M20 26 h24 M10 40 q2 18 22 18 q20 0 22 -18" fill="none" stroke="${O}" stroke-width="7" stroke-linecap="round"/><path d="M32 18 v38 M20 26 h24 M10 40 q2 18 22 18 q20 0 22 -18" fill="none" stroke="#5b6b7a" stroke-width="4" stroke-linecap="round"/>`,
  compass: `<circle cx="32" cy="32" r="24" fill="#f6c033" ${S}/><circle cx="32" cy="32" r="18" fill="#fff8e7" ${s2}/><path d="M32 16 l5 16 -5 16 -5 -16z" fill="#e8574a" ${s2}/><path d="M32 32 l5 0 -5 16 -5 -16z" fill="#5b6b7a"/>`,
  spyglass: `<path d="M8 46 l40 -24" stroke="${O}" stroke-width="16" stroke-linecap="round"/><path d="M8 46 l40 -24" stroke="#a5703f" stroke-width="12" stroke-linecap="round"/><path d="M30 33 l20 -12" stroke="#f2c94c" stroke-width="13"/><circle cx="54" cy="18" r="5" fill="#8fd3f4" ${s2}/>`,
  ship_bottle: `<path d="M18 22 h28 q8 0 8 10 v16 q0 10 -10 10 h-24 q-10 0 -10 -10 v-16 q0 -10 8 -10z" fill="#bfe8f6" ${S}/><path d="M26 22 v-8 h12 v8" fill="#a5703f" ${s2}/><path d="M18 46 h28 l-4 6 h-20z" fill="#e8574a"/><path d="M32 46 v-16 l10 12z" fill="#fff8e7" ${s2}/>`,
  seashell: `<path d="M32 56 L10 26 q22 -26 44 0z" fill="#ffc2a8" ${S}/><path d="M32 56 L20 14 M32 56 L32 10 M32 56 L44 14 M32 56 L14 22 M32 56 L50 22" stroke="#e08c6a" stroke-width="2.5"/>`,
  ticket: `<path d="M6 18 h52 v10 a4 4 0 0 0 0 8 v10 h-52 v-10 a4 4 0 0 0 0 -8z" fill="#ffd23f" ${S}/><path d="M42 18 v28" stroke="${O}" stroke-width="2" stroke-dasharray="3 3"/><path d="M14 28 h20 M14 36 h14" stroke="#c99a2e" stroke-width="3" stroke-linecap="round"/>`,
  lantern: `<path d="M24 8 h16 M32 4 v4" stroke="${O}" stroke-width="3" stroke-linecap="round"/><rect x="18" y="12" width="28" height="8" rx="2" fill="#5b6b7a" ${s2}/><rect x="20" y="20" width="24" height="28" fill="#ffe28a" ${S}/><path d="M32 26 q6 6 0 14 q-6 -8 0 -14z" fill="#ff8a3d"/><rect x="16" y="48" width="32" height="8" rx="2" fill="#5b6b7a" ${s2}/>`,
  whistle: `<path d="M8 30 h28 a14 14 0 1 1 -14 14 v-6 h-14z" fill="#9aa6b8" ${S}/><circle cx="36" cy="44" r="5" fill="#5b6b7a"/><path d="M44 20 l6 -8 M50 26 l8 -4" stroke="${O}" stroke-width="3" stroke-linecap="round"/>`,
  conductor_cap: `<path d="M10 40 v-18 q22 -10 44 0 v18z" fill="#2f4858" ${S}/><path d="M6 40 h40 q14 0 14 6 h-54z" fill="#2b2b35" ${S}/><rect x="26" y="24" width="12" height="8" rx="2" fill="#ffd23f" ${s2}/>`,
  pocket_watch: `<circle cx="32" cy="36" r="22" fill="#f6c033" ${S}/><circle cx="32" cy="36" r="16" fill="#fff8e7" ${s2}/><path d="M32 36 v-10 M32 36 l7 4" stroke="${O}" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="10" r="4" fill="none" ${S}/>`,
  acorn: `<path d="M16 28 q16 -16 32 0 v4 h-32z" fill="#7a4e2d" ${S}/><path d="M18 32 h28 q0 22 -14 26 q-14 -4 -14 -26z" fill="#c97a3a" ${S}/><path d="M32 12 v-6" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`,
  maple_leaf: `<path d="M32 58 v-12 M32 46 l-6 2 2 -8 -14 -6 6 -4 -6 -10 10 2 2 -8 6 8 0 -14 6 14 6 -8 2 8 10 -2 -6 10 6 4 -14 6 2 8z" fill="#ff7a29" ${S}/>`,
  cider: `<path d="M18 16 h28 v34 q0 8 -8 8 h-12 q-8 0 -8 -8z" fill="#e9a84c" ${S}/><path d="M46 24 h6 q6 0 6 8 v6 q0 8 -6 8 h-6" fill="none" ${S}/><path d="M18 22 h28" stroke="#fff8e7" stroke-width="6"/><circle cx="32" cy="38" r="6" fill="#e3343f" ${s2}/>`,
  corn_doll: `<path d="M32 10 q10 0 10 10 q0 8 -10 10 q-10 -2 -10 -10 q0 -10 10 -10z" fill="#e9c46a" ${S}/><path d="M22 30 h20 l8 28 h-36z" fill="#e9c46a" ${S}/><path d="M22 36 h20" stroke="#e8574a" stroke-width="4"/><path d="M26 40 l-4 18 M32 40 v18 M38 40 l4 18" stroke="#c9a64a" stroke-width="2"/>`,
  hay_bale: `<rect x="6" y="20" width="52" height="34" rx="6" fill="#e9c46a" ${S}/><path d="M20 20 v34 M44 20 v34" stroke="#a5703f" stroke-width="4"/><path d="M10 30 h8 M26 38 h12 M48 28 h6 M12 46 h6" stroke="#c9a64a" stroke-width="2.5" stroke-linecap="round"/>`,
  // Winter Lights
  mitten: `<path d="M18 56 v-26 q-2 -18 14 -20 q16 0 16 18 v28z" fill="#e8574a" ${S}/><path d="M44 30 q10 -4 10 6 q0 8 -10 8" fill="#e8574a" ${S}/><rect x="16" y="48" width="34" height="10" rx="3" fill="#fff8e7" ${S}/><path d="M22 30 l4 4 4 -4 4 4 4 -4" fill="none" stroke="#fff8e7" stroke-width="2.5" stroke-linecap="round"/>`,
  cocoa: `<path d="M14 24 h32 v22 q0 10 -10 10 h-12 q-10 0 -10 -10z" fill="#4ecdc4" ${S}/><path d="M46 28 h4 q8 0 8 8 q0 8 -8 8 h-4" fill="none" ${S}/><ellipse cx="30" cy="24" rx="16" ry="4" fill="#7a4e2d" ${s2}/><circle cx="25" cy="22" r="3" fill="#fff8e7" ${s2}/><circle cx="33" cy="21" r="3" fill="#fff8e7" ${s2}/><path d="M24 14 q2 -6 0 -10 M32 14 q2 -6 0 -10" fill="none" stroke="#c9b8a6" stroke-width="2.5" stroke-linecap="round"/>`,
  snow_globe: `<circle cx="32" cy="28" r="20" fill="#cdeefc" ${S}/><path d="M22 40 q10 -14 20 0z" fill="#ffffff" ${s2}/><path d="M32 18 l5 10 h-10z" fill="#3f8a2c" ${s2}/><circle cx="24" cy="20" r="1.6" fill="#fff"/><circle cx="40" cy="24" r="1.6" fill="#fff"/><circle cx="30" cy="12" r="1.6" fill="#fff"/><path d="M14 46 h36 l-4 12 h-28z" fill="#a5703f" ${S}/>`,
  candle: `<rect x="22" y="24" width="20" height="32" rx="3" fill="#fff4e0" ${S}/><path d="M22 34 h20" stroke="#e8574a" stroke-width="3"/><path d="M32 24 v-5" stroke="${O}" stroke-width="2"/><path d="M32 4 q8 8 0 15 q-8 -7 0 -15z" fill="#ffd23f" ${s2}/><path d="M32 9 q3 4 0 7 q-3 -3 0 -7z" fill="#fff6b0"/><ellipse cx="32" cy="57" rx="16" ry="4" fill="#c9b8a6" ${s2}/>`,
  star_ornament: `<path d="M32 6 v8" stroke="${O}" stroke-width="2"/><circle cx="32" cy="16" r="3" fill="#d4a017" ${s2}/><path d="M32 20 l7 14 15 2 -11 10 3 15 -14 -8 -14 8 3 -15 -11 -10 15 -2z" fill="#ffd23f" ${S}/><path d="M32 30 l3 6 6 1" fill="none" stroke="#fff6b0" stroke-width="2.5" stroke-linecap="round"/>`,
};
Object.assign(ICONS, C);

export const COLLECTIBLE_ICONS = Object.keys(C);

// --------------------------------------------------------------- portraits --

interface Face {
  bg: string;
  skin: string;
  hair: string;
  style: 'bun' | 'short' | 'bald' | 'curly' | 'long' | 'bob' | 'spiky';
  hat?: 'straw' | 'captain' | 'beekeeper' | 'chef' | 'sailor' | 'beret' | 'helmet' | 'pith' | 'cap' | 'beanie' | 'sunhat' | 'phones';
  glasses?: boolean;
  beard?: string;
  mustache?: boolean;
  freckles?: boolean;
  bow?: boolean;
  earrings?: boolean;
  shirt: string;
}

function portrait(f: Face): string {
  const parts: string[] = [];
  parts.push(`<circle cx="32" cy="32" r="31" fill="${f.bg}"/>`);
  parts.push(`<path d="M8 64 q4 -18 24 -18 q20 0 24 18z" fill="${f.shirt}" ${s2}/>`);
  if (f.bow) parts.push(`<path d="M26 48 l6 3 6 -3 v6 l-6 -3 -6 3z" fill="#e8574a" ${s2}/>`);
  if (f.style === 'long' || f.style === 'bob') parts.push(`<path d="M14 30 q0 -18 18 -18 q18 0 18 18 v${f.style === 'long' ? 20 : 10} h-36z" fill="${f.hair}" ${s2}/>`);
  parts.push(`<ellipse cx="32" cy="31" rx="14" ry="16" fill="${f.skin}" ${s2}/>`);
  if (f.earrings) parts.push(`<circle cx="18" cy="38" r="2.5" fill="#ffd23f"/><circle cx="46" cy="38" r="2.5" fill="#ffd23f"/>`);
  if (f.beard) parts.push(`<path d="M19 34 q0 16 13 16 q13 0 13 -16 q-4 6 -13 6 q-9 0 -13 -6z" fill="${f.beard}" ${s2}/>`);
  // eyes + smile
  parts.push(`<ellipse cx="26" cy="30" rx="2.2" ry="2.8" fill="${O}"/><ellipse cx="38" cy="30" rx="2.2" ry="2.8" fill="${O}"/><circle cx="26.8" cy="29" r=".8" fill="#fff"/><circle cx="38.8" cy="29" r=".8" fill="#fff"/>`);
  parts.push(`<path d="M26 38 q6 6 12 0" fill="none" stroke="${O}" stroke-width="2.2" stroke-linecap="round"/>`);
  parts.push(`<circle cx="21" cy="36" r="2.6" fill="#ff8f8f" opacity=".45"/><circle cx="43" cy="36" r="2.6" fill="#ff8f8f" opacity=".45"/>`);
  if (f.mustache) parts.push(`<path d="M24 36 q4 -3 8 0 q4 -3 8 0 q-4 3 -8 1 q-4 2 -8 -1z" fill="${f.hair}" ${s2}/>`);
  if (f.freckles) parts.push(`<circle cx="23" cy="34" r=".9" fill="#b5533c"/><circle cx="25" cy="35.5" r=".9" fill="#b5533c"/><circle cx="39" cy="35.5" r=".9" fill="#b5533c"/><circle cx="41" cy="34" r=".9" fill="#b5533c"/>`);
  if (f.glasses) parts.push(`<circle cx="26" cy="30" r="5" fill="none" stroke="${O}" stroke-width="2"/><circle cx="38" cy="30" r="5" fill="none" stroke="${O}" stroke-width="2"/><path d="M31 30 h2" stroke="${O}" stroke-width="2"/>`);
  // hair on top
  switch (f.style) {
    case 'bun':
      parts.push(`<path d="M18 26 q2 -12 14 -12 q12 0 14 12 q-8 -6 -14 -4 q-8 -2 -14 4z" fill="${f.hair}" ${s2}/><circle cx="32" cy="12" r="6" fill="${f.hair}" ${s2}/>`);
      break;
    case 'short':
      parts.push(`<path d="M18 28 q-2 -14 14 -15 q16 1 14 15 q-4 -8 -14 -8 q-10 0 -14 8z" fill="${f.hair}" ${s2}/>`);
      break;
    case 'curly':
      parts.push(`<path d="M16 30 q-4 -6 0 -10 q0 -8 8 -8 q4 -6 10 -2 q8 -2 10 4 q8 2 6 10 q4 4 0 8 q-4 -10 -18 -10 q-12 0 -16 8z" fill="${f.hair}" ${s2}/>`);
      break;
    case 'bald':
      parts.push(`<path d="M17 30 q-1 -6 3 -8 M47 30 q1 -6 -3 -8" stroke="${f.hair}" stroke-width="4" fill="none" stroke-linecap="round"/>`);
      break;
    case 'spiky':
      parts.push(`<path d="M18 26 l2 -10 4 4 3 -9 4 7 4 -8 3 8 5 -5 1 10 q-6 -6 -14 -6 q-8 0 -12 9z" fill="${f.hair}" ${s2}/>`);
      break;
    default:
      parts.push(`<path d="M18 28 q0 -14 14 -14 q14 0 14 14 q-6 -8 -14 -8 q-8 0 -14 8z" fill="${f.hair}" ${s2}/>`);
  }
  switch (f.hat) {
    case 'straw':
      parts.push(`<ellipse cx="32" cy="18" rx="22" ry="6" fill="#f6e3a1" ${s2}/><path d="M20 18 q0 -12 12 -12 q12 0 12 12z" fill="#f6e3a1" ${s2}/><path d="M20 15 h24" stroke="#e8574a" stroke-width="3"/>`);
      break;
    case 'captain':
      parts.push(`<path d="M16 18 q16 -14 32 0 v4 h-32z" fill="#ffffff" ${s2}/><path d="M14 22 h36 q-2 4 -18 4 q-16 0 -18 -4z" fill="#2b2b35" ${s2}/><circle cx="32" cy="16" r="3" fill="#ffd23f"/>`);
      break;
    case 'beekeeper':
      parts.push(`<ellipse cx="32" cy="18" rx="20" ry="5" fill="#f6f1e1" ${s2}/><path d="M20 18 q0 -12 12 -12 q12 0 12 12z" fill="#f6f1e1" ${s2}/><path d="M12 18 v14 M52 18 v14" stroke="#9aa6b8" stroke-width="1.5" stroke-dasharray="2 2"/>`);
      break;
    case 'chef':
      parts.push(`<path d="M20 20 q-8 -4 -4 -12 q4 -6 10 -2 q4 -6 12 0 q6 -4 10 2 q4 8 -4 12z" fill="#ffffff" ${s2}/><rect x="20" y="18" width="24" height="5" fill="#ffffff" ${s2}/>`);
      break;
    case 'sailor':
      parts.push(`<path d="M18 20 q14 -10 28 0 v3 h-28z" fill="#ffffff" ${s2}/><path d="M18 22 h28" stroke="#5c7cfa" stroke-width="3"/>`);
      break;
    case 'beret':
      parts.push(`<ellipse cx="30" cy="14" rx="15" ry="6" fill="#e8574a" ${s2}/><circle cx="30" cy="8" r="2" fill="#e8574a"/>`);
      break;
    case 'helmet':
      parts.push(`<path d="M16 22 q0 -16 16 -16 q16 0 16 16z" fill="#e8574a" ${s2}/><path d="M12 22 h40" stroke="${O}" stroke-width="4" stroke-linecap="round"/><path d="M12 22 h40" stroke="#c8483c" stroke-width="2" stroke-linecap="round"/><rect x="28" y="9" width="8" height="7" rx="1" fill="#ffd23f" ${s2}/>`);
      break;
    case 'pith':
      parts.push(`<ellipse cx="32" cy="19" rx="20" ry="5" fill="#d9c08a" ${s2}/><path d="M18 19 q0 -14 14 -14 q14 0 14 14z" fill="#e8d29c" ${s2}/>`);
      break;
    case 'cap':
      parts.push(`<path d="M18 20 q0 -12 14 -12 q14 0 14 12z" fill="#2a9d8f" ${s2}/><path d="M30 20 h22 q-2 4 -8 4 h-14z" fill="#2a9d8f" ${s2}/>`);
      break;
    case 'beanie':
      parts.push(`<path d="M17 22 q0 -16 15 -16 q15 0 15 16z" fill="#ff8a3d" ${s2}/><rect x="16" y="19" width="32" height="6" rx="3" fill="#ffd23f" ${s2}/><circle cx="32" cy="5" r="3.5" fill="#ffd23f" ${s2}/>`);
      break;
    case 'sunhat':
      parts.push(`<ellipse cx="32" cy="17" rx="25" ry="6.5" fill="#ff8fb1" ${s2}/><path d="M20 17 q0 -11 12 -11 q12 0 12 11z" fill="#ff8fb1" ${s2}/><path d="M20 14 h24" stroke="#ffffff" stroke-width="3"/>`);
      break;
    case 'phones':
      parts.push(`<path d="M15 32 q0 -22 17 -22 q17 0 17 22" fill="none" stroke="${O}" stroke-width="3"/><rect x="11" y="28" width="7" height="12" rx="3" fill="#5c7cfa" ${s2}/><rect x="46" y="28" width="7" height="12" rx="3" fill="#5c7cfa" ${s2}/>`);
      break;
    default:
      break;
  }
  return parts.join('');
}

export const PORTRAITS: Record<string, string> = {
  hazel: portrait({ bg: '#ffe9a8', skin: '#f6d3b3', hair: '#b5533c', style: 'bun', glasses: true, shirt: '#2a9d8f', bow: false, earrings: true }),
  barnaby: portrait({ bg: '#cdeeb0', skin: '#e8b48a', hair: '#8a8f96', style: 'short', hat: 'straw', beard: '#b9b2a2', shirt: '#5c7cfa' }),
  otis: portrait({ bg: '#ffd6c2', skin: '#a46a43', hair: '#2b2b35', style: 'bald', mustache: true, bow: true, shirt: '#ffd23f' }),
  marigold: portrait({ bg: '#c8e6ff', skin: '#f6d3b3', hair: '#e07b39', style: 'curly', hat: 'captain', freckles: true, shirt: '#2f4858' }),
  pip: portrait({ bg: '#e6dcff', skin: '#c98e62', hair: '#3b2a1e', style: 'spiky', hat: 'beanie', freckles: true, shirt: '#5cb043' }),
  rosa: portrait({ bg: '#c9f2ee', skin: '#e8b48a', hair: '#2b2b35', style: 'long', hat: 'sunhat', earrings: true, shirt: '#ff6f9a' }),
  beekeeper: portrait({ bg: '#fff1b8', skin: '#f6d3b3', hair: '#d9a441', style: 'short', hat: 'beekeeper', shirt: '#ffd23f' }),
  baker: portrait({ bg: '#ffe0e6', skin: '#e8b48a', hair: '#6b3e1f', style: 'short', hat: 'chef', mustache: true, shirt: '#ffffff' }),
  sailor: portrait({ bg: '#cfe8ff', skin: '#c98e62', hair: '#2b2b35', style: 'short', hat: 'sailor', shirt: '#5c7cfa' }),
  gardener: portrait({ bg: '#d7f5c0', skin: '#7a4a2c', hair: '#2b2b35', style: 'curly', hat: 'sunhat', shirt: '#5cb043', earrings: true }),
  painter: portrait({ bg: '#ffe2c8', skin: '#f6d3b3', hair: '#b5533c', style: 'bob', hat: 'beret', shirt: '#b98cf0' }),
  chef: portrait({ bg: '#fff3d6', skin: '#a46a43', hair: '#2b2b35', style: 'bald', hat: 'chef', beard: '#2b2b35', shirt: '#ffffff' }),
  explorer: portrait({ bg: '#efe2c0', skin: '#e8b48a', hair: '#6b3e1f', style: 'short', hat: 'pith', shirt: '#a5703f' }),
  mechanic: portrait({ bg: '#d8e2ea', skin: '#c98e62', hair: '#3b2a1e', style: 'short', hat: 'cap', shirt: '#2f4858', freckles: true }),
  musician: portrait({ bg: '#e6dcff', skin: '#7a4a2c', hair: '#2b2b35', style: 'spiky', hat: 'phones', shirt: '#ff6f9a' }),
  scientist: portrait({ bg: '#d6f3ff', skin: '#f6d3b3', hair: '#8a8f96', style: 'curly', glasses: true, shirt: '#ffffff' }),
  firefighter: portrait({ bg: '#ffd7cf', skin: '#e8b48a', hair: '#3b2a1e', style: 'short', hat: 'helmet', shirt: '#e8574a' }),
  librarian: portrait({ bg: '#f2e6ff', skin: '#a46a43', hair: '#3b2a1e', style: 'bun', glasses: true, shirt: '#3e8e8a', earrings: true }),
};

export function svgMarkup(inner: string, size = 64): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" focusable="false">${inner}</svg>`;
}

/** Inline SVG markup for an icon/portrait (empty circle if unknown). */
export function icon(name: string, size = 64): string {
  const inner = ICONS[name] ?? PORTRAITS[name] ?? `<circle cx="32" cy="32" r="24" fill="#ddd" ${S}/>`;
  return svgMarkup(inner, size);
}

export function iconDataUrl(name: string, size = 64): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon(name, size))}`;
}
