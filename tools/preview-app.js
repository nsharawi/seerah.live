// Preview adapter: runs the site's UI inside a Claude artifact.
// Sign-in is simulated, answers come from Claude using the same strict rules (without Google Search),
// and the notebook is stored in the artifact's database. The real site uses public/js/app.js.
const $ = id => document.getElementById(id);
const A = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
let i = 0, items = [], me = null, sample = null, db = null, uid = null, canDel = false, busy = false, dbReady = false;
try { const h = parseInt((location.hash || "").replace("#s", ""), 10); if (h >= 1 && h <= S.length) i = h - 1; } catch (e) {}

function buildTimeline() {
  const tl = $("tl"); tl.innerHTML = "";
  const ph = (name, range) => { const d = document.createElement("div"); d.className = "ph"; d.textContent = name + " "; const sm = document.createElement("small"); sm.textContent = range; d.appendChild(sm); tl.appendChild(d); };
  ph("العهد المكي", "٥٧١ – ٦٢٢م");
  S.forEach((s, k) => {
    if (k === 6) ph("العهد المدني", "١ – ١١هـ");
    const ev = document.createElement("div");
    ev.className = "ev " + (k < 6 ? "mk" : "md") + (k === 5 ? " hj" : ""); ev.id = "ev-" + s[0];
    const h = document.createElement("button"); h.type = "button"; h.className = "head"; h.setAttribute("aria-expanded", "false");
    const d = document.createElement("div"); d.className = "d";
    const dt = document.createElement("span"); dt.textContent = s[2]; d.appendChild(dt);
    const c = document.createElement("span"); c.className = "cnt"; c.hidden = true; d.appendChild(c);
    const t = document.createElement("div"); t.className = "t"; t.textContent = s[1];
    h.append(d, t);
    h.onclick = () => { if (i === k && !$("panel").hidden) closeAll(); else showStory(k, true); };
    ev.appendChild(h); tl.appendChild(ev);
  });
}
const countFor = id => items.filter(x => x.event === id).length;
function updateCounts() { S.forEach(s => { const el = document.querySelector("#ev-" + s[0] + " .cnt"); if (!el) return; const c = me ? countFor(s[0]) : 0; el.hidden = !c; el.textContent = A(c) + (c === 1 ? " سؤال" : " أسئلة"); }); }
function closeAll() { $("panel").hidden = true; document.querySelectorAll(".ev").forEach(e => { e.classList.remove("open"); e.querySelector(".head").setAttribute("aria-expanded", "false"); }); }
function showStory(n, scroll) {
  i = (n + S.length) % S.length; const s = S[i];
  closeAll();
  const ev = $("ev-" + s[0]); ev.classList.add("open"); ev.querySelector(".head").setAttribute("aria-expanded", "true");
  const p = $("panel"); ev.appendChild(p); p.hidden = false;
  $("sy").textContent = s[3]; $("ls").textContent = s[4]; $("qs").textContent = s[5];
  $("suggs").innerHTML = ""; $("ans").hidden = true; status(""); $("qIn").value = "";
  try { history.replaceState(null, "", "#" + s[0]); } catch (e) {}
  renderList();
  if (scroll) try { ev.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); } catch (e) {}
}
function renderList() {
  const id = S[i][0], mine = items.filter(x => x.event === id), L = $("list");
  $("bookCount").textContent = A(me ? mine.length : 0); L.innerHTML = "";
  const msg = t => { const p = document.createElement("p"); p.className = "empty"; p.textContent = t; L.appendChild(p); };
  if (!me) return msg("سجّلوا الدخول لرؤية الأسئلة المحفوظة.");
  if (!dbReady) return msg("جارٍ تحميل الأسئلة المحفوظة…");
  if (!db) return msg("الحفظ غير متاح في هذا العرض.");
  if (!mine.length) return msg("لا توجد أسئلة محفوظة لهذه الحكاية بعد. اسألوا أول سؤال، وسيُحفظ هنا تلقائيًا.");
  mine.forEach(x => {
    const d = document.createElement("div"); d.className = "qa";
    const q = document.createElement("div"); q.className = "q";
    const qt = document.createElement("span"); qt.textContent = "؟ " + x.q; q.appendChild(qt);
    if (canDel) {
      const b = document.createElement("button"); b.className = "del"; b.type = "button"; b.textContent = "حذف";
      b.onclick = () => { if (b.dataset.sure) db.collection("qa").doc(x.id).delete().catch(() => { b.textContent = "تعذّر الحذف"; }); else { b.dataset.sure = "1"; b.textContent = "تأكيد الحذف"; } };
      q.appendChild(b);
    }
    const a = document.createElement("div"); a.className = "a"; a.textContent = x.a;
    const m = document.createElement("div"); m.className = "by";
    try { m.textContent = new Date(x.at).toLocaleDateString("ar", { year: "numeric", month: "long", day: "numeric" }); } catch (e) {}
    d.append(q, a, m); L.appendChild(d);
  });
}
function status(t, err) { const s = $("st"); s.hidden = !t; s.textContent = t || ""; s.className = "status" + (err ? " err" : ""); }
const storyCtx = () => { const s = S[i]; return { title: s[1], when: s[2], text: s[3] }; };
function errCopy(e) { const c = e && e.code; if (c === "not_granted") return "لم يُسمح باستخدام Claude في هذه المعاينة."; if (c === "rate_limited") return "أسئلة كثيرة في وقت قصير. انتظروا قليلًا."; return "تعذّر الحصول على جواب الآن. حاولوا مرة أخرى."; }

async function suggest() {
  if (!sample || busy) return;
  busy = true; $("genBtn").disabled = true; status("نفكّر في أسئلة الأطفال…");
  try {
    const arr = await sample.json(suggestPrompt(storyCtx()), { modelTier: "quick" });
    const list = (Array.isArray(arr) ? arr : []).filter(x => typeof x === "string").slice(0, 3);
    $("suggs").innerHTML = "";
    list.forEach(t => { const b = document.createElement("button"); b.type = "button"; b.className = "sugg"; b.textContent = t; b.onclick = () => { $("qIn").value = t; ask(t); }; $("suggs").appendChild(b); });
    status(list.length ? "اضغطوا على سؤال لسماع جوابه." : "لم تظهر أسئلة. حاولوا مرة أخرى.");
  } catch (e) { status(errCopy(e), true); } finally { busy = false; $("genBtn").disabled = false; }
}
async function ask(raw) {
  const q = (raw || "").trim();
  if (!q) { status("اكتبوا السؤال أولًا.", true); $("qIn").focus(); return; }
  if (busy) return;
  const id = S[i][0];
  const prev = items.find(x => x.event === id && x.q.trim() === q);
  if (prev) { $("ans").hidden = false; $("ans").textContent = prev.a; status("هذا السؤال محفوظ من قبل في الدفتر."); return; }
  if (!sample) { status("الأجوبة غير متاحة في هذا العرض.", true); return; }
  busy = true; $("askBtn").disabled = true; $("genBtn").disabled = true;
  const ans = $("ans"); ans.hidden = false; ans.textContent = ""; status("يفكّر…");
  try {
    const prompt = ANSWER_RULES + "\n\n(في هذه المعاينة لا يتوفر بحث Google: أجب مما تعرفه يقينًا فقط.)\n\n" + answerPrompt(storyCtx(), q);
    const { text } = await sample(prompt, { cache: false, onText: ({ text }) => { ans.textContent = text; status(""); } });
    ans.textContent = text;
    if (db) { await db.collection("qa").add({ event: id, q, a: text, at: Date.now(), by: uid || null }); status("حُفظ في دفتر الأسئلة."); $("qIn").value = ""; }
  } catch (e) { if (e && e.text) ans.textContent = e.text; else if (!ans.textContent) ans.hidden = true; status(errCopy(e), true); }
  finally { busy = false; $("askBtn").disabled = false; $("genBtn").disabled = false; }
}

// Simulated sign-in: every method signs in as the viewer, so the flow can be checked here
function setSignedIn(name) {
  me = name ? { displayName: name } : null;
  $("authBox").hidden = !!me; $("who").hidden = !me;
  $("askLocked").hidden = !!me; $("askTools").hidden = !me;
  $("whoName").textContent = me ? me.displayName : "";
  updateCounts(); renderList();
}
const labels = { google: "Google", microsoft: "Microsoft", facebook: "Facebook" };
document.querySelectorAll("[data-provider]").forEach(b => b.addEventListener("click", () => setSignedIn("معاينة · " + labels[b.dataset.provider])));
$("emailForm").addEventListener("submit", e => {
  e.preventDefault();
  const em = $("emEmail").value.trim(), pw = $("emPass").value;
  const s = $("authStatus");
  if (!em || !pw) { s.hidden = false; s.className = "status err"; s.textContent = "اكتبوا البريد وكلمة المرور."; return; }
  s.hidden = true; setSignedIn(em);
});
$("emSignUp").addEventListener("click", () => {
  const nm = $("emName").value.trim(), s = $("authStatus");
  if (!nm) { s.hidden = false; s.className = "status err"; s.textContent = "اكتبوا الاسم لإنشاء الحساب."; $("emName").focus(); return; }
  s.hidden = true; setSignedIn(nm);
});
$("emReset").addEventListener("click", () => { const s = $("authStatus"); s.hidden = false; s.className = "status"; s.textContent = "في الموقع المنشور يصل رابط إعادة التعيين إلى البريد."; });
$("signOutBtn").addEventListener("click", () => setSignedIn(null));

$("pv").addEventListener("click", () => showStory(i - 1, true));
$("nx").addEventListener("click", () => showStory(i + 1, true));
$("genBtn").addEventListener("click", suggest);
$("askForm").addEventListener("submit", e => { e.preventDefault(); ask($("qIn").value); });
buildTimeline(); setSignedIn(null); showStory(i);

(async () => {
  if (!window.claude) { dbReady = true; renderList(); return; }
  claude.use("sample").then(s => { sample = s; });
  const user = await claude.use("user");
  if (user) { try { uid = await user.id(); } catch (e) {} try { canDel = !!user.canEdit(); } catch (e) {} }
  db = await claude.use("db");
  if (!db) { dbReady = true; renderList(); return; }
  db.collection("qa").orderBy("at", "asc").onSnapshot(snap => {
    dbReady = true;
    items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x && x.event && x.q && x.a);
    updateCounts(); renderList();
  }, () => { dbReady = true; renderList(); });
})();
