import { loadWords } from "./data.js";
import { loadState, saveState, getWordState, exportState, validateImport } from "./storage.js";
import { shuffle, createChoiceQuestion, checkSpelling, recordAnswer, makeSession } from "./quiz.js";
import { speak } from "./speech.js";
import { calculateStats } from "./statistics.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const app = $("#app"), statusEl = $("#loadStatus"), toastEl = $("#toast");
let words = [], state, page = "review", reviewQueue = [], flipped = false, currentReview = null;
let quiz = null, toastTimer = null;

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function record(id) { return getWordState(state, id); }
function persist() {
  try { saveState(state); }
  catch (error) { toast(error.message); }
}
function setPage(next) {
  page = next;
  $$(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.page === page));
  render();
}
function wordById(id) { return words.find(w => w.id === id); }
function getFavorites() { return words.filter(w => record(w.id).favorite); }
function getWrong() { return words.filter(w => (record(w.id).wrongCount || 0) > 0); }
function getDue() { return words.filter(w => record(w.id).nextReviewAt && Date.parse(record(w.id).nextReviewAt) <= Date.now()); }

function render() {
  if (!words.length) return;
  if (page === "review") renderReview();
  else if (page === "quiz") renderQuizHome();
  else if (page === "favorites") renderFavorites();
  else renderStats();
}
function renderReview() {
  if (!reviewQueue.length) {
    reviewQueue = shuffle(words.filter(w => !record(w.id).nextReviewAt || Date.parse(record(w.id).nextReviewAt) <= Date.now()));
    if (!reviewQueue.length) reviewQueue = shuffle(words);
  }
  if (!currentReview || !reviewQueue.some(w => w.id === currentReview.id)) currentReview = reviewQueue[0];
  if (!currentReview) { app.innerHTML = `<div class="empty">目前沒有可複習的單字。</div>`; return; }
  const w = currentReview, r = record(w.id), index = reviewQueue.findIndex(x => x.id === w.id);
  app.innerHTML = `
    <div class="panel-heading"><div><h2>單字複習</h2><p>點擊卡片翻面，使用評分安排下一次複習。</p></div><span class="pill">${index + 1} / ${reviewQueue.length}</span></div>
    <div class="review-layout">
      <div>
        <article class="flashcard" id="flashcard" role="button" tabindex="0" aria-label="點擊翻轉單字卡">
          <div class="flashcard-top"><span class="pill">${esc(w.source || "單字題庫")}</span><button class="button" id="speakBtn">🔊 發音</button></div>
          <div class="flashcard-word">
            ${flipped ? `<h3 class="meaning">${esc(w.meaning)}</h3><span class="pill">${esc(w.pos)}</span>` : `<h3>${esc(w.word)}</h3><span class="muted">點擊卡片查看中文與例句</span>`}
            ${flipped ? `<div class="card-back"><strong>完整單字筆記</strong><br>${esc(w.back)}</div>` : ""}
          </div>
          <div class="flashcard-bottom">${flipped ? "再次點擊可回到英文正面" : "Space 翻面 · Enter 發音"}</div>
        </article>
        <div class="card-actions">
          <button class="rating again" data-rating="Again">Again<br><small>1</small></button>
          <button class="rating hard" data-rating="Hard">Hard<br><small>2</small></button>
          <button class="rating good" data-rating="Good">Good<br><small>3</small></button>
          <button class="rating easy" data-rating="Easy">Easy<br><small>4</small></button>
        </div>
      </div>
      <aside class="review-sidebar">
        <div class="side-card"><h3>這個單字</h3>
          <div class="metric"><span>複習次數</span><strong>${r.reviewCount || 0}</strong></div>
          <div class="metric"><span>測驗答對</span><strong>${r.correctCount || 0}</strong></div>
          <div class="metric"><span>測驗答錯</span><strong>${r.wrongCount || 0}</strong></div>
          <div class="metric"><span>下次複習</span><strong>${r.nextReviewAt ? new Date(r.nextReviewAt).toLocaleDateString() : "尚未排程"}</strong></div>
        </div>
        <div class="side-card"><div class="row-between"><h3>個人標記</h3><button class="button ${r.favorite ? "button-danger" : ""}" id="favoriteBtn">${r.favorite ? "♥ 已收藏" : "♡ 收藏"}</button></div><p class="muted">收藏會同步顯示在「收藏與錯題」頁面。</p></div>
        <div class="side-card"><h3>本次範圍</h3><div class="metric"><span>待複習單字</span><strong>${getDue().length}</strong></div><div class="metric"><span>收藏單字</span><strong>${getFavorites().length}</strong></div></div>
      </aside>
    </div>`;
  $("#flashcard").addEventListener("click", e => { if (e.target.closest("button")) return; flipped = !flipped; renderReview(); });
  $("#flashcard").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flipped = !flipped; renderReview(); }});
  $("#speakBtn").addEventListener("click", e => { e.stopPropagation(); try { speak(w.word); } catch(err) { toast(err.message); } });
  $("#favoriteBtn").addEventListener("click", () => { r.favorite = !r.favorite; persist(); renderReview(); toast(r.favorite ? "已加入收藏" : "已取消收藏"); });
  $$("[data-rating]").forEach(btn => btn.addEventListener("click", () => rateWord(btn.dataset.rating)));
}
function rateWord(rating) {
  if (!currentReview) return;
  const w = currentReview, r = record(w.id);
  r.srs ??= {Again:0,Hard:0,Good:0,Easy:0};
  r.srs[rating] = (r.srs[rating] || 0) + 1;
  r.reviewCount = (r.reviewCount || 0) + 1;
  r.lastReviewedAt = new Date().toISOString();
  const days = {Again:0, Hard:1, Good:3, Easy:7}[rating];
  r.intervalDays = days;
  const next = new Date();
  if (rating === "Again") next.setMinutes(next.getMinutes() + 10);
  else next.setDate(next.getDate() + days);
  r.nextReviewAt = next.toISOString();
  reviewQueue = reviewQueue.filter(x => x.id !== w.id);
  currentReview = reviewQueue[0] || null;
  flipped = false;
  persist();
  if (!currentReview) toast("這輪單字已完成！");
  renderReview();
}

function renderQuizHome() {
  const favCount = getFavorites().length, wrongCount = getWrong().length;
  app.innerHTML = `
    <div class="panel-heading"><div><h2>單字測驗</h2><p>選擇題型與範圍，完成後會保存成績並更新錯題紀錄。</p></div><span class="pill">${words.length} 個單字</span></div>
    <div class="quiz-layout">
      <div class="row" style="align-items:stretch">
        <label class="field" style="flex:1">測驗題型
          <select class="select" id="quizMode"><option value="choice">英文選中文・四選一</option><option value="spelling">中文提示・英文拼字</option><option value="listening">聽音辨字・四選一</option></select>
        </label>
        <label class="field" style="flex:1">測驗範圍
          <select class="select" id="quizScope"><option value="all">全部單字（${words.length}）</option><option value="favorites">我的收藏（${favCount}）</option><option value="wrong">曾答錯單字（${wrongCount}）</option></select>
        </label>
        <label class="field" style="width:120px">題數
          <select class="select" id="quizCount"><option value="10">10 題</option><option value="20">20 題</option><option value="all">全部</option></select>
        </label>
      </div>
      <div class="notice" style="margin-top:15px">聽音辨字使用目前瀏覽器的英文語音；不同裝置的聲音可能不同。拼字題會忽略大小寫與前後空白，但不自動接受其他拼字變體。</div>
      <button class="button button-primary" id="startQuiz">開始測驗 →</button>
    </div>
    <div class="side-card" style="margin-top:24px"><h3>最近測驗</h3>${state.sessions.length ? `<div class="history-list">${state.sessions.slice(-5).reverse().map(s=>`<div class="history-row"><div><strong>${esc(modeName(s.mode))}</strong><br><span>${new Date(s.finishedAt).toLocaleString()}</span></div><strong>${s.correct}/${s.total}（${s.total ? Math.round(s.correct/s.total*100) : 0}%）</strong></div>`).join("")}</div>` : `<p class="muted">完成第一次測驗後，這裡會顯示最近成績。</p>`}</div>`;
  $("#startQuiz").addEventListener("click", startQuiz);
}
function modeName(mode) { return ({choice:"英文選中文",spelling:"中文拼英文",listening:"聽音辨字"})[mode] || mode; }
function startQuiz() {
  const mode = $("#quizMode").value, scope = $("#quizScope").value, countValue = $("#quizCount").value;
  let pool = scope === "favorites" ? getFavorites() : scope === "wrong" ? getWrong() : [...words];
  if (!pool.length) { toast("這個範圍沒有可測驗的單字。"); return; }
  if (mode !== "spelling" && pool.length < 4) { toast("四選一至少需要 4 個可用單字。"); return; }
  pool = shuffle(pool);
  if (countValue !== "all") pool = pool.slice(0, Math.min(Number(countValue), pool.length));
  quiz = { mode, scope, pool, index: 0, answers: [], startedAt: new Date().toISOString(), current: null, locked: false };
  renderQuizQuestion();
}
function renderQuizQuestion() {
  const q = quiz;
  if (q.index >= q.pool.length) return finishQuiz();
  q.locked = false;
  const word = q.pool[q.index];
  q.current = word;
  const progress = Math.round(q.index / q.pool.length * 100);
  let prompt, controls;
  if (q.mode === "spelling") {
    prompt = `<h3>${esc(word.meaning)}</h3><p class="muted">${esc(word.pos || "請輸入英文單字")}</p>`;
    controls = `<form id="spellingForm" class="row"><input id="spellingInput" class="text-input" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="輸入英文拼字…" required><button class="button button-primary" type="submit">確認答案</button></form>`;
  } else {
    const question = createChoiceQuestion(q.pool, q.mode, word);
    q.currentQuestion = question;
    prompt = q.mode === "listening" ? `<h3>聽音辨字</h3><p class="muted">按下播放，再選出正確單字。</p><button id="playQuizWord" class="button button-light">🔊 播放發音</button>` : `<h3>${esc(word.word)}</h3><p class="muted">${esc(word.pos || "請選出正確中文意思")}</p>`;
    controls = `<div class="quiz-options">${question.options.map(option => `<button class="option" data-option="${esc(option.id)}">${esc(q.mode === "listening" ? option.word : option.meaning)}</button>`).join("")}</div>`;
  }
  app.innerHTML = `
    <div class="panel-heading"><div><h2>${modeName(q.mode)}</h2><p>第 ${q.index + 1} 題，共 ${q.pool.length} 題</p></div><button class="button" id="quitQuiz">結束測驗</button></div>
    <div class="progress"><span style="width:${progress}%"></span></div>
    <div class="quiz-layout"><div class="quiz-prompt">${prompt}</div>${controls}<div id="quizFeedback" class="feedback" aria-live="polite"></div><div class="row-between"><span class="muted">目前答對 ${q.answers.filter(a=>a.correct).length} 題</span><button class="button button-primary" id="nextQuestion" hidden>下一題 →</button></div></div>`;
  $("#quitQuiz").addEventListener("click", () => { if (confirm("確定結束這次測驗？尚未完成的測驗不會計入正式成績。")) { quiz = null; renderQuizHome(); }});
  if (q.mode === "spelling") {
    $("#spellingForm").addEventListener("submit", e => { e.preventDefault(); answerQuestion(checkSpelling($("#spellingInput").value, word.word), $("#spellingInput").value); });
    $("#spellingInput").focus();
  } else {
    $$("[data-option]").forEach(btn => btn.addEventListener("click", () => answerQuestion(btn.dataset.option === q.currentQuestion.answerId, btn.dataset.option)));
    if (q.mode === "listening") { $("#playQuizWord").addEventListener("click", () => { try { speak(word.word); } catch(e) { toast(e.message); }}); try { speak(word.word); } catch(e) { toast(e.message); } }
  }
}
function answerQuestion(correct, submitted) {
  const q = quiz;
  if (!q || q.locked) return;
  q.locked = true;
  const word = q.current;
  const r = record(word.id);
  recordAnswer(state, word.id, correct);
  q.answers.push({wordId:word.id, correct, submitted:typeof submitted === "string" ? submitted : "", mode:q.mode});
  if (!correct) r.wrongCount = Math.max(1, r.wrongCount || 0);
  persist();
  const feedback = $("#quizFeedback");
  feedback.innerHTML = correct
    ? `<strong style="color:var(--green)">答對了！</strong> ${esc(word.word)} — ${esc(word.meaning)}`
    : `<strong style="color:var(--red)">再加強一下。</strong> 正確答案：${esc(word.word)} — ${esc(word.meaning)}<div class="muted" style="margin-top:5px">${esc(word.back)}</div>`;
  $$("[data-option]").forEach(btn => { btn.disabled = true; if (btn.dataset.option === word.id) btn.classList.add("correct"); else if (btn.dataset.option === submitted) btn.classList.add("wrong"); });
  const next = $("#nextQuestion");
  next.hidden = false;
  next.textContent = q.index === q.pool.length - 1 ? "查看測驗結果 →" : "下一題 →";
  next.addEventListener("click", () => { q.index++; renderQuizQuestion(); }, {once:true});
}
function finishQuiz() {
  const q = quiz;
  if (!q) return;
  const session = makeSession(q.mode, q.scope, q.answers, q.startedAt);
  state.sessions.push(session);
  if (state.sessions.length > 200) state.sessions = state.sessions.slice(-200);
  persist();
  const accuracy = session.total ? Math.round(session.correct / session.total * 100) : 0;
  const wrongIds = [...new Set(session.answers.filter(a=>!a.correct).map(a=>a.wordId))];
  app.innerHTML = `<div class="quiz-layout"><div class="panel-heading"><div><h2>測驗完成！</h2><p>${modeName(q.mode)} · ${new Date(session.finishedAt).toLocaleString()}</p></div><span class="pill">已保存成績</span></div><div class="quiz-prompt"><p class="muted">本次正確率</p><h3>${accuracy}%</h3><p>答對 ${session.correct} 題 · 答錯 ${session.wrong} 題 · 共 ${session.total} 題</p></div><div class="row"><button class="button button-primary" id="retryWrong" ${wrongIds.length ? "" : "disabled"}>重測本次錯題（${wrongIds.length}）</button><button class="button" id="backQuiz">返回測驗首頁</button><button class="button" id="goStats">查看統計</button></div></div>`;
  $("#retryWrong").addEventListener("click", () => {
    const wrongPool = wrongIds.map(wordById).filter(Boolean);
    if (!wrongPool.length) return;
    quiz = {mode:q.mode, scope:"wrong", pool:shuffle(wrongPool), index:0, answers:[], startedAt:new Date().toISOString(), current:null, locked:false};
    renderQuizQuestion();
  });
  $("#backQuiz").addEventListener("click", () => { quiz = null; renderQuizHome(); });
  $("#goStats").addEventListener("click", () => { quiz = null; setPage("stats"); });
  quiz = null;
}
function renderFavorites() {
  const favorites = getFavorites(), wrong = getWrong();
  app.innerHTML = `<div class="panel-heading"><div><h2>收藏與錯題</h2><p>收藏是主動標記；錯題會由測驗自動累積。</p></div></div>
    <div class="row" style="margin-bottom:16px"><button class="button button-primary" data-list="favorites">我的收藏（${favorites.length}）</button><button class="button" data-list="wrong">錯題單字（${wrong.length}）</button><button class="button" data-list="all">全部題庫（${words.length}）</button></div>
    <div class="list-tools"><input id="wordSearch" class="text-input" style="max-width:360px" placeholder="搜尋英文或中文意思…"></div><div id="wordList"></div>`;
  let listMode = "favorites";
  const draw = () => {
    const list = (listMode === "favorites" ? favorites : listMode === "wrong" ? wrong : words).filter(w => {
      const search = ($("#wordSearch").value || "").trim().toLocaleLowerCase();
      return !search || w.word.toLocaleLowerCase().includes(search) || w.meaning.toLocaleLowerCase().includes(search);
    });
    $("#wordList").innerHTML = list.length ? `<div class="word-list">${list.map(w=>`<article class="word-row"><div><h3>${esc(w.word)} <span class="muted">${esc(w.pos)}</span></h3><p>${esc(w.meaning)}${record(w.id).wrongCount ? `\n答錯 ${record(w.id).wrongCount} 次` : ""}</p></div><div class="word-row-actions"><button class="button" data-speak="${esc(w.id)}">🔊</button><button class="button ${record(w.id).favorite ? "button-danger" : ""}" data-fav="${esc(w.id)}">${record(w.id).favorite ? "♥" : "♡"}</button><button class="button" data-review="${esc(w.id)}">複習</button></div></article>`).join("")}</div>` : `<div class="empty">這個清單目前沒有單字。<br>可以先在複習頁收藏，或完成測驗建立錯題。</div>`;
    $$("[data-fav]", $("#wordList")).forEach(btn=>btn.addEventListener("click",()=>{const r=record(btn.dataset.fav);r.favorite=!r.favorite;persist();renderFavorites();}));
    $$("[data-speak]", $("#wordList")).forEach(btn=>btn.addEventListener("click",()=>{try{speak(wordById(btn.dataset.speak).word)}catch(e){toast(e.message)}}));
    $$("[data-review]", $("#wordList")).forEach(btn=>btn.addEventListener("click",()=>{currentReview=wordById(btn.dataset.review);reviewQueue=[currentReview,...shuffle(words.filter(w=>w.id!==currentReview.id))];flipped=false;setPage("review");}));
  };
  $$("[data-list]").forEach(btn=>btn.addEventListener("click",()=>{listMode=btn.dataset.list;$$("[data-list]").forEach(b=>b.classList.toggle("button-primary",b===btn));draw();}));
  $("#wordSearch").addEventListener("input",draw);
  draw();
}
function renderStats() {
  const s = calculateStats(words, state);
  const recent = [...state.sessions].slice(-7).reverse();
  app.innerHTML = `<div class="panel-heading"><div><h2>學習統計</h2><p>統計依本機保存的複習與測驗紀錄計算。</p></div><span class="pill">${state.sessions.length} 次測驗</span></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="label">題庫單字</div><div class="value">${s.totalWords}</div><div class="hint">目前載入的單字</div></div>
      <div class="stat-card"><div class="label">已複習</div><div class="value">${s.reviewed}</div><div class="hint">至少評分一次</div></div>
      <div class="stat-card"><div class="label">測驗正確率</div><div class="value">${s.accuracy}%</div><div class="hint">${s.totalCorrect} / ${s.totalAnswered} 題答對</div></div>
      <div class="stat-card"><div class="label">待複習</div><div class="value">${s.dueWords}</div><div class="hint">已到下次複習時間</div></div>
      <div class="stat-card"><div class="label">收藏</div><div class="value">${s.favorites}</div><div class="hint">主動標記的單字</div></div>
      <div class="stat-card"><div class="label">錯題單字</div><div class="value">${s.wrongWords}</div><div class="hint">至少答錯一次</div></div>
      <div class="stat-card"><div class="label">尚未複習</div><div class="value">${s.unreviewed}</div><div class="hint">尚未按過評分</div></div>
      <div class="stat-card"><div class="label">累計測驗</div><div class="value">${s.sessions}</div><div class="hint">已完成並保存</div></div>
    </div>
    <div class="side-card" style="margin-top:20px"><h3>最近測驗紀錄</h3>${recent.length ? `<div class="history-list">${recent.map(x=>`<div class="history-row"><div><strong>${modeName(x.mode)}</strong><br><span>${new Date(x.finishedAt).toLocaleString()}</span></div><strong>${x.correct}/${x.total} · ${x.total ? Math.round(x.correct/x.total*100) : 0}%</strong></div>`).join("")}</div>` : `<div class="empty">尚無測驗紀錄。完成一次測驗後即可查看成績。</div>`}</div>`;
}

function bindGlobal() {
  $$(".nav-item").forEach(btn => btn.addEventListener("click", () => setPage(btn.dataset.page)));
  $("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([exportState(state)], {type:"application/json;charset=utf-8"});
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = `vocabulary-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
    toast("已匯出學習紀錄");
  });
  $("#importBtn").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", async e => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const imported = validateImport(JSON.parse(await file.text()));
      if (!confirm("匯入會以備份中的紀錄取代目前紀錄。建議先匯出目前資料。確定繼續？")) return;
      state = imported; persist(); render(); toast("學習紀錄還原完成");
    } catch (error) { toast(error.message || "匯入失敗"); }
    finally { e.target.value = ""; }
  });
  document.addEventListener("keydown", e => {
    if (["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) return;
    if (page === "review") {
      if (e.code === "Space") { e.preventDefault(); flipped = !flipped; renderReview(); }
      if (e.key === "Enter" && currentReview) { try { speak(currentReview.word); } catch(err) { toast(err.message); } }
      if (["1","2","3","4"].includes(e.key)) rateWord(({1:"Again",2:"Hard",3:"Good",4:"Easy"})[e.key]);
    }
  });
}
async function init() {
  bindGlobal();
  try {
    state = loadState();
    words = await loadWords();
    statusEl.textContent = `已載入 ${words.length} 個單字 · 紀錄儲存於此瀏覽器`;
    reviewQueue = shuffle(words);
    currentReview = reviewQueue[0] || null;
    render();
  } catch (error) {
    statusEl.textContent = "題庫載入失敗";
    app.innerHTML = `<div class="empty"><strong>無法載入學習內容</strong><br>${esc(error.message)}<br><br>請確認 GitHub Pages 網址與 data/nov_unit1.csv 路徑，並透過網站網址開啟，不要使用 file://。</div>`;
  }
}
init();
