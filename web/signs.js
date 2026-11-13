// NZ 도로 표지판을 단순화해 SVG 로 그린다 (연습용 근사 — 실제 규격은 NZTA Traffic Control Devices Manual).
// sign(kind, opt) → { svg, w, h }  /  signImg(kind, opt) → 캔버스용 Image (캐시)
const F = "font-family:Arial,Helvetica,sans-serif;font-weight:700";
const T = (x, y, s, txt, fill = "#111", extra = "") => `<text x="${x}" y="${y}" font-size="${s}" text-anchor="middle" style="${F}" fill="${fill}" ${extra}>${txt}</text>`;
const wrap = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;
const diamond = (inner) => `<g><rect x="15" y="15" width="70" height="70" rx="6" transform="rotate(45 50 50)" fill="#ffd200" stroke="#111" stroke-width="4"/>${inner}</g>`;
const rectSign = (w, h, inner, bg = "#fff", border = "#111") => `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="7" fill="${bg}" stroke="${border}" stroke-width="3"/>${inner}`;
const noStopRing = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#1f4fa0" stroke="#d71920" stroke-width="${r * 0.22}"/><path d="M${cx - r * 0.62} ${cy - r * 0.62}L${cx + r * 0.62} ${cy + r * 0.62}M${cx + r * 0.62} ${cy - r * 0.62}L${cx - r * 0.62} ${cy + r * 0.62}" stroke="#d71920" stroke-width="${r * 0.2}"/>`;
const person = (x, y, s = 1, c = "#111") => `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"><circle cx="0" cy="-22" r="5" fill="${c}" stroke="none"/><path d="M0 -15L0 4M0 -10L-9 -2M0 -10L9 -4M0 4L-8 18M0 4L8 18"/></g>`;

const DEF = {
  stop: () => [100, 100, `<polygon points="30,3 70,3 97,30 97,70 70,97 30,97 3,70 3,30" fill="#d71920" stroke="#fff" stroke-width="4"/>${T(50, 61, 27, "STOP", "#fff")}`],
  giveway: () => [100, 92, `<polygon points="4,6 96,6 50,88" fill="#fff" stroke="#d71920" stroke-width="9" stroke-linejoin="round"/>${T(50, 34, 15, "GIVE")}${T(50, 51, 15, "WAY")}`],
  speed: (o) => [100, 100, `<circle cx="50" cy="50" r="46" fill="#fff" stroke="#d71920" stroke-width="9"/>${T(50, 63, String(o.n).length > 2 ? 34 : 40, o.n)}`],
  school: (o) => [100, 150, rectSign(100, 150, `${T(50, 26, 15, "SCHOOL")}<circle cx="50" cy="74" r="32" fill="#fff" stroke="#d71920" stroke-width="7"/>${T(50, 87, 34, o.n || 40)}${T(50, 124, 11, "WHEN LIGHTS")}${T(50, 139, 11, "FLASH")}<circle cx="16" cy="18" r="6" fill="#ffb400"/><circle cx="84" cy="18" r="6" fill="#ffb400"/>`)],
  schoolbus: () => [130, 60, rectSign(130, 60, `${T(65, 40, 26, "SCHOOL")}<circle cx="12" cy="30" r="6" fill="#ff8a00"/><circle cx="118" cy="30" r="6" fill="#ff8a00"/>`, "#ffd200")],
  buslane: (o) => [100, 130, rectSign(100, 130, `<rect x="8" y="8" width="84" height="56" rx="4" fill="#1f4fa0"/><rect x="26" y="18" width="48" height="30" rx="5" fill="#fff"/><rect x="30" y="22" width="40" height="11" fill="#1f4fa0"/><circle cx="36" cy="51" r="4" fill="#fff"/><circle cx="64" cy="51" r="4" fill="#fff"/>${T(50, 86, 15, "BUS LANE")}${T(50, 106, 12, o.time || "7-9AM")}${T(50, 121, 10, o.days || "MON-FRI")}`)],
  transit: (o) => [100, 130, rectSign(100, 130, `<rect x="8" y="8" width="84" height="58" rx="4" fill="#fff" stroke="#111" stroke-width="3"/>${T(50, 52, 42, "T" + (o.n || 2))}${T(50, 86, 13, "TRANSIT")}${T(50, 104, 12, o.time || "7-9AM")}${T(50, 120, 10, `${o.n || 2}+ 탑승`)}`)],
  clearway: (o) => [100, 130, rectSign(100, 130, `${noStopRing(50, 38, 27)}${T(50, 88, 15, "CLEARWAY")}${T(50, 108, 13, o.time || "7-9AM")}${T(50, 123, 10, o.days || "MON-FRI")}`)],
  park: (o) => [100, 120, rectSign(100, 120, `${T(50, 62, 46, "P" + (o.n || 60), "#0a7a3b")}${T(50, 92, 12, o.time || "8AM-6PM")}${T(50, 109, 10, o.days || "MON-SAT")}`)],
  nostop: () => [100, 100, `${noStopRing(50, 50, 40)}`],
  keepleft: () => [100, 100, `<circle cx="50" cy="50" r="46" fill="#1f4fa0" stroke="#fff" stroke-width="4"/><path d="M66 26L36 64M36 64L36 44M36 64L56 64" stroke="#fff" stroke-width="10" stroke-linecap="round" fill="none"/>`],
  roundabout: () => [100, 100, diamond(`<g fill="none" stroke="#111" stroke-width="5"><path d="M50 32a18 18 0 1 1 -15.6 9"/><path d="M50 32l-7 -5M50 32l-6 6"/></g>`)],
  pedx: () => [100, 100, diamond(person(50, 62, 1))],
  children: () => [100, 100, diamond(`${person(40, 62, 0.95)}${person(62, 66, 0.75)}`)],
  lights: () => [100, 100, diamond(`<rect x="42" y="26" width="16" height="46" rx="5" fill="#111"/><circle cx="50" cy="35" r="5" fill="#d71920"/><circle cx="50" cy="49" r="5" fill="#ffb400"/><circle cx="50" cy="63" r="5" fill="#16a34a"/>`)],
  noright: () => [100, 100, `<circle cx="50" cy="50" r="46" fill="#fff" stroke="#d71920" stroke-width="9"/><path d="M40 76V46h22" stroke="#111" stroke-width="9" fill="none"/><path d="M58 34l14 12-14 12z" fill="#111"/><path d="M20 20L80 80" stroke="#d71920" stroke-width="9"/>`],
  nouturn: () => [100, 100, `<circle cx="50" cy="50" r="46" fill="#fff" stroke="#d71920" stroke-width="9"/><path d="M62 76V44a12 12 0 0 0 -24 0v20" stroke="#111" stroke-width="9" fill="none"/><path d="M26 60l12 16 12-16z" fill="#111"/><path d="M20 20L80 80" stroke="#d71920" stroke-width="9"/>`],
  oneway: () => [140, 60, rectSign(140, 60, `<path d="M18 30h80" stroke="#111" stroke-width="12"/><path d="M96 14l28 16-28 16z" fill="#111"/>${T(58, 54, 11, "ONE WAY")}`)],
  zip: () => [130, 80, rectSign(130, 80, `${T(65, 34, 17, "MERGE LIKE")}${T(65, 60, 17, "A ZIP")}`, "#ffd200")],
  railway: () => [100, 100, `<g transform="rotate(45 50 50)"><rect x="10" y="42" width="80" height="16" fill="#fff" stroke="#d71920" stroke-width="4"/></g><g transform="rotate(-45 50 50)"><rect x="10" y="42" width="80" height="16" fill="#fff" stroke="#d71920" stroke-width="4"/></g>`],
  limitend: () => [100, 100, `<circle cx="50" cy="50" r="46" fill="#fff" stroke="#111" stroke-width="4"/><path d="M18 82L82 18" stroke="#111" stroke-width="8"/>${T(50, 62, 30, "50", "#999")}`],
};

export function sign(kind, opt = {}) {
  const f = DEF[kind];
  if (!f) return { svg: "", w: 1, h: 1 };
  const [w, h, body] = f(opt);
  return { svg: wrap(w, h, body), w, h };
}
const cache = new Map();
export function signImg(kind, opt = {}) {
  const key = kind + JSON.stringify(opt);
  if (!cache.has(key)) {
    const im = new Image();
    im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(sign(kind, opt).svg);
    cache.set(key, im);
  }
  return cache.get(key);
}
export const signHTML = (kind, opt = {}, cls = "sg") => {
  const s = sign(kind, opt);
  return `<span class="${cls}" style="aspect-ratio:${s.w}/${s.h}">${s.svg}</span>`;
};
