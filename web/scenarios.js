// 연습 시나리오 12개. 오클랜드 도심 '느낌'의 가상 도로(실제 지도 아님). 좌측통행: 북쪽(위)으로 가는 차선은 도로 중심의 왼쪽(x<0).
import { PB } from "./engine.js";

const RC = "https://nzta.govt.nz/roadcode/general-road-code";
const LINK = {
  give: "https://nzta.govt.nz/roadcode/general-road-code/about-driving/giving-way/the-give-way-rules",
  rb: "https://nzta.govt.nz/roadcode/general-road-code/about-driving/giving-way/giving-way-at-roundabouts",
  speed: "https://nzta2.cwp.govt.nz/roadcode/general-road-code/about-limits/speed-limits",
  ped: "https://nzta2.cwp.govt.nz/roadcode/heavy-vehicle-road-code/road-code/sharing-the-road/sharing-the-road-with-pedestrians",
  at: "https://at.govt.nz/driving-parking/",
};
const road = (a, b, o = {}) => ({ a, b, w: 7, ...o });
const sg = (kind, s, o = {}) => ({ kind, s, o });
const N = (x, y0, y1) => road([x, y0], [x, y1]); // 남→북 도로(세로)
const label = (t, x, y, rot = 0, size = 3) => ({ k: "label", t, p: [x, y], rot, size });
const RB = { rb: [0, 0], r: 13.5, island: 6.5 };

// 공용 지도: 4거리
const cross = (lbl1, lbl2) => ({
  roads: [N(0, 230, -170), road([-170, 0], [170, 0])], boxes: [[-3.5, -3.5, 3.5, 3.5]],
  marks: [label(lbl1, -7.5, 90, -Math.PI / 2), label(lbl2, -70, -6.5)], bounds: [-140, -150, 140, 220],
});
const rbMap = (lbl) => ({
  roads: [RB, road([0, 13], [0, 220]), road([0, -13], [0, -170]), road([13, 0], [170, 0]), road([-13, 0], [-170, 0])],
  marks: [{ k: "give", a: [-3.5, 14], b: [0, 14] }, { k: "give", a: [0, -14], b: [3.5, -14] }, { k: "give", a: [14, -3.5], b: [14, 0] }, { k: "give", a: [-14, 0], b: [-14, 3.5] }, label(lbl, -8, 80, -Math.PI / 2)],
  bounds: [-140, -150, 140, 210],
});
// 로터리 진입 경로(남쪽에서 북쪽으로 진입, 시계 방향 회전)
const TE = Math.PI / 2 + 0.33;
function rbPath(exit) {
  const p = new PB(-1.75, 200).mark("start").line(-1.75, 16).mark("entry").line(10 * Math.cos(TE), 10 * Math.sin(TE)).arc(0, 0, 10, TE, Math.PI).mark("passW");
  if (exit === "N") p.arc(0, 0, 10, Math.PI, 1.5 * Math.PI - 0.17).mark("exit").line(-1.75, -14).line(-1.75, -160);
  else p.arc(0, 0, 10, Math.PI, 1.5 * Math.PI).mark("passN").arc(0, 0, 10, 1.5 * Math.PI, 2 * Math.PI - 0.17).mark("exit").line(14, -1.75).line(160, -1.75);
  return p.done();
}
function rbCar() { // 오른쪽(동쪽)에서 돌아오는 차 → 서쪽 출구
  const p = new PB(10 * Math.cos(-0.5), 10 * Math.sin(-0.5)).arc(0, 0, 10, -0.5, TE - 0.25).mark("c0").arc(0, 0, 10, TE - 0.25, TE + 0.55).mark("c1").arc(0, 0, 10, TE + 0.55, Math.PI - 0.17).line(-14, 1.75).line(-170, 1.75);
  return p.done();
}

export const CATS = [
  { id: "left", name: "좌측통행·회전·로터리", icon: "↺" },
  { id: "give", name: "Give Way·STOP·횡단보도", icon: "🛑" },
  { id: "lane", name: "버스·T2/T3·클리어웨이", icon: "🚌" },
  { id: "speed", name: "속도·학교·주차", icon: "🏫" },
];

export const SCENARIOS = [
  /* ---------------- 좌측통행·회전·로터리 ---------------- */
  {
    id: "keepleft", cat: "left", title: "왼쪽 차선 지키며 우회전", place: "Ponsonby Rd 느낌의 2차선 도로",
    brief: "왼쪽 차선으로 출발해 앞 교차로에서 오른쪽 골목(Franklin Rd 느낌)으로 우회전하세요. 맞은편에서 직진하는 차가 먼저예요.",
    tips: ["뉴질랜드는 좌측통행 — 운전석(오른쪽)이 항상 도로 중앙선 쪽", "우회전은 크게 돌고, 돌고 나서도 왼쪽 차선으로", "회전하는 차는 직진 차에 양보, 깜빡이는 3초 전부터"],
    limit: 50, link: LINK.give,
    map: { roads: [N(0, 230, -90), road([0, 0], [170, 0])], boxes: [[-3.5, -3.5, 3.5, 3.5]], marks: [{ k: "give", a: [4.5, 0], b: [4.5, 3.5] }, label("Ponsonby Rd", -7.5, 110, -Math.PI / 2), label("Franklin Rd", 70, -6.5)], bounds: [-120, -100, 170, 220] },
    agents: () => [
      { kind: "car", v: 12, trigger: 0, delay: 1, color: "#8e44ad", path: new PB(1.75, -90).line(1.75, 240).done() },
      { kind: "car", v: 11, trigger: 160, color: "#c0392b", path: new PB(1.75, -80).line(1.75, 240).done() },
    ],
    make(sel) {
      const p = new PB(-1.75, 210).line(-1.75, 3.5).mark("turn").arc(3.5, 3.5, 5.25, Math.PI, 1.5 * Math.PI).line(160, -1.75).done(), t = p.marks.turn;
      return {
        path: p,
        signs: [sg("speed", 12, { n: 50 })],
        choices: [
          { id: 0, s: 2, q: "출발! 어느 쪽 차선으로 달릴까요?", opts: [
            { t: "왼쪽 차선 (중앙선이 내 오른쪽)", ok: true, good: "정답! 좌측통행 — 운전석(오른쪽)이 중앙선 쪽에 오게 달리면 됩니다." },
            { t: "오른쪽 차선 (한국처럼)", fatal: true, why: "뉴질랜드는 좌측통행이라 오른쪽 차선은 맞은편 차가 오는 차선이에요. 정면충돌! 기억법: 운전석(오른쪽)이 항상 중앙선 쪽." }] },
          { id: 1, s: t - 3, q: "우회전해서 Franklin Rd 로 들어가면 어느 차선으로?", opts: [
            { t: "도로의 왼쪽 차선", ok: true, good: "맞아요. 돌고 나서도 왼쪽 차선. 크게 돌아 들어갑니다." },
            { t: "가까운 오른쪽 차선", fatal: true, why: "우회전 뒤 오른쪽 차선은 역주행이에요. 한국의 좌회전처럼 '크게' 돌아 왼쪽 차선으로 들어가야 합니다." }] },
        ],
        rules: [
          { type: "speed", s0: 0, s1: p.len, limit: 50 },
          { type: "signal", s: t, dir: "R", why: "우회전 3초 전부터 오른쪽 깜빡이를 켜야 해요(키보드 →, 화면 ▶)." },
          { type: "yield", s0: t, s1: t + 7, agent: 1, a0: 76, a1: 87, why: "우회전하는 차는 맞은편에서 직진하는 차에 양보해야 해요. 맞은편 차가 지나간 뒤 돌아요." },
        ],
      };
    },
  },
  {
    id: "leftturn", cat: "left", title: "좌회전 — 맞은편 우회전 차에 양보", place: "Dominion Rd × Balmoral Rd 느낌의 교차로",
    brief: "교차로에서 왼쪽(Balmoral Rd)으로 좌회전하세요. 맞은편 차가 오른쪽 깜빡이를 켜고 같은 길로 들어오려 해요.",
    tips: ["좌회전(짧게 도는 쪽) 차는 맞은편 우회전 차에 양보 — 2012년부터 바뀐 규칙", "좌회전은 가까운 왼쪽 차선으로 짧게", "깜빡이 3초 전"],
    limit: 50, link: LINK.give, map: cross("Dominion Rd", "Balmoral Rd"),
    agents: () => [
      { kind: "car", v: 12.5, trigger: 150, color: "#16a085", ind: "R", path: new PB(1.75, -60).line(1.75, -3.5).mark("a").arc(-3.5, -3.5, 5.25, 0, Math.PI / 2).line(-170, 1.75).done() },
      { kind: "car", v: 12, trigger: 0, delay: 0.5, color: "#7f8c8d", path: new PB(-170, -1.75).line(170, -1.75).done() },
    ],
    make() {
      const p = new PB(-1.75, 200).line(-1.75, 3.5).mark("turn").arc(-3.5, 3.5, 1.75, 0, -Math.PI / 2).line(-150, 1.75).done(), t = p.marks.turn;
      return {
        path: p, signs: [sg("speed", 10, { n: 50 }), sg("lights", 120)],
        rules: [
          { type: "speed", s0: 0, s1: p.len, limit: 50 },
          { type: "signal", s: t, dir: "L", why: "좌회전 3초 전부터 왼쪽 깜빡이(키보드 ←, 화면 ◀)." },
          { type: "yield", s0: t - 0.5, s1: t + 5, agent: 0, a0: 58, a1: 70, secs: 2.5, why: "뉴질랜드 규칙: 좌회전하는 차는 맞은편에서 우회전하는 차에 양보해요. 둘이 같은 길로 들어가니, 우회전 차가 먼저 들어간 뒤 따라 들어가세요." },
        ],
      };
    },
  },
  {
    id: "rbstraight", cat: "left", title: "로터리 직진", place: "Mt Albert 느낌의 로터리",
    brief: "로터리에서 직진(두 번째 출구, 북쪽)하세요. 로터리는 시계 방향으로 돌고, 오른쪽에서 오는 차에 양보해요.",
    tips: ["로터리는 시계 방향 — 들어갈 때 왼쪽으로", "오른쪽에서 오는 차(이미 도는 차 포함)에 양보", "직진은 진입 때 깜빡이 없음, 빠져나가기 직전 출구를 지나면 왼쪽 깜빡이"],
    limit: 50, link: LINK.rb, map: rbMap("New North Rd"),
    agents: () => [{ kind: "car", v: 8, trigger: 150, color: "#d35400", ind: "L", path: rbCar() }],
    make() {
      const p = rbPath("N"), m = p.marks, a = rbCar().marks;
      return {
        path: p, signs: [sg("roundabout", m.entry - 70), sg("giveway", m.entry - 6)],
        rules: [
          { type: "speed", s0: 0, s1: p.len, limit: 50 },
          { type: "nosignal", s: m.entry, why: "로터리에서 직진할 때는 들어가면서 깜빡이를 켜지 않아요. (오른쪽 깜빡이는 반 바퀴 넘게 돌 때만)" },
          { type: "yield", s0: m.entry + 0.5, s1: m.entry + 9, agent: 0, a0: a.c0, a1: a.c1, secs: 2.2, why: "로터리에서는 오른쪽에서 오는 차(이미 돌고 있는 차)에 양보해요. 그 차가 지나간 뒤 들어가세요." },
          { type: "signal", s: m.exit, dir: "L", need: 1.2, why: "직진도 빠져나가기 전, 바로 앞 출구(서쪽)를 지나면 왼쪽 깜빡이를 켜서 나간다고 알려야 해요." },
        ],
      };
    },
  },
  {
    id: "rbright", cat: "left", title: "로터리 우회전(세 번째 출구)", place: "Greenlane 느낌의 로터리",
    brief: "로터리에서 오른쪽(세 번째 출구, 동쪽)으로 나가세요. 진입 전 오른쪽 깜빡이, 북쪽 출구를 지나면 왼쪽 깜빡이로 바꿔요.",
    tips: ["반 바퀴 넘게 돌면 진입 때 오른쪽 깜빡이", "나가기 직전 출구를 지나면 왼쪽 깜빡이로 변경", "오른쪽에서 오는 차에 양보"],
    limit: 50, link: LINK.rb, map: rbMap("Great South Rd"),
    agents: () => [{ kind: "car", v: 8, trigger: 150, color: "#2c3e50", ind: "L", path: rbCar() }],
    make() {
      const p = rbPath("E"), m = p.marks, a = rbCar().marks;
      return {
        path: p, signs: [sg("roundabout", m.entry - 70), sg("giveway", m.entry - 6)],
        rules: [
          { type: "speed", s0: 0, s1: p.len, limit: 50 },
          { type: "signal", s: m.entry, dir: "R", why: "세 번째 출구처럼 반 바퀴 넘게 돌 때는 로터리에 다가가며 오른쪽 깜빡이를 켜요." },
          { type: "yield", s0: m.entry + 0.5, s1: m.entry + 9, agent: 0, a0: a.c0, a1: a.c1, secs: 2.2, why: "오른쪽에서 돌아오는 차에 양보한 뒤 들어가세요." },
          { type: "signal", s: m.exit, dir: "L", need: 1.2, why: "나가기 직전 출구(북쪽)를 지나면 왼쪽 깜빡이로 바꿔서 나간다고 알려야 해요." },
        ],
      };
    },
  },
  /* ---------------- Give Way·STOP·횡단보도 ---------------- */
  {
    id: "stop", cat: "give", title: "STOP 표지판에서 완전 정지", place: "Mt Eden 골목 → 큰길 T자 교차로",
    brief: "골목 끝 STOP 에서 완전히 멈춘 뒤, 오른쪽에서 오는 차를 보내고 왼쪽으로 나가세요.",
    tips: ["STOP 은 바퀴가 완전히 멈춰야 함(서행 통과 불가)", "멈춘 뒤 양보 — 큰길 차가 먼저", "Give Way 표지는 멈추지 않아도 되지만 양보는 필수"],
    limit: 50, link: LINK.give,
    map: { roads: [road([-170, 0], [170, 0]), N(0, 220, 3.5)], marks: [{ k: "stop", a: [-3.5, 5], b: [0, 5], tx: -1.75, ty: 8.6 }, label("Mt Eden Rd", 70, -6.5), label("골목", -7, 80, -Math.PI / 2)], bounds: [-140, -100, 140, 210] },
    agents: () => [
      { kind: "car", v: 11, trigger: 165, color: "#27ae60", path: new PB(75, 1.75).line(-170, 1.75).done() },
      { kind: "car", v: 12, trigger: 0, delay: 2, color: "#7f8c8d", path: new PB(-170, -1.75).line(170, -1.75).done() },
    ],
    make() {
      const p = new PB(-1.75, 190).line(-1.75, 5).mark("stop").line(-1.75, 3.5).mark("turn").arc(-3.5, 3.5, 1.75, 0, -Math.PI / 2).line(-150, 1.75).done(), m = p.marks;
      return {
        path: p, signs: [sg("stop", m.stop - 4)],
        rules: [
          { type: "stop", s: m.stop },
          { type: "signal", s: m.turn, dir: "L", why: "STOP 에서 멈춰 있을 때도 나갈 방향(왼쪽) 깜빡이를 켜 두세요." },
          { type: "yield", s0: m.stop + 0.3, s1: m.stop + 8, agent: 0, a0: 64, a1: 80, secs: 2.6, why: "STOP 에서 멈춘 뒤에는 큰길 차에 양보해요. 오른쪽에서 오는 차가 지나간 뒤 나가세요." },
        ],
      };
    },
  },
  {
    id: "zebra", cat: "give", title: "얼룩말 횡단보도", place: "Queen St 느낌의 시내(30km/h)",
    brief: "시내 30km/h 구간. 노면의 흰 다이아몬드는 '앞에 횡단보도' 표시예요. 건너는 사람이 있으면 멈추세요.",
    tips: ["흰 다이아몬드 = 곧 횡단보도", "횡단보도 위 보행자에게 양보 — 가운데 섬이 없으면 반대편 보행자도", "시내 30km/h 구간이 많아요"],
    limit: 30, link: LINK.ped,
    map: { roads: [N(0, 230, -170)], marks: [{ k: "zebra", a: [-3.5, 0], b: [3.5, 0] }, { k: "diamond", p: [-1.75, 28] }, { k: "diamond", p: [-1.75, 52] }, { k: "diamond", p: [1.75, -28] }, label("Queen St", -7.5, 100, -Math.PI / 2)], bounds: [-120, -150, 120, 220] },
    agents: () => [{ kind: "ped", v: 1.3, trigger: 155, color: "#e84393", path: new PB(-6.5, 0).line(6.5, 0).done() }],
    make() {
      const p = new PB(-1.75, 200).line(-1.75, -160).done(), z = 200;
      return {
        path: p, signs: [sg("speed", 8, { n: 30 }), sg("pedx", z - 55)],
        rules: [
          { type: "speed", s0: 0, s1: p.len, limit: 30, why: "오클랜드 시내 일부는 30km/h 예요. 표지판 숫자를 꼭 확인하세요." },
          { type: "zebra", s: z },
          { type: "ped", s0: z - 2, s1: z + 3, agent: 0, a0: 2.5, a1: 11, why: "횡단보도 위에 보행자가 있으면 멈춰야 해요. 가운데 안전섬이 없는 횡단보도는 반대편에서 건너는 사람에게도 양보합니다." },
        ],
      };
    },
  },
  {
    id: "redleft", cat: "give", title: "빨간불엔 좌회전 금지", place: "Newmarket 느낌의 신호 교차로",
    brief: "빨간불이에요. 한국의 '빨간불 우회전'처럼 돌면 안 돼요. 초록불에 왼쪽으로 돌고, 건너는 보행자에게 양보하세요.",
    tips: ["NZ 는 빨간불 회전 없음 — 초록불이나 초록 화살표에서만", "좌회전할 때 들어가는 길을 건너는 보행자에게 양보", "정지선 앞에서 멈춤"],
    limit: 50, link: LINK.give,
    map: (() => { const m = cross("Broadway", "Khyber Pass Rd"); m.marks.push({ k: "line", a: [-3.5, 5], b: [0, 5] }, { k: "zebra", a: [-9.5, -3.5], b: [-9.5, 3.5] }); return m; })(),
    agents: () => [{ kind: "ped", v: 1.25, trigger: 185, delay: 6, color: "#0984e3", path: new PB(-9.5, -7).line(-9.5, 7).done() }],
    make() {
      const p = new PB(-1.75, 200).line(-1.75, 5).mark("line").line(-1.75, 3.5).mark("turn").arc(-3.5, 3.5, 1.75, 0, -Math.PI / 2).mark("out").line(-150, 1.75).done(), m = p.marks;
      return {
        path: p, signs: [sg("speed", 10, { n: 50 }), sg("lights", m.line - 70)],
        rules: [
          { type: "speed", s0: 0, s1: p.len, limit: 50 },
          { type: "light", s: m.line, at: [-5.2, 5], after: 4, why: "빨간불에서 좌회전하면 신호위반이에요. 뉴질랜드는 빨간불 회전(한국의 빨간불 우회전에 해당)이 없어요. 초록불을 기다리세요." },
          { type: "signal", s: m.turn, dir: "L" },
          { type: "ped", s0: m.out + 2, s1: m.out + 8.5, agent: 0, a0: 2.5, a1: 11.5, why: "초록불이라도 돌아 들어가는 길을 건너는 보행자에게 양보해야 해요." },
        ],
      };
    },
  },
  /* ---------------- 버스·T2/T3·클리어웨이 ---------------- */
  {
    id: "buslane", cat: "lane", title: "버스 차선 운영 시간", place: "Dominion Rd 느낌의 출근길(평일 08:10)",
    brief: "평일 아침 08:10. 맨 왼쪽 빨간 차선은 버스 차선이에요. 표지판 시간을 보고 차선을 고르세요.",
    tips: ["버스 차선 표지판의 시간·요일에만 운영 — 그 외 시간은 일반 차선", "운영 시간엔 버스·자전거·(표지에 따라)오토바이만", "왼쪽으로 돌 때는 회전 직전 50m 안에서만 버스 차선 진입 가능"],
    limit: 50, clock: "08:10", link: LINK.at,
    map: { roads: [road([0, 230], [0, -170], { w: 10.5, lanes: [[-1.75, "solid"], [1.75, "dash"]] })], zones: [{ x0: -5.25, x1: -1.75, y0: -150, y1: 190, color: "rgba(176,42,42,.55)", text: "BUS LANE" }], marks: [label("Dominion Rd", -9, 60, -Math.PI / 2)], bounds: [-120, -150, 120, 220] },
    agents: () => [
      { kind: "bus", v: 12.5, trigger: 0, delay: 1.5, path: new PB(-3.5, 260).line(-3.5, -170).done() },
      { kind: "bus", v: 12.5, trigger: 120, path: new PB(-3.5, 230).line(-3.5, -170).done() },
      { kind: "car", v: 12, trigger: 0, color: "#7f8c8d", path: new PB(3.5, -170).line(3.5, 240).done() },
    ],
    make(sel) {
      const bus = sel[0] === 0, p = new PB(0, 200).line(0, 186);
      if (bus) p.line(-3.5, 170); else p.line(0, 170);
      p.line(bus ? -3.5 : 0, -140).line(0, -155).line(0, -165);
      const P = p.done();
      return {
        path: P, signs: [sg("buslane", 6, { time: "7-9AM 4-6PM", days: "MON-FRI" }), sg("speed", 30, { n: 50 }), sg("buslane", 200, { time: "7-9AM 4-6PM", days: "MON-FRI" })],
        choices: [
          { id: 0, s: 12, q: "지금 평일 08:10. 표지판: BUS LANE 7-9AM. 어느 차선으로?", opts: [
            { t: "왼쪽 빨간 버스 차선 (비어 있어 빠름)", ok: false, type: "special", why: "운영 시간(7–9AM) 안에는 버스 차선을 달리면 안 돼요. 오클랜드는 카메라로 단속해 벌금이 나와요. 운영 시간 밖에는 일반 차선처럼 써도 됩니다." },
            { t: "가운데 일반 차선", ok: true, good: "정답! 운영 시간 중이라 일반 차선으로." }] },
          { id: 1, s: 280, q: "앞에서 왼쪽 골목으로 들어간다면, 버스 차선은?", opts: [
            { t: "회전 직전 50m 안에서는 버스 차선에 들어가 좌회전해도 된다", ok: true, good: "맞아요. 좌회전하려고 회전 직전 50m 안에서는 버스 차선을 지날 수 있어요." },
            { t: "버스 차선은 어떤 경우에도 못 들어간다", ok: false, type: "special", why: "좌회전하려면 회전 직전 50m 안에서는 버스 차선에 들어갈 수 있어요(그 전부터 달리면 위반)." }] },
        ],
        rules: [{ type: "speed", s0: 0, s1: P.len, limit: 50 }],
      };
    },
  },
  {
    id: "transit", cat: "lane", title: "T2 · T3 트랜짓 차선", place: "Onewa Rd 느낌의 출근길(07:40, 2명 탑승)",
    brief: "지금 07:40, 차에는 나와 동승자 1명(총 2명). 왼쪽 차선은 T2(2명 이상)였다가 앞에서 T3(3명 이상)로 바뀌어요.",
    tips: ["T2 = 2명 이상, T3 = 3명 이상 탄 차와 버스·오토바이", "운영 시간은 표지판에 — 시간 밖에는 누구나", "인원이 모자라면 T 차선에서 빠져야 함"],
    limit: 50, clock: "07:40", occupants: 2, link: LINK.at,
    map: { roads: [road([0, 230], [0, -170], { w: 10.5, lanes: [[-1.75, "solid"], [1.75, "dash"]] })], zones: [{ x0: -5.25, x1: -1.75, y0: 20, y1: 190, color: "rgba(39,174,96,.45)", text: "T2" }, { x0: -5.25, x1: -1.75, y0: -150, y1: 0, color: "rgba(142,68,173,.45)", text: "T3" }], marks: [label("Onewa Rd", -9, 120, -Math.PI / 2)], bounds: [-120, -150, 120, 220] },
    agents: () => [
      { kind: "bus", v: 12, trigger: 0, delay: 1, path: new PB(-3.5, 260).line(-3.5, -170).done() },
      { kind: "car", v: 12, trigger: 0, color: "#7f8c8d", path: new PB(3.5, -170).line(3.5, 240).done() },
    ],
    make(sel) {
      const x1 = sel[0] === 0 ? -3.5 : 0, x2 = sel[1] === 0 ? -3.5 : 0, p = new PB(0, 200).line(0, 186).line(x1, 172).line(x1, 38).line(x2, 24).line(x2, -150).line(x2, -165).done();
      return {
        path: p, signs: [sg("transit", 6, { n: 2, time: "7-9AM" }), sg("speed", 30, { n: 50 }), sg("transit", 150, { n: 3, time: "7-9AM" })],
        choices: [
          { id: 0, s: 12, q: "T2 차선(2명 이상, 7–9AM). 지금 2명 탔어요. 어느 차선?", opts: [
            { t: "T2 차선 (왼쪽 초록)", ok: true, good: "2명 이상이라 T2 를 쓸 수 있어요. 출근길이 빨라집니다." },
            { t: "일반 차선", ok: true, good: "일반 차선도 문제없어요. T2 는 선택입니다." }] },
          { id: 1, s: 158, q: "앞에서 T3(3명 이상)로 바뀌어요. 지금 2명!", opts: [
            { t: "T3 차선으로 계속 가기", ok: false, type: "special", why: "T3 는 3명 이상만 쓸 수 있어요. 2명이면 운영 시간에 T3 를 달리는 것은 위반(카메라 단속)." },
            { t: "일반 차선으로 가기", ok: true, good: "정답! 인원이 모자라면 일반 차선으로." }] },
        ],
        rules: [{ type: "speed", s0: 0, s1: p.len, limit: 50 }],
      };
    },
  },
  {
    id: "clearway", cat: "lane", title: "클리어웨이 지나 P60 에 주차", place: "Parnell Rd 느낌의 상가 거리(07:50)",
    brief: "07:50. 길가 약국 앞은 클리어웨이(7–9AM 정차 금지)예요. 거기서 멈추지 말고, 그 다음 P60(60분 주차) 칸에 차를 세우세요(완전히 멈춰 1.5초).",
    tips: ["CLEARWAY 시간엔 잠깐 정차도 안 됨 — 견인될 수 있음", "P60 = 60분까지 주차 가능(표지 시간 안에서)", "노란 점선 = 언제든 정차 금지"],
    limit: 50, clock: "07:50", link: LINK.at,
    map: {
      roads: [N(0, 230, -170), road([-4.75, 175], [-4.75, -60], { w: 2.6, lines: false })],
      zones: [{ x0: -6.05, x1: -3.45, y0: 40, y1: 160, color: "rgba(215,25,32,.35)", text: "CLEARWAY" }, { x0: -6.05, x1: -3.45, y0: -45, y1: 20, color: "rgba(10,122,59,.30)", text: "P60" }],
      marks: [{ k: "nostopline", a: [-6, 170], b: [-6, 160] }, { k: "nostopline", a: [-6, 40], b: [-6, 20] }, label("💊 약국", -12, 100, 0, 3.4), label("☕ 카페", -12, -12, 0, 3.4), label("Parnell Rd", 7.5, 60, Math.PI / 2)], bounds: [-120, -150, 120, 220],
    },
    agents: () => [{ kind: "car", v: 12, trigger: 0, color: "#7f8c8d", path: new PB(1.75, -170).line(1.75, 240).done() }],
    make() {
      const p = new PB(-1.75, 200).line(-1.75, 165).line(-4.75, 155).mark("cw0").line(-4.75, 42).mark("cw1").line(-4.75, 18).mark("p0").line(-4.75, -42).mark("p1").line(-1.75, -55).line(-1.75, -160).done(), m = p.marks;
      return {
        path: p, signs: [sg("clearway", m.cw0 - 6, { time: "7-9AM" }), sg("park", m.p0 - 4, { n: 60 })],
        rules: [
          { type: "speed", s0: 0, s1: p.len, limit: 50 },
          { type: "nostop", s0: m.cw0, s1: m.cw1, why: "클리어웨이 운영 시간(7–9AM)에는 잠깐이라도 멈추면 안 돼요. 출근길 차선으로 쓰는 구간이라 견인·벌금 대상입니다." },
          { type: "park", s0: m.p0, s1: m.p1, s: m.p1, good: "P60 칸에 잘 세웠어요! 표지 시간(8AM–6PM) 안에서는 60분까지.", why: "P60 칸을 지나쳤어요. 완전히 멈춰 1.5초 기다리면 주차가 됩니다." },
        ],
      };
    },
  },
  /* ---------------- 속도·학교·주차 ---------------- */
  {
    id: "speedzones", cat: "speed", title: "바뀌는 제한속도", place: "Karangahape Rd → 시내 → 학교 앞",
    brief: "50 → 30(시내) → 학교 앞 40(불빛이 깜빡일 때) → 50. 표지판을 보고 속도를 맞추세요.",
    tips: ["표지판 숫자가 바뀌는 곳부터 바로 적용", "학교 앞 'WHEN LIGHTS FLASH' — 불빛이 깜빡이면 그 속도", "계기판 km/h — 한국과 같은 단위"],
    limit: 50, link: LINK.speed, vmax: 22,
    map: { roads: [N(0, 540, -140)], marks: [label("K Rd", -7.5, 440, -Math.PI / 2), label("CBD 30", -7.5, 300, -Math.PI / 2), label("SCHOOL", -8, 170, -Math.PI / 2), { k: "flash", p: [-6, 230] }, { k: "flash", p: [-6, 226] }, label("🏫", -14, 160, 0, 6)], bounds: [-120, -140, 120, 540] },
    agents: () => [-6.2, -6.4, -6.1].map((x, i) => ({ kind: "ped", v: 0, color: ["#e17055", "#00b894", "#6c5ce7"][i], path: new PB(x, 200 - i * 22).line(x, 200 - i * 22 + 0.1).done() })),
    make() {
      const p = new PB(-1.75, 520).line(-1.75, -120).done();
      return {
        path: p, signs: [sg("speed", 6, { n: 50 }), sg("speed", 140, { n: 30 }), sg("school", 290, { n: 40 }), sg("children", 260), sg("speed", 410, { n: 50 })],
        rules: [
          { type: "speed", s0: 0, s1: 140, limit: 50 },
          { type: "speed", s0: 142, s1: 290, limit: 30, why: "시내 30km/h 구간이에요. 표지판이 나온 지점부터 바로 30." },
          { type: "speed", s0: 292, s1: 410, limit: 40, why: "학교 앞 'SCHOOL 40 WHEN LIGHTS FLASH' — 불빛이 깜빡이는 등하교 시간엔 40km/h 이하." },
          { type: "speed", s0: 412, s1: p.len, limit: 50 },
        ],
      };
    },
  },
  {
    id: "schoolbus", cat: "speed", title: "정차한 스쿨버스는 20km/h", place: "Kumeu 근처 시골길(80km/h)",
    brief: "80km/h 시골길. 맞은편에 스쿨버스가 서 있어요. 양방향 모두 20km/h 이하로 지나가고, 뛰어나오는 아이를 조심하세요.",
    tips: ["멈춰서 아이를 태우거나 내리는 스쿨버스 옆은 양방향 20km/h 이하", "버스 앞뒤에서 아이가 갑자기 건널 수 있음", "시골길 기본 제한 80~100km/h"],
    limit: 80, vmax: 26, link: LINK.speed,
    map: { roads: [N(0, 330, -200)], marks: [label("SH16 느낌", -7.5, 200, -Math.PI / 2)], bounds: [-120, -190, 120, 330] },
    agents: () => [
      { kind: "schoolbus", v: 0, stay: true, path: new PB(1.75, -6).line(1.75, 6).done() },
      { kind: "ped", v: 1.6, trigger: 268, color: "#fdcb6e", path: new PB(4.6, 9).line(-6.5, 9).done() },
    ],
    make() {
      const p = new PB(-1.75, 310).line(-1.75, -190).done(), b = 310;
      return {
        path: p, signs: [sg("speed", 8, { n: 80 }), sg("children", b - 120), sg("schoolbus", b - 40)],
        rules: [
          { type: "speed", s0: 0, s1: b - 32, limit: 80 },
          { type: "speed", s0: b - 30, s1: b + 22, limit: 20, why: "정차해 아이를 태우거나 내리는 스쿨버스를 지날 때는 양방향 모두 20km/h 이하. 50km/h 넘게 초과하면 면허 정지(28일)도 가능해요." },
          { type: "ped", s0: b - 12, s1: b - 5, agent: 1, a0: 1, a1: 10, why: "스쿨버스 앞에서 아이가 건너고 있어요. 멈춰서 기다리세요." },
          { type: "speed", s0: b + 24, s1: p.len, limit: 80 },
        ],
      };
    },
  },
];
export const byId = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
export { RC };
