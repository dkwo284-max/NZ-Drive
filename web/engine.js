// 운전 연습 엔진: 위에서 본 2D 캔버스 + 운전석 미리보기(유사 3D). 좌표 단위는 m, y 는 아래로 증가(화면 좌표).
import { signImg } from "./signs.js";

/* ---------- 경로 ---------- */
export class PB {
  constructor(x, y) { this.p = [[x, y]]; this.L = 0; this.m = {}; }
  get last() { return this.p[this.p.length - 1]; }
  push(x, y) { const [a, b] = this.last; this.L += Math.hypot(x - a, y - b); this.p.push([x, y]); }
  line(x, y, step = 0.5) { const [x0, y0] = this.last, d = Math.hypot(x - x0, y - y0), n = Math.max(1, Math.ceil(d / step)); for (let i = 1; i <= n; i++) this.push(x0 + (x - x0) * i / n, y0 + (y - y0) * i / n); return this; }
  arc(cx, cy, r, a0, a1) { const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r / 0.5)); for (let i = 1; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; this.push(cx + r * Math.cos(a), cy + r * Math.sin(a)); } return this; }
  mark(k) { this.m[k] = this.L; return this; }
  done() { return new Path(this.p, this.m); }
}
export class Path {
  constructor(pts, marks = {}) {
    this.pts = pts; this.marks = marks; this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    this.len = this.cum[this.cum.length - 1];
  }
  at(s) {
    s = Math.max(0, Math.min(this.len, s));
    let lo = 0, hi = this.cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.cum[mid] <= s) lo = mid; else hi = mid; }
    const [x0, y0] = this.pts[lo], [x1, y1] = this.pts[hi], seg = this.cum[hi] - this.cum[lo] || 1, f = (s - this.cum[lo]) / seg;
    return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f, a: Math.atan2(y1 - y0, x1 - x0) };
  }
}

/* ---------- 상수 ---------- */
export const VIOL = {
  lane: ["좌측통행·차선", 25], yield: ["양보", 20], stop: ["STOP 정지", 20], signal: ["깜빡이", 10], speed: ["속도", 15],
  ped: ["보행자", 25], light: ["신호등", 25], special: ["버스·T2·클리어웨이", 15], park: ["주정차", 10], crash: ["충돌", 100],
};
const ROADCODE = "https://nzta.govt.nz/roadcode/general-road-code/about-driving/giving-way/the-give-way-rules";

/* ---------- 엔진 ---------- */
export class Game {
  constructor(sc, canvas, pov, hooks) {
    this.sc = sc; this.cv = canvas; this.ctx = canvas.getContext("2d"); this.pov = pov; this.pctx = pov?.getContext("2d"); this.hooks = hooks;
    this.sel = []; this.rebuild();
    this.s = 0; this.v = 0; this.t = 0; this.ind = null; this.indSince = 0; this.viol = []; this.fired = new Set();
    this.minV = {}; this.inSpeed = {}; this.stopT = {}; this.light = {}; this.parkT = 0;
    this.keys = { gas: false, brake: false }; this.paused = true; this.ended = false; this.msgQ = [];
    this.agents = (sc.agents?.() || []).map((d) => ({ d, s: 0, on: d.v === 0 || !d.trigger, wait: d.delay || 0, done: false }));
    this.decor = makeDecor(sc);
    this.resize();
  }
  rebuild() { const r = this.sc.make(this.sel); this.path = r.path; this.rules = r.rules; this.signs = r.signs; this.choices = r.choices || []; }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1), r = this.cv.getBoundingClientRect();
    this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr); this.dpr = dpr;
    if (this.pov) { const q = this.pov.getBoundingClientRect(); this.pov.width = Math.round(q.width * dpr); this.pov.height = Math.round(q.height * dpr); }
    this.draw();
  }
  start() { this.paused = false; this.last = performance.now(); const loop = (now) => { if (this.ended) return; const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; if (!this.paused) this.step(dt); this.draw(); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
  stop() { this.ended = true; cancelAnimationFrame(this.raf); }
  setInd(d) { this.ind = this.ind === d ? null : d; this.indSince = this.t; this.hooks.hud?.(this); }
  limitNow() { const r = this.rules.find((x) => x.type === "speed" && this.s >= x.s0 && this.s <= x.s1); return r ? r.limit : this.sc.limit || 50; }
  clock() { if (!this.sc.clock) return null; const [h, m] = this.sc.clock.split(":").map(Number), tot = h * 60 + m + Math.floor(this.t / 60); return `${String(Math.floor(tot / 60) % 24).padStart(2, "0")}:${String(tot % 60).padStart(2, "0")}`; }

  step(dt) {
    this.t += dt;
    const acc = (this.keys.gas ? 2.8 : 0) - (this.keys.brake ? 7.5 : 0) - (this.keys.gas ? 0 : 0.35) - 0.004 * this.v * this.v;
    this.v = Math.max(0, Math.min(this.sc.vmax || 22, this.v + acc * dt));
    const prev = this.s;
    this.s = Math.min(this.path.len, this.s + this.v * dt);
    // 에이전트
    for (const a of this.agents) {
      if (a.done) continue;
      if (!a.on && this.s >= a.d.trigger) { a.on = true; }
      if (!a.on) continue;
      if (a.wait > 0) { a.wait -= dt; continue; }
      if (a.d.v) { // 앞에 내 차가 있으면 멈춰 기다림(추돌·덮치기 방지)
        const P0 = this.path.at(this.s), ped = a.d.kind === "ped", look = ped ? [0.8, 1.6] : a.d.kind === "bus" ? [3, 6, 9, 12] : [2, 4, 6, 8];
        if (look.some((k) => { const q = a.d.path.at(a.s + k); return Math.hypot(q.x - P0.x, q.y - P0.y) < (ped ? 1.4 : 2.3); })) continue; // 가는 길 위에 내 차가 있으면 기다림
      }
      a.s += (a.d.v || 0) * dt;
      if (a.s >= a.d.path.len) { a.done = !a.d.stay; a.s = a.d.path.len; }
    }
    // 선택지
    for (const c of this.choices) {
      if (this.fired.has("c" + c.id) || !(prev < c.s && this.s >= c.s)) continue;
      this.fired.add("c" + c.id); this.paused = true;
      this.hooks.choice(c, (i) => {
        const o = c.opts[i];
        this.sel[c.id] = i; this.rebuild();
        if (o.fatal) { this.addViol("crash", o.why, true); return; }
        if (!o.ok) { this.addViol(o.type || "lane", o.why); return; }
        if (o.good) this.hooks.toast?.(o.good);
        this.paused = false;
      });
      return;
    }
    // 규칙
    const P = this.path.at(this.s);
    for (const [i, r] of this.rules.entries()) {
      const key = "r" + i, crossed = prev < r.s && this.s >= r.s;
      if (r.type === "speed" && this.s >= r.s0 && this.s <= r.s1) {
        if (this.v * 3.6 > r.limit + 3) { this.inSpeed[i] = (this.inSpeed[i] || 0) + dt; if (this.inSpeed[i] > 1 && !this.fired.has(key)) { this.fired.add(key); this.addViol("speed", r.why || `제한속도 ${r.limit}km/h 구간에서 ${Math.round(this.v * 3.6)}km/h. 뉴질랜드는 고정·이동식 단속 카메라가 많고, 조금만 넘어도 벌금이 나올 수 있어요.`); } }
        else this.inSpeed[i] = 0;
      }
      if (r.type === "stop") {
        if (this.s >= r.s - 7 && this.s <= r.s) this.minV[i] = Math.min(this.minV[i] ?? 99, this.v);
        if (crossed && (this.minV[i] ?? 99) > 0.4 && !this.fired.has(key)) { this.fired.add(key); this.addViol("stop", r.why || "STOP 표지판에서는 정지선 앞에서 바퀴가 완전히 멈춰야 해요(서행 통과 불가). 멈춘 뒤 양보 규칙에 따라 출발합니다."); }
      }
      if (r.type === "light") {
        const L = this.light[i] || (this.light[i] = { green: false, waited: 0 });
        if (!L.green) { if (this.s >= r.s - 9 && this.v < 0.3) L.waited += dt; if (L.waited >= (r.after || 4) || this.t > 40) L.green = true; }
        if (crossed && !L.green && !this.fired.has(key)) { this.fired.add(key); this.addViol("light", r.why); }
      }
      if (r.type === "signal" && crossed && !this.fired.has(key)) {
        const ok = this.ind === r.dir && this.t - this.indSince >= (r.need ?? 2.5);
        if (!ok) { this.fired.add(key); this.addViol("signal", r.why || `${r.dir === "L" ? "왼쪽" : "오른쪽"} 깜빡이를 회전 3초 전부터 켜야 해요.`); }
      }
      if (r.type === "nosignal" && crossed && this.ind && !this.fired.has(key)) { this.fired.add(key); this.addViol("signal", r.why); }
      if (r.type === "yield" && this.s >= r.s0 && this.s <= r.s1 && this.v > 0.5 && !this.fired.has(key)) {
        const a = this.agents[r.agent];
        if (a && a.on && !a.done && a.wait <= 0 && a.s >= r.a0 - (a.d.v || 10) * (r.secs || 2.8) && a.s <= r.a1) { this.fired.add(key); this.addViol(r.kind || "yield", r.why); }
      }
      if (r.type === "ped" && this.s >= r.s0 && this.s <= r.s1 && this.v > 0.3 && !this.fired.has(key)) {
        const a = this.agents[r.agent];
        if (a && a.on && !a.done && a.s >= r.a0 && a.s <= r.a1) { this.fired.add(key); this.addViol("ped", r.why); }
      }
      if (r.type === "nostop" && this.s >= r.s0 && this.s <= r.s1) {
        this.stopT[i] = this.v < 0.3 ? (this.stopT[i] || 0) + dt : 0;
        if (this.stopT[i] > 2 && !this.fired.has(key)) { this.fired.add(key); this.addViol(r.kind || "special", r.why); }
      }
      if (r.type === "park") {
        if (this.s >= r.s0 && this.s <= r.s1 && this.v < 0.2) { this.parkT += dt; if (this.parkT > 1.5) return this.finish(true, r.good); } else this.parkT = 0;
        if (crossed && !this.fired.has(key)) { this.fired.add(key); this.addViol("park", r.why); }
      }
    }
    // 충돌
    for (const a of this.agents) {
      if (!a.on || a.done || a.wait > 0) continue;
      const q = a.d.path.at(a.s), big = a.d.kind === "bus" || a.d.kind === "schoolbus", hx = Math.cos(q.a), hy = Math.sin(q.a), dx = P.x - q.x, dy = P.y - q.y;
      const hit = a.d.kind === "ped" ? Math.hypot(dx, dy) < 1.6 : Math.abs(dx * hx + dy * hy) < (big ? 5.5 : 2.25) + 2.0 && Math.abs(-dx * hy + dy * hx) < (big ? 1.25 : 0.95) + 0.8;
      if (hit && (this.v > 0.3 || (a.d.v || 0) > 0)) { this.addViol("crash", a.d.kind === "ped" ? "보행자와 부딪혔어요. 횡단보도·학교 주변에서는 언제든 멈출 수 있는 속도로." : "다른 차와 부딪혔어요. 양보해야 할 차가 지나간 뒤 출발하세요.", true); return; }
    }
    if (this.s >= this.path.len - 0.5) this.finish(true);
    this.hooks.hud?.(this);
  }
  addViol(type, why, fatal = false) {
    const [name, pen] = VIOL[type] || [type, 10];
    this.viol.push({ type, name, pen: fatal ? 100 : pen, why, t: this.t });
    this.paused = true; this.v = Math.min(this.v, fatal ? 0 : this.v);
    this.hooks.violation({ type, name, pen, why, fatal, link: this.sc.link || ROADCODE }, () => { if (fatal) this.finish(false); else this.paused = false; });
  }
  score() { return Math.max(0, 100 - this.viol.reduce((a, b) => a + b.pen, 0)); }
  finish(ok, msg) { if (this.ended) return; this.stop(); const sc = this.score(), fatal = this.viol.some((x) => x.type === "crash"); this.hooks.end({ ok: ok && !fatal && sc >= 70, score: fatal ? 0 : sc, viol: this.viol, msg, time: this.t }); }

  /* ---------- 그리기 ---------- */
  draw() {
    const c = this.ctx, W = this.cv.width, H = this.cv.height, P = this.path.at(this.s), k = (W < 700 * this.dpr ? 8 : 11) * this.dpr * (this.sc.zoom || 1);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#7fb069"; c.fillRect(0, 0, W, H);
    // 카메라: 차가 화면 아래쪽 60% 지점, 진행 방향을 위로 회전
    c.translate(W / 2, H * 0.62); c.rotate(-P.a - Math.PI / 2); c.scale(k, k); c.translate(-P.x, -P.y);
    drawMap(c, this.sc.map, this.decor, this.t);
    // 규칙 표시(신호등)
    for (const [i, r] of this.rules.entries()) if (r.type === "light" && r.at) {
      const L = this.light[i], g = L?.green; c.save(); c.translate(r.at[0], r.at[1]);
      c.fillStyle = "#222"; c.fillRect(-0.7, -1.6, 1.4, 3.2); c.fillStyle = g ? "#333" : "#ff2d2d"; c.beginPath(); c.arc(0, -0.8, 0.5, 0, 7); c.fill(); c.fillStyle = g ? "#22e06b" : "#333"; c.beginPath(); c.arc(0, 0.8, 0.5, 0, 7); c.fill(); c.restore();
    }
    // 표지판
    for (const s of this.signs) { const im = signImg(s.kind, s.o); if (!im.complete) continue; const p = s.p || this.signPos(s.s), h = 3.4, w = h * (im.width / im.height || 1);
      c.save(); c.translate(p.x, p.y); c.rotate(P.a + Math.PI / 2); c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(-w / 2 + 0.25, -h / 2 + 0.25, w, h); c.drawImage(im, -w / 2, -h / 2, w, h); c.restore(); }
    // 에이전트
    for (const a of this.agents) { if (a.done || (!a.on && a.d.kind === "ped")) continue; const q = a.d.path.at(a.s); drawAgent(c, a.d, q, this.t); }
    // 내 차
    drawCar(c, P, "#e8eef7", "#1f4fa0", this.ind, this.t, true, this.keys.brake);    this.drawPOV();
  }
  signPos(s) { const q = this.path.at(s), nx = Math.sin(q.a), ny = -Math.cos(q.a); return { x: q.x + nx * 5.2, y: q.y + ny * 5.2 }; }

  drawPOV() {
    const c = this.pctx; if (!c) return; const W = this.pov.width, H = this.pov.height, hz = H * 0.42, vx = W * 0.5;
    const g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, "#7cc0f2"); g.addColorStop(1, "#d6ecfb"); c.fillStyle = g; c.fillRect(0, 0, W, hz);
    // 오클랜드 스카이라인(단순화) + 스카이타워
    c.fillStyle = "#8aa2b8"; const sk = [[.05, .18], [.1, .27], [.16, .2], [.22, .34], [.27, .22], [.62, .3], [.68, .2], [.74, .36], [.8, .24], [.86, .3], [.92, .18]];
    for (const [x, hh] of sk) c.fillRect(W * x, hz - H * hh * 0.55, W * 0.05, H * hh * 0.55);
    c.fillStyle = "#6f879c"; c.fillRect(W * 0.43 - 2, hz - H * 0.36, 4, H * 0.36); c.beginPath(); c.ellipse(W * 0.43, hz - H * 0.27, W * 0.022, H * 0.025, 0, 0, 7); c.fill(); c.fillRect(W * 0.43 - 1, hz - H * 0.42, 2, H * 0.08);
    c.fillStyle = "#86b36e"; c.fillRect(0, hz, W, H - hz);
    // 도로(내 차선은 왼쪽, 중앙선은 오른쪽)
    const by = H, half = W * 0.75, cxb = vx + W * 0.06;
    c.fillStyle = "#4b5058"; c.beginPath(); c.moveTo(vx, hz); c.lineTo(cxb + half, by); c.lineTo(cxb - half, by); c.closePath(); c.fill();
    const proj = (d, lat) => { const f = 4.5 / (d + 4.5); return { x: vx + (cxb - vx) * f + lat * (W * 0.12) * f, y: hz + (by - hz) * f, f }; };
    c.strokeStyle = "#f2f2f2"; c.lineWidth = 2 * this.dpr; c.setLineDash([10 * this.dpr, 12 * this.dpr]); c.lineDashOffset = -this.s * 6;
    c.beginPath(); const a = proj(200, 1.75), b = proj(0, 1.75); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.setLineDash([]);
    // 정지선·횡단보도
    for (const r of this.rules) {
      const d = r.s - this.s; if (!(r.type === "stop" || r.type === "light" || r.type === "zebra") || d < 0 || d > 120) continue;
      const L = proj(d, -1.75), R = proj(d, 1.75); c.fillStyle = "#fff";
      if (r.type === "zebra") for (let i = 0; i < 6; i++) { c.fillRect(L.x + (R.x - L.x) * i / 6, L.y - 6 * L.f * this.dpr, (R.x - L.x) / 12, 6 * L.f * this.dpr * 2); }
      else c.fillRect(L.x, L.y - 2, R.x - L.x, Math.max(2, 5 * L.f * this.dpr));
    }
    // 앞의 표지판(왼쪽 길가)
    const ahead = this.signs.map((s) => ({ s, d: s.s - this.s })).filter((x) => x.d > 1 && x.d < 110).sort((x, y) => y.d - x.d);
    for (const { s, d } of ahead) {
      const im = signImg(s.kind, s.o); if (!im.complete) continue; const p = proj(d, -3.4), hpx = H * 0.75 * p.f * 2.2, wpx = hpx * (im.width / im.height || 1), post = hpx * 1.2;
      c.fillStyle = "#777"; c.fillRect(p.x - 1.5 * this.dpr, p.y - post, 3 * this.dpr, post);
      c.drawImage(im, p.x - wpx / 2, p.y - post - hpx, wpx, hpx);
    }
    // 앞의 신호등
    for (const [i, r] of this.rules.entries()) { if (r.type !== "light") continue; const d = r.s - this.s; if (d < 0 || d > 110) continue; const p = proj(d, 2.6), hp = H * 0.5 * p.f * 2; c.fillStyle = "#222"; c.fillRect(p.x - hp * 0.12, p.y - hp * 1.6, hp * 0.24, hp * 0.6); const gr = this.light[i]?.green; c.fillStyle = gr ? "#333" : "#ff3030"; c.beginPath(); c.arc(p.x, p.y - hp * 1.45, hp * 0.08, 0, 7); c.fill(); c.fillStyle = gr ? "#22e06b" : "#333"; c.beginPath(); c.arc(p.x, p.y - hp * 1.15, hp * 0.08, 0, 7); c.fill(); }
    // 계기판(오른쪽 운전석 — NZ 는 운전석이 오른쪽)
    c.fillStyle = "rgba(20,24,30,.85)"; c.fillRect(0, H * 0.86, W, H * 0.14);
    c.fillStyle = "#fff"; c.font = `700 ${13 * this.dpr}px system-ui`; c.textAlign = "right"; c.fillText(`${Math.round(this.v * 3.6)} km/h`, W - 10 * this.dpr, H * 0.95);
    c.textAlign = "left"; c.fillStyle = this.ind === "L" && Math.floor(this.t * 2.5) % 2 ? "#22e06b" : "#556"; c.fillText("◀", 10 * this.dpr, H * 0.95);
    c.fillStyle = this.ind === "R" && Math.floor(this.t * 2.5) % 2 ? "#22e06b" : "#556"; c.fillText("▶", 34 * this.dpr, H * 0.95);
  }
}

/* ---------- 지도 그리기 ---------- */
function makeDecor(sc) {
  let seed = [...sc.id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const B = sc.map.bounds || [-120, -160, 120, 160], out = [];
  const onRoad = (x, y, pad) => sc.map.roads.some((r) => {
    if (r.rb) return Math.hypot(x - r.rb[0], y - r.rb[1]) < r.r + 5 + pad;
    const [ax, ay] = r.a, [bx, by] = r.b, dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
    return Math.hypot(x - (ax + dx * t), y - (ay + dy * t)) < (r.w || 7) / 2 + 4 + pad;
  });
  for (let i = 0; i < 260; i++) {
    const x = B[0] + rnd() * (B[2] - B[0]), y = B[1] + rnd() * (B[3] - B[1]), w = 8 + rnd() * 14, h = 8 + rnd() * 14;
    if (onRoad(x, y, Math.max(w, h) / 2 + 2)) continue;
    out.push(rnd() < 0.72 ? { b: [x, y, w, h], c: ["#d9d4c7", "#c9c3b4", "#e6dfd0", "#b8c4cf", "#cfd8dc"][Math.floor(rnd() * 5)], roof: rnd() < 0.5 } : { t: [x, y, 2 + rnd() * 2.5] });
  }
  return out;
}
function drawMap(c, M, decor, t) {
  // 인도
  c.lineCap = "butt";
  for (const r of M.roads) { if (r.rb) continue; c.strokeStyle = "#cfcac0"; c.lineWidth = (r.w || 7) + 6; c.beginPath(); c.moveTo(...r.a); c.lineTo(...r.b); c.stroke(); }
  for (const r of M.roads) if (r.rb) { c.fillStyle = "#cfcac0"; c.beginPath(); c.arc(r.rb[0], r.rb[1], r.r + 3, 0, 7); c.fill(); }
  // 건물·나무
  for (const d of decor) {
    if (d.b) { const [x, y, w, h] = d.b; c.fillStyle = "rgba(0,0,0,.18)"; c.fillRect(x - w / 2 + 1, y - h / 2 + 1, w, h); c.fillStyle = d.c; c.fillRect(x - w / 2, y - h / 2, w, h); if (d.roof) { c.strokeStyle = "rgba(0,0,0,.12)"; c.lineWidth = 0.4; c.strokeRect(x - w / 2 + 1.5, y - h / 2 + 1.5, w - 3, h - 3); } }
    else { const [x, y, r] = d.t; c.fillStyle = "#3f7d3a"; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = "#5a9a4d"; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.55, 0, 7); c.fill(); }
  }
  // 아스팔트
  for (const r of M.roads) { if (r.rb) continue; c.strokeStyle = "#4b5058"; c.lineWidth = r.w || 7; c.beginPath(); c.moveTo(...r.a); c.lineTo(...r.b); c.stroke(); }
  for (const r of M.roads) if (r.rb) { c.fillStyle = "#4b5058"; c.beginPath(); c.arc(r.rb[0], r.rb[1], r.r, 0, 7); c.fill(); }
  // 색칠 차선(버스·T2)
  for (const z of M.zones || []) { c.fillStyle = z.color; c.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0); if (z.text) { c.save(); c.fillStyle = "rgba(255,255,255,.9)"; c.font = "bold 2.2px sans-serif"; c.textAlign = "center"; for (let y = z.y0 + 12; y < z.y1; y += 30) { c.save(); c.translate((z.x0 + z.x1) / 2, y); c.fillText(z.text, 0, 0); c.restore(); } c.restore(); } }
  // 차선 표시
  for (const r of M.roads) {
    if (r.rb || r.lines === false) continue;
    const [ax, ay] = r.a, [bx, by] = r.b, L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L, nx = -uy, ny = ux, w = r.w || 7;
    c.strokeStyle = "#f4f4f4"; c.lineWidth = 0.15;
    for (const off of [-w / 2 + 0.35, w / 2 - 0.35]) { c.beginPath(); c.moveTo(ax + nx * off, ay + ny * off); c.lineTo(bx + nx * off, by + ny * off); c.stroke(); }
    for (const [off, kind] of r.lanes || [[0, "dash"]]) {
      c.strokeStyle = kind === "yellow" ? "#f5c400" : "#f4f4f4"; c.lineWidth = kind === "solid" || kind === "yellow" ? 0.18 : 0.15;
      c.setLineDash(kind === "dash" ? [3, 6] : kind === "yellow" ? [2.2, 1.6] : []);
      c.beginPath(); c.moveTo(ax + nx * off, ay + ny * off); c.lineTo(bx + nx * off, by + ny * off); c.stroke(); c.setLineDash([]);
    }
  }
  // 교차로 박스(표시 지우기)
  for (const b of M.boxes || []) { c.fillStyle = "#4b5058"; c.fillRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); }
  // 로터리 가운데 섬
  for (const r of M.roads) if (r.rb) { c.fillStyle = "#cfcac0"; c.beginPath(); c.arc(r.rb[0], r.rb[1], r.island + 0.6, 0, 7); c.fill(); c.fillStyle = "#6ea95c"; c.beginPath(); c.arc(r.rb[0], r.rb[1], r.island, 0, 7); c.fill(); c.strokeStyle = "#f4f4f4"; c.lineWidth = 0.15; c.setLineDash([2, 2]); for (const e of r.entries || []) { c.beginPath(); c.moveTo(...e[0]); c.lineTo(...e[1]); c.stroke(); } c.setLineDash([]); }
  // 노면 표시
  for (const m of M.marks || []) {
    c.fillStyle = "#f4f4f4"; c.strokeStyle = "#f4f4f4";
    if (m.k === "stop") { c.lineWidth = 0.6; line(c, m.a, m.b); c.save(); c.fillStyle = "#f4f4f4"; c.font = "bold 2.4px sans-serif"; c.textAlign = "center"; c.translate(m.tx, m.ty); c.rotate(m.rot || 0); c.fillText("STOP", 0, 0); c.restore(); }
    if (m.k === "give") { c.lineWidth = 0.3; c.setLineDash([0.9, 0.7]); line(c, m.a, m.b); c.setLineDash([]); }
    if (m.k === "line") { c.lineWidth = 0.45; line(c, m.a, m.b); }
    if (m.k === "zebra") { const [ax, ay] = m.a, [bx, by] = m.b, n = 8; c.lineWidth = 2.8; for (let i = 0; i < n; i++) { const f0 = (i + 0.2) / n, f1 = (i + 0.7) / n; c.beginPath(); c.moveTo(ax + (bx - ax) * f0, ay + (by - ay) * f0); c.lineTo(ax + (bx - ax) * f1, ay + (by - ay) * f1); c.stroke(); } }
    if (m.k === "diamond") { c.lineWidth = 0.25; c.beginPath(); c.moveTo(m.p[0], m.p[1] - 2.2); c.lineTo(m.p[0] + 0.8, m.p[1]); c.lineTo(m.p[0], m.p[1] + 2.2); c.lineTo(m.p[0] - 0.8, m.p[1]); c.closePath(); c.stroke(); }
    if (m.k === "text") { c.save(); c.fillStyle = m.color || "#f4f4f4"; c.font = `bold ${m.size || 2.2}px sans-serif`; c.textAlign = "center"; c.translate(m.p[0], m.p[1]); c.rotate(m.rot || 0); c.fillText(m.t, 0, 0); c.restore(); }
    if (m.k === "nostopline") { c.strokeStyle = "#f5c400"; c.lineWidth = 0.25; c.setLineDash([1.5, 1.2]); line(c, m.a, m.b); c.setLineDash([]); }
    if (m.k === "flash") { const on = Math.floor(t * 2) % 2; c.fillStyle = on ? "#ffb400" : "#7a5a00"; c.beginPath(); c.arc(m.p[0], m.p[1], 0.7, 0, 7); c.fill(); }
    if (m.k === "label") { c.save(); c.fillStyle = "rgba(255,255,255,.92)"; c.font = `bold ${m.size || 3}px system-ui, sans-serif`; c.textAlign = "center"; c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 0.5; c.translate(m.p[0], m.p[1]); c.rotate(m.rot || 0); c.strokeText(m.t, 0, 0); c.fillText(m.t, 0, 0); c.restore(); }
  }
}
const line = (c, a, b) => { c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); };
function drawCar(c, P, body, roof, ind, t, me, brake) {
  c.save(); c.translate(P.x, P.y); c.rotate(P.a);
  const L = 4.5, W = 1.9;
  c.fillStyle = "rgba(0,0,0,.3)"; c.fillRect(-L / 2 + 0.25, -W / 2 + 0.25, L, W);
  c.fillStyle = body; rr(c, -L / 2, -W / 2, L, W, 0.5); c.fill();
  c.fillStyle = roof; rr(c, -L / 2 + 1.1, -W / 2 + 0.2, 2.2, W - 0.4, 0.3); c.fill();
  c.fillStyle = "#9cc8ef"; c.fillRect(L / 2 - 1.45, -W / 2 + 0.25, 0.45, W - 0.5);
  if (me) { c.fillStyle = "#ffcc4d"; c.beginPath(); c.arc(0.5, W / 2 - 0.55, 0.28, 0, 7); c.fill(); } // 운전석(오른쪽)
  const blink = Math.floor(t * 2.5) % 2 === 0;
  c.fillStyle = "#fff6c0"; c.fillRect(L / 2 - 0.2, -W / 2 + 0.1, 0.2, 0.4); c.fillRect(L / 2 - 0.2, W / 2 - 0.5, 0.2, 0.4);
  c.fillStyle = brake ? "#ff2020" : "#8a1010"; c.fillRect(-L / 2, -W / 2 + 0.1, 0.2, 0.4); c.fillRect(-L / 2, W / 2 - 0.5, 0.2, 0.4);
  if (ind && blink) { c.fillStyle = "#ffa000"; const y = ind === "L" ? -W / 2 - 0.15 : W / 2 - 0.25; c.fillRect(L / 2 - 0.5, y, 0.6, 0.4); c.fillRect(-L / 2 - 0.1, y, 0.6, 0.4); }
  c.restore();
}
function drawAgent(c, d, q, t) {
  if (d.kind === "ped") { c.save(); c.translate(q.x, q.y); c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.arc(0.15, 0.15, 0.6, 0, 7); c.fill(); c.fillStyle = d.color || "#e4572e"; c.beginPath(); c.arc(0, 0, 0.55, 0, 7); c.fill(); c.fillStyle = "#3b2a1a"; c.beginPath(); c.arc(0, 0, 0.3, 0, 7); c.fill(); c.restore(); return; }
  if (d.kind === "bus" || d.kind === "schoolbus") {
    c.save(); c.translate(q.x, q.y); c.rotate(q.a); const L = 11, W = 2.5; c.fillStyle = "rgba(0,0,0,.3)"; c.fillRect(-L / 2 + 0.3, -W / 2 + 0.3, L, W);
    c.fillStyle = d.kind === "schoolbus" ? "#ffcc00" : "#1f4fa0"; rr(c, -L / 2, -W / 2, L, W, 0.5); c.fill(); c.fillStyle = "rgba(255,255,255,.75)"; c.fillRect(-L / 2 + 1, -W / 2 + 0.3, L - 2, W - 0.6);
    c.fillStyle = "#111"; c.font = "bold 1.3px sans-serif"; c.textAlign = "center"; c.fillText(d.kind === "schoolbus" ? "SCHOOL" : "BUS", 0, 0.45);
    if (d.kind === "schoolbus" && Math.floor(t * 2) % 2) { c.fillStyle = "#ff8a00"; c.fillRect(L / 2 - 0.4, -W / 2, 0.4, 0.5); c.fillRect(L / 2 - 0.4, W / 2 - 0.5, 0.4, 0.5); c.fillRect(-L / 2, -W / 2, 0.4, 0.5); c.fillRect(-L / 2, W / 2 - 0.5, 0.4, 0.5); }
    c.restore(); return;
  }
  drawCar(c, q, d.color || "#c0392b", "rgba(0,0,0,.35)", d.ind, t, false, false);
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
