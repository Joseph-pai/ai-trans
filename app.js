/* ═══════════════════════════════════════════════════════════
   AI 翻譯助手 — app.js
   前端邏輯：AI 設定、提示詞翻譯、Plan 翻譯
═══════════════════════════════════════════════════════════ */

'use strict';

// ─── Storage Keys ─────────────────────────────────────────
const STORAGE_PLATFORM = 'ai_trans_platform';
const STORAGE_KEY      = 'ai_trans_apikey';

// ─── API Endpoint ──────────────────────────────────────────
// 部署到 Netlify 後透過 Function 代理；本地開發用 netlify dev
const API_URL = '/.netlify/functions/translate';

// ══════════════════════════════════════════════════════════
// DOM Elements
// ══════════════════════════════════════════════════════════
const $ = (id) => document.getElementById(id);

// Navbar
const settingsBtn    = $('settingsBtn');
const navStatusBadge = $('navStatusBadge');
const navStatusText  = $('navStatusText');

// Drawer
const drawerOverlay  = $('drawerOverlay');
const settingsDrawer = $('settingsDrawer');
const drawerCloseBtn = $('drawerCloseBtn');
const connectBtn     = $('connectBtn');
const connectIcon    = $('connectIcon');
const connectText    = $('connectText');
const connStatus     = $('connStatus');
const apiKeyInput    = $('apiKeyInput');
const apiKeyToggle   = $('apiKeyToggle');
const apiKeyLabel    = $('apiKeyLabel');

// Platform radios
const platformRadios = document.querySelectorAll('input[name="platform"]');
const cardDeepSeek   = $('cardDeepSeek');
const cardGemini     = $('cardGemini');

// Tab
const tab1Btn = $('tab1Btn');
const tab2Btn = $('tab2Btn');
const panel1  = $('panel1');
const panel2  = $('panel2');

// Prompt Tab
const promptInput    = $('promptInput');
const promptTransBtn = $('promptTransBtn');
const promptTransIcon = $('promptTransIcon');
const promptTransText = $('promptTransText');
const promptClearBtn = $('promptClearBtn');
const promptOutput   = $('promptOutput');
const promptCopyBtn  = $('promptCopyBtn');
const promptError    = $('promptError');

// Plan Tab
const planInput        = $('planInput');
const planTransBtn     = $('planTransBtn');
const planTransIcon    = $('planTransIcon');
const planTransText    = $('planTransText');
const planClearBtn     = $('planClearBtn');
const planOutput       = $('planOutput');
const planResultContainer = $('planResultContainer');
const planPlaceholder  = $('planPlaceholder');
const planCopyBtn      = $('planCopyBtn');
const planCopyZhBtn    = $('planCopyZhBtn');
const planError        = $('planError');

// Toast
const toastContainer = $('toastContainer');


// ══════════════════════════════════════════════════════════
// State
// ══════════════════════════════════════════════════════════
let isConnected    = false;
let currentPlatform = 'deepseek';

// Stored plan pairs for copy
let planPairs = []; // [{en, zh}]


// ══════════════════════════════════════════════════════════
// Init
// ══════════════════════════════════════════════════════════
function init() {
  // Load saved settings
  const savedPlatform = localStorage.getItem(STORAGE_PLATFORM) || 'deepseek';
  const savedKey      = localStorage.getItem(STORAGE_KEY) || '';

  setPlatform(savedPlatform);
  apiKeyInput.value = savedKey;

  if (savedKey) {
    // Mark as connected (key was saved previously)
    setConnectedState(true, `已載入 ${getPlatformName(savedPlatform)} API Key`);
  }

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  bindEvents();
}


// ══════════════════════════════════════════════════════════
// Event Binding
// ══════════════════════════════════════════════════════════
function bindEvents() {
  // Settings drawer
  settingsBtn.addEventListener('click', openDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);
  drawerCloseBtn.addEventListener('click', closeDrawer);

  // Platform selection
  platformRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      setPlatform(radio.value);
      // Reset connection status when switching platform
      resetConnectionStatus();
      const savedKey = localStorage.getItem(STORAGE_KEY + '_' + radio.value) || '';
      apiKeyInput.value = savedKey;
    });
  });

  // API Key toggle visibility
  apiKeyToggle.addEventListener('click', () => {
    const isHidden = apiKeyInput.type === 'password';
    apiKeyInput.type = isHidden ? 'text' : 'password';
    apiKeyToggle.textContent = isHidden ? '🙈' : '👁';
  });

  // Connect & Save
  connectBtn.addEventListener('click', handleConnect);
  apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleConnect();
  });

  // Tabs
  tab1Btn.addEventListener('click', () => switchTab(1));
  tab2Btn.addEventListener('click', () => switchTab(2));

  // Prompt Tab
  promptTransBtn.addEventListener('click', handlePromptTranslate);
  promptClearBtn.addEventListener('click', () => {
    promptInput.value = '';
    promptOutput.value = '';
    hideError(promptError);
    promptInput.focus();
  });
  promptCopyBtn.addEventListener('click', () => {
    copyText(promptOutput.value, '已複製英文翻譯 ✓');
  });

  // Plan Tab
  planTransBtn.addEventListener('click', handlePlanTranslate);
  planClearBtn.addEventListener('click', () => {
    planInput.value = '';
    planOutput.innerHTML = '';
    planPlaceholder.style.display = 'flex';
    planPairs = [];
    hideError(planError);
    planInput.focus();
  });
  planCopyBtn.addEventListener('click', () => {
    const text = planPairs.map(p => `${p.en}\n${p.zh}`).join('\n\n');
    copyText(text, '已複製中英對照全文 ✓');
  });
  planCopyZhBtn.addEventListener('click', () => {
    const text = planPairs.map(p => p.zh).join('\n\n');
    copyText(text, '已複製中文翻譯 ✓');
  });
}


// ══════════════════════════════════════════════════════════
// Tab Switching
// ══════════════════════════════════════════════════════════
function switchTab(num) {
  if (num === 1) {
    tab1Btn.classList.add('active');
    tab2Btn.classList.remove('active');
    panel1.classList.add('active');
    panel2.classList.remove('active');
    tab1Btn.setAttribute('aria-selected', 'true');
    tab2Btn.setAttribute('aria-selected', 'false');
  } else {
    tab2Btn.classList.add('active');
    tab1Btn.classList.remove('active');
    panel2.classList.add('active');
    panel1.classList.remove('active');
    tab2Btn.setAttribute('aria-selected', 'true');
    tab1Btn.setAttribute('aria-selected', 'false');
  }
}


// ══════════════════════════════════════════════════════════
// Drawer
// ══════════════════════════════════════════════════════════
function openDrawer() {
  settingsDrawer.classList.add('open');
  drawerOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  settingsDrawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
  document.body.style.overflow = '';
}


// ══════════════════════════════════════════════════════════
// Platform
// ══════════════════════════════════════════════════════════
function setPlatform(value) {
  currentPlatform = value;
  platformRadios.forEach((r) => {
    r.checked = r.value === value;
  });
  cardDeepSeek.classList.toggle('selected', value === 'deepseek');
  cardGemini.classList.toggle('selected', value === 'gemini');
  apiKeyLabel.textContent = `${getPlatformName(value)} API Key`;
}

function getPlatformName(platform) {
  return platform === 'deepseek' ? 'DeepSeek' : 'Gemini';
}


// ══════════════════════════════════════════════════════════
// Connect & Test
// ══════════════════════════════════════════════════════════
async function handleConnect() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showConnStatus('error', '請先輸入 API Key');
    return;
  }

  setConnectLoading(true);

  try {
    const result = await callAPI({
      platform: currentPlatform,
      apiKey,
      action: 'test',
      text: '',
    });

    // Save to localStorage (per-platform)
    localStorage.setItem(STORAGE_PLATFORM, currentPlatform);
    localStorage.setItem(STORAGE_KEY, apiKey);
    localStorage.setItem(STORAGE_KEY + '_' + currentPlatform, apiKey);

    setConnectedState(true, `${getPlatformName(currentPlatform)} 連線成功！已儲存`);
    showToast('✅ 連線成功，API Key 已儲存');
  } catch (err) {
    setConnectedState(false);
    showConnStatus('error', `❌ 連線失敗：${err.message}`);
  } finally {
    setConnectLoading(false);
  }
}

function setConnectLoading(loading) {
  connectBtn.disabled = loading;
  if (loading) {
    connectIcon.outerHTML = '<span id="connectIcon" class="spinner"></span>';
    $('connectIcon').outerHTML = '<span class="spinner" id="connectIcon"></span>';
    connectText.textContent = '連線測試中...';
  } else {
    connectText.textContent = '連線測試 / 儲存';
    const iconEl = $('connectIcon');
    if (iconEl) iconEl.textContent = '🔗';
  }
}

function setConnectedState(connected, message) {
  isConnected = connected;
  if (connected) {
    navStatusBadge.className = 'status-badge success';
    navStatusText.textContent = getPlatformName(currentPlatform);
    if (message) showConnStatus('success', `✅ ${message}`);
  } else {
    navStatusBadge.className = 'status-badge idle';
    navStatusText.textContent = '未連線';
  }
}

function resetConnectionStatus() {
  connStatus.innerHTML = '';
  isConnected = false;
  navStatusBadge.className = 'status-badge idle';
  navStatusText.textContent = '未連線';
}

function showConnStatus(type, message) {
  connStatus.innerHTML = `
    <div class="status-badge ${type}" style="width:100%;border-radius:8px;padding:9px 14px;">
      ${message}
    </div>`;
}


// ══════════════════════════════════════════════════════════
// Prompt Translation (中文 → 英文)
// ══════════════════════════════════════════════════════════
async function handlePromptTranslate() {
  const text = promptInput.value.trim();
  if (!text) { showToast('請輸入要翻譯的中文內容'); return; }

  const apiKey = getApiKey();
  if (!apiKey) {
    showToast('⚠️ 請先在設定中輸入 API Key');
    openDrawer();
    return;
  }

  hideError(promptError);
  setTranslateLoading(promptTransBtn, promptTransIcon, promptTransText, true, '重新翻譯中...');
  promptOutput.value = ''; // 立即清除舊內容

  try {
    const result = await callAPI({
      platform: currentPlatform,
      apiKey,
      action: 'translate_prompt',
      text,
    });
    promptOutput.value = result;
    showToast('✅ 翻譯已更新');
  } catch (err) {
    showError(promptError, err.message);
  } finally {
    setTranslateLoading(promptTransBtn, promptTransIcon, promptTransText, false, '翻譯為英文');
  }
}


// ══════════════════════════════════════════════════════════
// Plan Translation (英文 → 中英對照)
// ══════════════════════════════════════════════════════════
async function handlePlanTranslate() {
  const text = planInput.value.trim();
  if (!text) { showToast('請貼入要翻譯的英文內容'); return; }

  const apiKey = getApiKey();
  if (!apiKey) {
    showToast('⚠️ 請先在設定中輸入 API Key');
    openDrawer();
    return;
  }

  hideError(planError);
  setTranslateLoading(planTransBtn, planTransIcon, planTransText, true, '正在分段翻譯...');
  
  // 初始化顯示狀態
  planOutput.innerHTML = '';
  planPlaceholder.style.display = 'none';
  planPairs = [];

  // 將原文以「換行」拆分，並過濾掉空白行
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 分段處理（每 10 行一組，避免超時並確保配對）
  const chunkSize = 10;
  const chunks = [];
  for (let i = 0; i < lines.length; i += chunkSize) {
    chunks.push(lines.slice(i, i + chunkSize));
  }

  try {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      // 將字串陣列轉為 JSON 發送，確保 AI 能一對一翻譯
      const chunkText = JSON.stringify(chunk);
      
      if (chunks.length > 1) {
        setTranslateLoading(planTransBtn, planTransIcon, planTransText, true, `翻中 (${i + 1}/${chunks.length})...`);
      }

      const result = await callAPI({
        platform: currentPlatform,
        apiKey,
        action: 'translate_plan',
        text: chunkText,
      });

      // 解析這一段的回傳（預期為 JSON 陣列）
      let translations = [];
      try {
        // 清理 AI 可能附帶的 markdown 引號，確保是純 JSON
        const cleanResult = result.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
        translations = JSON.parse(cleanResult);
      } catch (e) {
        // 若 AI 回傳的不是純 JSON，降級使用換行符拆分
        translations = result.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      }
      
      // 將原文與回傳的譯文配對顯示
      const count = Math.max(chunk.length, translations.length);
      for (let j = 0; j < count; j++) {
        const pair = { 
          en: chunk[j] ? chunk[j].trim() : '', 
          zh: translations[j] ? translations[j].toString().trim() : '' 
        };
        // 忽略沒有內容的雜訊配對
        if (pair.en || pair.zh) {
          planPairs.push(pair);
          appendPlanPair(pair, planPairs.length - 1);
        }
      }
    }
    
    showToast(`✅ 翻譯完成，共 ${planPairs.length} 段`);
  } catch (err) {
    showError(planError, err.message);
    if (planPairs.length === 0) planPlaceholder.style.display = 'flex';
  } finally {
    setTranslateLoading(planTransBtn, planTransIcon, planTransText, false, '生成中英對照');
  }
}

/**
 * 原本的 parsePlanResult 已由 handlePlanTranslate 內部的配對邏輯取代
 */
function appendPlanPair(pair, index) {
  const div = document.createElement('div');
  div.className = 'plan-pair' + (index % 2 === 0 ? '' : ' highlighted');
  div.innerHTML = `
    <p class="plan-en">${escapeHtml(pair.en)}</p>
    <p class="plan-zh">${escapeHtml(pair.zh)}</p>
  `;
  planOutput.appendChild(div);
  // 自動捲動到底部，讓用戶看到進度
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

/* parsePlanResult 與 renderPlanPairs 已被取代 */


// ══════════════════════════════════════════════════════════
// API Call
// ══════════════════════════════════════════════════════════
async function callAPI(payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/html')) {
    throw new Error('伺服器設定錯誤 (收到 HTML 而非 JSON)。請確認 Netlify Functions 是否部署成功。');
  }

  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error('無法解析伺服器回應 (Invalid JSON)。');
  }

  if (!response.ok || data.error) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data.result;
}


// ══════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════
function getApiKey() {
  return localStorage.getItem(STORAGE_KEY) || apiKeyInput.value.trim();
}

function setTranslateLoading(btn, iconEl, textEl, loading, label) {
  btn.disabled = loading;
  if (loading) {
    iconEl.outerHTML = `<span class="spinner" id="${iconEl.id}"></span>`;
    textEl.textContent = label;
  } else {
    const el = document.getElementById(iconEl.id);
    if (el) el.outerHTML = `<span id="${iconEl.id}">🌐</span>`;
    textEl.textContent = label;
  }
}

function showError(el, message) {
  el.textContent = `❌ ${message}`;
  el.style.display = 'block';
}

function hideError(el) {
  el.style.display = 'none';
  el.textContent = '';
}

async function copyText(text, successMsg) {
  if (!text) { showToast('沒有可複製的內容'); return; }
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg || '已複製 ✓');
  } catch {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(successMsg || '已複製 ✓');
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}


// ══════════════════════════════════════════════════════════
// Start App
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', init);
