// 운전 연습 엔진: 위에서 본 2D 캔버스 + 운전석 미리보기(유사 3D). 좌표 단위는 m, y 는 아래로 증가(화면 좌표).
// 차는 코스 경로를 자동으로 따라가고(조향 자동), 차선 변경은 버튼(거울·사각지대 확인 후), 속도는 가속/브레이크/크루즈.
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

/* ---------- 위반 종류: [이름, 감점, 모의시험 분류(CE=치명 오류, IFE=즉시 실격)] ---------- */
export const VIOL = {
  lane: ["좌측통행·차선", 25, "IFE"], yield: ["양보", 20, "IFE"], stop: ["STOP 정지", 20, "CE"], signal: ["깜빡이", 10, "CE"], speed: ["속도", 15, "CE"],
  ped: ["보행자", 25, "IFE"], light: ["신호등·건널목", 25, "IFE"], special: ["버스·T2·클리어웨이", 15, "CE"], park: ["주정차", 10, "CE"], crash: ["충돌", 100, "IFE"],
  observe: ["거울·사각지대 확인", 15, "CE"], gap: ["갭(차 사이 간격) 선택", 25, "IFE"], follow: ["차간 거리", 15, "CE"], rollback: ["언덕 밀림", 15, "CE"],
  kerb: ["연석 올라탐", 15, "CE"], emergency: ["긴급차 양보", 20, "CE"], cyclist: ["자전거 간격", 20, "CE"], slow: ["너무 느림", 10, "CE"],
};
const ROADCODE = "https://nzta.govt.nz/roadcode/general-road-code/about-driving/giving-way/the-give-way-rules";
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/* ---------- 엔진 ---------- */
export class Game {
  constructor(sc, canvas, pov, hooks, opt = {}) {
    this.sc = sc; this.cv = canvas; this.ctx = canvas?.getContext("2d"); this.pov = pov; this.pctx = pov?.getContext("2d"); this.hooks = hooks; this.test = !!opt.test;
    this.sel = []; this.rebuild();
    this.s = 0; this.maxS = 0; this.v = (sc.v0 || 0) / 3.6; this.t = 0; this.ind = null; this.indSince = 0; this.viol = []; this.fired = new Set();
    this.minV = {}; this.inSpeed = {}; this.stopT = {}; this.light = {}; this.parkT = 0; this.cnt = {};
    this.lane = sc.startLane || 0; this.off = this.laneOff(this.lane); this.obsAt = -99; this.cruise = null; this.lastCruise = null; this.isa = false; this.isaUsed = false;
    this.haz = { caught: new Set(), missed: new Set(), wrong: 0 };
    this.keys = { gas: false, brake: false }; this.paused = true; this.ended = false;
    this.agents = (sc.agents?.() || []).map((d) => ({ d, s: d.s0 || 0, on: d.v === 0 || !d.trigger, wait: d.delay || 0, done: false, v: d.v || 0 }));
    this.decor = makeDecor(sc);
    if (canvas) this.resize();
  }
  rebuild() { const r = this.sc.make(this.sel); this.path = r.path; this.rules = r.rules; this.signs = r.signs; this.choices = r.choices || []; this.lanes = r.lanes || [{ off: 0 }]; this.slopes = r.slopes || []; }
  laneOff(i) { return this.lanes[i]?.off ?? 0; }
  laneOpen(i, s = this.s) { const L = this.lanes[i]; if (!L) return false; if (L.r) return L.r.some(([a, b]) => s >= a && s <= b); return (L.s0 == null || s >= L.s0) && (L.s1 == null || s <= L.s1); }
  resize() {
    if (!this.cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), r = this.cv.getBoundingClientRect();
    this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr); this.dpr = dpr;
    if (this.pov) { const q = this.pov.getBoundingClientRect(); this.pov.width = Math.round(q.width * dpr); this.pov.height = Math.round(q.height * dpr); }
    this.draw();
  }
  start() { this.paused = false; this.last = performance.now(); const loop = (now) => { if (this.ended) return; const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; if (!this.paused) this.step(dt); this.draw(); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); }
  stop() { this.ended = true; cancelAnimationFrame(this.raf); }
  setInd(d) { this.ind = this.ind === d ? null : d; this.indSince = this.t; this.hooks.hud?.(this); }
  observe() { this.obsAt = this.t; this.hooks.toast?.("👀 거울·사각지대 확인"); }
  limitNow(adv = false) { const r = this.rules.filter((x) => x.type === "speed" && this.s >= x.s0 && this.s <= x.s1 && (adv || !x.advisory)); return r.length ? Math.min(...r.map((x) => x.limit)) : this.sc.limit || 50; }
  clock() { if (!this.sc.clock) return null; const [h, m] = this.sc.clock.split(":").map(Number), tot = h * 60 + m + Math.floor(this.t / 60); return `${String(Math.floor(tot / 60) % 24).padStart(2, "0")}:${String(tot % 60).padStart(2, "0")}`; }
  /* 크루즈: 켜면 지금 속도 유지(최소 20km/h). 브레이크를 밟으면 해제, 다시 누르면 이전 속도로 재개 */
  toggleCruise() {
    if (this.cruise != null) { this.cruise = null; this.hooks.toast?.("크루즈 해제"); }
    else { const kmh = this.v * 3.6 >= 15 ? Math.max(20, Math.round(this.v * 3.6 / 5) * 5) : this.lastCruise || 30; this.cruise = kmh / 3.6; this.lastCruise = kmh; this.isa = false; this.hooks.toast?.(`크루즈 ${kmh}km/h`); }
    this.hooks.hud?.(this);
  }
  adjCruise(d) { if (this.cruise == null) return; const kmh = clamp(Math.round(this.cruise * 3.6 + d), 20, 110); this.cruise = kmh / 3.6; this.lastCruise = kmh; this.hooks.hud?.(this); }
  toggleIsa() { this.isa = !this.isa; if (this.isa) { this.cruise = null; this.isaUsed = true; this.hooks.toast?.("제한속도 맞춤 — 표지판 속도에 맞춰 달려요(이 모드로 통과하면 별 최대 2개)"); } this.hooks.hud?.(this); }
  pos(s = this.s, off = this.off) { const P = this.path.at(s); return { x: P.x - Math.sin(P.a) * off, y: P.y + Math.cos(P.a) * off, a: P.a }; }
  rel(q) { const P = this.pos(), hx = Math.cos(P.a), hy = Math.sin(P.a), dx = q.x - P.x, dy = q.y - P.y; return { f: dx * hx + dy * hy, l: -dx * hy + dy * hx }; }
  changeLane(dir) {
    const to = this.lane + dir;
    if (!this.laneOpen(to)) { this.hooks.toast?.(dir < 0 ? "왼쪽에는 들어갈 차선이 없어요" : "오른쪽에는 들어갈 차선이 없어요"); return; }
    const want = dir < 0 ? "L" : "R";
    if (!(this.ind === want && this.t - this.indSince >= 2.5)) this.addViol("signal", `차선을 바꾸기 전 ${dir < 0 ? "왼쪽" : "오른쪽"} 깜빡이를 3초 이상 켜야 해요.`);
    if (this.t - this.obsAt > 4) this.addViol("observe", "차선을 바꾸기 직전 거울과 어깨 너머 사각지대를 확인해야 해요(👀 확인 버튼 / R 키). 시험에서 가장 자주 지적되는 부분이에요.");
    const dOff = this.laneOff(to) - this.off;
    for (const a of this.agents) {
      if (!a.on || a.done || a.d.kind === "ped") continue; const q = a.d.path.at(a.s), r = this.rel(q), opp = Math.cos(q.a - this.pos().a) < 0;
      if (Math.abs(r.l - dOff) < 2.2 && (opp ? r.f > -6 && r.f < 8 + (a.v + this.v) * 4 : r.f > -(8 + Math.max(0, a.v - this.v) * 2.2) && r.f < 7)) { this.addViol("gap", "옆 차선에 차가 있어 간격이 부족해요. 거울로 뒤차와의 거리·속도를 보고, 충분한 틈이 생기면 들어가세요."); break; }
    }
    this.lane = to; this.hooks.hud?.(this);
  }
  hazard() {
    const act = this.rules.map((r, i) => [r, i]).filter(([r, i]) => r.type === "hazard" && this.s >= r.s0 && this.s <= r.s1 && !this.haz.caught.has(i));
    if (act.length) { const [r, i] = act[0]; this.haz.caught.add(i); this.hooks.toast?.(`👀 위험 발견: ${r.name}`); }
    else { this.haz.wrong++; this.hooks.toast?.("지금은 위험 요소가 없어요 (−5)"); }
  }

  step(dt) {
    this.t += dt;
    // ---- 속도
    const slope = this.slopes.find((z) => this.s >= z.s0 && this.s <= z.s1)?.g || 0;
    let acc;
    if (this.keys.brake) { acc = -7.5; if (this.cruise != null) { this.cruise = null; this.hooks.toast?.("브레이크 — 크루즈 해제 (다시 누르면 재개)"); } }
    else if (this.keys.gas) acc = 2.8;
    else if (this.cruise != null || this.isa) { const tgt = this.cruise ?? Math.max(0, this.limitNow(true) - 2) / 3.6; acc = clamp((tgt - this.v) * 1.2, -2.5, 2.2); }
    else acc = -0.35;
    acc -= 0.004 * this.v * Math.abs(this.v);
    if (!(this.keys.brake && Math.abs(this.v) < 0.4)) acc -= 9.8 * slope; else this.v = 0;
    this.v = clamp(this.v + acc * dt, slope > 0 ? -2.5 : 0, (this.sc.vmax || 22));
    if (this.keys.brake && this.v < 0) this.v = 0;
    const prev = this.s;
    this.s = clamp(this.s + this.v * dt, 0, this.path.len); this.maxS = Math.max(this.maxS, this.s);
    if (slope > 0 && this.maxS - this.s > 0.6 && !this.fired.has("roll" + this.slopes.indexOf(this.slopes.find((z) => z.g === slope)))) { this.fired.add("roll" + this.slopes.findIndex((z) => z.g === slope)); this.addViol("rollback", "언덕에서 차가 뒤로 밀렸어요. 브레이크를 떼기 전에 가속을 시작(또는 핸드브레이크 출발)해 밀리지 않게 하세요."); }
    // ---- 차선 이동(옆으로 부드럽게)
    const to = this.laneOff(this.lane); if (this.off !== to) this.off += Math.sign(to - this.off) * Math.min(Math.abs(to - this.off), 1.5 * dt * (this.v > 1 ? 1 : 0.6));
    // ---- 에이전트
    const ME = this.pos();
    for (const a of this.agents) {
      if (a.done) continue;
      if (!a.on && this.s >= a.d.trigger) a.on = true;
      if (!a.on) continue;
      if (a.wait > 0) { a.wait -= dt; continue; }
      if (a.d.v) {
        // 가는 길 위에 내 차가 있으면 거리에 맞춰 감속(추돌·덮치기 방지). 사람·가축은 바로 앞에서만 멈춤
        const ped = a.d.kind === "ped" || a.d.kind === "cow", big = ["bus", "truck"].includes(a.d.kind), far = ped ? 1.6 : Math.min(70, (big ? 12 : 9) + a.v * 2.6);
        let dist = null;
        for (let k = ped ? 0.8 : 2; k <= far; k += ped ? 0.8 : 1.5) { const q = a.d.path.at(a.s + k); if (Math.hypot(q.x - ME.x, q.y - ME.y) < (ped ? 1.4 : 2.3)) { dist = k; break; } }
        const vt = dist == null ? a.d.v : ped ? 0 : Math.max(0, (dist - (big ? 9 : 6.5)) / 1.4);
        a.v = vt < a.v ? Math.max(vt, a.v - 9 * dt) : Math.min(vt, a.v + 2.5 * dt);
      }
      a.s += a.v * dt;
      if (a.s >= a.d.path.len) { a.done = !a.d.stay; a.s = a.d.path.len; }
    }
    // ---- 선택지
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
    // ---- 규칙
    for (const [i, r] of this.rules.entries()) {
      const key = "r" + i, crossed = prev < r.s && this.s >= r.s, once = (type, why, fatal) => { if (this.fired.has(key)) return; this.fired.add(key); this.addViol(type, why, fatal); };
      const inZ = this.s >= r.s0 && this.s <= r.s1;
      if (r.type === "speed" && inZ) {
        const over = this.v * 3.6 - r.limit;
        if (over > 3) { this.inSpeed[i] = (this.inSpeed[i] || 0) + dt; if (this.inSpeed[i] > 1) { this.lastOver = over; once("speed", r.why || `제한속도 ${r.limit}km/h 구간에서 ${Math.round(this.v * 3.6)}km/h. 뉴질랜드는 고정·이동식 단속 카메라가 많고, 조금만 넘어도 벌금이 나올 수 있어요.`); } }
        else this.inSpeed[i] = 0;
      }
      if (r.type === "minspeed" && inZ && this.v * 3.6 < r.min) { this.cnt[i] = (this.cnt[i] || 0) + dt; if (this.cnt[i] > (r.secs || 6)) once("slow", r.why || `여기서는 너무 느려요(${r.min}km/h 이상 권장). 고속도로·합류에서 너무 느리면 오히려 위험하고, 시험에서도 감점돼요.`); }
      if (r.type === "stop") {
        if (this.s >= r.s - 7 && this.s <= r.s) this.minV[i] = Math.min(this.minV[i] ?? 99, this.v);
        if (crossed && (this.minV[i] ?? 99) > 0.4) once("stop", r.why || "STOP 표지판에서는 정지선 앞에서 바퀴가 완전히 멈춰야 해요(서행 통과 불가). 멈춘 뒤 양보 규칙에 따라 출발합니다.");
      }
      if (r.type === "light") {
        const L = this.light[i] || (this.light[i] = { green: false, waited: 0 });
        if (!L.green) {
          if (r.untilAgent != null) { const a = this.agents[r.untilAgent]; if (a.done || a.s > r.untilS) L.green = true; }
          else { if (this.s >= r.s - 9 && this.v < 0.3) L.waited += dt; if (L.waited >= (r.after || 4) || this.t > 60) L.green = true; }
        }
        if (crossed && !L.green) once("light", r.why);
      }
      if (r.type === "signal" && crossed && !(this.ind === r.dir && this.t - this.indSince >= (r.need ?? 2.5))) once("signal", r.why || `${r.dir === "L" ? "왼쪽" : "오른쪽"} 깜빡이를 회전 3초 전부터 켜야 해요.`);
      if (r.type === "nosignal" && crossed && this.ind) once("signal", r.why);
      if (r.type === "obs" && crossed && this.t - this.obsAt > (r.secs || 6)) once("observe", r.why || "출발·회전 직전 거울과 사각지대를 확인하세요(👀 확인 버튼 / R 키).");
      if (r.type === "yield" && inZ && this.v > 0.5) {
        const a = this.agents[r.agent];
        if (a && a.on && !a.done && a.wait <= 0 && a.s >= r.a0 - (a.d.v || 10) * (r.secs || 2.8) && a.s <= r.a1) once(r.kind || "yield", r.why);
      }
      if (r.type === "ped" && inZ && this.v > 0.3) { const a = this.agents[r.agent]; if (a && a.on && !a.done && a.s >= r.a0 && a.s <= r.a1) once("ped", r.why); }
      if (r.type === "nostop" && inZ) { this.stopT[i] = this.v < 0.3 ? (this.stopT[i] || 0) + dt : 0; if (this.stopT[i] > 2) once(r.kind || "special", r.why); }
      if (r.type === "park") {
        if (inZ && this.v < 0.2 && (r.lane == null || this.lane === r.lane)) { this.parkT += dt; if (this.parkT > 1.5) return this.finish(true, r.good); } else this.parkT = 0;
        if (crossed) once("park", r.why);
      }
      if (r.type === "lane" && crossed && !r.need.includes(this.lane)) once(r.kind || "lane", r.why, !!r.fatal);
      if (r.type === "rightlane" && inZ && this.lane >= (r.idx ?? 2)) { this.cnt[i] = (this.cnt[i] || 0) + dt; if (this.cnt[i] > (r.secs || 15)) once("lane", r.why || "추월이 끝나면 왼쪽 차선으로 돌아와요(Keep left unless passing)."); }
      if (r.type === "follow" && inZ) {
        const a = this.agents[r.agent]; let bad = false;
        if (a && a.on && !a.done && this.v > 3) { const q = this.rel(a.d.path.at(a.s)); if (q.f > 0 && Math.abs(q.l) < 1.8) bad = (q.f - 5) / this.v < (r.secs || 2); }
        this.cnt[i] = bad ? (this.cnt[i] || 0) + dt : 0;
        if (this.cnt[i] > 2.5) once("follow", r.why || `앞차와 ${r.secs || 2}초 이상 거리를 두세요. 비 올 때는 4초.`);
      }
      if (r.type === "pullover" && inZ) {
        const a = this.agents[r.agent]; let bad = false;
        if (a && a.on && !a.done) { const q = this.rel(a.d.path.at(a.s)); bad = q.f < 0 && q.f > -45 && this.lane !== (r.lane ?? 1) && this.v > 2; }
        this.cnt[i] = bad ? (this.cnt[i] || 0) + dt : 0;
        if (this.cnt[i] > (r.secs || 5)) once("emergency", r.why);
      }
      if (r.type === "cyclist") { const a = this.agents[r.agent]; if (a && a.on && !a.done && this.v > 1) { const q = this.rel(a.d.path.at(a.s)); if (Math.abs(q.f) < 3 && Math.abs(q.l) < (r.gap || 1.5) + 0.95) once("cyclist", r.why); } }
      if (r.type === "hazard" && this.s > r.s1 && !this.haz.caught.has(i) && !this.haz.missed.has(i)) { this.haz.missed.add(i); if (this.sc.hazardMode) this.hooks.toast?.(`놓쳤어요: ${r.name}`); }
    }
    // ---- 충돌
    for (const a of this.agents) {
      if (!a.on || a.done || a.wait > 0 || a.d.ghost) continue;
      const q = a.d.path.at(a.s), big = { bus: [5.5, 1.25], schoolbus: [5.5, 1.25], truck: [6, 1.25], train: [30, 1.5] }[a.d.kind], hx = Math.cos(q.a), hy = Math.sin(q.a), dx = ME.x - q.x, dy = ME.y - q.y;
      const hit = ["ped", "cow"].includes(a.d.kind) ? Math.hypot(dx, dy) < 1.6 : a.d.kind === "bike" ? Math.abs(dx * hx + dy * hy) < 3.2 && Math.abs(-dx * hy + dy * hx) < 1.3 : Math.abs(dx * hx + dy * hy) < (big?.[0] ?? 2.25) + 2.0 && Math.abs(-dx * hy + dy * hx) < (big?.[1] ?? 0.95) + 0.8;
      if (hit && (Math.abs(this.v) > 0.3 || a.v > 0)) { this.addViol("crash", a.d.kind === "ped" ? "보행자와 부딪혔어요. 횡단보도·학교 주변에서는 언제든 멈출 수 있는 속도로." : a.d.kind === "train" ? "열차와 충돌했어요. 건널목 경보가 울리면 반드시 멈춰야 해요." : "다른 차(또는 장애물)와 부딪혔어요. 간격과 양보 순서를 확인하세요.", true); return; }
    }
    if (this.s >= this.path.len - 0.5) this.finish(true);
    this.hooks.hud?.(this);
  }
  addViol(type, why, fatal = false) {
    const [name, pen, cls] = VIOL[type] || [type, 10, "CE"];
    this.viol.push({ type, name, pen: fatal ? 100 : pen, why, t: this.t, cls: fatal ? "IFE" : type === "speed" && (this.lastOver || 0) > 10 ? "IFE" : cls });
    if (this.test && !fatal) { this.hooks.testViol?.(this.viol[this.viol.length - 1]); return; }
    this.paused = true;
    this.hooks.violation({ type, name, pen, why, fatal, link: this.sc.link || ROADCODE }, () => { if (fatal) this.finish(false); else this.paused = false; });
  }
  hazScore() { const n = this.rules.filter((r) => r.type === "hazard").length; return n ? Math.max(0, Math.round((this.haz.caught.size / n) * 100 - this.haz.wrong * 5)) : null; }
  score() { const h = this.sc.hazardMode ? this.hazScore() : null; const base = Math.max(0, 100 - this.viol.reduce((a, b) => a + b.pen, 0)); return h == null ? base : Math.max(0, Math.min(base, h)); }
  finish(ok, msg) { if (this.ended) return; this.stop(); const sc = this.score(), fatal = this.viol.some((x) => x.type === "crash"); this.hooks.end({ ok: ok && !fatal && sc >= 70, score: fatal ? 0 : sc, viol: this.viol, msg, time: this.t, isa: this.isaUsed, haz: this.sc.hazardMode ? { caught: this.haz.caught.size, total: this.rules.filter((r) => r.type === "hazard").length, wrong: this.haz.wrong } : null }); }

  /* ---------- 그리기 ---------- */
  draw() {
    if (!this.ctx) return;
    const c = this.ctx, W = this.cv.width, H = this.cv.height, P = this.pos(), k = (W < 700 * this.dpr ? 8 : 11) * this.dpr * (this.sc.zoom || 1);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = this.sc.rural ? "#8fb86a" : "#7fb069"; c.fillRect(0, 0, W, H);
    c.translate(W / 2, H * 0.62); c.rotate(-P.a - Math.PI / 2); c.scale(k, k); c.translate(-P.x, -P.y);
    drawMap(c, this.sc.map, this.decor, this.t);
    for (const [i, r] of this.rules.entries()) if (r.type === "light" && r.at) drawLight(c, r, this.light[i]?.green, this.t);
    for (const s of this.signs) { const im = signImg(s.kind, s.o); if (!im.complete) continue; const p = s.p || this.signPos(s.s), h = 3.4, w = h * (im.width / im.height || 1);
      c.save(); c.translate(p.x, p.y); c.rotate(P.a + Math.PI / 2); c.fillStyle = "rgba(0,0,0,.25)"; c.fillRect(-w / 2 + 0.25, -h / 2 + 0.25, w, h); c.drawImage(im, -w / 2, -h / 2, w, h); c.restore(); }
    for (const a of this.agents) { if (a.done || (!a.on && ["ped", "cow"].includes(a.d.kind) && !a.d.show)) continue; drawAgent(c, a.d, a.d.path.at(a.s), this.t, a); }
    drawCar(c, P, "#e8eef7", "#1f4fa0", this.ind, this.t, true, this.keys.brake);
    if (this.t - this.obsAt < 1.2) { c.strokeStyle = "rgba(255,204,77,.8)"; c.lineWidth = 0.25; c.beginPath(); c.arc(P.x, P.y, 7, 0, 7); c.stroke(); }
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (this.sc.rain) { c.fillStyle = "rgba(40,60,90,.18)"; c.fillRect(0, 0, W, H); c.strokeStyle = "rgba(220,230,255,.35)"; c.lineWidth = 1 * this.dpr; c.beginPath(); for (let i = 0; i < 90; i++) { const x = ((i * 97 + this.t * 300) % W), y = ((i * 53 + this.t * 900) % H); c.moveTo(x, y); c.lineTo(x - 3 * this.dpr, y + 12 * this.dpr); } c.stroke(); }
    this.drawPOV();
  }
  signPos(s) { const q = this.path.at(s), nx = Math.sin(q.a), ny = -Math.cos(q.a), d = 5.2 + Math.max(0, -Math.min(0, ...this.lanes.map((l) => l.off))); return { x: q.x + nx * d, y: q.y + ny * d }; }

  drawPOV() {
    const c = this.pctx; if (!c) return; const W = this.pov.width, H = this.pov.height, hz = H * 0.42, vx = W * 0.5;
    const g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, this.sc.rain ? "#8c99a6" : "#7cc0f2"); g.addColorStop(1, this.sc.rain ? "#c3ccd5" : "#d6ecfb"); c.fillStyle = g; c.fillRect(0, 0, W, hz);
    if (!this.sc.rural) {
      c.fillStyle = "#8aa2b8"; const sk = [[.05, .18], [.1, .27], [.16, .2], [.22, .34], [.27, .22], [.62, .3], [.68, .2], [.74, .36], [.8, .24], [.86, .3], [.92, .18]];
      for (const [x, hh] of sk) c.fillRect(W * x, hz - H * hh * 0.55, W * 0.05, H * hh * 0.55);
      c.fillStyle = "#6f879c"; c.fillRect(W * 0.43 - 2, hz - H * 0.36, 4, H * 0.36); c.beginPath(); c.ellipse(W * 0.43, hz - H * 0.27, W * 0.022, H * 0.025, 0, 0, 7); c.fill(); c.fillRect(W * 0.43 - 1, hz - H * 0.42, 2, H * 0.08);
    } else { c.fillStyle = "#7d9b6a"; c.beginPath(); c.moveTo(0, hz); for (let i = 0; i <= 10; i++) c.lineTo(W * i / 10, hz - H * (0.06 + 0.05 * Math.sin(i * 1.7))); c.lineTo(W, hz); c.fill(); }
    c.fillStyle = this.sc.rural ? "#93bb72" : "#86b36e"; c.fillRect(0, hz, W, H - hz);
    const by = H, half = W * 0.75, cxb = vx + W * 0.06 - this.off * W * 0.12 + this.laneOff(0) * W * 0.12 * 0;
    c.fillStyle = "#4b5058"; c.beginPath(); c.moveTo(vx, hz); c.lineTo(cxb + half, by); c.lineTo(cxb - half, by); c.closePath(); c.fill();
    const proj = (d, lat) => { const f = 4.5 / (d + 4.5); return { x: vx + (cxb - vx) * f + lat * (W * 0.12) * f, y: hz + (by - hz) * f, f }; };
    c.strokeStyle = "#f2f2f2"; c.lineWidth = 2 * this.dpr; c.setLineDash([10 * this.dpr, 12 * this.dpr]); c.lineDashOffset = -this.s * 6;
    c.beginPath(); const a = proj(200, 1.75), b = proj(0, 1.75); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.setLineDash([]);
    for (const r of this.rules) {
      const d = r.s - this.s; if (!(r.type === "stop" || r.type === "light" || r.type === "zebra") || d < 0 || d > 120) continue;
      const L = proj(d, -1.75), R = proj(d, 1.75); c.fillStyle = "#fff";
      if (r.type === "zebra") for (let i = 0; i < 6; i++) { c.fillRect(L.x + (R.x - L.x) * i / 6, L.y - 6 * L.f * this.dpr, (R.x - L.x) / 12, 6 * L.f * this.dpr * 2); }
      else c.fillRect(L.x, L.y - 2, R.x - L.x, Math.max(2, 5 * L.f * this.dpr));
    }
    // 앞의 차(같은 방향)
    for (const ag of this.agents) { if (!ag.on || ag.done || ["ped", "cow"].includes(ag.d.kind)) continue; const q = this.rel(ag.d.path.at(ag.s)); if (q.f < 3 || q.f > 120 || Math.abs(q.l) > 6) continue; const p = proj(q.f, q.l), w = W * 0.2 * p.f * 4, hh = w * (ag.d.kind === "truck" || ag.d.kind === "bus" ? 0.9 : 0.55); c.fillStyle = ag.d.color || (ag.d.kind === "truck" ? "#95a5a6" : "#c0392b"); c.fillRect(p.x - w / 2, p.y - hh, w, hh); c.fillStyle = "#ff4040"; c.fillRect(p.x - w / 2 + w * 0.08, p.y - hh * 0.45, w * 0.14, hh * 0.12); c.fillRect(p.x + w / 2 - w * 0.22, p.y - hh * 0.45, w * 0.14, hh * 0.12); }
    const ahead = this.signs.map((s) => ({ s, d: s.s - this.s })).filter((x) => x.d > 1 && x.d < 110).sort((x, y) => y.d - x.d);
    for (const { s, d } of ahead) {
      const im = signImg(s.kind, s.o); if (!im.complete) continue; const p = proj(d, -3.4 + Math.min(0, ...this.lanes.map((l) => l.off)) - this.off * 0), hpx = H * 0.75 * p.f * 2.2, wpx = hpx * (im.width / im.height || 1), post = hpx * 1.2;
      c.fillStyle = "#777"; c.fillRect(p.x - 1.5 * this.dpr, p.y - post, 3 * this.dpr, post);
      c.drawImage(im, p.x - wpx / 2, p.y - post - hpx, wpx, hpx);
    }
    for (const [i, r] of this.rules.entries()) { if (r.type !== "light") continue; const d = r.s - this.s; if (d < 0 || d > 110) continue; const p = proj(d, r.kind === "rail" ? -3 : 2.6), hp = H * 0.5 * p.f * 2, gr = this.light[i]?.green, on = Math.floor(this.t * 3) % 2;
      c.fillStyle = "#222"; c.fillRect(p.x - hp * 0.12, p.y - hp * 1.6, hp * 0.24, hp * 0.6);
      if (r.kind === "rail") { c.fillStyle = !gr && on ? "#ff3030" : "#333"; c.beginPath(); c.arc(p.x, p.y - hp * 1.45, hp * 0.08, 0, 7); c.fill(); c.fillStyle = !gr && !on ? "#ff3030" : "#333"; c.beginPath(); c.arc(p.x, p.y - hp * 1.15, hp * 0.08, 0, 7); c.fill(); }
      else { c.fillStyle = gr ? "#333" : "#ff3030"; c.beginPath(); c.arc(p.x, p.y - hp * 1.45, hp * 0.08, 0, 7); c.fill(); c.fillStyle = gr ? "#22e06b" : "#333"; c.beginPath(); c.arc(p.x, p.y - hp * 1.15, hp * 0.08, 0, 7); c.fill(); } }
    if (this.sc.rain) { c.fillStyle = "rgba(60,80,110,.18)"; c.fillRect(0, 0, W, H); }
    c.fillStyle = "rgba(20,24,30,.85)"; c.fillRect(0, H * 0.86, W, H * 0.14);
    c.fillStyle = "#fff"; c.font = `700 ${13 * this.dpr}px system-ui`; c.textAlign = "right"; c.fillText(`${Math.round(Math.abs(this.v) * 3.6)} km/h`, W - 10 * this.dpr, H * 0.95);
    if (this.cruise != null || this.isa) { c.fillStyle = "#6bd1ff"; c.textAlign = "center"; c.fillText(this.isa ? "AUTO" : `⟳${Math.round(this.cruise * 3.6)}`, W * 0.5, H * 0.95); }
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
  }) || (sc.map.clear || []).some(([x0, y0, x1, y1]) => x > x0 - pad && x < x1 + pad && y > y0 - pad && y < y1 + pad);
  const n = sc.rural ? 140 : 260;
  for (let i = 0; i < n; i++) {
    const x = B[0] + rnd() * (B[2] - B[0]), y = B[1] + rnd() * (B[3] - B[1]), w = 8 + rnd() * 14, h = 8 + rnd() * 14;
    if (onRoad(x, y, Math.max(w, h) / 2 + 2)) continue;
    const tree = sc.rural ? rnd() < 0.85 : rnd() >= 0.72;
    out.push(!tree ? { b: [x, y, w, h], c: ["#d9d4c7", "#c9c3b4", "#e6dfd0", "#b8c4cf", "#cfd8dc"][Math.floor(rnd() * 5)], roof: rnd() < 0.5 } : { t: [x, y, 2 + rnd() * 2.5] });
  }
  return out;
}
function drawMap(c, M, decor, t) {
  c.lineCap = "butt";
  for (const r of M.roads) { if (r.rb || r.bare) continue; c.strokeStyle = r.verge || "#cfcac0"; c.lineWidth = (r.w || 7) + (r.sw ?? 6); c.beginPath(); c.moveTo(...r.a); c.lineTo(...r.b); c.stroke(); }
  for (const r of M.roads) if (r.rb) { c.fillStyle = "#cfcac0"; c.beginPath(); c.arc(r.rb[0], r.rb[1], r.r + 3, 0, 7); c.fill(); }
  for (const w of M.water || []) { c.fillStyle = "#4f8fc0"; c.fillRect(w[0], w[1], w[2] - w[0], w[3] - w[1]); }
  for (const d of decor) {
    if (d.b) { const [x, y, w, h] = d.b; c.fillStyle = "rgba(0,0,0,.18)"; c.fillRect(x - w / 2 + 1, y - h / 2 + 1, w, h); c.fillStyle = d.c; c.fillRect(x - w / 2, y - h / 2, w, h); if (d.roof) { c.strokeStyle = "rgba(0,0,0,.12)"; c.lineWidth = 0.4; c.strokeRect(x - w / 2 + 1.5, y - h / 2 + 1.5, w - 3, h - 3); } }
    else { const [x, y, r] = d.t; c.fillStyle = "#3f7d3a"; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = "#5a9a4d"; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.55, 0, 7); c.fill(); }
  }
  for (const r of M.roads) { if (r.rb) continue; c.strokeStyle = r.color || "#4b5058"; c.lineWidth = r.w || 7; c.beginPath(); c.moveTo(...r.a); c.lineTo(...r.b); c.stroke(); if (r.bridge) { c.strokeStyle = "#9aa0a6"; c.lineWidth = 0.5; const [ax, ay] = r.a, [bx, by] = r.b, L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L, o = (r.w || 7) / 2 + 0.3; for (const s of [-o, o]) { c.beginPath(); c.moveTo(ax + nx * s, ay + ny * s); c.lineTo(bx + nx * s, by + ny * s); c.stroke(); } } }
  for (const r of M.roads) if (r.rb) { c.fillStyle = "#4b5058"; c.beginPath(); c.arc(r.rb[0], r.rb[1], r.r, 0, 7); c.fill(); }
  for (const z of M.zones || []) { c.fillStyle = z.color; c.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0); if (z.text) { c.save(); c.fillStyle = "rgba(255,255,255,.9)"; c.font = "bold 2.2px sans-serif"; c.textAlign = "center"; for (let y = z.y0 + 12; y < z.y1; y += 30) { c.save(); c.translate((z.x0 + z.x1) / 2, y); c.fillText(z.text, 0, 0); c.restore(); } c.restore(); } }
  for (const r of M.roads) {
    if (r.rb || r.lines === false) continue;
    const [ax, ay] = r.a, [bx, by] = r.b, L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L, nx = -uy, ny = ux, w = r.w || 7;
    c.strokeStyle = "#f4f4f4"; c.lineWidth = 0.15;
    if (r.edges !== false) for (const off of [-w / 2 + 0.35, w / 2 - 0.35]) { c.beginPath(); c.moveTo(ax + nx * off, ay + ny * off); c.lineTo(bx + nx * off, by + ny * off); c.stroke(); }
    for (const [off, kind] of r.lanes || [[0, "dash"]]) {
      c.strokeStyle = kind === "yellow" || kind === "nopass" ? "#f5c400" : "#f4f4f4"; c.lineWidth = kind === "solid" || kind === "yellow" || kind === "nopass" ? 0.18 : 0.15;
      c.setLineDash(kind === "dash" ? [3, 6] : kind === "yellow" ? [2.2, 1.6] : kind === "short" ? [1.5, 1.5] : []);
      c.beginPath(); c.moveTo(ax + nx * off, ay + ny * off); c.lineTo(bx + nx * off, by + ny * off); c.stroke(); c.setLineDash([]);
    }
  }
  for (const b of M.boxes || []) { c.fillStyle = "#4b5058"; c.fillRect(b[0], b[1], b[2] - b[0], b[3] - b[1]); }
  for (const r of M.roads) if (r.rb) { c.fillStyle = "#cfcac0"; c.beginPath(); c.arc(r.rb[0], r.rb[1], r.island + 0.6, 0, 7); c.fill(); c.fillStyle = "#6ea95c"; c.beginPath(); c.arc(r.rb[0], r.rb[1], r.island, 0, 7); c.fill(); }
  for (const m of M.marks || []) {
    c.fillStyle = "#f4f4f4"; c.strokeStyle = "#f4f4f4";
    if (m.k === "stop") { c.lineWidth = 0.6; line(c, m.a, m.b); c.save(); c.font = "bold 2.4px sans-serif"; c.textAlign = "center"; c.translate(m.tx, m.ty); c.rotate(m.rot || 0); c.fillText("STOP", 0, 0); c.restore(); }
    if (m.k === "give") { c.lineWidth = 0.3; c.setLineDash([0.9, 0.7]); line(c, m.a, m.b); c.setLineDash([]); }
    if (m.k === "line") { c.lineWidth = 0.45; line(c, m.a, m.b); }
    if (m.k === "zebra") { const [ax, ay] = m.a, [bx, by] = m.b, n = 8; c.lineWidth = 2.8; for (let i = 0; i < n; i++) { const f0 = (i + 0.2) / n, f1 = (i + 0.7) / n; c.beginPath(); c.moveTo(ax + (bx - ax) * f0, ay + (by - ay) * f0); c.lineTo(ax + (bx - ax) * f1, ay + (by - ay) * f1); c.stroke(); } }
    if (m.k === "diamond") { c.lineWidth = 0.25; c.beginPath(); c.moveTo(m.p[0], m.p[1] - 2.2); c.lineTo(m.p[0] + 0.8, m.p[1]); c.lineTo(m.p[0], m.p[1] + 2.2); c.lineTo(m.p[0] - 0.8, m.p[1]); c.closePath(); c.stroke(); }
    if (m.k === "text") { c.save(); c.fillStyle = m.color || "#f4f4f4"; c.font = `bold ${m.size || 2.2}px sans-serif`; c.textAlign = "center"; c.translate(m.p[0], m.p[1]); c.rotate(m.rot || 0); c.fillText(m.t, 0, 0); c.restore(); }
    if (m.k === "nostopline") { c.strokeStyle = "#f5c400"; c.lineWidth = 0.25; c.setLineDash([1.5, 1.2]); line(c, m.a, m.b); c.setLineDash([]); }
    if (m.k === "flash") { const on = Math.floor(t * 2) % 2; c.fillStyle = on ? "#ffb400" : "#7a5a00"; c.beginPath(); c.arc(m.p[0], m.p[1], 0.7, 0, 7); c.fill(); }
    if (m.k === "rail") { c.strokeStyle = "#6b4f2a"; c.lineWidth = 0.5; for (let x = m.x0; x < m.x1; x += 1.2) line(c, [x, m.y - 1.3], [x, m.y + 1.3]); c.strokeStyle = "#9aa0a6"; c.lineWidth = 0.18; line(c, [m.x0, m.y - 0.75], [m.x1, m.y - 0.75]); line(c, [m.x0, m.y + 0.75], [m.x1, m.y + 0.75]); }
    if (m.k === "cones") { for (let y = m.y0; y > m.y1; y -= 4) { c.fillStyle = "#ff7a00"; c.beginPath(); c.arc(m.x, y, 0.35, 0, 7); c.fill(); c.fillStyle = "#fff"; c.beginPath(); c.arc(m.x, y, 0.15, 0, 7); c.fill(); } }
    if (m.k === "barrier") { c.strokeStyle = "#b9bec4"; c.lineWidth = 0.5; line(c, m.a, m.b); }
    if (m.k === "chev") { c.save(); c.translate(m.p[0], m.p[1]); c.rotate(m.rot || 0); c.fillStyle = "#111"; c.fillRect(-1, -1.2, 2, 2.4); c.fillStyle = "#ffd200"; c.beginPath(); c.moveTo(-0.5, -0.8); c.lineTo(0.4, 0); c.lineTo(-0.5, 0.8); c.lineTo(-0.1, 0); c.closePath(); c.fill(); c.restore(); }
    if (m.k === "label") { c.save(); c.fillStyle = "rgba(255,255,255,.92)"; c.font = `bold ${m.size || 3}px system-ui, sans-serif`; c.textAlign = "center"; c.strokeStyle = "rgba(0,0,0,.35)"; c.lineWidth = 0.5; c.translate(m.p[0], m.p[1]); c.rotate(m.rot || 0); c.strokeText(m.t, 0, 0); c.fillText(m.t, 0, 0); c.restore(); }
  }
}
function drawLight(c, r, g, t) {
  c.save(); c.translate(r.at[0], r.at[1]);
  if (r.kind === "rail") { const on = Math.floor(t * 3) % 2; c.fillStyle = "#222"; c.fillRect(-1.6, -0.5, 3.2, 1); c.fillStyle = !g && on ? "#ff2d2d" : "#333"; c.beginPath(); c.arc(-0.9, 0, 0.45, 0, 7); c.fill(); c.fillStyle = !g && !on ? "#ff2d2d" : "#333"; c.beginPath(); c.arc(0.9, 0, 0.45, 0, 7); c.fill(); c.strokeStyle = "#d71920"; c.lineWidth = 0.35; line(c, [-1.2, -1.6], [1.2, -0.6]); line(c, [1.2, -1.6], [-1.2, -0.6]); }
  else if (r.kind === "stopgo") { c.fillStyle = "#ff7a00"; c.beginPath(); c.arc(0, 1.1, 0.55, 0, 7); c.fill(); c.fillStyle = "#555"; c.fillRect(-0.08, -1.2, 0.16, 2); c.fillStyle = g ? "#16a34a" : "#d71920"; c.beginPath(); if (g) c.arc(0, -1.6, 0.9, 0, 7); else { for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; c.lineTo(Math.cos(a) * 0.95, -1.6 + Math.sin(a) * 0.95); } } c.fill(); c.fillStyle = "#fff"; c.font = "bold 0.55px sans-serif"; c.textAlign = "center"; c.fillText(g ? "GO" : "STOP", 0, -1.4); }
  else { c.fillStyle = "#222"; c.fillRect(-0.7, -1.6, 1.4, 3.2); c.fillStyle = g ? "#333" : "#ff2d2d"; c.beginPath(); c.arc(0, -0.8, 0.5, 0, 7); c.fill(); c.fillStyle = g ? "#22e06b" : "#333"; c.beginPath(); c.arc(0, 0.8, 0.5, 0, 7); c.fill(); }
  c.restore();
}
const line = (c, a, b) => { c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke(); };
export function drawCar(c, P, body, roof, ind, t, me, brake, L = 4.5, W = 1.9) {
  c.save(); c.translate(P.x, P.y); c.rotate(P.a);
  c.fillStyle = "rgba(0,0,0,.3)"; c.fillRect(-L / 2 + 0.25, -W / 2 + 0.25, L, W);
  c.fillStyle = body; rr(c, -L / 2, -W / 2, L, W, 0.5); c.fill();
  c.fillStyle = roof; rr(c, -L / 2 + 1.1, -W / 2 + 0.2, Math.min(2.2, L - 2.3), W - 0.4, 0.3); c.fill();
  c.fillStyle = "#9cc8ef"; c.fillRect(L / 2 - 1.45, -W / 2 + 0.25, 0.45, W - 0.5);
  if (me) { c.fillStyle = "#ffcc4d"; c.beginPath(); c.arc(0.5, W / 2 - 0.55, 0.28, 0, 7); c.fill(); }
  const blink = Math.floor(t * 2.5) % 2 === 0;
  c.fillStyle = "#fff6c0"; c.fillRect(L / 2 - 0.2, -W / 2 + 0.1, 0.2, 0.4); c.fillRect(L / 2 - 0.2, W / 2 - 0.5, 0.2, 0.4);
  c.fillStyle = brake ? "#ff2020" : "#8a1010"; c.fillRect(-L / 2, -W / 2 + 0.1, 0.2, 0.4); c.fillRect(-L / 2, W / 2 - 0.5, 0.2, 0.4);
  if (ind && blink) { c.fillStyle = "#ffa000"; const y = ind === "L" ? -W / 2 - 0.15 : W / 2 - 0.25; c.fillRect(L / 2 - 0.5, y, 0.6, 0.4); c.fillRect(-L / 2 - 0.1, y, 0.6, 0.4); }
  c.restore();
}
function drawAgent(c, d, q, t, a) {
  const K = d.kind;
  if (K === "ped") { c.save(); c.translate(q.x, q.y); c.fillStyle = "rgba(0,0,0,.25)"; c.beginPath(); c.arc(0.15, 0.15, 0.6, 0, 7); c.fill(); c.fillStyle = d.color || "#e4572e"; c.beginPath(); c.arc(0, 0, 0.55, 0, 7); c.fill(); c.fillStyle = "#3b2a1a"; c.beginPath(); c.arc(0, 0, 0.3, 0, 7); c.fill(); c.restore(); return; }
  if (K === "cow") { c.save(); c.translate(q.x, q.y); c.rotate(q.a); c.fillStyle = "#fafafa"; c.beginPath(); c.ellipse(0, 0, 1.2, 0.6, 0, 0, 7); c.fill(); c.fillStyle = "#222"; c.beginPath(); c.arc(-0.3, -0.1, 0.3, 0, 7); c.arc(0.5, 0.2, 0.22, 0, 7); c.fill(); c.fillStyle = "#333"; c.beginPath(); c.arc(1.3, 0, 0.32, 0, 7); c.fill(); c.restore(); return; }
  if (K === "bike") { c.save(); c.translate(q.x, q.y); c.rotate(q.a); c.strokeStyle = "#222"; c.lineWidth = 0.15; line(c, [-0.9, 0], [0.9, 0]); c.fillStyle = d.color || "#00a8ff"; c.beginPath(); c.arc(0, 0, 0.38, 0, 7); c.fill(); c.restore(); return; }
  if (K === "cone") { c.fillStyle = "#ff7a00"; c.beginPath(); c.arc(q.x, q.y, 0.4, 0, 7); c.fill(); return; }
  const big = { bus: [11, 2.5, "#1f4fa0", "BUS"], schoolbus: [11, 2.5, "#ffcc00", "SCHOOL"], truck: [12, 2.5, "#95a5a6", ""], train: [60, 3, "#2d3436", "KiwiRail"] }[K];
  if (big) {
    const [L, W, col, txt] = big;
    c.save(); c.translate(q.x, q.y); c.rotate(q.a); c.fillStyle = "rgba(0,0,0,.3)"; c.fillRect(-L / 2 + 0.3, -W / 2 + 0.3, L, W);
    c.fillStyle = col; rr(c, -L / 2, -W / 2, L, W, 0.5); c.fill();
    if (K === "truck") { c.fillStyle = "#c0392b"; c.fillRect(L / 2 - 2.4, -W / 2, 2.4, W); } else if (K !== "train") { c.fillStyle = "rgba(255,255,255,.75)"; c.fillRect(-L / 2 + 1, -W / 2 + 0.3, L - 2, W - 0.6); }
    if (K === "train") { c.fillStyle = "#fdcb6e"; for (let x = -L / 2 + 2; x < L / 2 - 2; x += 15) c.fillRect(x, -W / 2 + 0.3, 12, W - 0.6); }
    if (txt) { c.fillStyle = "#111"; c.font = "bold 1.3px sans-serif"; c.textAlign = "center"; c.fillText(txt, 0, 0.45); }
    if (K === "schoolbus" && Math.floor(t * 2) % 2) { c.fillStyle = "#ff8a00"; c.fillRect(L / 2 - 0.4, -W / 2, 0.4, 0.5); c.fillRect(L / 2 - 0.4, W / 2 - 0.5, 0.4, 0.5); c.fillRect(-L / 2, -W / 2, 0.4, 0.5); c.fillRect(-L / 2, W / 2 - 0.5, 0.4, 0.5); }
    c.restore(); return;
  }
  if (K === "ambulance") { drawCar(c, q, "#f5f6fa", "#e1b12c", null, t, false, false, 5.2, 2.0); const on = Math.floor(t * 4) % 2; c.save(); c.translate(q.x, q.y); c.rotate(q.a); c.fillStyle = on ? "#ff2d2d" : "#2d6bff"; c.fillRect(0.2, -0.9, 0.5, 0.8); c.fillStyle = on ? "#2d6bff" : "#ff2d2d"; c.fillRect(0.2, 0.1, 0.5, 0.8); c.restore(); return; }
  drawCar(c, q, d.color || "#c0392b", "rgba(0,0,0,.35)", d.ind, t, false, false);
  if (K === "door" && a?.on) { c.save(); c.translate(q.x, q.y); c.rotate(q.a); c.fillStyle = d.color || "#c0392b"; c.translate(0.6, (d.side || 1) * 0.95); c.rotate((d.side || 1) * 0.9); c.fillRect(-1.1, -0.08, 1.1, 0.16); c.restore(); }
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
