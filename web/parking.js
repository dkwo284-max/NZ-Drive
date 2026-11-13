// 저속 기동: 직접 조향(핸들·기어 D/R). 평행 후진 주차 · 3점 회전 · 언덕 주차.
// 시험 기준 요약: 움직이기 전마다 주변 확인, 연석에 바퀴가 올라가면 치명 오류, 다른 차에 닿으면 즉시 실격.
import { drawCar, VIOL } from "./engine.js";

const WB = 2.7, CL = 4.5, CW = 1.9, MAXST = 0.62;
const corners = (x, y, h) => { const c = Math.cos(h), s = Math.sin(h); return [[CL / 2, CW / 2], [CL / 2, -CW / 2], [-CL / 2, CW / 2], [-CL / 2, -CW / 2]].map(([a, b]) => [x + a * c - b * s, y + a * s + b * c]); };
function inRect(p, r) { const [cx, cy, w, h, ang] = r, c = Math.cos(-ang), s = Math.sin(-ang), dx = p[0] - cx, dy = p[1] - cy, x = dx * c - dy * s, y = dx * s + dy * c; return Math.abs(x) < w / 2 && Math.abs(y) < h / 2; }
const overlap = (a, b) => corners(...a).some((p) => inRect(p, [b[0], b[1], CL, CW, b[2]])) || corners(...b).some((p) => inRect(p, [a[0], a[1], CL, CW, a[2]]));
const NORTH = -Math.PI / 2;

export const MANEUVERS = [
  {
    id: "parallel", title: "평행 후진 주차", place: "Grey Lynn 길가",
    brief: "앞차 옆에 나란히 선 상태예요. 왼쪽 깜빡이 → 👀 확인 → 기어 R → 핸들을 돌려 두 차 사이 빈칸으로 후진해 연석과 평행하게(50cm 안) 세운 뒤 '완료'를 누르세요.",
    tips: ["움직이기 전마다 👀 확인(시험관이 가장 많이 보는 부분)", "연석에 살짝 닿는 건 괜찮지만 바퀴가 올라가면 치명 오류", "앞뒤 차에 닿으면 즉시 실격", "기어를 바꾸며 여러 번 고쳐도 괜찮아요(너무 많으면 감점)"],
    kerbL: -3.6, kerbR: null, start: [0.3, -9.6, NORTH], parked: [[-2.55, -10.2, NORTH], [-2.55, 2.4, NORTH]],
    target(c) { const kerbGap = Math.min(...corners(c.x, c.y, c.h).map((p) => p[0])) - this.kerbL; const ang = Math.abs(((c.h - NORTH + Math.PI) % (2 * Math.PI)) - Math.PI);
      return { ok: kerbGap >= -0.05 && kerbGap <= 0.5 && ang < 0.14 && c.y > -5.75 && c.y < -2.6, msg: `연석까지 ${Math.max(0, kerbGap * 100).toFixed(0)}cm · 각도 ${(ang * 57.3).toFixed(0)}°` }; },
    needInd: "L", maxMoves: 7, view: [-4, -4.5, 26],
  },
  {
    id: "threepoint", title: "3점 회전 (Three-point turn)", place: "Westmere 좁은 골목",
    brief: "좁은 길에서 반대 방향으로 돌아 나가요. 오른쪽 깜빡이 → 👀 확인 → 핸들 오른쪽 끝까지 전진 → 멈춤 → 확인 → 핸들 왼쪽 끝까지 후진 → 멈춤 → 확인 → 전진으로 반대편 왼쪽 차선에 정렬 후 '완료'.",
    tips: ["매 동작 전에 양쪽 확인 — 차가 오면 기다리기", "연석에 바퀴가 올라가면 치명 오류(닿기 직전 멈춤)", "3번 안에 끝내면 좋지만 5번까지는 괜찮아요"],
    kerbL: -4.5, kerbR: 4.5, start: [-2.2, 4, NORTH], parked: [],
    target(c) { const ang = Math.abs(((c.h - Math.PI / 2 + Math.PI) % (2 * Math.PI)) - Math.PI); return { ok: ang < 0.26 && c.x > 0.7, msg: `방향 ${(ang * 57.3).toFixed(0)}° 남음` }; },
    needInd: "R", maxMoves: 5, view: [0, 0, 24], traffic: true,
  },
  {
    id: "hillpark", title: "언덕 주차 — 바퀴 방향", place: "Parnell 내리막길",
    brief: "내리막길 왼쪽 연석 옆에 세웠어요. 브레이크 상태에서 핸들을 '연석 쪽(왼쪽)'으로 돌려 두고 '완료'를 누르세요. (오르막 + 연석이면 도로 쪽(오른쪽)으로)",
    tips: ["내리막: 바퀴를 연석 쪽으로", "오르막(연석 있음): 바퀴를 도로 쪽으로", "오르막(연석 없음): 연석 없는 길가 쪽(왼쪽)으로", "핸드브레이크 + 기어(P 또는 1단/R)"],
    kerbL: -3.6, kerbR: null, start: [-2.4, 0, NORTH], parked: [[-2.55, -8, NORTH]], hill: "down",
    target(c) { return { ok: c.st < -0.3, msg: c.st < -0.3 ? "연석 쪽으로 꺾었어요" : c.st > 0.3 ? "도로 쪽으로 꺾여 있어요" : "바퀴가 똑바로예요" }; },
    needInd: null, maxMoves: 3, view: [-1, -2, 20], noMove: true,
  },
];
export const manById = Object.fromEntries(MANEUVERS.map((m) => [m.id, m]));

export class FreeGame {
  constructor(m, canvas, hooks, opt = {}) {
    this.m = m; this.cv = canvas; this.ctx = canvas.getContext("2d"); this.hooks = hooks; this.test = !!opt.test;
    const [x, y, h] = m.start; this.c = { x, y, h, v: 0, st: 0, gear: "D" };
    this.keys = { gas: false, brake: false, left: false, right: false }; this.ind = null; this.indSince = 0; this.obsAt = -99; this.t = 0; this.viol = []; this.moves = 0; this.moving = false; this.kerbHit = false;
    this.ended = false; this.paused = true; this.car2 = m.traffic ? { y: -40, on: false, done: false } : null; this.resize();
  }
  resize() { const dpr = Math.min(2, window.devicePixelRatio || 1), r = this.cv.getBoundingClientRect(); this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr); this.dpr = dpr; this.draw(); }
  start() { this.paused = false; this.last = performance.now(); const loop = (now) => { if (this.ended) return; const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; if (!this.paused) this.step(dt); this.draw(); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
  stop() { this.ended = true; cancelAnimationFrame(this.raf); }
  setInd(d) { this.ind = this.ind === d ? null : d; this.indSince = this.t; this.hooks.hud?.(this); }
  observe() { this.obsAt = this.t; this.hooks.toast?.("👀 주변 확인"); }
  gear() { if (Math.abs(this.c.v) > 0.05) { this.hooks.toast?.("완전히 멈춘 뒤 기어를 바꾸세요"); return; } this.c.gear = this.c.gear === "D" ? "R" : "D"; this.kerbHit = false; this.hooks.hud?.(this); }
  addViol(type, why, fatal = false) {
    const [name, pen, cls] = VIOL[type] || [type, 10, "CE"]; this.viol.push({ type, name, pen: fatal ? 100 : pen, why, cls: fatal ? "IFE" : cls });
    if (this.test && !fatal) { this.hooks.testViol?.(this.viol.at(-1)); return; }
    this.paused = true; this.keys.gas = false; this.c.v = 0;
    this.hooks.violation({ type, name, pen, why, fatal, link: "https://nzta.govt.nz/driver-licences/getting-a-licence/take-your-test/practical-tests/restricted-licence-test-guide/critical-errors" }, () => { if (fatal) this.finish(false); else this.paused = false; });
  }
  complete() {
    const r = this.m.target(this.c);
    if (Math.abs(this.c.v) > 0.05) { this.hooks.toast?.("먼저 완전히 멈추세요"); return; }
    if (!r.ok) { this.hooks.toast?.(`아직이에요 — ${r.msg}`); return; }
    if (this.moves > this.m.maxMoves) this.addViol("park", `움직인 횟수 ${this.moves}번 — 너무 많이 고쳤어요(${this.m.maxMoves}번 이내 목표).`);
    this.finish(true, r.msg);
  }
  score() { return Math.max(0, 100 - this.viol.reduce((a, b) => a + b.pen, 0)); }
  finish(ok, msg) { if (this.ended) return; this.stop(); const fatal = this.viol.some((v) => v.cls === "IFE"); this.hooks.end({ ok: ok && !fatal && this.score() >= 70, score: fatal ? 0 : this.score(), viol: this.viol, msg: msg ? `${msg} · 움직인 횟수 ${this.moves}번` : "" }); }
  step(dt) {
    this.t += dt; const c = this.c, m = this.m;
    if (this.keys.left) c.st = Math.max(-MAXST, c.st - 1.3 * dt); if (this.keys.right) c.st = Math.min(MAXST, c.st + 1.3 * dt);
    if (m.noMove) { this.hooks.hud?.(this); return; }
    const want = this.keys.gas ? (c.gear === "D" ? 1.3 : -1.1) : 0;
    if (this.keys.brake) c.v *= Math.max(0, 1 - 8 * dt); else c.v += (want - c.v) * Math.min(1, 2.2 * dt);
    if (Math.abs(c.v) < 0.02 && !this.keys.gas) c.v = 0;
    const nowMoving = Math.abs(c.v) > 0.08;
    if (nowMoving && !this.moving) { // 새 동작 시작
      this.moves++;
      if (this.t - this.obsAt > 5) this.addViol("observe", "움직이기 전에 주변(거울·어깨 너머)을 확인해야 해요. 동작마다 👀 확인 버튼(R 키)을 누르세요.");
      if (this.moves === 1 && m.needInd && !(this.ind === m.needInd)) this.addViol("signal", `처음 움직이기 전에 ${m.needInd === "L" ? "왼쪽" : "오른쪽"} 깜빡이를 켜 다른 운전자에게 알리세요.`);
      if (this.car2?.on && !this.car2.done && Math.abs(this.car2.y - c.y) < 25) this.addViol("gap", "차가 오고 있는데 움직였어요. 지나간 뒤 움직이세요.");
    }
    this.moving = nowMoving;
    const nx = c.x + c.v * Math.cos(c.h) * dt, ny = c.y + c.v * Math.sin(c.h) * dt, nh = c.h + (c.v / WB) * Math.tan(c.st) * dt;
    const cs = corners(nx, ny, nh), offL = m.kerbL != null && cs.some((p) => p[0] < m.kerbL - 0.12), offR = m.kerbR != null && cs.some((p) => p[0] > m.kerbR + 0.12);
    if (offL || offR) { c.v = 0; if (!this.kerbHit) { this.kerbHit = true; this.addViol("kerb", "바퀴가 연석에 올라갔어요(치명 오류). 연석에 살짝 닿는 건 괜찮지만 올라타면 안 돼요. 닿기 전에 멈추고 방향을 바꾸세요."); } return; }
    if (m.parked.some((p) => overlap([nx, ny, nh], p)) || (this.car2?.on && !this.car2.done && overlap([nx, ny, nh], [1.9, this.car2.y, Math.PI / 2]))) { this.addViol("crash", "다른 차와 부딪혔어요(즉시 실격). 천천히, 자주 확인하며 움직이세요.", true); return; }
    c.x = nx; c.y = ny; c.h = nh;
    if (this.car2) { if (!this.car2.on && this.t > 6) this.car2.on = true; if (this.car2.on && !this.car2.done) { const blocked = overlap([c.x, c.y, c.h], [1.9, this.car2.y + 6, Math.PI / 2]); if (!blocked) this.car2.y += 7 * dt; if (this.car2.y > 50) this.car2.done = true; } }
    this.hooks.hud?.(this);
  }
  draw() {
    const g = this.ctx, W = this.cv.width, H = this.cv.height, m = this.m, [vx, vy, span] = m.view, k = Math.min(W, H * 1.1) / span;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = "#7fb069"; g.fillRect(0, 0, W, H); g.translate(W / 2, H / 2); g.scale(k, k); g.translate(-vx, -vy);
    const x0 = m.kerbL ?? -12, x1 = m.kerbR ?? 3.8;
    g.fillStyle = "#cfcac0"; g.fillRect(x0 - 3, -60, x1 - x0 + 6, 120);
    g.fillStyle = m.hill ? "#555b63" : "#4b5058"; g.fillRect(x0, -60, x1 - x0, 120);
    g.fillStyle = "#9a958a"; g.fillRect(x0 - 0.25, -60, 0.25, 120); if (m.kerbR != null) g.fillRect(x1, -60, 0.25, 120);
    if (m.kerbR == null) { g.strokeStyle = "#f4f4f4"; g.lineWidth = 0.15; g.setLineDash([3, 6]); g.beginPath(); g.moveTo(x1, -60); g.lineTo(x1, 60); g.stroke(); g.setLineDash([]); }
    else { g.strokeStyle = "#f4f4f4"; g.lineWidth = 0.15; g.setLineDash([3, 6]); g.beginPath(); g.moveTo(0, -60); g.lineTo(0, 60); g.stroke(); g.setLineDash([]); }
    if (m.hill) { g.fillStyle = "rgba(255,255,255,.85)"; g.font = "bold 1.4px sans-serif"; g.textAlign = "center"; g.fillText("⬆ 내리막 (북쪽이 아래로 경사)", 1, 6); }
    if (m.id === "parallel") { g.strokeStyle = "rgba(255,210,0,.8)"; g.lineWidth = 0.12; g.setLineDash([0.5, 0.5]); g.strokeRect(m.kerbL + 0.05, -7.9, 2.2, 8.0); g.setLineDash([]); }
    for (const p of m.parked) drawCar(g, { x: p[0], y: p[1], a: p[2] }, "#8a9199", "rgba(0,0,0,.35)", null, this.t, false, false);
    if (this.car2?.on && !this.car2.done) drawCar(g, { x: 1.9, y: this.car2.y, a: Math.PI / 2 }, "#c0392b", "rgba(0,0,0,.35)", null, this.t, false, false);
    const c = this.c; drawCar(g, { x: c.x, y: c.y, a: c.h }, "#e8eef7", "#1f4fa0", this.ind, this.t, true, this.keys.brake);
    // 앞바퀴 방향 표시
    g.save(); g.translate(c.x, c.y); g.rotate(c.h); g.fillStyle = "#111"; for (const s of [-1, 1]) { g.save(); g.translate(1.35, s * 0.82); g.rotate(c.st); g.fillRect(-0.35, -0.12, 0.7, 0.24); g.restore(); } g.restore();
    if (this.t - this.obsAt < 1.2) { g.strokeStyle = "rgba(255,204,77,.8)"; g.lineWidth = 0.18; g.beginPath(); g.arc(c.x, c.y, 5, 0, 7); g.stroke(); }
  }
}
