const KEY = "vocabulary-learning-v2";
const VERSION = 2;

export function freshState() {
  return { version: VERSION, words: {}, sessions: [] };
}

export function loadState() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return freshState();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.words !== "object" || !Array.isArray(parsed.sessions)) {
      throw new Error("資料結構不正確");
    }
    return { version: VERSION, words: parsed.words, sessions: parsed.sessions };
  } catch {
    throw new Error("本機學習紀錄無法解析。為避免覆蓋資料，已停止載入；請先匯出或檢查備份。");
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, version: VERSION }));
  } catch {
    throw new Error("無法儲存學習紀錄，請檢查瀏覽器儲存空間或隱私設定。");
  }
}

export function getWordState(state, id) {
  if (!state.words[id]) {
    state.words[id] = {
      favorite: false, wrongCount: 0, correctCount: 0, reviewCount: 0,
      srs: { Again: 0, Hard: 0, Good: 0, Easy: 0 },
      lastReviewedAt: null, nextReviewAt: null, intervalDays: 0
    };
  }
  return state.words[id];
}

export function exportState(state) {
  return JSON.stringify({ ...state, version: VERSION, exportedAt: new Date().toISOString() }, null, 2);
}

export function validateImport(data) {
  if (!data || typeof data.words !== "object" || !data.words || !Array.isArray(data.sessions)) {
    throw new Error("備份檔格式不正確，未匯入任何資料。");
  }
  for (const [id, item] of Object.entries(data.words)) {
    if (typeof id !== "string" || !item || typeof item !== "object") {
      throw new Error("備份檔含有無效的單字紀錄。");
    }
  }
  return { version: VERSION, words: data.words, sessions: data.sessions };
}
