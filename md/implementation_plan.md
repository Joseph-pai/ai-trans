# 翻譯 APP 開發實施計劃（Netlify Function 代理版）

純前端應用（HTML + CSS + JavaScript），使用 Netlify Functions 作為 API 代理，解決瀏覽器 CORS 限制。API Key 儲存在瀏覽器 `localStorage`，透過 Netlify Function 轉發至 DeepSeek / Gemini。

## 架構說明

```
瀏覽器 → Netlify Function（代理） → DeepSeek API
                                  → Gemini API
```

- 前端呼叫自己的 `/.netlify/functions/translate`
- Netlify Function（Node.js）收到請求後，附上 API Key 呼叫第三方 AI API
- 解決 CORS 問題且安全性更高（API Key 在 request body 傳送，不暴露於 URL）

---

## 檔案結構

```
Trans/
├── index.html                      # 主頁面
├── style.css                       # 全域樣式
├── app.js                          # 前端邏輯
├── manifest.json                   # PWA Manifest
├── sw.js                           # Service Worker
├── netlify.toml                    # Netlify 設定
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── netlify/
    └── functions/
        └── translate.js            # Netlify Function 代理
```

---

## 提議修改

### 前端

#### [NEW] [index.html](file:///Users/joseph/Downloads/Trans/index.html)
- 頂部導覽列（APP 名稱 + AI 設定按鈕）
- **AI 設定面板（側拉抽屜）**：選擇平台（DeepSeek / Gemini）、API Key 輸入框、連線測試/儲存按鈕、狀態顯示
- **Tab 1 — 提示詞翻譯**：中文輸入框、翻譯按鈕、英文結果框、複製按鈕
- **Tab 2 — Plan 翻譯**：英文貼入框、翻譯按鈕、中英對照顯示區（逐段對照）

#### [NEW] [style.css](file:///Users/joseph/Downloads/Trans/style.css)
- 深色專業主題（深藍/灰色調，漸層背景）
- Google Fonts（Inter）
- 響應式斷點（手機 / 平板 / 桌面）
- 螢幕旋轉支援、動畫過渡效果、玻璃質感卡片

#### [NEW] [app.js](file:///Users/joseph/Downloads/Trans/app.js)
- AI 設定管理（`localStorage` 讀寫）
- 連線測試：呼叫 `/.netlify/functions/translate` 發送測試 prompt
- 提示詞翻譯：發送中文 → 回傳英文
- Plan 翻譯：逐段翻譯 → 中英對照顯示
- 複製功能（`navigator.clipboard`）、錯誤處理

---

### Netlify Function 代理

#### [NEW] [netlify/functions/translate.js](file:///Users/joseph/Downloads/Trans/netlify/functions/translate.js)
- 接收：`{ platform, apiKey, messages, model }`
- DeepSeek：轉發至 `https://api.deepseek.com/chat/completions`
- Gemini：轉發至 `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- 統一回傳格式給前端

#### [NEW] [netlify.toml](file:///Users/joseph/Downloads/Trans/netlify.toml)
- Functions 目錄設定
- SPA redirect 規則
- 快取標頭

---

### PWA 支援

#### [NEW] [manifest.json](file:///Users/joseph/Downloads/Trans/manifest.json)
#### [NEW] [sw.js](file:///Users/joseph/Downloads/Trans/sw.js)
- Cache First 策略，快取靜態資源，支援離線使用

---

## 驗證計劃

### 本地測試
1. 安裝 Netlify CLI：`npm install -g netlify-cli`
2. `netlify dev`（本地模擬 Functions 環境）
3. 測試 AI 設定連線、提示詞翻譯、Plan 翻譯

### 部署驗證
- 上傳至 GitHub → Netlify 連結 repo → 確認 Functions 部署正常
