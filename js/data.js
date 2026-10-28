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
  const response = await fetch("./data/nov_unit1.csv", { cache: "no-store" });
  if (!response.ok) throw new Error(`題庫讀取失敗（HTTP ${response.status}），請確認 data/nov_unit1.csv 路徑。`);
  const text = await response.text();
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error("CSV 沒有可用的單字資料。");

  const headers = rows[0].map(v => v.trim().toLowerCase());
  const frontIndex = headers.findIndex(v => ["正面", "word", "front", "單字"].includes(v));
  const backIndex = headers.findIndex(v => ["背面", "meaning", "back", "中文"].includes(v));
  if (frontIndex < 0 || backIndex < 0) throw new Error("CSV 欄位應為「正面,背面」或 word,meaning。");

  const usedIds = new Set();
  const words = [];
  for (const cells of rows.slice(1)) {
    const word = (cells[frontIndex] || "").trim();
    const back = (cells[backIndex] || "").trim();
    if (!word || !back) continue;
    const id = word.toLocaleLowerCase();
    if (usedIds.has(id)) continue;
    usedIds.add(id);
    const first = (back.split(/\r?\n/).find(line => line.trim()) || "").trim();
    const posMatch = first.match(/\(([^()]*)\)/);
    words.push({
      id, word, back,
      meaning: cleanMeaning(back, word),
      pos: posMatch ? posMatch[1] : "",
      forms: section(back, ["詞性變化", "變化", "衍生字", "forms?", "derivative"]),
      collocation: section(back, ["搭配詞", "collocation", "片語"]),
      sentence: section(back, ["例句", "example"])
    });
  }
  if (!words.length) throw new Error("CSV 已載入，但沒有解析到有效單字。");
  return words;
}
