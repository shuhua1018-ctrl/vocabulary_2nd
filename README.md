# 單字學習中心 2.0

這是依照既有 `nov_unit1.csv` 兩欄格式製作的 GitHub Pages 版學習 App。

## 功能
- 教材篩選：依來源（雜誌／課本）與單元篩選題庫；篩選會直接影響單字卡和測驗出題範圍
- 單字複習：翻卡、英文發音、Again / Hard / Good / Easy、簡易間隔複習
- 單字測驗：英文選中文四選一、中文拼英文、聽音辨字
- 收藏與錯題：收藏管理、測驗錯題自動累積、搜尋及單字重練
- 學習統計：題庫數、已複習、測驗正確率、待複習、收藏、錯題、測驗歷史
- 學習資料：localStorage 儲存、JSON 匯出與匯入

## 檔案
- `index.html`：App 頁面
- `css/style.css`：版面與響應式樣式
- `js/data.js`：CSV 讀取與解析，依教材目錄載入多份題庫
- `data/catalog.json`：教材來源、單元名稱與 CSV 檔案的對照表
- `js/storage.js`：本機學習資料及備份
- `js/quiz.js`：出題、拼字判斷與測驗紀錄
- `js/speech.js`：瀏覽器語音合成
- `js/statistics.js`：統計計算
- `js/app.js`：頁面與互動整合
- `data/nov_unit1.csv`：使用上傳的既有題庫

## 部署到 GitHub Pages
1. 將此資料夾內的檔案與資料夾上傳到同一個 GitHub Repository。
2. 確認路徑與大小寫一致，尤其是 `data/nov_unit1.csv`。
3. 到 Repository 的 Settings → Pages，選擇部署來源（通常是 `Deploy from a branch`），選擇主分支及根目錄。
4. 等待部署完成後，以 GitHub Pages 網址開啟。
5. 不要以 `file://` 直接開啟，因為瀏覽器通常會阻止模組及 CSV fetch。

## 更新單字題庫
維持 CSV 的兩欄格式：
- 標題列：`正面,背面`
- 每列第一欄是英文單字或片語
- 第二欄是完整的詞性、中文、詞性變化、搭配詞與例句文字
- 第二欄含逗號或換行時，請使用 CSV 標準雙引號包住整個欄位

若要新增雜誌或課本單元：
1. 把 CSV 放進 `data/` 資料夾。
2. 編輯 `data/catalog.json`，在 `decks` 陣列新增一筆，例如：
   ```json
   {"id":"textbook-unit1","source":"課本","unit":"Unit 1","label":"課本｜Unit 1","file":"textbook_unit1.csv"}
   ```
3. `id` 必須唯一；`file` 必須與實際檔名完全一致。CSV 欄位使用 `正面,背面` 或 `word,meaning`。

目前這個 ZIP 只包含原先提供的 `nov_unit1.csv`，因此畫面目前會列出「雜誌｜Nov Unit 1」一個單元。新增其他 CSV 並登錄到 `catalog.json` 後，篩選選單就會自動出現那些教材與單元。

## 儲存與隱私提醒
學習紀錄保存在目前瀏覽器的 `localStorage`。換瀏覽器、換裝置、清除網站資料或使用不同的 Pages 網域時，紀錄不會自動同步。請定期按「匯出紀錄」備份 JSON。
