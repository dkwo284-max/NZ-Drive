// NZ Drive — 대시보드 · 운전 연습 · 표지판 퀴즈 (해시 라우팅, 진도는 이 브라우저 localStorage 에만)
import { Game, VIOL } from "./engine.js";
import { SCENARIOS, CATS, byId } from "./scenarios.js";
import { QUIZ } from "./quiz.js";
import { signHTML } from "./signs.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const KEY = "nzdrive.v1";
const load = () => { try { return { missions: {}, viol: {}, quiz: { best: 0, items: {} }, hist: [], ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { missions: {}, viol: {}, quiz: { best: 0, items: {} }, hist: [] }; } };
const save = (st) => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* 저장 불가 */ } };
let S = load();
const starsOf = (ok, score) => (!ok ? 0 : score >= 100 ? 3 : score >= 85 ? 2 : 1);
const starTxt = (n) => "★".repeat(n) + "☆".repeat(3 - n);
const KEYSIGN = { keepleft: ["speed", { n: 50 }], leftturn: ["lights"], rbstraight: ["roundabout"], rbright: ["roundabout"], stop: ["stop"], zebra: ["pedx"], redleft: ["lights"],
  buslane: ["buslane", { time: "7-9AM" }], transit: ["transit", { n: 2 }], clearway: ["clearway", { time: "7-9AM" }], speedzones: ["school", { n: 40 }], schoolbus: ["schoolbus"] };

/* ================= 대시보드 ================= */
function dashboard() {
  const app = $("#app"), done = SCENARIOS.filter((s) => S.missions[s.id]?.stars > 0).length, stars = SCENARIOS.reduce((a, s) => a + (S.missions[s.id]?.stars || 0), 0);
  const vs = Object.entries(S.viol).sort((a, b) => b[1] - a[1]), weak = vs[0];
  const catStat = (c) => { const L = SCENARIOS.filter((s) => s.cat === c.id); const st = L.reduce((a, s) => a + (S.missions[s.id]?.stars || 0), 0); return { n: L.length, st, pct: Math.round((st / (L.length * 3)) * 100) }; };
  const next = SCENARIOS.find((s) => !(S.missions[s.id]?.stars > 0)) || SCENARIOS.slice().sort((a, b) => (S.missions[a.id]?.best || 0) - (S.missions[b.id]?.best || 0))[0];
  const card = (s) => { const m = S.missions[s.id] || {}, [k, o] = KEYSIGN[s.id] || ["speed", { n: 50 }];
    return `<a class="mcard${m.stars ? " done" : ""}" href="#/play/${s.id}"><span class="msign">${signHTML(k, o)}</span><span class="mbody"><b>${esc(s.title)}</b><span class="muted">${esc(s.place)}</span><span class="mstars" aria-label="별 ${m.stars || 0}개">${starTxt(m.stars || 0)}${m.best != null ? ` <span class="muted">최고 ${m.best}점</span>` : ""}</span></span></a>`; };
  const qBest = S.quiz.best || 0;
  app.innerHTML = `
  <header class="hero">
    <div><h1>NZ Drive <span class="sub">오클랜드 도심 운전 적응 연습</span></h1>
    <p class="muted">한국 운전자가 헷갈리기 쉬운 뉴질랜드 규칙을 상황별 미니 코스로 연습해요. 지도는 오클랜드 '느낌'의 가상 도로입니다.</p></div>
    <a class="btn primary" href="#/play/${next.id}">▶ ${S.hist.length ? "이어서" : "첫 연습"}: ${esc(next.title)}</a>
  </header>
  <section class="tiles">
    <div class="tile"><span class="tl">완료한 코스</span><b>${done}<small>/${SCENARIOS.length}</small></b><span class="bar"><i style="width:${(done / SCENARIOS.length) * 100}%"></i></span></div>
    <div class="tile"><span class="tl">모은 별</span><b>${stars}<small>/${SCENARIOS.length * 3}</small></b><span class="bar"><i style="width:${(stars / (SCENARIOS.length * 3)) * 100}%"></i></span></div>
    <div class="tile"><span class="tl">표지판 퀴즈 최고</span><b>${qBest}<small>/${QUIZ.length}</small></b><span class="bar"><i style="width:${(qBest / QUIZ.length) * 100}%"></i></span></div>
    <div class="tile"><span class="tl">가장 자주 틀린 규칙</span><b class="sm">${weak ? esc(VIOL[weak[0]]?.[0] || weak[0]) : "아직 없음"}</b><span class="muted">${weak ? `${weak[1]}회` : "연습하면 여기에 약점이 쌓여요"}</span></div>
  </section>
  ${CATS.map((c) => { const st = catStat(c); return `<section class="cat"><div class="cathead"><h2>${c.icon} ${esc(c.name)}</h2><span class="muted">별 ${st.st}/${st.n * 3} · ${st.pct}%</span></div><div class="mgrid">${SCENARIOS.filter((s) => s.cat === c.id).map(card).join("")}</div></section>`; }).join("")}
  <section class="two">
    <div class="panel"><h2>🪧 표지판 퀴즈</h2><p class="muted">실제 모양과 비슷한 NZ 표지판 ${QUIZ.length}개. 도로 밖에서 먼저 익혀 두세요.</p>
      <div class="qprev">${QUIZ.slice(0, 6).map((q) => signHTML(q.k, q.ko || {}, "sg sm")).join("")}</div>
      <a class="btn primary" href="#/quiz">퀴즈 시작</a></div>
    <div class="panel"><h2>📉 약점 리포트</h2>${vs.length ? `<div class="wbars">${vs.map(([k, n]) => `<div class="wb"><span>${esc(VIOL[k]?.[0] || k)}</span><span class="bar"><i style="width:${(n / vs[0][1]) * 100}%"></i></span><b>${n}</b></div>`).join("")}</div>` : '<p class="muted">아직 기록이 없어요. 코스를 달리면 어떤 규칙에서 자주 걸리는지 여기에 보여요.</p>'}
      ${S.hist.length ? `<h3>최근 연습</h3><ul class="hist">${S.hist.slice(0, 6).map((h) => `<li><span>${esc(byId[h.id]?.title || h.id)}</span><span class="muted">${esc(h.d)}</span><b>${h.score}점 ${starTxt(h.stars)}</b></li>`).join("")}</ul>` : ""}
      ${S.hist.length ? '<button class="btn ghost" id="reset" type="button">기록 지우기</button>' : ""}</div>
  </section>
  <section class="panel">
    <h2>🇰🇷 → 🇳🇿 꼭 바꿔야 할 습관</h2>
    <div class="tbl"><table><thead><tr><th>상황</th><th>한국</th><th>뉴질랜드</th></tr></thead><tbody>
      <tr><th>통행 방향</th><td>우측통행, 운전석 왼쪽</td><td><b>좌측통행, 운전석 오른쪽</b> — 운전석이 늘 중앙선 쪽</td></tr>
      <tr><th>크게 도는 회전</th><td>좌회전</td><td><b>우회전</b>(맞은편 직진 차에 양보)</td></tr>
      <tr><th>빨간불 회전</th><td>빨간불 우회전 가능</td><td><b>빨간불 회전 없음</b> — 초록불·초록 화살표만</td></tr>
      <tr><th>좌회전 vs 맞은편 우회전</th><td>—</td><td><b>좌회전 차가 양보</b> (2012년 규칙)</td></tr>
      <tr><th>로터리</th><td>반시계 방향</td><td><b>시계 방향</b>, 오른쪽에서 오는 차에 양보, 나갈 때 왼쪽 깜빡이</td></tr>
      <tr><th>STOP</th><td>서행 통과가 흔함</td><td><b>완전 정지</b> 필수</td></tr>
      <tr><th>스쿨버스</th><td>—</td><td>정차 중이면 <b>양방향 20km/h</b></td></tr>
      <tr><th>버스·T2/T3·클리어웨이</th><td>버스전용차로</td><td>표지판 <b>시간·인원</b> 확인 — 카메라 단속</td></tr>
      <tr><th>깜빡이 레버</th><td>왼쪽</td><td>일본·NZ 차는 대개 <b>오른쪽</b> (와이퍼가 켜지면 반대 레버)</td></tr>
      <tr><th>음주 기준</th><td>혈중 0.03%</td><td>20세 이상 0.05%, 20세 미만 0</td></tr>
    </tbody></table></div>
    <p class="muted small">요약 정보예요. 실제 운전은 <a href="https://nzta.govt.nz/roadcode/general-road-code" target="_blank" rel="noopener">NZTA 공식 Road Code</a>가 기준이고, 해외 면허 사용 기간·전환 조건은 NZTA 에서 확인하세요.</p>
  </section>
  <footer class="muted small">진도는 이 브라우저에만 저장돼요. 지도·도로명은 연습용 가상 배치이며 실제 도로와 다릅니다. 표지판은 실제 모양을 단순화한 그림입니다.</footer>`;
  $("#reset")?.addEventListener("click", () => { if (confirm("연습 기록을 모두 지울까요?")) { S = { missions: {}, viol: {}, quiz: { best: 0, items: {} }, hist: [] }; save(S); dashboard(); } });
}

/* ================= 운전 연습 ================= */
let game = null;
function play(id) {
  const sc = byId[id]; if (!sc) { location.hash = "#/"; return; }
  const app = $("#app"), idx = SCENARIOS.indexOf(sc), nextSc = SCENARIOS[idx + 1];
  app.innerHTML = `
  <div class="play">
    <div class="pbar"><a class="btn ghost" href="#/">← 대시보드</a><div class="ptitle"><b>${esc(sc.title)}</b><span class="muted">${esc(sc.place)}</span></div><span class="pscore" id="pscore">100점</span></div>
    <div class="stage">
      <canvas id="cv" aria-label="위에서 본 도로"></canvas>
      <div class="povbox"><canvas id="pov" aria-label="운전석 미리보기"></canvas><span class="povlab">운전석 미리보기</span></div>
      <div class="hud">
        <div class="speedo"><b id="hv">0</b><small>km/h</small></div>
        <div class="limit" id="hl"></div>
        <div class="hinfo" id="hi"></div>
      </div>
      <div class="toast" id="toast" hidden></div>
      <div class="ov" id="ov"></div>
    </div>
    <div class="ctrls">
      <button class="cb ind" id="bL" type="button" aria-label="왼쪽 깜빡이">◀<small>깜빡이</small></button>
      <button class="cb brake" id="bB" type="button">브레이크<small>↓ / Space</small></button>
      <button class="cb gas" id="bG" type="button">가속<small>↑</small></button>
      <button class="cb ind" id="bR" type="button" aria-label="오른쪽 깜빡이">▶<small>깜빡이</small></button>
    </div>
    <p class="muted small keys">키보드: ↑ 가속 · ↓/Space 브레이크 · ← → 깜빡이(다시 누르면 끔) · 화면 버튼은 누르고 있는 동안 작동</p>
  </div>`;
  const ov = $("#ov"), show = (html) => { ov.innerHTML = `<div class="card">${html}</div>`; ov.hidden = false; }, hide = () => { ov.hidden = true; ov.innerHTML = ""; };
  const [k, o] = KEYSIGN[sc.id] || ["speed", { n: 50 }];
  const hooks = {
    hud(g) {
      $("#hv").textContent = Math.round(g.v * 3.6); const lim = g.limitNow(); $("#hv").parentElement.classList.toggle("over", g.v * 3.6 > lim + 3);
      $("#hl").innerHTML = signHTML("speed", { n: lim }, "sg lim");
      $("#hi").innerHTML = [g.clock() ? `🕗 ${g.clock()}` : "", sc.occupants ? `👥 ${sc.occupants}명 탑승` : "", g.ind ? `<span class="blink">${g.ind === "L" ? "◀ 왼쪽" : "오른쪽 ▶"}</span>` : ""].filter(Boolean).join("<br>");
      $("#pscore").textContent = `${g.score()}점`;
      $("#bL").classList.toggle("on", g.ind === "L"); $("#bR").classList.toggle("on", g.ind === "R");
    },
    toast(t) { const el = $("#toast"); el.textContent = "👍 " + t; el.hidden = false; clearTimeout(el._t); el._t = setTimeout(() => (el.hidden = true), 3200); },
    choice(c, done) {
      show(`<h3>🤔 ${esc(c.q)}</h3><div class="opts">${c.opts.map((x, i) => `<button class="btn opt" data-i="${i}" type="button">${esc(x.t)}</button>`).join("")}</div>`);
      ov.querySelectorAll("[data-i]").forEach((b) => b.addEventListener("click", () => { hide(); done(+b.dataset.i); }));
    },
    violation(v, cont) {
      S.viol[v.type] = (S.viol[v.type] || 0) + 1; save(S);
      show(`<h3 class="${v.fatal ? "bad" : "warn"}">${v.fatal ? "💥" : "⚠️"} ${esc(v.name)} ${v.fatal ? "— 코스 실패" : `−${v.pen}점`}</h3><p>${esc(v.why)}</p><p class="small"><a href="${esc(v.link)}" target="_blank" rel="noopener">NZ Road Code 에서 확인 ↗</a></p><button class="btn primary" id="cont" type="button">${v.fatal ? "결과 보기" : "계속 운전"}</button>`);
      $("#cont").addEventListener("click", () => { hide(); cont(); }); $("#cont").focus();
    },
    end(r) {
      const st = starsOf(r.ok, r.score), m = S.missions[sc.id] || { plays: 0, passes: 0 };
      m.plays = (m.plays || 0) + 1; if (r.ok) m.passes = (m.passes || 0) + 1; m.best = Math.max(m.best ?? 0, r.score); m.stars = Math.max(m.stars || 0, st);
      S.missions[sc.id] = m; S.hist.unshift({ id: sc.id, score: r.score, stars: st, d: new Date().toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }) }); S.hist = S.hist.slice(0, 40); save(S);
      show(`<h3>${r.ok ? "🎉 코스 통과!" : "🔁 다시 도전"}</h3><p class="big">${r.score}점 <span class="stars">${starTxt(st)}</span></p>${r.msg ? `<p>${esc(r.msg)}</p>` : ""}
        ${r.viol.length ? `<ul class="vlist">${r.viol.map((v) => `<li><b>${esc(v.name)}</b> −${v.pen} · ${esc(v.why)}</li>`).join("")}</ul>` : "<p>위반 없이 완벽해요!</p>"}
        <p class="muted small">통과 기준: 70점 이상 + 충돌·역주행 없음. 100점 ★★★, 85점 이상 ★★.</p>
        <div class="opts row"><button class="btn" id="again" type="button">다시 하기</button>${nextSc ? `<a class="btn primary" href="#/play/${nextSc.id}">다음: ${esc(nextSc.title)} →</a>` : '<a class="btn primary" href="#/quiz">표지판 퀴즈 →</a>'}<a class="btn ghost" href="#/">대시보드</a></div>`);
      $("#again").addEventListener("click", () => play(id));
    },
  };
  game?.stop(); game = new Game(sc, $("#cv"), $("#pov"), hooks); hooks.hud(game);
  show(`<div class="brief"><span class="bsign">${signHTML(k, o)}</span><div><h3>${esc(sc.title)}</h3><p class="muted">${esc(sc.place)}${sc.clock ? ` · 🕗 ${sc.clock}` : ""}${sc.occupants ? ` · 👥 ${sc.occupants}명` : ""}</p></div></div>
    <p>${esc(sc.brief)}</p><ul class="tips">${sc.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <p class="muted small">위에서 본 지도는 진행 방향이 항상 위쪽이에요. 오른쪽 위 작은 화면은 운전석에서 보이는 표지판(추정)입니다.</p>
    <button class="btn primary" id="go" type="button">출발 ▶</button>`);
  $("#go").addEventListener("click", () => { hide(); game.start(); }); $("#go").focus();
  // 조작
  const hold = (el, key) => { const on = (e) => { e.preventDefault(); game.keys[key] = true; el.classList.add("on"); }, off = () => { game.keys[key] = false; el.classList.remove("on"); };
    el.addEventListener("pointerdown", on); el.addEventListener("pointerup", off); el.addEventListener("pointerleave", off); el.addEventListener("pointercancel", off); };
  hold($("#bG"), "gas"); hold($("#bB"), "brake");
  $("#bL").addEventListener("click", () => game.setInd("L")); $("#bR").addEventListener("click", () => game.setInd("R"));
}
const KEYMAP = { ArrowUp: "gas", w: "gas", ArrowDown: "brake", " ": "brake", s: "brake" };
addEventListener("keydown", (e) => {
  if (!game || game.ended || !$(".play")) return;
  if (KEYMAP[e.key]) { game.keys[KEYMAP[e.key]] = true; e.preventDefault(); }
  if (!e.repeat && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { game.setInd(e.key === "ArrowLeft" ? "L" : "R"); e.preventDefault(); }
});
addEventListener("keyup", (e) => { if (game && KEYMAP[e.key]) game.keys[KEYMAP[e.key]] = false; });
addEventListener("resize", () => { if (game && $(".play")) game.resize(); });

/* ================= 표지판 퀴즈 ================= */
function quiz() {
  game?.stop(); game = null;
  const order = QUIZ.slice().sort(() => Math.random() - 0.5); let i = 0, right = 0;
  const app = $("#app");
  const step = () => {
    if (i >= order.length) {
      S.quiz.best = Math.max(S.quiz.best || 0, right); save(S);
      app.innerHTML = `<div class="quiz panel"><h2>🪧 결과: ${right} / ${order.length}</h2><p class="muted">틀린 표지판은 아래 해설을 다시 보세요.</p>
        <div class="qreview">${order.filter((q) => S.quiz.items[q.id]?.last === false).map((q) => `<div class="qr">${signHTML(q.k, q.ko || {}, "sg md")}<div><b>${esc(q.o[q.a])}</b><p class="muted small">${esc(q.why)}</p></div></div>`).join("") || "<p>모두 맞혔어요! 🎉</p>"}</div>
        <div class="opts row"><a class="btn primary" href="#/quiz" id="re">다시 풀기</a><a class="btn ghost" href="#/">대시보드</a></div></div>`;
      $("#re").addEventListener("click", (e) => { e.preventDefault(); quiz(); });
      return;
    }
    const q = order[i];
    app.innerHTML = `<div class="quiz panel"><div class="qtop"><a class="btn ghost" href="#/">← 대시보드</a><span class="muted">${i + 1} / ${order.length} · 맞힌 수 ${right}</span></div>
      <div class="qsign">${signHTML(q.k, q.ko || {}, "sg xl")}</div><h3>${esc(q.q)}</h3>
      <div class="opts">${q.o.map((t, j) => `<button class="btn opt" data-j="${j}" type="button">${esc(t)}</button>`).join("")}</div><div id="qwhy"></div></div>`;
    app.querySelectorAll("[data-j]").forEach((b) => b.addEventListener("click", () => {
      const ok = +b.dataset.j === q.a; if (ok) right++;
      const it = S.quiz.items[q.id] || { r: 0, n: 0 }; it.n++; if (ok) it.r++; it.last = ok; S.quiz.items[q.id] = it; save(S);
      app.querySelectorAll("[data-j]").forEach((x) => { x.disabled = true; if (+x.dataset.j === q.a) x.classList.add("right"); else if (x === b) x.classList.add("wrong"); });
      $("#qwhy").innerHTML = `<p class="${ok ? "good" : "bad"}"><b>${ok ? "정답!" : "아쉬워요."}</b> ${esc(q.why)}</p><button class="btn primary" id="qn" type="button">다음 →</button>`;
      $("#qn").addEventListener("click", () => { i++; step(); }); $("#qn").focus();
    }));
  };
  step();
}

/* ================= 라우팅 ================= */
function route() {
  const h = location.hash || "#/";
  if (h.startsWith("#/play/")) return play(h.slice(7));
  game?.stop(); game = null;
  if (h === "#/quiz") return quiz();
  dashboard(); scrollTo(0, 0);
}
addEventListener("hashchange", route);
route();
