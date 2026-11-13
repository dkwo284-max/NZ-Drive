// 추가 코스: 모터웨이·지방도로·특수 상황·출발/언덕·위험 인지. 좌표는 scenarios.js 와 같음(북쪽이 위, 좌측통행).
import { PB, Path } from "./engine.js";

const L = {
  mwy: "https://nzta.govt.nz/roadcode/general-road-code/about-driving/driving-on-the-motorway",
  rc: "https://nzta.govt.nz/roadcode/general-road-code",
  speed: "https://nzta2.cwp.govt.nz/roadcode/general-road-code/about-limits/speed-limits",
};
const road = (a, b, o = {}) => ({ a, b, w: 7, ...o });
const sg = (kind, s, o = {}) => ({ kind, s, o });
const label = (t, x, y, rot = 0, size = 3) => ({ k: "label", t, p: [x, y], rot, size });
const straight = (x, y0, y1) => new PB(x, y0).line(x, y1).done();
const fwd = (y0) => (y) => y0 - y; // 북쪽으로 가는 직선 경로에서 y → s
// 곡선 길: 중심선 경로를 따라 짧은 도로 조각을 이어 그린다
function roadAlong(path, step = 6, o = {}) { const out = []; for (let s = 0; s < path.len; s += step) { const a = path.at(s), b = path.at(Math.min(path.len, s + step + 0.4)); out.push(road([a.x, a.y], [b.x, b.y], o)); } return out; }
function offsetPath(path, off, rev = false) { const pts = []; for (let s = 0; s <= path.len; s += 0.5) { const q = path.at(s); pts.push([q.x - Math.sin(q.a) * off, q.y + Math.cos(q.a) * off]); } if (rev) pts.reverse(); return new Path(pts); }

export const SCENARIOS2 = [
  /* ================= 고속도로·지방 ================= */
  {
    id: "mwymerge", cat: "road", title: "모터웨이 합류 (램프 신호)", place: "SH1 Northcote 진입로 느낌",
    brief: "진입로 신호(Ramp signal)에서 초록불에 출발해 가속 차선에서 100km/h 가까이 올린 뒤, 오른쪽 깜빡이 → 👀 확인 → '차선 ▶' 로 본선 틈에 합류하세요.",
    tips: ["진입로 신호: 초록불 한 번에 한 대(1 CAR PER GREEN)", "가속 차선에서 본선 속도에 맞춰 충분히 가속 — 진입로 끝에서 멈추지 않기", "깜빡이 3초 → 거울·어깨 너머 확인 → 틈 선택 → 합류", "합류 후에는 왼쪽 차선 유지(추월할 때만 오른쪽)"],
    limit: 100, vmax: 30, link: L.mwy, zoom: 0.8, startLane: 0, rural: false,
    map: {
      roads: [road([0, 440], [0, -430], { lanes: [[0, "dash"]] }), road([-5.25, 330], [-5.25, 40], { w: 3.5, lines: false, sw: 2 }), road([8.5, 440], [8.5, -430], { lanes: [[0, "dash"]] })],
      marks: [{ k: "line", a: [-3.5, 330], b: [-3.5, 210] }, { k: "give", a: [-3.5, 210], b: [-3.5, 40] }, { k: "line", a: [-7, 330], b: [-7, 40] }, { k: "barrier", a: [4.25, 440], b: [4.25, -430] }, { k: "line", a: [-5.5, 276], b: [-3.6, 276] }, label("SH1 북쪽 방향", -11, 120, -Math.PI / 2), label("진입로", -10, 300, -Math.PI / 2)],
      bounds: [-120, -430, 120, 440],
    },
    agents: () => [
      ...Array.from({ length: 14 }, (_, k) => ({ kind: k % 5 === 3 ? "truck" : "car", v: 25, trigger: 0, color: ["#c0392b", "#7f8c8d", "#2980b9", "#8e44ad", "#16a085"][k % 5], path: straight(-1.75, 360 + k * 58, -440) })),
      ...Array.from({ length: 5 }, (_, k) => ({ kind: "car", v: 28, trigger: 0, color: "#34495e", path: straight(1.75, 420 + k * 90, -440) })),
      ...Array.from({ length: 6 }, (_, k) => ({ kind: "car", v: 26, trigger: 0, color: "#95a5a6", path: straight(10.25, -440 - k * 80, 440) })),
    ],
    make() {
      const y0 = 320, s = fwd(y0), p = new PB(-1.75, y0).line(-1.75, -420).done();
      return {
        path: p, lanes: [{ off: -3.5, s0: 0, s1: s(40) }, { off: 0, s0: s(210) }, { off: 3.5, s0: s(210) }],
        signs: [sg("ramp", 10), sg("speed", s(200), { n: 100 }), sg("mwy", s(220))],
        rules: [
          { type: "light", s: s(276), at: [-8.2, 276], after: 3, why: "진입로 신호가 빨간불이면 정지선에서 멈춰요. 초록불 한 번에 한 대씩 들어갑니다." },
          { type: "speed", s0: 0, s1: p.len, limit: 100 },
          { type: "minspeed", s0: s(150), s1: s(45), min: 70, secs: 4, why: "가속 차선에서는 본선 속도(80~100km/h)에 맞춰 충분히 가속해야 안전하게 합류할 수 있어요. 너무 느리면 본선 차가 급제동해야 해요." },
          { type: "lane", s: s(42), need: [1, 2], fatal: true, why: "가속 차선이 끝났는데 합류하지 못했어요. 가속 차선 중간까지 속도를 올리고, 깜빡이·사각지대 확인 후 틈으로 들어가세요." },
          { type: "rightlane", s0: s(40), s1: p.len, idx: 2, secs: 14 },
        ],
      };
    },
  },
  {
    id: "mwyexit", cat: "road", title: "추월 후 복귀 · 출구로 나가기", place: "SH1 Esmonde Rd 출구 느낌",
    brief: "100km/h 모터웨이. 앞의 느린 트럭을 오른쪽 차선으로 추월한 뒤 왼쪽 차선으로 돌아오고, 'EXIT 425' 출구 차선으로 나가세요. 출구에서는 바로 감속!",
    tips: ["Keep left unless passing — 추월이 끝나면 왼쪽으로", "앞차와 2초 이상 간격(비 오면 4초)", "출구 1km 전부터 왼쪽 차선으로, 출구 차선에 들어간 뒤 감속", "크루즈를 써 보세요: C 또는 '크루즈' 버튼"],
    limit: 100, vmax: 30, v0: 90, link: L.mwy, zoom: 0.8, startLane: 1,
    map: {
      roads: [road([0, 440], [0, -560], { lanes: [[0, "dash"]] }), road([-5.25, 0], [-5.25, -440], { w: 3.5, lines: false, sw: 2 }), road([8.5, 440], [8.5, -560], { lanes: [[0, "dash"]] })],
      marks: [{ k: "give", a: [-3.5, 0], b: [-3.5, -300] }, { k: "line", a: [-3.5, -300], b: [-3.5, -440] }, { k: "line", a: [-7, 0], b: [-7, -440] }, { k: "barrier", a: [4.25, 440], b: [4.25, -560] }, label("EXIT 425 Esmonde Rd", -13, -150, -Math.PI / 2, 2.6)],
      bounds: [-120, -560, 120, 440],
    },
    agents: () => [
      { kind: "truck", v: 21, trigger: 0, path: straight(-1.75, 250, -600) },
      ...Array.from({ length: 4 }, (_, k) => ({ kind: "car", v: 28, trigger: 0, color: "#2980b9", path: straight(1.75, 380 + k * 140, -600) })),
      ...Array.from({ length: 6 }, (_, k) => ({ kind: "car", v: 26, trigger: 0, color: "#95a5a6", path: straight(10.25, -600 - k * 90, 440) })),
    ],
    make() {
      const y0 = 320, s = fwd(y0), p = new PB(-1.75, y0).line(-1.75, -420).done();
      return {
        path: p, lanes: [{ off: -3.5, s0: s(0), s1: p.len }, { off: 0, s1: s(-300) }, { off: 3.5, s1: s(-300) }],
        signs: [sg("speed", 8, { n: 100 }), sg("txt", 60, { lines: ["KEEP LEFT", "UNLESS PASSING"] }), sg("exit", s(80), { top: "EXIT 425  1km", name: "Esmonde Rd" }), sg("exit", s(10), { top: "EXIT 425", name: "Esmonde Rd" })],
        rules: [
          { type: "speed", s0: 0, s1: s(-300), limit: 100 },
          { type: "speed", s0: s(-330), s1: p.len, limit: 60, why: "출구 램프에 들어서면 바로 감속해요. 램프 끝은 신호·교차로라 일반 도로 속도로 줄여야 해요." },
          { type: "follow", s0: 0, s1: s(-300), agent: 0, secs: 2, why: "앞차(트럭)와 2초 이상 간격을 두세요. 바짝 붙으면 트럭 운전자가 나를 못 보고, 급정거 때 피할 수 없어요." },
          { type: "rightlane", s0: 0, s1: s(-300), idx: 2, secs: 16 },
          { type: "lane", s: s(-296), need: [0], kind: "special", why: "출구 차선으로 옮기지 못해 출구를 놓쳤어요. 출구 1km 전부터 왼쪽 차선으로 가 있다가, 출구 차선이 시작되면 깜빡이 → 확인 → 이동하세요. (놓치면 다음 출구로)" },
        ],
      };
    },
  },
  {
    id: "passlane", cat: "road", title: "시골길 추월 차선", place: "SH1 Dome Valley 느낌 (100km/h)",
    brief: "느린 트럭 뒤를 따라가다가, 추월 차선(PASSING LANE)이 나오면 오른쪽 차선으로 추월하고 차선이 끝나기 전에 왼쪽으로 돌아오세요. 노란 실선 구간에서는 추월 금지.",
    tips: ["추월 차선에서 느린 차는 왼쪽, 빠른 차는 오른쪽", "차선이 끝나기 전에 깜빡이 → 확인 → 왼쪽으로 합류", "내 쪽에 노란 실선(no-passing line)이 있으면 추월 금지", "앞차와 2초 이상"],
    limit: 100, vmax: 30, v0: 75, link: L.rc, zoom: 0.8, rural: true,
    map: {
      roads: [road([0, 340], [0, 180], { lanes: [[0, "nopass"]] }), road([0, 180], [0, -160], { lanes: [[0, "dash"]] }), road([0, -160], [0, -420], { lanes: [[0, "nopass"]] }), road([3.5, 180], [3.5, -160], { w: 7, lanes: [[0, "yellow"], [3.15, "solid"]], edges: false })],
      marks: [label("PASSING LANE", -7, 60, -Math.PI / 2, 2.6)], bounds: [-120, -420, 120, 340],
    },
    agents: () => [
      { kind: "truck", v: 20, trigger: 0, path: straight(-1.75, 260, -460) },
      { kind: "car", v: 25, trigger: 0, delay: 2, color: "#7f8c8d", path: new PB(1.75, -460).line(1.75, -170).line(5.25, -160).line(5.25, 170).line(1.75, 180).line(1.75, 360).done() },
      { kind: "car", v: 25, trigger: 120, color: "#2c3e50", path: new PB(1.75, -460).line(1.75, -170).line(5.25, -160).line(5.25, 170).line(1.75, 180).line(1.75, 360).done() },
    ],
    make() {
      const y0 = 320, s = fwd(y0), p = new PB(-1.75, y0).line(-1.75, -420).done();
      return {
        path: p, lanes: [{ off: 0 }, { off: 3.5, s0: s(175), s1: s(-150) }],
        signs: [sg("speed", 8, { n: 100 }), sg("txt", s(230), { lines: ["PASSING LANE", "300 m"] }), sg("txt", s(-90), { lines: ["MERGE", "LEFT"], bg: "#ffd200" })],
        rules: [
          { type: "speed", s0: 0, s1: p.len, limit: 100 },
          { type: "follow", s0: 0, s1: s(175), agent: 0, secs: 2 },
          { type: "lane", s: s(-152), need: [0], fatal: true, why: "추월 차선이 끝났는데 왼쪽으로 돌아오지 못했어요. 끝나기 한참 전에 추월을 마치고, 안 되면 트럭 뒤로 다시 들어가세요." },
        ],
      };
    },
  },
  {
    id: "onelane", cat: "road", title: "1차선 다리 — 양보 방향 읽기", place: "Northland 시골 다리 느낌",
    brief: "앞의 다리는 한 번에 한 방향만 지나요. 표지판의 작은 빨간 화살표가 내 방향이면 내가 양보해요. 맞은편 차가 다 건넌 뒤 건너세요.",
    tips: ["큰 흰/검은 화살표 = 우선, 작은 빨간 화살표 = 양보", "양보 쪽은 다리 앞에서 멈춰 기다림", "다리 위에서 마주치면 위험 — 미리 감속"],
    limit: 100, vmax: 28, v0: 60, link: L.rc, rural: true,
    map: {
      roads: [road([0, 260], [0, 20]), road([0, -20], [0, -260]), road([0, 22], [0, -22], { w: 4.2, lines: false, bridge: true, sw: 0 })],
      water: [[-80, -16, 80, 16]], marks: [{ k: "give", a: [-3.5, 30], b: [0, 30] }, label("Wairua River", 30, 0, 0, 3)], bounds: [-120, -260, 120, 260], clear: [[-80, -16, 80, 16]],
    },
    agents: () => [{ kind: "car", v: 13, trigger: 100, color: "#d35400", path: new PB(1.75, -110).line(1.75, -34).mark("a").line(0, -22).line(0, 22).mark("b").line(1.75, 34).line(1.75, 280).done() }],
    make() {
      const y0 = 240, s = fwd(y0), p = new PB(-1.75, y0).line(-1.75, 34).mark("in").line(0, 22).line(0, -22).line(-1.75, -34).line(-1.75, -240).done(), a = this.agents()[0].path.marks;
      return {
        path: p, signs: [sg("speed", 6, { n: 100 }), sg("onelane", s(140), { give: true }), sg("giveway", s(36))],
        rules: [
          { type: "speed", s0: 0, s1: p.len, limit: 100 },
          { type: "speed", s0: s(100), s1: s(-40), limit: 60, advisory: true, why: "1차선 다리 앞에서는 멈출 수 있게 감속하세요(권장속도)." },
          { type: "yield", s0: s(31), s1: s(-20), agent: 0, a0: a.a, a1: a.b, secs: 3.5, why: "작은 빨간 화살표가 내 쪽이에요 — 다리 위나 다가오는 맞은편 차가 먼저예요. 다 건넌 뒤 출발하세요." },
        ],
      };
    },
  },
  {
    id: "curvegravel", cat: "road", title: "급커브 권장속도 · 자갈길 · 가축", place: "Coromandel 시골길 느낌",
    brief: "노란 커브 표지판의 숫자는 권장속도예요. 커브 전에 미리 감속하고, 자갈길(LOOSE GRAVEL)에서는 천천히, 길을 건너는 소를 보면 멈추세요.",
    tips: ["커브 권장속도는 법정 한도는 아니지만 넘으면 위험·시험 감점", "커브 '전에' 브레이크, 커브 안에서는 일정 속도", "자갈길은 제동거리가 길어요", "가축이 보이면 멈추고 기다리기 — 경적 금지"],
    limit: 100, vmax: 28, v0: 70, link: L.speed, rural: true,
    ...(() => {
      const cl = new PB(0, 400).line(0, 200).mark("c1").arc(40, 200, 40, Math.PI, 1.5 * Math.PI).line(80, 160).arc(80, 120, 40, Math.PI / 2, 0).mark("c2").line(120, 60).mark("g0").line(120, -60).mark("g1").line(120, -220).done();
      const roads = roadAlong(cl, 6, { lanes: [[0, "dash"]] }).map((r, i) => (cl.at(i * 6).y < 60 && cl.at(i * 6).y > -60 && cl.at(i * 6).x > 100 ? { ...r, color: "#a68a64", lanes: [], edges: false } : r));
      return { _cl: cl, map: { roads, marks: [{ k: "chev", p: [28, 168], rot: 0.6 }, { k: "chev", p: [92, 152], rot: -0.6 }, label("LOOSE GRAVEL", 127, 0, -Math.PI / 2, 2.4)], bounds: [-100, -220, 220, 400] } };
    })(),
    agents() { return [{ kind: "cow", v: 0.9, trigger: this._s(-40), color: "#fff", path: new PB(108, -96).line(132, -96).done() }, { kind: "car", v: 15, trigger: 0, delay: 3, color: "#7f8c8d", path: offsetPath(this._cl, 1.75, true) }]; },
    _s(y) { const p = this._cl; for (let s = 0; s < p.len; s += 1) { const q = p.at(s); if (q.x > 100 && q.y <= y) return s; } return p.len; },
    make() {
      const p = offsetPath(this._cl, -1.75), m = this._cl.marks, s = (y) => this._s(y);
      return {
        path: p, signs: [sg("speed", 6, { n: 100 }), sg("curve", m.c1 - 90, { n: 45 }), sg("txt", m.g0 - 40, { lines: ["LOOSE", "GRAVEL"], bg: "#ffd200" }), sg("stock", s(-40))],
        rules: [
          { type: "speed", s0: 0, s1: p.len, limit: 100 },
          { type: "speed", s0: m.c1 - 10, s1: m.c2, limit: 52, advisory: true, why: "커브 권장속도 45km/h 를 크게 넘었어요. 권장속도는 '좋은 날씨에 안전한 최고 속도'라서 넘으면 차선을 벗어나기 쉬워요. 커브 전에 미리 감속하세요." },
          { type: "speed", s0: m.g0, s1: m.g1, limit: 60, advisory: true, why: "자갈길에서는 미끄러지고 돌이 튀어요. 60km/h 이하로 천천히, 급제동·급핸들 금지." },
          { type: "ped", s0: s(-86), s1: s(-104), agent: 0, a0: 9, a1: 17, why: "소가 길을 건너고 있어요. 완전히 멈춰 기다리세요(경적·위협 금지)." },
        ],
      };
    },
  },
  {
    id: "rain", cat: "road", title: "비 오는 날 4초 간격", place: "Tāmaki Dr 비 오는 퇴근길 느낌 (80km/h)",
    brief: "비가 와서 길이 미끄러워요. 앞차와의 간격을 4초 이상(평소 2초) 유지하세요. 크루즈를 켜고 +/− 로 맞춰 보세요.",
    tips: ["2초 규칙: 앞차가 지난 지점을 내가 지날 때까지 '하나, 둘' — 비 올 때는 4초", "젖은 길은 제동거리가 두 배 가까이", "비 오면 헤드라이트 켜기"],
    limit: 80, vmax: 26, v0: 60, rain: true, link: L.rc,
    map: { roads: [road([0, 420], [0, -460])], water: [[-200, -460, -24, 420]], marks: [label("Tāmaki Dr", 8, 100, Math.PI / 2)], bounds: [-20, -460, 140, 420], clear: [[-200, -460, -6, 420]] },
    agents: () => [{ kind: "car", v: 18.5, trigger: 0, color: "#c0392b", path: straight(-1.75, 330, -500) }, ...Array.from({ length: 5 }, (_, k) => ({ kind: "car", v: 20, trigger: 0, color: "#95a5a6", path: straight(1.75, -460 - k * 120, 460) }))],
    make() {
      const p = straight(-1.75, 380, -420);
      return { path: p, signs: [sg("speed", 6, { n: 80 }), sg("txt", 120, { lines: ["SLIPPERY", "WHEN WET"], bg: "#ffd200" })], rules: [{ type: "speed", s0: 0, s1: p.len, limit: 80 }, { type: "follow", s0: 40, s1: p.len, agent: 0, secs: 4, why: "비 오는 날에는 앞차와 4초 이상 간격이 필요해요. 젖은 길은 제동거리가 길어요." }] };
    },
  },
  /* ================= 특수 상황 ================= */
  {
    id: "railway", cat: "special", title: "철도 건널목", place: "Glen Eden 건널목 느낌",
    brief: "건널목 경보등이 깜빡이고 종이 울리면 정지선에서 멈추세요. 열차가 완전히 지나가고 불이 꺼진 뒤 건너요.",
    tips: ["빨간 불이 번갈아 깜빡이면 반드시 정지", "차단기가 없어도 같음", "건널목 위에서 멈추지 않게 — 건너편에 자리가 있을 때만 진입"],
    limit: 50, link: L.rc,
    map: { roads: [road([0, 240], [0, -200])], marks: [{ k: "rail", x0: -160, x1: 160, y: 0 }, { k: "line", a: [-3.5, 8], b: [0, 8] }], bounds: [-120, -200, 120, 240] },
    agents: () => [{ kind: "train", v: 20, trigger: 110, path: new PB(-140, 0).line(320, 0).done() }],
    make() {
      const p = straight(-1.75, 220, -190), s = fwd(220);
      return { path: p, signs: [sg("speed", 6, { n: 50 }), sg("railway", s(70))], rules: [{ type: "speed", s0: 0, s1: p.len, limit: 50 }, { type: "light", kind: "rail", s: s(8), at: [-5.5, 9], untilAgent: 0, untilS: 175, why: "건널목 경보가 켜져 있는데 건넜어요. 열차는 멈출 수 없어요 — 불이 꺼질 때까지 정지선에서 기다리세요." }] };
    },
  },
  {
    id: "roadworks", cat: "special", title: "공사 구간 STOP/GO · 임시 속도", place: "Great North Rd 공사 구간 느낌",
    brief: "주황색 임시 속도 30 은 법적 제한속도예요. 공사 인부가 STOP 판을 들고 있으면 멈추고, GO 로 바뀌면 콘을 따라 맞은편 차선으로 지나가세요.",
    tips: ["임시 속도(TSL)는 단속 대상 — 공사가 안 보여도 지키기", "STOP/GO 판 = 신호등과 같음", "콘을 따라 천천히"],
    limit: 50, link: L.speed,
    map: { roads: [road([0, 260], [0, -220])], marks: [{ k: "cones", x: -0.2, y0: 42, y1: -42 }, { k: "cones", x: -3.2, y0: 60, y1: 44 }, { k: "line", a: [-3.5, 58], b: [0, 58] }, label("공사 중", -10, 0, -Math.PI / 2)], bounds: [-120, -220, 120, 260] },
    agents: () => [{ kind: "car", v: 8, trigger: 140, color: "#16a085", path: new PB(1.75, -170).line(1.75, 280).done() }],
    make() {
      const y0 = 240, s = fwd(y0), p = new PB(-1.75, y0).line(-1.75, 54).line(1.75, 44).line(1.75, -44).line(-1.75, -54).line(-1.75, -210).done();
      return {
        path: p, signs: [sg("roadworks", s(160)), sg("tsl", s(130), { n: 30 }), sg("speed", s(-80), { n: 50 })],
        rules: [{ type: "speed", s0: 0, s1: s(135), limit: 50 }, { type: "speed", s0: s(130), s1: s(-75), limit: 30, why: "공사 구간 임시 제한속도(30)는 법적 제한이에요. 일하는 사람이 있으니 꼭 지켜요." }, { type: "speed", s0: s(-80), s1: p.len, limit: 50 },
          { type: "light", kind: "stopgo", s: s(58), at: [-5.5, 58], untilAgent: 0, untilS: 260, why: "STOP 판이 보이는데 지나갔어요. 공사 구간 STOP/GO 판은 신호등과 같아요." }],
      };
    },
  },
  {
    id: "cyclist", cat: "special", title: "자전거 추월 1.5m", place: "Ponsonby 동네 길 (50km/h)",
    brief: "앞에 자전거가 있어요. 맞은편 차가 없을 때 오른쪽으로 비켜(차선 ▶) 1.5m 이상 간격을 두고 추월한 뒤 원래 차선으로 돌아오세요.",
    tips: ["자전거를 추월할 때는 최소 1.5m 이상 간격(권장)", "중앙선을 넘을 땐 맞은편이 비었을 때만", "추월 전 깜빡이·확인, 추월 후 원래 자리로"],
    limit: 50, v0: 30, link: L.rc,
    map: { roads: [road([0, 280], [0, -260])], marks: [label("Richmond Rd", -7.5, 100, -Math.PI / 2)], bounds: [-120, -260, 120, 280] },
    agents: () => [
      { kind: "bike", v: 5, trigger: 0, color: "#00a8ff", path: straight(-3.0, 205, -280) },
      ...Array.from({ length: 3 }, (_, k) => ({ kind: "car", v: 13, trigger: 0, delay: k * 6, color: "#7f8c8d", path: straight(1.75, -260, 300) })),
    ],
    make() {
      const p = straight(-1.75, 260, -250);
      return { path: p, lanes: [{ off: 0 }, { off: 1.7 }], signs: [sg("speed", 6, { n: 50 }), sg("cyclist", 40)],
        rules: [{ type: "speed", s0: 0, s1: p.len, limit: 50 }, { type: "cyclist", agent: 0, gap: 1.5, why: "자전거와 너무 가까이 지나갔어요. 1.5m 이상 간격을 두려면 중앙 쪽으로 비켜야 해요(맞은편이 비었을 때). 공간이 없으면 뒤에서 기다리세요." }, { type: "rightlane", s0: 0, s1: p.len, idx: 1, secs: 16, why: "추월이 끝나면 원래 차선 가운데로 돌아와요." }] };
    },
  },
  {
    id: "ambulance", cat: "special", title: "긴급차 양보", place: "Manukau Rd 느낌",
    brief: "뒤에서 사이렌을 켠 구급차가 와요. 왼쪽 깜빡이 → 확인 → 왼쪽 길가로 비켜(◀ 차선) 속도를 줄이고, 지나가면 다시 들어가세요.",
    tips: ["경광등·사이렌 차가 오면 안전하게 왼쪽으로 비켜 멈추거나 감속", "교차로 한가운데서는 멈추지 말고 지나서 비키기", "구급차가 지나가면 확인 후 다시 출발"],
    limit: 50, v0: 40, startLane: 1, link: L.rc,
    map: { roads: [road([-0.6, 300], [-0.6, -260], { w: 10.4, lanes: [[0.6, "dash"]] })], marks: [label("Manukau Rd", 8, 0, Math.PI / 2)], bounds: [-120, -260, 120, 300] },
    agents: () => [{ kind: "ambulance", v: 26, trigger: 40, path: straight(-1.75, 300, -300) }],
    make() {
      const p = straight(-1.75, 260, -250);
      return { path: p, lanes: [{ off: -2.7 }, { off: 0 }], signs: [sg("speed", 6, { n: 50 })],
        rules: [{ type: "speed", s0: 0, s1: p.len, limit: 50 }, { type: "pullover", s0: 50, s1: p.len, agent: 0, lane: 0, secs: 4.5, why: "구급차가 바로 뒤에 왔는데 비켜 주지 않았어요. 안전한 곳에서 왼쪽으로 비켜 멈추거나 속도를 줄이세요." }] };
    },
  },
  /* ================= 출발·언덕 (경로형) ================= */
  {
    id: "pullout", cat: "park", title: "연석에서 출발 → 다시 세우기", place: "Remuera 주택가 (시험 시작 장면)",
    brief: "길가에 세워진 상태에서 시작해요. 오른쪽 깜빡이 → 👀 확인 → 뒤차가 없을 때 '차선 ▶'로 출발하세요. 마지막엔 왼쪽 깜빡이 → 확인 → '◀ 차선'으로 연석에 붙여 세우세요.",
    tips: ["시험의 첫 동작: 출발 전 깜빡이·거울·어깨 너머 확인", "뒤에서 오는 차가 있으면 기다리기", "세울 때도 깜빡이 → 확인 → 연석 가까이 정지"],
    limit: 50, startLane: 0, link: L.rc,
    map: { roads: [road([0, 260], [0, -200], { w: 9.8, lanes: [[1.4, "dash"]] })], marks: [label("Remuera Rd", 9, 60, Math.PI / 2)], bounds: [-120, -200, 120, 260] },
    agents: () => [
      { kind: "car", v: 0, color: "#7f8c8d", path: straight(-4.15, 230, 229.9), ghost: false },
      ...Array.from({ length: 3 }, (_, k) => ({ kind: "car", v: 12, trigger: 0, delay: k * 4.5, color: ["#c0392b", "#2980b9", "#8e44ad"][k], path: straight(-1.75, 290, -260) })),
    ],
    make() {
      const y0 = 240, s = fwd(y0), p = straight(-1.75, y0, -150);
      return {
        path: p, lanes: [{ off: -2.4, r: [[0, 6], [s(-50), p.len]] }, { off: 0 }], signs: [sg("speed", 18, { n: 50 }), sg("park", s(-55), { n: 60 })],
        rules: [{ type: "speed", s0: 0, s1: p.len, limit: 50 }, { type: "lane", s: 7, need: [1], fatal: true, why: "연석에서 빠져나오지 못해 앞에 주차된 차와 부딪혀요. 출발 직후 깜빡이·확인 후 차선으로 나오세요." },
          { type: "park", s0: s(-60), s1: s(-140), s: s(-140), lane: 0, good: "출발과 정차 모두 잘했어요! 시험도 이렇게 시작하고 끝나요.", why: "마지막에 연석 쪽으로 붙여 세우지 못했어요. 왼쪽 깜빡이 → 👀 확인 → ◀ 차선 → 정지(1.5초)." }],
      };
    },
  },
  {
    id: "hillstart", cat: "park", title: "언덕 출발 (뒤로 밀리지 않기)", place: "Mt Eden Rd 오르막 STOP",
    brief: "8% 오르막 중간의 STOP 에서 완전히 멈춘 뒤, 오른쪽 차가 지나가면 출발하세요. 브레이크를 떼면 차가 뒤로 밀리니 바로 가속하세요(뒤에 차가 있어요).",
    tips: ["언덕 정지: 브레이크(또는 핸드브레이크)로 확실히", "출발: 가속을 시작하면서 브레이크를 놓기 — 밀리면 감점", "내리막 주차는 바퀴를 연석 쪽으로"],
    limit: 50, link: L.rc,
    map: { roads: [road([0, 260], [0, 3.5]), road([-170, 0], [170, 0])], marks: [{ k: "stop", a: [-3.5, 5], b: [0, 5], tx: -1.75, ty: 8.6 }, label("오르막 8%", -8, 90, -Math.PI / 2), label("⬆", -14, 140, 0, 6), label("⬆", -14, 60, 0, 6)], bounds: [-140, -100, 140, 260] },
    agents: () => [{ kind: "car", v: 11, trigger: 0, delay: 3, color: "#7f8c8d", path: straight(-1.75, 330, 3.6), stay: true }, { kind: "car", v: 11, trigger: 200, color: "#27ae60", path: new PB(70, 1.75).line(-170, 1.75).done() }],
    make() {
      const y0 = 240, s = fwd(y0), p = new PB(-1.75, y0).line(-1.75, 5).mark("stop").line(-1.75, 3.5).arc(-3.5, 3.5, 1.75, 0, -Math.PI / 2).line(-150, 1.75).done(), m = p.marks;
      return {
        path: p, slopes: [{ s0: 60, s1: m.stop + 1, g: 0.08 }], signs: [sg("stop", m.stop - 4)],
        choices: [{ id: 0, s: m.stop + 30, q: "만약 여기가 '내리막'이고 왼쪽 연석 옆에 주차한다면 앞바퀴 방향은?", opts: [
          { t: "연석 쪽(왼쪽)으로 꺾는다", ok: true, good: "정답! 내리막은 연석 쪽으로 — 차가 굴러도 연석에 걸려요. 오르막(연석 있음)은 도로 쪽(오른쪽)으로." },
          { t: "도로 쪽(오른쪽)으로 꺾는다", ok: false, type: "park", why: "내리막에서는 바퀴를 연석 쪽(왼쪽)으로 꺾어야 브레이크가 풀려도 연석에 걸려 멈춰요. 도로 쪽은 오르막 + 연석 있을 때." },
          { t: "똑바로 둔다", ok: false, type: "park", why: "언덕 주차는 바퀴를 꺾어 둬야 해요. 내리막은 연석 쪽, 오르막(연석 있음)은 도로 쪽." }] }],
        rules: [{ type: "speed", s0: 0, s1: p.len, limit: 50 }, { type: "stop", s: m.stop }, { type: "signal", s: m.stop + 1.4, dir: "L" },
          { type: "yield", s0: m.stop + 0.3, s1: m.stop + 8, agent: 1, a0: 60, a1: 76, secs: 2.6, why: "STOP 에서 멈춘 뒤 큰길 차에 양보하세요." }],
      };
    },
  },
  /* ================= 위험 인지 ================= */
  {
    id: "hazard", cat: "licence", title: "위험 인지(Hazard) 훈련", place: "Sandringham 주택가 (50km/h)",
    brief: "주택가를 달리며 위험 요소(갑자기 나올 수 있는 사람·차·열리는 문)가 보이는 순간 '⚠ 위험' 버튼(H 키)을 누르세요. 크루즈를 40 정도로 켜면 화면에 집중하기 좋아요. 위험이 없을 때 누르면 감점.",
    tips: ["주차된 차 사이, 진입로, 버스 정류장, 공 — 사람이 튀어나올 수 있는 곳", "보이면 '먼저' 속도를 줄이고 대비", "2027년부터 리스트릭티드 시험에 위험 인지가 포함될 예정"],
    limit: 50, v0: 35, hazardMode: true, link: L.rc,
    map: { roads: [road([0, 640], [0, -120], { w: 10, lanes: [[0, "dash"]] })], marks: [label("Sandringham Rd", 9, 300, Math.PI / 2), { k: "text", t: "BUS STOP", p: [-4, 160], size: 1.6, color: "#f5c400", rot: 0 }], bounds: [-120, -120, 120, 640] },
    agents() {
      const P = (x, y) => straight(x, y, y - 0.1), y0 = 620, s = fwd(y0);
      return [
        { kind: "car", v: 0, color: "#7f8c8d", path: P(-4, 540) }, { kind: "car", v: 0, color: "#bdc3c7", path: P(-4, 532) },
        { kind: "ped", v: 1.6, trigger: s(570), color: "#e84393", show: true, path: new PB(-5.6, 536).line(4, 536).done() }, // 0~1 주차차 사이 아이
        { kind: "door", v: 0, trigger: s(470), color: "#2980b9", side: 1, path: P(-4, 445) },
        { kind: "car", v: 2.2, trigger: s(390), color: "#16a085", path: new PB(-15, 352).line(-6.6, 352).done(), stay: true },
        { kind: "bus", v: 11, trigger: s(230), delay: 0.5, path: new PB(-4.2, 165).line(-1.9, 150).line(-1.9, -140).done() },
        { kind: "ped", v: 3.5, trigger: s(120), color: "#fdcb6e", show: true, path: new PB(-7.5, 70).line(-4.3, 70).done() },
        { kind: "bike", v: 5, trigger: s(70), color: "#00a8ff", path: new PB(-3.8, 30).line(-3.8, 10).line(-2.0, 0).line(-3.8, -12).line(-3.8, -140).done() },
        ...Array.from({ length: 3 }, (_, k) => ({ kind: "car", v: 12, trigger: 0, delay: k * 9, color: "#95a5a6", path: straight(2.5, -140, 660) })),
      ];
    },
    make() {
      const y0 = 620, s = fwd(y0), p = straight(-1.75, y0, -110), H = (name, a, b) => ({ type: "hazard", s0: s(a), s1: s(b), name });
      return {
        path: p, signs: [sg("speed", 6, { n: 50 }), sg("children", s(585))],
        rules: [{ type: "speed", s0: 0, s1: p.len, limit: 50 }, H("주차된 차 사이에서 아이가 나옴", 575, 541), H("주차된 차 문이 열림", 470, 449), H("진입로에서 후진해 나오는 차", 395, 357), H("정류장에서 출발하는 버스", 232, 168), H("공을 쫓아 뛰어나오는 아이", 122, 74), H("앞의 자전거가 길 안쪽으로 들어옴", 52, 4),
          { type: "ped", s0: s(540), s1: s(532), agent: 2, a0: 3, a1: 9, why: "주차된 차 사이에서 아이가 뛰어나왔어요. 주차 차량 사이는 아이가 보이지 않는 곳 — 미리 속도를 줄이고 멈출 준비를 하세요." }],
      };
    },
  },
];
