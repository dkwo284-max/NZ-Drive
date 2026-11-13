// NZ Drive — 목표별 트랙 대시보드 · 운전 연습(경로형/직접 조향) · 모의 실기 · 이론 문제은행 · 표지판 퀴즈 · 면허 전환 안내
import { Game, VIOL } from "./engine.js";
import { SCENARIOS as S1, CATS } from "./scenarios.js";
import { SCENARIOS2 } from "./scenarios2.js";
import { MANEUVERS, FreeGame, manById } from "./parking.js";
import { QUIZ } from "./quiz.js";
import { BANK, TOPICS } from "./theory.js";
import { signHTML } from "./signs.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SCN = [...S1, ...SCENARIOS2], byId = Object.fromEntries(SCN.map((s) => [s.id, s]));
const KEY = "nzdrive.v1", EMPTY = () => ({ missions: {}, viol: {}, quiz: { best: 0, items: {} }, theory: { best: 0, items: {}, runs: 0 }, mock: { runs: 0, pass: 0, s1: 0, last: null }, hist: [], voice: true });
const load = () => { try { const d = JSON.parse(localStorage.getItem(KEY) || "{}"), e = EMPTY(); return { ...e, ...d, theory: { ...e.theory, ...(d.theory || {}) }, mock: { ...e.mock, ...(d.mock || {}) } }; } catch { return EMPTY(); } };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* 저장 불가 */ } };
let S = load();
const starsOf = (ok, score, isa) => (!ok ? 0 : Math.min(isa ? 2 : 3, score >= 100 ? 3 : score >= 85 ? 2 : 1));
const starTxt = (n) => "★".repeat(n) + "☆".repeat(3 - n);
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/* 시험관 지시(영어) + 한국어 */
const SAY = {
  keepleft: ["Drive on, and take the next road on the right.", "계속 가다가 다음 오른쪽 길로 들어가세요."],
  leftturn: ["At the intersection, turn right.", "교차로에서 우회전하세요."],
  rbstraight: ["At the roundabout, go straight ahead. That's the second exit.", "로터리에서 직진, 두 번째 출구입니다."],
  rbright: ["At the roundabout, take the third exit, turning right.", "로터리에서 세 번째 출구(우회전)로 나가세요."],
  stop: ["At the end of the road, turn left.", "길 끝에서 좌회전하세요."],
  zebra: ["Continue straight ahead along this road.", "이 길을 따라 직진하세요."],
  redleft: ["At the traffic lights, turn left.", "신호등에서 좌회전하세요."],
  buslane: ["Follow this road ahead, using the correct lane for the time of day.", "시간대에 맞는 차선으로 이 길을 따라가세요."],
  transit: ["Continue ahead in the appropriate lane.", "알맞은 차선으로 계속 가세요."],
  clearway: ["When it's safe and legal, pull over and park on the left.", "안전하고 합법적인 곳에서 왼쪽에 세워 주차하세요."],
  speedzones: ["Continue straight ahead, keeping to the speed limits.", "제한속도를 지키며 직진하세요."],
  schoolbus: ["Continue along this road.", "이 길을 따라 계속 가세요."],
  mwymerge: ["Join the motorway, then settle into the left lane.", "모터웨이에 합류한 뒤 왼쪽 차선으로 가세요."],
  mwyexit: ["Overtake the truck when it's safe, then take the next exit, Esmonde Road.", "안전할 때 트럭을 추월한 뒤 다음 출구(Esmonde Rd)로 나가세요."],
  passlane: ["Pass the truck on the passing lane when it's safe.", "추월 차선에서 안전할 때 트럭을 추월하세요."],
  onelane: ["Continue ahead over the bridge.", "다리를 건너 계속 가세요."],
  curvegravel: ["Follow the road around the bends.", "커브를 따라 길을 가세요."],
  rain: ["Continue along this road, keeping a safe following distance.", "안전거리를 유지하며 계속 가세요."],
  railway: ["Continue straight ahead over the level crossing.", "건널목을 건너 직진하세요."],
  roadworks: ["Continue ahead through the roadworks.", "공사 구간을 지나 계속 가세요."],
  cyclist: ["Continue ahead, and pass the cyclist when it's safe.", "계속 가다가 안전할 때 자전거를 추월하세요."],
  ambulance: ["Continue ahead along this road.", "이 길을 따라 계속 가세요."],
  pullout: ["When you're ready, move off and drive ahead. Then pull over and park on the left.", "준비되면 출발해 직진한 뒤 왼쪽에 세워 주차하세요."],
  hillstart: ["Drive up the hill and turn left at the end of the road.", "언덕을 올라가 길 끝에서 좌회전하세요."],
  hazard: ["Drive ahead and identify any hazards you see.", "앞으로 가며 보이는 위험 요소를 알려 주세요."],
  parallel: ["Please reverse park into the space behind the car on your left.", "왼쪽 차 뒤 빈칸에 후진 주차해 주세요."],
  threepoint: ["Please turn the car around to face the other way, using a three-point turn.", "3점 회전으로 차를 반대 방향으로 돌려 주세요."],
  hillpark: ["Park here on the hill and secure the vehicle.", "여기 언덕에 주차하고 차를 고정하세요."],
};
const ICON = { keepleft: ["speed", { n: 50 }], leftturn: ["lights"], rbstraight: ["roundabout"], rbright: ["roundabout"], stop: ["stop"], zebra: ["pedx"], redleft: ["lights"],
  buslane: ["buslane", { time: "7-9AM" }], transit: ["transit", { n: 2 }], clearway: ["clearway", { time: "7-9AM" }], speedzones: ["school", { n: 40 }], schoolbus: ["schoolbus"],
  mwymerge: ["ramp"], mwyexit: ["exit", { top: "EXIT 425", name: "Esmonde Rd" }], passlane: ["txt", { lines: ["PASSING", "LANE"] }], onelane: ["onelane", { give: true }], curvegravel: ["curve", { n: 45 }],
  rain: ["txt", { lines: ["SLIPPERY", "WHEN WET"], bg: "#ffd200" }], railway: ["railway"], roadworks: ["roadworks"], cyclist: ["cyclist"], ambulance: ["txt", { lines: ["GIVE WAY TO", "EMERGENCY"], bg: "#fff" }],
  pullout: ["park", { n: 60 }], hillstart: ["stop"], hazard: ["children"], parallel: ["park", { n: 60 }], threepoint: ["nouturn"], hillpark: ["txt", { lines: ["HILL", "PARKING"] }] };
let voiceOn = S.voice !== false;
function speak(en) { if (!voiceOn || !("speechSynthesis" in window)) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(en), v = speechSynthesis.getVoices().find((x) => /en[-_](NZ|AU|GB)/i.test(x.lang)); u.lang = v?.lang || "en-NZ"; if (v) u.voice = v; u.rate = 0.95; speechSynthesis.speak(u); } catch { /* 음성 없음 */ } }
const sayBox = (id) => SAY[id] ? `<div class="say"><button class="btn ghost sm" type="button" data-speak="${esc(SAY[id][0])}" aria-label="영어로 듣기">🔊</button><div><b lang="en">“${esc(SAY[id][0])}”</b><span class="muted">${esc(SAY[id][1])}</span></div></div>` : "";

/* ================= 트랙 ================= */
const TRACKS = [
  { id: "city", name: "도심 적응", icon: "🏙", desc: "좌측통행·회전·로터리·양보·특수 차선·속도", items: S1.map((s) => s.id) },
  { id: "licence", name: "면허 준비", icon: "🪪", desc: "이론 모의고사·위험 인지·모의 실기·표지판·면허 전환", items: ["@theory", "hazard", "@mock", "@quiz", "@convert"] },
  { id: "road", name: "고속도로·지방·특수 상황", icon: "🛣", desc: "모터웨이 합류·출구, 추월 차선, 1차선 다리, 커브, 비, 건널목, 공사, 자전거, 긴급차", items: SCENARIOS2.filter((s) => ["road", "special"].includes(s.cat)).map((s) => s.id) },
  { id: "park", name: "출발·주차·저속", icon: "🅿", desc: "연석 출발·정차, 언덕 출발, 평행 후진 주차, 3점 회전, 언덕 주차(직접 조향)", items: ["pullout", "hillstart", ...MANEUVERS.map((m) => m.id)] },
];
const isFree = (id) => !!manById[id];
const titleOf = (id) => byId[id]?.title || manById[id]?.title || id;
const placeOf = (id) => byId[id]?.place || manById[id]?.place || "";
function readiness() {
  const st = (ids) => { const L = ids.filter((x) => !x.startsWith("@")); return L.length ? L.reduce((a, id) => a + (S.missions[id]?.stars || 0), 0) / (L.length * 3) : 0; };
  const parts = [["이론 모의고사", Math.min(1, (S.theory.best || 0) / 32), 25], ["위험 인지", (S.missions.hazard?.best || 0) / 100, 15], ["모의 실기", S.mock.pass ? 1 : S.mock.s1 ? 0.5 : 0, 20], ["주차·저속", st(TRACKS[3].items), 15], ["고속도로·지방", st(TRACKS[2].items), 15], ["도심", st(TRACKS[0].items), 10]];
  return { total: Math.round(parts.reduce((a, [, v, w]) => a + v * w, 0)), parts };
}
function itemCard(id) {
  if (id === "@theory") return `<a class="mcard" href="#/theory"><span class="msign"><span class="big-ico">📝</span></span><span class="mbody"><b>이론시험 문제은행</b><span class="muted">모의고사 35문항 · 주제별 · 오답 복습 · 영어 병기</span><span class="mstars">${S.theory.best ? `최고 ${S.theory.best}/35` : "아직 응시 안 함"}</span></span></a>`;
  if (id === "@mock") return `<a class="mcard${S.mock.pass ? " done" : ""}" href="#/mock"><span class="msign"><span class="big-ico">🧑‍✈️</span></span><span class="mbody"><b>리스트릭티드 모의 실기시험</b><span class="muted">1단계(동네·주차) + 2단계(복잡한 도로) · 영어 지시</span><span class="mstars">${S.mock.runs ? `${S.mock.pass}회 합격 / ${S.mock.runs}회` : "아직 응시 안 함"}</span></span></a>`;
  if (id === "@quiz") return `<a class="mcard" href="#/quiz"><span class="msign">${signHTML("giveway")}</span><span class="mbody"><b>표지판 퀴즈</b><span class="muted">${QUIZ.length}개 표지판</span><span class="mstars">${S.quiz.best ? `최고 ${S.quiz.best}/${QUIZ.length}` : "아직 안 풂"}</span></span></a>`;
  if (id === "@convert") return `<a class="mcard" href="#/convert"><span class="msign"><span class="big-ico">🇰🇷→🇳🇿</span></span><span class="mbody"><b>한국 면허 → NZ 면허 전환 안내</b><span class="muted">면제 국가 조건·서류·절차</span><span class="mstars muted">읽을거리</span></span></a>`;
  const m = S.missions[id] || {}, [k, o] = ICON[id] || ["speed", { n: 50 }];
  return `<a class="mcard${m.stars ? " done" : ""}" href="#/${isFree(id) ? "park" : "play"}/${id}"><span class="msign">${signHTML(k, o)}</span><span class="mbody"><b>${esc(titleOf(id))}</b><span class="muted">${esc(placeOf(id))}</span><span class="mstars">${starTxt(m.stars || 0)}${m.best != null ? ` <span class="muted">최고 ${m.best}점</span>` : ""}</span></span></a>`;
}

/* ================= 대시보드 ================= */
function dashboard() {
  const app = $("#app"), R = readiness(), vs = Object.entries(S.viol).sort((a, b) => b[1] - a[1]);
  const allIds = TRACKS.flatMap((t) => t.items).filter((x) => !x.startsWith("@")), done = allIds.filter((id) => S.missions[id]?.stars > 0).length;
  const next = allIds.find((id) => !(S.missions[id]?.stars > 0)) || allIds[0];
  app.innerHTML = `
  <header class="hero">
    <div><h1>NZ Drive <span class="sub">오클랜드 운전 적응 · 면허 준비</span></h1>
    <p class="muted">한국 운전자를 위한 뉴질랜드 운전 연습: 도심 규칙, 고속도로·지방도로, 주차, 이론·위험 인지·모의 실기까지. 지도는 오클랜드 '느낌'의 가상 도로입니다.</p></div>
    <a class="btn primary" href="#/${isFree(next) ? "park" : "play"}/${next}">▶ ${S.hist.length ? "이어서" : "첫 연습"}: ${esc(titleOf(next))}</a>
  </header>
  <section class="tiles">
    <div class="tile ready"><span class="tl">시험 준비도</span><b>${R.total}<small>/100</small></b><span class="bar"><i style="width:${R.total}%"></i></span><span class="muted small">${R.parts.map(([n, v]) => `${n} ${Math.round(v * 100)}%`).join(" · ")}</span></div>
    <div class="tile"><span class="tl">완료한 코스</span><b>${done}<small>/${allIds.length}</small></b><span class="bar"><i style="width:${(done / allIds.length) * 100}%"></i></span></div>
    <div class="tile"><span class="tl">이론 모의고사 최고</span><b>${S.theory.best || 0}<small>/35</small></b><span class="muted small">합격선 32</span></div>
    <div class="tile"><span class="tl">가장 자주 틀린 규칙</span><b class="sm">${vs[0] ? esc(VIOL[vs[0][0]]?.[0] || vs[0][0]) : "아직 없음"}</b><span class="muted">${vs[0] ? `${vs[0][1]}회` : "연습하면 약점이 쌓여요"}</span></div>
  </section>
  ${TRACKS.map((t) => { const L = t.items.filter((x) => !x.startsWith("@")), st = L.reduce((a, id) => a + (S.missions[id]?.stars || 0), 0);
    return `<section class="cat"><div class="cathead"><h2>${t.icon} ${esc(t.name)}</h2><span class="muted">${esc(t.desc)}${L.length ? ` · 별 ${st}/${L.length * 3}` : ""}</span></div><div class="mgrid">${t.items.map(itemCard).join("")}</div></section>`; }).join("")}
  <section class="two">
    <div class="panel"><h2>📉 약점 리포트</h2>${vs.length ? `<div class="wbars">${vs.map(([k, n]) => `<div class="wb"><span>${esc(VIOL[k]?.[0] || k)}</span><span class="bar"><i style="width:${(n / vs[0][1]) * 100}%"></i></span><b>${n}</b></div>`).join("")}</div>` : '<p class="muted">아직 기록이 없어요.</p>'}
      ${S.hist.length ? `<h3>최근 연습</h3><ul class="hist">${S.hist.slice(0, 8).map((h) => `<li><span>${esc(titleOf(h.id))}</span><span class="muted">${esc(h.d)}</span><b>${h.score}점 ${starTxt(h.stars)}</b></li>`).join("")}</ul><button class="btn ghost" id="reset" type="button">기록 지우기</button>` : ""}</div>
    <div class="panel"><h2>🎮 조작 요약</h2><ul class="tips">
      <li><b>가속 ↑ · 브레이크 ↓/Space · 깜빡이 ← →</b> (다시 누르면 끔)</li>
      <li><b>크루즈 C</b>: 지금 속도 유지 · <b>− / +</b>: 5km/h 조절 · 브레이크를 밟으면 해제, C 로 재개</li>
      <li><b>자동(제한속도 맞춤) A</b>: 표지판 속도에 맞춰 달림 — 이 모드로 통과하면 별 최대 2개</li>
      <li><b>👀 확인 R</b>: 거울·어깨 너머 사각지대 확인 · <b>차선 변경 Q / E</b> (깜빡이 3초 + 확인 후)</li>
      <li><b>⚠ 위험 H</b>: 위험 인지 코스에서 · 주차 코스: <b>핸들 ← →</b>, <b>기어 G</b>, <b>완료 Enter</b></li>
      <li>정지·양보·보행자는 크루즈 중에도 <b>직접 브레이크</b></li></ul></div>
  </section>
  <section class="panel">
    <h2>🇰🇷 → 🇳🇿 꼭 바꿔야 할 습관</h2>
    <div class="tbl"><table><thead><tr><th>상황</th><th>한국</th><th>뉴질랜드</th></tr></thead><tbody>
      <tr><th>통행 방향</th><td>우측통행, 운전석 왼쪽</td><td><b>좌측통행, 운전석 오른쪽</b> — 운전석이 늘 중앙선 쪽</td></tr>
      <tr><th>크게 도는 회전</th><td>좌회전</td><td><b>우회전</b>(맞은편 직진 차에 양보)</td></tr>
      <tr><th>빨간불 회전</th><td>빨간불 우회전 가능</td><td><b>빨간불 회전 없음</b> — 초록불·초록 화살표만</td></tr>
      <tr><th>우회전 vs 맞은편 좌회전</th><td>—</td><td><b>우회전 차가 양보</b> (2012년 개정)</td></tr>
      <tr><th>로터리</th><td>반시계 방향</td><td><b>시계 방향</b>, 오른쪽에서 오는 차에 양보, 나갈 때 왼쪽 깜빡이</td></tr>
      <tr><th>STOP</th><td>서행 통과가 흔함</td><td><b>완전 정지</b> 필수</td></tr>
      <tr><th>스쿨버스</th><td>—</td><td>정차 중이면 <b>양방향 20km/h</b></td></tr>
      <tr><th>합류·차선 변경</th><td>끼어들기 관행</td><td>깜빡이 3초 → <b>거울·어깨 너머 확인</b> → 틈, Merge like a zip</td></tr>
      <tr><th>깜빡이 레버</th><td>왼쪽</td><td>일본·NZ 차는 대개 <b>오른쪽</b></td></tr>
      <tr><th>음주 기준</th><td>혈중 0.03%</td><td>20세 이상 0.05%, 20세 미만 0</td></tr>
    </tbody></table></div>
    <p class="muted small">요약 정보예요. 실제 운전·시험은 <a href="https://nzta.govt.nz/roadcode/general-road-code" target="_blank" rel="noopener">NZTA 공식 Road Code</a>가 기준입니다.</p>
  </section>
  <footer class="muted small">진도는 이 브라우저에만 저장돼요. 지도·도로명은 연습용 가상 배치, 표지판은 실제 모양을 단순화한 그림, 시험 채점은 단순화한 연습용이에요.</footer>`;
  $("#reset")?.addEventListener("click", () => { if (confirm("연습 기록을 모두 지울까요?")) { S = EMPTY(); save(); dashboard(); } });
}

/* ================= 공통 플레이 화면 ================= */
let game = null, test = null;
function stageHTML(title, place, free) {
  return `<div class="play">
    <div class="pbar"><a class="btn ghost" href="#/" id="back">← ${test ? "시험 중단" : "대시보드"}</a><div class="ptitle"><b>${esc(title)}</b><span class="muted">${esc(place)}</span></div><span class="pscore" id="pscore">${test ? `단계 ${test.stage}` : "100점"}</span></div>
    <div class="stage${free ? " free" : ""}">
      <canvas id="cv" aria-label="위에서 본 도로"></canvas>
      ${free ? "" : '<div class="povbox"><canvas id="pov" aria-label="운전석 미리보기"></canvas><span class="povlab">운전석 미리보기</span></div>'}
      <div class="hud"><div class="speedo"><b id="hv">0</b><small id="hu">km/h</small></div><div class="limit" id="hl"></div><div class="hinfo" id="hi"></div></div>
      <div class="toast" id="toast" hidden></div><div class="ov" id="ov" hidden></div>
    </div>
    <div class="ctrls" id="ctrls"></div><div class="ctrls2" id="ctrls2"></div>
  </div>`;
}
const ovShow = (html) => { const ov = $("#ov"); ov.innerHTML = `<div class="card">${html}</div>`; ov.hidden = false; ov.querySelectorAll("[data-speak]").forEach((b) => b.addEventListener("click", () => speak(b.dataset.speak))); };
const ovHide = () => { const ov = $("#ov"); ov.hidden = true; ov.innerHTML = ""; };
function toast(t) { const el = $("#toast"); if (!el) return; el.textContent = t; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => (el.hidden = true), 2600); }
function holdBtn(el, on, off) { const d = (e) => { e.preventDefault(); on(); el.classList.add("on"); }, u = () => { off(); el.classList.remove("on"); }; el.addEventListener("pointerdown", d); el.addEventListener("pointerup", u); el.addEventListener("pointerleave", u); el.addEventListener("pointercancel", u); }
function recordResult(id, r) {
  const st = starsOf(r.ok, r.score, r.isa), m = S.missions[id] || { plays: 0, passes: 0 };
  m.plays = (m.plays || 0) + 1; if (r.ok) m.passes = (m.passes || 0) + 1; m.best = Math.max(m.best ?? 0, r.score); m.stars = Math.max(m.stars || 0, st);
  S.missions[id] = m; S.hist.unshift({ id, score: r.score, stars: st, d: new Date().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }) }); S.hist = S.hist.slice(0, 40); save(); return st;
}
function makeHooks(id, onEnd) {
  return {
    hud(g) {
      const kmh = Math.round(Math.abs(g.v ?? g.c?.v ?? 0) * 3.6);
      $("#hv").textContent = kmh;
      if (g.limitNow) { const lim = g.limitNow(); $("#hv").parentElement.classList.toggle("over", g.v * 3.6 > lim + 3); $("#hl").innerHTML = signHTML("speed", { n: lim }, "sg lim"); }
      const info = [g.clock?.() ? `🕗 ${g.clock()}` : "", g.sc?.occupants ? `👥 ${g.sc.occupants}명` : "", g.cruise != null ? `⟳ 크루즈 ${Math.round(g.cruise * 3.6)}` : g.isa ? "⟳ 자동(제한속도)" : "",
        g.lanes?.length > 1 ? `차선 ${g.lane + 1}/${g.lanes.length}` : "", g.c ? `기어 ${g.c.gear} · 핸들 ${g.c.st < -0.05 ? "◀" : g.c.st > 0.05 ? "▶" : "가운데"} ${Math.round(Math.abs(g.c.st) / 0.62 * 100)}%` : "",
        g.ind ? `<span class="blink">${g.ind === "L" ? "◀ 왼쪽" : "오른쪽 ▶"}</span>` : "", test ? `기록된 오류 ${test.viol.length + g.viol.length}` : ""].filter(Boolean).join("<br>");
      $("#hi").innerHTML = info;
      if (!test) $("#pscore").textContent = `${g.score()}점`;
      $("#bL")?.classList.toggle("on", g.ind === "L"); $("#bR")?.classList.toggle("on", g.ind === "R"); $("#bC")?.classList.toggle("on", g.cruise != null); $("#bA")?.classList.toggle("on", !!g.isa);
      const gb = $("#bGear"); if (gb && g.c) gb.firstChild.textContent = `기어 ${g.c.gear}`;
    },
    toast,
    choice(c, done) { ovShow(`<h3>🤔 ${esc(c.q)}</h3><div class="opts">${c.opts.map((x, i) => `<button class="btn opt" data-i="${i}" type="button">${esc(x.t)}</button>`).join("")}</div>`); $("#ov").querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => { ovHide(); done(+b.dataset.i); })); },
    violation(v, cont) {
      S.viol[v.type] = (S.viol[v.type] || 0) + 1; save();
      ovShow(`<h3 class="${v.fatal ? "bad" : "warn"}">${v.fatal ? "💥" : "⚠️"} ${esc(v.name)} ${v.fatal ? "— 코스 실패" : `−${v.pen}점`}</h3><p>${esc(v.why)}</p><p class="small"><a href="${esc(v.link)}" target="_blank" rel="noopener">NZ Road Code 에서 확인 ↗</a></p><button class="btn primary" id="cont" type="button">${v.fatal ? "결과 보기" : "계속"}</button>`);
      $("#cont").addEventListener("click", () => { ovHide(); cont(); }); $("#cont").focus();
    },
    testViol(v) { S.viol[v.type] = (S.viol[v.type] || 0) + 1; save(); },
    end: onEnd,
  };
}
function endCard(id, r, nextHref, nextLabel) {
  const st = recordResult(id, r);
  ovShow(`<h3>${r.ok ? "🎉 통과!" : "🔁 다시 도전"}</h3><p class="big">${r.score}점 <span class="stars">${starTxt(st)}</span></p>${r.haz ? `<p>위험 발견 ${r.haz.caught}/${r.haz.total} · 잘못 누름 ${r.haz.wrong}회</p>` : ""}${r.msg ? `<p>${esc(r.msg)}</p>` : ""}
    ${r.viol.length ? `<ul class="vlist">${r.viol.map((v) => `<li><b>${esc(v.name)}</b> −${v.pen} · ${esc(v.why)}</li>`).join("")}</ul>` : "<p>위반 없이 완벽해요!</p>"}
    ${r.isa ? '<p class="muted small">자동(제한속도 맞춤) 모드를 써서 별은 최대 2개예요.</p>' : ""}
    <p class="muted small">통과 기준: 70점 이상 + 충돌·실격 없음. 100점 ★★★, 85점 이상 ★★.</p>
    <div class="opts row"><button class="btn" id="again" type="button">다시 하기</button>${nextHref ? `<a class="btn primary" href="${nextHref}">${esc(nextLabel)} →</a>` : ""}<a class="btn ghost" href="#/">대시보드</a></div>`);
  $("#again").addEventListener("click", () => route(true));
}
function nextOf(id) { const t = TRACKS.find((x) => x.items.includes(id)); if (!t) return null; const L = t.items.filter((x) => !x.startsWith("@")), n = L[L.indexOf(id) + 1]; return n ? [`#/${isFree(n) ? "park" : "play"}/${n}`, `다음: ${titleOf(n)}`] : null; }

/* ---------- 경로형 코스 ---------- */
function play(id, opt = {}) {
  const sc = byId[id]; if (!sc) { location.hash = "#/"; return; }
  $("#app").innerHTML = stageHTML(sc.title, sc.place, false);
  const lanes = (sc.make([]).lanes || []).length > 1, haz = !!sc.hazardMode, obs = lanes || (sc.make([]).rules || []).some((r) => r.type === "obs");
  $("#ctrls").innerHTML = `<button class="cb ind" id="bL" type="button">◀<small>깜빡이</small></button><button class="cb brake" id="bB" type="button">브레이크<small>↓ / Space</small></button><button class="cb gas" id="bG" type="button">가속<small>↑</small></button><button class="cb ind" id="bR" type="button">▶<small>깜빡이</small></button>`;
  $("#ctrls2").innerHTML = `<button class="sb" id="bC" type="button">⟳ 크루즈<small>C</small></button><button class="sb" id="bM" type="button">−5</button><button class="sb" id="bP" type="button">+5</button>${test ? "" : '<button class="sb" id="bA" type="button">자동 제한속도<small>A</small></button>'}
    ${obs ? '<button class="sb obs" id="bO" type="button">👀 확인<small>R</small></button>' : ""}${lanes ? '<button class="sb" id="bQ" type="button">◀ 차선<small>Q</small></button><button class="sb" id="bE" type="button">차선 ▶<small>E</small></button>' : ""}${haz ? '<button class="sb haz" id="bH" type="button">⚠ 위험<small>H</small></button>' : ""}`;
  const hooks = makeHooks(id, (r) => {
    if (test) return testStepEnd(r);
    const n = nextOf(id); endCard(id, r, n?.[0], n?.[1]);
  });
  game?.stop(); game = new Game(sc, $("#cv"), $("#pov"), hooks, { test: !!test }); hooks.hud(game);
  const [k, o] = ICON[id] || ["speed", { n: 50 }];
  if (test) { ovShow(`<p class="muted small">모의 실기 ${test.stage}단계 · ${test.i + 1}/${test.steps.length}</p>${sayBox(id)}<p class="muted small">시험관은 지시만 해요. 오류는 끝나고 한꺼번에 알려 드려요.</p><button class="btn primary" id="go" type="button">출발 ▶</button>`); speak(SAY[id]?.[0] || ""); }
  else ovShow(`<div class="brief"><span class="bsign">${signHTML(k, o)}</span><div><h3>${esc(sc.title)}</h3><p class="muted">${esc(sc.place)}${sc.clock ? ` · 🕗 ${sc.clock}` : ""}${sc.occupants ? ` · 👥 ${sc.occupants}명` : ""}</p></div></div>
    ${sayBox(id)}<p>${esc(sc.brief)}</p><ul class="tips">${sc.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <p class="muted small">지도는 진행 방향이 늘 위쪽. 오른쪽 위 작은 화면은 운전석 시점(추정)이에요.</p><button class="btn primary" id="go" type="button">출발 ▶</button>`);
  $("#go").addEventListener("click", () => { ovHide(); game.start(); }); $("#go").focus();
  holdBtn($("#bG"), () => (game.keys.gas = true), () => (game.keys.gas = false)); holdBtn($("#bB"), () => (game.keys.brake = true), () => (game.keys.brake = false));
  $("#bL").addEventListener("click", () => game.setInd("L")); $("#bR").addEventListener("click", () => game.setInd("R"));
  $("#bC").addEventListener("click", () => game.toggleCruise()); $("#bM").addEventListener("click", () => game.adjCruise(-5)); $("#bP").addEventListener("click", () => game.adjCruise(5));
  $("#bA")?.addEventListener("click", () => game.toggleIsa()); $("#bO")?.addEventListener("click", () => game.observe());
  $("#bQ")?.addEventListener("click", () => game.changeLane(-1)); $("#bE")?.addEventListener("click", () => game.changeLane(1)); $("#bH")?.addEventListener("click", () => game.hazard());
}
/* ---------- 직접 조향 ---------- */
function park(id) {
  const m = manById[id]; if (!m) { location.hash = "#/"; return; }
  $("#app").innerHTML = stageHTML(m.title, m.place, true);
  $("#ctrls").innerHTML = `<button class="cb" id="bSL" type="button">◀ 핸들<small>←</small></button><button class="cb brake" id="bB" type="button">브레이크<small>↓ / Space</small></button><button class="cb gas" id="bG" type="button">${m.noMove ? "—" : "천천히 가속"}<small>↑</small></button><button class="cb" id="bSR" type="button">핸들 ▶<small>→</small></button>`;
  $("#ctrls2").innerHTML = `<button class="sb" id="bGear" type="button">기어 D<small>G</small></button><button class="sb obs" id="bO" type="button">👀 확인<small>R</small></button><button class="sb" id="bL" type="button">◀ 깜빡이<small>Z</small></button><button class="sb" id="bR" type="button">깜빡이 ▶<small>X</small></button><button class="sb done" id="bDone" type="button">완료<small>Enter</small></button>`;
  const hooks = makeHooks(id, (r) => { if (test) return testStepEnd(r); const n = nextOf(id); endCard(id, r, n?.[0], n?.[1]); });
  game?.stop(); game = new FreeGame(m, $("#cv"), hooks, { test: !!test }); hooks.hud(game);
  if (test) { ovShow(`<p class="muted small">모의 실기 ${test.stage}단계 · ${test.i + 1}/${test.steps.length}</p>${sayBox(id)}<button class="btn primary" id="go" type="button">시작 ▶</button>`); speak(SAY[id]?.[0] || ""); }
  else ovShow(`<h3>${esc(m.title)}</h3><p class="muted">${esc(m.place)}</p>${sayBox(id)}<p>${esc(m.brief)}</p><ul class="tips">${m.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul><p class="muted small">이 코스는 직접 조향이에요: 핸들 ← → 은 누르고 있는 동안 돌아가고, 놓으면 그 각도로 유지돼요. 앞바퀴 방향이 차 위에 보여요.</p><button class="btn primary" id="go" type="button">시작 ▶</button>`);
  $("#go").addEventListener("click", () => { ovHide(); game.start(); }); $("#go").focus();
  holdBtn($("#bG"), () => (game.keys.gas = true), () => (game.keys.gas = false)); holdBtn($("#bB"), () => (game.keys.brake = true), () => (game.keys.brake = false));
  holdBtn($("#bSL"), () => (game.keys.left = true), () => (game.keys.left = false)); holdBtn($("#bSR"), () => (game.keys.right = true), () => (game.keys.right = false));
  $("#bGear").addEventListener("click", () => game.gear()); $("#bO").addEventListener("click", () => game.observe());
  $("#bL").addEventListener("click", () => game.setInd("L")); $("#bR").addEventListener("click", () => game.setInd("R")); $("#bDone").addEventListener("click", () => game.complete());
}
const KEYMAP = { ArrowUp: "gas", w: "gas", ArrowDown: "brake", " ": "brake", s: "brake" };
addEventListener("keydown", (e) => {
  if (!game || game.ended || !$(".play") || e.target.closest?.("input,textarea")) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, free = game instanceof FreeGame;
  if (KEYMAP[k]) { game.keys[KEYMAP[k]] = true; e.preventDefault(); return; }
  if (free && (k === "ArrowLeft" || k === "ArrowRight")) { game.keys[k === "ArrowLeft" ? "left" : "right"] = true; e.preventDefault(); return; }
  if (e.repeat) return;
  if (!free && (k === "ArrowLeft" || k === "ArrowRight")) { game.setInd(k === "ArrowLeft" ? "L" : "R"); e.preventDefault(); }
  if (free && (k === "z" || k === "x")) game.setInd(k === "z" ? "L" : "R");
  if (k === "r") game.observe();
  if (!free) { if (k === "c") game.toggleCruise(); if (k === "-" || k === "_") game.adjCruise(-5); if (k === "=" || k === "+") game.adjCruise(5); if (k === "a" && !test) game.toggleIsa(); if (k === "q") game.changeLane(-1); if (k === "e") game.changeLane(1); if (k === "h" && game.sc.hazardMode) game.hazard(); }
  else { if (k === "g") game.gear(); if (k === "Enter") game.complete(); }
});
addEventListener("keyup", (e) => { if (!game) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (KEYMAP[k]) game.keys[KEYMAP[k]] = false; if (game instanceof FreeGame && (k === "ArrowLeft" || k === "ArrowRight")) game.keys[k === "ArrowLeft" ? "left" : "right"] = false; });
addEventListener("resize", () => { if (game && $(".play")) game.resize(); });

/* ================= 모의 실기시험 ================= */
function mockIntro() {
  game?.stop(); game = null; test = null;
  $("#app").innerHTML = `<div class="panel narrow"><a class="btn ghost" href="#/">← 대시보드</a><h2 style="margin-top:12px">🧑‍✈️ 리스트릭티드 모의 실기시험</h2>
    <p>실제 시험처럼 <b>시험관의 영어 지시</b>(한국어 번역·음성)를 따라 연속으로 달려요. 중간에 설명은 나오지 않고, 끝나면 한꺼번에 채점해요.</p>
    <ul class="tips"><li><b>1단계</b> (동네·저속): 연석 출발, 교차로, 횡단보도·언덕 중 2개, 주차 기동(평행 후진 주차 또는 3점 회전) 1개</li>
    <li><b>2단계</b> (복잡한 도로): 로터리·신호 교차로·모터웨이·특수 차선 등에서 무작위 4개</li>
    <li><b>채점(단순화)</b>: <b>즉시 실격</b>(충돌·보행자·신호위반·위험한 양보/틈 등) 1개면 불합격 · <b>치명 오류</b>(완전 정지 안 함·확인 안 함·깜빡이·과속·연석 등)가 1단계 2개 이상 또는 전체 3개 이상이면 불합격</li>
    <li>실제 시험: 약 60분, 시험관이 관찰·갭 선택·교차로·로터리·위험 인지를 평가. 2027년 1월 25일부터 제도 개편(정식 면허 실기 폐지, 위험 인지가 리스트릭티드로 이동 예정)</li></ul>
    <label class="chk"><input type="checkbox" id="voice" ${voiceOn ? "checked" : ""}> 시험관 지시를 영어 음성으로 듣기</label>
    <div class="opts row"><button class="btn primary" id="startMock" type="button">시험 시작</button></div>
    <p class="muted small">채점 기준은 연습용으로 단순화했어요. 실제 기준은 <a href="https://nzta.govt.nz/driver-licences/getting-a-licence/take-your-test/practical-tests/restricted-licence-test-guide/critical-errors" target="_blank" rel="noopener">NZTA 시험 안내(치명 오류)</a>를 확인하세요.</p></div>`;
  $("#voice").addEventListener("change", (e) => { voiceOn = e.target.checked; S.voice = voiceOn; save(); });
  $("#startMock").addEventListener("click", () => {
    const pick = (a, n) => shuffle(a).slice(0, n);
    const st1 = ["pullout", ...pick(["stop", "zebra", "keepleft", "hillstart"], 2), ...pick(["parallel", "threepoint"], 1)];
    const st2 = pick(["rbright", "rbstraight", "leftturn", "redleft", "mwymerge", "buslane", "speedzones", "roadworks", "cyclist", "schoolbus", "railway"], 4);
    test = { steps: [...st1.map((id) => ({ id, stage: 1 })), ...st2.map((id) => ({ id, stage: 2 }))], i: 0, stage: 1, viol: [], done: [] };
    runStep();
  });
}
function runStep() { const s = test.steps[test.i]; test.stage = s.stage; if (isFree(s.id)) park(s.id); else play(s.id); }
function testStepEnd(r) {
  const s = test.steps[test.i];
  test.viol.push(...r.viol.map((v) => ({ ...v, step: s.id, stage: s.stage }))); test.done.push({ id: s.id, ok: r.ok });
  const ife = test.viol.filter((v) => v.cls === "IFE").length, ce1 = test.viol.filter((v) => v.cls === "CE" && v.stage === 1).length, ce = test.viol.filter((v) => v.cls === "CE").length;
  const fail = ife > 0 || ce1 > 1 || ce > 2, lastOfStage1 = s.stage === 1 && test.steps[test.i + 1]?.stage === 2;
  if (fail || test.i === test.steps.length - 1) return mockReport(!fail, { ife, ce1, ce, stoppedAt: fail ? s.id : null });
  test.i++;
  if (lastOfStage1) { ovShow(`<h3>1단계 통과</h3><p>치명 오류 ${ce1}개. 이제 2단계(복잡한 도로)로 가요.</p><button class="btn primary" id="nx" type="button">2단계 시작</button>`); $("#nx").addEventListener("click", runStep); }
  else runStep();
}
function mockReport(pass, x) {
  game?.stop(); game = null;
  S.mock.runs++; if (pass) S.mock.pass++; if (pass || x.ce1 <= 1 && !test.viol.some((v) => v.cls === "IFE" && v.stage === 1)) S.mock.s1 = (S.mock.s1 || 0) + 1; S.mock.last = { pass, d: new Date().toISOString().slice(0, 10) }; save();
  const v = test.viol;
  $("#app").innerHTML = `<div class="panel narrow"><h2>${pass ? "🎉 모의 실기 합격" : "🔁 모의 실기 불합격"}</h2>
    <div class="tiles three"><div class="tile"><span class="tl">즉시 실격</span><b>${x.ife}</b></div><div class="tile"><span class="tl">치명 오류 (1단계)</span><b>${x.ce1}<small>/1 허용</small></b></div><div class="tile"><span class="tl">치명 오류 (전체)</span><b>${x.ce}<small>/2 허용</small></b></div></div>
    ${x.stoppedAt ? `<p class="bad"><b>시험 종료:</b> ${esc(titleOf(x.stoppedAt))} 에서 불합격 기준에 도달했어요.</p>` : ""}
    <h3>달린 코스</h3><ul class="hist">${test.done.map((d) => `<li><span>${esc(titleOf(d.id))}</span><span class="muted">${test.steps.find((s) => s.id === d.id)?.stage}단계</span><b>${d.ok ? "✓" : "✗"}</b></li>`).join("")}</ul>
    <h3>오류 상세</h3>${v.length ? `<ul class="vlist">${v.map((e) => `<li><span class="tag ${e.cls}">${e.cls === "IFE" ? "즉시 실격" : "치명 오류"}</span> <b>${esc(e.name)}</b> · ${esc(titleOf(e.step))}<br><span class="muted">${esc(e.why)}</span></li>`).join("")}</ul>` : "<p>오류 없음 — 훌륭해요!</p>"}
    <div class="opts row"><a class="btn primary" href="#/mock">다시 응시</a><a class="btn ghost" href="#/">대시보드</a></div>
    <p class="muted small">연습용 단순 채점이에요. 실제 시험은 시험관이 관찰·속도·위치 등 더 많은 항목을 봅니다.</p></div>`;
  test = null;
}

/* ================= 이론시험 ================= */
function theoryHome() {
  game?.stop(); game = null;
  const it = S.theory.items, wrong = BANK.filter((q) => it[q.id] && it[q.id].last === false);
  const byT = Object.entries(TOPICS).map(([k, n]) => { const L = BANK.filter((q) => q.t === k), seen = L.filter((q) => it[q.id]), right = L.filter((q) => it[q.id]?.last); return { k, n, total: L.length, seen: seen.length, right: right.length }; });
  $("#app").innerHTML = `<div class="panel narrow"><a class="btn ghost" href="#/">← 대시보드</a><h2 style="margin-top:12px">📝 이론시험 문제은행</h2>
    <p class="muted">러너(학습) 면허 이론시험 대비 연습 문제 ${BANK.length}개 — NZ Road Code 를 요약해 만든 문제로 공식 기출이 아니에요. 실제 시험은 영어(또는 지원 언어)로 볼 수 있어요.</p>
    <div class="opts row"><a class="btn primary" href="#/theory/mock">모의고사 35문항 (32개 이상 합격)</a>${wrong.length ? `<a class="btn" href="#/theory/review">틀린 문제 복습 ${wrong.length}개</a>` : ""}</div>
    <h3>주제별 연습</h3><div class="topics">${byT.map((t) => `<a class="topic" href="#/theory/t/${t.k}"><b>${esc(t.n)}</b><span class="muted">${t.total}문항 · 맞힘 ${t.right}/${t.seen || 0}</span><span class="bar"><i style="width:${t.total ? (t.right / t.total) * 100 : 0}%"></i></span></a>`).join("")}</div>
    <p class="muted small">합격 기준(35문항 중 32개)은 현행 NZTA 안내 기준이에요. 시험 제도가 바뀔 수 있으니 응시 전 <a href="https://nzta.govt.nz/driver-licences/getting-a-licence" target="_blank" rel="noopener">NZTA</a>에서 확인하세요.</p></div>`;
}
function theoryRun(mode, arg) {
  game?.stop(); game = null;
  let L = mode === "mock" ? shuffle(BANK).slice(0, 35) : mode === "review" ? BANK.filter((q) => S.theory.items[q.id]?.last === false) : BANK.filter((q) => q.t === arg);
  L = shuffle(L).map((q) => ({ ...q, order: shuffle(q.opts.map((_, i) => i)) }));
  if (!L.length) { location.hash = "#/theory"; return; }
  let i = 0, right = 0; const app = $("#app"), lang = { en: true };
  const step = () => {
    if (i >= L.length) {
      if (mode === "mock") { S.theory.best = Math.max(S.theory.best || 0, right); S.theory.runs++; save(); }
      const pass = mode === "mock" ? right >= 32 : null;
      app.innerHTML = `<div class="panel narrow"><h2>${mode === "mock" ? (pass ? "🎉 모의고사 합격" : "🔁 모의고사 불합격") : "결과"}: ${right} / ${L.length}</h2>${mode === "mock" ? `<p class="muted">합격선 32/35</p>` : ""}
        <div class="qreview">${L.filter((q) => S.theory.items[q.id]?.last === false).map((q) => `<div class="qr2"><b>${esc(q.ko)}</b><span class="muted" lang="en">${esc(q.en)}</span><span class="good">정답: ${esc(q.opts[q.a][0])} <span lang="en">(${esc(q.opts[q.a][1])})</span></span><span class="muted small">${esc(q.why)}</span></div>`).join("") || "<p>모두 맞혔어요! 🎉</p>"}</div>
        <div class="opts row"><a class="btn primary" href="#/theory">문제은행으로</a><a class="btn ghost" href="#/">대시보드</a></div></div>`;
      return;
    }
    const q = L[i];
    app.innerHTML = `<div class="quiz panel"><div class="qtop"><a class="btn ghost" href="#/theory">← 문제은행</a><span class="muted">${i + 1} / ${L.length} · 맞힘 ${right}</span><label class="chk small"><input type="checkbox" id="en" ${lang.en ? "checked" : ""}> 영어 병기</label></div>
      <p class="muted small">${esc(TOPICS[q.t])}</p><h3>${esc(q.ko)}</h3>${lang.en ? `<p class="en" lang="en">${esc(q.en)}</p>` : ""}
      <div class="opts">${q.order.map((j) => `<button class="btn opt" data-j="${j}" type="button">${esc(q.opts[j][0])}${lang.en ? `<small lang="en">${esc(q.opts[j][1])}</small>` : ""}</button>`).join("")}</div><div id="qwhy"></div></div>`;
    $("#en").addEventListener("change", (e) => { lang.en = e.target.checked; step(); });
    app.querySelectorAll("[data-j]").forEach((b) => b.addEventListener("click", () => {
      const ok = +b.dataset.j === q.a; if (ok) right++;
      const it = S.theory.items[q.id] || { r: 0, n: 0 }; it.n++; if (ok) it.r++; it.last = ok; S.theory.items[q.id] = it; save();
      app.querySelectorAll("[data-j]").forEach((x) => { x.disabled = true; if (+x.dataset.j === q.a) x.classList.add("right"); else if (x === b) x.classList.add("wrong"); });
      $("#qwhy").innerHTML = `<p class="${ok ? "good" : "bad"}"><b>${ok ? "정답!" : "오답."}</b> ${esc(q.why)}</p><button class="btn primary" id="qn" type="button">다음 →</button>`;
      $("#qn").addEventListener("click", () => { i++; step(); }); $("#qn").focus();
    }));
  };
  step();
}

/* ================= 표지판 퀴즈 ================= */
function quiz() {
  game?.stop(); game = null;
  const order = shuffle(QUIZ); let i = 0, right = 0; const app = $("#app");
  const step = () => {
    if (i >= order.length) {
      S.quiz.best = Math.max(S.quiz.best || 0, right); save();
      app.innerHTML = `<div class="quiz panel"><h2>🪧 결과: ${right} / ${order.length}</h2><div class="qreview">${order.filter((q) => S.quiz.items[q.id]?.last === false).map((q) => `<div class="qr">${signHTML(q.k, q.ko || {}, "sg md")}<div><b>${esc(q.o[q.a])}</b><p class="muted small">${esc(q.why)}</p></div></div>`).join("") || "<p>모두 맞혔어요! 🎉</p>"}</div>
        <div class="opts row"><a class="btn primary" href="#/quiz" id="re">다시 풀기</a><a class="btn ghost" href="#/">대시보드</a></div></div>`;
      $("#re").addEventListener("click", (e) => { e.preventDefault(); quiz(); }); return;
    }
    const q = order[i], ord = shuffle(q.o.map((_, j) => j));
    app.innerHTML = `<div class="quiz panel"><div class="qtop"><a class="btn ghost" href="#/">← 대시보드</a><span class="muted">${i + 1} / ${order.length} · 맞힘 ${right}</span></div>
      <div class="qsign">${signHTML(q.k, q.ko || {}, "sg xl")}</div><h3>${esc(q.q)}</h3><div class="opts">${ord.map((j) => `<button class="btn opt" data-j="${j}" type="button">${esc(q.o[j])}</button>`).join("")}</div><div id="qwhy"></div></div>`;
    app.querySelectorAll("[data-j]").forEach((b) => b.addEventListener("click", () => {
      const ok = +b.dataset.j === q.a; if (ok) right++;
      const it = S.quiz.items[q.id] || { r: 0, n: 0 }; it.n++; if (ok) it.r++; it.last = ok; S.quiz.items[q.id] = it; save();
      app.querySelectorAll("[data-j]").forEach((x) => { x.disabled = true; if (+x.dataset.j === q.a) x.classList.add("right"); else if (x === b) x.classList.add("wrong"); });
      $("#qwhy").innerHTML = `<p class="${ok ? "good" : "bad"}"><b>${ok ? "정답!" : "아쉬워요."}</b> ${esc(q.why)}</p><button class="btn primary" id="qn" type="button">다음 →</button>`;
      $("#qn").addEventListener("click", () => { i++; step(); }); $("#qn").focus();
    }));
  };
  step();
}

/* ================= 면허 전환 안내 ================= */
function convert() {
  game?.stop(); game = null;
  $("#app").innerHTML = `<div class="panel narrow"><a class="btn ghost" href="#/">← 대시보드</a><h2 style="margin-top:12px">🇰🇷 → 🇳🇿 한국 운전면허 전환 안내</h2>
    <p class="muted">2026년 11월 확인한 NZTA 공개 안내를 요약했어요. 수수료·서류·조건은 바뀔 수 있으니 신청 전 반드시 공식 페이지를 확인하세요.</p>
    <h3>1. 해외 면허로 운전할 수 있는 기간</h3><p>유효한 해외 면허(영어가 아니면 승인된 번역본 또는 국제운전면허증 함께)로 <b>입국일부터 최대 12개월</b> 운전할 수 있어요. 그 뒤에는 NZ 면허로 전환해야 해요.</p>
    <h3>2. 한국은 '면제 국가(exempt country)'</h3><p>NZTA 목록에서 <b>대한민국은 승용차(클래스 1)·오토바이 면허의 면제 국가</b>예요. 면제 국가 면허는 조건을 갖추면 <b>이론·실기 시험 없이</b> 전환할 수 있어요. 면허를 가진 기간이 짧은 경우(예: 2년 미만) 조건이 달라질 수 있으니 공식 안내를 확인하세요. (트럭 등 대형 면허는 한국이 면제 국가가 아니라 실기시험이 필요해요.)</p>
    <h3>3. 준비물(일반)</h3><ul class="tips"><li>한국 운전면허증 실물(국제운전면허증만으로는 전환 불가)</li><li>승인된 번역본(NZTA 인정 번역)</li><li>여권 등 신분증, 주소 확인</li><li>시력 검사(신청 창구에서), 사진 촬영, 수수료</li><li>면허 유효성 확인 자료가 필요할 수 있음(NZTA 가 한국 '안전운전 통합민원' 확인 안내)</li></ul>
    <h3>4. 어디서</h3><p>AA·VTNZ·VINZ 등 NZTA 대행 창구에서 신청해요.</p>
    <h3>5. 전환하더라도 연습은 필수</h3><p>시험이 면제돼도 <b>좌측통행·로터리·양보 규칙·Give Way 순서</b>는 한국과 달라요. 이 앱의 도심·고속도로 트랙과 이론 문제은행으로 먼저 익혀 두세요.</p>
    <div class="opts row"><a class="btn primary" href="https://nzta.govt.nz/driver-licences/new-residents-and-visitors/converting-to-nz-driver-licence/converting-a-car-licence/converting-a-car-licence-from-an-exempt-country" target="_blank" rel="noopener">NZTA: 면제 국가 면허 전환 ↗</a><a class="btn" href="https://nzta.govt.nz/driver-licences/new-residents-and-visitors/converting-to-nz-driver-licence/evidence-of-validity-for-exempt-countries" target="_blank" rel="noopener">면허 유효성 증빙 ↗</a></div>
    <h3>참고: 시험을 봐야 하는 경우(일반 경로)</h3><p>러너(이론시험) → 리스트릭티드(실기) → 정식(full). <b>2027년 1월 25일부터</b> 정식 면허 실기시험이 없어지고 위험 인지가 리스트릭티드 시험으로 옮겨가는 등 제도가 바뀔 예정이에요(정부 발표).</p></div>`;
}

/* ================= 라우팅 ================= */
function route(again) {
  const h = location.hash || "#/";
  if (!h.startsWith("#/play/") && !h.startsWith("#/park/") && test && !again) { test = null; }
  if (h.startsWith("#/play/")) return play(h.slice(7));
  if (h.startsWith("#/park/")) return park(h.slice(7));
  game?.stop(); game = null;
  if (h === "#/quiz") return quiz();
  if (h === "#/mock") return mockIntro();
  if (h === "#/convert") return convert();
  if (h === "#/theory") return theoryHome();
  if (h === "#/theory/mock") return theoryRun("mock");
  if (h === "#/theory/review") return theoryRun("review");
  if (h.startsWith("#/theory/t/")) return theoryRun("topic", h.slice(11));
  dashboard(); scrollTo(0, 0);
}
document.addEventListener("click", (e) => { const b = e.target.closest("[data-speak]"); if (b && !b.closest("#ov")) speak(b.dataset.speak); });
addEventListener("hashchange", () => route());
route();
