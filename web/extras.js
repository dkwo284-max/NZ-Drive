// NZ Drive 부가 기능: ☁️ 기기 간 이어하기(English Trainer 서버, 같은 학습 코드) · 🗣 운전 영어 · 📍 내 주변 실제 연습 장소(OSM)
const ET = "https://english-trainer.gundog0109.workers.dev";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CODE_KEY = "nzdrive.synccode";
export const syncCode = () => { try { return localStorage.getItem(CODE_KEY) || ""; } catch { return ""; } };

/* ================= ☁️ 기기 간 이어하기 ================= */
// 두 기록 합치기: 코스별 최고 별·점수, 위반 횟수는 큰 쪽, 최근 기록은 합쳐서 최신 50개
export function mergeState(a, b) {
  if (!b) return a;
  const out = { ...b, ...a };
  out.missions = { ...(b.missions || {}) };
  for (const [id, m] of Object.entries(a.missions || {})) {
    const o = out.missions[id];
    out.missions[id] = !o ? m : { ...o, ...m, stars: Math.max(o.stars || 0, m.stars || 0), best: Math.max(o.best || 0, m.best || 0), plays: Math.max(o.plays || 0, m.plays || 0), passes: Math.max(o.passes || 0, m.passes || 0) };
  }
  out.viol = { ...(b.viol || {}) };
  for (const [k, n] of Object.entries(a.viol || {})) out.viol[k] = Math.max(out.viol[k] || 0, n);
  const mx = (x, y, keys) => { const r = { ...(y || {}), ...(x || {}) }; for (const k of keys) r[k] = Math.max((x || {})[k] || 0, (y || {})[k] || 0); return r; };
  out.quiz = { ...mx(a.quiz, b.quiz, ["best"]), items: { ...((b.quiz || {}).items || {}), ...((a.quiz || {}).items || {}) } };
  out.theory = { ...mx(a.theory, b.theory, ["best", "runs"]), items: { ...((b.theory || {}).items || {}), ...((a.theory || {}).items || {}) } };
  out.mock = mx(a.mock, b.mock, ["runs", "pass", "s1"]);
  const seen = new Set();
  out.hist = [...(a.hist || []), ...(b.hist || [])].filter((h) => { const k = `${h.id}|${h.d}|${h.score}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((x, y) => String(y.d).localeCompare(String(x.d))).slice(0, 50);
  delete out._saved;
  return out;
}
async function call(method, body) {
  const code = syncCode();
  if (!code) throw new Error("코드 없음");
  const r = await fetch(`${ET}/api/appstate?app=nzdrive`, { method, headers: { "x-code": code, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `서버 ${r.status}`);
  return d;
}
let pushT = null;
/** 저장할 때마다 부름: 코드가 연결돼 있으면 3초 뒤 서버에 올림 */
export function schedulePush(getState) {
  if (!syncCode()) return;
  clearTimeout(pushT);
  pushT = setTimeout(() => call("PUT", getState()).then(() => setStatus("☁️ 동기화됨 " + new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }))).catch((e) => setStatus("☁️ 동기화 실패 — " + e.message)), 3000);
}
/** 앱 시작·연결 때: 서버 기록과 합쳐서 돌려줌 */
export async function pullMerge(local) {
  const d = await call("GET");
  return mergeState(local, d.state);
}
let statusTxt = "";
function setStatus(t) { statusTxt = t; const el = document.getElementById("syncSt"); if (el) el.textContent = t; }
export function syncPanel() {
  const code = syncCode();
  return `<div class="panel"><h2>☁️ 기기 간 이어하기</h2>
    <p class="muted small">English Trainer 와 같은 <b>학습 코드</b>를 넣으면 휴대폰·PC 어디서든 코스 별·약점·모의고사 기록이 이어져요. 코드는 이 기기에만 저장되고, 기록은 영어 앱 서버에 코드별로 보관돼요.</p>
    ${code ? `<p>연결된 코드: <b>${esc(code.slice(0, 2))}${"•".repeat(Math.max(0, code.length - 2))}</b> <button class="btn ghost" id="syncNow" type="button">지금 동기화</button> <button class="btn ghost" id="syncOff" type="button">연결 끊기</button></p>`
      : `<div class="opts row"><input id="syncIn" class="inp" placeholder="학습 코드 (4~24자)" autocomplete="off" maxlength="24"><button class="btn primary" id="syncOn" type="button">연결</button></div>`}
    <p class="muted small" id="syncSt">${esc(statusTxt)}</p></div>`;
}
export function bindSync(getState, setState, rerender) {
  const on = document.getElementById("syncOn"), now = document.getElementById("syncNow"), off = document.getElementById("syncOff");
  const run = async () => {
    setStatus("☁️ 불러오는 중…");
    try { const m = await pullMerge(getState()); setState(m); await call("PUT", m); setStatus("☁️ 동기화됨 — 두 기기의 기록을 합쳤어요"); rerender(); }
    catch (e) { setStatus("☁️ 동기화 실패 — " + e.message); }
  };
  on?.addEventListener("click", () => {
    const v = (document.getElementById("syncIn").value || "").trim();
    if (!/^[A-Za-z0-9가-힣_-]{4,24}$/.test(v)) return setStatus("코드는 4~24자(영문·숫자·한글·-_)예요");
    try { localStorage.setItem(CODE_KEY, v); } catch { /* 무시 */ }
    run();
  });
  now?.addEventListener("click", run);
  off?.addEventListener("click", () => { try { localStorage.removeItem(CODE_KEY); } catch { /* 무시 */ } setStatus("연결을 끊었어요 (이 기기 기록은 그대로)"); rerender(); });
}

/* ================= 🗣 운전 영어 ================= */
const PHRASES = [
  ["🚓 경찰 단속", [
    ["Good afternoon, officer. Is everything okay?", "안녕하세요. 무슨 일이 있나요?"],
    ["Here's my licence. It's a Korean licence with an approved translation.", "여기 면허증이요. 한국 면허와 승인된 번역본이에요."],
    ["Would you like me to turn the engine off?", "시동을 끌까요?"],
    ["Sorry, I didn't realise the limit had dropped to fifty.", "죄송해요, 제한속도가 50으로 바뀐 걸 몰랐어요."],
  ]],
  ["⛽ 주유소", [
    ["Pump number three, please. Can I pay by card?", "3번 주유기요. 카드로 낼 수 있나요?"],
    ["Where can I check my tyre pressure?", "타이어 공기압은 어디서 확인하나요?"],
    ["Do you have a car wash here?", "여기 세차장 있어요?"],
  ]],
  ["🅿️ 주차", [
    ["How long can I park here? Is it a P60?", "여기 얼마나 세울 수 있어요? 60분 주차인가요?"],
    ["Do I pay at the machine or on the app?", "주차 요금은 기계에서 내요, 앱으로 내요?"],
    ["Sorry, am I blocking your driveway? I'll move now.", "죄송해요, 제가 진입로를 막았나요? 바로 뺄게요."],
  ]],
  ["🔧 정비 · WoF", [
    ["I'd like to book a WoF for next week, please.", "다음 주에 WoF 검사 예약하고 싶어요."],
    ["Could you give me a quote before you start?", "작업 전에 견적 먼저 주실 수 있나요?"],
    ["When will the car be ready to pick up?", "차는 언제 찾으러 오면 돼요?"],
  ]],
  ["💥 사고 났을 때", [
    ["Are you okay? Is anyone hurt?", "괜찮으세요? 다친 사람 있어요?"],
    ["Let's swap details — name, phone number and insurance.", "인적 사항 교환해요 — 이름, 전화번호, 보험."],
    ["Do you mind if I take a photo of your rego plate?", "번호판 사진 좀 찍어도 될까요?"],
  ]],
  ["🧭 길 · 도로", [
    ["Which lane do I need for the motorway?", "모터웨이로 가려면 어느 차선으로 가야 해요?"],
    ["Is there a toll on this road? How do I pay it?", "이 길에 통행료가 있나요? 어떻게 내요?"],
    ["Sorry, I'm still getting used to driving on the left.", "죄송해요, 아직 좌측통행에 적응 중이에요."],
  ]],
];
function say(en) { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(en); u.lang = "en-NZ"; u.rate = 0.95; speechSynthesis.speak(u); } catch { /* 음성 없음 */ } }
export function englishPage() {
  const add = (en, ko) => `${ET}/?${new URLSearchParams({ add: en, from: "drive", ko })}`;
  document.getElementById("app").innerHTML = `<div class="panel narrow"><a class="btn ghost" href="#/">← 대시보드</a><h2 style="margin-top:12px">🗣 운전할 때 쓰는 영어</h2>
    <p class="muted">경찰 단속·주유소·주차·정비·사고·길 묻기에서 바로 쓰는 문장이에요. 🔊로 듣고 따라 말해 보세요. <b>＋ 복습</b>을 누르면 English Trainer 의 복습 문장으로 보내져(뜻·자연스러움 검토 뒤 추가) 반복해서 익힐 수 있어요.</p>
    ${PHRASES.map(([t, list]) => `<h3>${esc(t)}</h3><ul class="phr">${list.map(([en, ko]) => `<li><div><b lang="en">${esc(en)}</b><span class="muted">${esc(ko)}</span></div><span class="phr-a"><button class="btn ghost" type="button" data-say="${esc(en)}" aria-label="듣기">🔊</button><a class="btn ghost" href="${esc(add(en, ko))}" target="_blank" rel="noopener">＋ 복습</a></span></li>`).join("")}</ul>`).join("")}
    <p class="muted small">상황에 맞는 실제 대응(사고 신고 111, 보험·면허 규정)은 NZTA·경찰 공식 안내를 확인하세요.</p></div>`;
  document.querySelectorAll("[data-say]").forEach((b) => b.addEventListener("click", () => say(b.dataset.say)));
}

/* ================= 📍 내 주변 실제 연습 장소 (OpenStreetMap) ================= */
const KINDS = [
  ["rb", "🔄 로터리", 'way["junction"="roundabout"]', ["rbstraight", "rbright"]],
  ["rail", "🚆 철도 건널목", 'node["railway"="level_crossing"]', ["railway"]],
  ["zebra", "🦓 얼룩말 횡단보도", 'node["crossing"~"zebra|uncontrolled"]["highway"="crossing"]', ["zebra"]],
  ["onelane", "🌉 1차선 다리", 'way["bridge"]["lanes"="1"]["highway"~"primary|secondary|tertiary|unclassified|residential"]', ["onelane"]],
  ["signals", "🚦 신호 교차로", 'node["highway"="traffic_signals"]', ["redleft", "leftturn"]],
];
const km = (a, b, c, d) => { const R = 6371, x = (c - a) * Math.PI / 180, y = (d - b) * Math.PI / 180, h = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
export function nearPage(titleOf) {
  const app = document.getElementById("app");
  app.innerHTML = `<div class="panel narrow"><a class="btn ghost" href="#/">← 대시보드</a><h2 style="margin-top:12px">📍 내 주변 실제 연습 장소</h2>
    <p class="muted">게임 지도는 가상 도로예요. 여기서는 <b>OpenStreetMap</b> 실제 지도에서 내 주변의 로터리·철도 건널목·횡단보도·1차선 다리·신호 교차로를 찾아, 먼저 연습할 코스와 이어 줘요. 실제 도로에선 한산한 시간에, 동승자와 함께 천천히.</p>
    <div class="opts row"><button class="btn primary" id="nearGo" type="button">📍 현재 위치로 찾기</button><button class="btn ghost" id="nearCbd" type="button">오클랜드 시내 기준</button></div>
    <p class="muted small" id="nearSt"></p><div id="nearOut"></div>
    <p class="muted small">지도 데이터 © OpenStreetMap 기여자(ODbL). 반경 3km, 표시는 가까운 순.</p></div>`;
  const run = async (la, lo, label) => {
    const st = document.getElementById("nearSt"), out = document.getElementById("nearOut");
    st.textContent = `${label} 주변을 찾는 중…`; out.innerHTML = "";
    const q = `[out:json][timeout:25];(${KINDS.map(([, , sel]) => `${sel}(around:3000,${la},${lo});`).join("")});out center 400;`;
    try {
      const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "content-type": "application/x-www-form-urlencoded" } });
      if (!r.ok) throw new Error(`지도 서버 ${r.status}`);
      const els = (await r.json()).elements || [];
      const match = (e, k) => {
        const t = e.tags || {};
        if (k === "rb") return t.junction === "roundabout";
        if (k === "rail") return t.railway === "level_crossing";
        if (k === "zebra") return t.highway === "crossing" && /zebra|uncontrolled/.test(t.crossing || "");
        if (k === "onelane") return t.bridge && t.lanes === "1";
        return t.highway === "traffic_signals";
      };
      out.innerHTML = KINDS.map(([k, name, , scn]) => {
        const seen = new Set();
        const xs = els.filter((e) => match(e, k)).map((e) => { const y = e.lat ?? e.center?.lat, x = e.lon ?? e.center?.lon; return { e, y, x, d: km(la, lo, y, x) }; })
          .filter((p) => p.y != null && !seen.has(`${p.y.toFixed(3)},${p.x.toFixed(3)}`) && seen.add(`${p.y.toFixed(3)},${p.x.toFixed(3)}`)).sort((a, b) => a.d - b.d);
        return `<h3>${name} <small class="muted">${xs.length}곳</small></h3>${xs.length ? `<ul class="phr">${xs.slice(0, 4).map((p) => `<li><div><b>${esc(p.e.tags?.name || p.e.tags?.["name:en"] || "이름 없는 지점")}</b><span class="muted">${p.d.toFixed(1)}km</span></div><a class="btn ghost" href="https://www.openstreetmap.org/?mlat=${p.y}&mlon=${p.x}#map=18/${p.y}/${p.x}" target="_blank" rel="noopener">지도</a></li>`).join("")}</ul>` : '<p class="muted small">반경 3km 안에 없어요.</p>'}
          <p class="small">먼저 연습: ${scn.map((id) => `<a href="#/play/${id}">${esc(titleOf(id))}</a>`).join(" · ")}</p>`;
      }).join("");
      st.textContent = `${label} 기준 · ${els.length}개 지점 확인`;
    } catch (e) { st.textContent = `찾지 못했어요 (${e.message}). 잠시 뒤 다시 눌러 주세요.`; }
  };
  document.getElementById("nearCbd").addEventListener("click", () => run(-36.8485, 174.7633, "오클랜드 시내"));
  document.getElementById("nearGo").addEventListener("click", () => {
    if (!navigator.geolocation) return run(-36.8485, 174.7633, "오클랜드 시내");
    document.getElementById("nearSt").textContent = "위치 확인 중…";
    navigator.geolocation.getCurrentPosition((p) => run(p.coords.latitude, p.coords.longitude, "현재 위치"), () => run(-36.8485, 174.7633, "오클랜드 시내(위치 권한 없음)"), { timeout: 10000, maximumAge: 600000 });
  });
}
