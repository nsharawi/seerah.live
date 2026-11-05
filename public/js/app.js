import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app-check.js";
import {
  getAuth, onAuthStateChanged, signOut, signInWithPopup, signInWithRedirect, getRedirectResult,
  GoogleAuthProvider, FacebookAuthProvider, OAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
  getFirestore, collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, getDoc,
  runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getAI, getGenerativeModel, GoogleAIBackend } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-ai.js";

import { firebaseConfig, appCheckSiteKey, GEMINI_MODEL, DAILY_QUESTION_LIMIT } from "./config.js";
import { STORIES as S } from "./stories.js";
import { ANSWER_RULES, suggestPrompt, answerPrompt } from "./prompts.js";

const $ = id => document.getElementById(id);
const A = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);

// ---------- Firebase ----------
const app = initializeApp(firebaseConfig);
if (appCheckSiteKey) {
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true });
}
const auth = getAuth(app);
auth.languageCode = "ar";
const db = getFirestore(app);
const ai = getAI(app, { backend: new GoogleAIBackend() });
// Grounded model: searches Google, answers under strict rules
const answerModel = getGenerativeModel(ai, {
  model: GEMINI_MODEL,
  systemInstruction: ANSWER_RULES,
  tools: [{ googleSearch: {} }],
  generationConfig: { temperature: 0.2, maxOutputTokens: 700 }
});
// Ungrounded model for suggesting kid questions (no search cost)
const suggestModel = getGenerativeModel(ai, {
  model: GEMINI_MODEL,
  generationConfig: { temperature: 0.8, responseMimeType: "application/json" }
});

// ---------- State ----------
let i = 0, items = [], me = null, isAdmin = false, busy = false, unsub = null;
try { const h = parseInt((location.hash || "").replace("#s", ""), 10); if (h >= 1 && h <= S.length) i = h - 1; } catch (e) {}

// ---------- Timeline ----------
function buildTimeline() {
  const tl = $("tl"); tl.innerHTML = "";
  const ph = (name, range) => {
    const d = document.createElement("div"); d.className = "ph"; d.textContent = name + " ";
    const sm = document.createElement("small"); sm.textContent = range; d.appendChild(sm); tl.appendChild(d);
  };
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
function updateCounts() {
  S.forEach(s => {
    const el = document.querySelector("#ev-" + s[0] + " .cnt"); if (!el) return;
    const c = countFor(s[0]); el.hidden = !c; el.textContent = A(c) + (c === 1 ? " سؤال" : " أسئلة");
  });
}
function closeAll() {
  $("panel").hidden = true;
  document.querySelectorAll(".ev").forEach(e => { e.classList.remove("open"); e.querySelector(".head").setAttribute("aria-expanded", "false"); });
}
function showStory(n, scroll) {
  i = (n + S.length) % S.length; const s = S[i];
  closeAll();
  const ev = $("ev-" + s[0]); ev.classList.add("open"); ev.querySelector(".head").setAttribute("aria-expanded", "true");
  const p = $("panel"); ev.appendChild(p); p.hidden = false;
  $("sy").textContent = s[3]; $("ls").textContent = s[4]; $("qs").textContent = s[5];
  $("suggs").innerHTML = ""; clearAnswer(); status(""); $("qIn").value = "";
  try { history.replaceState(null, "", "#" + s[0]); } catch (e) {}
  renderList();
  if (scroll) try { ev.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); } catch (e) {}
}

// ---------- Search suggestions & sources (required display for grounded answers) ----------
function suggestionsFrame(html) {
  // Rendered in a sandboxed iframe so stored HTML can never run script on the page
  const f = document.createElement("iframe");
  f.setAttribute("sandbox", "allow-popups allow-popups-to-escape-sandbox");
  f.setAttribute("title", "اقتراحات بحث Google");
  f.style.cssText = "width:100%;border:0;height:64px;color-scheme:normal";
  f.srcdoc = '<base target="_blank">' + html;
  return f;
}
function sourcesList(sources) {
  const wrap = document.createElement("div"); wrap.className = "sources";
  const lbl = document.createElement("span"); lbl.textContent = "المصادر:"; wrap.appendChild(lbl);
  sources.forEach(s => {
    const a = document.createElement("a"); a.href = s.uri; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.textContent = s.title || s.uri; wrap.appendChild(a);
  });
  return wrap;
}
function clearAnswer() {
  $("ans").hidden = true; $("ans").textContent = "";
  $("ansSrc").hidden = true; $("ansSrc").innerHTML = "";
  $("ansSugg").hidden = true; $("ansSugg").innerHTML = "";
}

// ---------- Notebook ----------
function renderList() {
  const id = S[i][0], mine = items.filter(x => x.event === id), L = $("list");
  $("bookCount").textContent = A(mine.length); L.innerHTML = "";
  if (!me) { L.innerHTML = '<p class="empty">سجّلوا الدخول لرؤية الأسئلة المحفوظة.</p>'; return; }
  if (!mine.length) { L.innerHTML = '<p class="empty">لا توجد أسئلة محفوظة لهذه الحكاية بعد. اسألوا أول سؤال، وسيُحفظ هنا تلقائيًا.</p>'; return; }
  mine.forEach(x => {
    const d = document.createElement("div"); d.className = "qa";
    const q = document.createElement("div"); q.className = "q";
    const qt = document.createElement("span"); qt.textContent = "؟ " + x.q; q.appendChild(qt);
    if (isAdmin || x.uid === me.uid) {
      const b = document.createElement("button"); b.className = "del"; b.type = "button"; b.textContent = "حذف";
      b.onclick = () => {
        if (b.dataset.sure) deleteDoc(doc(db, "qa", x.id)).catch(() => { b.textContent = "تعذّر الحذف"; });
        else { b.dataset.sure = "1"; b.textContent = "تأكيد الحذف"; }
      };
      q.appendChild(b);
    }
    const a = document.createElement("div"); a.className = "a"; a.textContent = x.a;
    d.append(q, a);
    if (Array.isArray(x.sources) && x.sources.length) d.appendChild(sourcesList(x.sources));
    if (x.suggest) d.appendChild(suggestionsFrame(x.suggest));
    const m = document.createElement("div"); m.className = "by";
    const when = x.at && x.at.toDate ? x.at.toDate().toLocaleDateString("ar", { year: "numeric", month: "long", day: "numeric" }) : "";
    m.textContent = [x.name, when].filter(Boolean).join(" · ");
    d.appendChild(m); L.appendChild(d);
  });
}
function listen() {
  if (unsub) { unsub(); unsub = null; }
  if (!me) { items = []; updateCounts(); renderList(); return; }
  $("list").innerHTML = '<p class="empty">جارٍ تحميل الأسئلة المحفوظة…</p>';
  unsub = onSnapshot(query(collection(db, "qa"), orderBy("at", "asc")), snap => {
    items = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.event && x.q && x.a);
    updateCounts(); renderList();
  }, () => { $("list").innerHTML = '<p class="empty">تعذّر تحميل الأسئلة المحفوظة.</p>'; });
}

// ---------- Asking ----------
function status(t, err) { const s = $("st"); s.hidden = !t; s.textContent = t || ""; s.className = "status" + (err ? " err" : ""); }
const storyCtx = () => { const s = S[i]; return { title: s[1], when: s[2], text: s[3] }; };

function dayId() { const d = new Date(); return d.getUTCFullYear() + "-" + (d.getUTCMonth() + 1) + "-" + d.getUTCDate(); }
async function takeQuota() {
  const ref = doc(db, "usage", me.uid, "days", dayId());
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const n = snap.exists() ? snap.data().count : 0;
    if (n >= DAILY_QUESTION_LIMIT) return false;
    if (snap.exists()) tx.update(ref, { count: n + 1 }); else tx.set(ref, { count: 1 });
    return true;
  });
}

async function suggest() {
  if (!me || busy) return;
  busy = true; $("genBtn").disabled = true; status("نفكّر في أسئلة الأطفال…");
  try {
    const r = await suggestModel.generateContent(suggestPrompt(storyCtx()));
    let list = [];
    try { list = JSON.parse(r.response.text()); } catch (e) {}
    list = (Array.isArray(list) ? list : []).filter(x => typeof x === "string").slice(0, 3);
    $("suggs").innerHTML = "";
    list.forEach(t => {
      const b = document.createElement("button"); b.type = "button"; b.className = "sugg"; b.textContent = t;
      b.onclick = () => { $("qIn").value = t; ask(t); }; $("suggs").appendChild(b);
    });
    status(list.length ? "اضغطوا على سؤال لسماع جوابه." : "لم تظهر أسئلة. حاولوا مرة أخرى.");
  } catch (e) { console.error(e); status("تعذّر اقتراح أسئلة الآن. حاولوا مرة أخرى.", true); }
  finally { busy = false; $("genBtn").disabled = false; }
}

async function ask(raw) {
  const q = (raw || "").trim();
  if (!me) { status("سجّلوا الدخول أولًا.", true); return; }
  if (!q) { status("اكتبوا السؤال أولًا.", true); $("qIn").focus(); return; }
  if (busy) return;
  const id = S[i][0];
  const prev = items.find(x => x.event === id && x.q.trim() === q);
  if (prev) { clearAnswer(); $("ans").hidden = false; $("ans").textContent = prev.a; status("هذا السؤال محفوظ من قبل في الدفتر."); return; }

  busy = true; $("askBtn").disabled = true; $("genBtn").disabled = true; clearAnswer();
  try {
    if (!(await takeQuota())) { status("وصلتم إلى حد الأسئلة لهذا اليوم. نلتقي غدًا إن شاء الله.", true); return; }
    status("يبحث ويفكّر…");
    const r = await answerModel.generateContent(answerPrompt(storyCtx(), q));
    const text = (r.response.text() || "").trim();
    const cand = r.response.candidates && r.response.candidates[0];
    const gm = cand && cand.groundingMetadata;
    const sources = ((gm && gm.groundingChunks) || [])
      .map(c => c.web).filter(w => w && w.uri)
      .map(w => ({ uri: String(w.uri).slice(0, 2000), title: String(w.title || "").slice(0, 200) }))
      .slice(0, 8);
    const suggestHtml = gm && gm.searchEntryPoint && gm.searchEntryPoint.renderedContent ? String(gm.searchEntryPoint.renderedContent).slice(0, 30000) : "";

    if (!text) { status("لم يصل جواب. حاولوا صياغة السؤال بطريقة أخرى.", true); return; }
    $("ans").hidden = false; $("ans").textContent = text;
    if (sources.length) { $("ansSrc").hidden = false; $("ansSrc").replaceWith(Object.assign(sourcesList(sources), { id: "ansSrc" })); }
    if (suggestHtml) { $("ansSugg").hidden = false; $("ansSugg").appendChild(suggestionsFrame(suggestHtml)); }

    await addDoc(collection(db, "qa"), {
      event: id, q: q.slice(0, 200), a: text.slice(0, 4000), sources, suggest: suggestHtml,
      uid: me.uid, name: (me.displayName || "").slice(0, 80), at: serverTimestamp()
    });
    status("حُفظ في دفتر الأسئلة."); $("qIn").value = "";
  } catch (e) {
    console.error(e);
    status(e && e.code === "permission-denied" ? "لا تملكون صلاحية الحفظ." : "تعذّر الحصول على جواب الآن. حاولوا مرة أخرى.", true);
  } finally { busy = false; $("askBtn").disabled = false; $("genBtn").disabled = false; }
}

// ---------- Sign-in ----------
const providers = {
  google: () => new GoogleAuthProvider(),
  microsoft: () => { const p = new OAuthProvider("microsoft.com"); p.setCustomParameters({ prompt: "select_account" }); return p; },
  facebook: () => { const p = new FacebookAuthProvider(); p.addScope("email"); return p; }
};
function authMsg(t, err) { const s = $("authStatus"); s.hidden = !t; s.textContent = t || ""; s.className = "status" + (err ? " err" : ""); }
function authError(e) {
  const c = e && e.code || "";
  const map = {
    "auth/account-exists-with-different-credential": "هذا البريد مسجّل بطريقة دخول أخرى. ادخلوا بالطريقة التي استخدمتموها أول مرة.",
    "auth/invalid-credential": "البريد أو كلمة المرور غير صحيحة.",
    "auth/wrong-password": "كلمة المرور غير صحيحة.",
    "auth/user-not-found": "لا يوجد حساب بهذا البريد. اضغطوا «إنشاء حساب».",
    "auth/email-already-in-use": "يوجد حساب بهذا البريد. اضغطوا «دخول».",
    "auth/weak-password": "كلمة المرور قصيرة. استخدموا ٦ أحرف على الأقل.",
    "auth/invalid-email": "اكتبوا بريدًا إلكترونيًا صحيحًا.",
    "auth/popup-closed-by-user": "أُغلقت نافذة الدخول قبل الإكمال.",
    "auth/operation-not-allowed": "طريقة الدخول هذه غير مفعّلة بعد.",
    "auth/too-many-requests": "محاولات كثيرة. انتظروا قليلًا ثم حاولوا."
  };
  authMsg(map[c] || "تعذّر تسجيل الدخول. حاولوا مرة أخرى.", true);
}
document.querySelectorAll("[data-provider]").forEach(b => b.addEventListener("click", async () => {
  authMsg("");
  const p = providers[b.dataset.provider]();
  try { await signInWithPopup(auth, p); }
  catch (e) {
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
      try { await signInWithRedirect(auth, p); } catch (e2) { authError(e2); }
    } else authError(e);
  }
}));
getRedirectResult(auth).catch(authError);

$("emailForm").addEventListener("submit", async e => {
  e.preventDefault(); authMsg("");
  const em = $("emEmail").value.trim(), pw = $("emPass").value;
  if (!em || !pw) { authMsg("اكتبوا البريد وكلمة المرور.", true); return; }
  try { await signInWithEmailAndPassword(auth, em, pw); } catch (err) { authError(err); }
});
$("emSignUp").addEventListener("click", async () => {
  authMsg("");
  const nm = $("emName").value.trim(), em = $("emEmail").value.trim(), pw = $("emPass").value;
  if (!nm) { authMsg("اكتبوا الاسم لإنشاء الحساب.", true); $("emName").focus(); return; }
  if (!em || !pw) { authMsg("اكتبوا البريد وكلمة المرور.", true); return; }
  try {
    const cred = await createUserWithEmailAndPassword(auth, em, pw);
    await updateProfile(cred.user, { displayName: nm });
    sendEmailVerification(cred.user).catch(() => {});
  } catch (err) { authError(err); }
});
$("emReset").addEventListener("click", async () => {
  const em = $("emEmail").value.trim();
  if (!em) { authMsg("اكتبوا بريدكم أولًا ثم اضغطوا «نسيت كلمة المرور؟».", true); $("emEmail").focus(); return; }
  try { await sendPasswordResetEmail(auth, em); authMsg("أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدكم."); }
  catch (err) { authError(err); }
});
$("signOutBtn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async user => {
  me = user;
  $("authBox").hidden = !!user; $("who").hidden = !user;
  $("askLocked").hidden = !!user; $("askTools").hidden = !user;
  $("whoName").textContent = user ? (user.displayName || user.email || "") : "";
  isAdmin = false;
  if (user) { try { isAdmin = (await getDoc(doc(db, "admins", user.uid))).exists(); } catch (e) {} }
  listen();
});

// ---------- Wire up ----------
$("pv").addEventListener("click", () => showStory(i - 1, true));
$("nx").addEventListener("click", () => showStory(i + 1, true));
$("genBtn").addEventListener("click", suggest);
$("askForm").addEventListener("submit", e => { e.preventDefault(); ask($("qIn").value); });
$("qIn").addEventListener("input", () => { if ($("st").classList.contains("err")) status(""); });
buildTimeline(); updateCounts(); showStory(i);
