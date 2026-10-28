// 讀取既有的兩欄 CSV：正面,背面；支援 UTF-8 BOM、引號及多行欄位。
export function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field.length === 0) {
      quoted = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && next === "\n") i++;
      row.push(field);
      if (row.some(cell => cell.trim() !== "")) rows.push(row);
      row = []; field = "";
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some(cell => cell.trim() !== "")) rows.push(row);
  }
  return rows;
}

function cleanMeaning(back, word) {
  const first = (back.split(/\r?\n/).find(line => line.trim()) || "").trim();
  // 去掉「單字 (詞性)」等前綴，保留中文解釋。
  let meaning = first.replace(/^\s*.+?\s*\((?:[^()]|\([^()]*\))*\)\s*/, "");
  if (!meaning || meaning === first) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    meaning = first.replace(new RegExp("^" + escaped + "\\s*", "i"), "");
  }
  return meaning.trim() || first;
}

function section(back, names) {
  const lines = back.split(/\r?\n/);
  const start = lines.findIndex(line => names.some(name =>
    new RegExp("^\\s*[【\\[（(]?\\s*" + name + "\\s*[】\\]）)]?\\s*[:：]?\\s*$", "i").test(line)
  ));
  if (start < 0) return "";
  const result = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*[【\[(（]/.test(lines[i]) && /[】\])）]/.test(lines[i])) break;
    result.push(lines[i]);
  }
  return result.join("\n").trim();
}

export async function loadWords() {
  const catalogResponse = await fetch("./data/catalog.json", { cache: "no-store" });
  if (!catalogResponse.ok) throw new Error("教材目錄讀取失敗，請確認 data/catalog.json 已上傳。");
  const catalog = await catalogResponse.json();
  if (!Array.isArray(catalog.decks) || !catalog.decks.length) throw new Error("教材目錄沒有設定任何 CSV 題庫。");

  const allWords = [];
  const errors = [];
  for (const deck of catalog.decks) {
    try {
      const response = await fetch(`./data/${encodeURIComponent(deck.file).replace(/%2F/gi, "/")}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = parseCSV(await response.text());
      if (rows.length < 2) throw new Error("沒有可用的單字資料");
      const headers = rows[0].map(v => v.trim().toLowerCase());
      const frontIndex = headers.findIndex(v => ["正面", "word", "front", "單字"].includes(v));
      const backIndex = headers.findIndex(v => ["背面", "meaning", "back", "中文"].includes(v));
      if (frontIndex < 0 || backIndex < 0) throw new Error("CSV 欄位應為「正面,背面」或 word,meaning");

      const usedIds = new Set();
      for (const cells of rows.slice(1)) {
        const word = (cells[frontIndex] || "").trim();
        const back = (cells[backIndex] || "").trim();
        if (!word || !back) continue;
        const baseId = word.toLocaleLowerCase();
        if (usedIds.has(baseId)) continue;
        usedIds.add(baseId);
        const first = (back.split(/\r?\n/).find(line => line.trim()) || "").trim();
        const posMatch = first.match(/\(([^()]*)\)/);
        allWords.push({
          id: `${deck.id}::${baseId}`, word, back,
          meaning: cleanMeaning(back, word),
          pos: posMatch ? posMatch[1] : "",
          forms: section(back, ["詞性變化", "變化", "衍生字", "forms?", "derivative"]),
          collocation: section(back, ["搭配詞", "collocation", "片語"]),
          sentence: section(back, ["例句", "example"]),
          deckId: deck.id,
          source: deck.source || "未分類教材",
          unit: deck.unit || deck.label || deck.file,
          deckLabel: deck.label || `${deck.source || "未分類教材"}｜${deck.unit || deck.file}`
        });
      }
    } catch (error) {
      errors.push(`${deck.file}：${error.message}`);
    }
  }
  if (!allWords.length) throw new Error(`沒有載入任何有效單字。${errors.length ? "\n" + errors.join("\n") : ""}`);
  // 有部分題庫可用時不中斷整個網站，但把失敗題庫列在控制台供除錯。
  if (errors.length) console.warn("部分教材載入失敗：", errors);
  return { words: allWords, decks: catalog.decks, errors };
}
